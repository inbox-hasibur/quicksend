<div align="center">
  <img src="public/icon.svg" alt="QuickSend Logo" width="84" height="84" />
  <h1>QuickSend</h1>

  <p>
    <a href="https://quicksend.vercel.app"><img src="https://img.shields.io/badge/Live_App-quicksend.vercel.app-2563EB?style=flat-square&logo=vercel" alt="Live App" /></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16%20Turbopack-000000?style=flat-square&logo=next.js" alt="Next.js" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" /></a>
    <a href="https://webrtc.org"><img src="https://img.shields.io/badge/WebRTC-DTLS%2FSRTP%20Encrypted-F36523?style=flat-square&logo=webrtc" alt="WebRTC Encrypted" /></a>
    <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License MIT" />
    <img src="https://img.shields.io/badge/Platforms-macOS%20%7C%20Windows%20%7C%20Linux%20%7C%20iOS%20%7C%20Android-4B5563?style=flat-square" alt="Cross-Platform" />
  </p>

  <p>
    <b>English</b> • <a href="#-about-quicksend">বাংলা</a> • <a href="#-key-features">中文</a> • <a href="#-6-versatile-transfer-channels">Español</a> • <a href="#-tech-stack">Français</a> • <a href="#-local-development-setup">Português</a> • <a href="#-testing--verification">日本語</a> • <a href="#-license--credits">Deutsch</a>
  </p>

  <h3>The Zero-Login, Ephemeral Peer-to-Peer Transfer Engine for Web &amp; Mobile.</h3>

  <p>
    Transfer files of any size, directories, code snippets, or clipboard text between devices in seconds.<br />
    Direct browser-to-browser P2P with WebRTC, local subnet radar, offline hotspot, native Bluetooth/Quick Share, and air-gapped optical QR streams in one app.<br />
    <strong>No accounts. No native apps. Zero cloud storage or tracking.</strong>
  </p>

  <p>
    <a href="https://quicksend.vercel.app"><strong>🚀 Launch QuickSend Web App »</strong></a>
  </p>

  <br />

  <a href="https://quicksend.vercel.app">
    <img src="public/preview.jpg" alt="QuickSend Web App Interface Preview" width="880" style="border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.35);" />
  </a>
</div>

---

## ⚡ About QuickSend

In university computer labs, research facilities, offices, and shared workstations, transferring a file or link between a public machine and a personal phone or laptop is notoriously frustrating:

- **Security & Privacy Risks:** Logging into personal accounts (WhatsApp Web, Telegram, Google Drive, email) on untrusted shared computers exposes passwords, session tokens, and personal messages to keyloggers and shoulder surfing.
- **Port Lockdowns & Hardware Limits:** Physical USB flash drives carry malware risks and are often disabled by administrators.
- **Strict Network Environments:** University and corporate networks often enforce rigid firewalls, client isolation, or intermittent external internet connectivity.

**QuickSend** solves this with an instant, multi-modal transfer engine that runs entirely in the browser. Using direct WebRTC data channels, local subnet discovery, offline hotspot pairing, native Bluetooth/Quick Share handoff, animated optical QR streams, and wired cable links, QuickSend guarantees fast, secure, peer-to-peer data transfer in any physical or network environment.

---

## 🌟 Key Features

- 🔓 **Zero Accounts & Zero Logins:** No email, phone number, or password required. Start transferring immediately.
- 🛡️ **100% Ephemeral & End-to-End Encrypted:** Direct peer-to-peer encrypted transmission (`WebRTC DTLS/SRTP`). No files or messages are ever saved on intermediary servers.
- 💾 **Multi-Gigabyte Streaming:** Stream massive multi-gigabyte files with backpressure regulation via the browser's File System Access API without tab crashes.
- ⏱️ **Smart Transfer Time Estimation:** Dynamic, channel-aware estimate badges calculate expected transfer durations before sending based on payload size and channel throughput.
- 🔍 **Real-Time Connection Diagnostics:** Expandable diagnostic drawer displaying ICE connection states, candidate pair types (host, srflx, relay), signaling status, and one-click copyable debug reports.
- 📱 **Offline PWA & Service Worker:** Installable Progressive Web App (PWA) with client-side asset caching that runs reliably even without an active internet connection.

