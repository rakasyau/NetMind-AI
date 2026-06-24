import { motion } from 'motion/react';
import { Sparkles, ArrowRight, Play, Globe, Cpu, Server } from 'lucide-react';

interface LandingHeroProps {
  onStartFree: () => void;
}

export default function LandingHero({ onStartFree }: LandingHeroProps) {
  return (
    <section className="relative px-6 lg:px-16 pt-20 pb-28 max-w-7xl mx-auto flex flex-col items-center text-center select-none">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#121A2E]/60 border border-[#00D4FF]/25 text-[10px] font-bold uppercase tracking-widest text-[#00D4FF] mb-8 font-mono shadow-sm"
      >
        <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#00FFC6]" />
        <span>Next-Gen Network Synthesis Platform</span>
      </motion.div>

      <motion.h1 
        initial={{ opacity: 0, y: 25 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.05]"
      >
        Design Cloud-Scale <br className="hidden sm:inline" />
        Networks Using <span className="text-gradient-green">AI Reasoners</span>
      </motion.h1>

      <motion.p 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-sm sm:text-base text-slate-400 max-w-3xl mb-12 font-medium leading-relaxed font-sans"
      >
        Model production-ready campus rings and spine-leaf clusters, divide subnets automatically, and compile verified micro-config scripts instantly.
      </motion.p>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-col sm:flex-row items-center gap-4 justify-center mb-20 w-full sm:w-auto"
      >
        <button 
          onClick={onStartFree}
          className="w-full sm:w-auto px-8 py-4 rounded-xl text-xs font-black uppercase tracking-wider bg-[#00D4FF] text-[#0A0F1E] hover:shadow-[0_0_30px_rgba(0,212,255,0.45)] hover:bg-[#00FFC6] transition-all flex items-center justify-center gap-2.5 transform active:scale-95 cursor-pointer border-none"
        >
          Start Designing Free
          <ArrowRight className="w-4 h-4 text-[#0A0F1E]" />
        </button>
        <button 
          onClick={onStartFree}
          className="w-full sm:w-auto px-8 py-4 rounded-xl text-xs font-black uppercase tracking-wider bg-[#121A2E]/50 border border-white/5 text-white hover:bg-[#121A2E]/80 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 text-[#00FFC6] fill-current" />
          Watch Console Demo
        </button>
      </motion.div>

      {/* Demo Interface Preview Card */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4 }}
        className="w-full max-w-5xl rounded-2xl glass-panel p-4 shadow-[0_25px_50px_rgba(0,0,0,0.5)] relative border-white/5 bg-[#0a0f1e]/60"
      >
        <div className="flex items-center justify-between border-b border-[#070b16] pb-3 mb-4">
          <div className="flex gap-2 pl-2">
            <span className="w-3 h-3 rounded-full bg-red-500/80 shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80 shadow-sm" />
            <span className="w-3 h-3 rounded-full bg-green-500/80 shadow-sm" />
          </div>
          <div className="px-8 py-1 text-[9px] text-[#00D4FF] bg-[#070b16] rounded-lg font-mono flex items-center gap-2 border border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shadow-[0_0_6px_#4ade80]" />
            <span>netmind-copilot-daemon.sh</span>
          </div>
          <div className="w-12" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[350px] text-left text-[10px] text-slate-400 font-mono overflow-hidden">
          {/* Left AI chat simulation */}
          <div className="bg-[#070b16]/90 p-4 rounded-xl border border-white/5 flex flex-col justify-between h-full">
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-[#121A2E]/50 border-l-2 border-[#00D4FF] text-white font-sans text-xs">
                "Buat jaringan kantor 3 lantai dengan router Mikrotik, switch Cisco, dan 6 PC..."
              </div>
              <div className="text-[#00FFC6] animate-pulse flex items-center gap-1.5">
                <span className="w-1 h-1 bg-[#00FFC6] rounded-full" />
                <span>AI compiler active: calculating subnets...</span>
              </div>
              <div className="space-y-1.5 text-slate-300">
                <div className="text-white">✔ Subnetworks division via VLSM completed.</div>
                <div className="text-white">✔ Plotted 10 network device coordinates.</div>
                <div className="text-white">✔ Formatted RouterOS interface scripts.</div>
              </div>
            </div>
            <div className="border-t border-white/5 pt-3 text-white font-sans text-[10px] flex items-center gap-2 font-bold uppercase tracking-wider text-slate-400">
              <Sparkles className="w-4 h-4 text-[#00D4FF]" />
              <span>Rendered in 1.4 seconds</span>
            </div>
          </div>

          {/* Middle diagram simulation */}
          <div className="bg-[#070b16]/90 p-4 rounded-xl border border-white/5 relative flex flex-col items-center justify-center gap-3 overflow-hidden h-full">
            <div className="absolute top-3 left-3 text-[8px] font-bold text-slate-500 tracking-wider font-mono">VISUAL VECTOR CANVAS</div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#121a2e_1px,transparent_1px),linear-gradient(to_bottom,#121a2e_1px,transparent_1px)] bg-[size:16px_16px] opacity-20 pointer-events-none" />
            
            <div className="flex flex-col items-center z-10 scale-95">
              <div className="px-3 py-1.5 rounded-xl bg-[#121A2E] border border-[#00D4FF]/30 text-[#00D4FF] flex items-center gap-2 shadow-[0_0_12px_rgba(0,212,255,0.15)] font-bold text-[10px]">
                <Globe className="w-3.5 h-3.5" />
                <span>ISP_Gateway</span>
              </div>
              <div className="h-6 w-0.5 border-l border-dashed border-[#00D4FF]/40" />
              <div className="px-3 py-1.5 rounded-xl bg-[#121A2E] border border-emerald-400/30 text-[#00FFC6] flex items-center gap-2 font-bold text-[10px]">
                <Cpu className="w-3.5 h-3.5" />
                <span>Mikrotik_Router</span>
              </div>
              <div className="h-6 w-0.5 border-l border-dashed border-emerald-400/40" />
              <div className="px-3 py-1.5 rounded-xl bg-[#121A2E] border border-white/5 text-white flex items-center gap-2 font-bold text-[10px]">
                <Server className="w-3.5 h-3.5" />
                <span>Core_Switch</span>
              </div>
              <div className="flex gap-4 mt-4">
                <div className="px-2.5 py-1 rounded-lg bg-[#121A2E]/40 border border-white/5 text-slate-500 text-[9px] font-bold">Student_PC</div>
                <div className="px-2.5 py-1 rounded-lg bg-[#121A2E]/40 border border-white/5 text-slate-500 text-[9px] font-bold">Local_DNS</div>
              </div>
            </div>
          </div>

          {/* Right configuration simulation */}
          <div className="bg-[#070b16]/90 p-4 rounded-xl border border-white/5 flex flex-col justify-between h-full overflow-y-auto">
            <div>
              <div className="flex justify-between items-center mb-3">
                <span className="text-[#00FFC6] font-bold">ROUTEROS_CONFIG.RSC</span>
                <span className="text-[8px] font-bold text-slate-600 tracking-wider">CLI SCRIPT</span>
              </div>
              <pre className="text-[9px] text-slate-400 leading-relaxed font-mono select-all">
{`/interface vlan
add interface=ether2 name=vlan10 vlan-id=10
add interface=ether2 name=vlan20 vlan-id=20

/ip address
add address=192.168.10.1/24 interface=vlan10
add address=192.168.20.1/26 interface=vlan20

/ip pool
add name=pool10 ranges=192.168.10.10-250

/ip dhcp-server
add address-pool=pool10 interface=vlan10`}
              </pre>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
