import dynamic from 'next/dynamic';
import CanvasSkeleton from '@/components/canvas/CanvasSkeleton';

const CloudForgeApp = dynamic(
  () => import('@/components/canvas/CloudCanvas'),
  {
    ssr: false,
    loading: () => <CanvasSkeleton />,
  }
);

export default function Home() {
  return <CloudForgeApp />;
}
