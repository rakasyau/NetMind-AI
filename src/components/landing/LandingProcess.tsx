export default function LandingProcess() {
  const steps = [
    {
      num: '01',
      title: 'Describe Requirements',
      desc: 'Input requirements naturally, like "A campus network with 3 VLANs, 200 student PCs, and a Mikrotik edge gateway NAT translation to internet."'
    },
    {
      num: '02',
      title: 'AI Topology Synthesis',
      desc: 'The reasoning model computes nodes, connects connections, divides IP scopes, and compiles deployment commands in seconds.'
    },
    {
      num: '03',
      title: 'Refine & Deploy',
      desc: 'Drag devices to customize locations on canvas, verify connectivity rules, and copy scripts to run on active routers.'
    }
  ];

  return (
    <section id="process" className="py-24 px-6 lg:px-16 max-w-7xl mx-auto select-none">
      <div className="text-center max-w-3xl mx-auto mb-20">
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4 text-white uppercase font-mono tracking-wide">
          Designed for Network Operators
        </h2>
        <p className="text-slate-400 text-sm font-medium">
          From architecture specification to verified configs in three rapid stages.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 relative">
        <div className="hidden lg:block absolute top-12 left-[15%] right-[15%] h-[1px] border-t border-dashed border-white/10 z-0" />
        
        {steps.map((step, idx) => (
          <div key={idx} className="flex flex-col items-start gap-4 bg-[#0a0f1e]/45 border border-white/5 p-8 rounded-2xl relative z-10 shadow-sm">
            <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] opacity-35 select-none font-mono">
              {step.num}
            </div>
            <h3 className="text-lg font-bold text-white mt-1 font-mono uppercase tracking-wide">{step.title}</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">{step.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
