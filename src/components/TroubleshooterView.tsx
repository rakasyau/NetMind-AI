import { useState } from 'react';
import { 
  ShieldAlert, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Copy, 
  Check, 
  Activity,
  Sparkles,
  Database
} from 'lucide-react';
import { TroubleshootResult, Project } from '../types';

const SAMPLE_TICKETS = [
  {
    title: 'Client tidak mendapat IP DHCP',
    desc: 'PC di VLAN 10 gagal memperoleh alamat IP dinamis dari Debian DHCP Server di VLAN 30.'
  },
  {
    title: 'Gagal resolve domain google.com',
    desc: 'User melaporkan tidak bisa browsing internet, namun bisa ping ke IP gateway publik.'
  },
  {
    title: 'Rute inter-VLAN mati total',
    desc: 'Komputer di VLAN 10 tidak bisa melakukan ping ke server yang ada di VLAN 20.'
  }
];

interface TroubleshooterViewProps {
  activeProject?: Project | null;
}

export default function TroubleshooterView({ activeProject }: TroubleshooterViewProps) {
  const [ticketQuery, setTicketQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<TroubleshootResult | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const handleRunDiagnostic = async (text?: string) => {
    const finalQuery = text || ticketQuery;
    if (!finalQuery.trim()) return;

    setLoading(true);
    setTicketQuery(finalQuery);

    try {
      const res = await fetch('/api/troubleshoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          query: finalQuery,
          topology: activeProject?.topology
        })
      });

      if (!res.ok) throw new Error('API server failure');

      const data = await res.json();
      if (data) {
        setResult(data);
      }
    } catch (err) {
      console.error('Error running troubleshooting diagnostics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCommand = (text: string, idx: number) => {
    navigator.clipboard.writeText(text).catch(() => {
      console.warn('Clipboard write failed (requires HTTPS or secure context)');
    });
    setCopiedIdx(idx);
    setTimeout(() => {
      setCopiedIdx(null);
    }, 2000);
  };

  return (
    <div id="troubleshooter-root" className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none font-sans">
      
      {/* Left Column: Trouble ticket input & quick examples */}
      <div className="lg:col-span-4 glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 bg-[#121A2E]/25">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Outage Ticket Entry</h2>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs text-slate-400 font-mono block uppercase tracking-wider font-bold">Ticket Description</label>
              {activeProject && (
                <div className="flex items-center gap-1 text-[9px] bg-[#00FFC6]/10 text-[#00FFC6] px-2 py-0.5 rounded-lg font-mono uppercase font-bold tracking-wider border border-[#00FFC6]/15 shadow-sm">
                  <Database className="w-2.5 h-2.5" /> {activeProject.name} Active
                </div>
              )}
            </div>
            <textarea
              rows={4}
              value={ticketQuery}
              onChange={(e) => setTicketQuery(e.target.value)}
              placeholder="Describe what's failing (e.g. Cannot resolve google.com, or Client tidak mendapat IP DHCP)..."
              className="w-full bg-[#070b16] border border-white/5 focus:border-red-400/40 hover:border-red-500/15 rounded-xl p-3.5 text-xs text-white focus:outline-none placeholder-slate-600 resize-none transition-all shadow-inner font-sans font-medium"
            />
          </div>

          <div>
            <span className="text-xs text-slate-400 font-mono block mb-2 uppercase tracking-wider font-bold">Common Outage Presets</span>
            <div className="space-y-2">
              {SAMPLE_TICKETS.map((t, idx) => (
                <button
                  key={idx}
                  onClick={() => handleRunDiagnostic(t.title + ': ' + t.desc)}
                  className="w-full p-3.5 rounded-xl bg-[#070b16]/80 border border-white/5 hover:border-red-500/25 hover:bg-[#121a2e]/30 text-left transition-all flex items-start gap-2.5 group cursor-pointer shadow-sm"
                >
                  <AlertCircle className="w-4 h-4 text-red-500/70 mt-0.5 shrink-0 transition-colors group-hover:text-red-400" />
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-red-400 transition-colors uppercase tracking-wide font-mono">{t.title}</div>
                    <div className="text-[10.5px] text-[#A0AEC0] mt-1 leading-relaxed font-medium">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => handleRunDiagnostic()}
          disabled={loading}
          className="w-full mt-5 py-3.5 bg-gradient-to-r from-red-500 to-amber-500 hover:brightness-105 text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-md hover:shadow-[0_0_20px_rgba(239,68,68,0.25)] cursor-pointer"
        >
          {loading ? (
            <>
              <Activity className="w-4 h-4 animate-spin text-white" />
              <span>Tracing path logic...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 text-white" />
              <span>Initialize Diagnostic Trace</span>
            </>
          )}
        </button>
      </div>

      {/* Right Column: Diagnostic trace results */}
      <div className="lg:col-span-8 glass-panel p-5 sm:p-6 rounded-2xl border-white/5 bg-[#121A2E]/10 flex flex-col justify-between min-h-[380px]">
        <div>
          <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
            <Terminal className="w-4 h-4 text-[#00FFC6]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Trace Analysis Console</h2>
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center py-24 bg-[#070b16]/10 rounded-2xl border border-dashed border-white/5">
              <ShieldAlert className="w-12 h-12 text-slate-700 mb-3 animate-pulse" />
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">Diagnostic pipeline idle</p>
              <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed mt-1 font-medium">
                Submit an active outage description or select an example preset to automatically trace packet paths.
              </p>
            </div>
          ) : (
            <div className="space-y-4.5 select-text">
              
              {/* Root Cause card */}
              <div className="p-4 rounded-xl bg-red-950/15 border border-red-500/25 glow-red">
                <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider font-mono">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span>Identified Root Cause</span>
                </div>
                <p className="text-sm text-white font-extrabold mt-1.5 leading-relaxed font-sans">
                  {result.rootCause}
                </p>
              </div>

              {/* Analysis Text block */}
              <div>
                <span className="text-xs text-slate-400 font-mono block mb-1.5 uppercase tracking-wider font-bold">Trace Debug Log</span>
                <p className="text-xs text-slate-300 leading-relaxed bg-[#070b16]/80 border border-white/5 p-4 rounded-xl whitespace-pre-wrap font-sans font-medium">
                  {result.analysis}
                </p>
              </div>

              {/* Fix Actions */}
              <div>
                <span className="text-xs text-slate-400 font-mono block mb-2 uppercase tracking-wider font-bold">Recommended Mitigation Checklist</span>
                <div className="space-y-1.5">
                  {result.fixes.map((fix, idx) => (
                    <div key={idx} className="flex gap-2.5 text-xs text-slate-300 pl-0.5 py-0.5">
                      <CheckCircle2 className="w-4 h-4 text-[#00FFC6] shrink-0 mt-0.5" />
                      <span className="font-medium leading-relaxed">{fix}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CLI command remedies */}
              <div>
                <span className="text-xs text-slate-400 font-mono block mb-2 uppercase tracking-wider font-bold font-mono">Remediation Scripts</span>
                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                  {result.commands.map((cmd, idx) => {
                    const isComment = cmd.startsWith('#') || cmd.startsWith('//') || cmd.startsWith('!');
                    return (
                      <div key={idx} className="relative group bg-[#070b16] border border-white/5 hover:border-[#00D4FF]/25 p-3.5 rounded-xl transition-all flex items-center justify-between font-mono text-xs md:text-sm shadow-sm">
                        <span className={isComment ? 'text-slate-500 italic' : 'text-[#00FFC6] font-bold'}>
                          {cmd}
                        </span>
                        {!isComment && (
                          <button
                            onClick={() => handleCopyCommand(cmd, idx)}
                            className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                          >
                            {copiedIdx === idx ? <Check className="w-3 h-3 text-[#00FFC6]" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>

        {result && (
          <div className="border-t border-white/5 pt-3.5 mt-5 flex items-center gap-2 text-[9.5px] text-slate-500 font-sans font-medium">
            <Sparkles className="w-4 h-4 text-[#00FFC6] animate-pulse" />
            <span>Remediation matrices compiled via Gemini routing model parameters. Audit switch bounds prior to execution.</span>
          </div>
        )}
      </div>

    </div>
  );
}
