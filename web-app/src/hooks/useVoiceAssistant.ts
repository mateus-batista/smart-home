import { useState, useCallback, useRef, useEffect } from 'react';

export type VoiceAction = {
  device?: string;
  action?: string;
  success: boolean;
};

export type VoiceResponse = {
  type: 'transcript' | 'response' | 'error' | 'no_speech';
  transcript?: string;
  text?: string;
  language?: string;
  response?: string;
  audio?: string;
  actions?: VoiceAction[];
  message?: string;
};

interface UseVoiceAssistantOptions {
  wsUrl?: string;
  onTranscript?: (text: string) => void;
  onResponse?: (response: string, actions: VoiceAction[]) => void;
  onError?: (error: string) => void;
  onAudioResponse?: (audioBase64: string) => void;
}

  // Create WAV file from audio data
  const createWavFile = (samples: Float32Array, sampleRate: number): ArrayBuffer => {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // Write audio data
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return buffer;
  };


// Get WebSocket URL from environment variable or fall back to auto-detection
function getDefaultWsUrl(): string {
  // Use environment variable if set
  if (import.meta.env.VITE_VOICE_WS_URL) {
    return import.meta.env.VITE_VOICE_WS_URL;
  }
  // Auto-detect: use /ws path with appropriate protocol
  // Works with both Vite proxy (/voice-ws) and HTTPS reverse proxy (/ws)
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const wsPath = window.location.protocol === 'https:' ? '/ws' : '/voice-ws';
  return `${protocol}//${host}${wsPath}`;
}

