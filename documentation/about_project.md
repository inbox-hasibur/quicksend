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
|     Internet     |          |    Same Wi-Fi    |          |    Via Camera    |        |  Wi-Fi + Hotspot   |  |  Nearby Pair  |
|   (WebRTC P2P)   |          |  (Live Radar)    |          | (Optical Stream) |        | (Offline Transfer) |  | (4-Digit PIN) |
+------------------+          +------------------+          +------------------+        +--------------------+  +---------------+
```

---

### Mode 1: Share via Internet (Zero-Knowledge Cloud Relay + 6-Digit Numeric OTP / QR)
- **Primary Use Case:** Remote or cross-network transfer between any devices globally when on different networks, with 100% firewall traversal reliability.
- **Architecture & Workflow:**
  1. **Clean 2-Tab Step-by-Step Experience:** Pure `Send | Receive` segmented wizard with zero scroll, zero WebRTC/NAT error popups, and no technical jargon.
  2. **Zero-Knowledge End-to-End Encryption:** Client derives AES-256-GCM keys client-side from a single 6-digit numeric OTP (`482 915`) and random salt. The room code is derived as `SHA-256("qs-room:" + otp6)[0..16]`; the server never sees the plaintext OTP or the decryption key.
  3. **Chunked Cloud Relay (16 MiB Chunks):** Files up to 750 MB per file (800 MB total transfer) are split into 16 MiB chunks, individually encrypted, and streamed to Upstash Blob storage with live chunk progress.
  4. **Dynamic QR Code & Auto-Connect:** Sender displays a crisp centered QR code encoding `${origin}/#otp=123456` and a large 6-digit formatted OTP with 1-click Copy OTP and Copy Link.
  5. **Instant Receiver Flow:** Receiver can scan QR or type the 6-digit OTP (with auto-formatting and instant download on 6 digits). Streams directly to disk via `diskStream.ts` for files > 100 MB.
  6. **Ephemeral Lifespan & Immediate Cleanup:** Blobs expire in 15 minutes or are instantly purged upon receiver completion via `/api/relay/complete`.

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
  - **Sender:** Compresses files with Deflate, encodes into compact Base45 alphanumeric chunks (`QS2:...`), appends stride-grouped XOR parity frames (`QP2:...`) for automatic frame loss recovery, and cycles an animated high-contrast QR stream with speed controls (Slow 500ms, Normal 320ms, Fast 220ms) and frame scrubbers. Defaults to reliable `Single` layout with `Medium` QR density (with optional high-throughput `2x2` and portrait `2x3` grids) and real-time duration estimates via `EstimateBadge`. Includes collapsible "Replay missing frames" section driven by human-readable word recovery codes.
  - **Receiver:** Points camera viewfinder at sender's screen; reactive `OpticalDataCollector` captures frames in any order, tracks visual progress blocks, reconstructs dropped packets using XOR parity, supports human-friendly word recovery codes for replaying lost frames, reassembles original Blob/file upon 100% completion, verifies FNV-1a data checksum, triggers safe auto-download, and renders a prominent "Save / Download File" card action. Supports Auto scanner (`useQuadScanner` starting with `1x1` single-QR auto-detection and rotating to `2x2`/`2x3` with persistent 720p recycled canvas to eliminate tab crashes) and Classic scanner (`useHtml5Scanner`).

---

### Mode 3: Share via Wi-Fi + Hotspot (Zero-Scroll 100% Offline Hotspot P2P)
- **Primary Use Case:** Direct peer-to-peer transfer between devices sharing a mobile hotspot or portable Wi-Fi AP, completely independent of internet connectivity or cellular data.
- **Unified 100% Offline Optical QR Architecture:**
  - **Identical Experience on Both Devices:** Eliminates the online/offline mismatch where one device had mobile data on while the other did not. Both devices now share the exact same clean, deterministic flow powered exclusively by `useOfflineHotspotRTC` and single static `QS3:` QR exchange via `OpticalHandshakeModal`. (Mode 2 `Same Wi-Fi` remains dedicated for online local LAN Radar discovery).
  - **Sender Flow:** Select files or text via `Dropzone` with `EstimateBadge`, tap "Send", and display 1 static Offer QR. Tap "Step 2: Scan Receiver's QR", scan the receiver's static Answer QR, and the WebRTC DataChannel connection establishes instantly with auto-send into `TransferModal`.
  - **Receiver Flow:** Tap "Scan Sender's QR", scan the sender's single Offer QR, display 1 static Answer QR for the sender to scan, and accept the incoming transfer in `TransferModal`.
  - **Zero-Friction UX:** Zero artificial SSID/password forms, no complex PIN submenus, and a 1-line helper bar with native Android Tethering and Wi-Fi settings shortcuts (`ANDROID_INTENTS.TETHER_SETTINGS`, `ANDROID_INTENTS.WIFI_SETTINGS`).

