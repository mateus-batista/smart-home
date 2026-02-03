import { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, X, Check, Info, Square } from 'lucide-react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import type { VoiceAction } from '../hooks/useVoiceAssistant';
import { StatusDot } from './ui/StatusDot';

interface VoiceButtonProps {
  onAction?: (actions: VoiceAction[]) => void;
  className?: string;
}

export function VoiceButton({ onAction, className = '' }: VoiceButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [recentActions, setRecentActions] = useState<VoiceAction[]>([]);
  const conversationRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    isRecording,
    isProcessing,
    transcript,
    response,
    error,
    startRecording,
    stopRecording,
    connect,
  } = useVoiceAssistant({
    onResponse: (_, actions) => {
      setRecentActions(actions);
      onAction?.(actions);
    },
  });

  // Auto-scroll conversation to bottom
  useEffect(() => {
    if (conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [transcript, response, recentActions, error]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showModal]);

  // Toggle recording on/off
  const handleRecordToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else if (isConnected && !isProcessing) {
      startRecording();
    }
  }, [isRecording, isConnected, isProcessing, startRecording, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Stop recording when modal closes
  const handleCloseModal = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    setShowModal(false);
  }, [isRecording, stopRecording]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isRecording && !isProcessing) {
      handleCloseModal();
    }
  }, [isRecording, isProcessing, handleCloseModal]);

  const getButtonState = () => {
    if (!isConnected) return 'disconnected';
    if (isRecording) return 'recording';
    if (isProcessing) return 'processing';
    return 'ready';
  };

  const buttonState = getButtonState();

  return (
    <>
      {/* Compact Header Button */}
      <button
        onClick={() => setShowModal(true)}
        className={`
          relative flex items-center gap-2 px-3 py-1.5 rounded-full
          transition-all duration-300 ease-out
          ${buttonState === 'disconnected'
            ? 'bg-zinc-800 text-zinc-500'
            : buttonState === 'recording'
            ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/50'
            : buttonState === 'processing'
            ? 'bg-amber-500/20 text-amber-400'
            : 'bg-violet-500/20 text-violet-400 hover:bg-violet-500/30'
          }
          ${className}
        `}
        title={isConnected ? 'Voice Assistant' : 'Connecting...'}
      >
        <StatusDot connected={isConnected} size="sm" />
        <span className="text-sm font-medium">Belle</span>
        {isProcessing && (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {/* Voice Assistant Modal - Full screen on mobile, centered on desktop */}
      {showModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4"
          style={{ minHeight: '100dvh' }}
          onClick={handleBackdropClick}
        >
          {/* Modal Content */}
          <div className="w-full h-full sm:h-auto sm:max-h-[600px] sm:max-w-md bg-zinc-900 sm:rounded-3xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-zinc-800/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center
                  ${isConnected ? 'bg-violet-500/20' : 'bg-zinc-700'}
                `}>
                  <Mic className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-white text-lg">Belle</h2>
                  <p className="text-xs text-zinc-500">
                    {!isConnected ? 'Connecting...' : 'Voice Assistant'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseModal}
                disabled={isRecording || isProcessing}
                className="p-2 rounded-full hover:bg-zinc-700 transition-colors disabled:opacity-50"
              >
                <X className="w-6 h-6 text-zinc-400" />
              </button>
            </div>

            {/* Conversation Area - Scrollable, takes available space */}
            <div
              ref={conversationRef}
              className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
            >
              {/* Empty state */}
              {!transcript && !response && !error && !isRecording && !isProcessing && (
                <div className="h-full flex flex-col items-center justify-center text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-violet-500/10 flex items-center justify-center mb-4">
                    <Mic className="w-8 h-8 text-violet-400" strokeWidth={1.5} />
                  </div>
                  <p className="text-zinc-400 text-sm">Tap the microphone to speak</p>
                  <p className="text-zinc-600 text-xs mt-1">Ask Belle to control your devices</p>
                </div>
              )}

              {/* Transcript bubble */}
              {transcript && (
                <div className="flex justify-end">
                  <div className="bg-zinc-800 rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-zinc-200">{transcript}</p>
                  </div>
                </div>
              )}

              {/* Response bubble */}
              {response && (
                <div className="flex justify-start">
                  <div className="bg-violet-500/15 border border-violet-500/20 rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-zinc-200">{response}</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              {recentActions.length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-zinc-800/50 rounded-2xl px-4 py-3 max-w-[85%]">
                    <p className="text-xs text-zinc-500 mb-2">Actions</p>
                    <div className="space-y-1.5">
                      {recentActions.map((action, i) => (
                        <div
                          key={i}
                          className={`text-sm flex items-center gap-2 ${action.success ? 'text-emerald-400' : 'text-red-400'}`}
                        >
                          {action.success ? (
                            <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                          ) : (
                            <X className="w-3.5 h-3.5 shrink-0" strokeWidth={2.5} />
                          )}
                          <span>{action.device}: {action.action}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Info note when response but no actions */}
              {response && recentActions.length === 0 && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 text-xs text-blue-400/70 px-1">
                    <Info className="w-3.5 h-3.5" />
                    <span>Information only - no actions taken</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="flex justify-start">
                  <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-2.5 max-w-[85%]">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Voice Input Section - Fixed at bottom */}
            <div className="shrink-0 px-6 py-6 bg-zinc-800/30 border-t border-zinc-800">
              <div className="flex flex-col items-center">
                {/* Status text */}
                <p className={`
                  text-sm font-medium mb-4 transition-colors
                  ${isRecording ? 'text-red-400' : isProcessing ? 'text-amber-400' : 'text-zinc-500'}
                `}>
                  {!isConnected ? 'Connecting...' : isRecording ? 'Listening...' : isProcessing ? 'Thinking...' : 'Tap to speak'}
                </p>

                {/* Animated Voice Orb */}
                <div className="relative">
                  {/* Outer glow rings */}
                  {isRecording && (
                    <>
                      <div className="absolute inset-0 -m-4 rounded-full bg-red-500/10 animate-ping" style={{ animationDuration: '2s' }} />
                      <div className="absolute inset-0 -m-2 rounded-full bg-red-500/20 animate-pulse" />
                    </>
                  )}
                  {isProcessing && (
                    <div className="absolute inset-0 -m-2 rounded-full bg-amber-500/20 animate-pulse" />
                  )}

                  {/* Main Orb Button */}
                  <button
                    onClick={handleRecordToggle}
                    disabled={!isConnected || isProcessing}
                    className={`
                      relative w-16 h-16 rounded-full
                      flex items-center justify-center
                      transition-all duration-300 ease-out
                      ${isRecording
                        ? 'bg-gradient-to-br from-red-500 to-rose-600 scale-110 shadow-lg shadow-red-500/30'
                        : isProcessing
                        ? 'bg-gradient-to-br from-amber-500 to-orange-500 cursor-wait shadow-lg shadow-amber-500/20'
                        : isConnected
                        ? 'bg-gradient-to-br from-violet-500 to-purple-600 hover:scale-105 active:scale-95 shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40'
                        : 'bg-zinc-700 cursor-not-allowed'
                      }
                    `}
                  >
                    {/* Inner gradient overlay */}
                    <div className="absolute inset-1 rounded-full bg-gradient-to-t from-transparent to-white/20" />

                    {/* Icon */}
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : isRecording ? (
                      <Square className="w-5 h-5 text-white relative z-10" fill="white" />
                    ) : (
                      <Mic className="w-7 h-7 text-white relative z-10" strokeWidth={1.5} />
                    )}
                  </button>
                </div>

                {/* Audio visualization when recording */}
                {isRecording && (
                  <div className="flex items-end justify-center gap-1 h-6 mt-3">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-red-400 rounded-full animate-waveform"
                        style={{
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* Retry connection button */}
                {!isConnected && (
                  <button
                    onClick={connect}
                    className="mt-3 text-sm text-violet-400 hover:text-violet-300 transition-colors"
                  >
                    Retry connection
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes waveform {
          0%, 100% {
            transform: scaleY(0.3);
          }
          50% {
            transform: scaleY(1);
          }
        }
        .animate-waveform {
          animation: waveform 0.5s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
