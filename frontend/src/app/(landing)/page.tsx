import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import SocialProof from '@/components/landing/SocialProof';
import HowItWorks from '@/components/landing/HowItWorks';
import Features from '@/components/landing/Features';
import TerraformPreview from '@/components/landing/TerraformPreview';
import CTA from '@/components/landing/CTA';

export const metadata = {
  title: 'CloudForge — Deploy AWS infrastructure by drawing it',
  description:
    'Drag. Connect. Deploy. CloudForge turns your architecture diagram into real Terraform — powered by Claude AI.',
};

export default function LandingPage() {
  return (
    <main style={{ background: 'var(--lp-bg)', minHeight: '100vh' }}>
      <LandingNav />
      <div style={{ paddingTop: '52px' }}>
        <Hero />
        <SocialProof />
        <HowItWorks />
        <Features />
        <TerraformPreview />
        <CTA />
      </div>
    </main>
  );
}
