import { Network } from 'lucide-react';

export default function LandingFooter() {
  return (
    <footer className="border-t border-white/5 py-16 px-6 lg:px-16 text-xs text-slate-500 relative select-none">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 font-medium">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#00D4FF] to-[#00FFC6] flex items-center justify-center">
            <Network className="w-4 h-4 text-[#0A0F1E]" />
          </div>
          <span className="font-extrabold text-white tracking-widest uppercase font-mono">NETMIND AI</span>
        </div>
        <div className="flex flex-wrap justify-center gap-6 md:gap-8 font-mono tracking-wide">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#process" className="hover:text-white transition-colors">Process</a>
          <span>© 2026 NetMind Corp. All Rights Reserved.</span>
        </div>
      </div>
    </footer>
  );
}
