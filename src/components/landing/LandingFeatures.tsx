import { motion } from 'motion/react';
import { Network, Cpu, Layers, Terminal, ShieldAlert, Server } from 'lucide-react';

export default function LandingFeatures() {
  const features = [
    {
      icon: Cpu,
      title: 'AI Network Modeling',
      description: 'Describe requirements in plain Indonesian or English. Copilot designs the entire device connections mesh instantly.'
    },
    {
      icon: Network,
      title: 'Visual Topology Editor',
      description: 'Drag nodes (routers, switches, database servers, IoT boards) and draw wire links dynamically on a vector grid.'
    },
    {
      icon: Layers,
      title: 'VLSM Subnet Planner',
      description: 'Automate subnet masking, IP allocations, gateway addresses, and DHCP scopes with rigorous CIDR boundaries.'
    },
    {
      icon: Terminal,
      title: 'Multi-Vendor Scripts',
      description: 'Download running configure scripts directly copy-pasteable to Mikrotik RouterOS CLI, Cisco iOS Switch, or Debian servers.'
    },
    {
      icon: ShieldAlert,
      title: 'Intelligent Troubleshooter',
      description: 'Submit an outage description (e.g. "DHCP packet dropped") and get live traceroute debug analyses and fixes.'
    },
    {
      icon: Server,
      title: 'Project Blueprints',
      description: 'Save, clone, and version-control designs. Import prebuilt reference templates for datacenter or campus rings.'
    }
  ];

  return (
    <section id="features" className="py-24 border-t border-white/5 bg-[#070b16]/40 relative px-6 lg:px-16 select-none">
      <div className="max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white uppercase font-mono tracking-wide">
            No guesswork. Zero config errors.
          </h2>
          <p className="text-slate-400 text-sm font-medium">
            NetMind AI streamlines everything from visual diagrams to valid terminal configurations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.04 }}
              className="p-8 rounded-2xl bg-[#0a0f1e]/40 border border-white/5 hover:border-[#00D4FF]/30 hover:bg-[#121A2E]/20 transition-all flex flex-col gap-4 group cursor-pointer shadow-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-[#070b16] border border-white/5 flex items-center justify-center text-[#00D4FF] group-hover:scale-105 transition-transform duration-300">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mt-2 font-mono uppercase tracking-wide">{feature.title}</h3>
              <p className="text-slate-400 text-xs leading-relaxed font-medium">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
