import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { 
  Network, 
  Bell,
  Mail,
  Lock,
  UserPlus,
  LogIn,
  Database,
  Server,
  Settings,
  Plus
} from 'lucide-react';
import { Project, Device, Connection, IPPlanItem, GeneratedConfig } from './types';

// Component imports
import LandingPage from './components/LandingPage';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import AIGeneratorView from './components/AIGeneratorView';
import IPPlannerView from './components/IPPlannerView';
import TroubleshooterView from './components/TroubleshooterView';
import TemplatesView from './components/TemplatesView';
import SettingsView from './components/SettingsView';

export default function App() {
  const [path, setPath] = useState<string>(() => window.location.pathname);

  const [currentView, setCurrentView] = useState<string>(() => {
    const hasEmail = localStorage.getItem('netmind_user_email') !== null;
    const isProjPath = window.location.pathname.startsWith('/project');
    if (isProjPath && hasEmail) return 'dashboard';
    return hasEmail ? 'dashboard' : 'landing';
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('netmind_user_email') !== null;
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    return localStorage.getItem('netmind_user_email') || '';
  });

  // Sync state with back/forward history navigation
  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateTo = (newPath: string) => {
    window.history.pushState({}, '', newPath);
    setPath(newPath);
  };

  const isWorkspacePath = path.startsWith('/project');

  useEffect(() => {
    if (isWorkspacePath) {
      if (!isLoggedIn) {
        navigateTo('/');
      } else if (currentView === 'landing' || currentView === 'login' || currentView === 'register') {
        setCurrentView('dashboard');
      }
    } else {
      if (currentView !== 'landing' && currentView !== 'login' && currentView !== 'register') {
        setCurrentView('landing');
      }
    }
  }, [path, isLoggedIn, currentView]);

  // Login form parameters (starts empty for user credentials input)
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Load projects from API on mount matching owner
  const fetchProjects = async (emailToUse?: string) => {
    const activeEmail = emailToUse || userEmail;
    if (!activeEmail) return;

    try {
      const res = await fetch('/api/projects', {
        headers: {
          'x-user-email': activeEmail
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProjects(data);
        setActiveProject(prev => {
          if (prev === null && data.length > 0) {
            return data[0];
          }
          if (prev) {
            const updated = data.find((p: Project) => p.id === prev.id);
            return updated || (data.length > 0 ? data[0] : null);
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
    }
  };

  useEffect(() => {
    if (isLoggedIn && userEmail) {
      fetchProjects(userEmail);
    }
  }, [isLoggedIn, userEmail]);

  // Save/Update project on server
  const handleSaveProject = async (updatedProj: Project) => {
    if (!userEmail) return;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify(updatedProj)
      });
      if (res.ok) {
        const data = await res.json();
        setActiveProject(data);
        fetchProjects(); // refresh list
      }
    } catch (err) {
      console.error('Error saving project:', err);
    }
  };

  // Create new blank project
  const handleCreateNewProject = async () => {
    if (!userEmail) return;
    const blankProj = {
      name: `New Topology ${projects.length + 1}`,
      description: 'Custom network topology described on visual editor canvas.',
      topology: { devices: [], connections: [] },
      ipPlan: [],
      configs: { mikrotik: '', debian: '', cisco: '', documentation: '' },
      chatHistory: []
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify(blankProj)
      });
      if (res.ok) {
        const data = await res.json();
        setActiveProject(data);
        await fetchProjects(); // Refresh full list instead of manual append
        setCurrentView('ai_generator'); // Open AI generator directly!
      }
    } catch (err) {
      console.error('Error creating new project:', err);
    }
  };

  // Duplicate Project
  const handleDuplicateProject = async (id: string) => {
    if (!userEmail) return;
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, {
        method: 'POST',
        headers: {
          'x-user-email': userEmail
        }
      });
      if (res.ok) {
        fetchProjects();
      }
    } catch (err) {
      console.error('Error duplicating project:', err);
    }
  };

  // Delete Project
  const handleDeleteProject = async (id: string) => {
    if (!userEmail) return;
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'x-user-email': userEmail
        }
      });
      if (res.ok) {
        if (activeProject?.id === id) {
          setActiveProject(null);
        }
        fetchProjects();
      }
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  // Load prebuilt template as active workspace
  const handleSelectTemplate = async (templateId: string) => {
    let templateName = 'Enterprise HQ';
    let templateDesc = 'Campus topology with inter-VLAN configurations.';
    let initialDevices: Device[] = [];
    let initialConnections: Connection[] = [];
    let initialIpPlan: IPPlanItem[] = [];
    let initialConfigs: GeneratedConfig = { mikrotik: '', debian: '', cisco: '', documentation: '' };

    if (templateId === 'tpl_campus') {
      templateName = 'Unila Campus Network';
      templateDesc = 'Enterprise campus template with 3 subnets, local DHCP server, and Cisco Core distribution trunks.';
      initialDevices = [
        { id: 'd1', name: 'ISP_WAN', type: 'internet', x: 450, y: 70, ipAddress: '103.44.12.1', deviceConfig: '# ISP Edge WAN Interface\ninterface gig0/0\n description Uplink to provider\n ip address 103.44.12.2 255.255.255.252' },
        { id: 'd2', name: 'Gateway_Mikrotik', type: 'router', x: 450, y: 160, ipAddress: '192.168.1.1', gateway: '103.44.12.1', deviceConfig: '# MikroTik core router setup\n/interface vlan\nadd interface=ether2 name=vlan10 vlan-id=10\nadd interface=ether2 name=vlan20 vlan-id=20\nadd interface=ether2 name=vlan30 vlan-id=30\n/ip address\nadd address=192.168.1.1/24 interface=ether2\nadd address=192.168.10.1/26 interface=vlan10\nadd address=192.168.20.1/24 interface=vlan20\nadd address=192.168.30.1/24 interface=vlan30' },
        { id: 'd3', name: 'Core_Switch', type: 'switch', x: 450, y: 260, deviceConfig: '! Cisco IOS Core Distribution Switch\nvlan 10\n name STAFF_VLAN\nvlan 20\n name STUDENT_HOTSPOT\nvlan 30\n name MGMT_SERVERS\n!\ninterface FastEthernet0/1\n switchport mode access\n switchport access vlan 30\n!\ninterface FastEthernet0/2\n switchport mode trunk\n switchport trunk allowed vlan 10,20,30' },
        { id: 'd4', name: 'Server_DHCP', type: 'server', x: 250, y: 260, ipAddress: '192.168.1.10', vlan: 'Management', deviceConfig: '# Debian Static IP Configuration\n# /etc/network/interfaces\nauto eth0\niface eth0 inet static\n    address 192.168.1.10\n    netmask 255.255.255.0\n    gateway 192.168.1.1\n    dns-nameservers 8.8.8.8' },
        { id: 'd5', name: 'Staff_Switch', type: 'switch', x: 450, y: 370, vlan: 'VLAN-10', deviceConfig: '! Cisco Access Layer Switch\nvlan 10\n name STAFF\n!\ninterface range FastEthernet0/1 - 24\n switchport mode access\n switchport access vlan 10' },
        { id: 'd6', name: 'PC_Staff_1', type: 'pc', x: 400, y: 480, ipAddress: '192.168.10.21', gateway: '192.168.10.1', vlan: 'VLAN-10', deviceConfig: '# PC Network configuration\nIP Address: 192.168.10.21\nSubnet Mask: 255.255.255.192\nDefault Gateway: 192.168.10.1\nDNS: 192.168.1.10' },
        { id: 'd7', name: 'PC_Staff_2', type: 'pc', x: 500, y: 480, ipAddress: '192.168.10.22', gateway: '192.168.10.1', vlan: 'VLAN-10', deviceConfig: '# PC Network configuration\nIP Address: 192.168.10.22\nSubnet Mask: 255.255.255.192\nDefault Gateway: 192.168.10.1\nDNS: 192.168.1.10' }
      ];
      initialConnections = [
        { id: 'c1', from: 'd1', to: 'd2', type: 'fiber' },
        { id: 'c2', from: 'd2', to: 'd3', type: 'ethernet' },
        { id: 'c3', from: 'd3', to: 'd4', type: 'ethernet' },
        { id: 'c4', from: 'd3', to: 'd5', type: 'ethernet' },
        { id: 'c5', from: 'd5', to: 'd6', type: 'ethernet' },
        { id: 'c6', from: 'd5', to: 'd7', type: 'ethernet' }
      ];
      initialIpPlan = [
        { id: 'ip_1', name: 'VLAN 10 - Staff and Admin', hostsNeeded: 50, networkAddress: '192.168.10.0', gateway: '192.168.10.1', subnetMask: '255.255.255.192', broadcastAddress: '192.168.10.63', dhcpRange: '192.168.10.10 - 60', cidr: 26 },
        { id: 'ip_2', name: 'VLAN 20 - Student Hotspot', hostsNeeded: 200, networkAddress: '192.168.20.0', gateway: '192.168.20.1', subnetMask: '255.255.255.0', broadcastAddress: '192.168.20.255', dhcpRange: '192.168.20.10 - 250', cidr: 24 }
      ];
      initialConfigs = {
        mikrotik: `/interface vlan\nadd interface=ether2 name=vlan10 vlan-id=10\nadd interface=ether2 name=vlan20 vlan-id=20\n\n/ip address\nadd address=192.168.10.1/26 interface=vlan10\nadd address=192.168.20.1/24 interface=vlan20`,
        cisco: `vlan 10\n name STAFF\nvlan 20\n name STUDENTS\n!\ninterface FastEthernet0/1\n switchport mode access\n switchport access vlan 10`,
        debian: `# /etc/network/interfaces\nauto eth0\niface eth0 inet static\n    address 192.168.1.10\n    netmask 255.255.255.0`,
        documentation: `# Unila Campus Template\nDeploy staff subnets, configure IP helper address points, and check Cisco trunks.`
      };
    } else if (templateId === 'tpl_datacenter') {
      templateName = 'Spine-Leaf Rack DMZ';
      templateDesc = 'Nexus Spine Leaf design carrying ASA security endpoints and localized SQL clusters.';
      initialDevices = [
        { id: 'dc1', name: 'WAN_Router', type: 'router', x: 450, y: 70, ipAddress: '103.8.4.1', deviceConfig: '# WAN Router config\ninterface gig0/0\n ip address 103.8.4.1 255.255.255.252' },
        { id: 'dc2', name: 'Firewall_ASA', type: 'firewall', x: 450, y: 160, deviceConfig: '! Cisco ASA Firewall configuration\ninterface GigabitEthernet0/0\n nameif outside\n security-level 0\n ip address 103.8.4.2 255.255.255.252\n!\ninterface GigabitEthernet0/1\n nameif inside\n security-level 100\n ip address 10.0.10.1 255.255.255.0' },
        { id: 'dc3', name: 'SpineSwitch_1', type: 'switch', x: 300, y: 260, deviceConfig: '! Spine Switch 1 Fabric Configuration\nvlan 10\n name Core_Spine_Leaf\ninterface range gig0/1 - 12\n switchport mode trunk' },
        { id: 'dc4', name: 'SpineSwitch_2', type: 'switch', x: 600, y: 260, deviceConfig: '! Spine Switch 2 Fabric Configuration\nvlan 10\n name Core_Spine_Leaf\ninterface range gig0/1 - 12\n switchport mode trunk' },
        { id: 'dc5', name: 'LeafSwitch_Rack1', type: 'switch', x: 200, y: 370, deviceConfig: '! Cisco Leaf Access Switch\nvlan 10\n name DB_BACKEND\nvlan 20\n name DMZ_WEB\n!\ninterface FastEthernet0/1\n switchport mode access\n switchport access vlan 10\ninterface FastEthernet0/2\n switchport mode access\n switchport access vlan 20' },
        { id: 'dc6', name: 'Postgres_DB_Node1', type: 'server', x: 150, y: 480, ipAddress: '10.0.10.5', deviceConfig: '# PostgreSQL static interface\nauto eth0\niface eth0 inet static\n    address 10.0.10.5\n    netmask 255.255.255.192\n    gateway 10.0.10.1' },
        { id: 'dc7', name: 'Web_Server_A', type: 'server', x: 250, y: 480, ipAddress: '10.0.20.10', deviceConfig: '# Apache Web server static interface\nauto eth0\niface eth0 inet static\n    address 10.0.20.10\n    netmask 255.255.255.224\n    gateway 10.0.20.1' }
      ];
      initialConnections = [
        { id: 'c_dc1', from: 'dc1', to: 'dc2', type: 'fiber' },
        { id: 'c_dc2', from: 'dc2', to: 'dc3', type: 'fiber' },
        { id: 'c_dc3', from: 'dc2', to: 'dc4', type: 'fiber' },
        { id: 'c_dc4', from: 'dc3', to: 'dc5', type: 'fiber' },
        { id: 'c_dc5', from: 'dc4', to: 'dc5', type: 'fiber' },
        { id: 'c_dc6', from: 'dc5', to: 'dc6', type: 'ethernet' },
        { id: 'c_dc7', from: 'dc5', to: 'dc7', type: 'ethernet' }
      ];
      initialIpPlan = [
        { id: 'ip_dc1', name: 'DMZ Public Web', hostsNeeded: 30, networkAddress: '10.0.20.0', gateway: '10.0.20.1', subnetMask: '255.255.255.224', broadcastAddress: '10.0.20.31', dhcpRange: 'Static only', cidr: 27 },
        { id: 'ip_dc2', name: 'Database Backend SAN', hostsNeeded: 60, networkAddress: '10.0.10.0', gateway: '10.0.10.1', subnetMask: '255.255.255.192', broadcastAddress: '10.0.10.63', dhcpRange: 'Static only', cidr: 26 }
      ];
      initialConfigs = {
        mikrotik: `# OSPF Core Setup\n/routing ospf instance\nset [ find default=yes ] router-id=10.0.10.1`,
        cisco: `! Cisco ASA Rules\naccess-list dmz_inbound permit tcp any host 10.0.20.10 eq 80`,
        debian: `# Postgres DB static NIC\nauto eth0\niface eth0 inet static\n    address 10.0.10.5`,
        documentation: `# Datacenter Rack Design\nNon-blocking Spine Leaf routing with Cisco ASA DMZ permission lists.`
      };
    } else if (templateId === 'tpl_bgp') {
      templateName = 'ISP BGP Core Edge Ring';
      templateDesc = 'Carrier-grade dual-homed ISP routing with BGP peering and OSPF backbone convergence.';
      initialDevices = [
        { id: 'bgp1', name: 'ISP_A_Upstream', type: 'internet', x: 250, y: 70, ipAddress: '103.44.1.1', deviceConfig: '# ISP A core router BGP config\n/routing bgp instance\nset default as=64512' },
        { id: 'bgp2', name: 'ISP_B_Upstream', type: 'internet', x: 650, y: 70, ipAddress: '202.10.5.1', deviceConfig: '# ISP B core router BGP config\n/routing bgp instance\nset default as=64513' },
        { id: 'bgp3', name: 'Edge_Router_1', type: 'router', x: 250, y: 180, ipAddress: '10.0.0.1', gateway: '103.44.1.1', deviceConfig: '# Edge Router 1 BGP config\n/routing bgp instance\nset default as=65001 router-id=10.0.0.1\n/routing bgp peer\nadd name=peer_isp_a remote-address=103.44.1.1 remote-as=64512' },
        { id: 'bgp4', name: 'Edge_Router_2', type: 'router', x: 650, y: 180, ipAddress: '10.0.0.2', gateway: '202.10.5.1', deviceConfig: '# Edge Router 2 BGP config\n/routing bgp instance\nset default as=65001 router-id=10.0.0.2\n/routing bgp peer\nadd name=peer_isp_b remote-address=202.10.5.1 remote-as=64513' },
        { id: 'bgp5', name: 'Core_OSPF_Router', type: 'router', x: 450, y: 280, ipAddress: '10.0.1.1', deviceConfig: '# Interior Backbone Router\n/routing ospf instance\nset [ find default=yes ] router-id=10.0.1.1\n/routing ospf network\nadd area=backbone network=10.0.1.0/29' },
        { id: 'bgp6', name: 'Distribution_Switch', type: 'switch', x: 450, y: 380, deviceConfig: '! Cisco Distribution trunk switch\nvlan 100\n name CUSTOMER_A\nvlan 200\n name CUSTOMER_B\ninterface range gig0/1 - 12\n switchport mode trunk' },
        { id: 'bgp7', name: 'Customer_LAN_A', type: 'switch', x: 300, y: 480, vlan: 'VLAN-100', deviceConfig: '! Customer switch A access layer\nvlan 100\n name CUST_A\ninterface range fa0/1 - 24\n switchport mode access\n switchport access vlan 100' },
        { id: 'bgp8', name: 'Customer_LAN_B', type: 'switch', x: 600, y: 480, vlan: 'VLAN-200', deviceConfig: '! Customer switch B access layer\nvlan 200\n name CUST_B\ninterface range fa0/1 - 24\n switchport mode access\n switchport access vlan 200' }
      ];
      initialConnections = [
        { id: 'c_bgp1', from: 'bgp1', to: 'bgp3', type: 'fiber' },
        { id: 'c_bgp2', from: 'bgp2', to: 'bgp4', type: 'fiber' },
        { id: 'c_bgp3', from: 'bgp3', to: 'bgp5', type: 'fiber' },
        { id: 'c_bgp4', from: 'bgp4', to: 'bgp5', type: 'fiber' },
        { id: 'c_bgp5', from: 'bgp3', to: 'bgp4', type: 'fiber' },
        { id: 'c_bgp6', from: 'bgp5', to: 'bgp6', type: 'ethernet' },
        { id: 'c_bgp7', from: 'bgp6', to: 'bgp7', type: 'ethernet' },
        { id: 'c_bgp8', from: 'bgp6', to: 'bgp8', type: 'ethernet' }
      ];
      initialIpPlan = [
        { id: 'ip_bgp1', name: 'VLAN 100 - Customer A', hostsNeeded: 120, networkAddress: '10.10.100.0', gateway: '10.10.100.1', subnetMask: '255.255.255.128', broadcastAddress: '10.10.100.127', dhcpRange: '10.10.100.10 - 10.10.100.126', cidr: 25 },
        { id: 'ip_bgp2', name: 'VLAN 200 - Customer B', hostsNeeded: 60, networkAddress: '10.10.200.0', gateway: '10.10.200.1', subnetMask: '255.255.255.192', broadcastAddress: '10.10.200.63', dhcpRange: '10.10.200.10 - 10.10.200.62', cidr: 26 },
        { id: 'ip_bgp3', name: 'Core Transit Link', hostsNeeded: 2, networkAddress: '10.0.0.0', gateway: '10.0.0.1', subnetMask: '255.255.255.252', broadcastAddress: '10.0.0.3', dhcpRange: 'Static Only', cidr: 30 },
        { id: 'ip_bgp4', name: 'OSPF Backbone', hostsNeeded: 4, networkAddress: '10.0.1.0', gateway: '10.0.1.1', subnetMask: '255.255.255.248', broadcastAddress: '10.0.1.7', dhcpRange: 'Static Only', cidr: 29 }
      ];
      initialConfigs = {
        mikrotik: `# BGP Peering to ISP A\n/routing bgp instance\nset default as=65001 router-id=10.0.0.1\n/routing bgp peer\nadd name=ISP_A remote-address=103.44.1.1 remote-as=64512 ttl=default\nadd name=ISP_B remote-address=202.10.5.1 remote-as=64513 ttl=default\n\n# OSPF Interior\n/routing ospf instance\nset [ find default=yes ] router-id=10.0.0.1\n/routing ospf network\nadd area=backbone network=10.0.1.0/29`,
        cisco: `! Core OSPF Configuration\nrouter ospf 100\n network 10.0.1.0 0.0.0.7 area 0\n network 10.10.100.0 0.0.0.127 area 0\n network 10.10.200.0 0.0.0.63 area 0\n!\ninterface GigabitEthernet0/0\n description Link to Edge_Router_1\n ip address 10.0.1.2 255.255.255.248`,
        debian: `# Static route config for monitoring node\nauto eth0\niface eth0 inet static\n    address 10.0.1.5\n    netmask 255.255.255.248\n    gateway 10.0.1.1\n    dns-nameservers 8.8.8.8 1.1.1.1`,
        documentation: `# ISP BGP Core Edge Design\n\n## Architecture\nDual-homed BGP peering with two upstream ISPs for redundancy. Interior OSPF backbone ensures convergence between edge routers and core distribution layer.\n\n## Routing Policy\n- AS 65001 (Private) peers with AS 64512 (ISP A) and AS 64513 (ISP B)\n- Full table from ISP A, default route from ISP B\n- OSPF Area 0 for internal transit`
      };
    } else {
      // Default IoT template
      templateName = 'Smart IoT Farm';
      templateDesc = 'Moisture triggers, sensor grids and isolated wireless triggers.';
      initialDevices = [
        { id: 'iot1', name: 'ISP_Gateway', type: 'internet', x: 450, y: 70, ipAddress: '36.12.1.1', deviceConfig: '# Edge ISP fiber link\ninterface eth0\n ip address 36.12.1.2 255.255.255.252' },
        { id: 'iot2', name: 'Pi_Edge_Broker', type: 'server', x: 450, y: 180, ipAddress: '192.168.1.10', deviceConfig: '# MQTT Mosquitto Raspberry Pi\nauto eth0\niface eth0 inet static\n    address 192.168.1.10\n    netmask 255.255.255.224\n    gateway 192.168.1.1' },
        { id: 'iot3', name: 'AP_Foliage', type: 'access_point', x: 450, y: 280, deviceConfig: '# Access Point Broadcast\nSSID: Smart_Farm\nFrequency: 2.4 GHz\nSecurity: WPA2-Personal' },
        { id: 'iot4', name: 'Sensor_Soil_1', type: 'iot', x: 300, y: 400, ipAddress: '192.168.1.51', deviceConfig: '// ESP32 Soil Sensor\n#include <WiFi.h>\nconst char* ssid = "Smart_Farm";\nconst char* mqttServer = "192.168.1.10";' },
        { id: 'iot5', name: 'Valves_Spray_1', type: 'iot', x: 600, y: 400, ipAddress: '192.168.1.102', deviceConfig: '// ESP32 Spray Actuator\n#include <WiFi.h>\nconst char* ssid = "Smart_Farm";\nconst char* mqttServer = "192.168.1.10";' }
      ];
      initialConnections = [
        { id: 'c_iot1', from: 'iot1', to: 'iot2', type: 'fiber' },
        { id: 'c_iot2', from: 'iot2', to: 'iot3', type: 'ethernet' },
        { id: 'c_iot3', from: 'iot3', to: 'iot4', type: 'wireless' },
        { id: 'c_iot4', from: 'iot3', to: 'iot5', type: 'wireless' }
      ];
      initialIpPlan = [
        { id: 'ip_iot1', name: 'Sensor subnetwork', hostsNeeded: 30, networkAddress: '192.168.1.0', gateway: '192.168.1.1', subnetMask: '255.255.255.224', broadcastAddress: '192.168.1.31', dhcpRange: '192.168.1.5-25', cidr: 27 }
      ];
      initialConfigs = {
        mikrotik: `# Hotspot SSID rules\n/interface wireless\nset ssid="Smart_Farm" disabled=no`,
        cisco: `! Simple bridge Layer 2\ninterface range fa0/1 - 10\n switchport mode access`,
        debian: `# Mosquito MQTT broker config\nlistener 1883\nallow_anonymous true`,
        documentation: `# Smart Farm IoT\nFoliage AP links low energy ESP32 moist monitors dynamically.`
      };
    }

    const templateProj = {
      name: templateName,
      description: templateDesc,
      topology: { devices: initialDevices, connections: initialConnections },
      ipPlan: initialIpPlan,
      configs: initialConfigs,
      chatHistory: [
        { id: 'msg1', role: 'user', content: `Instantiate prebuilt template: ${templateName}`, timestamp: new Date().toLocaleTimeString() },
        { id: 'msg2', role: 'assistant', content: `Saya telah memuat blueprint ${templateName}. Anda sekarang dapat melakukan modifikasi drag-and-drop atau generate config baru.`, timestamp: new Date().toLocaleTimeString() }
      ]
    };

    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-user-email': userEmail
        },
        body: JSON.stringify(templateProj)
      });
      if (res.ok) {
        const data = await res.json();
        setActiveProject(data);
        await fetchProjects(); // Refresh full list instead of manual append
        setCurrentView('ai_generator'); // Open editor directly
      }
    } catch (err) {
      console.error('Error loading template project:', err);
    }
  };

  // Login & register handlers
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!loginEmail || !loginPassword) return;

    try {
      const endpoint = currentView === 'login' ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }
      
      localStorage.setItem('netmind_user_email', data.email);
      setIsLoggedIn(true);
      setUserEmail(data.email);
      navigateTo('/project');
      setCurrentView('dashboard');
      setLoginEmail('');
      setLoginPassword('');
    } catch (err) {
      console.error('Authentication process failed:', err);
      setAuthError('Connection error or backend server is offline.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('netmind_user_email');
    setIsLoggedIn(false);
    setUserEmail('');
    setProjects([]);
    setActiveProject(null);
    navigateTo('/');
    setCurrentView('landing');
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-white flex flex-col font-sans">
      
      {/* Landing view completely overrides dashboard layout */}
      {currentView === 'landing' && (
        <LandingPage 
          onStartFree={() => {
            if (isLoggedIn) {
              navigateTo('/project');
            } else {
              setCurrentView('register');
            }
          }}
          onNavigate={(view) => {
            setAuthError(null);
            setCurrentView(view);
          }}
        />
      )}

      {/* Login & Register Views */}
      {(currentView === 'login' || currentView === 'register') && (
        <div className="min-h-screen flex items-center justify-center bg-[#070b16] relative px-4 overflow-hidden">
          {/* Ambient Glow Orbs */}
          <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-[#00d4ff]/10 rounded-full blur-[130px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-[#00ffc6]/10 rounded-full blur-[130px] pointer-events-none" />
          
          {/* Tech Grid Pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#121a2e_1px,transparent_1px),linear-gradient(to_bottom,#121a2e_1px,transparent_1px)] bg-[size:24px_24px] opacity-25 pointer-events-none" />

          <div className="w-full max-w-md glass-panel p-8 sm:p-10 rounded-3xl relative shadow-[0_25px_60px_rgba(0,0,0,0.5)] border-white/5 glow-primary transition-all">
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#00D4FF] to-[#00FFC6] flex items-center justify-center p-[2px] shadow-[0_0_25px_rgba(0,212,255,0.25)] mb-4">
                <div className="w-full h-full bg-[#0A0F1E] rounded-[14px] flex items-center justify-center">
                  <Network className="w-7 h-7 text-[#00D4FF]" />
                </div>
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight text-gradient-cyan">
                {currentView === 'login' ? 'NetMind AI Gateway' : 'Operator Registration'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-1 text-center font-medium">Model and deploy enterprise infrastructures instantly.</p>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-2.5 rounded-xl mb-5 text-center font-medium font-sans">
                {authError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="text-[9px] text-slate-400 font-mono block mb-1.5 uppercase tracking-wider font-bold">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    className="w-full bg-[#070b16]/80 border border-white/5 hover:border-[#00D4FF]/30 focus:border-[#00D4FF] rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none placeholder-slate-600 transition-colors shadow-inner font-sans font-medium"
                    placeholder="name@company.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] text-slate-400 font-mono block mb-1.5 uppercase tracking-wider font-bold">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="w-full bg-[#070b16]/80 border border-white/5 hover:border-[#00D4FF]/30 focus:border-[#00D4FF] rounded-xl pl-11 pr-4 py-3 text-xs text-white focus:outline-none placeholder-slate-600 transition-colors shadow-inner font-sans font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] text-[#0A0F1E] hover:shadow-[0_0_25px_rgba(0,212,255,0.45)] font-extrabold rounded-xl text-xs flex items-center justify-center gap-2 transform active:scale-95 hover:brightness-105 transition-all mt-8 cursor-pointer uppercase tracking-wider"
              >
                {currentView === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {currentView === 'login' ? 'Launch Workspace' : 'Create Operator Profile'}
              </button>
            </form>

            <div className="text-center mt-8 text-xs text-slate-500 border-t border-white/5 pt-4">
              {currentView === 'login' ? (
                <span>New operator? <button onClick={() => setCurrentView('register')} className="text-[#00D4FF] hover:text-[#00FFC6] hover:underline font-bold transition-colors">Register here</button></span>
              ) : (
                <span>Already have profile? <button onClick={() => setCurrentView('login')} className="text-[#00D4FF] hover:text-[#00FFC6] hover:underline font-bold transition-colors">Log in here</button></span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main SaaS Workspace Application */}
      {currentView !== 'landing' && currentView !== 'login' && currentView !== 'register' && (
        <div className="flex h-screen overflow-hidden">
          
          {/* Side rail Navigation panel */}
          <Sidebar 
            currentView={currentView}
            onNavigate={(view) => setCurrentView(view)}
            userEmail={userEmail}
            onLogout={handleLogout}
          />

          {/* Core Content frame */}
          <div className="flex-1 flex flex-col overflow-hidden bg-[#0A0F1E]">
            {/* Topbar panel banner */}
            <header className="h-14 border-b border-white/5 bg-[#0a0f1e]/60 backdrop-blur-md px-6 flex items-center justify-between z-10 select-none">
              
              {/* Conditional Page Header Left Side */}
              {currentView === 'dashboard' && (
                <div className="flex items-center gap-3">
                  <Database className="w-4 h-4 text-[#00D4FF]" />
                  <div>
                    <span className="font-extrabold text-[11px] tracking-wider text-white uppercase font-mono block leading-none">Operations Dashboard</span>
                    <span className="text-[7.5px] text-slate-500 font-mono tracking-wider font-bold block mt-1.5 uppercase">Manage project portfolios</span>
                  </div>
                </div>
              )}

              {currentView === 'templates' && (
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-[#00D4FF]" />
                  <div>
                    <span className="font-extrabold text-[11px] tracking-wider text-white uppercase font-mono block leading-none">Blueprints Library</span>
                    <span className="text-[7.5px] text-slate-500 font-mono tracking-wider font-bold block mt-1.5 uppercase">Reference network templates</span>
                  </div>
                </div>
              )}

              {currentView === 'settings' && (
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4 text-[#00D4FF]" />
                  <div>
                    <span className="font-extrabold text-[11px] tracking-wider text-white uppercase font-mono block leading-none">System Settings</span>
                    <span className="text-[7.5px] text-slate-500 font-mono tracking-wider font-bold block mt-1.5 uppercase">Configure secrets and snapping</span>
                  </div>
                </div>
              )}

              {(currentView === 'ai_generator' || currentView === 'ip_planner' || currentView === 'troubleshooter') && (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="opacity-50 uppercase text-[9px] tracking-widest font-bold text-slate-400 font-mono">Project Domain:</span>
                    <select
                      value={activeProject?.id || ''}
                      onChange={(e) => {
                        const found = projects.find((p) => p.id === e.target.value);
                        if (found) setActiveProject(found);
                      }}
                      className="bg-[#121A2E]/80 border border-white/5 hover:border-white/15 text-[10px] font-bold uppercase tracking-wider rounded-lg px-3 py-1.5 text-[#00D4FF] focus:outline-none focus:border-[#00D4FF] cursor-pointer transition-colors shadow-sm"
                    >
                      {projects.map((p) => (
                        <option key={p.id} value={p.id} className="bg-[#0A0F1E] text-white">{p.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="hidden md:flex px-2.5 py-1 bg-[#00FFC6]/10 text-[#00FFC6] text-[8px] rounded-full border border-[#00FFC6]/15 font-bold uppercase tracking-wider select-none font-mono">
                    {currentView === 'ai_generator' ? 'Visual Canvas' : currentView === 'ip_planner' ? 'CIDR Subnets' : 'Outage Diagnosis'}
                  </div>
                </div>
              )}

              {/* Topbar Right Side Controls */}
              <div className="flex items-center gap-3">
                <div className="px-2.5 py-1.5 text-[8px] font-bold uppercase tracking-wider font-mono text-slate-400 bg-[#121a2e]/55 rounded-lg border border-white/5 flex items-center gap-1.5 select-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00FFC6] animate-pulse shadow-[0_0_8px_#00FFC6]" />
                  <span>Ingress: Online</span>
                </div>
                <button className="p-2 rounded-lg border border-white/5 bg-[#121a2e]/55 text-slate-400 hover:text-white hover:border-white/15 transition-all relative cursor-pointer">
                  <Bell className="w-3.5 h-3.5" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-400" />
                </button>
              </div>
            </header>

            {/* Main scrollable body viewport (dynamic padding based on editor view) */}
            <main className={`flex-1 overflow-y-auto ${currentView === 'ai_generator' ? 'p-0' : 'p-6 md:p-8'}`}>
              
              {currentView === 'dashboard' && (
                <DashboardView 
                  projects={projects}
                  onSelectProject={(id) => {
                    const found = projects.find((p) => p.id === id);
                    if (found) {
                      setActiveProject(found);
                      setCurrentView('ai_generator');
                    }
                  }}
                  onNewProject={handleCreateNewProject}
                  onDuplicateProject={handleDuplicateProject}
                  onDeleteProject={handleDeleteProject}
                />
              )}

              {(currentView === 'ai_generator' || currentView === 'ip_planner' || currentView === 'troubleshooter') && !activeProject ? (
                <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 glass-panel rounded-2xl border border-white/5 bg-[#121A2E]/10 m-6">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl animate-pulse"></div>
                    <Network className="w-16 h-16 text-[#00D4FF] relative z-10 animate-bounce duration-[3000ms]" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">No Active Project Detected</h3>
                  <p className="text-slate-400 max-w-md mb-6 text-sm">
                    You need to create a project first to use the AI Generator, IP Planner, or Troubleshooter. Let's set up your first workspace!
                  </p>
                  <button
                    onClick={handleCreateNewProject}
                    className="px-6 py-3.5 bg-gradient-to-r from-[#00D4FF] to-[#00FFC6] text-[#0a0f1e] rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transform active:scale-95 transition-all shadow-md hover:shadow-[0_0_25px_rgba(0,212,255,0.4)] cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-[#0a0f1e]" /> Create Your First Project
                  </button>
                </div>
              ) : (
                <>
                  {currentView === 'ai_generator' && activeProject && (
                    <AIGeneratorView 
                      activeProject={activeProject}
                      onSaveProject={handleSaveProject}
                      onRefreshProjectsList={fetchProjects}
                    />
                  )}

                  {currentView === 'ip_planner' && (
                    <IPPlannerView 
                      activeProject={activeProject}
                      onSaveProject={handleSaveProject}
                    />
                  )}

                  {currentView === 'troubleshooter' && (
                    <TroubleshooterView 
                      activeProject={activeProject}
                    />
                  )}
                </>
              )}

              {currentView === 'templates' && (
                <TemplatesView onSelectTemplate={handleSelectTemplate} />
              )}

              {currentView === 'settings' && (
                <SettingsView userEmail={userEmail} />
              )}

            </main>
          </div>

        </div>
      )}

    </div>
  );
}
