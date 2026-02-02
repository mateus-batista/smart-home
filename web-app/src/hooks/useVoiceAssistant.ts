import { useState, useCallback, useRef, useEffect } from 'react';

export type VoiceAction = {
  device?: string;
  action?: string;
  success: boolean;
};

export type VoiceResponse = {
  type: 'transcript' | 'response' | 'error';
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

export function useVoiceAssistant(options: UseVoiceAssistantOptions = {}) {
  const { wsUrl = getDefaultWsUrl() } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mountedRef = useRef(false);

  // Store callbacks in refs to avoid recreating connect on every render
  const callbacksRef = useRef(options);
  callbacksRef.current = options;

  // Play audio response
  const playAudioResponse = useCallback((audioBase64: string) => {
    try {
      const audio = new Audio(`data:audio/wav;base64,${audioBase64}`);
      audio.play().catch((err) => {
        console.error('Failed to play audio:', err);
      });
    } catch (err) {
      console.error('Failed to create audio element:', err);
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

  // Start recording
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    // Check if we're in a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
      setError('Microphone requires HTTPS. Use localhost or enable HTTPS.');
      callbacksRef.current.onError?.('Microphone requires HTTPS');
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone not supported in this browser');
      callbacksRef.current.onError?.('Microphone not supported');
      return;
    }

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Create MediaRecorder with supported mimeType
      const mimeType = getSupportedMimeType();
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
        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());

        // Convert to WAV and send
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMimeType });
        await sendAudio(audioBlob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setError(null);
      setTranscript(null);
      setResponse(null);
    } catch (err: unknown) {
      console.error('Failed to start recording:', err);
      
      // Provide specific error messages
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
  }, [isRecording, sendAudio, getSupportedMimeType]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;

    mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setIsProcessing(true);
  }, [isRecording]);

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
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount, connect/disconnect are stable refs

  return {
    isConnected,
    isRecording,
    isProcessing,
    transcript,
    response,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendText,
  };
}
