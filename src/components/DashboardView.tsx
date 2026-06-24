import { useState } from 'react';
import { 
  Network, 
  Activity, 
  Database, 
  Plus, 
  Trash2, 
  Clock, 
  Copy, 
  ExternalLink,
  Search,
  Sparkles,
  Layers
} from 'lucide-react';
import { Project } from '../types';

interface DashboardViewProps {
  projects: Project[];
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
  onDuplicateProject: (id: string) => void;
  onDeleteProject: (id: string) => void;
}

export default function DashboardView({
  projects,
  onSelectProject,
  onNewProject,
  onDuplicateProject,
  onDeleteProject
}: DashboardViewProps) {
  const [search, setSearch] = useState<string>('');

  // Stats calculation
  const totalProjects = projects.length;
  const totalDevices = projects.reduce((acc, p) => acc + (p.topology?.devices?.length || 0), 0);
  const totalConnections = projects.reduce((acc, p) => acc + (p.topology?.connections?.length || 0), 0);
  const totalSubnets = projects.reduce((acc, p) => acc + (p.ipPlan?.length || 0), 0);

  const filteredProjects = projects.filter((p) => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  // Generate real timeline events from project data
  const timelineEvents = projects
    .map((p) => {
      const events: { date: string; sortTime: number; label: string; description: string; color: string }[] = [];
      
      const updatedDate = new Date(p.updatedAt);
      const createdDate = new Date(p.createdAt);
      const timeStr = updatedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateStr = updatedDate.toLocaleDateString();
      
      if (p.topology?.devices?.length) {
        events.push({
          date: `${dateStr} ${timeStr}`,
          sortTime: updatedDate.getTime(),
          label: 'TOPOLOGY UPDATED',
          description: `${p.name}: ${p.topology.devices.length} devices, ${p.topology.connections?.length || 0} connections configured.`,
          color: 'emerald'
        });
      }
      if (p.ipPlan?.length) {
        events.push({
          date: `${dateStr} ${timeStr}`,
          sortTime: updatedDate.getTime() - 1000,
          label: 'IP PLAN COMPILED',
          description: `${p.name}: ${p.ipPlan.length} subnets calculated with VLSM allocation.`,
          color: 'sky'
        });
      }
      if (createdDate.getTime() !== updatedDate.getTime()) {
        events.push({
          date: `${createdDate.toLocaleDateString()} ${createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          sortTime: createdDate.getTime(),
          label: 'PROJECT CREATED',
          description: `${p.name} initialized.`,
          color: 'purple'
        });
      }
      return events;
    })
    .flat()
    .sort((a, b) => b.sortTime - a.sortTime)
    .slice(0, 5);

  // Delete with confirmation
  const handleDeleteWithConfirm = (id: string, name: string) => {
    if (window.confirm(`Yakin ingin menghapus project "${name}"? Tindakan ini tidak bisa dibatalkan.`)) {
      onDeleteProject(id);
    }
  };

  return (
    <div id="dashboard-view-root" className="space-y-6 select-none font-sans">
      
      {/* Welcome Banner */}
      <div className="glass-panel rounded-2xl p-6 sm:p-8 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-white/5 glow-primary">
        <div className="absolute top-0 right-0 w-[400px] h-full bg-[#00D4FF]/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-[200px] h-[50px] bg-[#00FFC6]/5 rounded-full blur-[50px] pointer-events-none" />
        <div>
          <div className="flex items-center gap-2 text-[#00FFC6] text-[9px] font-bold uppercase tracking-widest mb-2 font-mono">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>AI Simulation Orchestrator Active</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight text-gradient-cyan">
            NetMind Operations Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium max-w-xl leading-relaxed">
            Synthesize network topologies, calculate variable-length subnets, and export validated micro-configs on demand.
          </p>
        </div>
        <button
          onClick={onNewProject}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] text-[#0a0f1e] hover:shadow-[0_0_25px_rgba(0,212,255,0.4)] font-black text-[10px] uppercase tracking-wider flex items-center gap-2 transform active:scale-95 transition-all cursor-pointer shadow-md shrink-0 font-sans"
        >
          <Plus className="w-4 h-4 text-[#0a0f1e]" />
          Create Infrastructure
        </button>
      </div>

      {/* Grid Widgets Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-2xl relative group overflow-hidden border-white/5 flex items-center justify-between">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-[#00D4FF]/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#070b16] border border-white/5 flex items-center justify-center text-[#00D4FF] shadow-sm">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Active projects</div>
              <div className="text-xl font-black text-white mt-0.5 tracking-tight">{totalProjects}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl relative group overflow-hidden border-white/5 flex items-center justify-between">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-[#00FFC6]/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#070b16] border border-white/5 flex items-center justify-center text-[#00FFC6] shadow-sm">
              <Network className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Topology Nodes</div>
              <div className="text-xl font-black text-white mt-0.5 tracking-tight">{totalDevices}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl relative group overflow-hidden border-white/5 flex items-center justify-between">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-purple-500/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#070b16] border border-white/5 flex items-center justify-center text-purple-400 shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Links Connected</div>
              <div className="text-xl font-black text-white mt-0.5 tracking-tight">{totalConnections}</div>
            </div>
          </div>
        </div>

        <div className="glass-panel p-4 rounded-2xl relative group overflow-hidden border-white/5 flex items-center justify-between">
          <div className="absolute -top-6 -right-6 w-16 h-16 bg-indigo-500/5 rounded-full group-hover:scale-150 transition-transform duration-500" />
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#070b16] border border-white/5 flex items-center justify-center text-indigo-400 shadow-sm">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider font-mono">Subnets Planned</div>
              <div className="text-xl font-black text-white mt-0.5 tracking-tight">{totalSubnets}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Projects Matrix vs Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Side: Projects Registry Table */}
        <div className="lg:col-span-8 glass-panel p-5 sm:p-6 rounded-2xl border-white/5 flex flex-col justify-between min-h-[380px]">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-white/5">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Registry Topologies</h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">Edit, duplicate, and configure saved deployments.</p>
              </div>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter topologies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#070b16]/90 border border-white/5 hover:border-[#00D4FF]/30 focus:border-[#00D4FF]/50 rounded-xl pl-9 pr-3.5 py-2 text-[10px] text-white focus:outline-none placeholder-slate-600 transition-all font-medium shadow-inner"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] text-slate-300">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 uppercase tracking-wider text-[8.5px] font-bold font-mono">
                    <th className="pb-3 pl-2">Topology Name</th>
                    <th className="pb-3">Scale Matrix</th>
                    <th className="pb-3">Subnets</th>
                    <th className="pb-3">Last Compiled</th>
                    <th className="pb-3 text-right pr-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500 italic font-mono text-[10px]">
                        No topologies found. Create your first network map!
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => {
                      const nodes = p.topology?.devices?.length || 0;
                      const links = p.topology?.connections?.length || 0;
                      const subnets = p.ipPlan?.length || 0;
                      return (
                        <tr key={p.id} className="hover:bg-white/5 transition-all group">
                          <td className="py-3 pl-2 font-medium text-white max-w-[200px] truncate">
                            <div className="cursor-pointer" onClick={() => onSelectProject(p.id)}>
                              <div className="text-[11.5px] font-bold text-white group-hover:text-[#00D4FF] transition-colors">{p.name}</div>
                              <div className="text-[9.5px] text-slate-500 truncate mt-0.5 font-sans font-medium">{p.description}</div>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-[9px] text-slate-400">
                            <span className="text-white font-bold">{nodes}</span> Nodes / <span className="text-[#00FFC6] font-bold">{links}</span> Links
                          </td>
                          <td className="py-3">
                            <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[9px] font-mono border border-blue-500/20 font-bold uppercase tracking-wider">
                              {subnets} Subnets
                            </span>
                          </td>
                          <td className="py-3 text-[9px] text-slate-500 font-mono">
                            {new Date(p.updatedAt).toLocaleDateString()} {new Date(p.updatedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </td>
                          <td className="py-3 text-right pr-2">
                            <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => onSelectProject(p.id)}
                                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-[#00D4FF] hover:border-[#00D4FF]/30 hover:bg-[#00D4FF]/5 transition-all cursor-pointer"
                                title="Open Workspace"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => onDuplicateProject(p.id)}
                                className="p-1.5 rounded-lg border border-white/5 bg-white/5 text-slate-400 hover:text-[#00FFC6] hover:border-[#00FFC6]/30 hover:bg-[#00FFC6]/5 transition-all cursor-pointer"
                                title="Duplicate Project"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteWithConfirm(p.id, p.name)}
                                className="p-1.5 rounded-lg border border-red-500/10 bg-red-500/5 text-red-500 hover:text-red-400 hover:border-red-500/35 hover:bg-red-500/10 transition-all cursor-pointer"
                                title="Delete Project"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
 
        {/* Right Side: Real Activity Feed */}
        <div className="lg:col-span-4 glass-panel p-5 sm:p-6 rounded-2xl border-white/5">
          <div className="flex items-center gap-2.5 mb-5 pb-3.5 border-b border-white/5">
            <Clock className="w-4 h-4 text-[#00FFC6]" />
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Project Activity</h3>
          </div>

          <div className="space-y-4 font-mono text-[9px] text-slate-400">
            {timelineEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-10">
                <Clock className="w-8 h-8 text-slate-700 mb-2" />
                <p className="text-[10px] text-slate-500 font-medium font-sans">No project activity yet. Create your first project to see events here.</p>
              </div>
            ) : (
              timelineEvents.map((event, idx) => {
                const colorMap: Record<string, { dot: string; text: string }> = {
                  emerald: { dot: 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.3)]', text: 'text-[#00FFC6]' },
                  sky: { dot: 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.3)]', text: 'text-[#00D4FF]' },
                  purple: { dot: 'bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.3)]', text: 'text-purple-400' },
                  amber: { dot: 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]', text: 'text-amber-400' },
                };
                const colors = colorMap[event.color] || colorMap.sky;
                return (
                  <div key={idx} className={`relative pl-5 border-l border-white/5 ${idx < timelineEvents.length - 1 ? 'pb-2' : ''}`}>
                    <span className={`absolute -left-[3.5px] top-1 w-1.5 h-1.5 rounded-full border-2 border-[#0A0F1E] ${colors.dot} ${idx === 0 ? 'animate-pulse' : ''}`} />
                    <div className={`${colors.text} font-bold`}>{event.date} - {event.label}</div>
                    <p className="mt-1 text-slate-400 leading-normal font-sans text-[10.5px] font-medium">{event.description}</p>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
