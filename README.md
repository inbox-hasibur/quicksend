# QuickSend ⚡

> **Zero-login, instant, peer-to-peer file & text sharing across devices in your browser.**  
> Target Deployment: [quicksend.vercel.app](https://quicksend.vercel.app)

---

## 🎯 Problem Statement

In university computer labs, research facilities, offices, and co-working spaces, sharing a file or snippet of text between a public/lab workstation and a personal smartphone or laptop is notoriously frustrating:

- **Security Risks & Credential Leakage:** Logging into personal accounts (WhatsApp Web, Telegram, Google Drive, email) on shared or untrusted lab computers puts passwords, session tokens, and personal messages at risk.
- **Clunky Workarounds:** Manually typing long URLs, emailing files to burner inboxes, or carrying physical USB flash drives (which risk malware propagation and may be port-disabled by administrators) wastes valuable time.
- **Network & Connectivity Hurdles:** University and corporate networks often impose strict guest firewalls, client isolation, or intermittent external internet access.

**QuickSend** solves this with a zero-friction, zero-login, browser-based web application that connects devices in seconds using short codes, dynamic QR codes, WebRTC direct data channels, local network discovery, Wi-Fi hotspot pairing, and Web Bluetooth interfaces.

---

## 🚀 Core Transfer Modes

QuickSend features a versatile multi-modal transfer architecture designed for every environment:

| Mode | Connectivity | Discovery / Handshake | Ideal Use Case |
| :--- | :--- | :--- | :--- |
| **1. Share via Internet** | Public Internet | 6-digit room code / Dynamic QR code | Lab PC to remote phone or across different networks. WebRTC peer-to-peer encrypted data channel. |
| **2. Same Network Wi-Fi** | Local Area Network | Subnet discovery / Local signaling | Fast high-throughput transfer of large files between devices on the same Wi-Fi/LAN router. |
| **3. Wi-Fi + Hotspot** | Offline / No Internet | Hotspot Wi-Fi QR credential (`WIFI:S:...`) | Zero-internet environments (field research, isolated labs, air-gapped workstations). |
| **4. Bluetooth Interface** | Device Proximity | Web Bluetooth API (`navigator.bluetooth`) | Ultra-close range transfers without needing Wi-Fi or router infrastructure. |

### 📱 Offline PWA & Graceful Degradation
- **Progressive Web App (PWA):** Installable on Android, iOS, Windows, macOS, and Linux.
- **Offline Caching:** The application shell, QR generators, and offline utilities work without an active internet connection.
- **Adaptive UI:** Built-in connection state monitors detect when devices drop offline, gracefully greying out internet-dependent modes while prioritizing local Wi-Fi and Bluetooth modes.

---

## 🛠️ Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **UI & Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Icons:** [lucide-react](https://lucide.dev/)
- **QR Code Tools:** [qrcode.react](https://github.com/zpao/qrcode.react) (generator) & [html5-qrcode](https://github.com/mebjas/html5-qrcode) (scanner)
- **P2P Protocols:** WebRTC (RTCDataChannel), Web Bluetooth API
- **Code Quality:** [ESLint](https://eslint.org/)

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

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open in browser:**
   Navigate to [http://localhost:3000](http://localhost:3000).

5. **Lint and Production Build:**
   ```bash
   # Run linter
   npm run lint

   # Build for production
   npm run build

   # Start production server
   npm run start
   ```

---

## 📂 Project Structure

```
quicksend/
├── documentation/          # Architectural specs, RFCs, and project documentation
│   └── about_project.md    # In-depth architectural & capabilities specification
├── public/                 # Static assets, SVG icons, and PWA assets
├── src/
│   ├── app/                # Next.js App Router (pages, layout, manifest)
│   │   ├── globals.css     # Global styles & Tailwind configuration
│   │   ├── layout.tsx      # Root HTML shell & metadata
│   │   ├── manifest.ts     # Web App Manifest for PWA installation
│   │   └── page.tsx        # QuickSend landing & transfer interface
│   ├── components/         # Reusable UI components (Modals, QR Scanner, Dropzone)
│   ├── hooks/              # Custom React hooks (useWebRTC, useNetworkStatus, etc.)
│   ├── lib/                # Core utilities (WebRTC signaling, QR helpers, Bluetooth)
│   └── types/              # TypeScript interfaces & protocol schemas
├── eslint.config.mjs       # ESLint flat configuration
├── next.config.ts          # Next.js configuration
├── package.json            # Project dependencies and scripts
└── tsconfig.json           # TypeScript configuration
```

---

## 🔒 Privacy & Security First

- **Zero Accounts / Zero Login:** No email, phone number, or password required.
- **Ephemeral Transfers:** Files are transferred directly peer-to-peer via encrypted channels (`WebRTC DTLS/SRTP`); no file contents are ever stored on intermediary servers.
- **Instant Room Expiry:** Room pairing keys and QR codes self-destruct once transfer sessions conclude or time out.

---

## 📄 Documentation

For deep technical details regarding WebRTC signaling, Web Bluetooth GATT characteristics, browser capability matrixes, and offline fallbacks, see [documentation/about_project.md](documentation/about_project.md).
