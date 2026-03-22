'use client';

import { useEffect, useRef } from 'react';
import { useParams, usePathname } from 'next/navigation';
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
  const params = useParams();
  const pathname = usePathname();
  const hydrated = useRef(false);

  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  // Hydrate project state once on mount
  useEffect(() => {
    if (hydrated.current || !id) return;
    hydrated.current = true;
    useForgeStore.getState().setCurrentProjectId(id);
    useForgeStore.getState().hydrateProject(id);
  }, [id]);

  // Sync activeStage to store based on pathname segment
  useEffect(() => {
    const segment = pathname.split('/').filter(Boolean).pop() ?? '';
    const stage = PATHNAME_TO_STAGE[segment];
    if (!stage) return;
    useForgeStore.setState({ activeStage: stage });
  }, [pathname]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
