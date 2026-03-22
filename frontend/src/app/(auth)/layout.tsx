export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--lp-bg)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        // Subtle spotlight behind the form
        backgroundImage:
          'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(45,212,191,0.04) 0%, transparent 70%)',
      }}
    >
      {children}
    </div>
  );
}
