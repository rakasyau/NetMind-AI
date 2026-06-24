import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { MongoClient, Collection } from 'mongodb';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const aiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (aiKey && aiKey !== 'MY_GEMINI_API_KEY') {
  ai = new GoogleGenAI({
    apiKey: aiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
  console.log('Gemini API Client initialized successfully.');
} else {
  console.log('Gemini API Key missing or default placeholder found. Using smart local generator.');
}

// Helper function to call generateContent with retry and fallback model for robustness against high demand/503 errors
async function generateContentWithRetry(aiInstance: GoogleGenAI, params: any) {
  const primaryModel = params.model || 'gemini-2.5-flash';
  try {
    console.log(`[Gemini API] Querying primary model: ${primaryModel}...`);
    return await aiInstance.models.generateContent(params);
  } catch (err: any) {
    console.warn(`[Gemini API] Primary model ${primaryModel} failed. Details:`, err.message || err);
    
    const isTransient = err.status === 503 || 
                        err.status === 429 ||
                        (err.message && (
                          err.message.includes('503') || 
                          err.message.includes('429') ||
                          err.message.toLowerCase().includes('demand') || 
                          err.message.toLowerCase().includes('unavailable') ||
                          err.message.toLowerCase().includes('rate limit')
                        ));
    
    if (isTransient) {
      console.log('[Gemini API] Detected transient high-demand/rate-limit error. Waiting 1500ms before attempting fallback...');
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    const fallbackModel = 'gemini-2.0-flash';
    if (primaryModel !== fallbackModel) {
      try {
        console.log(`[Gemini API] Attempting generation with fallback model: ${fallbackModel}...`);
        const fallbackParams = {
          ...params,
          model: fallbackModel
        };
        return await aiInstance.models.generateContent(fallbackParams);
      } catch (fallbackErr: any) {
        console.error(`[Gemini API] Fallback model ${fallbackModel} also failed:`, fallbackErr.message || fallbackErr);
        throw fallbackErr;
      }
    } else {
      throw err;
    }
  }
}

// Local Database File (used as fallback)
const PROJECTS_FILE = path.join(process.cwd(), 'projects.json');
const USERS_FILE = path.join(process.cwd(), 'users.json');

// Initialize MongoDB Client
const mongoUri = process.env.MONGODB_URI;
let mongoClient: MongoClient | null = null;
let mongoCollection: Collection | null = null;
let mongoUsersCollection: Collection | null = null;

if (mongoUri) {
  try {
    mongoClient = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 4000
    });
    console.log('MongoDB Client initialized successfully.');
  } catch (err: any) {
    console.error('Failed to initialize MongoDB client:', err.message || err);
  }
} else {
  console.log('MONGODB_URI not found. Using local JSON file storage.');
}

// Database schema initialization (migration/index creation)
async function initDatabase() {
  if (!mongoClient) return;
  try {
    console.log('Connecting to MongoDB database...');
    await mongoClient.connect();
    const db = mongoClient.db('netmind_db');
    mongoCollection = db.collection('projects');
    mongoUsersCollection = db.collection('users');
    
    // Create unique index on project id to guarantee unique constraints
    await mongoCollection.createIndex({ id: 1 }, { unique: true });
    // Create unique index on user email
    await mongoUsersCollection.createIndex({ email: 1 }, { unique: true });
    
    console.log('MongoDB initialized successfully (projects and users collection indexes verified).');
  } catch (err: any) {
    console.error('WARNING: Failed to connect to MongoDB database. Falling back to local file storage:', err.message || err);
    mongoClient = null;
    mongoCollection = null;
    mongoUsersCollection = null;
  }
}

// Helper to find user by email
async function findUserByEmail(email: string): Promise<any | null> {
  if (mongoUsersCollection) {
    try {
      return await mongoUsersCollection.findOne({ email });
    } catch (err: any) {
      console.error('Error finding user in MongoDB:', err.message || err);
    }
  }
  try {
    if (fs.existsSync(USERS_FILE)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
      return users.find((u: any) => u.email === email) || null;
    }
  } catch (err) {
    console.error('Error reading users from file:', err);
  }
  return null;
}

// Helper to save user
async function saveUser(user: any): Promise<void> {
  if (mongoUsersCollection) {
    try {
      await mongoUsersCollection.updateOne(
        { email: user.email },
        { $set: user },
        { upsert: true }
      );
      return;
    } catch (err: any) {
      console.error('Error saving user to MongoDB:', err.message || err);
    }
  }
  try {
    let users: any[] = [];
    if (fs.existsSync(USERS_FILE)) {
      users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
    const idx = users.findIndex((u: any) => u.email === user.email);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving user to file:', err);
  }
}

// Helper to read all projects
async function getAllProjects(ownerEmail?: string): Promise<any[]> {
  if (mongoCollection) {
    try {
      const query = ownerEmail ? { owner: ownerEmail } : {};
      const docs = await mongoCollection.find(query).sort({ updatedAt: -1 }).toArray();
      return docs.map(doc => {
        // Strip _id to keep identical shape to the React UI
        const { _id, ...project } = doc;
        return project;
      });
    } catch (err: any) {
      console.error('Error reading projects from MongoDB, falling back to file:', err.message || err);
    }
  }
  
  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
      const projects = JSON.parse(data);
      if (ownerEmail) {
        return projects.filter((p: any) => p.owner === ownerEmail);
      }
      return projects;
    }
  } catch (err) {
    console.error('Error reading projects from file:', err);
  }
  return [];
}

// Helper to save a single project
async function saveProject(project: any): Promise<void> {
  if (mongoCollection) {
    try {
      const cleanProject = {
        id: project.id,
        owner: project.owner || '',
        name: project.name,
        description: project.description || '',
        createdAt: project.createdAt || new Date().toISOString(),
        updatedAt: project.updatedAt || new Date().toISOString(),
        topology: project.topology || { devices: [], connections: [] },
        ipPlan: project.ipPlan || [],
        configs: project.configs || { mikrotik: '', debian: '', cisco: '', documentation: '' },
        chatHistory: project.chatHistory || []
      };
      
      await mongoCollection.updateOne(
        { id: project.id },
        { $set: cleanProject },
        { upsert: true }
      );
      return;
    } catch (err: any) {
      console.error('Error saving project to MongoDB, falling back to file:', err.message || err);
    }
  }

  try {
    let projects: any[] = [];
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
      projects = JSON.parse(data);
    }
    const idx = projects.findIndex(p => p.id === project.id);
    if (idx >= 0) {
      projects[idx] = project;
    } else {
      projects.push(project);
    }
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving project to file:', err);
  }
}

