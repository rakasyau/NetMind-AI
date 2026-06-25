# NetMind AI — Collaborative Network Architect Copilot

NetMind AI is a premium, collaborative web workspace for network engineers, architects, and administrators. Powered by Google Gemini (Gemini 2.5 Flash), it allows users to design, visualize, calculate, configure, and troubleshoot network topologies using natural language and an interactive canvas.

---

## 🚀 Key Features

*   **Interactive Visual Canvas**: Drag, drop, and link devices (Routers, Switches, Firewalls, Debian Servers, PC Clients, Access Points, and IoT boards). Implements layout constraints and panning/zooming.
*   **AI Network Copilot (Gemini 2.5/2.0 Flash)**: Design complex network infrastructures from text prompts (e.g., *"Desain topologi kantor 3 lantai dengan VLAN"*). The copilot generates coordinates, subnets, CLI configs, and documentation contextually.
*   **Separated Device Configurations**: Automatically isolates and generates ready-to-run configurations for:
    *   **MikroTik RouterOS** (VLANs, DHCP servers, NAT, firewall rules).
    *   **Cisco IOS Switches** (VLAN database, trunk/access ports).
    *   **Debian Servers** (`/etc/network/interfaces` setup, static routing, DNS/DHCP RELAY config).
*   **Traceroute & Ping Simulator**: Visually inspect packet tracer animation paths (via physical pathfinding BFS) directly on the grid and trace connection latency.
*   **VLSM / CIDR IP Subnet Calculator**: Input hosts needed and compile an optimized subnet layout (VLAN allocation, Gateway, Broadcast, and DHCP range).
*   **Intelligent AI Troubleshooter**: Input trouble tickets (e.g., *"Client VLAN 10 tidak mendapat IP DHCP"*) to diagnose, debug, and receive actionable terminal commands tailored to your active canvas.
*   **Production Security**: Secured registration and login flow utilizing local password hashing (`scryptSync`).
*   **Dashboard Activity Logging**: Dynamic operations timeline showing real project modifications, subnet compilations, and creation history.

---

## 🛠️ Technology Stack

*   **Frontend**: React (v19), Vite, Tailwind CSS, Lucide React, HTML5 SVG Canvas.
*   **Backend**: Node.js, Express, TSX, Esbuild (compilation bundle).
*   **AI SDK**: `@google/genai` (structured JSON generation).
*   **Deployment**: Docker, Alpine Node runner, Cloudflare Tunnels (for WSL and host exposure).

---

## 📦 Getting Started

### Prerequisites
*   Node.js (v20+ recommended)
*   A Gemini API Key (get one from Google AI Studio)

### 1. Installation
Clone the repository and install all dependencies:
```bash
git clone https://github.com/rakasyau/NetMind-AI.git
cd NetMind-AI
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory:
```env
PORT=3000
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
MONGODB_URI=YOUR_MONGO_DB_CONNECTION_STRING_OPTIONAL
```
*Note: If `MONGODB_URI` is omitted, the app will automatically fall back to local file storage (`projects.json` and `users.json`) with safe `.gitignore` isolation.*

### 3. Run Locally
Start the development server:
```bash
npm run dev
```
Open `http://localhost:3000` in your web browser.

---

## 🐳 Docker Deployment

Project ini sudah ter-containerize sepenuhnya dan siap untuk production. Berikut adalah panduan deploy menggunakan **Docker Desktop** (baik via CLI maupun GUI):

### 📋 Prasyarat (Prerequisites)
1. Pastikan **Docker Desktop** sudah terinstal dan berjalan di komputer Anda (Windows, macOS, atau Linux).
2. Dapatkan **Gemini API Key** dari Google AI Studio.

---

### 🚀 Cara Deploy Menggunakan Docker Desktop

