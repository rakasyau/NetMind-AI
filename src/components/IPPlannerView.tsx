import { useState, useEffect } from 'react';
import { 
  Layers, 
  Plus, 
  Trash2, 
  Info, 
  Calculator, 
  Check, 
  Save,
  AlertTriangle
} from 'lucide-react';
import { Project, IPPlanItem } from '../types';

interface IPPlannerSubnet {
  id: string;
  name: string;
  hosts: number;
}

interface IPPlannerViewProps {
  activeProject?: Project | null;
  onSaveProject?: (updatedProject: Project) => void;
}

export default function IPPlannerView({ activeProject, onSaveProject }: IPPlannerViewProps) {
  const [baseNetwork, setBaseNetwork] = useState<string>('192.168.1.0');
  const [plannerMode, setPlannerMode] = useState<'vlsm' | 'flsm'>('vlsm');
  const [fixedSubnetPrefix, setFixedSubnetPrefix] = useState<number>(24);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  const [subnets, setSubnets] = useState<IPPlannerSubnet[]>([
    { id: '1', name: 'VLAN 10 - Lab Komputer', hosts: 200 },
    { id: '2', name: 'VLAN 20 - WiFi Dosen', hosts: 50 },
    { id: '3', name: 'VLAN 30 - Server & DMZ', hosts: 25 },
    { id: '4', name: 'VLAN 40 - Smart IoT Nodes', hosts: 10 },
  ]);

  const [calcResults, setCalcResults] = useState<any[]>([]);
  const [isCalculated, setIsCalculated] = useState<boolean>(false);

  // Load IP Plan from active project if it exists
  useEffect(() => {
    if (activeProject && activeProject.ipPlan && activeProject.ipPlan.length > 0) {
      const initialSubnets = activeProject.ipPlan.map((ip) => ({
        id: ip.id,
        name: ip.name,
        hosts: ip.hostsNeeded
      }));
      setSubnets(initialSubnets);

      const initialCalc = activeProject.ipPlan.map((ip) => ({
        id: ip.id,
        name: ip.name,
        hostsRequested: ip.hostsNeeded,
        hostsAllocated: ip.hostsNeeded, 
        networkAddress: ip.networkAddress,
        gateway: ip.gateway,
        subnetMask: ip.subnetMask,
        broadcastAddress: ip.broadcastAddress,
        dhcpRange: ip.dhcpRange,
        cidr: ip.cidr
      }));
      setCalcResults(initialCalc);
      setIsCalculated(true);
      setValidationError(null);

      // Guess base network from first record
      if (activeProject.ipPlan[0]?.networkAddress) {
        const parts = activeProject.ipPlan[0].networkAddress.split('.');
        if (parts.length === 4) {
          setBaseNetwork(`${parts[0]}.${parts[1]}.${parts[2]}.0`);
        }
      }
    }
    setSaveStatus('idle');
  }, [activeProject]);

  // Add blank subnet row
  const handleAddSubnetRow = () => {
    const nextIdx = subnets.length + 1;
    setSubnets([
      ...subnets,
      { id: Date.now().toString(), name: `Subnetwork VLAN-${nextIdx * 10}`, hosts: 30 }
    ]);
    setIsCalculated(false);
  };

  // Remove subnet row
  const handleRemoveSubnetRow = (id: string) => {
    setSubnets(subnets.filter((s) => s.id !== id));
    setIsCalculated(false);
  };

  // Update field parameters
  const handleUpdateSubnetRow = (id: string, key: 'name' | 'hosts', value: any) => {
    setSubnets(
      subnets.map((s) => (s.id === id ? { ...s, [key]: value } : s))
    );
    setIsCalculated(false);
  };

  // VLSM / FLSM Calculation Logic
  const handleCalculatePlanner = () => {
    // IPv4 Address validation regex
    const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    if (!ipv4Regex.test(baseNetwork.trim())) {
      setValidationError("Base Network IP Address format is invalid. Please enter a valid IPv4 subnet (e.g. 192.168.1.0).");
      setIsCalculated(false);
      return;
    }

    setValidationError(null);

    // Sort subnets by host count descending for optimal VLSM allocation
    const sortedSubnets = [...subnets].sort((a, b) => b.hosts - a.hosts);
    
    let currentIPBytes = baseNetwork.trim().split('.').map(Number);
    // Force unsigned 32-bit integer
    let ip32 = ((currentIPBytes[0] << 24) | (currentIPBytes[1] << 16) | (currentIPBytes[2] << 8) | currentIPBytes[3]) >>> 0;

    const formatIP = (val: number) => {
      const unsigned = val >>> 0;
      return [
        (unsigned >>> 24) & 255,
        (unsigned >>> 16) & 255,
        (unsigned >>> 8) & 255,
        unsigned & 255
      ].join('.');
    };

    const results = sortedSubnets.map((subnet) => {
      let cidr = 24;
      let size = 256;

      if (plannerMode === 'vlsm') {
        // Find closest power of 2 that accommodates hosts + 2 (network & broadcast)
        const totalNeeded = subnet.hosts + 2;
        let power = 2;
        while (Math.pow(2, power) < totalNeeded) {
          power++;
        }
        size = Math.pow(2, power);
        cidr = 32 - power;
      } else {
        // FLSM
        cidr = fixedSubnetPrefix;
        size = Math.pow(2, 32 - fixedSubnetPrefix);
      }

      // Align ip32 to boundary
      const remainder = ip32 % size;
      if (remainder !== 0) {
        ip32 = (ip32 + (size - remainder)) >>> 0;
      }

      const networkAddress = formatIP(ip32);
      const gatewayAddress = formatIP((ip32 + 1) >>> 0);
      const startDHCP = formatIP((ip32 + 2) >>> 0);
      const endDHCP = formatIP((ip32 + size - 2) >>> 0);
      const broadcastAddress = formatIP((ip32 + size - 1) >>> 0);

      const mask32 = (~((1 << (32 - cidr)) - 1)) >>> 0;
      const subnetMask = formatIP(mask32);

      // Advance for next loop
      ip32 = (ip32 + size) >>> 0;

      return {
        id: subnet.id,
        name: subnet.name,
        hostsRequested: subnet.hosts,
        hostsAllocated: size - 2,
        networkAddress,
        gateway: gatewayAddress,
        subnetMask,
        broadcastAddress,
        dhcpRange: `${startDHCP} - ${endDHCP}`,
        cidr
      };
    });

    setCalcResults(results);
    setIsCalculated(true);
  };

  const handleSaveIPPlan = () => {
    if (!activeProject || !onSaveProject || !isCalculated) return;
    setSaveStatus('saving');

    const ipPlanItems: IPPlanItem[] = calcResults.map((row) => ({
      id: row.id || Date.now().toString() + Math.random().toString(),
      name: row.name,
      hostsNeeded: row.hostsRequested,
      networkAddress: row.networkAddress,
      gateway: row.gateway,
      subnetMask: row.subnetMask,
      broadcastAddress: row.broadcastAddress,
      dhcpRange: row.dhcpRange,
      cidr: row.cidr
    }));

    const updatedProject: Project = {
      ...activeProject,
      ipPlan: ipPlanItems
    };

    onSaveProject(updatedProject);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  return (
    <div id="ip-planner-root" className="grid grid-cols-1 lg:grid-cols-12 gap-5 select-none font-sans">
      
      {/* Left panel: Input parameters */}
      <div className="lg:col-span-5 glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 bg-[#121A2E]/25">
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Calculator className="w-4 h-4 text-[#00D4FF]" />
            <h2 className="text-xs font-bold text-white uppercase tracking-wider font-mono">IP Allocation Settings</h2>
          </div>

          {/* Validation Alert */}
          {validationError && (
            <div className="bg-red-500/10 border border-red-500/15 text-red-400 p-3.5 rounded-xl text-[10.5px] leading-relaxed font-sans font-medium flex items-start gap-2 shadow-sm">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{validationError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs text-slate-400 font-mono block mb-1.5 uppercase tracking-wider font-bold">Base IP Network</label>
              <input
                type="text"
                value={baseNetwork}
                onChange={(e) => { 
                  setBaseNetwork(e.target.value); 
                  setIsCalculated(false);
                  setValidationError(null);
                }}
                className="w-full bg-[#070b16] border border-white/5 focus:border-[#00D4FF]/40 rounded-xl p-3 text-sm text-white focus:outline-none font-mono tracking-wide shadow-inner font-semibold"
              />
            </div>
            
            <div>
              <label className="text-xs text-slate-400 font-mono block mb-1.5 uppercase tracking-wider font-bold">Subnet Method</label>
              <div className="grid grid-cols-2 gap-0.5 bg-[#070b16] p-1 rounded-xl border border-white/5 shadow-inner">
                <button
                  onClick={() => { setPlannerMode('vlsm'); setIsCalculated(false); }}
                  className={`py-2 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    plannerMode === 'vlsm' ? 'bg-[#00D4FF] text-[#0a0f1e] shadow-sm font-black' : 'text-slate-400 hover:text-white font-semibold'
                  }`}
                >
                  VLSM
                </button>
                <button
                  onClick={() => { setPlannerMode('flsm'); setIsCalculated(false); }}
                  className={`py-1.5 rounded-lg text-xs font-bold uppercase transition-all cursor-pointer ${
                    plannerMode === 'flsm' ? 'bg-[#00D4FF] text-[#0a0f1e] shadow-sm font-black' : 'text-slate-400 hover:text-white font-semibold'
                  }`}
                >
                  FLSM
                </button>
              </div>
            </div>
          </div>

          {plannerMode === 'flsm' && (
            <div>
              <label className="text-xs text-slate-400 font-mono block mb-1.5 uppercase tracking-wider font-bold">Fixed Subnet Mask prefix</label>
              <select
                value={fixedSubnetPrefix}
                onChange={(e) => { setFixedSubnetPrefix(Number(e.target.value)); setIsCalculated(false); }}
                className="w-full bg-[#070b16] border border-white/5 rounded-xl p-2.5 text-xs text-white focus:outline-none font-mono cursor-pointer font-bold"
              >
                <option value={24}>/24 (254 hosts)</option>
                <option value={25}>/25 (126 hosts)</option>
                <option value={26}>/26 (62 hosts)</option>
                <option value={27}>/27 (30 hosts)</option>
                <option value={28}>/28 (14 hosts)</option>
                <option value={29}>/29 (6 hosts)</option>
                <option value={30}>/30 (2 hosts)</option>
              </select>
            </div>
          )}

          {/* Subnet list editor */}
          <div>
            <div className="flex justify-between items-center mb-2 pb-1 border-b border-white/5">
              <span className="text-xs text-slate-400 font-mono uppercase tracking-wider font-bold">VLAN Subdivisions</span>
              <button
                onClick={handleAddSubnetRow}
                className="px-2.5 py-1 rounded-lg bg-[#121A2E]/50 border border-white/5 hover:border-[#00D4FF]/30 text-[#00D4FF] hover:text-[#00FFC6] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add VLAN
              </button>
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {subnets.map((sub) => (
                <div key={sub.id} className="flex gap-2 items-center bg-[#070b16]/70 p-1.5 px-2.5 rounded-xl border border-white/5 shadow-sm">
                  <input
                    type="text"
                    value={sub.name}
                    placeholder="Subnet Label"
                    onChange={(e) => handleUpdateSubnetRow(sub.id, 'name', e.target.value)}
                    className="flex-1 bg-transparent py-0.5 text-xs font-bold text-white focus:outline-none border-b border-transparent focus:border-white/10"
                  />
                  <div className="flex items-center gap-1 w-20 border-l border-white/5 pl-2.5 shrink-0">
                    <input
                      type="number"
                      value={sub.hosts}
                      placeholder="Hosts"
                      onChange={(e) => handleUpdateSubnetRow(sub.id, 'hosts', Number(e.target.value))}
                      className="w-11 bg-transparent text-xs text-right text-[#00FFC6] font-mono font-bold focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-500 font-mono tracking-wider font-bold uppercase">hosts</span>
                  </div>
                  <button
                    onClick={() => handleRemoveSubnetRow(sub.id)}
                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-5 pt-3 border-t border-white/5 flex flex-col sm:flex-row gap-2">
          <button
            onClick={handleCalculatePlanner}
            className="flex-1 py-3.5 bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] text-[#0a0f1e] rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-md hover:shadow-[0_0_20px_rgba(0,212,255,0.35)] cursor-pointer"
          >
            <Calculator className="w-4 h-4 text-[#a0f1e]" /> Compile Subnets
          </button>
          
          {activeProject && isCalculated && (
            <button
              onClick={handleSaveIPPlan}
              disabled={saveStatus === 'saving'}
              className="flex-1 py-3.5 bg-emerald-500/90 hover:bg-emerald-600 border border-emerald-500/30 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transform active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>
                {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved Plan!' : 'Save IP Plan'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Right panel: Tabular calculated outputs */}
      <div className="lg:col-span-7 glass-panel p-5 sm:p-6 rounded-2xl border-white/5 bg-[#121A2E]/10 flex flex-col justify-between min-h-[380px]">
        <div>
          <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#00FFC6]" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">IP Allocation Table</span>
            </div>
            {isCalculated && (
              <span className="px-2.5 py-0.5 rounded-lg bg-[#00FFC6]/10 text-[#00FFC6] text-[9px] font-mono font-bold uppercase border border-[#00FFC6]/15 flex items-center gap-1 select-none">
                <Check className="w-3 h-3 text-[#00FFC6]" /> SYNCHRONIZED
              </span>
            )}
          </div>

          {!isCalculated ? (
            <div className="flex-1 flex flex-col justify-center items-center text-center py-20 bg-[#070b16]/10 rounded-2xl border border-dashed border-white/5">
              <Calculator className="w-12 h-12 text-[#00D4FF]/20 mb-3" />
              <p className="text-[11px] font-bold text-slate-300 uppercase tracking-wider font-mono">No IP ranges computed</p>
              <p className="text-[10px] text-slate-500 max-w-[240px] leading-relaxed mt-1 font-medium">
                Verify input parameters in the left settings panel and compile subnets to map CIDR block allocations.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto select-text">
              <table className="w-full text-left text-xs font-mono text-slate-300">
                <thead>
                  <tr className="border-b border-white/5 text-slate-500 uppercase text-[10px] font-bold font-mono tracking-wider">
                    <th className="pb-3.5 pl-2 font-sans">VLAN TARGET</th>
                    <th className="pb-3.5">NET ADDR</th>
                    <th className="pb-3.5">GATEWAY</th>
                    <th className="pb-3.5">MASK / CIDR</th>
                    <th className="pb-3.5">DHCP RANGE</th>
                    <th className="pb-3.5 text-right pr-2">BROADCAST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {calcResults.map((row) => (
                    <tr key={row.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-4 pl-2 font-sans font-bold text-white max-w-[120px] truncate">
                        <div>
                          <span className="block truncate tracking-wide text-xs">{row.name}</span>
                          <span className="text-[9px] text-slate-500 block font-mono font-medium mt-0.5">Needed: {row.hostsRequested} / Alloc: {row.hostsAllocated}</span>
                        </div>
                      </td>
                      <td className="py-4 text-[#00FFC6] font-bold">{row.networkAddress}</td>
                      <td className="py-4 text-slate-400 font-semibold">{row.gateway}</td>
                      <td className="py-4">
                        <span className="text-white block font-bold text-xs">/{row.cidr}</span>
                        <span className="text-slate-500 text-[9px] block font-semibold">{row.subnetMask}</span>
                      </td>
                      <td className="py-4 text-slate-400 font-semibold text-xs">{row.dhcpRange}</td>
                      <td className="py-4 text-red-400/80 font-bold text-right pr-2">{row.broadcastAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isCalculated && (
          <div className="border-t border-white/5 pt-3.5 mt-5 flex items-start gap-2.5 text-[9.5px] text-slate-500 leading-normal font-sans font-medium">
            <Info className="w-4 h-4 text-[#00D4FF] shrink-0 mt-0.5" />
            <span>VLSM (Variable Length Subnet Masking) orders subnets from largest host requirement to smallest. This isolates broadcast domains dynamically and maximizes address space efficiency.</span>
          </div>
        )}
      </div>

    </div>
  );
}
