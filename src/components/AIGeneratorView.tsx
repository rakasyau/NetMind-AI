import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Sparkles, 
  Send, 
  Copy, 
  Check, 
  BookOpen, 
  FileText, 
  Terminal, 
  ArrowRight,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import TopologyCanvas from './TopologyCanvas';
import { Device, Connection, IPPlanItem, GeneratedConfig, ChatMessage } from '../types';

interface AIGeneratorViewProps {
  activeProject: {
    id: string;
    name: string;
    description: string;
    topology: { devices: Device[]; connections: Connection[] };
    ipPlan: IPPlanItem[];
    configs: GeneratedConfig;
    chatHistory: ChatMessage[];
  };
  onSaveProject: (updated: any) => void;
  onRefreshProjectsList?: () => void;
}

const PRESET_PROMPTS = [
  {
    title: 'Unila Campus Network',
    desc: '3 VLANs, 200 Students, 50 Lecturers, Mikrotik gateway, and local DHCP/DNS servers.'
  },
  {
    title: 'Smart Greenhouse IoT',
    desc: 'Soil nodes, actuators, water valve controls linked to a Pi gateway with AP hotspot.'
  },
  {
    title: 'Enterprise Spine-Leaf',
    desc: 'Spine-Leaf network, Cisco Core Switch, ASA Firewall routing to web/database server DMZ.'
  }
];

