import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import type { VoiceAction } from '../hooks/useVoiceAssistant';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { StatusDot } from './ui/StatusDot';
import { VoiceOrb } from './VoiceOrb';
import { DynamicBackground } from './voice/DynamicBackground';
import { FloatingParticles } from './voice/FloatingParticles';
import { ConversationOverlay } from './voice/ConversationOverlay';

type OrbState = 'idle' | 'listening';

interface VoiceButtonProps {
  onAction?: (actions: VoiceAction[]) => void;
  className?: string;
}

export function VoiceButton({ onAction, className = '' }: VoiceButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [recentActions, setRecentActions] = useState<VoiceAction[]>([]);

  const {
    isConnected,
    isRecording,
    isProcessing,
    isSpeechDetected,
    transcript,
    response,
    error,
    startListening,
    stopListening,
    connect,
    unlockAudio,
  } = useVoiceAssistant({
    onResponse: (_, actions) => {
      setRecentActions(actions);
      onAction?.(actions);
    },
  });

  // Lock body scroll when modal is open
  useBodyScrollLock(showModal);

  // Start/stop listening when modal opens/closes
  useEffect(() => {
    if (showModal && isConnected) {
      startListening();
    }
  }, [showModal, isConnected, startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close with exit animation
  const handleCloseModal = useCallback(() => {
    stopListening();
    setIsExiting(true);
    setTimeout(() => {
      setShowModal(false);
      setIsExiting(false);
    }, 300);
  }, [stopListening]);

  // Handle backdrop click — only close when idle
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isRecording && !isProcessing) {
      handleCloseModal();
    }
  }, [isRecording, isProcessing, handleCloseModal]);

  // Derive orb state
  const orbState: OrbState = (isSpeechDetected || isRecording) ? 'listening' : 'idle';

  const statusText = !isConnected
    ? 'Connecting...'
    : isProcessing
    ? 'Thinking...'
    : (isSpeechDetected || isRecording)
    ? 'Listening...'
    : 'Say something...';

  return (
    <>
      {/* Compact Header Button */}
      <button
        onClick={() => { unlockAudio(); setShowModal(true); }}
        className={`
          relative flex items-center gap-2 px-3 py-1.5 rounded-full
          transition-all duration-300 ease-out
          ${!isConnected
            ? 'bg-zinc-800 text-zinc-500'
            : isRecording
            ? 'ring-2'
            : ''
          }
          ${className}
        `}
        style={!isConnected ? undefined : {
          backgroundColor: isRecording
            ? 'rgba(212,160,84,0.25)'
            : 'rgba(212,160,84,0.15)',
          color: '#d4a054',
          '--tw-ring-color': 'rgba(212,160,84,0.5)',
        } as React.CSSProperties}
        title={isConnected ? 'Voice Assistant' : 'Connecting...'}
      >
        <StatusDot connected={isConnected} size="sm" />
        <span className="text-sm font-medium">Belle</span>
      </button>

      {/* Full-screen Immersive Voice Modal */}
      {showModal && (
        <div
          className={`fixed inset-0 z-50 ${isExiting ? 'animate-immersive-exit' : 'animate-immersive-enter'}`}
          style={{ minHeight: '100dvh' }}
          onClick={handleBackdropClick}
        >
          {/* Dynamic ambient background */}
          <DynamicBackground state={orbState} />

          {/* Close button */}
          <button
            onClick={handleCloseModal}
            className="absolute top-4 right-4 z-20 p-3 rounded-full hover:bg-white/10 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', top: 'calc(1rem + var(--safe-area-inset-top, 0px))' }}
          >
            <X className="w-6 h-6 text-zinc-400" />
          </button>

          {/* Hero section — centered orb with effects */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Floating particles — behind orb */}
            <FloatingParticles state={orbState} />


            {/* Hero Orb */}
            <VoiceOrb
              state={orbState}
              active={isRecording || isProcessing}
              onClick={() => {}} // No-op — VAD controls recording
              disabled={!isConnected}
              size="lg"
            />
          </div>

          {/* Conversation overlays */}
          <ConversationOverlay
            transcript={transcript}
            response={response}
            actions={recentActions}
            error={error}
          />

          {/* Status text + retry — bottom */}
          <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-12 z-10"
               style={{ paddingBottom: 'calc(3rem + var(--safe-area-inset-bottom, 0px))' }}>
            <p
              className="text-sm font-medium transition-colors duration-500"
              style={{
                color: (isSpeechDetected || isRecording) ? '#d4a054' : '#71717a',
              }}
            >
              {statusText}
            </p>
            {!isConnected && (
              <button
                onClick={connect}
                className="mt-2 text-sm transition-colors"
                style={{ color: '#d4a054' }}
              >
                Retry connection
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
