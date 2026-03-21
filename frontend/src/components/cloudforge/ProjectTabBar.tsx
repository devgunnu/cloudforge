'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import TabBar from '@/components/cloudforge/TabBar';
import { useProjectStore, STAGE_ORDER } from '@/store/projectStore';

const TAB_LABELS: Record<string, string> = {
  prd: 'PRD',
  arch: 'NFR + Arch',
  build: 'Build',
  live: 'Live',
};

export default function ProjectTabBar() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const pathname = usePathname();
  const router = useRouter();
  const { projects } = useProjectStore();

  const project = projects.find((p) => p.id === id);
  if (!project) return null;

  // Derive current route stage from pathname: /project/[id]/prd → 'prd'
  const segments = pathname.split('/');
  const currentRoute = segments[segments.length - 1] as string;

  const projectStageIndex = STAGE_ORDER.indexOf(project.stage);

  const tabs = STAGE_ORDER.map((stage, i) => {
    let state: 'done' | 'active' | 'locked';
    if (stage === currentRoute) {
      state = 'active';
    } else if (i <= projectStageIndex && stage !== currentRoute) {
      state = 'done';
    } else {
      state = 'locked';
    }
    return { id: stage, label: TAB_LABELS[stage] ?? stage, state };
  });

  function handleTabClick(tabId: string) {
    router.push(`/project/${id}/${tabId}`);
  }

  return <TabBar tabs={tabs} onTabClick={handleTabClick} />;
}
