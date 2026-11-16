<div align="center">
  <img src="public/icon.svg" alt="QuickSend Logo" width="84" height="84" />
  <h1>QuickSend</h1>

  <p>
    <a href="https://quicksend.vercel.app"><img src="https://img.shields.io/badge/Live_App-quicksend.vercel.app-2563EB?style=flat-square&logo=vercel" alt="Live App" /></a>
    <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16%20Turbopack-000000?style=flat-square&logo=next.js" alt="Next.js" /></a>
    <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat-square&logo=typescript" alt="TypeScript" /></a>
    <a href="https://tailwindcss.com"><img src="https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?style=flat-square&logo=tailwind-css" alt="Tailwind CSS" /></a>
    <a href="https://webrtc.org"><img src="https://img.shields.io/badge/WebRTC-Encrypted%20P2P-F36523?style=flat-square&logo=webrtc" alt="WebRTC Encrypted" /></a>
  </p>

  <h3>The Zero-Login, Ephemeral Peer-to-Peer Transfer Engine for Web &amp; Mobile.</h3>

  <p>
    Transfer files of any size, directories, code snippets, or clipboard text between devices in seconds.<br />
    Direct browser-to-browser transfer across any network, local Wi-Fi, offline hotspot, Bluetooth, and air-gapped camera scan.
  </p>

  <p>
    <a href="https://quicksend.vercel.app">
      <img src="https://img.shields.io/badge/%F0%9F%9A%80%20Launch%20QuickSend-quicksend.vercel.app-2563EB?style=for-the-badge&logo=vercel&logoColor=white" alt="Launch QuickSend Web App" />
    </a>
  </p>

  <br />

  <a href="https://quicksend.vercel.app">
    <img src="public/preview.png" alt="QuickSend Web App Interface Preview" width="900" style="border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.35);" />
  </a>
</div>

---

## ⚡ What is QuickSend?

QuickSend lets you beam files and text between phones, laptops, and PCs instantly in your web browser. No accounts, no apps to install, and no files uploaded to cloud servers.

Whether you're in a university lab, sharing a video with a friend, or transferring code between workstations, QuickSend adapts to your environment with 6 fast transfer channels.

---

## ✨ Key Features

- ⚡ **Direct Peer-to-Peer:** Data transfers directly from device to device without an intermediary server.
- 🔒 **Zero Server Storage:** Your files never touch a cloud server and are never saved in any database.
- 🔓 **No Accounts or Logins:** Start transferring instantly upon opening the page. No emails, phone numbers, or passwords.
- 📦 **Files & Text of Any Size:** Send photos, large videos, folders, code snippets, or clipboard text with streaming disk downloads.
- ⏱️ **Instant Time Estimates:** Automatic badges display estimated transfer time before and during transfers.
- 📱 **Works Offline (PWA):** Installable web app that runs offline using mobile hotspots, camera QR streams, or cables.

---

## 📡 6 Transfer Channels

| Channel | Method | How It Works |
| :--- | :--- | :--- |
| **🌐 Via Internet** | 6-Digit PIN, Mobile #, or QR Code | Fast remote transfers across different networks and cellular data. |
| **📡 Same Wi-Fi** | Local Radar Discovery | Finds and beams files to other devices connected to the same Wi-Fi router. |
| **📶 Wi-Fi Hotspot** | Mobile Hotspot QR Scan | Connects devices directly through a phone's portable hotspot with no internet. |
| **🔵 Bluetooth** | System Share Sheet | Quick handoff via native Bluetooth, Quick Share, or AirDrop. |
| **📷 Via Camera Scan** | Animated QR Code Stream | 100% air-gapped transfer by scanning animated QR codes with a camera. |
| **🔌 Via Cable** | Direct Cable Link | Maximum line speed transfer over direct USB-C, Ethernet, or USB tethering. |

---

## 💻 Quick Start & Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/inbox-hasibur/quicksend.git
cd quicksend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔒 Privacy & Security

- **Direct Memory & Disk:** Transferred chunks flow straight to local memory or disk without server storage.
- **End-to-End Encrypted:** WebRTC transfers are encrypted end-to-end between browsers.
- **Air-Gapped Optical Mode:** Mode 5 uses pure light (screen to camera) for isolated environments.
- **Zero Tracking:** No tracking cookies, user profiling, or third-party ads.

---

## 📄 License

- **License:** [MIT License](LICENSE)
- **Author & Maintainer:** [IncodeBD / Hasibur](https://github.com/inbox-hasibur)
- **Live App:** [quicksend.vercel.app](https://quicksend.vercel.app)
