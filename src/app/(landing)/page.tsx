import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import HowItWorks from '@/components/landing/HowItWorks';
import Features from '@/components/landing/Features';
import TechStack from '@/components/landing/TechStack';
import CTA from '@/components/landing/CTA';

export const metadata = {
  title: 'CloudForge — Deploy AWS infrastructure by drawing it',
  description:
    'Drag. Connect. Deploy. CloudForge turns your architecture diagram into real Terraform — powered by Claude AI.',
};

export default function LandingPage() {
  return (
    <main style={{ background: 'var(--cf-bg-base)', minHeight: '100vh' }}>
      <LandingNav />
      <div style={{ paddingTop: '52px' }}>
        <Hero />
        <HowItWorks />
        <Features />
        <TechStack />
        <CTA />
      </div>
    </main>
  );
}
