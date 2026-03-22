import AppSidebar from '@/components/cloudforge/AppSidebar';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--lp-bg)' }}>
      <AppSidebar />
      <main style={{ flex: 1, overflow: 'hidden' }}>{children}</main>
    </div>
  );
}