// Helper to delete a project
async function removeProject(id: string): Promise<boolean> {
  if (mongoCollection) {
    try {
      const res = await mongoCollection.deleteOne({ id });
      return (res.deletedCount ?? 0) > 0;
    } catch (err: any) {
      console.error('Error deleting project from MongoDB, falling back to file:', err.message || err);
    }
  }

  try {
    if (fs.existsSync(PROJECTS_FILE)) {
      const data = fs.readFileSync(PROJECTS_FILE, 'utf-8');
      const projects = JSON.parse(data);
      const filtered = projects.filter((p: any) => p.id !== id);
      if (filtered.length === projects.length) {
        // Project ID was not found in the array
        return false;
      }
      fs.writeFileSync(PROJECTS_FILE, JSON.stringify(filtered, null, 2), 'utf-8');
      return true;
    }
  } catch (err) {
    console.error('Error deleting project from file:', err);
  }
  return false;
}

// Seed mock projects if database is empty
async function seedIfEmpty() {
  // Empty as requested to prevent seeding example projects at start
}

// ----------------- PASSWORD HASHING -----------------

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const usedSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, usedSalt, 64).toString('hex');
  return { hash, salt: usedSalt };
}

function verifyPassword(password: string, storedHash: string, storedSalt: string): boolean {
  const { hash } = hashPassword(password, storedSalt);
  return hash === storedHash;
}

// ----------------- API ROUTES -----------------

