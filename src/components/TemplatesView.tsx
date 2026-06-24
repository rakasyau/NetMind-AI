import { 
  Network, 
  Cpu, 
  Server, 
  Layers, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

interface TemplatesViewProps {
  onSelectTemplate: (templateId: string) => void;
}

const TEMPLATES = [
  {
    id: 'tpl_campus',
    title: 'Enterprise Main Campus',
    description: 'Perfect for schools or office branches. Employs 3 distinct subnetwork VLANs, redundant Debian DNS servers, a local DHCP manager, and NAT edge routing.',
    vlanCount: 3,
    devices: 10,
    connections: 9,
    difficulty: 'Intermediate',
    icon: Network,
    color: 'border-emerald-500/10 text-emerald-400'
  },
  {
    id: 'tpl_datacenter',
    title: 'Spine-Leaf Rack DMZ',
    description: 'High-performance Spine-Leaf model. Connects redundant core spines to access leaf ports hosting a secure Cisco ASA firewall, load balancers, and postgresql database servers.',
    vlanCount: 2,
    devices: 9,
    connections: 8,
    difficulty: 'Advanced',
    icon: Server,
    color: 'border-indigo-500/10 text-indigo-400'
  },
  {
    id: 'tpl_iot',
    title: 'Smart IoT Agricultural Farm',
    description: 'Low-latency sensor network. Links multiple wireless ESP32 edge triggers, moist recorders, and actuator valves back to a local Raspberry Pi gateway broker.',
    vlanCount: 1,
    devices: 7,
    connections: 6,
    difficulty: 'Beginner',
    icon: Cpu,
    color: 'border-pink-500/10 text-pink-400'
  },
  {
    id: 'tpl_bgp',
    title: 'ISP BGP Core Edge Ring',
    description: 'Carrier-grade routing. Dual-homed ISP WAN links with active BGP tables, interior OSPF backbone routers, and deep traffic shaper queues.',
    vlanCount: 4,
    devices: 8,
    connections: 9,
    difficulty: 'Expert',
    icon: Layers,
    color: 'border-amber-500/10 text-amber-400'
  }
];

export default function TemplatesView({ onSelectTemplate }: TemplatesViewProps) {
  return (
    <div id="templates-view-root" className="space-y-6 select-none font-sans">
      
      {/* Header Banner */}
      <div className="glass-panel p-6 rounded-2xl border-white/5 relative overflow-hidden bg-[#121A2E]/20">
        <div className="absolute top-0 right-0 w-[300px] h-full bg-[#00D4FF]/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="flex items-center gap-2 text-[#00D4FF] text-[9px] font-bold uppercase tracking-widest mb-2 font-mono">
          <Sparkles className="w-3.5 h-3.5 animate-pulse text-[#00FFC6]" />
          <span>Reference Architectures</span>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight text-gradient-cyan">Prebuilt Network Blueprints</h1>
        <p className="text-xs text-slate-400 mt-1 font-medium leading-relaxed max-w-xl">Deploy production-ready reference blueprints instantly to bootstrap simulator topologies and configuration generation.</p>
      </div>

      {/* Grid Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {TEMPLATES.map((tpl) => {
          const TplIcon = tpl.icon;
          return (
            <div 
              key={tpl.id}
              className={`p-5 rounded-2xl bg-[#0a0f1e]/40 border border-white/5 hover:border-[#00D4FF]/30 hover:bg-[#121A2E]/20 transition-all flex flex-col justify-between group shadow-sm glass-card-hover`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-xl bg-[#070b16] border border-white/5 flex items-center justify-center text-[#00D4FF] shadow-sm">
                    <TplIcon className="w-4.5 h-4.5" />
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[8px] font-bold font-mono uppercase tracking-wider ${
                    tpl.difficulty === 'Beginner' 
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10'
                      : tpl.difficulty === 'Intermediate'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                      : 'bg-red-500/10 text-red-400 border border-red-500/10'
                  }`}>
                    {tpl.difficulty}
                  </span>
                </div>

                <div>
                  <h3 className="text-[11.5px] font-extrabold text-white group-hover:text-[#00D4FF] transition-colors uppercase tracking-wider font-mono">{tpl.title}</h3>
                  <p className="text-[10.5px] text-slate-500 leading-relaxed mt-2 min-h-[44px] font-medium font-sans">{tpl.description}</p>
                </div>

                <div className="flex gap-4 font-mono text-[8.5px] font-bold text-slate-600 pt-3.5 border-t border-white/5 uppercase tracking-wide">
                  <span>VLANs: <span className="text-white">{tpl.vlanCount}</span></span>
                  <span>•</span>
                  <span>Nodes: <span className="text-white">{tpl.devices}</span></span>
                  <span>•</span>
                  <span>Links: <span className="text-[#00FFC6]">{tpl.connections}</span></span>
                </div>
              </div>

              <button
                onClick={() => onSelectTemplate(tpl.id)}
                className="w-full mt-5 py-2.5 bg-[#070b16] border border-white/5 group-hover:border-[#00D4FF]/30 text-slate-400 group-hover:text-white group-hover:bg-[#121A2E]/30 text-[10px] font-black uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 transition-all transform active:scale-95 cursor-pointer shadow-sm"
              >
                Instantiate Blueprint
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
