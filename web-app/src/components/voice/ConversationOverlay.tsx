import { useState, useEffect, useRef } from 'react';
import { Check, X, Info } from 'lucide-react';
import type { VoiceAction } from '../../hooks/useVoiceAssistant';

interface ConversationOverlayProps {
  transcript: string | null;
  response: string | null;
  actions: VoiceAction[];
  error: string | null;
}

function useFadingText(text: string, timeout: number) {
  const [visible, setVisible] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (text) {
      setDisplayText(text);
      setVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setVisible(false), timeout);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, timeout]);

  return { visible, displayText };
}

export function ConversationOverlay({ transcript, response, actions, error }: ConversationOverlayProps) {
  const { visible: showTranscript, displayText: transcriptText } = useFadingText(transcript ?? '', 8000);
  const { visible: showResponse, displayText: responseText } = useFadingText(response ?? '', 10000);
  const [showActions, setShowActions] = useState(false);
  const actionsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (actions.length > 0) {
      setShowActions(true);
      if (actionsTimerRef.current) clearTimeout(actionsTimerRef.current);
      actionsTimerRef.current = setTimeout(() => setShowActions(false), 10000);
    }
    return () => {
      if (actionsTimerRef.current) clearTimeout(actionsTimerRef.current);
    };
  }, [actions]);

  const showInfoNote = showResponse && actions.length === 0 && response;

  return (
    <div className="fixed inset-0 flex flex-col items-center pointer-events-none z-10">
      {/* Transcript — above orb area */}
      <div className="absolute top-[20%] w-full flex justify-center px-4">
        <div
          className={`rounded-2xl px-5 py-3 max-w-[400px] w-[90vw] text-center transition-all duration-500 ${
            showTranscript ? 'animate-float-in-up' : 'animate-float-out'
          }`}
          style={{
            opacity: showTranscript || transcriptText ? undefined : 0,
            visibility: transcriptText ? 'visible' : 'hidden',
            background: 'linear-gradient(135deg, rgba(30,30,35,0.82) 0%, rgba(20,20,24,0.78) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <p className="text-sm text-zinc-200">{transcriptText}</p>
        </div>
      </div>

      {/* Response — below orb area */}
      <div className="absolute top-[68%] w-full flex flex-col items-center gap-3 px-4">
        <div
          className={`rounded-2xl px-5 py-3 max-w-[400px] w-[90vw] text-center transition-all duration-500 ${
            showResponse ? 'animate-float-in-up' : 'animate-float-out'
          }`}
          style={{
            opacity: showResponse || responseText ? undefined : 0,
            visibility: responseText ? 'visible' : 'hidden',
            background: 'linear-gradient(135deg, rgba(30,30,35,0.85) 0%, rgba(255,221,15,0.08) 50%, rgba(20,20,24,0.80) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            animationDelay: '0.2s',
          }}
        >
          <p className="text-sm text-zinc-200">{responseText}</p>
        </div>

        {/* Actions */}
        {showActions && actions.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 max-w-[400px]">
            {actions.map((action, i) => (
              <div
                key={i}
                className="glass-pill rounded-full px-3 py-1.5 flex items-center gap-1.5 animate-float-in-up"
                style={{ animationDelay: `${0.3 + i * 0.1}s` }}
              >
                {action.success ? (
                  <Check className="w-3 h-3 text-amber-400" strokeWidth={2.5} />
                ) : (
                  <X className="w-3 h-3 text-red-400" strokeWidth={2.5} />
                )}
                <span className={`text-xs ${action.success ? 'text-amber-300' : 'text-red-300'}`}>
                  {action.device}: {action.action}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Info note */}
        {showInfoNote && (
          <div className="flex items-center gap-1.5 text-xs text-amber-400/70 animate-float-in-up" style={{ animationDelay: '0.4s' }}>
            <Info className="w-3.5 h-3.5" />
            <span>Information only</span>
          </div>
        )}
      </div>

      {/* Error overlay */}
      {error && (
        <div className="absolute top-[75%] w-full flex justify-center px-4">
          <div
            className="rounded-2xl px-5 py-3 max-w-[400px] w-[90vw] text-center animate-float-in-up"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(255,255,255,0.04) 100%)',
              border: '1px solid rgba(239,68,68,0.3)',
              backdropFilter: 'blur(16px)',
            }}
          >
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
