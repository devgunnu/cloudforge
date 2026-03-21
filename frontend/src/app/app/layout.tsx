import ForgeTopNav from '@/components/forge/ForgeTopNav';
import ForgeChatPanel from '@/components/forge/ForgeChatPanel';
import ForgeDeployModal from '@/components/forge/ForgeDeployModal';

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--lp-bg)',
        overflow: 'hidden',
      }}
    >
      {/* Persistent top nav — never unmounts */}
      <ForgeTopNav />

      {/* Body: chat panel + main content */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Persistent chat panel — never unmounts across route changes */}
        <ForgeChatPanel />

        {/* Right panel — swapped per route */}
        <main
          style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
          id="forge-main"
        >
          {children}
        </main>
      </div>

      {/* Deploy confirmation modal — rendered at root so it overlays everything */}
      <ForgeDeployModal />
    </div>
  );
}
