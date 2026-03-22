import LandingNav from '@/components/landing/LandingNav';
import Hero from '@/components/landing/Hero';
import SocialProof from '@/components/landing/SocialProof';
import ProblemSection from '@/components/landing/ProblemSection';
import HowItWorks from '@/components/landing/HowItWorks';
import GraphEngine from '@/components/landing/GraphEngine';
import GeneratedOutput from '@/components/landing/GeneratedOutput';
import Features from '@/components/landing/Features';
import CTA from '@/components/landing/CTA';

export const metadata = {
  title: 'CloudForge — Your PRD. Your GitHub. Your AWS. Deployed.',
  description:
    'Upload your requirements. An AI agent refines them. A graph engine validates your architecture. Your scaffold commits to GitHub. Your AWS goes live.',
};

export default function LandingPage() {
  return (
    <main style={{ background: 'var(--lp-bg)', minHeight: '100vh' }}>
      <LandingNav />
      <div style={{ paddingTop: '60px' }}>
        <Hero />
        <SocialProof />
        <ProblemSection />
        <div id="how-it-works">
          <HowItWorks />
        </div>
        <GraphEngine />
        <GeneratedOutput />
        <div id="features">
          <Features />
        </div>
        <CTA />
      </div>
    </main>
  );
}