---

### Mode 4: Share via Bluetooth (System Bluetooth, Quick Share & BLE Hardware)
- **Primary Use Case:** Direct file sending via native operating system radio sheet (Bluetooth, Quick Share, AirDrop) and W3C Web Bluetooth GATT hardware interfacing.
- **Architecture & Workflow:**
  - **Step 1:** Select files or text via `Dropzone` with real-time transfer duration estimate (`EstimateBadge`).
  - **Step 2:** One-tap native handoff via W3C Web Share API (`navigator.share({ files, text })`), logging sent transfers to `useTransferHistory`.
  - **Honest Receiving Guidance:** Transparent explanation that browsers cannot intercept raw incoming Bluetooth radio packets due to sandbox security boundaries; provides 1-tap Android Bluetooth settings shortcut (`ANDROID_INTENTS.BLUETOOTH_SETTINGS`) and guides users to Wi-Fi Hotspot for browser-to-browser offline transfers.
  - **BLE Hardware Interfacing:** Collapsible section for discovering and connecting to Bluetooth Low Energy (BLE) peripherals and sensors via `navigator.bluetooth`.

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
Instead of overwhelming users with multi-column pricing-style cards, the interface features a clean, mobile-first design with compact option tiles (`rounded-3xl` with soft squircle icons, subtle shadows, and arrow indicators). Tapping any tile cleanly transitions into that mode's dedicated workspace with a top "← All Channels" back navigation pill, and tapping the AppHeader brand logo resets navigation back to Home from any channel.

- **Universal Cancellation & No Forced Timeouts:** Transfer modal and connection routines allow users to cancel immediately via an explicit "Cancel Transfer" button, header close `X`, or `Escape` key at any stage (connecting, waiting, or transferring) without false error prompts. WebRTC connections stay open persistently until user cancellation or permanent ICE failure after automated ICE restart.

