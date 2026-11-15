# QuickSend: Architecture & Product Specifications

> **Target Deployment:** [quicksend.vercel.app](https://quicksend.vercel.app)  
> **Core Concept:** Zero-login, instant, multi-modal file and text transfer between computers and mobile devices with zero server-side data retention.

---

## 1. Architectural Philosophy & Problem Context

In educational institutions, computer labs, research centers, and public shared workstations, users frequently need to transfer files or text (documents, code snippets, PDFs, images, URLs) to and from their personal mobile devices. 

Current conventional solutions introduce major friction points:
1. **Security Vulnerabilities:** Logging into personal accounts (Google Drive, WhatsApp Web, Telegram, personal email) on public computers risks credential harvesting, shoulder surfing, and forgotten active sessions.
2. **Hardware Constraints:** Administrative policies often lock down USB ports, and USB drives risk transmitting malware across machines.
3. **Network Constraints:** Lab computers are frequently on isolated subnets, behind rigid campus firewalls, or restricted from accessing popular messaging websites.

**QuickSend** bridges this gap using browser-native technologies. By avoiding user accounts, database persistence, and cloud storage, transfers are purely ephemeral, peer-to-peer, and instant.

---

## 2. Upfront Home UX & The 5 Transfer Modes

Immediately upon opening the app, users are presented with **5 upfront transfer mode cards** reflecting their physical and network environment:

```
+-----------------------------------------------------------------------------------------------------------------------+
|                                                  QuickSend Home Hub                                                   |
+-----------------------------------------------------------------------------------------------------------------------+
       |                               |                             |                            |                 |
       v                               v                             v                            v                 v
+------------------+          +------------------+          +------------------+        +--------------------+  +---------------+
|      Mode 1      |          |      Mode 2      |          |      Mode 5      |        |       Mode 3       |  |    Mode 4     |
|     Internet     |          |    Same Wi-Fi    |          |    Via Camera    |        |  Wi-Fi + Hotspot   |  |   Bluetooth   |
|   (WebRTC P2P)   |          |  (Live Radar)    |          | (Optical Stream) |        | (Offline Transfer) |  | (Nearby/BLE)  |
+------------------+          +------------------+          +------------------+        +--------------------+  +---------------+
```

---

### Mode 1: Share via Internet (Dual WebRTC Transport + PIN / Mobile / QR)
- **Primary Use Case:** Remote or cross-network P2P transfer between any devices globally when on different networks.
- **Dual Connection Transport:**
  1. **Primary Broker:** Real-time PeerJS cloud signaling (`0.peerjs.com`) over WebSockets with zero serverless cold starts.
  2. **Secondary Fallback:** `/api/signal` REST polling with Upstash Redis or ephemeral memory store.
  3. **STUN Pool & Seamless ICE:** Expanded Google + Cloudflare STUN pool without aggressive premature timeouts.
  4. **Dynamic QR Code & Auto-Connect:** QR encodes full URL with `?room=...` query param that auto-selects Internet mode and auto-joins session seamlessly.
  5. **Flexible Pairing Keys:** 6-digit numeric PIN, mobile phone number, or custom keyword/secret.
  6. **Sequential Multi-File Batch Queue:** Seamlessly beams multiple files sequentially over an open `RTCDataChannel` without dropping connection.
  7. **SHA-256 Bit-Perfect Integrity:** Computes and verifies SHA-256 checksums on payloads with `"Verified ✓"` visual confirmation.
  8. **Large-File Disk Streaming:** File System Access API (`showSaveFilePicker`) for files > 100MB to stream chunks directly to disk.

---

### Mode 2: Same Wi-Fi (Interactive Animated Radar & Auto-Discovery)
- **Primary Use Case:** Direct LAN transfer between phones, laptops, and PCs sharing the same Wi-Fi router.
- **Interactive Radar UI & Animal Avatars:**
  - Distinct colorful creature avatars (🦊 Curious Fox, 🐬 Swift Dolphin, 🦁 Golden Lion, etc.) and OS badges for instant recognition even when mobile user-agents mask phone models. Non-colliding dynamic avatar reassignment.
  - Interactive radar plate with 360-degree sweep and pulsing concentric waves.
  - 1-Tap Direct Beaming: Select files and tap any discovered peer on the radar (or tap peer first and drop payload); direct beam signaling automatically coordinates session without manual room PIN entry.
  - Subnet grouping for all loopback and RFC 1918 private LAN IPs under `'local-lan'` for instant local dev & cross-device testing.
  - Normalizing IPv6 addresses to `/64` prefix so devices sharing a Wi-Fi router discover each other despite SLAAC privacy changes.
  - Collapsible manual fallback for 6-digit PIN and camera optical handshake (for guest Wi-Fi client isolation).

---

### Mode 5: Share via Camera (Air-Gapped Optical QR Stream)
- **Primary Use Case:** Completely air-gapped file and text transfer with **zero networks, zero internet, zero Wi-Fi, and zero Bluetooth**.
- **Visual Streaming & Parity Engine:**
  - **Sender:** Compresses files with Deflate, slices into compact base64 chunks (`QS1|...`), appends stride-grouped XOR parity frames (`QP1|...`) for automatic frame loss recovery, and cycles an animated high-contrast QR stream with speed controls (Slow 500ms, Normal 320ms, Fast 220ms) and frame scrubbers. Supports Single QR mode and high-throughput 2x2 Grid mode (4 frames per tick). Includes collapsible "Replay missing frames" section driven by typed recovery codes.
  - **Receiver:** Points camera viewfinder at sender's screen; reactive `OpticalDataCollector` captures frames in any order, tracks visual progress blocks, reconstructs dropped packets using XOR parity, supports typed recovery codes for replaying lost frames, reassembles original Blob/file upon 100% completion, verifies FNV-1a data checksum, and triggers download. Supports both Single camera scanner (`useHtml5Scanner`) and 2x2 multi-quadrant scanner (`useQuadScanner`).

---

### Mode 3: Share via Wi-Fi + Hotspot (Live Hotspot Radar & Transfer Engine)
- **Primary Use Case:** Direct peer-to-peer transfer between devices sharing a mobile hotspot or portable Wi-Fi AP.
- **Dual-Phase Architecture (Live Radar + Offline Backup):**
  - **Step 1 (Connect):** Clean, compact 2-tab setup (`Host Hotspot` | `Join Hotspot`):
    - *Host Hotspot:* 1-tap Android Hotspot Settings shortcut (`ANDROID_INTENTS.TETHER_SETTINGS`) + optional collapsible Wi-Fi QR Code generator (`WIFI:T:WPA;S:...`) for instant camera joining without forcing users to type passwords.
    - *Join Hotspot:* 1-tap Android Wi-Fi Settings shortcut (`ANDROID_INTENTS.WIFI_SETTINGS`).
  - **Step 2 (Instant Hotspot Radar — Primary Flow):** Powered directly by `useLocalDiscovery` + `useWebRTC("hotspot")`. Devices connected to the same phone hotspot (with mobile data on) discover each other automatically on the live Hotspot Radar and transfer with 1-tap beaming.
  - **Offline Backup (Collapsible):** Seamlessly tucked inside `"No mobile data? Use Offline Direct PIN / QR Pairing"` for completely air-gapped field setups without cellular data. Users can pair via 6-digit session PIN or camera QR scanner.

---

### Mode 4: Share via Bluetooth (Honest Native OS Proximity Share)
- **Primary Use Case:** Proximity sharing directly leveraging your operating system's built-in proximity hardware.
- **Architectural Reality (Honest Web Sandbox Standards):**
  - Browsers cannot act as GATT Servers or intercept raw Bluetooth radio packets due to W3C security sandboxes.
- **Streamlined User Experience:**
  - **1-Tap Device Share (Primary):** Select files or text with Dropzone and tap **"Send via Quick Share / AirDrop / Bluetooth"** (`navigator.share`). Hands payload off directly to Android Quick Share, Apple AirDrop, or Windows Bluetooth File Transfer, logging sent items to session history.
  - **Plain-English Receiving Guidance:** Clear, honest guidance explaining that incoming Bluetooth transfers are received via the device's native OS Quick Share / AirDrop / Bluetooth settings, accompanied by a 1-tap shortcut to Android Bluetooth Settings (`ANDROID_INTENTS.BLUETOOTH_SETTINGS`).
  - **Secondary Collapsible for Hardware:** Cleanly tucked secondary section `"Connect BLE Device (Sensors / Hardware)"` for hardware developers connecting to BLE microcontrollers (ESP32, Arduino) via Web-BLE GATT Client.

---

### Mode 6: Via Cable (Maximum Line-Speed Transfer)
- **Primary Use Case:** Direct wired cable transfer via USB-C to USB-C, Ethernet, or USB tethering for massive multi-gigabyte files.
- **Dual Capability:**
  - **Direct Cable Link (1–10 Gbps):** WebRTC peer connection over direct link-local IP or USB network adapter with host candidate priority, bypassing wireless congestion and cloud limits.
  - **WebUSB & Web Serial:** Direct hardware port streaming to microcontrollers and USB peripherals via W3C WebUSB and Web Serial APIs.

---

### Ultrasonic Sound Data Transfer (Experimental)
- **Primary Use Case:** Out-of-band acoustic sound data transfer located at the bottom of the home hub.
- **Mechanism:** Frequency Shift Keying (FSK) encoding hexadecimal nibbles into near-ultrasonic tones (18,000–19,800 Hz) emitted through device speakers and captured via microphone using a 4096-point FFT AnalyserNode with real-time canvas audio spectrum visualization.

---

## 3. Zero-Login UX Flow

### Home Screen Hub (Compact Option Tiles & Focused Next-Step Workspace)
Instead of overwhelming users with multi-column pricing-style cards, the interface features a clean, mobile-first design with compact option tiles (`rounded-3xl` with soft squircle icons, subtle shadows, and arrow indicators). Tapping any tile cleanly transitions into that mode's dedicated workspace with a top "← All Channels" back navigation pill:

```
[ QuickSend Home Hub ]
   ├── [ Mode 1: Internet ] ────> Opens Dedicated Workspace ────> [ Send | Receive ]
   ├── [ Mode 2: Same Wi-Fi ] ───> Opens Dedicated Workspace ────> [ Radar Discovery & Beaming ]
   ├── [ Mode 3: Hotspot ] ──────> Opens Dedicated Workspace ────> [ Host AP | Join AP ]
   ├── [ Mode 4: Bluetooth ] ────> Opens Dedicated Workspace ────> [ Native Share | BLE ]
   ├── [ Mode 5: Via Camera ] ───> Opens Dedicated Workspace ────> [ Animated QR Stream ]
   ├── [ Mode 6: Via Cable ] ────> Opens Dedicated Workspace ────> [ Direct Cable | WebUSB ]
   └── [ Ultrasonic Audio ] ────> Standalone Bottom Workspace ───> [ Speaker | Microphone ]
```

### Sender Journey
```
[ Select Mode & Action (Send) ]
            │
            ▼
[ Drop File / Paste Text ]
            │
            ▼
[ Render Session Key / QR / Hotspot / Share Sheet ]
            │
            ▼
[ Peer Connects & Approves Transfer ]
            │
            ▼
[ Streaming Progress Bar & Checksum Verification ]
            │
            ▼
[ Session Automatically Closes & Cleaned from Memory ]
```

### Receiver Journey
```
[ Select Mode & Action (Receive) ]
            │
            ▼
[ Scan Sender QR / Type 6-Digit Code / Join Hotspot ]
            │
            ▼
[ Incoming Transfer Modal: File Name, Size, Type, Preview ]
            │
            ▼
[ Accept Transfer -> In-Memory Blob Streaming ]
            │
            ▼
[ One-Click Download File / Copy Text to Clipboard ]
```

---

## 4. Offline Detection & Graceful Degradation Matrix

The application continuously monitors network connectivity using `navigator.onLine` and `window.addEventListener('online' | 'offline')`:

```
+-------------------------------------------------------------+
|               Online / Offline State Machine                |
+-------------------------------------------------------------+
               │                                │
        (State: Online)                  (State: Offline)
               │                                │
               ▼                                ▼
  +--------------------------+    +--------------------------+
  |  All 5 Modes Available   |    | Internet Mode Disabled   |
  |  - Internet (WebRTC)     |    | (Greyed out with badge)  |
  |  - Same Wi-Fi (LAN)      |    |                          |
  |  - Via Camera (Optical)  |    | Offline Modes Highlighted|
  |  - Wi-Fi Hotspot         |    | - Via Camera (Air-Gapped)|
  |  - Bluetooth / WebShare  |    | - Wi-Fi Hotspot Guide    |
  +--------------------------+    | - Same Wi-Fi (Offline QR)|
                                  | - Bluetooth / WebShare   |
                                  +--------------------------+
```

When an offline condition is detected:
- **Mode 1 (Internet):** Visually disabled (greyed out) with an informative badge: *"Requires Internet Access"*.
- **Modes 2, 3, 4 & 5:** Prominently elevated to primary actions with offline guides.

---

## 5. Honest Browser Capability Boundaries & Fallbacks

Web standards enforce security sandboxes that prevent web applications from behaving like native desktop/mobile operating system utilities. The application openly addresses these limitations through transparent user guidance:

### 1. Wi-Fi Hotspot Programmatic Control & Server Hosting
- **Limitation:** Web browsers cannot programmatically turn on a device's Wi-Fi hotspot hardware, force the OS to connect to an SSID, or host an HTTP/WebSocket server.
- **Solution & Fallback:** Rather than attempting unsupported internal APIs, the application renders a formatted Wi-Fi QR code (`WIFI:T:WPA;S:ssid;P:password;;`). Native iOS and Android camera apps automatically interpret this standard format and present a native system banner: *"Join Wi-Fi Network '...'?"*. Signaling is handled via camera-to-camera optical QR exchange without any server.

### 2. Web Bluetooth GATT Central Limitation
- **Limitation:** The Web Bluetooth API (`navigator.bluetooth`) only supports the GATT Central role (client). Browsers cannot act as a BLE Peripheral or advertise services, making direct browser-to-browser BLE transfers impossible.
- **Solution & Fallback:** Mode 4 leverages the Web Share API (`navigator.share` with file payloads) to delegate transfers to the native OS proximity systems (Quick Share, AirDrop, Windows Bluetooth File Transfer), paired with deep-links to Android Bluetooth Settings and a direct GATT Client interface for external BLE hardware.

### 3. WebRTC NAT Traversal (STUN vs. TURN)
- **Limitation:** In strict corporate or university environments with Symmetric NATs or UDP port blocking, direct peer-to-peer WebRTC connections between different networks may fail without a relay server.
- **Solution & Fallback:**
  - Initial handshake attempts direct P2P via Google and Cloudflare public STUN servers and PeerJS WebSocket broker.
  - Safe 16 KB SCTP chunking prevents message buffer overflows.
  - If ICE fails or candidate pairs cannot reach `connected` state, the UI alerts the user and suggests switching to **Same Wi-Fi**, **Via Camera**, or **Hotspot Mode**.

---

## 6. Project File Structure

Below is the complete ASCII directory tree reflecting the workspace files and directories:

```
quicksend/
├── .gitignore
├── AGENTS.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package-lock.json
├── package.json
├── README.md
├── tsconfig.json
├── vercel.json
├── vitest.config.mts
├── documentation/
│   ├── .gitkeep
│   ├── about_project.md
│   ├── backlog.md
│   └── codebase_map.md
├── public/
│   ├── favicon.ico
│   ├── icon.svg
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── sw.js
│   ├── vercel.svg
│   └── window.svg
└── src/
    ├── app/
    │   ├── api/
    │   │   ├── discover/
    │   │   │   ├── __tests__/
    │   │   │   │   └── route.test.ts
    │   │   │   └── route.ts
    │   │   ├── health/
    │   │   │   ├── __tests__/
    │   │   │   │   └── route.test.ts
    │   │   │   └── route.ts
    │   │   └── signal/
    │   │       ├── __tests__/
    │   │       │   └── route.test.ts
    │   │       └── route.ts
    │   ├── error.tsx
    │   ├── favicon.ico
    │   ├── globals.css
    │   ├── icon.svg
    │   ├── layout.tsx
    │   ├── manifest.ts
    │   └── page.tsx
    ├── components/
    │   ├── __tests__/
    │   │   ├── FileTypeBadge.test.tsx
    │   │   ├── SegmentedControl.test.tsx
    │   │   ├── SpeedIndicator.test.tsx
    │   │   └── UltrasonicCard.test.tsx
    │   ├── AppHeader.tsx
    │   ├── CableTransferCard.tsx
    │   ├── CameraStreamCard.tsx
    │   ├── Dropzone.tsx
    │   ├── EstimateBadge.tsx
    │   ├── FileTypeBadge.tsx
    │   ├── HotspotAssistantCard.tsx
    │   ├── InternetSharingCard.tsx
    │   ├── ModeSelector.tsx
    │   ├── NearbyShareCard.tsx
    │   ├── NetworkStatusBadge.tsx
    │   ├── OpticalHandshakeModal.tsx
    │   ├── QRCodeDisplay.tsx
    │   ├── QRScannerModal.tsx
    │   ├── SameNetworkCard.tsx
    │   ├── SegmentedControl.tsx
    │   ├── ServiceWorkerRegister.tsx
    │   ├── SpeedIndicator.tsx
    │   ├── ThemeToggle.tsx
    │   ├── TransferHistoryModal.tsx
    │   ├── TransferModal.tsx
    │   └── UltrasonicCard.tsx
    ├── hooks/
    │   ├── __tests__/
    │   │   ├── useHtml5Scanner.test.ts
    │   │   ├── useLocalDiscovery.test.tsx
    │   │   ├── useQuadScanner.test.ts
    │   │   ├── useTheme.test.tsx
    │   │   └── useTransferHistory.test.ts
    │   ├── useHtml5Scanner.ts
    │   ├── useLocalDiscovery.ts
    │   ├── useNearbyShare.ts
    │   ├── useNetworkStatus.ts
    │   ├── useQuadScanner.ts
    │   ├── useTheme.ts
    │   ├── useTransferHistory.ts
    │   └── useWebRTC.ts
    ├── lib/
    │   ├── __tests__/
    │   │   ├── chunker.test.ts
    │   │   ├── codeGenerator.test.ts
    │   │   ├── deviceIdentity.test.ts
    │   │   ├── diskStream.test.ts
    │   │   ├── iceConfig.test.ts
    │   │   ├── modeAvailability.test.ts
    │   │   ├── nearbyShare.test.ts
    │   │   ├── opticalDataStream.test.ts
    │   │   ├── opticalRecovery.test.ts
    │   │   ├── opticalSdp.test.ts
    │   │   ├── quadDecode.test.ts
    │   │   ├── signalStore.test.ts
    │   │   ├── transferEstimate.test.ts
    │   │   ├── ultrasonicStream.test.ts
    │   │   └── wifiQr.test.ts
    │   ├── chunker.ts
    │   ├── codeGenerator.ts
    │   ├── deviceIdentity.ts
    │   ├── diskStream.ts
    │   ├── iceConfig.ts
    │   ├── modeAvailability.ts
    │   ├── opticalDataStream.ts
    │   ├── opticalRecovery.ts
    │   ├── opticalSdp.ts
    │   ├── quadDecode.ts
    │   ├── signalStore.ts
    │   ├── signalingClient.ts
    │   ├── transferEstimate.ts
    │   ├── ultrasonicStream.ts
    │   └── wifiQr.ts
    └── types/
        ├── mode.ts
        ├── signaling.ts
        └── transfer.ts
```
