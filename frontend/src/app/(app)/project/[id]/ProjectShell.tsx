'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import ProjectTabBar from '@/components/cloudforge/ProjectTabBar';
import { useProjectStore, STAGE_ORDER } from '@/store/projectStore';
import { useForgeStore } from '@/store/forgeStore';
import { authHeaders } from '@/lib/forge-agents';
import type { ProjectStage } from '@/store/projectStore';
import type { Project } from '@/lib/mock-data';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function ProjectShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const pathname = usePathname();
  const router = useRouter();
  const { projects, apiProjects } = useProjectStore();
  const { setCurrentProjectId, hydrateProject } = useForgeStore();

  // Local fetched project fallback for hard reloads when store is empty
  const [fetchedProject, setFetchedProject] = useState<Project | null>(null);
  const hydratedRef = useRef(false);

  const segments = pathname.split('/');
  const currentRoute = segments[segments.length - 1];

  const project = projects.find((p) => p.id === id) ?? fetchedProject;

  // Direction tracking: ref mutation is deferred to useEffect, never during render
  const prevIndexRef = useRef<number | null>(null);
  const currentIndex = STAGE_ORDER.indexOf(currentRoute as ProjectStage);
  const previousIndex = prevIndexRef.current;
  const direction =
    currentIndex === -1 || previousIndex === null || currentIndex >= previousIndex ? 1 : -1;

  useEffect(() => {
    if (currentIndex !== -1) {
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex]);

  // On mount: fetch project from API if not in store (hard reload case), then hydrate forge state
  useEffect(() => {
    if (!id) return;

    setCurrentProjectId(id);

    const headers = authHeaders();
    if (!headers.Authorization) return;

    // Fetch the project if not already in store
    if (!projects.find((p) => p.id === id) && !apiProjects.find((p) => p.id === id)) {
      fetch(`${API_URL}/projects/${id}`, { headers })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (!data) return;
          const now = Date.now();
          const diffMs = now - new Date(data.updated_at).getTime();
          const diffMin = Math.floor(diffMs / 60000);
          const diffHr = Math.floor(diffMs / 3600000);
          const updatedAt =
            diffMin < 60 ? `${diffMin}m ago` :
            diffHr < 24 ? `${diffHr}h ago` :
            new Date(data.updated_at).toLocaleDateString();
          setFetchedProject({
            id: data.id,
            name: data.name,
            description: data.description ?? '',
            stage: data.stage,
            status: data.status,
            region: data.region ?? 'us-east-1',
            updatedAt,
          });
        })
        .catch(() => {});
    }

    // Hydrate forge state once per mount
    if (!hydratedRef.current) {
      hydratedRef.current = true;
      hydrateProject(id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Guard: redirect if project confirmed missing
  useEffect(() => {
    if (project) {
      const routeIndex = STAGE_ORDER.indexOf(currentRoute as ProjectStage);
      if (routeIndex !== -1 && routeIndex > STAGE_ORDER.indexOf(project.stage)) {
        router.replace(`/project/${id}/${project.stage}`);
      }
    }
  }, [project, currentRoute, id, router]);

  // While loading, show nothing to avoid flash
  if (!project) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ProjectTabBar />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <AnimatePresence mode="sync" initial={false}>
          <motion.div
            key={pathname}
            initial={{ opacity: 0, x: direction * 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: direction * -24 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