#### 1. Persiapan File Environment (`.env`) dan File Database Lokal
Sebelum menjalankan container, buat file `.env` di direktori utama (root) proyek jika belum ada:
```env
PORT=3000
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
MONGODB_URI=YOUR_MONGO_DB_CONNECTION_STRING_OPTIONAL
```
> 💡 **Catatan Penting (Persistensi Data):**
> Jika `MONGODB_URI` dikosongkan, data akan disimpan secara lokal di dalam container. Agar data lokal tersebut tersimpan secara persisten di host machine Anda, buat file kosong bernama `projects.json` di root direktori terlebih dahulu (terutama di Windows/macOS agar Docker tidak secara otomatis membuat folder dengan nama tersebut saat melakukan mounting volume).
>
> **Pada Linux/macOS:**
> ```bash
> touch projects.json
> ```
> **Pada Windows (PowerShell):**
> ```powershell
> New-Item projects.json -ItemType File
> ```

#### 2. Menjalankan Docker Compose
Ada dua cara untuk menjalankan aplikasi menggunakan Docker Desktop:

##### Opsi A: Menggunakan Command Line (CLI)
1. Buka Terminal (macOS/Linux) atau Command Prompt/PowerShell (Windows) di direktori project.
2. Jalankan perintah berikut untuk mem-build dan menjalankan container di background:
   ```bash
   docker compose up -d --build
   ```
3. Periksa status container yang sedang berjalan:
   ```bash
   docker compose ps
   ```

##### Opsi B: Menggunakan Docker Desktop GUI
1. Buka aplikasi **Docker Desktop**.
2. Jalankan perintah `docker compose up -d --build` sekali lewat terminal di direktori project untuk mendaftarkan project ke Docker Desktop.
3. Setelah itu, project akan otomatis muncul di tab **Containers** di Docker Desktop dengan nama grup yang sesuai dengan nama folder project Anda (misalnya `netmind-ai`).
4. Anda dapat mengontrol container secara visual melalui GUI Docker Desktop:
   - **Start / Stop / Restart**: Klik tombol kontrol (Play, Stop, atau Restart) di sebelah container `netmind-app`.
   - **Logs**: Klik pada nama container `netmind-app` untuk melihat log real-time aplikasi.
   - **Terminal**: Buka tab *Terminal* di dalam detail container untuk menjalankan perintah langsung di dalam container.
   - **Files**: Anda bisa menjelajahi struktur file container melalui tab *Files*.

#### 3. Mengakses Aplikasi
Buka browser Anda dan akses:
```
http://localhost:3000
```
> ⚠️ **Catatan Keamanan (Port Binding):**
> Secara default di file `docker-compose.yml`, port di-bind ke `127.0.0.1:3000:3000`. Ini berarti aplikasi hanya dapat diakses dari komputer tempat Docker Desktop itu berjalan (localhost). 
> 
> Jika Anda ingin aplikasi dapat diakses dari perangkat lain dalam satu jaringan lokal (LAN), edit file `docker-compose.yml` pada bagian `ports` menjadi:
> ```yaml
> ports:
>   - "3000:3000"
> ```

---


## ☁️ Cloudflare Tunnel Exposure (WSL/Host)

To expose your local environment securely under a custom domain (e.g., `netmind-ai.yourdomain.com`) without forwarding ports or exposing public IPs, a Cloudflare Tunnel configuration is included:

1.  Configure `cloudflare-tunnel-config.yml`:
    ```yaml
    tunnel: <YOUR_TUNNEL_UUID>
    credentials-file: /home/<YOUR_WSL_USERNAME>/.cloudflared/<YOUR_TUNNEL_UUID>.json
    ingress:
      - hostname: netmind-ai.yourdomain.com
        service: http://localhost:3000
      - service: http_status:404
    ```
2.  Start the cloudflared daemon:
    ```bash
    cloudflared tunnel run <TUNNEL_NAME>
    ```

---

## 🔒 Security & Privacy

*   **Credential Shielding**: Environment files (`.env*`) and local database fallbacks (`projects.json`, `users.json`) are strictly ignored in `.gitignore` to prevent leakage to public repositories.
*   **Password Hashing**: User profiles are stored with secure scrypt-based cryptographic hashes and salt. Plaintext passwords are automatically migrated on login.
