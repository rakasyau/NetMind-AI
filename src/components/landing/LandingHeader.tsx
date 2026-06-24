import { Network } from 'lucide-react';

interface LandingHeaderProps {
  onNavigate: (view: string) => void;
  onStartFree: () => void;
}

export default function LandingHeader({ onNavigate, onStartFree }: LandingHeaderProps) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#070b16]/75 border-b border-white/5 px-6 lg:px-16 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => onNavigate('landing')}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#00D4FF] to-[#00FFC6] p-[1.5px] flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.2)]">
          <div className="w-full h-full bg-[#070b16] rounded-[9px] flex items-center justify-center">
            <Network className="w-5 h-5 text-[#00D4FF]" />
          </div>
        </div>
        <span className="text-lg font-black tracking-wider uppercase font-mono">
          NETMIND <span className="text-[#00D4FF]">AI</span>
        </span>
      </div>

      <nav className="hidden md:flex items-center gap-8 text-xs font-bold uppercase tracking-wider text-slate-400">
        <a href="#features" className="hover:text-white transition-colors">Features</a>
        <a href="#process" className="hover:text-white transition-colors">Pipeline</a>
        <button onClick={() => onNavigate('dashboard')} className="hover:text-white transition-colors text-left uppercase font-bold tracking-wider cursor-pointer bg-transparent border-none">Dashboard</button>
      </nav>

      <div className="flex items-center gap-4">
        <button 
          onClick={() => onNavigate('login')}
          className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-white transition-colors hidden sm:block cursor-pointer bg-transparent border-none"
        >
          Log In
        </button>
        <button 
          onClick={onStartFree}
          className="px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] text-[#0A0F1E] hover:shadow-[0_0_25px_rgba(0,212,255,0.4)] transition-all transform active:scale-95 cursor-pointer shadow-md border-none"
        >
          Start Free
        </button>
      </div>
    </header>
  );
}