export default function AIGeneratorView({ activeProject, onSaveProject, onRefreshProjectsList }: AIGeneratorViewProps) {
  const [prompt, setPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [configTab, setConfigTab] = useState<'mikrotik' | 'cisco' | 'debian' | 'documentation'>('mikrotik');
  const [isChatCollapsed, setIsChatCollapsed] = useState<boolean>(false);
  const [isConfigCollapsed, setIsConfigCollapsed] = useState<boolean>(false);

  // Topology state (local editing layer)
  const [localDevices, setLocalDevices] = useState<Device[]>(activeProject.topology.devices);
  const [localConnections, setLocalConnections] = useState<Connection[]>(activeProject.topology.connections);
  const [localIpPlan, setLocalIpPlan] = useState<IPPlanItem[]>(activeProject.ipPlan);
  const [localConfigs, setLocalConfigs] = useState<GeneratedConfig>(activeProject.configs);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(activeProject.chatHistory);

  // Auto-scroll ref
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Debounce timer ref for topology saves
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync state when activeProject changes
  useEffect(() => {
    if (activeProject) {
      setLocalDevices(activeProject.topology?.devices || []);
      setLocalConnections(activeProject.topology?.connections || []);
      setLocalIpPlan(activeProject.ipPlan || []);
      setLocalConfigs(activeProject.configs || { mikrotik: '', debian: '', cisco: '', documentation: '' });
      setChatHistory(activeProject.chatHistory || []);
    }
  }, [activeProject?.id]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, loading]);

  // Trigger prompt submit to Express server API
  const handleSubmitPrompt = async (textToSend?: string) => {
    const finalPrompt = textToSend || prompt;
    if (!finalPrompt.trim()) return;

    setLoading(true);
    setPrompt('');

    // Add user message
    const userMsg: ChatMessage = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      role: 'user',
      content: finalPrompt,
      timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
    };
    const updatedHistory = [...chatHistory, userMsg];
    setChatHistory(updatedHistory);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: finalPrompt,
          existingTopology: { devices: localDevices, connections: localConnections },
          chatHistory: updatedHistory.slice(-8) // Send recent chat for context
        })
      });

      if (!res.ok) throw new Error('API server error');

      const data = await res.json();
      
      if (data.type === 'conversation') {
        // Conversational response — just add text to chat, no topology change
        const assistantMsg: ChatMessage = {
          id: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: data.message || 'Maaf, saya tidak bisa memproses pertanyaan ini.',
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };
        const finalHistory = [...updatedHistory, assistantMsg];
        setChatHistory(finalHistory);

        // Save chat history to project
        onSaveProject({
          ...activeProject,
          topology: { devices: localDevices, connections: localConnections },
          ipPlan: localIpPlan,
          configs: localConfigs,
          chatHistory: finalHistory,
          updatedAt: new Date().toISOString()
        });

      } else if (data.type === 'topology' || data.topology) {
        // Topology generation response
        const aiDevices = data.topology?.devices || [];
        const aiConnections = data.topology?.connections || [];
        const aiIpPlan = data.ip_plan || [];
        const aiConfigs: GeneratedConfig = {
          mikrotik: data.mikrotik_config || '',
          cisco: data.cisco_config || '',
          debian: data.debian_config || '',
          documentation: data.documentation || ''
        };

        // Use AI-generated summary if available, otherwise craft a brief one
        const summaryText = data.summary || 
          `Topologi telah di-generate: ${aiDevices.length} perangkat, ${aiConnections.length} koneksi, ${aiIpPlan.length} subnet.`;

        const assistantMsg: ChatMessage = {
          id: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          role: 'assistant',
          content: summaryText,
          timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
        };

        const finalHistory = [...updatedHistory, assistantMsg];

        setLocalDevices(aiDevices);
        setLocalConnections(aiConnections);
        setLocalIpPlan(aiIpPlan);
        setLocalConfigs(aiConfigs);
        setChatHistory(finalHistory);

        // Save back to project state
        onSaveProject({
          ...activeProject,
          topology: { devices: aiDevices, connections: aiConnections },
          ipPlan: aiIpPlan,
          configs: aiConfigs,
          chatHistory: finalHistory,
          updatedAt: new Date().toISOString()
        });

        if (onRefreshProjectsList) {
          onRefreshProjectsList();
        }
      }
    } catch (err) {
      console.error('Error generating topology:', err);
      const errorMsg: ChatMessage = {
        id: `ast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        role: 'assistant',
        content: `Maaf, terjadi kendala saat menghubungkan ke mesin AI. Silakan coba kembali sesaat lagi.`,
        timestamp: new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
      };
      setChatHistory([...updatedHistory, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced topology save — prevents API spam during drag operations
  const debouncedSaveTopology = useCallback((newDevices: Device[], newConnections: Connection[]) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      onSaveProject({
        ...activeProject,
        topology: { devices: newDevices, connections: newConnections },
        ipPlan: localIpPlan,
        configs: localConfigs,
        chatHistory: chatHistory,
        updatedAt: new Date().toISOString()
      });
    }, 500);
  }, [activeProject, localIpPlan, localConfigs, chatHistory, onSaveProject]);

  // Update topology coordinate changes or node modifications from canvas
  const handleUpdateTopology = (newDevices: Device[], newConnections: Connection[]) => {
    setLocalDevices(newDevices);
    setLocalConnections(newConnections);
    debouncedSaveTopology(newDevices, newConnections);
  };

  // Code Copy trigger
  const handleCopyConfig = (text: string, tab: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      console.warn('Clipboard write failed (requires HTTPS or secure context)');
    });
    setCopiedTab(tab);
    setTimeout(() => {
      setCopiedTab(null);
    }, 2000);
  };

  // Custom code highlighting
  const renderHighlightedCode = (code: string) => {
    if (!code) return <span className="text-slate-600 italic">// No config output generated</span>;
    const lines = code.split('\n');
    return lines.map((line, idx) => {
      let lineClass = 'text-slate-300';
      if (line.startsWith('#') || line.startsWith('!') || line.startsWith('//')) {
        lineClass = 'text-slate-500 italic';
      } else if (line.includes('/ip') || line.includes('/interface') || line.includes('/routing')) {
        lineClass = 'text-[#00FFC6] font-semibold';
      } else if (line.includes('interface ') || line.includes('vlan ') || line.includes('ip address')) {
        lineClass = 'text-[#00D4FF] font-medium';
      }
      return (
        <div key={idx} className="font-mono text-[10px] leading-relaxed py-0.5 flex">
          <span className="text-slate-700 mr-4 select-none inline-block w-6 text-right font-mono">{idx + 1}</span>
          <span className={lineClass}>{line}</span>
        </div>
      );
    });
  };

  let canvasSpan = 'lg:col-span-6';
  if (isChatCollapsed && isConfigCollapsed) {
    canvasSpan = 'lg:col-span-12';
  } else if (isChatCollapsed) {
    canvasSpan = 'lg:col-span-9';
  } else if (isConfigCollapsed) {
    canvasSpan = 'lg:col-span-9';
  }

  return (
    <div id="ai-generator-root" className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-100px)] max-h-[900px] overflow-hidden select-none font-sans relative">
      
      {/* 1. LEFT COLUMN: AI Chat Panel */}
      {!isChatCollapsed && (
        <div className="lg:col-span-3 glass-panel rounded-2xl flex flex-col justify-between overflow-hidden border-white/5">
          
          {/* Chat Panel Header */}
          <div className="p-4 border-b border-white/5 bg-[#0a0f1e]/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00D4FF]" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">NetMind Copilot</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] px-2 py-0.5 rounded bg-[#00D4FF]/10 border border-[#00D4FF]/25 text-[#00D4FF] font-mono font-bold uppercase tracking-wider">
                Gemini 2.5
              </span>
              <button
                onClick={() => setIsChatCollapsed(true)}
                title="Hide AI Copilot"
                className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer border border-white/5"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Chat History & Prompt presets */}
          <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 flex flex-col bg-[#070b16]/30">
            {chatHistory.length === 0 ? (
              <div className="flex-1 flex flex-col justify-center items-center text-center p-3">
                <Sparkles className="w-10 h-10 text-[#00D4FF]/30 mb-3" />
                <p className="text-[11px] text-white font-extrabold uppercase tracking-wider font-mono">Synthesize Topology</p>
                <p className="text-[10.5px] text-slate-500 max-w-[200px] leading-relaxed mt-1 mb-6 font-medium">
                  Describe requirements in plain English or select a reference layout block to compile.
                </p>

                <div className="w-full space-y-2">
                  {PRESET_PROMPTS.map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSubmitPrompt(preset.title + ': ' + preset.desc)}
                      className="w-full p-3 rounded-xl bg-[#0a0f1e]/85 border border-white/5 hover:border-[#00D4FF]/25 hover:bg-[#121A2E]/40 text-left transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="max-w-[85%]">
                        <div className="text-[10px] font-bold text-white truncate uppercase tracking-wide font-mono group-hover:text-[#00D4FF] transition-colors">{preset.title}</div>
                        <div className="text-[9px] text-slate-500 truncate mt-1 font-medium">{preset.desc}</div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[#00D4FF] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {chatHistory.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex flex-col max-w-[90%] ${
                      msg.role === 'user' ? 'self-end ml-auto' : 'self-start mr-auto'
                    }`}
                  >
                    <div className={`p-3.5 rounded-2xl text-[11px] leading-relaxed ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-r from-[#00D4FF]/10 to-[#00FFC6]/5 border border-[#00D4FF]/25 text-white rounded-tr-none font-medium' 
                        : 'bg-[#0a0f1e]/90 border border-white/5 text-slate-300 rounded-tl-none font-medium'
                    }`}>
                      {msg.content}
                    </div>
                    <span className="text-[7.5px] text-slate-500 mt-1 self-end font-mono font-bold tracking-wider uppercase">
                      {msg.timestamp}
                    </span>
                  </div>
                ))}

                {loading && (
                  <div className="flex items-center gap-2.5 p-3.5 bg-[#0a0f1e]/80 border border-white/5 rounded-2xl max-w-[85%] rounded-tl-none animate-pulse">
                    <RefreshCw className="w-3.5 h-3.5 text-[#00FFC6] animate-spin" />
                    <span className="text-[9px] text-[#00FFC6] font-mono font-bold uppercase tracking-widest">Compiling routing tables...</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input prompt bar */}
          <div className="p-3 bg-[#0a0f1e]/80 border-t border-white/5 backdrop-blur-md">
            <div className="relative">
              <input
                type="text"
                value={prompt}
                disabled={loading}
                placeholder="e.g. Buat jaringan VLAN kampus..."
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitPrompt()}
                className="w-full bg-[#070b16] border border-white/5 hover:border-white/15 focus:border-[#00D4FF]/40 rounded-xl p-3 pr-11 text-[11px] text-white focus:outline-none placeholder-slate-600 transition-colors shadow-inner font-medium font-sans"
              />
              <button
                onClick={() => handleSubmitPrompt()}
                disabled={loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] hover:brightness-105 flex items-center justify-center transition-all text-[#0A0F1E] cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

        </div>
      )}

      {/* 2. CENTER COLUMN: Interactive Network Topology Stage */}
      <div className={`${canvasSpan} bg-[#070b16]/20 rounded-2xl flex flex-col overflow-hidden relative border border-white/5`}>
        {/* Toggle buttons for collapsed panels */}
        {isChatCollapsed && (
          <button
            onClick={() => setIsChatCollapsed(false)}
            title="Show AI Copilot"
            className="absolute left-3 top-3 z-20 p-2.5 rounded-xl bg-[#121A2E]/95 border border-white/10 hover:border-white/20 text-[#00D4FF] hover:bg-[#121A2E] hover:text-[#00FFC6] hover:shadow-[0_0_15px_rgba(0,212,255,0.25)] transition-all cursor-pointer flex items-center justify-center font-bold"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        
        {isConfigCollapsed && (
          <button
            onClick={() => setIsConfigCollapsed(false)}
            title="Show Configs & Specs"
            className="absolute right-3 top-3 z-20 p-2.5 rounded-xl bg-[#121A2E]/95 border border-white/10 hover:border-white/20 text-[#00D4FF] hover:bg-[#121A2E] hover:text-[#00FFC6] hover:shadow-[0_0_15px_rgba(0,212,255,0.25)] transition-all cursor-pointer flex items-center justify-center font-bold"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}

        <TopologyCanvas 
          devices={localDevices}
          connections={localConnections}
          onUpdateTopology={handleUpdateTopology}
        />
      </div>

      {/* 3. RIGHT COLUMN: Generated Configurations & Documentation */}
      {!isConfigCollapsed && (
        <div className="lg:col-span-3 glass-panel rounded-2xl flex flex-col justify-between overflow-hidden border-white/5">
          
          {/* Config Header Tabs */}
          <div className="grid grid-cols-5 border-b border-white/5 bg-[#0a0f1e]/60 p-1 gap-1">
            <button
              onClick={() => setConfigTab('mikrotik')}
              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 cursor-pointer ${
                configTab === 'mikrotik' ? 'bg-[#00D4FF] text-[#0A0F1E] shadow-sm font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Mikrotik
            </button>
            <button
              onClick={() => setConfigTab('cisco')}
              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 cursor-pointer ${
                configTab === 'cisco' ? 'bg-[#00D4FF] text-[#0A0F1E] shadow-sm font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              Cisco
            </button>
            <button
              onClick={() => setConfigTab('debian')}
              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 cursor-pointer ${
                configTab === 'debian' ? 'bg-[#00D4FF] text-[#0A0F1E] shadow-sm font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Debian
            </button>
            <button
              onClick={() => setConfigTab('documentation')}
              className={`py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex flex-col items-center gap-1 cursor-pointer ${
                configTab === 'documentation' ? 'bg-[#00D4FF] text-[#0A0F1E] shadow-sm font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Specs
            </button>
            <button
              onClick={() => setIsConfigCollapsed(true)}
              title="Hide Configurations"
              className="py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer border border-transparent hover:border-white/5"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              Hide
            </button>
          </div>

        {/* Configuration content body */}
        <div className="flex-1 p-4 overflow-y-auto bg-[#070b16]/40 select-text">
          
          {configTab === 'mikrotik' && (
            <div className="relative h-full">
              <button
                onClick={() => handleCopyConfig(localConfigs.mikrotik, 'mikrotik')}
                className="absolute top-0 right-0 p-2 rounded-lg bg-[#121A2E]/80 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer shadow-md"
              >
                {copiedTab === 'mikrotik' ? <Check className="w-3.5 h-3.5 text-[#00FFC6]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <div className="pt-2 pr-8 h-full">
                {renderHighlightedCode(localConfigs.mikrotik)}
              </div>
            </div>
          )}

          {configTab === 'cisco' && (
            <div className="relative h-full">
              <button
                onClick={() => handleCopyConfig(localConfigs.cisco, 'cisco')}
                className="absolute top-0 right-0 p-2 rounded-lg bg-[#121A2E]/80 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer shadow-md"
              >
                {copiedTab === 'cisco' ? <Check className="w-3.5 h-3.5 text-[#00FFC6]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <div className="pt-2 pr-8 h-full">
                {renderHighlightedCode(localConfigs.cisco)}
              </div>
            </div>
          )}

          {configTab === 'debian' && (
            <div className="relative h-full">
              <button
                onClick={() => handleCopyConfig(localConfigs.debian, 'debian')}
                className="absolute top-0 right-0 p-2 rounded-lg bg-[#121A2E]/80 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer shadow-md"
              >
                {copiedTab === 'debian' ? <Check className="w-3.5 h-3.5 text-[#00FFC6]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <div className="pt-2 pr-8 h-full">
                {renderHighlightedCode(localConfigs.debian)}
              </div>
            </div>
          )}

          {configTab === 'documentation' && (
            <div className="relative text-xs text-slate-300 leading-relaxed font-sans space-y-3 h-full">
              <button
                onClick={() => handleCopyConfig(localConfigs.documentation, 'doc')}
                className="absolute top-0 right-0 p-2 rounded-lg bg-[#121A2E]/80 border border-white/5 hover:border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer shadow-md"
              >
                {copiedTab === 'doc' ? <Check className="w-3.5 h-3.5 text-[#00FFC6]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              
              <div className="prose prose-invert max-w-none pt-2">
                {localConfigs.documentation ? (
                  localConfigs.documentation.split('\n').map((line, i) => {
                    if (line.startsWith('# ')) {
                      return <h1 key={i} className="text-[12px] font-bold text-white border-b border-white/5 pb-1.5 mt-4 mb-2 uppercase tracking-wide font-mono text-[#00D4FF]">{line.replace('# ', '')}</h1>;
                    } else if (line.startsWith('## ')) {
                      return <h2 key={i} className="text-[10px] font-bold text-white uppercase tracking-wider font-mono mt-3 mb-1.5">{line.replace('## ', '')}</h2>;
                    } else if (line.startsWith('- ')) {
                      return (
                        <div key={i} className="flex gap-2 pl-1.5 py-0.5">
                          <span className="text-[#00FFC6]">•</span>
                          <span className="text-[10.5px] text-slate-400 font-medium">{line.replace('- ', '')}</span>
                        </div>
                      );
                    }
                    return <p key={i} className="mb-2 text-slate-400 text-[10.5px] font-medium leading-relaxed">{line}</p>;
                  })
                ) : (
                  <span className="text-slate-600 font-mono italic">// Click presets or design to compile markdown specs</span>
                )}
              </div>
            </div>
          )}

        </div>

        {/* IP Planner Quick Table footer block */}
        <div className="bg-[#0a0f1e]/80 border-t border-white/5 p-3.5 text-xs">
          <div className="flex items-center justify-between mb-2 text-[9px] font-bold text-slate-400 tracking-wider uppercase font-mono">
            <span>VLSM IP Allocations</span>
            <span className="text-[#00FFC6]">CIDR</span>
          </div>

          <div className="space-y-1.5 max-h-[110px] overflow-y-auto font-mono text-[9px] text-slate-400">
            {localIpPlan.length === 0 ? (
              <div className="text-slate-600 italic py-2 text-[9px] font-mono">// No active IP subnets mapped.</div>
            ) : (
              localIpPlan.map((subnet) => (
                <div key={subnet.id} className="flex justify-between items-center p-2 rounded-xl bg-[#070b16]/90 border border-white/5">
                  <div className="max-w-[65%]">
                    <span className="text-white block font-sans font-bold truncate tracking-wide text-[10px]">{subnet.name}</span>
                    <span className="text-slate-500 text-[8px] font-semibold mt-0.5 block font-mono">GW: {subnet.gateway}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#00FFC6] block font-bold">/{subnet.cidr}</span>
                    <span className="text-slate-500 text-[8px] font-semibold block">{subnet.networkAddress}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        </div>
      )}

    </div>
  );
}
