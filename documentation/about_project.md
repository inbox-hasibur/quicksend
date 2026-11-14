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
- **Visual Streaming Engine:**
  - **Sender:** Compresses files with Deflate, slices into compact base64 chunks (`QS1|...`), and cycles an animated high-contrast QR stream with speed controls (Slow 500ms, Normal 320ms, Fast 220ms) and frame scrubbers.
  - **Receiver:** Points camera viewfinder at sender's screen; reactive `OpticalDataCollector` captures frames in any order, tracks visual progress blocks, reassembles original Blob/file upon 100% completion, verifies data, and triggers download.

---

### Mode 3: Share via Wi-Fi + Hotspot (Offline Transfer Interface)
- **Primary Use Case:** Completely offline environments where neither device has access to external internet (field research stations, air-gapped lab computers, network outages).
- **Architectural Reality:** Browsers **cannot** run background HTTP web servers or WebSocket servers due to browser sandbox security models. Therefore, Mode 3 acts as an interactive transfer orchestration interface powered by the cached PWA and optical WebRTC signaling:
  - **Sender Flow:**
    1. Assists user in toggling on their mobile or laptop Wi-Fi Hotspot (provides direct OS settings deep-links where supported on Android, e.g. `intent:#Intent;action=android.settings.WIRELESS_SETTINGS;end`).
    2. Inputs Hotspot SSID and password (with 1-click random strong password generation) to generate a standard Wi-Fi configuration QR code:
       ```text
       WIFI:T:WPA;S:<SSID>;P:<Password>;;
       ```
    3. Renders the offline WebRTC SDP offer as an animated sequenced multi-frame QR carousel (`QS1|<index>/<total>|<hash>|<chunk>`) for low-res camera scannability.
  - **Receiver Flow:**
    1. Scans the Wi-Fi QR code with native phone camera or opens Wi-Fi settings (with Android settings shortcuts) to join the hotspot.
    2. Once connected to the sender's hotspot, opens the cached PWA app shell.
    3. Scans the sender's animated SDP offer QR code (with live frame collection progress `Captured X of Y frames`) or pastes code manually if camera is absent, then displays the SDP answer QR code back to the sender's camera.
  - **Data Transfer:** WebRTC `RTCDataChannel` connects over the local hotspot subnet without any internet connection.

---

### Mode 4: Share via Bluetooth (Nearby Interface)
- **Primary Use Case:** Rapid proximity sharing when no Wi-Fi router or hotspot is active.
- **Architectural Reality (GATT Central vs. Peripheral):**
  - The W3C Web Bluetooth specification (`navigator.bluetooth`) strictly implements the **GATT Central (Client)** role. Browsers **cannot** advertise as a GATT Peripheral or host a GATT Server. Consequently, direct browser-to-browser Web BLE transfer is impossible in pure web standards.
- **The Mode 4 Multi-Tiered Strategy:**
  1. **Capability Detection:** Automatically assesses browser support via `'bluetooth' in navigator` and `'share' in navigator`.
  2. **Native OS Web Share (`navigator.share` with Files):** For device-to-device transfers, prompts the native OS Share Sheet with the selected files/text. This enables the user to select system-native proximity mechanisms: **Android Quick Share / Nearby Share, Windows Bluetooth File Transfer, or macOS/iOS AirDrop**.
  3. **Android Bluetooth Settings Deep-Link:** Provides quick-launch shortcuts (`intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end`) to facilitate manual Bluetooth file reception on mobile devices.
  4. **Web Bluetooth GATT Client Interface:** For specialized hardware (BLE microcontrollers, Arduino/ESP32 data loggers, custom peripheral hardware), maintains a full Web-BLE GATT client to read/write characteristic data streams directly in the browser.

---

## 3. Zero-Login UX Flow

### Home Screen Hub (Compact Option Tiles & Focused Next-Step Workspace)
Instead of overwhelming users with multi-column pricing-style cards, the interface features a clean, mobile-first design with 5 compact option tiles (`rounded-3xl` with soft squircle icons, subtle shadows, and arrow indicators). Tapping any tile cleanly transitions into that mode's dedicated workspace with a top "← All Channels" back navigation pill:

```
[ QuickSend Home Hub ]
   ├── [ Mode 1: Internet ] ────> Opens Dedicated Workspace ────> [ Send | Receive ]
   ├── [ Mode 2: Same Wi-Fi ] ───> Opens Dedicated Workspace ────> [ Radar Discovery & Beaming ]
   ├── [ Mode 5: Via Camera ] ───> Opens Dedicated Workspace ────> [ Animated QR Stream ]
   ├── [ Mode 3: Hotspot ] ──────> Opens Dedicated Workspace ────> [ Host AP | Join AP ]
   └── [ Mode 4: Bluetooth ] ────> Opens Dedicated Workspace ────> [ Native Share | BLE ]
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
    │   │   └── SpeedIndicator.test.tsx
    │   ├── AppHeader.tsx
    │   ├── CameraStreamCard.tsx
    │   ├── Dropzone.tsx
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
    │   └── TransferModal.tsx
    ├── hooks/
    │   ├── __tests__/
    │   │   ├── useLocalDiscovery.test.tsx
    │   │   ├── useTheme.test.tsx
    │   │   └── useTransferHistory.test.ts
    │   ├── useLocalDiscovery.ts
    │   ├── useNearbyShare.ts
    │   ├── useNetworkStatus.ts
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
    │   │   ├── opticalSdp.test.ts
    │   │   ├── signalStore.test.ts
    │   │   └── wifiQr.test.ts
    │   ├── chunker.ts
    │   ├── codeGenerator.ts
    │   ├── deviceIdentity.ts
    │   ├── diskStream.ts
    │   ├── iceConfig.ts
    │   ├── modeAvailability.ts
    │   ├── opticalDataStream.ts
    │   ├── opticalSdp.ts
    │   ├── signalStore.ts
    │   ├── signalingClient.ts
    │   └── wifiQr.ts
    └── types/
        ├── mode.ts
        ├── signaling.ts
        └── transfer.ts
```