// VAD tuning constants
const SPEECH_THRESHOLD = 30;    // 0-255 avg frequency energy to trigger recording
const SILENCE_THRESHOLD = 15;   // energy below this = silence
const SILENCE_DURATION = 1200;  // ms of continuous silence before auto-stop
const VAD_POLL_INTERVAL = 80;   // ms between energy checks

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const { wsUrl = getDefaultWsUrl() } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeechDetected, setIsSpeechDetected] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(false);

  // VAD refs
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const isProcessingRef = useRef(false);
  const isRecordingRef = useRef(false);
  const mimeTypeRef = useRef<string | undefined>(undefined);

  // Keep refs in sync with state
  isProcessingRef.current = isProcessing;
  isRecordingRef.current = isRecording;

  // Store callbacks in refs to avoid recreating connect on every render
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  // Play audio response using AudioContext (works on mobile where new Audio().play() is blocked)
  const playAudioResponse = useCallback((audioBase64: string) => {
    try {
      // Reuse the VAD AudioContext (already unlocked by user gesture) or create one
      let ctx = audioContextRef.current;
      if (!ctx || ctx.state === 'closed') {
        ctx = new AudioContext();
        audioContextRef.current = ctx;
      }
      // Resume if suspended (mobile Safari pauses AudioContext in background)
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Decode base64 WAV and play through AudioContext
      const binaryString = atob(audioBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      ctx.decodeAudioData(bytes.buffer.slice(0)).then((audioBuffer) => {
        const source = ctx!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx!.destination);
        source.start();
      }).catch((err) => {
        console.error('Failed to decode audio:', err);
      });
    } catch (err) {
      console.error('Failed to play audio:', err);
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(() => {
    // Prevent multiple connection attempts
    if (wsRef.current) {
      const state = wsRef.current.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) {
        return;
      }
      // Clean up old socket
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current || wsRef.current !== ws) {
          ws.close();
          return;
        }
        setIsConnected(true);
        setError(null);
        console.log('Voice assistant connected');
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
        if (mountedRef.current) {
          setIsConnected(false);
          console.log('Voice assistant disconnected');
        }
      };

      ws.onerror = () => {
        if (mountedRef.current) {
          setError('Failed to connect to voice assistant');
          callbacksRef.current.onError?.('Failed to connect to voice assistant');
        }
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const data: VoiceResponse = JSON.parse(event.data);

          if (data.type === 'transcript') {
            setTranscript(data.text || null);
            callbacksRef.current.onTranscript?.(data.text || '');
          } else if (data.type === 'response') {
            setIsProcessing(false);
            setResponse(data.response || null);
            setTranscript(data.transcript || null);
            callbacksRef.current.onResponse?.(data.response || '', data.actions || []);

            // Play audio response if available
            if (data.audio) {
              playAudioResponse(data.audio);
              callbacksRef.current.onAudioResponse?.(data.audio);
            }
          } else if (data.type === 'no_speech') {
            // Server detected no speech in audio — resume VAD
            setIsProcessing(false);
          } else if (data.type === 'error') {
            setIsProcessing(false);
            setError(data.message || 'Unknown error');
            callbacksRef.current.onError?.(data.message || 'Unknown error');
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
    }
  }, [wsUrl, playAudioResponse]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Convert audio blob to WAV format
  const convertToWav = useCallback(async (blob: Blob): Promise<Blob> => {
    const audioContext = new AudioContext({ sampleRate: 16000 });
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Convert to mono if needed
    const channelData = audioBuffer.getChannelData(0);

    // Create WAV file
    const wavBuffer = createWavFile(channelData, 16000);

    audioContext.close();
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }, []);


  // Send audio to server
  const sendAudio = useCallback(
    async (audioBlob: Blob) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        setError('Not connected to voice assistant');
        setIsProcessing(false);
        return;
      }

      try {
        // Convert webm to WAV using Web Audio API
        const wavBlob = await convertToWav(audioBlob);

        // Convert to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];

          wsRef.current?.send(
            JSON.stringify({
              type: 'audio',
              data: base64,
              format: 'wav',
            })
          );
        };
        reader.readAsDataURL(wavBlob);
      } catch (err) {
        console.error('Failed to send audio:', err);
        setError('Failed to process audio');
        setIsProcessing(false);
      }
    },
    [convertToWav]
  );

  // Get supported mimeType for recording
  const getSupportedMimeType = useCallback(() => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/wav',
      '', // Default/fallback
    ];

    for (const type of types) {
      if (type === '' || MediaRecorder.isTypeSupported(type)) {
        console.log('[Voice] Using mimeType:', type || 'default');
        return type || undefined;
      }
    }
    return undefined;
  }, []);

  // Start a MediaRecorder on the existing stream (called by VAD when speech detected)
  const startRecorderOnStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || isRecordingRef.current) return;

    const mimeType = mimeTypeRef.current;
    const options: MediaRecorderOptions = {};
    if (mimeType) {
      options.mimeType = mimeType;
    }

    const mediaRecorder = new MediaRecorder(stream, options);
    const actualMimeType = mediaRecorder.mimeType || 'audio/webm';

    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      // Don't stop stream tracks — stream stays open for VAD
      const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
      await sendAudio(audioBlob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(100);
    setIsRecording(true);
    setError(null);
    setTranscript(null);
    setResponse(null);
  }, [sendAudio]);

  // Stop the current MediaRecorder (called by VAD on silence)
  const stopRecorder = useCallback(() => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') return;
    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setIsProcessing(true);
    setIsSpeechDetected(false);
  }, []);

  // Start always-on listening with VAD
  const startListening = useCallback(async () => {
    if (streamRef.current) return; // already listening

    if (!window.isSecureContext) {
      setError('Microphone requires HTTPS. Use localhost or enable HTTPS.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not supported in this browser');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = stream;

      // Determine supported mime type once
      mimeTypeRef.current = getSupportedMimeType();

      // Set up AnalyserNode for energy monitoring
      // Reuse AudioContext if already unlocked by user gesture, otherwise create new
      const audioContext = (audioContextRef.current && audioContextRef.current.state !== 'closed')
        ? audioContextRef.current
        : new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // VAD polling loop
      const frequencyData = new Uint8Array(analyser.frequencyBinCount);

      vadIntervalRef.current = setInterval(() => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(frequencyData);

        // Compute average energy
        let sum = 0;
        for (let i = 0; i < frequencyData.length; i++) {
          sum += frequencyData[i];
        }
        const avgEnergy = sum / frequencyData.length;

        // Skip VAD while processing server response
        if (isProcessingRef.current) {
          silenceStartRef.current = null;
          return;
        }

        if (!isRecordingRef.current) {
          // Not recording — check if speech started
          if (avgEnergy > SPEECH_THRESHOLD) {
            silenceStartRef.current = null;
            setIsSpeechDetected(true);
            startRecorderOnStream();
          }
        } else {
          // Currently recording — check for silence
          if (avgEnergy < SILENCE_THRESHOLD) {
            if (silenceStartRef.current === null) {
              silenceStartRef.current = Date.now();
            } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION) {
              // Sustained silence — stop recording and send
              silenceStartRef.current = null;
              stopRecorder();
            }
          } else {
            // Speech continuing
            silenceStartRef.current = null;
          }
        }
      }, VAD_POLL_INTERVAL);

      setError(null);
    } catch (err: unknown) {
      console.error('Failed to start listening:', err);

      let errorMessage = 'Microphone access denied';
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Microphone permission denied. Please allow access in your browser settings.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No microphone found. Please connect a microphone.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Microphone is in use by another app.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'Microphone does not meet requirements.';
        } else if (err.name === 'SecurityError') {
          errorMessage = 'Microphone blocked. HTTPS required for mobile.';
        } else {
          errorMessage = `Microphone error: ${err.message}`;
        }
      }

      setError(errorMessage);
      callbacksRef.current.onError?.(errorMessage);
    }
  }, [getSupportedMimeType, startRecorderOnStream, stopRecorder]);

  // Stop listening — full teardown
  const stopListening = useCallback(() => {
    // Clear VAD interval
    if (vadIntervalRef.current) {
      clearInterval(vadIntervalRef.current);
      vadIntervalRef.current = null;
    }

    // Stop MediaRecorder if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);

    // Close AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    // Stop all tracks on stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setIsSpeechDetected(false);
    silenceStartRef.current = null;
  }, []);

  // Unlock AudioContext for mobile — must be called from a user gesture (tap/click)
  // Mobile browsers require AudioContext creation/resume within a user interaction
  const unlockAudio = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, []);

  // Send text message (for testing without microphone)
  const sendText = useCallback((text: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to voice assistant');
      return;
    }

    setIsProcessing(true);
    setTranscript(text);
    setResponse(null);
    setError(null);

    wsRef.current.send(
      JSON.stringify({
        type: 'text',
        message: text,
        include_audio: true,
      })
    );
  }, []);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    mountedRef.current = true;

    // Small delay to avoid StrictMode double-mount issues
    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        connect();
      }
    }, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      stopListening();
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount, connect/disconnect are stable refs

  return {
    isConnected,
    isRecording,
    isProcessing,
    isSpeechDetected,
    transcript,
    response,
    error,
    connect,
    disconnect,
    startListening,
    stopListening,
    sendText,
    unlockAudio,
  };
}
