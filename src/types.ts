export type DeviceType =
  | 'router'
  | 'switch'
  | 'server'
  | 'firewall'
  | 'internet'
  | 'pc'
  | 'laptop'
  | 'access_point'
  | 'iot';

export type ConnectionType = 'ethernet' | 'fiber' | 'wireless';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  x: number;
  y: number;
  ipAddress?: string;
  subnetMask?: string;
  gateway?: string;
  vlan?: string;
  interfaces?: string[];
  deviceConfig?: string;
}

export interface Connection {
  id: string;
  from: string;
  to: string;
  type: ConnectionType;
  fromPort?: string;
  toPort?: string;
  vlan?: string;
}

export interface Topology {
  devices: Device[];
  connections: Connection[];
}

export interface IPPlanItem {
  id: string;
  name: string; // e.g. "VLAN 10 - Mahasiswa"
  hostsNeeded: number;
  networkAddress: string;
  gateway: string;
  subnetMask: string;
  broadcastAddress: string;
  dhcpRange: string;
  cidr: number;
}

export interface GeneratedConfig {
  mikrotik: string;
  debian: string;
  cisco: string;
  documentation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  topology: Topology;
  ipPlan: IPPlanItem[];
  configs: GeneratedConfig;
  chatHistory: ChatMessage[];
}

export interface TroubleshootResult {
  rootCause: string;
  analysis: string;
  fixes: string[];
  commands: string[];
}
