import React, { useState, useRef, useEffect } from 'react';
import { 
  Router, 
  Layers, 
  Server, 
  ShieldCheck, 
  Globe, 
  Laptop, 
  Radio, 
  Cpu, 
  Trash2, 
  Plus, 
  Settings2, 
  Maximize2, 
  Minimize2, 
  Link, 
  Zap, 
  Check, 
  X,
  Filter
} from 'lucide-react';
import { Device, Connection, DeviceType, ConnectionType } from '../types';

interface TopologyCanvasProps {
  devices: Device[];
  connections: Connection[];
  onUpdateTopology: (devices: Device[], connections: Connection[]) => void;
  readOnly?: boolean;
}

const DEVICE_TEMPLATES = [
  { type: 'internet' as DeviceType, label: 'Internet WAN', icon: Globe, color: 'text-sky-400 border-sky-400/30' },
  { type: 'router' as DeviceType, label: 'Mikrotik Gateway', icon: Router, color: 'text-emerald-400 border-emerald-400/30' },
  { type: 'firewall' as DeviceType, label: 'Next-Gen Firewall', icon: ShieldCheck, color: 'text-red-400 border-red-400/30' },
  { type: 'switch' as DeviceType, label: 'Cisco L2 Switch', icon: Layers, color: 'text-indigo-400 border-indigo-400/30' },
  { type: 'server' as DeviceType, label: 'Debian Server', icon: Server, color: 'text-yellow-400 border-yellow-400/30' },
  { type: 'pc' as DeviceType, label: 'Workstation PC', icon: Laptop, color: 'text-purple-400 border-purple-400/30' },
  { type: 'laptop' as DeviceType, label: 'Mobile Laptop', icon: Laptop, color: 'text-fuchsia-400 border-fuchsia-400/30' },
  { type: 'access_point' as DeviceType, label: 'AP Hotspot', icon: Radio, color: 'text-teal-400 border-teal-400/30' },
  { type: 'iot' as DeviceType, label: 'IoT Smart Node', icon: Cpu, color: 'text-pink-400 border-pink-400/30' },
];