```
[ QuickSend Home Hub ]
   ├── [ Mode 1: Internet ] ────> Opens Dedicated Workspace ────> [ Send | Receive ]
   ├── [ Mode 2: Same Wi-Fi ] ───> Opens Dedicated Workspace ────> [ Radar Discovery & Beaming ]
   ├── [ Mode 3: Hotspot ] ──────> Opens Dedicated Workspace ────> [ Host AP | Join AP ]
   ├── [ Mode 4: Nearby Pair ] ──> Opens Dedicated Workspace ────> [ Tap Peer | 4-Digit PIN | System Share ]
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
├── README.md
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
├── vercel.json
├── vitest.config.mts
├── documentation/
│   ├── archive/
│   │   └── backlog_sprints_old.md
│   ├── about_project.md
│   ├── backlog.md
│   └── codebase_map.md
├── public/
│   ├── favicon.ico
│   ├── icon.svg
│   ├── preview.jpg
│   └── sw.js
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
    │   │   ├── relay/
    │   │   │   ├── __tests__/
    │   │   │   │   ├── cleanup.test.ts
    │   │   │   │   ├── route.test.ts
    │   │   │   │   └── upload.test.ts
    │   │   │   ├── attach/
    │   │   │   │   └── route.ts
    │   │   │   ├── cleanup/
    │   │   │   │   └── route.ts
    │   │   │   ├── complete/
    │   │   │   │   └── route.ts
    │   │   │   ├── status/
    │   │   │   │   └── route.ts
    │   │   │   └── upload/
    │   │   │       └── route.ts
    │   │   ├── signal/
    │   │   │   ├── __tests__/
    │   │   │   │   └── route.test.ts
    │   │   │   └── route.ts
    │   │   └── turn/
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
    │   │   ├── CableTransferCard.test.tsx
    │   │   ├── CameraStreamCard.test.tsx
    │   │   ├── ConnectionDiagnostics.test.tsx
    │   │   ├── DirectConnectPanel.test.tsx
    │   │   ├── FileTypeBadge.test.tsx
    │   │   ├── HotspotAssistantCard.test.tsx
    │   │   ├── NearbyShareCard.test.tsx
    │   │   ├── RadarPanel.test.tsx
    │   │   ├── SegmentedControl.test.tsx
    │   │   ├── SpeedIndicator.test.tsx
    │   │   ├── TransferModal.test.tsx
    │   │   └── UltrasonicCard.test.tsx
    │   ├── camera/
    │   │   ├── __tests__/
    │   │   │   └── CameraParts.test.tsx
    │   │   ├── CameraReceiver.tsx
    │   │   ├── CameraSender.tsx
    │   │   ├── ReceiverCompleteView.tsx
    │   │   └── ReceiverProgressView.tsx
    │   ├── AppHeader.tsx
    │   ├── CableTransferCard.tsx
    │   ├── CameraStreamCard.tsx
    │   ├── ConnectionDiagnostics.tsx
    │   ├── DirectConnectPanel.tsx
    │   ├── Dropzone.tsx
    │   ├── EstimateBadge.tsx
    │   ├── FileTypeBadge.tsx
    │   ├── HotspotAssistantCard.tsx
    │   ├── InternetSharingCard.tsx
    │   ├── ModeSelector.tsx
    │   ├── NearbyShareCard.tsx
    │   ├── OpticalHandshakeModal.tsx
    │   ├── QRCodeDisplay.tsx
    │   ├── QRScannerModal.tsx
    │   ├── RadarPanel.tsx
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
    │   │   ├── nearbyShare.test.ts
    │   │   ├── useHtml5Scanner.test.ts
    │   │   ├── useLocalDiscovery.test.tsx
    │   │   ├── useOfflineHotspotRTC.test.ts
    │   │   ├── useQuadScanner.test.ts
    │   │   ├── useRelayTransfer.test.ts
    │   │   ├── useTheme.test.tsx
    │   │   ├── useTransferHistory.test.ts
    │   │   └── useWebRTC.test.ts
    │   ├── useHtml5Scanner.ts
    │   ├── useLocalDiscovery.ts
    │   ├── useNearbyShare.ts
    │   ├── useNetworkStatus.ts
    │   ├── useOfflineHotspotRTC.ts
    │   ├── usePwaInstall.ts
    │   ├── useQuadScanner.ts
    │   ├── useRelayTransfer.ts
    │   ├── useTheme.ts
    │   ├── useTransferHistory.ts
    │   └── useWebRTC.ts
    ├── lib/
    │   ├── webrtc/
    │   │   ├── backpressure.ts
    │   │   ├── diagnostics.ts
    │   │   ├── index.ts
    │   │   ├── peerJsHelper.ts
    │   │   └── types.ts
    │   ├── __tests__/
    │   │   ├── base45.test.ts
    │   │   ├── chunker.test.ts
    │   │   ├── codeGenerator.test.ts
    │   │   ├── deviceIdentity.test.ts
    │   │   ├── diskStream.test.ts
    │   │   ├── iceConfig.test.ts
    │   │   ├── modeAvailability.test.ts
    │   │   ├── opticalDataStream.test.ts
    │   │   ├── opticalRecovery.test.ts
    │   │   ├── opticalSdp.test.ts
    │   │   ├── quadDecode.test.ts
    │   │   ├── rateLimit.test.ts
    │   │   ├── relayCrypto.test.ts
    │   │   ├── signalStore.test.ts
    │   │   ├── transferEstimate.test.ts
    │   │   ├── ultrasonicStream.test.ts
    │   │   └── wifiQr.test.ts
    │   ├── base45.ts
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
    │   ├── rateLimit.ts
    │   ├── recoveryWords.ts
    │   ├── relayCrypto.ts
    │   ├── signalingClient.ts
    │   ├── signalStore.ts
    │   ├── transferEstimate.ts
    │   ├── ultrasonicStream.ts
    │   ├── upstashBlob.ts
    │   └── wifiQr.ts
    └── types/
        ├── mode.ts
        ├── signaling.ts
        └── transfer.ts
```
