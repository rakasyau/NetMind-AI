import LandingHeader from './landing/LandingHeader';
import LandingHero from './landing/LandingHero';
import LandingFeatures from './landing/LandingFeatures';
import LandingProcess from './landing/LandingProcess';
import LandingFooter from './landing/LandingFooter';

interface LandingPageProps {
  onStartFree: () => void;
  onNavigate: (view: string) => void;
}

export default function LandingPage({ onStartFree, onNavigate }: LandingPageProps) {
  return (
    <div id="landing-page-root" className="min-h-screen bg-[#070b16] text-white font-sans overflow-x-hidden select-none selection:bg-[#00D4FF] selection:text-[#0A0F1E] relative">
      
      {/* Ambient Glow Effects */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-[#00D4FF]/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-[40%] right-1/4 w-[700px] h-[700px] bg-[#00FFC6]/5 rounded-full blur-[160px] pointer-events-none" />
      
      {/* Tech Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#121a2e_1px,transparent_1px),linear-gradient(to_bottom,#121a2e_1px,transparent_1px)] bg-[size:32px_32px] opacity-15 pointer-events-none" />

      {/* Composed Sub-components */}
      <LandingHeader onNavigate={onNavigate} onStartFree={onStartFree} />
      <LandingHero onStartFree={onStartFree} />
      <LandingFeatures />
      <LandingProcess />
      <LandingFooter />

    </div>
  );
}
