'use client';

import dynamic from 'next/dynamic';
import CanvasSkeleton from './CanvasSkeleton';

const CloudCanvas = dynamic(
  () => import('./CloudCanvas'),
  {
    ssr: false,
    loading: () => <CanvasSkeleton />,
  }
);

export default function CanvasClientWrapper() {
  return <CloudCanvas />;
}
