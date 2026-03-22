import AppSidebar from '@/components/cloudforge/AppSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--lp-bg)' }}>
      <AppSidebar />
      <main style={{ flex: 1, overflow: 'hidden', height: '100%' }}>{children}</main>
    </div>
  );
}
