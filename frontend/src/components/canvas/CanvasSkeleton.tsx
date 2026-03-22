'use client';

export default function CanvasSkeleton() {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--cf-bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono), monospace',
          fontSize: '13px',
          color: 'var(--cf-text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: 'var(--cf-green)',
            display: 'inline-block',
            animation: 'blink 1s step-end infinite',
          }}
        />
        initializing canvas...
      </div>
    </div>
  );
}
