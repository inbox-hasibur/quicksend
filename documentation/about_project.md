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

## 2. Upfront Home UX & The 4 Transfer Modes

Immediately upon opening the app, users are presented with **4 upfront transfer mode cards** reflecting their physical and network environment:

```
+---------------------------------------------------------------------------------------------------------+
|                                           QuickSend Home Hub                                             |
+---------------------------------------------------------------------------------------------------------+
       |                               |                              |                            |
       v                               v                              v                            v
+------------------+          +------------------+          +--------------------+       +----------------+
|      Mode 1      |          |      Mode 2      |          |       Mode 3       |       |     Mode 4     |
|     Internet     |          |   Same Wi-Fi     |          |  Wi-Fi + Hotspot   |       |   Bluetooth    |
|   (WebRTC P2P)   |          |  (Local Subnet)  |          | (Offline Transfer) |       |  (Nearby/BLE)  |
+------------------+          +------------------+          +--------------------+       +----------------+
       |                               |                              |                            |
       +--> Select Format:             +--> Local LAN WebRTC          +--> Send: Hotspot Setup     +--> WebShare
            - Unique Code (6-digit)         (Host ICE priority)            + WIFI:T:WPA QR              (Files/AirDrop)
            - QR Code (Scan/Display)        Fallback: Camera               + Offline SDP QR Handshake   + Settings Link
       +--> Choose Action:                  QR SDP Handshake          +--> Receive: QR Join Wi-Fi  +--> GATT Client
            - Send / Receive                                               + Offline SDP QR Handshake   (Peripherals)
```

---

### Mode 1: Share via Internet (WebRTC P2P via PIN, Mobile Number, Keyword, or QR)
- **Primary Use Case:** When both the lab PC and mobile device have general internet access, but cannot discover each other on a local subnet due to campus AP client isolation.
- **Workflow & Key Strategy Options:**
  1. **Flexible Pairing Key:** Users can pair via multiple memorable methods (4–20 alphanumeric chars supported across both devices):
     - **Auto PIN:** Fast 6-digit auto-generated numeric PIN (e.g. `834-291`).
     - **Mobile Number:** Enter your own memorized phone number (e.g. `01712345678`) so you don't need to memorize a new PIN.
     - **Custom Keyword / Secret:** Type a familiar unique keyword or code phrase (e.g. `HR998877`).
     - **QR Code:** Instant one-click camera scanning bypassing all manual typing.
  2. **Role Selection:** User chooses **Send** (upload files/paste text, select pairing strategy, generate room code/QR) or **Receive** (enter PIN, phone number, keyword, or scan QR with camera).
- **Protocol:** WebRTC Data Channel (`RTCDataChannel`) with lightweight serverless signaling.
- **Handshake Mechanism:**
  - Signaling coordinates SDP offer, answer, and ICE candidates via public STUN servers.
  - Once peers connect via DTLS/SCTP, the signaling channel is released.
  - Files and text are streamed directly peer-to-peer with end-to-end encryption.

---

### Mode 2: Share via Same Network (Wi-Fi LAN)
- **Primary Use Case:** High-speed, high-bandwidth local transfers (e.g., video recordings, large datasets) when both devices share the same local Wi-Fi or wired network.
- **Protocol:** Local WebRTC prioritizing internal network interfaces.
- **Handshake Mechanism:**
  - Signaling prioritizes `host` ICE candidates (RFC 1918 private IPv4 addresses: `192.168.x.x`, `10.x.x.x`, `172.16.x.x` or link-local IPv6).
  - Keeps data traffic strictly within the local switch/router, bypassing external WAN bandwidth caps and campus firewall throttling.
  - **No-Internet LAN Fallback:** If the local Wi-Fi router does not have WAN/internet access to reach the public signaling relay, the UI seamlessly falls back to the **Camera-to-Camera Optical QR Handshake** (Mode 3 engine) to exchange SDP offers/answers offline across the room while streaming data over the local LAN.

---

### Mode 3: Share via Wi-Fi + Hotspot (Offline Transfer Interface)
- **Primary Use Case:** Completely offline environments where neither device has access to external internet (field research stations, air-gapped lab computers, network outages).
- **Architectural Reality:** Browsers **cannot** run background HTTP web servers or WebSocket servers due to browser sandbox security models. Therefore, Mode 3 acts as an interactive transfer orchestration interface powered by the cached PWA and optical WebRTC signaling:
  - **Sender Flow:**
    1. Assists user in toggling on their mobile or laptop Wi-Fi Hotspot (provides direct OS settings deep-links where supported on Android, e.g. `intent:#Intent;action=android.settings.WIRELESS_SETTINGS;end`).
    2. Inputs Hotspot SSID and password to generate a standard Wi-Fi configuration QR code:
       ```text
       WIFI:T:WPA;S:<SSID>;P:<Password>;;
       ```
    3. Renders the offline WebRTC SDP offer as an animated/compressed QR code for optical pairing.
  - **Receiver Flow:**
    1. Scans the Wi-Fi QR code with native phone camera or opens Wi-Fi settings (with Android settings shortcuts) to join the hotspot.
    2. Once connected to the sender's hotspot, opens the cached PWA app shell.
    3. Scans the sender's SDP offer QR code and displays the SDP answer QR code back to the sender's camera.
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
Instead of overwhelming users with multi-column pricing-style cards, the interface features a clean, mobile-first design with 4 compact option tiles (`rounded-3xl` with soft squircle icons, subtle shadows, and arrow indicators). Tapping any tile cleanly transitions into that mode's dedicated workspace with a top "← All Modes" back navigation pill:

