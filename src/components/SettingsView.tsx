import { useState } from 'react';
import { 
  Settings, 
  HelpCircle, 
  Info, 
  Globe, 
  Terminal, 
  KeyRound, 
  ShieldCheck 
} from 'lucide-react';

interface SettingsViewProps {
  userEmail?: string;
}

export default function SettingsView({ userEmail }: SettingsViewProps) {
  const [profileName] = useState<string>(() => {
    return userEmail ? userEmail.split('@')[0] : 'administrator';
  });
  const [profileEmail] = useState<string>(() => {
    return userEmail || 'user@example.com';
  });

  return (
    <div id="settings-view-root" className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none font-sans">
      
      {/* Left Column: System Info */}
      <div className="lg:col-span-7 glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 bg-[#121A2E]/25">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Settings className="w-4 h-4 text-[#00D4FF]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">System Information</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="text-[9px] text-slate-500 font-mono block mb-1.5 uppercase tracking-wider font-bold">OPERATOR ALIAS</label>
                <div className="w-full bg-[#070b16] border border-white/5 rounded-xl p-2.5 text-xs text-white font-mono font-semibold">
                  {profileName}
                </div>
              </div>
              <div>
                <label className="text-[9px] text-slate-500 font-mono block mb-1.5 uppercase tracking-wider font-bold">CONTACT EMAIL</label>
                <div className="w-full bg-[#070b16] border border-white/5 rounded-xl p-2.5 text-xs text-white font-mono font-semibold">
                  {profileEmail}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <span className="text-[9px] text-slate-500 font-mono block mb-2.5 uppercase tracking-wider font-bold">INTEGRATED ENDPOINTS</span>
              
              <div className="p-3 bg-[#070b16]/80 border border-white/5 rounded-xl flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-3">
                  <KeyRound className="w-4 h-4 text-[#00FFC6]" />
                  <div>
                    <div className="text-white text-[11px] font-bold">GEMINI_API_KEY</div>
                    <div className="text-[8px] text-slate-500 mt-0.5 font-sans font-medium">Sourced from server environment variables</div>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-[#00FFC6] text-[8px] border border-emerald-500/20 font-bold uppercase tracking-wider font-mono">
                  CONNECTED
                </span>
              </div>
            </div>

            <div className="pt-4 border-t border-white/5">
              <span className="text-[9px] text-slate-500 font-mono block mb-2.5 uppercase tracking-wider font-bold">SYSTEM VERSION</span>
              <div className="p-3 bg-[#070b16]/80 border border-white/5 rounded-xl text-xs font-mono text-slate-400 space-y-1.5">
                <div className="flex justify-between"><span className="text-slate-500">Application</span><span className="text-white font-bold">NetMind AI v2.0</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Engine</span><span className="text-white font-bold">Gemini 2.5 Flash</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Runtime</span><span className="text-white font-bold">Node.js + Express</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/5 flex items-center gap-2 text-[9px] text-slate-500 font-mono">
          <Info className="w-4 h-4 text-[#00D4FF] shrink-0" />
          <span>Profile settings are tied to your login email. To change your email, register a new account.</span>
        </div>
      </div>

      {/* Right Column: Documentation instructions */}
      <div className="lg:col-span-5 glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 bg-[#121A2E]/10">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <HelpCircle className="w-4 h-4 text-[#00FFC6]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">NetMind Specifications</h2>
          </div>

          <div className="space-y-4 text-[11px] text-slate-400 leading-relaxed font-sans font-medium">
            <div>
              <h3 className="font-bold text-white flex items-center gap-2 uppercase tracking-wider text-[9px] font-mono">
                <Globe className="w-4 h-4 text-[#00D4FF]" />
                Gemini SDK Configuration
              </h3>
              <p className="text-slate-400 text-[10.5px] mt-1">
                The application uses the modern <code className="font-mono text-[9px] bg-slate-950 p-0.5 px-1 border border-white/5 rounded text-white">@google/genai</code> SDK on the server side to generate architectures. 
                You can configure your key inside the **Settings &gt; Secrets** panel in the AI Studio UI using the variable name <code className="font-mono text-[9px] bg-slate-950 p-0.5 px-1 border border-white/5 rounded text-white">GEMINI_API_KEY</code>.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-white flex items-center gap-2 uppercase tracking-wider text-[9px] font-mono">
                <Terminal className="w-4 h-4 text-[#00D4FF]" />
                Terminal Script Deployments
              </h3>
              <p className="text-slate-400 text-[10.5px] mt-1">
                All configs generated by NetMind AI are valid syntax scripts. You can copy-paste the RouterOS script directly into the Mikrotik Terminal, or the Cisco IOS configuration into global configure mode on Catalyst or Nexus switch CLI platforms.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-white flex items-center gap-2 uppercase tracking-wider text-[9px] font-mono">
                <ShieldCheck className="w-4 h-4 text-[#00D4FF]" />
                Isolated Docker Compose
              </h3>
              <p className="text-slate-400 text-[10.5px] mt-1">
                For production deployments, the backend Express server handles routing requests, and static SPA files compile under `/dist`. Docker compose configs align standard networking limits automatically.
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-white/5 pt-3.5 mt-5 text-[9.5px] text-slate-500 leading-normal flex items-start gap-2 font-sans font-medium">
          <Info className="w-4 h-4 text-[#00FFC6] shrink-0 mt-0.5" />
          <span>NetMind operations suite uses local sandboxed state file operations. Disconnects or cache purges will not affect server configurations.</span>
        </div>
      </div>

    </div>
  );
}
