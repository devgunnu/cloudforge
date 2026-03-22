'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import ForgeTopNav from '@/components/forge/ForgeTopNav';
import ForgeChatPanel from '@/components/forge/ForgeChatPanel';
import ForgeDeployModal from '@/components/forge/ForgeDeployModal';
import { useForgeStore, type ForgeStage } from '@/store/forgeStore';

const PATHNAME_TO_STAGE: Record<string, ForgeStage> = {
  requirements: 'requirements',
  architecture: 'architecture',
  build: 'build',
  deploy: 'deploy',
};

export default function ForgeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { stageStatus, setStageStatus } = useForgeStore();

  useEffect(() => {
    // Extract the last segment of the path, e.g. '/app/build' → 'build'
    const segment = pathname.split('/').filter(Boolean).pop() ?? '';
    const stage = PATHNAME_TO_STAGE[segment];
    if (!stage) return;

    // Sync activeStage to the store — bypass the lock check used in navigateToStage
    // by setting it directly so dev-mode direct nav always works.
    useForgeStore.setState({ activeStage: stage });

    // Unlock the stage for dev testing if it is currently locked (dev only)
    if (process.env.NODE_ENV === 'development' && stageStatus[stage] === 'locked') {
      setStageStatus(stage, 'processing');
    }
  }, [pathname, stageStatus, setStageStatus]);

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