// Health check endpoint (no auth required) — used by Docker healthcheck
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Authentication: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({ error: 'Email is already registered' });
    }
    const { hash, salt } = hashPassword(password);
    const newUser = {
      email,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: new Date().toISOString()
    };
    await saveUser(newUser);
    res.json({ success: true, email });
  } catch (err) {
    console.error('Route error POST /api/auth/register:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Authentication: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Support both legacy plaintext and new hashed passwords
    let isValid = false;
    if (user.passwordHash && user.passwordSalt) {
      isValid = verifyPassword(password, user.passwordHash, user.passwordSalt);
    } else if (user.password) {
      // Legacy plaintext migration: verify and upgrade to hashed
      isValid = user.password === password;
      if (isValid) {
        const { hash, salt } = hashPassword(password);
        user.passwordHash = hash;
        user.passwordSalt = salt;
        delete user.password;
        await saveUser(user);
        console.log(`[Auth] Migrated plaintext password to hash for user: ${email}`);
      }
    }
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    res.json({ success: true, email });
  } catch (err) {
    console.error('Route error POST /api/auth/login:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 1. Get all projects
app.get('/api/projects', async (req, res) => {
  try {
    const ownerEmail = req.headers['x-user-email'] as string;
    if (!ownerEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const projects = await getAllProjects(ownerEmail);
    res.json(projects);
  } catch (err) {
    console.error('Route error GET /api/projects:', err);
    res.status(500).json({ error: 'Failed to retrieve projects' });
  }
});

// 2. Create or update project
app.post('/api/projects', async (req, res) => {
  try {
    const ownerEmail = req.headers['x-user-email'] as string;
    if (!ownerEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { id, name, description, topology, ipPlan, configs, chatHistory } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projects = await getAllProjects(ownerEmail);
    const existingProject = projects.find((p) => p.id === id);
    const now = new Date().toISOString();

    const projectData = {
      id: id || `proj_${Date.now()}`,
      owner: ownerEmail,
      name,
      description: description || 'No description provided.',
      createdAt: existingProject ? existingProject.createdAt : now,
      updatedAt: now,
      topology: topology || { devices: [], connections: [] },
      ipPlan: ipPlan || [],
      configs: configs || { mikrotik: '', debian: '', cisco: '', documentation: '' },
      chatHistory: chatHistory || []
    };

    await saveProject(projectData);
    res.json(projectData);
  } catch (err) {
    console.error('Route error POST /api/projects:', err);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

// 3. Duplicate project
app.post('/api/projects/:id/duplicate', async (req, res) => {
  try {
    const ownerEmail = req.headers['x-user-email'] as string;
    if (!ownerEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const projects = await getAllProjects(ownerEmail);
    const project = projects.find((p) => p.id === req.params.id);

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const duplicated = {
      ...project,
      id: `proj_${Date.now()}`,
      owner: ownerEmail,
      name: `${project.name} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await saveProject(duplicated);
    res.json(duplicated);
  } catch (err) {
    console.error('Route error duplicate project:', err);
    res.status(500).json({ error: 'Failed to duplicate project' });
  }
});

// 4. Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const ownerEmail = req.headers['x-user-email'] as string;
    if (!ownerEmail) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const projects = await getAllProjects(ownerEmail);
    const project = projects.find((p) => p.id === req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const deleted = await removeProject(req.params.id);
    if (deleted) {
      res.json({ success: true, message: 'Project deleted' });
    } else {
      res.status(500).json({ error: 'Failed to delete project' });
    }
  } catch (err) {
    console.error('Route error delete project:', err);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// Helper: summarize topology into a compact readable string for AI context
function summarizeTopology(topology: any): string {
  if (!topology || (!topology.devices?.length && !topology.connections?.length)) {
    return 'No existing topology.';
  }
  const devSummary = (topology.devices || []).map((d: any) =>
    `  - ${d.name} (${d.type}${d.ipAddress ? ', IP: ' + d.ipAddress : ''}${d.gateway ? ', GW: ' + d.gateway : ''}${d.vlan ? ', ' + d.vlan : ''})`
  ).join('\n');
  const connSummary = (topology.connections || []).map((c: any) => {
    const fromDev = topology.devices?.find((d: any) => d.id === c.from);
    const toDev = topology.devices?.find((d: any) => d.id === c.to);
    return `  - ${fromDev?.name || c.from} ↔ ${toDev?.name || c.to} (${c.type}${c.vlan ? ', ' + c.vlan : ''})`;
  }).join('\n');
  return `Devices (${topology.devices?.length || 0}):\n${devSummary}\n\nConnections (${topology.connections?.length || 0}):\n${connSummary}`;
}

// Helper: detect if prompt is a question/conversation vs a topology generation request
function isConversationalPrompt(prompt: string): boolean {
  const p = prompt.toLowerCase().trim();
  // Conversational indicators: questions, explanations, greetings, short queries
  const questionPatterns = [
    /\b(apa|apakah|bagaimana|bagaimanakah|mengapa|kenapa|kapan|dimana|siapa|berapa|jelaskan|jelaskanlah|terangkan|explain|what|how|why|when|where|who|whose|which|can\s+you|could\s+you|tell\s+me|tolong|tanya|tanyakan|tanya-tanya|hi|hello|halo|hai|pagi|siang|sore|malam)\b/,
    /\?$/,
    /^terima\s+kasih|^thank/i,
  ];
  // Generation indicators: action verbs requesting topology creation/modification
  const generationPatterns = [
    /\b(buat|buatkan|desain|design|rancang|rancangkan|generate|create|build|make|deploy|setup|configure|setting|tambah|tambahkan|add|insert)\b/,
    /\b(jaringan|network|topology|topologi|vlan|subnet|router|switch|server|firewall)\b.*\b(untuk|for|with|dengan)\b/,
    /\b\d+\s*(router|switch|pc|server|ap|client|komputer|lantai|floor)\b/,
  ];

  // Swapped order: Check question patterns first to correctly identify questions that mention device types or action words (e.g. "bagaimana cara membuat vlan?")
  for (const pattern of questionPatterns) {
    if (pattern.test(p)) return true;
  }
  for (const pattern of generationPatterns) {
    if (pattern.test(p)) return false;
  }
  // If it's very short (< 15 chars) and no generation keywords, treat as conversation
  if (p.length < 15 && !generationPatterns.some(pat => pat.test(p))) return true;
  return false;
}

// 5. AI Generate Topology Endpoint (with conversational mode)
app.post('/api/generate', async (req, res) => {
  const { prompt, existingTopology, chatHistory } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const isConversation = isConversationalPrompt(prompt);

  // --- CONVERSATIONAL MODE ---
  if (isConversation && ai) {
    try {
      const topologyContext = existingTopology ? summarizeTopology(existingTopology) : 'No topology loaded.';
      
      // Build conversation history for context
      const historyText = (chatHistory || [])
        .slice(-6) // last 6 messages for context window
        .map((msg: any) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const conversationPrompt = `You are NetMind Copilot, an expert network engineer assistant. You help users understand networking concepts, explain configurations, troubleshoot issues, and answer questions about their network topology.

Respond in the SAME LANGUAGE the user uses. If they write in Indonesian (Bahasa Indonesia), respond in Indonesian. If English, respond in English.

Keep responses concise, practical, and technically accurate. Use markdown formatting for code blocks and lists.

Current active topology:
${topologyContext}

${historyText ? `Recent conversation:\n${historyText}\n` : ''}
User's message: ${prompt}`;

      const response = await generateContentWithRetry(ai, {
        model: 'gemini-2.5-flash',
        contents: conversationPrompt,
        config: {}
      });

      const text = response.text;
      return res.json({
        type: 'conversation',
        message: text || 'Maaf, saya tidak bisa memproses pertanyaan ini saat ini.'
      });
    } catch (err) {
      console.error('Error in conversational AI:', err);
      return res.json({
        type: 'conversation',
        message: 'Maaf, terjadi kendala saat menghubungkan ke AI. Silakan coba lagi.'
      });
    }
  }

  // --- TOPOLOGY GENERATION MODE ---
  const fallbackData = generateFallbackTopology(prompt);

  if (!ai) {
    console.log('Gemini key is inactive. Sending offline simulated payload.');
    return res.json({ type: 'topology', ...fallbackData });
  }

  try {
    // Build context-aware prompt
    const topologyContext = existingTopology ? summarizeTopology(existingTopology) : '';
    
    const systemInstruction = `
You are NetMind Copilot, a highly expert Senior Network Architect and Principal Network Engineer. You hold expert-level certifications (CCIE, MikroTik Certified Trainer, Debian SysAdmin). You have extensive expertise in physical and logical topologies, dynamic routing protocols (BGP, OSPF, RIP), virtual networking (VLAN trunking, IEEE 802.1Q, DHCP relay), IP subnet planning (VLSM/CIDR), enterprise firewalls, and data center fabrics. Your network designs must follow industry best practices, avoid security risks, and ensure high availability.

The user will describe a network requirement (e.g. campus, enterprise branch, IoT grid).
Your job is to analyze their requirements, perform an optimal VLSM or CIDR IP layout plan, and design a fully complete, elegant, working network architecture with Devices and Connections.

${topologyContext ? `The user already has an existing topology. If their prompt asks to modify, extend, or add to it, incorporate the existing design:\n\n${topologyContext}\n` : ''}

You MUST respond strictly with a valid JSON object matching this schema:
{
  "topology": {
    "devices": [{ "id": "string", "name": "string", "type": "router|switch|server|firewall|internet|pc|laptop|access_point|iot", "x": number(100-900), "y": number(80-600), "ipAddress": "string?", "gateway": "string?", "vlan": "string?", "deviceConfig": "string (CLI config)" }],
    "connections": [{ "id": "string", "from": "string(device id)", "to": "string(device id)", "type": "ethernet|fiber|wireless", "vlan": "string?" }]
  },
  "ip_plan": [{ "id": "string", "name": "string", "hostsNeeded": number, "networkAddress": "string", "gateway": "string", "subnetMask": "string", "broadcastAddress": "string", "dhcpRange": "string", "cidr": number }],
  "mikrotik_config": "string (full RouterOS CLI script)",
  "debian_config": "string (Debian /etc/network/interfaces + DHCP config)",
  "cisco_config": "string (Cisco IOS running-config)",
  "documentation": "string (Markdown design documentation with subnet table and validation checklist)",
  "summary": "string (1-3 sentence summary of what was designed, in the same language the user used)"
}

Rules:
1. Devices must have reasonable x/y coordinates forming an ordered hierarchical tree diagram.
2. Hierarchy: Internet → Firewall → Router → Switch → endpoints (servers, PCs, APs, IoT).
3. For each device, generate realistic, syntax-valid CLI scripts in 'deviceConfig'.
4. The 'summary' field MUST be in the same language the user used (Indonesian or English).
5. Ensure all device IDs are unique and all connection from/to references match valid device IDs.
6. Unless the user specifically asks for a small network, always design a robust, comprehensive network topology containing multiple subnets, 2-3 routers (e.g. Core, Branch, Edge), multiple switches, separate servers (like DNS, DB, Web servers), and several client devices (PCs, Laptops, IoT) to avoid a minimal or overly simple layout.
7. For the config fields (mikrotik_config, cisco_config, debian_config), separate the configuration code for each device using a clear header block containing the device name and type, like:
   # ==========================================
   # DEVICE: [Device Name] (e.g. Router-Core)
   # ==========================================
   (Insert CLI script here)
   
   Ensure every device of that type in the topology has its own configuration block.
8. Each device type (routers, switches, servers, firewalls, PCs, access points, IoT nodes) in the generated topology MUST NOT exceed a maximum of 10 devices per type.
`;

    const userContent = topologyContext 
      ? `The user's request: "${prompt}"\n\nExisting topology context:\n${topologyContext}`
      : `Design this network: "${prompt}"`;

    const response = await generateContentWithRetry(ai, {
      model: 'gemini-2.5-flash',
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['topology', 'ip_plan', 'mikrotik_config', 'debian_config', 'cisco_config', 'documentation', 'summary'],
          properties: {
            topology: {
              type: Type.OBJECT,
              required: ['devices', 'connections'],
              properties: {
                devices: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ['id', 'name', 'type', 'x', 'y', 'deviceConfig'],
                    properties: {
                      id: { type: Type.STRING },
                      name: { type: Type.STRING },
                      type: { type: Type.STRING },
                      x: { type: Type.INTEGER },
                      y: { type: Type.INTEGER },
                      ipAddress: { type: Type.STRING },
                      gateway: { type: Type.STRING },
                      vlan: { type: Type.STRING },
                      deviceConfig: { type: Type.STRING }
                    }
                  }
                },
                connections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    required: ['id', 'from', 'to', 'type'],
                    properties: {
                      id: { type: Type.STRING },
                      from: { type: Type.STRING },
                      to: { type: Type.STRING },
                      type: { type: Type.STRING },
                      vlan: { type: Type.STRING }
                    }
                  }
                }
              }
            },
            ip_plan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ['id', 'name', 'hostsNeeded', 'networkAddress', 'gateway', 'subnetMask', 'broadcastAddress', 'dhcpRange', 'cidr'],
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING },
                  hostsNeeded: { type: Type.INTEGER },
                  networkAddress: { type: Type.STRING },
                  gateway: { type: Type.STRING },
                  subnetMask: { type: Type.STRING },
                  broadcastAddress: { type: Type.STRING },
                  dhcpRange: { type: Type.STRING },
                  cidr: { type: Type.INTEGER }
                }
              }
            },
            mikrotik_config: { type: Type.STRING },
            debian_config: { type: Type.STRING },
            cisco_config: { type: Type.STRING },
            documentation: { type: Type.STRING },
            summary: { type: Type.STRING }
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      res.json({ type: 'topology', ...parsed });
    } else {
      res.json({ type: 'topology', ...fallbackData });
    }
  } catch (err) {
    console.error('Error generating topology with Gemini:', err);
    res.json({ type: 'topology', ...fallbackData });
  }
});

// 6. AI Troubleshoot Endpoint
app.post('/api/troubleshoot', async (req, res) => {
  const { query, topology } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'Trouble ticket query is required' });
  }

  const fallbackTroubleshoot = getFallbackTroubleshoot(query);

  if (!ai) {
    console.log('Gemini key is inactive. Sending offline simulated troubleshooter payload.');
    return res.json(fallbackTroubleshoot);
  }

  try {
    // Format topology context as structured summary instead of raw JSON dump
    const topologyContext = topology ? summarizeTopology(topology) : 'No topology data provided.';

    const systemInstruction = `
You are NetMind AI, an expert Senior Network Architect and Certified Troubleshooting Specialist. You hold expert certifications (CCIE Routing and Switching, MikroTik Certified Routing Engineer, Senior Linux administrator). You are an expert at network diagnostics, packet trace audits, routing anomalies, DHCP relay failures, DNS resolution errors, and firewall access control listing. Provide rigorous engineering analysis.

The user will input an error or issue they are experiencing. Analyze their specific topology to identify configuration errors.

Respond in the SAME LANGUAGE the user uses.

Analyze the problem with these sections:
1. Root Cause Analysis (specific to THEIR topology configuration, reference actual device names and IPs).
2. Diagnostic Analysis (step-by-step packet trace through their actual devices).
3. Recommended Fixes (concrete, actionable instructions referencing their device names).
4. Terminal Commands to Run (exact commands for RouterOS / Debian / Cisco / Client, using their actual IPs and interfaces).

You MUST respond with a valid JSON matching this schema:
{
  "rootCause": "string (the primary explanation referencing their topology)",
  "analysis": "string (deep dive analysis tracing packets through their actual devices)",
  "fixes": ["string (fix action referencing specific devices)", ...],
  "commands": ["string (exact command with their actual IPs/interfaces)", ...]
}
`;

    const userContent = `Issue reported: "${query}"

Active Network Topology:
${topologyContext}`;

    const response = await generateContentWithRetry(ai, {
      model: 'gemini-2.5-flash',
      contents: userContent,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['rootCause', 'analysis', 'fixes', 'commands'],
          properties: {
            rootCause: { type: Type.STRING },
            analysis: { type: Type.STRING },
            fixes: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            commands: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const text = response.text;
    if (text) {
      const parsed = JSON.parse(text);
      res.json(parsed);
    } else {
      res.json(fallbackTroubleshoot);
    }
  } catch (err) {
    console.error('Error troubleshooting with Gemini:', err);
    res.json(fallbackTroubleshoot);
  }
});

// Fallback logic for offline generator
function generateFallbackTopology(prompt: string) {
  const promptLower = prompt.toLowerCase();
  
  // Dynamic parsing parameters
  let numRouters = 0;
  let numSwitches = 0;
  let numPCs = 0;
  let numServers = 0;
  let numAccessPoints = 0;
  let numIoTs = 0;
  let numFirewalls = 0;
  let numFloors = 1;

  // Extract floor counts
  const floorMatch = promptLower.match(/(\d+)\s*(floor|lantai)/);
  if (floorMatch) {
    numFloors = parseInt(floorMatch[1], 10);
  }

  // Extract device counts using regex scanning
  const countRegex = /(\d+)\s*(router|switch|pc|komputer|client|server|ap|wifi|hotspot|access_point|iot|sensor|firewall|asa)/g;
  let match;
  let hasParsedCounts = false;

  while ((match = countRegex.exec(promptLower)) !== null) {
    hasParsedCounts = true;
    const count = parseInt(match[1], 10);
    const keyword = match[2];
    if (keyword.includes('router')) numRouters = count;
    else if (keyword.includes('switch')) numSwitches = count;
    else if (keyword.includes('pc') || keyword.includes('komputer') || keyword.includes('client')) numPCs = count;
    else if (keyword.includes('server')) numServers = count;
    else if (keyword.includes('ap') || keyword.includes('wifi') || keyword.includes('hotspot') || keyword.includes('access_point')) numAccessPoints = count;
    else if (keyword.includes('iot') || keyword.includes('sensor')) numIoTs = count;
    else if (keyword.includes('firewall') || keyword.includes('asa')) numFirewalls = count;
  }

  // Set intelligent defaults if no counts are found in prompt
  if (!hasParsedCounts) {
    if (promptLower.includes('greenhouse') || promptLower.includes('kebun') || promptLower.includes('tani') || promptLower.includes('pertanian')) {
      numRouters = 1; numAccessPoints = 1; numIoTs = 4; numServers = 1;
    } else if (promptLower.includes('datacenter') || promptLower.includes('data center') || promptLower.includes('pusat data')) {
      numFirewalls = 1; numRouters = 2; numSwitches = 2; numServers = 3;
    } else if (promptLower.includes('kantor') || promptLower.includes('office') || promptLower.includes('perusahaan')) {
      numRouters = 1; numSwitches = numFloors; numPCs = numFloors * 2; numServers = 1;
    } else {
      // Default standard network
      numRouters = 1; numSwitches = 1; numPCs = 2; numServers = 1;
    }
  }

  // Make sure we have at least one Router and Switch if clients are requested
  if (numRouters === 0) numRouters = 1;
  if (numSwitches === 0 && (numPCs > 0 || numServers > 0)) numSwitches = 1;

  // Cap layout counts to prevent crowded visualization canvas
  numRouters = Math.min(numRouters, 10);
  numSwitches = Math.max(numSwitches, numFloors); // at least one switch per floor
  numSwitches = Math.min(numSwitches, 10);
  numPCs = Math.min(numPCs, 10);
  numServers = Math.min(numServers, 10);
  numAccessPoints = Math.min(numAccessPoints, 10);
  numIoTs = Math.min(numIoTs, 10);
  numFirewalls = Math.min(numFirewalls, 10);

  const devices: any[] = [];
  const connections: any[] = [];
  const ip_plan: any[] = [];

  // Define Subnets depending on devices needed

  // 2. Parse IP prefix from prompt
  let baseIP = '192.168.10'; // default
  let baseNetwork = '192.168.0.0';
  const ipMatch = prompt.match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
  if (ipMatch) {
    const octet1 = parseInt(ipMatch[1], 10);
    const octet2 = parseInt(ipMatch[2], 10);
    const octet3 = parseInt(ipMatch[3], 10);
    if (octet1 === 10) {
      baseIP = `10.${octet2}.${octet3}`;
      baseNetwork = `10.0.0.0`;
    } else if (octet1 === 172) {
      baseIP = `172.${octet2}.${octet3}`;
      baseNetwork = `172.16.0.0`;
    } else {
      baseIP = `${octet1}.${octet2}.${octet3}`;
      baseNetwork = `${octet1}.${octet2}.0.0`;
    }
  }

  // 3. Parse VLAN numbers and labels
  let vlan10 = 10;
  let vlan20 = 20;
  let vlan30 = 30;
  let vlan40 = 40;

  const vlanMatches = [...prompt.matchAll(/vlan\s*(\d+)/gi)];
  if (vlanMatches.length > 0) {
    if (vlanMatches[0] && vlanMatches[0][1]) vlan10 = parseInt(vlanMatches[0][1], 10);
    if (vlanMatches[1] && vlanMatches[1][1]) vlan20 = parseInt(vlanMatches[1][1], 10);
    if (vlanMatches[2] && vlanMatches[2][1]) vlan30 = parseInt(vlanMatches[2][1], 10);
    if (vlanMatches[3] && vlanMatches[3][1]) vlan40 = parseInt(vlanMatches[3][1], 10);
  }

  // Customize VLAN names based on keywords
  let vlanName10 = 'Clients';
  let vlanName20 = 'Wireless';
  let vlanName30 = 'Servers';
  let vlanName40 = 'IoT';

  if (promptLower.includes('dosen') || promptLower.includes('staff') || promptLower.includes('karyawan')) {
    vlanName10 = 'Staff';
  } else if (promptLower.includes('keuangan')) {
    vlanName10 = 'Keuangan';
  }
  if (promptLower.includes('mahasiswa') || promptLower.includes('student') || promptLower.includes('tamu') || promptLower.includes('guest')) {
    vlanName20 = promptLower.includes('tamu') || promptLower.includes('guest') ? 'Guest' : 'Students';
  }

  // Dynamic IPs based on baseIP structure
  const getSubnetOctet = (vlanId: number) => {
    const parts = baseIP.split('.');
    if (parts.length >= 2) {
      return `${parts[0]}.${parts[1]}.${vlanId}`;
    }
    return `192.168.${vlanId}`;
  };

  const subnet1 = getSubnetOctet(vlan10);
  const subnet2 = getSubnetOctet(vlan20);
  const subnet3 = getSubnetOctet(vlan30);
  const subnet4 = getSubnetOctet(vlan40);

  const subnetsList = [
    { name: `VLAN ${vlan10} - ${vlanName10}`, hosts: 100, ip: subnet1, vlan: `VLAN-${vlan10}`, cidr: 24, vlanId: vlan10 },
    { name: `VLAN ${vlan20} - ${vlanName20}`, hosts: 50, ip: subnet2, vlan: `VLAN-${vlan20}`, cidr: 24, vlanId: vlan20 },
    { name: `VLAN ${vlan30} - ${vlanName30}`, hosts: 30, ip: subnet3, vlan: `VLAN-${vlan30}`, cidr: 24, vlanId: vlan30 },
    { name: `VLAN ${vlan40} - ${vlanName40}`, hosts: 100, ip: subnet4, vlan: `VLAN-${vlan40}`, cidr: 24, vlanId: vlan40 }
  ];

  subnetsList.forEach((sub, idx) => {
    ip_plan.push({
      id: `ip_${idx + 1}`,
      name: sub.name,
      hostsNeeded: sub.hosts,
      networkAddress: `${sub.ip}.0`,
      gateway: `${sub.ip}.1`,
      subnetMask: '255.255.255.0',
      broadcastAddress: `${sub.ip}.255`,
      dhcpRange: `${sub.ip}.10 - ${sub.ip}.254`,
      cidr: sub.cidr
    });
  });

  // 1. Generate Internet gateway
  devices.push({ 
    id: 'dev_internet', 
    name: 'ISP_WAN_Edge', 
    type: 'internet', 
    x: 450, 
    y: 50, 
    ipAddress: '103.44.12.1',
    deviceConfig: `# ISP WAN Edge Interface Configuration\ninterface GigabitEthernet0/0\n description Uplink to ISP\n ip address 103.44.12.1 255.255.255.252\n speed 1000\n duplex full`
  });

  // 2. Generate Firewalls
  const fwIds: string[] = [];
  for (let i = 0; i < numFirewalls; i++) {
    const id = `dev_fw_${i + 1}`;
    const name = numFirewalls === 1 ? 'Core_ASA_Firewall' : `ASA_Firewall_${i + 1}`;
    devices.push({
      id,
      name,
      type: 'firewall',
      x: 450 + (i - (numFirewalls - 1) / 2) * 200,
      y: 120,
      ipAddress: `10.0.99.${i + 1}`,
      deviceConfig: `! Cisco ASA Firewall Running Config\n!\ninterface GigabitEthernet0/0\n nameif outside\n security-level 0\n ip address 103.44.12.${i + 2} 255.255.255.252\n!\ninterface GigabitEthernet0/1\n nameif inside\n security-level 100\n ip address 10.0.99.${i + 1} 255.255.255.0\n!\nobject network INSIDE-NET\n subnet ${baseNetwork} 255.255.0.0\n nat (inside,outside) dynamic interface\n!\naccess-list OUTSIDE-IN permit tcp any interface outside eq 80`
    });
    fwIds.push(id);
    connections.push({ id: `c_int_fw_${i}`, from: 'dev_internet', to: id, type: 'fiber' });
  }

  // 3. Generate Routers
  const routerIds: string[] = [];
  for (let i = 0; i < numRouters; i++) {
    const id = `dev_router_${i + 1}`;
    const name = numRouters === 1 ? 'Mikrotik_Core_Gateway' : `Mikrotik_Router_${i + 1}`;
    devices.push({
      id,
      name,
      type: 'router',
      x: 450 + (i - (numRouters - 1) / 2) * 180,
      y: numFirewalls > 0 ? 200 : 130,
      ipAddress: `${subnet1}.1`,
      gateway: numFirewalls > 0 ? `10.0.99.1` : '103.44.12.1',
      deviceConfig: `# MikroTik RouterOS Script for ${name}\n/interface ethernet\nset [ find default-name=ether1 ] comment="Uplink to WAN"\nset [ find default-name=ether2 ] comment="Trunk to Core Switch"\n\n/interface vlan\nadd interface=ether2 name=vlan${vlan10} vlan-id=${vlan10}\nadd interface=ether2 name=vlan${vlan20} vlan-id=${vlan20}\nadd interface=ether2 name=vlan${vlan30} vlan-id=${vlan30}\nadd interface=ether2 name=vlan${vlan40} vlan-id=${vlan40}\n\n/ip address\nadd address=${subnet1}.1/24 interface=vlan${vlan10}\nadd address=${subnet2}.1/24 interface=vlan${vlan20}\nadd address=${subnet3}.1/24 interface=vlan${vlan30}\nadd address=${subnet4}.1/24 interface=vlan${vlan40}\nadd address=${numFirewalls > 0 ? `10.0.99.10/24` : `103.44.12.2/30`} interface=ether1\n\n/ip pool\nadd name=pool_vlan${vlan10} ranges=${subnet1}.10-${subnet1}.250\nadd name=pool_vlan${vlan20} ranges=${subnet2}.10-${subnet2}.250\nadd name=pool_vlan${vlan40} ranges=${subnet4}.10-${subnet4}.250\n\n/ip dhcp-server\nadd address-pool=pool_vlan${vlan10} disabled=no interface=vlan${vlan10} name=dhcp_vlan${vlan10}\nadd address-pool=pool_vlan${vlan20} disabled=no interface=vlan${vlan20} name=dhcp_vlan${vlan20}\nadd address-pool=pool_vlan${vlan40} disabled=no interface=vlan${vlan40} name=dhcp_vlan${vlan40}\n\n/ip dhcp-server network\nadd address=${subnet1}.0/24 dns-server=${subnet3}.10,8.8.8.8 gateway=${subnet1}.1\nadd address=${subnet2}.0/24 dns-server=8.8.8.8 gateway=${subnet2}.1\nadd address=${subnet4}.0/24 dns-server=8.8.8.8 gateway=${subnet4}.1\n\n/ip route\nadd gateway=${numFirewalls > 0 ? `10.0.99.1` : `103.44.12.1`}\n/ip firewall nat\nadd action=masquerade chain=srcnat out-interface=ether1 comment="NAT to Internet"`
    });
    routerIds.push(id);

    if (numFirewalls > 0) {
      fwIds.forEach(fwId => {
        connections.push({ id: `c_fw_${fwId}_r_${id}`, from: fwId, to: id, type: 'ethernet' });
      });
    } else if (i === 0) {
      connections.push({ id: `c_internet_r_${id}`, from: 'dev_internet', to: id, type: 'fiber' });
    }
  }

  // 4. Generate Switches (organize floor by floor if specified)
  const switchIds: string[] = [];
  const switchY = numFirewalls > 0 ? 280 : 210;
  for (let i = 0; i < numSwitches; i++) {
    const id = `dev_switch_${i + 1}`;
    const name = numFloors > 1 && i < numFloors ? `Cisco_Switch_Floor_${i + 1}` : `Cisco_Core_Switch_${i + 1}`;
    const floorLabel = numFloors > 1 && i < numFloors ? `Floor ${i + 1} distribution` : 'Main Core';
    
    devices.push({
      id,
      name,
      type: 'switch',
      x: 450 + (i - (numSwitches - 1) / 2) * 200,
      y: numFloors > 1 && i < numFloors ? (switchY + i * 110) : switchY,
      deviceConfig: `! Cisco IOS Switch Running Configuration for ${name} (${floorLabel})\n!\nvlan ${vlan10}\n name ${vlanName10}\nvlan ${vlan20}\n name ${vlanName20}\nvlan ${vlan30}\n name ${vlanName30}\nvlan ${vlan40}\n name ${vlanName40}\n!\ninterface range FastEthernet0/1 - 12\n switchport mode access\n switchport access vlan ${vlan10}\n!\ninterface range FastEthernet0/13 - 18\n switchport mode access\n switchport access vlan ${vlan20}\n!\ninterface range FastEthernet0/19 - 24\n switchport mode access\n switchport access vlan ${vlan30}\n!\ninterface GigabitEthernet0/1\n switchport mode trunk\n switchport trunk allowed vlan ${vlan10},${vlan20},${vlan30},${vlan40}\n description Uplink to Router/Core`
    });
    switchIds.push(id);

    // Connection: Link switch to Router
    routerIds.forEach(rId => {
      connections.push({ id: `c_r_${rId}_sw_${id}`, from: rId, to: id, type: 'ethernet' });
    });
  }

  // 5. Generate Access Points
  const apIds: string[] = [];
  const apY = numFloors > 1 ? (switchY + numFloors * 110) : (switchY + 90);
  for (let i = 0; i < numAccessPoints; i++) {
    const id = `dev_ap_${i + 1}`;
    const parentSwitch = switchIds[i % switchIds.length];
    
    devices.push({
      id,
      name: `Aruba_AP_Hotspot_${i + 1}`,
      type: 'access_point',
      x: 180 + i * 180,
      y: apY,
      vlan: `VLAN-${vlan20}`,
      deviceConfig: `# AP SSID Broadcast Configuration\nssid NetMind_AP_${i + 1}\nfrequency 5.0ghz\nchannel ${36 + i * 8}\nsecurity wpa2-personal\npassphrase secureNetMindWifi\nvlan-tagging enable vlan ${vlan20}`
    });
    apIds.push(id);
    connections.push({ id: `c_sw_ap_${i}`, from: parentSwitch, to: id, type: 'ethernet', vlan: `VLAN-${vlan20}` });
  }

  // 6. Generate Servers (VLAN 30)
  const serverIds: string[] = [];
  const serverY = apY + 90;
  for (let i = 0; i < numServers; i++) {
    const id = `dev_server_${i + 1}`;
    const name = i === 0 ? 'Debian_DNS_Server' : `Debian_DB_Server_${i + 1}`;
    const ipAddress = `${subnet3}.${10 + i}`;
    const parentSwitch = switchIds[0] || routerIds[0];

    devices.push({
      id,
      name,
      type: 'server',
      x: 350 + i * 140,
      y: serverY,
      ipAddress,
      gateway: `${subnet3}.1`,
      vlan: `VLAN-${vlan30}`,
      deviceConfig: `# Debian Linux static Network configuration for ${name}\n# /etc/network/interfaces\n\nauto eth0\niface eth0 inet static\n    address ${ipAddress}\n    netmask 255.255.255.0\n    gateway ${subnet3}.1\n    dns-nameservers 8.8.8.8\n\n# Dynamic post-up instructions\n# service bind9 restart\n# iptables -A INPUT -p tcp --dport 80 -j ACCEPT`
    });
    serverIds.push(id);
    connections.push({ id: `c_sw_srv_${i}`, from: parentSwitch, to: id, type: 'ethernet', vlan: `VLAN-${vlan30}` });
  }

  // 7. Generate PCs (VLAN 10)
  const pcIds: string[] = [];
  const pcY = serverY + 80;
  for (let i = 0; i < numPCs; i++) {
    const id = `dev_pc_${i + 1}`;
    const name = `PC_User_Floor_${Math.floor(i / (numPCs / numFloors)) + 1}_${i + 1}`;
    const ipAddress = `${subnet1}.${50 + i}`;
    
    // Connect to the switch on the matching floor
    const floorIndex = Math.min(Math.floor(i / 2), switchIds.length - 1);
    const parentSwitch = switchIds[floorIndex] || switchIds[0];

    devices.push({
      id,
      name,
      type: 'pc',
      x: 100 + i * 110,
      y: pcY,
      ipAddress,
      gateway: `${subnet1}.1`,
      vlan: `VLAN-${vlan10}`,
      deviceConfig: `# Desktop Client Network Configuration\nHostname: ${name}\nIP Assignment: DHCP (Acquired via Mikrotik)\nSimulated Static Fallback IP: ${ipAddress}\nSubnet Mask: 255.255.255.0\nDefault Gateway: ${subnet1}.1\nDNS Resolver: ${subnet3}.10 (Debian_DNS)`
    });
    pcIds.push(id);
    connections.push({ id: `c_sw_pc_${i}`, from: parentSwitch, to: id, type: 'ethernet', vlan: `VLAN-${vlan10}` });
  }

  // 8. Generate IoT sensors (VLAN 40)
  const iotIds: string[] = [];
  const iotY = pcY + 70;
  for (let i = 0; i < numIoTs; i++) {
    const id = `dev_iot_${i + 1}`;
    const parentAP = apIds[i % apIds.length];
    const ipAddress = `${subnet4}.${100 + i}`;
    
    devices.push({
      id,
      name: `ESP32_Sensor_${i + 1}`,
      type: 'iot',
      x: 150 + i * 120,
      y: iotY,
      ipAddress,
      gateway: `${subnet4}.1`,
      vlan: `VLAN-${vlan40}`,
      deviceConfig: `// Arduino ESP32 Client Firmware Config\n#include <WiFi.h>\n#include <PubSubClient.h>\n\nconst char* ssid = "NetMind_WiFi_Corporate";\nconst char* wifiPassword = "secureNetMindWifi";\nconst char* mqttServer = "${subnet3}.10";\nconst int mqttPort = 1883;\n\nvoid setup() {\n  WiFi.begin(ssid, wifiPassword);\n  while (WiFi.status() != WL_CONNECTED) { delay(500); }\n  // IPAddress localIP = WiFi.localIP();\n}`
    });
    iotIds.push(id);

    if (parentAP) {
      connections.push({ id: `c_ap_iot_${i}`, from: parentAP, to: id, type: 'wireless', vlan: `VLAN-${vlan40}` });
    } else {
      const parentSwitch = switchIds[0];
      if (parentSwitch) {
        connections.push({ id: `c_sw_iot_${i}`, from: parentSwitch, to: id, type: 'ethernet', vlan: `VLAN-${vlan40}` });
      }
    }
  }

  // Compile final custom configurations
  const routerNames = devices.filter(d => d.type === 'router').map(d => d.name);
  const switchNames = devices.filter(d => d.type === 'switch').map(d => d.name);
  const serverNames = devices.filter(d => d.type === 'server').map(d => d.name);

  return {
    topology: { devices, connections },
    ip_plan,
    mikrotik_config: `# NetMind Simulated Fallback RouterOS Script\n# Generated matching prompt: "${prompt}"\n\n/sys identity set name=Mikrotik_Gateway\n\n` + 
      devices.filter(d => d.type === 'router').map(r => `# ==========================================\n# DEVICE: ${r.name} (RouterOS)\n# ==========================================\n${r.deviceConfig}`).join('\n\n'),
    debian_config: `# NetMind Simulated Fallback Debian Config\n# Sourced from custom server requirements\n\n` + 
      devices.filter(d => d.type === 'server').map(s => `# ==========================================\n# DEVICE: ${s.name} (Debian Server)\n# ==========================================\n${s.deviceConfig}`).join('\n\n'),
    cisco_config: `! NetMind Simulated Fallback Cisco Switch CLI\n! Generated for switches: ${switchNames.join(', ')}\n\n` + 
      devices.filter(d => d.type === 'switch').map(sw => `! ==========================================\n! DEVICE: ${sw.name} (Cisco IOS Switch)\n! ==========================================\n${sw.deviceConfig}`).join('\n\n'),
    documentation: `# Expert Network Blueprint\n\nThis network design is generated directly in response to your prompt:\n> "${prompt}"\n\n## Network Summary\n- **Edge Gateway**: ${routerNames.join(', ')} (MikroTik RouterOS)\n- **Switching Layer**: ${switchNames.join(', ')} (Cisco IOS VLAN-tagging)\n- **Active Servers**: ${serverNames.join(', ')} (Debian Service host)\n- **End Devices**: ${numPCs} PC clients, ${numAccessPoints} AP stations, and ${numIoTs} wireless IoT boards.\n\n## Subnetwork Layout\nThis design uses a secure VLSM configuration:\n1. **${vlanName10}** (Subnet: \`${subnet1}.0/24\`, Gateway: \`${subnet1}.1\`, VLAN: \`${vlan10}\`)\n2. **${vlanName20}** (Subnet: \`${subnet2}.0/24\`, Gateway: \`${subnet2}.1\`, VLAN: \`${vlan20}\`)\n3. **${vlanName30}** (Subnet: \`${subnet3}.0/24\`, Gateway: \`${subnet3}.1\`, VLAN: \`${vlan30}\`)\n4. **${vlanName40}** (Subnet: \`${subnet4}.0/24\`, Gateway: \`${subnet4}.1\`, VLAN: \`${vlan40}\`)\n\n## Validation Checklist\n- [ ] Configure the trunk links between the Cisco Switches and MikroTik interfaces.\n- [ ] Deploy the DHCP service in the MikroTik router and check IP bindings.\n- [ ] Verify that client PCs are receiving addresses within range \`${subnet1}.10 - 250\`.`
  };
}

// Fallback logic for troubleshooter
function getFallbackTroubleshoot(query: string) {
  const q = query.toLowerCase();
  if (q.includes('dhcp') || q.includes('ip address') || q.includes('alamat')) {
    return {
      rootCause: 'DHCP Discovery Packets Blocked by Missing Helper-Address on Core Switch.',
      analysis: 'The client is located in VLAN 10, but the Debian DHCP Server resides in the Management Subnet (VLAN 30). By default, DHCP discovery is a broadcast packet that cannot cross subnet boundaries. Since the switch does not have an IP helper-address configured on Interface VLAN 10, the router drops the broadcast before reaching the server.',
      fixes: [
        'Enable ip helper-address (DHCP Relay) on the Layer 3 interface or Mikrotik helper service.',
        'Verify that the Debian DHCP configuration subnet block includes pools for both subnets.',
        'Ensure the switch trunk link allows both VLAN 10 and VLAN 30 frames.'
      ],
      commands: [
        '# Cisco Core Switch (add helper configuration):',
        'conf t',
        'interface Vlan10',
        ' ip address 192.168.10.1 255.255.255.0',
        ' ip helper-address 192.168.30.10',
        '!',
        '# Mikrotik RouterOS DHCP Relay (Alternative):',
        '/ip dhcp-relay add name=relay1 interface=vlan10 delay-threshold=0 local-address=192.168.10.1 dhcp-server=192.168.30.10 disabled=no',
        '# Verify DHCP server status in Debian server:',
        'systemctl status isc-dhcp-server'
      ]
    };
  }

  if (q.includes('dns') || q.includes('resolve') || q.includes('google.com')) {
    return {
      rootCause: 'DNS Resolver IP Mismatch or NAT Masquerade rule missing on edge.',
      analysis: 'The topology indicates clients are configured with a primary DNS server pointing to 192.168.1.11, but the DNS resolver service on that host is inactive or has no forwarders configured to reach public servers. Furthermore, outgoing packets may be failing NAT translation at the Mikrotik gateway.',
      fixes: [
        'Set public DNS forwarders (8.8.8.8) inside the Debian DNS server config (/etc/bind/named.conf.options).',
        'Verify Mikrotik Out-Interface NAT Masquerading is active.',
        'Verify the client can ping the public DNS resolver IP directly (8.8.8.8).'
      ],
      commands: [
        '# Test connectivity from client terminal:',
        'ping -c 3 8.8.8.8',
        'nslookup google.com 192.168.1.11',
        '# Verify Mikrotik Firewall rules:',
        '/ip firewall nat print',
        '# Ensure NAT masquerade exists:',
        '/ip firewall nat add action=masquerade chain=srcnat out-interface=ether1 comment="NAT outbound"'
      ]
    };
  }

  return {
    rootCause: 'Incomplete Routing Table or VLAN Membership Mismatch on Trunks.',
    analysis: 'The symptoms suggest packets fail to return to source subnets. This happens when inter-VLAN routing is active on the Gateway but Cisco switch ports linking access points or routers are configured as access mode instead of IEEE 802.1Q trunks.',
    fixes: [
      'Change port types on switch-to-router connections to TRUNK.',
      'Audit the routing table on the gateway to ensure static routes pointing back to branch subnets exist.'
    ],
    commands: [
      '# Configure switch port to trunk mode:',
      'conf t',
      'interface GigabitEthernet0/1',
      ' switchport trunk allowed vlan all',
      ' switchport mode trunk',
      '!',
      '# Display router routing table:',
      '/ip route print'
    ]
  };
}

// ----------------- VITE & STATIC SERVING -----------------

async function startServer() {
  // Initialize Database table if using MongoDB
  if (mongoClient) {
    await initDatabase();
  }
  
  // Seed default data if database/file is empty
  await seedIfEmpty();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      // Don't serve SPA fallback for API routes
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API endpoint not found' });
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NetMind AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
