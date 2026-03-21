import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Features from '@/components/Features';
import TechStack from '@/components/TechStack';
import CTA from '@/components/CTA';

export default function LandingPage() {
  return (
    <main style={{ background: 'var(--cf-bg-base)', minHeight: '100vh' }}>
      <Hero />
      <HowItWorks />
      <Features />
      <TechStack />
      <CTA />
    </main>
  );
}