```
[ QuickSend Home Hub ]
   ├── [ Mode 1: Internet ] ────> Opens Dedicated Workspace ────> [ Send | Receive ]
   ├── [ Mode 2: Same Wi-Fi ] ───> Opens Dedicated Workspace ────> [ LAN Send | Optical Receive ]
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

## 4. Offline PWA Caching & Graceful Degradation

### Service Worker Caching Architecture
- **Application Shell:** HTML, CSS, JavaScript bundles, static SVG assets, and font files are pre-cached upon initial load.
- **Tooling Libraries:** Client-side QR generator (`qrcode.react`), camera QR scanner (`html5-qrcode`), and crypto hashing utilities function completely offline.
- **Manifest:** Configured via `src/app/manifest.ts` allowing users to install "QuickSend" to their desktop or home screen for instant offline access.

### Dynamic Network State Detection
The application actively monitors network state via:
- `navigator.onLine`
- `window.addEventListener('online', ...)`
- `window.addEventListener('offline', ...)`

```
+-------------------------------------------------------------+
|                     Online Status Detection                 |
+-------------------------------------------------------------+
               │                                │
        (State: Online)                  (State: Offline)
               │                                │
               ▼                                ▼
  +--------------------------+    +--------------------------+
  |  All 4 Modes Available   |    | Internet Mode Disabled   |
  |  - Internet (WebRTC)     |    | (Greyed out with badge)  |
  |  - Same Wi-Fi (LAN)      |    |                          |
  |  - Wi-Fi Hotspot         |    | Offline Modes Highlighted|
  |  - Bluetooth / WebShare  |    | - Wi-Fi Hotspot Guide    |
  +--------------------------+    | - Same Wi-Fi (Offline QR)|
                                  | - Bluetooth / WebShare   |
                                  +--------------------------+
```

When an offline condition is detected:
- **Mode 1 (Internet):** Visually disabled (greyed out) with an informative badge: *"Requires Internet Access"*.
- **Modes 2, 3 & 4:** Prominently elevated to primary actions with offline guides.

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
  - Initial handshake attempts direct P2P via Google's public STUN servers.
  - If ICE gathering fails or candidate pairs cannot reach `connected` state within a fallback timeout window (10 seconds), the UI alerts the user and suggests switching to **Same Wi-Fi** or **Hotspot Mode**.

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
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── sw.js
│   ├── vercel.svg
│   └── window.svg
└── src/
    ├── app/
    │   ├── api/
    │   │   └── signal/
    │   │       ├── __tests__/
    │   │       │   └── route.test.ts
    │   │       └── route.ts
    │   ├── favicon.ico
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── manifest.ts
    │   └── page.tsx
    ├── components/
    │   ├── .gitkeep
    │   ├── AppHeader.tsx
    │   ├── Dropzone.tsx
    │   ├── HotspotAssistantCard.tsx
    │   ├── InternetSharingCard.tsx
    │   ├── ModeSelector.tsx
    │   ├── NearbyShareCard.tsx
    │   ├── NetworkStatusBadge.tsx
    │   ├── OpticalHandshakeModal.tsx
    │   ├── QRCodeDisplay.tsx
    │   ├── QRScannerModal.tsx
    │   ├── SameNetworkCard.tsx
    │   ├── ServiceWorkerRegister.tsx
    │   ├── TransferHistoryModal.tsx
    │   └── TransferModal.tsx
    ├── hooks/
    │   ├── .gitkeep
    │   ├── useNearbyShare.ts
    │   ├── useNetworkStatus.ts
    │   ├── useTransferHistory.ts
    │   └── useWebRTC.ts
    ├── lib/
    │   ├── __tests__/
    │   │   ├── chunker.test.ts
    │   │   ├── codeGenerator.test.ts
    │   │   ├── modeAvailability.test.ts
    │   │   ├── nearbyShare.test.ts
    │   │   ├── opticalSdp.test.ts
    │   │   └── wifiQr.test.ts
    │   ├── .gitkeep
    │   ├── chunker.ts
    │   ├── codeGenerator.ts
    │   ├── modeAvailability.ts
    │   ├── opticalSdp.ts
    │   ├── signalingClient.ts
    │   └── wifiQr.ts
    └── types/
        ├── .gitkeep
        ├── mode.ts
        ├── signaling.ts
        └── transfer.ts
```
