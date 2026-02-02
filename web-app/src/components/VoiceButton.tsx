import { useState, useEffect, useCallback } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import type { VoiceAction } from '../hooks/useVoiceAssistant';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { StatusDot } from './ui/StatusDot';
import { CloseButton } from './ui/CloseButton';

interface VoiceButtonProps {
  onAction?: (actions: VoiceAction[]) => void;
  className?: string;
}

export function VoiceButton({ onAction, className = '' }: VoiceButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [recentActions, setRecentActions] = useState<VoiceAction[]>([]);

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

  const getButtonColor = () => {
    if (!isConnected) return 'bg-zinc-700';
    if (isRecording) return 'bg-red-500 animate-pulse';
    if (isProcessing) return 'bg-amber-500';
    return 'bg-violet-600 hover:bg-violet-500';
  };

  return (
    <>
      {/* Header Button - opens modal */}
      <button
        onClick={() => setShowModal(true)}
        className={`
          relative p-2 rounded-lg transition-all duration-200
          ${getButtonColor()}
          ${!isConnected ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
          active:scale-95
          ${className}
        `}
        title={isConnected ? 'Voice Assistant' : 'Connecting...'}
      >
        {isProcessing ? (
          <LoadingSpinner size="md" color="white" />
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
        )}
        
        {/* Connection status dot */}
        <StatusDot
          connected={isConnected}
          size="sm"
          bordered
          className="absolute -top-0.5 -right-0.5"
        />
      </button>

      {/* Voice Assistant Modal */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black/80 min-h-screen backdrop-blur-sm z-50 flex items-center justify-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !isRecording && !isProcessing) {
              handleCloseModal();
            }
          }}
        >
          <div className="relative bg-zinc-900 w-full h-full sm:h-auto sm:max-w-sm sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-zinc-800/50 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <StatusDot connected={isConnected} size="lg" />
                <span className="font-semibold text-lg">Belle</span>
              </div>
              <CloseButton
                onClick={handleCloseModal}
                disabled={isRecording || isProcessing}
                variant="subtle"
                size="sm"
              />
            </div>

            {/* Main Content - flex-grow on mobile to fill space */}
            <div className="p-6 flex flex-col items-center justify-center flex-1 sm:flex-initial">
              {/* Large Record Button - bigger on mobile */}
              <div className="relative mb-6">
                {/* Pulsing rings when recording */}
                {isRecording && (
                  <>
                    <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" style={{ animationDuration: '1.5s' }} />
                    <div className="absolute -inset-6 sm:-inset-4 rounded-full bg-red-500/10 animate-pulse" />
                  </>
                )}
                
                <button
                  onClick={handleRecordToggle}
                  disabled={!isConnected || isProcessing}
                  className={`
                    relative w-32 h-32 sm:w-24 sm:h-24 rounded-full flex items-center justify-center
                    transition-all duration-300 transform
                    ${isRecording 
                      ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/50' 
                      : isProcessing
                      ? 'bg-amber-500 cursor-wait'
                      : isConnected
                      ? 'bg-violet-600 hover:bg-violet-500 hover:scale-105 active:scale-95'
                      : 'bg-zinc-700 cursor-not-allowed opacity-60'
                    }
                  `}
                >
                  {isProcessing ? (
                    <LoadingSpinner size="lg" color="white" />
                  ) : isRecording ? (
                    <svg className="w-12 h-12 sm:w-10 sm:h-10" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2" />
                    </svg>
                  ) : (
                    <svg className="w-12 h-12 sm:w-10 sm:h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Status Text */}
              <div className="text-center mb-4">
                <p className={`text-xl sm:text-lg font-medium ${isRecording ? 'text-red-400' : isProcessing ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {!isConnected ? 'Connecting...' : isRecording ? 'Listening...' : isProcessing ? 'Thinking...' : 'Tap to speak'}
                </p>
                {!isConnected && (
                  <button onClick={connect} className="text-sm text-violet-400 hover:text-violet-300 mt-1">
                    Retry connection
                  </button>
                )}
              </div>

              {/* Audio Waveform Animation (when recording) */}
              {isRecording && (
                <div className="flex items-center justify-center gap-1.5 h-10 sm:h-8 mb-4">
                  {[...Array(7)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1.5 sm:w-1 bg-red-500 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 32 + 8}px`,
                        animationDelay: `${i * 0.1}s`,
                        animationDuration: '0.5s',
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Conversation Area - scrollable, takes remaining space on mobile */}
            <div className="px-6 pb-6 space-y-3 overflow-y-auto flex-1 sm:flex-initial sm:max-h-64">
              {/* Transcript */}
              {transcript && (
                <div className="bg-zinc-800/50 rounded-2xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">You said:</p>
                  <p className="text-zinc-200">{transcript}</p>
                </div>
              )}

              {/* Response */}
              {response && (
                <div className="bg-violet-500/10 border border-violet-500/20 rounded-2xl p-4">
                  <p className="text-xs text-violet-400 mb-1">Belle:</p>
                  <p className="text-zinc-200">{response}</p>
                </div>
              )}

              {/* Actions */}
              {recentActions.length > 0 ? (
                <div className="bg-zinc-800/30 rounded-2xl p-4">
                  <p className="text-xs text-zinc-500 mb-2">Actions taken:</p>
                  <div className="space-y-1.5">
                    {recentActions.map((action, i) => (
                      <div
                        key={i}
                        className={`text-sm flex items-center gap-2 ${action.success ? 'text-green-400' : 'text-red-400'}`}
                      >
                        {action.success ? (
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                        <span>{action.device}: {action.action}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : response && (
                <div className="bg-zinc-800/30 rounded-2xl p-4">
                  <div className="text-sm flex items-center gap-2 text-blue-400">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Status inquiry - no actions taken</span>
                  </div>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
                  <svg className="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!transcript && !response && !error && !isRecording && !isProcessing && (
                <div className="text-center text-zinc-500 text-sm py-4">
                  <p>Tap the microphone to start</p>
                  <p className="text-xs mt-1">Ask Belle to control your devices</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
