interface DynamicBackgroundProps {
  state: 'idle' | 'listening';
}

export function DynamicBackground({ state: _state }: DynamicBackgroundProps) {
  return (
    <>
      {/* Solid base — ensures nothing bleeds through */}
      <div className="fixed inset-0 bg-[#0a0a0c]" />
      {/* Main gradient — single consistent warm tone */}
      <div
        className="fixed inset-0"
        style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(212,160,84,0.3) 0%, rgba(170,128,67,0.15) 40%, rgba(10,10,12,1) 100%)' }}
      />
      {/* Dot-grid mesh overlay */}
      <div
        className="fixed inset-0 opacity-40"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '30px 30px',
          animation: 'bg-mesh 60s linear infinite',
        }}
      />
    </>
  );
}
