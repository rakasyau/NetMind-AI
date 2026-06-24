import { 
  Network, 
  Settings, 
  LogOut,
  Database,
  Sparkles,
  Layers,
  ShieldAlert,
  Server
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  userEmail?: string;
  onLogout: () => void;
}

export default function Sidebar({ currentView, onNavigate, userEmail = 'user@example.com', onLogout }: SidebarProps) {
  
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Database },
    { id: 'ai_generator', label: 'AI Generator', icon: Sparkles },
    { id: 'ip_planner', label: 'IP Planner', icon: Layers },
    { id: 'troubleshooter', label: 'Troubleshooter', icon: ShieldAlert },
    { id: 'templates', label: 'Blueprints', icon: Server },
    { id: 'settings', label: 'System Settings', icon: Settings },
  ];

  return (
    <div id="app-sidebar" className="w-56 bg-[#060913] border-r border-white/5 flex flex-col justify-between h-full select-none">
      
      {/* Brand Header */}
      <div>
        <div className="p-5 flex items-center gap-3 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => onNavigate('landing')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#00D4FF] to-[#00FFC6] flex items-center justify-center p-[1px] shadow-[0_0_15px_rgba(0,212,255,0.2)]">
            <div className="w-full h-full bg-[#060913] rounded-[10px] flex items-center justify-center">
              <Network className="w-4 h-4 text-[#00D4FF]" />
            </div>
          </div>
          <div>
            <span className="font-extrabold text-[11px] tracking-widest text-white uppercase font-mono block leading-none">
              NETMIND <span className="text-[#00D4FF]">AI</span>
            </span>
            <span className="text-[7.5px] text-slate-500 font-mono tracking-wider font-bold block mt-1 uppercase">
              Operations Hub
            </span>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3.5 space-y-1.5">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                  isActive 
                    ? 'bg-[#121A2E]/60 text-[#00D4FF] border border-[#00D4FF]/25 shadow-[0_0_15px_rgba(0,212,255,0.06)] pl-4' 
                    : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent pl-3.5'
                }`}
              >
                <IconComponent className={`w-4 h-4 transition-colors duration-300 ${isActive ? 'text-[#00D4FF]' : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* User profile footer bar */}
      <div className="p-4 border-t border-white/5 bg-[#121a2e]/10">
        <div className="flex items-center justify-between gap-3 bg-[#0a0f1e]/45 border border-white/5 p-2 rounded-2xl">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#00D4FF] to-[#00FFC6] p-[1.5px] flex items-center justify-center shrink-0 shadow-sm">
              <div className="w-full h-full bg-[#0A0F1E] rounded-[9px] flex items-center justify-center text-[9px] font-mono font-bold text-[#00FFC6] uppercase">
                {userEmail ? userEmail.slice(0, 2) : 'OP'}
              </div>
            </div>
            <div className="overflow-hidden">
              <div className="text-[10px] font-black text-white uppercase tracking-wider truncate">{userEmail ? userEmail.split('@')[0] : 'Operator'}</div>
              <div className="text-[8px] text-slate-500 truncate mt-0.5 font-mono">{userEmail || 'user@example.com'}</div>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="p-2 rounded-xl border border-white/5 hover:border-red-500/35 text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all cursor-pointer"
            title="Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

    </div>
  );
}