---

## 📡 6 Versatile Transfer Channels

QuickSend automatically adapts to your physical connectivity, offering 6 specialized channels plus experimental sound transmission:

| Channel | Connectivity | Handshake Method | Ideal Use Case |
| :--- | :--- | :--- | :--- |
| **🌐 Via Internet** | Public Internet | 6-digit PIN, Mobile #, or QR code | Remote cross-network transfers between lab PCs and external devices via WebRTC with cloud relay fallback. |
| **📶 Same Wi-Fi** | Local Wi-Fi / LAN | Automatic subnet radar (`/api/discover`) | High-speed local transfers with visual device cards, avatar emojis, and 1-tap beam requests. |
| **📱 Wi-Fi + Hotspot** | Offline / No Internet | Mobile Hotspot QR (`WIFI:S:...`) | Zero-internet field environments and isolated workstations using mobile AP credentials and offline PWA. |
| **📡 Bluetooth** | Direct Radio | OS Share Sheet (`navigator.share`) | Send files via native Bluetooth, Quick Share, or AirDrop with hardware BLE sensor connectivity (`navigator.bluetooth`). |
| **📷 Via Camera Scan** | 100% Air-Gapped | Animated 2x3 Grid Optical QR Stream | Completely isolated environments with zero radio emissions. Stream data via Base45 animated QRs with XOR parity recovery. |
| **🔌 Via Cable** | Direct Cable Link | USB-C / Ethernet / Tethering | Maximum line-speed transfers (1–10 Gbps) over wired connections with host candidate priority. |

> 🔊 **Acoustic Audio Transfer (Bonus):** QuickSend also features an experimental ultrasonic sound modem using Frequency Shift Keying (FSK) across 18,000–19,800 Hz with real-time FFT audio spectrum visualization.

---

## 🛠️ Tech Stack

- **Core Framework:** [Next.js 16](https://nextjs.org/) (App Router, Turbopack, React 19, React Compiler)
- **Language:** [TypeScript 5](https://www.typescriptlang.org/) (Strict type checking)
- **Styling & UI:** [Tailwind CSS 3.4](https://tailwindcss.com/), [lucide-react](https://lucide.dev/) icons, Glassmorphic responsive dark/light theme
- **P2P & Networking:** WebRTC (`RTCDataChannel`), STUN/TURN ICE signaling, Web Share API (`navigator.share`), Web Bluetooth (`navigator.bluetooth`)
- **Optical Engine:** [qrcode.react](https://github.com/zpao/qrcode.react), [html5-qrcode](https://github.com/mebjas/html5-qrcode), Base45 alphanumeric encoding, XOR parity forward error correction
- **Storage & State:** Ephemeral in-memory & Upstash Redis signal coordination (`signalStore`), zero database persistence
- **Audio Synthesis:** Web Audio API (`AnalyserNode`, `OscillatorNode`) for near-ultrasonic FSK modulation
- **Testing & Quality:** [Vitest 5.1](https://vitest.dev/) (35 test suites, 224 passed tests), ESLint

---

## 💻 Local Development Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.18.0 or newer recommended; Node 20+ tested)
- npm, pnpm, or yarn

### Installation & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/inbox-hasibur/quicksend.git
   cd quicksend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing & Verification

QuickSend maintains comprehensive test coverage across networking, encryption, optical encoding, and UI components:

```bash
# Run unit & integration test suite (224 tests across 35 suites)
npm test

# Run ESLint validation
npm run lint

# Production Next.js build
npm run build
```

---

## 📄 License & Credits

- **License:** [MIT License](LICENSE)
- **Developed by:** [IncodeBD](https://github.com/inbox-hasibur)
- **Online Deployment:** [quicksend.vercel.app](https://quicksend.vercel.app)