export default function TopologyCanvas({
  devices,
  connections,
  onUpdateTopology,
  readOnly = false
}: TopologyCanvasProps) {
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [linkStartId, setLinkStartId] = useState<string | null>(null);
  const [linkType, setLinkType] = useState<ConnectionType>('ethernet');
  const [vlanFilter, setVlanFilter] = useState<string>('');

  // Zoom and Pan State
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dragging Device State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const dragStartCoords = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const hasDragged = useRef<boolean>(false);
  const mouseDownDevice = useRef<Device | null>(null);

  // Packet animation list
  const [pings, setPings] = useState<{ id: string; fromX: number; fromY: number; toX: number; toY: number; isFailed?: boolean }[]>([]);

  // Wire creation cursor guide coordinates
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Editing parameters for sidebar
  const [editName, setEditName] = useState<string>('');
  const [editIP, setEditIP] = useState<string>('');
  const [editGateway, setEditGateway] = useState<string>('');
  const [editVlan, setEditVlan] = useState<string>('');
  const [editConfig, setEditConfig] = useState<string>('');

  // Traceroute simulator states
  const [sourceNodeId, setSourceNodeId] = useState<string>('');
  const [destNodeId, setDestNodeId] = useState<string>('');
  const [traceLogs, setTraceLogs] = useState<string[]>([]);
  const [isTracing, setIsTracing] = useState<boolean>(false);

  // Reference to outer canvas wrapper
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedDevice) {
      setEditName(selectedDevice.name);
      setEditIP(selectedDevice.ipAddress || '');
      setEditGateway(selectedDevice.gateway || '');
      setEditVlan(selectedDevice.vlan || '');
      setEditConfig(selectedDevice.deviceConfig || '');
    }
  }, [selectedDevice]);

  // Handle addition of template device
  const handleAddDevice = (type: DeviceType) => {
    if (readOnly) return;
    const count = devices.filter((d) => d.type === type).length + 1;
    const labels: Record<DeviceType, string> = {
      internet: 'ISP_Gateway',
      router: `Router_${count}`,
      firewall: `Firewall_${count}`,
      switch: `Switch_${count}`,
      server: `Server_${count}`,
      pc: `PC_${count}`,
      laptop: `Laptop_${count}`,
      access_point: `AP_${count}`,
      iot: `Sensor_${count}`,
    };

    const scrollX = -pan.x + (containerRef.current?.clientWidth || 800) / 2 - 35;
    const scrollY = -pan.y + (containerRef.current?.clientHeight || 500) / 2 - 35;
    const randomOffset = () => Math.floor(Math.random() * 40) - 20;

    const deviceConfigs: Record<DeviceType, string> = {
      internet: `# ISP WAN Edge Interface Configuration\ninterface GigabitEthernet0/0\n description Uplink to ISP\n ip address 103.44.12.1 255.255.255.252\n speed 1000\n duplex full`,
      router: `# MikroTik RouterOS Script\n/interface ethernet\nset [ find default-name=ether1 ] comment="WAN"\nset [ find default-name=ether2 ] comment="LAN"\n\n/ip address\nadd address=192.168.1.1/24 interface=ether2\nadd address=103.44.12.2/30 interface=ether1\n\n/ip firewall nat\nadd action=masquerade chain=srcnat out-interface=ether1`,
      firewall: `! Cisco ASA Firewall Configuration\ninterface GigabitEthernet0/0\n nameif outside\n security-level 0\n ip address dhcp\n!\ninterface GigabitEthernet0/1\n nameif inside\n security-level 100\n ip address 192.168.1.1 255.255.255.0\n!\nnat (inside,outside) source dynamic any interface`,
      switch: `! Cisco IOS Switch VLAN Config\nvlan 10\n name CLIENT_LAN\n!\ninterface range fa0/1 - 24\n switchport mode access\n switchport access vlan 10\n!\ninterface gig0/1\n switchport mode trunk`,
      server: `# Debian Static IP Configuration\n# /etc/network/interfaces\nauto eth0\niface eth0 inet static\n    address 192.168.1.10\n    netmask 255.255.255.0\n    gateway 192.168.1.1\n    dns-nameservers 8.8.8.8`,
      pc: `# Workstation Network Config\nHostname: PC_Client\nIP: 192.168.1.50\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.1.1\nDNS: 8.8.8.8`,
      laptop: `# Laptop Network Config\nHostname: Laptop_Client\nIP: 192.168.1.60\nSubnet Mask: 255.255.255.0\nDefault Gateway: 192.168.1.1\nDNS: 8.8.8.8`,
      access_point: `# Access Point Settings\nSSID: NetMind_AP_Hotspot\nFrequency: 2.4 GHz\nChannel: 6\nSecurity: WPA2-Personal\nPassphrase: netmind123`,
      iot: `// ESP32 Client IoT MQTT Configuration\n#include <WiFi.h>\n#include <PubSubClient.h>\nconst char* ssid = "NetMind_AP_Hotspot";\nconst char* mqttServer = "192.168.1.10";`
    };

    const newDevice: Device = {
      id: `dev_${Date.now()}`,
      name: labels[type],
      type,
      x: Math.max(80, Math.min(1200, scrollX + randomOffset())),
      y: Math.max(80, Math.min(800, scrollY + randomOffset())),
      ipAddress: type === 'internet' ? '103.44.12.1' : type === 'router' ? '192.168.1.1' : '',
      gateway: type === 'router' ? '103.44.12.1' : '',
      deviceConfig: deviceConfigs[type]
    };

    onUpdateTopology([...devices, newDevice], connections);
  };

  // Drag handles
  const handleDeviceMouseDown = (e: React.MouseEvent, device: Device) => {
    if (readOnly) return;
    e.stopPropagation();

    // Prevent dragging unless it is the left mouse button (e.button === 0)
    if (e.button !== 0) return;

    if (isLinking) {
      if (!linkStartId) {
        setLinkStartId(device.id);
        const canvasRect = containerRef.current?.getBoundingClientRect();
        if (canvasRect) {
          const mouseX = (e.clientX - canvasRect.left - pan.x) / zoom;
          const mouseY = (e.clientY - canvasRect.top - pan.y) / zoom;
          setMouseCanvasPos({ x: mouseX, y: mouseY });
        }
      } else if (linkStartId !== device.id) {
        // Create link
        const newConnection: Connection = {
          id: `conn_${Date.now()}`,
          from: linkStartId,
          to: device.id,
          type: linkType
        };
        onUpdateTopology(devices, [...connections, newConnection]);
        setIsLinking(false);
        setLinkStartId(null);
      }
      return;
    }

    mouseDownDevice.current = device;
    setDraggingId(device.id);
    dragStartCoords.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
    
    // Account for zoom AND pan using containerRef explicitly
    const canvasRect = containerRef.current?.getBoundingClientRect();
    if (canvasRect) {
      const mouseX = (e.clientX - canvasRect.left - pan.x) / zoom;
      const mouseY = (e.clientY - canvasRect.top - pan.y) / zoom;
      dragOffset.current = {
        x: mouseX - device.x,
        y: mouseY - device.y,
      };
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    const canvasRect = containerRef.current?.getBoundingClientRect();
    if (!canvasRect) return;

    const mouseX = (e.clientX - canvasRect.left - pan.x) / zoom;
    const mouseY = (e.clientY - canvasRect.top - pan.y) / zoom;

    if (draggingId) {
      // Check if user has moved the mouse beyond a minor threshold of 4 pixels to distinguish from a simple click
      const distance = Math.hypot(e.clientX - dragStartCoords.current.x, e.clientY - dragStartCoords.current.y);
      if (distance > 4) {
        hasDragged.current = true;
      }

      if (hasDragged.current) {
        const snapGrid = (val: number) => Math.round(val / 20) * 20;
        const updated = devices.map((d) => {
          if (d.id === draggingId) {
            return {
              ...d,
              x: snapGrid(mouseX - dragOffset.current.x),
              y: snapGrid(mouseY - dragOffset.current.y),
            };
          }
          return d;
        });
        onUpdateTopology(updated, connections);
      }
    } else if (isPanning) {
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y,
      });
    } else if (isLinking && linkStartId) {
      setMouseCanvasPos({ x: mouseX, y: mouseY });
    }
  };

  const handleCanvasMouseUp = () => {
    // If the mouse was released without dragging, treat as a single click to open IP config settings
    if (draggingId && !hasDragged.current && mouseDownDevice.current) {
      setSelectedDevice(mouseDownDevice.current);
    }
    setDraggingId(null);
    mouseDownDevice.current = null;
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const targetTagName = target.tagName.toLowerCase();
    const targetId = target.id;

    // Allow panning if clicking on background grid, connection lines, or SVG canvas wrapper
    if (
      e.target === e.currentTarget || 
      targetId === 'grid-pattern' || 
      targetTagName === 'svg' || 
      targetTagName === 'line' ||
      targetTagName === 'rect'
    ) {
      setIsPanning(true);
      panStart.current = {
        x: e.clientX - pan.x,
        y: e.clientY - pan.y,
      };
      setSelectedDevice(null);
    }
  };

  // Remove Device
  const handleDeleteDevice = (id: string) => {
    if (readOnly) return;
    const filteredDevices = devices.filter((d) => d.id !== id);
    const filteredConns = connections.filter((c) => c.from !== id && c.to !== id);
    onUpdateTopology(filteredDevices, filteredConns);
    setSelectedDevice(null);
  };

  // Remove Connection
  const handleDeleteConnection = (connId: string) => {
    if (readOnly) return;
    const filteredConns = connections.filter((c) => c.id !== connId);
    onUpdateTopology(devices, filteredConns);
  };

  // Save selected device settings
  const handleSaveDeviceEdit = () => {
    if (!selectedDevice || readOnly) return;
    const updated = devices.map((d) => {
      if (d.id === selectedDevice.id) {
        return {
          ...d,
          name: editName,
          ipAddress: editIP || undefined,
          gateway: editGateway || undefined,
          vlan: editVlan || undefined,
          deviceConfig: editConfig || undefined
        };
      }
      return d;
    });
    onUpdateTopology(updated, connections);
    setSelectedDevice(null);
  };

  // Auto Layout
  const handleAutoLayout = () => {
    if (readOnly) return;

    const depths: Record<string, number> = {};
    devices.forEach((d) => {
      if (d.type === 'internet') depths[d.id] = 0;
      else if (d.type === 'firewall') depths[d.id] = 1;
      else if (d.type === 'router') depths[d.id] = 2;
      else if (d.type === 'switch') depths[d.id] = 3;
      else if (d.type === 'server') depths[d.id] = 4;
      else depths[d.id] = 5; 
    });

    const layers: Record<number, string[]> = {};
    Object.entries(depths).forEach(([id, depth]) => {
      if (!layers[depth]) layers[depth] = [];
      layers[depth].push(id);
    });

    const canvasWidth = 800;
    const updatedDevices = devices.map((d) => {
      const depth = depths[d.id] ?? 3;
      const layerNodes = layers[depth] || [d.id];
      const idx = layerNodes.indexOf(d.id);
      const layerCount = layerNodes.length;
      const spacingX = canvasWidth / (layerCount + 1);
      
      return {
        ...d,
        x: Math.round(spacingX * (idx + 1)),
        y: 80 + depth * 100
      };
    });

    onUpdateTopology(updatedDevices, connections);
  };

  // Trigger traceroute animation via BFS pathfinding sequentially
  const handleSimulatePathPing = () => {
    if (!sourceNodeId || !destNodeId) return;
    
    // Clear previous animations and logs
    setPings([]);
    setTraceLogs([]);
    setIsTracing(true);

    const sourceNode = devices.find(d => d.id === sourceNodeId);
    const destNode = devices.find(d => d.id === destNodeId);
    if (!sourceNode || !destNode) {
      setIsTracing(false);
      return;
    }

    // Helper: Extract /24 subnet prefix (e.g. "192.168.10" from "192.168.10.5")
    const getSubnetPrefix = (ip?: string) => {
      if (!ip) return '';
      const parts = ip.split('.');
      if (parts.length >= 3) {
        return parts.slice(0, 3).join('.');
      }
      return ip;
    };

    // Adjacency list representation for BFS physical pathfinding
    const adj: Record<string, string[]> = {};
    devices.forEach((d) => {
      adj[d.id] = [];
    });
    connections.forEach((c) => {
      if (adj[c.from] && adj[c.to]) {
        adj[c.from].push(c.to);
        adj[c.to].push(c.from);
      }
    });

    const queue: string[][] = [[sourceNodeId]];
    const visited = new Set<string>([sourceNodeId]);
    let path: string[] | null = null;

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      const lastNode = currentPath[currentPath.length - 1];

      if (lastNode === destNodeId) {
        path = currentPath;
        break;
      }

      const neighbors = adj[lastNode] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push([...currentPath, neighbor]);
        }
      }
    }

    if (!path) {
      setTraceLogs([
        `traceroute to ${destNode.name} (${destNode.ipAddress || 'unknown'}), 30 hops max`,
        ` 1  * * *`,
        ` 2  Destination host unreachable. No physical link path found in current topology.`
      ]);
      setIsTracing(false);
      return;
    }

    const pathNodes = path.map(id => devices.find(d => d.id === id)!);

    // LOGICAL NETWORK VERIFICATION ENGINE
    const validatePath = () => {
      // 1. IP existence checks on end nodes
      if (!sourceNode.ipAddress) {
        return { success: false, failIndex: 0, errorLog: `Packet dropped at source. ${sourceNode.name} has no IP address configured.` };
      }
      if (!destNode.ipAddress) {
        return { success: false, failIndex: pathNodes.length - 1, errorLog: `Packet dropped. Destination host ${destNode.name} has no IP address.` };
      }

      const sourceSubnet = getSubnetPrefix(sourceNode.ipAddress);
      const destSubnet = getSubnetPrefix(destNode.ipAddress);
      const isDifferentSubnet = sourceSubnet !== destSubnet;

      // 2. If they are in different subnets, check Gateways & Routers
      if (isDifferentSubnet) {
        if (!sourceNode.gateway) {
          return { success: false, failIndex: 0, errorLog: `Packet dropped. ${sourceNode.name} has no Default Gateway configured to reach subnet ${destSubnet}.0/24.` };
        }
        if (!destNode.gateway) {
          return { success: false, failIndex: pathNodes.length - 1, errorLog: `Request timed out. Destination host ${destNode.name} has no Default Gateway configured to route replies.` };
        }

        // Verify there is a Layer 3 device (router/firewall) in the traversed path
        const hasLayer3InPath = pathNodes.some(n => n.type === 'router' || n.type === 'firewall');
        if (!hasLayer3InPath) {
          return { success: false, failIndex: 1, errorLog: `Packet dropped. Node ${pathNodes[1]?.name || 'next-hop'} is a switch layer. No router found to traverse from ${sourceSubnet}.0 to ${destSubnet}.0.` };
        }

        // Verify that the configured gateway on the source matches a router's IP in the topology
        const sourceGatewayExists = devices.some(d => d.ipAddress === sourceNode.gateway && (d.type === 'router' || d.type === 'firewall'));
        if (!sourceGatewayExists) {
          return { success: false, failIndex: 0, errorLog: `Packet dropped. Default Gateway IP ${sourceNode.gateway} configured on ${sourceNode.name} does not exist or is unreachable in the network.` };
        }

        // Verify that the configured gateway on the destination matches a router's IP in the topology
        const destGatewayExists = devices.some(d => d.ipAddress === destNode.gateway && (d.type === 'router' || d.type === 'firewall'));
        if (!destGatewayExists) {
          return { success: false, failIndex: pathNodes.length - 1, errorLog: `Request timed out. Destination default gateway ${destNode.gateway} is offline or unreachable.` };
        }
      }

      // 3. VLAN Mismatch & Switch Tagging constraints
      for (let i = 0; i < pathNodes.length - 1; i++) {
        const nodeA = pathNodes[i];
        const nodeB = pathNodes[i + 1];

        // If direct client-to-client link or direct client-to-switch link, check VLAN tags
        if (nodeA.vlan && nodeB.vlan && nodeA.vlan !== nodeB.vlan) {
          // If neither is a router/firewall (which does inter-VLAN routing), they are isolated
          const isL3Hop = nodeA.type === 'router' || nodeA.type === 'firewall' || nodeB.type === 'router' || nodeB.type === 'firewall';
          if (!isL3Hop) {
            return { success: false, failIndex: i + 1, errorLog: `Packet dropped due to VLAN collision. Host ${nodeA.name} is on ${nodeA.vlan} but next hop ${nodeB.name} is configured on ${nodeB.vlan}.` };
          }
        }
      }

      return { success: true, failIndex: -1, errorLog: '' };
    };

    const validation = validatePath();

    // Start sequential path animation
    setTraceLogs([
      `traceroute to ${destNode.name} (${destNode.ipAddress || 'unknown'}), 30 hops max`,
      `resolving path routing hops...`
    ]);

    const stepDelay = 800; // ms per hop
    pathNodes.forEach((node, index) => {
      if (index === 0) return; // skip source node for segment drawing

      // Stop scheduling animations after the failing hop index
      if (validation.failIndex !== -1 && index > validation.failIndex) {
        return;
      }

      setTimeout(() => {
        const prevNode = pathNodes[index - 1];
        const isFailingHop = (validation.failIndex !== -1 && index === validation.failIndex);

        // Add single-segment ping animation
        const segmentPing = {
          id: `ping_${Date.now()}_${index}`,
          fromX: prevNode.x,
          fromY: prevNode.y,
          toX: node.x,
          toY: node.y,
          isFailed: isFailingHop
        };
        
        setPings([segmentPing]);

        if (isFailingHop) {
          // Print packet drop details in trace log
          setTraceLogs(prev => [
            ...prev,
            ` ${index}  ${node.name} (${node.ipAddress || 'unknown'})  * * *`,
            `Request timed out. Packet dropped: ${validation.errorLog}`
          ]);
          setTimeout(() => {
            setPings([]);
            setIsTracing(false);
          }, stepDelay);
        } else {
          // Print successful hop details
          const ms = (5 + Math.random() * 12).toFixed(3);
          const ttl = 64 - index;
          setTraceLogs(prev => [
            ...prev,
            ` ${index}  ${node.name} (${node.ipAddress || '10.0.' + index + '.1'})  ${ms} ms  ttl=${ttl}`
          ]);

          if (index === pathNodes.length - 1) {
            // Finished successfully!
            setTimeout(() => {
              setPings([]);
              setTraceLogs(prev => [...prev, `traceroute complete. 0% packet loss.`]);
              setIsTracing(false);
            }, stepDelay);
          }
        }
      }, (index - 1) * stepDelay);
    });
  };

  const getDeviceIcon = (type: DeviceType) => {
    const map: Record<DeviceType, any> = {
      internet: Globe,
      router: Router,
      firewall: ShieldCheck,
      switch: Layers,
      server: Server,
      pc: Laptop,
      laptop: Laptop,
      access_point: Radio,
      iot: Cpu,
    };
    return map[type] || Router;
  };

  return (
    <div id="canvas-view-container" className="flex h-full w-full bg-[#070b16] border border-white/5 rounded-2xl overflow-hidden relative">
      
      {/* Visual Canvas Toolbox */}
      {!readOnly && (
        <div className="w-64 bg-[#0a0f1e]/80 backdrop-blur-md border-r border-white/5 p-4 flex flex-col justify-between z-10 select-none overflow-y-auto">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-[#00D4FF]" />
              <span className="text-[10px] font-bold text-white tracking-wider uppercase font-mono">Node Palette</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-5">
              {DEVICE_TEMPLATES.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAddDevice(item.type)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 bg-[#070b16] hover:border-[#00D4FF]/30 text-center text-[9px] text-slate-400 hover:text-white transition-all group cursor-pointer shadow-sm"
                >
                  <item.icon className="w-5 h-5 mb-1 text-slate-500 group-hover:text-[#00D4FF] group-hover:scale-105 transition-all" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="border-t border-white/5 pt-4">
              <div className="flex items-center justify-between mb-3 text-[10px] font-bold text-white uppercase tracking-wider font-mono">
                <span>Link Creator</span>
                <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono ${isLinking ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'}`}>
                  {isLinking ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
              
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    setIsLinking(!isLinking);
                    setLinkStartId(null);
                  }}
                  className={`w-full py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    isLinking 
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 glow-primary' 
                      : 'bg-[#070b16] border-white/5 text-slate-300 hover:border-[#00D4FF]/30 hover:bg-[#121A2E]/30'
                  }`}
                >
                  <Link className="w-3.5 h-3.5" />
                  {isLinking ? 'Select Target Node' : 'Wire Devices'}
                </button>

                {isLinking && (
                  <div className="grid grid-cols-3 gap-1 mt-1 bg-[#070b16] p-1 rounded-xl border border-white/5">
                    {(['ethernet', 'fiber', 'wireless'] as ConnectionType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setLinkType(type)}
                        className={`py-1 rounded text-[8px] uppercase tracking-wider font-mono font-bold transition-all cursor-pointer ${
                          linkType === type ? 'bg-[#00D4FF] text-[#0A0F1E]' : 'text-slate-400 hover:text-white hover:bg-[#121A2E]/50'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 space-y-3">
            <button
              onClick={handleAutoLayout}
              className="w-full py-2.5 bg-[#121A2E]/50 hover:bg-[#1e2d4d]/50 border border-white/5 hover:border-white/15 rounded-xl text-xs font-bold uppercase tracking-wider text-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Maximize2 className="w-3.5 h-3.5 text-[#00FFC6]" />
              Auto Layout
            </button>
            
            <div className="border-t border-white/5 pt-3 space-y-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-[#00D4FF]" />
                <span className="text-[10px] font-bold text-white tracking-wider uppercase font-mono">Traceroute Run</span>
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="text-[8px] text-slate-500 font-mono block mb-1 uppercase tracking-wider font-bold">Source Device:</label>
                  <select
                    value={sourceNodeId}
                    onChange={(e) => setSourceNodeId(e.target.value)}
                    className="w-full bg-[#070b16] border border-white/5 text-[10px] text-[#00D4FF] focus:outline-none cursor-pointer rounded-lg p-2 font-mono font-semibold"
                  >
                    <option value="">-- Choose Source --</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0a0f1e] text-white">
                        {d.name} {d.ipAddress ? `(${d.ipAddress})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[8px] text-slate-500 font-mono block mb-1 uppercase tracking-wider font-bold">Destination Device:</label>
                  <select
                    value={destNodeId}
                    onChange={(e) => setDestNodeId(e.target.value)}
                    className="w-full bg-[#070b16] border border-white/5 text-[10px] text-[#00D4FF] focus:outline-none cursor-pointer rounded-lg p-2 font-mono font-semibold"
                  >
                    <option value="">-- Choose Destination --</option>
                    {devices.map((d) => (
                      <option key={d.id} value={d.id} className="bg-[#0a0f1e] text-white">
                        {d.name} {d.ipAddress ? `(${d.ipAddress})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                onClick={handleSimulatePathPing}
                disabled={!sourceNodeId || !destNodeId || isTracing}
                className="w-full py-2.5 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border border-[#00D4FF]/30 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-bold uppercase tracking-wider text-white transition-all flex items-center justify-center gap-2 cursor-pointer glow-primary"
              >
                <Zap className="w-4 h-4 text-[#00FFC6] animate-pulse" />
                {isTracing ? 'Tracing Hop...' : 'Run Traceroute'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Canvas Node Grid Stage */}
      <div 
        ref={containerRef}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseDown={handleCanvasMouseDown}
        className="flex-1 h-full relative overflow-hidden cursor-grab active:cursor-grabbing"
      >
        {/* Absolute topbar indicators & VLAN Filter */}
        <div className="absolute top-4 left-4 z-10 flex gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-[#0a0f1e]/85 backdrop-blur-sm border border-white/5 text-[9px] font-bold font-mono text-slate-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00D4FF] shadow-[0_0_6px_#00D4FF]" />
            <span>Devices: {devices.length}</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-[#0a0f1e]/85 backdrop-blur-sm border border-white/5 text-[9px] font-bold font-mono text-slate-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FFC6] shadow-[0_0_6px_#00FFC6]" />
            <span>Links: {connections.length}</span>
          </div>
          
          {/* VLAN Filter Selector Dropdown */}
          <div className="px-2.5 py-1 rounded-lg bg-[#0a0f1e]/85 backdrop-blur-sm border border-[#00D4FF]/25 text-[9px] font-bold font-mono text-slate-300 flex items-center gap-1.5 shadow-sm">
            <Filter className="w-3 h-3 text-[#00D4FF]" />
            <span className="text-slate-500 uppercase tracking-wider text-[8px] font-bold">VLAN:</span>
            <select
              value={vlanFilter}
              onChange={(e) => setVlanFilter(e.target.value)}
              className="bg-[#070b16] border border-white/5 text-[9px] font-bold text-[#00D4FF] focus:outline-none cursor-pointer rounded px-1.5 py-0.5"
            >
              <option value="">All subnets</option>
              {Array.from(new Set(devices.map(d => d.vlan).filter(Boolean))).map(vlan => (
                <option key={vlan} value={vlan}>{vlan}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Zoom controller */}
        <div className="absolute bottom-4 right-4 z-10 flex items-center gap-2 bg-[#0a0f1e]/85 backdrop-blur-sm border border-white/5 px-3 py-2 rounded-xl text-[9px] text-[#A0AEC0] select-none font-mono">
          <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="hover:text-white p-1 cursor-pointer">
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(Math.min(1.8, zoom + 0.1))} className="hover:text-white p-1 cursor-pointer">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <span className="text-slate-700">|</span>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="hover:text-white text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border border-white/10 bg-[#070b16] cursor-pointer">
            Reset
          </button>
        </div>

        {/* Dynamic Canvas Container */}
        <div 
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
          className="absolute inset-0 h-[2000px] w-[2000px] pointer-events-none"
        >
          {/* SVG Connector Layer */}
          <svg className="absolute inset-0 h-full w-full pointer-events-auto">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#121a2e" strokeWidth="1" />
              </pattern>
              
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#00D4FF" />
              </marker>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" id="grid-pattern" className="opacity-45" />

            {/* Link Connections Lines */}
            {connections.map((conn) => {
              const fromDev = devices.find((d) => d.id === conn.from);
              const toDev = devices.find((d) => d.id === conn.to);
              
              if (!fromDev || !toDev) return null;

              const isFiber = conn.type === 'fiber';
              const isWireless = conn.type === 'wireless';
              const isVlanMatch = vlanFilter && (fromDev.vlan === vlanFilter || toDev.vlan === vlanFilter);
              
              // Dim lines that do not match the active filter
              const isConnectionDimmed = vlanFilter && !isVlanMatch;

              return (
                <g key={conn.id} className="group" style={{ opacity: isConnectionDimmed ? 0.15 : 0.75 }}>
                  <line
                    x1={fromDev.x + 35}
                    y1={fromDev.y + 35}
                    x2={toDev.x + 35}
                    y2={toDev.y + 35}
                    stroke={
                      isWireless 
                        ? '#ec4899' 
                        : isFiber 
                        ? '#00FFC6' 
                        : isVlanMatch 
                        ? '#00D4FF' 
                        : '#3b82f6'
                    }
                    strokeWidth={isFiber ? 2.5 : isWireless ? 1.5 : 2}
                    className={`transition-all duration-300 group-hover:stroke-cyan-300 ${isFiber ? 'conn-line-active' : ''}`}
                  />
                  {/* Clickable zone for line delete */}
                  {!readOnly && (
                    <circle
                      cx={(fromDev.x + toDev.x) / 2 + 35}
                      cy={(fromDev.y + toDev.y) / 2 + 35}
                      r="12"
                      fill="#070b16"
                      stroke="#ef4444"
                      strokeWidth="1.5"
                      className="opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDeleteConnection(conn.id); }}
                    />
                  )}
                  {/* Visual Trash icon on link hover */}
                  {!readOnly && (
                    <text
                      x={(fromDev.x + toDev.x) / 2 + 35}
                      y={(fromDev.y + toDev.y) / 2 + 35}
                      fill="#ef4444"
                      fontSize="9"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="opacity-0 group-hover:opacity-100 pointer-events-none select-none font-mono"
                    >
                      ✕
                    </text>
                  )}
                  
                  {/* Optional VLAN Text Label */}
                  {conn.vlan && (
                    <text
                      x={(fromDev.x + toDev.x) / 2 + 40}
                      y={(fromDev.y + toDev.y) / 2 + 25}
                      fill="#00D4FF"
                      fontSize="8"
                      fontWeight="bold"
                      className="bg-[#070b16]/90 px-1 py-0.5 rounded pointer-events-none font-mono"
                    >
                      {conn.vlan}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Glowing Traceroute simulated ping packet animation */}
            {pings.map((ping) => (
              <circle
                key={ping.id}
                r="6"
                fill={ping.isFailed ? "#FF4B4B" : "#00FFC6"}
                style={{
                  animation: 'pingTravel 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite'
                }}
              >
                <animate attributeName="cx" from={ping.fromX + 35} to={ping.toX + 35} dur="0.8s" repeatCount="indefinite" />
                <animate attributeName="cy" from={ping.fromY + 35} to={ping.toY + 35} dur="0.8s" repeatCount="indefinite" />
              </circle>
            ))}

            {/* Live Link wire creator guidance line */}
            {isLinking && linkStartId && (
              (() => {
                const startDev = devices.find(d => d.id === linkStartId);
                if (!startDev) return null;
                return (
                  <line
                    x1={startDev.x + 35}
                    y1={startDev.y + 35}
                    x2={mouseCanvasPos.x}
                    y2={mouseCanvasPos.y}
                    stroke="#00D4FF"
                    strokeWidth="1.5"
                    className="wire-guide-pulse"
                  />
                );
              })()
            )}
          </svg>

          {/* HTML Devices node elements Layer */}
          <div className="absolute inset-0 pointer-events-none">
            {devices.map((device) => {
              const isSelected = selectedDevice?.id === device.id;
              const DeviceIcon = getDeviceIcon(device.type);

              // Dim nodes that do not match active VLAN (exempt core switches/gateways)
              const isDimmed = vlanFilter && device.vlan !== vlanFilter && 
                               !['internet', 'router', 'firewall', 'switch'].includes(device.type);

              return (
                <div
                  key={device.id}
                  onMouseDown={(e) => handleDeviceMouseDown(e, device)}
                  style={{
                    left: device.x,
                    top: device.y,
                  }}
                  className={`absolute pointer-events-auto w-[70px] h-[70px] rounded-2xl border flex flex-col items-center justify-center select-none bg-[#0a0f1e]/95 cursor-grab active:cursor-grabbing transition-all duration-300 ${
                    isDimmed ? 'opacity-30 grayscale' : 'opacity-100'
                  } ${
                    isSelected 
                      ? 'border-[#00D4FF] shadow-[0_0_20px_rgba(0,212,255,0.45)] scale-105 bg-[#121A2E]' 
                      : 'border-white/5 hover:border-[#00D4FF]/40 hover:shadow-[0_0_12px_rgba(0,212,255,0.15)]'
                  }`}
                >
                  <div className="relative">
                    <DeviceIcon className={`w-6 h-6 transition-colors duration-300 ${
                      device.type === 'internet' 
                        ? 'text-sky-400' 
                        : device.type === 'router' 
                        ? 'text-emerald-400' 
                        : device.type === 'firewall' 
                        ? 'text-red-400'
                        : device.type === 'switch' 
                        ? 'text-indigo-400'
                        : device.type === 'server' 
                        ? 'text-yellow-400'
                        : 'text-[#A0AEC0]'
                    }`} />
                    {device.vlan && (
                      <span className="absolute -top-3.5 -right-3.5 text-[6.5px] font-bold px-1.5 py-0.2 bg-purple-500/10 text-purple-300 rounded border border-purple-500/20 font-mono shadow-sm">
                        {device.vlan}
                      </span>
                    )}
                  </div>
                  
                  <span className="text-[9px] font-bold text-white tracking-wide mt-1.5 max-w-[62px] truncate text-center leading-none font-sans">
                    {device.name}
                  </span>
                  
                  {device.ipAddress && (
                    <span className="text-[7.5px] font-mono text-slate-500 mt-0.5 truncate max-w-[64px] font-semibold">
                      {device.ipAddress}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Routing Trace Log Console Overlay */}
        {traceLogs.length > 0 && (
          <div className="absolute bottom-4 left-4 z-20 w-80 bg-[#0a0f1e]/95 backdrop-blur-md border border-[#00D4FF]/25 rounded-xl p-4 shadow-[0_15px_35px_rgba(0,0,0,0.7)] font-mono text-[9.5px] text-[#00FFC6] max-h-[160px] overflow-y-auto space-y-1 select-text border-l-4 border-l-[#00D4FF] glow-primary">
            <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
              <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00FFC6] animate-pulse" />
                Traceroute Diagnostics
              </span>
              <button 
                onClick={() => setTraceLogs([])} 
                className="text-slate-500 hover:text-white transition-colors cursor-pointer text-[10px] font-bold"
              >
                CLEAR
              </button>
            </div>
            {traceLogs.map((log, i) => (
              <div key={i} className="leading-relaxed pl-1 py-0.5">
                {log}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selected Node Inspector Sidebar */}
      {selectedDevice && (
        <div className="w-72 bg-[#0a0f1e]/85 backdrop-blur-md border-l border-white/5 p-5 flex flex-col justify-between z-10 select-none overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-[#00D4FF]" />
                <span className="text-[10px] font-bold text-white uppercase tracking-wider font-mono">Device Config</span>
              </div>
              <button onClick={() => setSelectedDevice(null)} className="text-slate-400 hover:text-white cursor-pointer transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1 uppercase tracking-wider font-bold">DEVICE ALIAS</label>
                <input
                  type="text"
                  value={editName}
                  disabled={readOnly}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#070b16] border border-white/5 focus:border-[#00D4FF]/40 rounded-lg p-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1 uppercase tracking-wider font-bold">IP ADDRESS</label>
                <input
                  type="text"
                  value={editIP}
                  disabled={readOnly}
                  placeholder="e.g. 192.168.10.5"
                  onChange={(e) => setEditIP(e.target.value)}
                  className="w-full bg-[#070b16] border border-white/5 focus:border-[#00D4FF]/40 rounded-lg p-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1 uppercase tracking-wider font-bold">GATEWAY IP</label>
                <input
                  type="text"
                  value={editGateway}
                  disabled={readOnly}
                  placeholder="e.g. 192.168.10.1"
                  onChange={(e) => setEditGateway(e.target.value)}
                  className="w-full bg-[#070b16] border border-white/5 focus:border-[#00D4FF]/40 rounded-lg p-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-400 font-mono block mb-1 uppercase tracking-wider font-bold">VLAN BINDING</label>
                <input
                  type="text"
                  value={editVlan}
                  disabled={readOnly}
                  placeholder="e.g. VLAN-10"
                  onChange={(e) => setEditVlan(e.target.value)}
                  className="w-full bg-[#070b16] border border-white/5 focus:border-[#00D4FF]/40 rounded-lg p-2.5 text-xs text-white focus:outline-none font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-slate-400 font-mono block uppercase tracking-wider font-bold">RUNNING CONFIG</label>
                  <button 
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(editConfig).catch(() => {});
                    }}
                    className="text-[8px] font-mono text-[#00D4FF] hover:text-[#00FFC6] font-bold uppercase transition-colors"
                  >
                    Copy CLI
                  </button>
                </div>
                <textarea
                  rows={5}
                  value={editConfig}
                  disabled={readOnly}
                  placeholder="# Device startup script..."
                  onChange={(e) => setEditConfig(e.target.value)}
                  className="w-full bg-[#050811] border border-white/5 focus:border-[#00D4FF]/40 rounded-lg p-2 text-[10px] text-[#00FFC6] focus:outline-none font-mono h-28 resize-none font-medium leading-relaxed"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/5 pt-4 flex gap-2">
            {!readOnly && (
              <button
                onClick={() => handleDeleteDevice(selectedDevice.id)}
                className="flex-1 py-2.5 bg-red-950/20 hover:bg-red-900/25 border border-red-900/40 rounded-xl text-[10px] font-bold uppercase tracking-wider text-red-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}

            <button
              onClick={handleSaveDeviceEdit}
              className="flex-1 py-2.5 bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] hover:brightness-105 text-[#0A0F1E] rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              Commit
            </button>
          </div>
        </div>
      )}

      {/* Visual Keyframes animation injection */}
      <style>{`
        @keyframes pingTravel {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0.1;
            transform: scale(0.6);
          }
        }
      `}</style>
    </div>
  );
}
