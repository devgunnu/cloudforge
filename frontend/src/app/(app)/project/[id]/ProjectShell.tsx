'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import ProjectTabBar from '@/components/cloudforge/ProjectTabBar';
import { useProjectStore, STAGE_ORDER } from '@/store/projectStore';
import type { ProjectStage } from '@/store/projectStore';

export default function ProjectShell({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const pathname = usePathname();
  const router = useRouter();
  const { projects } = useProjectStore();

  const segments = pathname.split('/');
  const currentRoute = segments[segments.length - 1];

  const project = projects.find((p) => p.id === id);

  // Direction tracking: 1 = forward (slide from right), -1 = backward
  const stageIndexRef = useRef<number>(STAGE_ORDER.indexOf(currentRoute as ProjectStage));
  const [direction, setDirection] = useState(1);

  // Guard: redirect if project missing or route is locked
  useEffect(() => {
    if (!project) {
      router.replace('/dashboard');
      return;
    }
    const routeIndex = STAGE_ORDER.indexOf(currentRoute as ProjectStage);
    if (routeIndex !== -1 && routeIndex > STAGE_ORDER.indexOf(project.stage)) {
      router.replace(`/project/${id}/${project.stage}`);
    }
  }, [project, currentRoute, id, router]);

  // Direction tracking
  useEffect(() => {
    const newIndex = STAGE_ORDER.indexOf(currentRoute as ProjectStage);
    if (newIndex !== -1) {
      setDirection(newIndex >= stageIndexRef.current ? 1 : -1);
      stageIndexRef.current = newIndex;
    }
  }, [currentRoute]);

  // While guard is pending (project not found yet), show nothing to avoid flash
  if (!project) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <ProjectTabBar />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
