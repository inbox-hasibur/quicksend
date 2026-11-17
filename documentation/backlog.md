# QuickSend: Product Backlog & Major Milestone Roadmap

> **Target Deployment:** [quicksend.vercel.app](https://quicksend.vercel.app)  
> **Status Legend:** `[x]` Completed | `[ ]` Pending

---

## Section 1: Complete Feature List

### 1. Zero-Login Core Interface & 6-Channel Option Grid
- **Zero-Login Experience:** No accounts, passwords, email verifications, or authentication barriers.
- **6-Channel Option Tiles:** Clean, uncluttered option tiles (`rounded-3xl` with squircle icons and arrow indicators) in a responsive grid.
- **Dedicated Focused Workspace:** Selecting any channel smoothly transitions into its dedicated workspace with an "← All Channels" return pill.
- **Segmented Control Pill Styling:** Modern segmented pill toggles (`Send | Receive`, `Files | Text`, pairing strategies).
- **Responsive Layout:** Mobile-first design optimized for smartphones, tablets, laptops, and lab desktop monitors.
- **Theme System:** Semantic theme tokens for light and dark modes with high-contrast surfaces.

### 2. Mode 1: Via Internet (6-Digit PIN, Mobile #, Custom Keyword & QR)
- **Co-Located QR & PIN:** Simultaneous scannable QR code and 6-digit PIN on both Send and Receive views.
- **Flexible Pairing Keys:** Auto 6-digit random PIN, memorized phone number, or custom unique keyword (4–20 characters).
- **Dual Signaling Transport:** Low-latency PeerJS WebSocket cloud broker (`0.peerjs.com`) with concurrent `/api/signal` REST fallback.
- **Dynamic TURN Relay:** Automatic `/api/turn` credential injection for CGNAT mobile data (4G/5G) and enterprise firewall traversal.
- **Smart Connection Watchdog:** 12-second signaling and 15-second ICE watchdog distinguishing room availability from firewall blocks.

### 3. Mode 2: Same Wi-Fi (Subnet Radar & 1-Tap Beaming)
- **Automatic Subnet Discovery:** Zero-config peer discovery via `/api/discover` grouping devices by local Wi-Fi router.
- **Interactive 360° Radar:** Visual radar ring animation rendering identity avatars and nearby device nodes in orbit.
- **1-Tap Beaming:** Beam selected files directly to any discovered peer with one tap.
- **Direct IP-to-IP Data Channel:** Host candidate prioritization routing transfers over local LAN to bypass internet WAN bandwidth limits.
- **Nearby PIN / QR Fallback:** Collapsible 4-digit code and direct PIN/QR entry when router client isolation is active.

### 4. Mode 3: Wi-Fi Hotspot (Direct AP Transfer)
- **Guided Offline AP Workflow:** Step-by-step assistant for turning on portable mobile hotspot with 1-tap Android settings shortcuts.
- **Standardized Wi-Fi QR:** Generates `WIFI:T:WPA;S:<SSID>;P:<Password>;;` QR codes readable natively by iOS and Android cameras.
- **Offline PWA Operation:** Fully functional cached PWA shell transferring over local hotspot Wi-Fi without active internet.
- **Hotspot Radar & Direct Connect:** Unified peer radar and direct PIN/QR connection panels.

### 5. Mode 4: Bluetooth (Direct Radio & Native Share)
- **Browser-Honest Architecture:** Transparently respects browser sandbox limits (GATT Central only, cannot act as BLE Peripheral/Server).
- **Native OS Share Sheet Integration:** Direct handoff via `navigator.share` with file payloads to Quick Share, Nearby Share, AirDrop, or Bluetooth.
- **Hardware GATT Client:** Optional Web Bluetooth client connecting to external BLE sensors and microcontrollers.
- **System Settings Deep-Links:** Quick launch shortcuts to device Bluetooth settings.

### 6. Mode 5: Via Camera Scan (100% Air-Gapped Optical Data Stream)
- **Zero-Radio Optical Transfer:** Transmits data strictly via visual light (screen-to-camera) with zero electromagnetic emissions.
- **High-Density QR Streaming:** Slices payloads into sequenced Base45 frames (`QS2:...`) playing at configurable speeds and density.
- **XOR Parity Loss Recovery:** Interleaved parity packets (`QP2:...`) reconstructing dropped camera frames without re-transmission.
- **Multi-Layout Viewfinder:** Supports 1x1, 2x2, and 2x3 QR layouts with automatic single-stream camera scanner and instant save/download.

### 7. Mode 6: Via Cable (Direct USB-C / Ethernet / Tethering)
- **Maximum Line-Speed Transfer:** Transmits at 1–10 Gbps over direct USB-C, Ethernet crossover, or USB tethering cables.
- **Android USB Tethering Shortcut:** 1-tap deep link to Android tethering configuration settings.
- **Direct Connect Panel:** Local PIN display, Show QR button, peer PIN input, and camera QR scanning.
- **Experimental Ultrasonic Data Stream:** Acoustic Frequency Shift Keying (FSK) converting text into high-frequency sound tones (18–20 kHz).

### 8. Progressive Web App (PWA) & Offline Shell
- **Installable PWA:** Full manifest configuration (`src/app/manifest.ts`) with custom icons and standalone display mode.
- **Service Worker Caching:** Public service worker (`public/sw.js`) caching core assets, fonts, icons, and client logic with strict `/api/*` bypass.
- **Real-Time Network Status:** Real-time online/offline event listener dynamically adapting mode availability.

### 9. File Pipeline, Streaming Disk Writer & Ephemeral History
- **Direct Disk Streaming:** Integrates File System Access API (`window.showSaveFilePicker`) for large files (> 100MB) to prevent tab memory crashes.
- **SCTP Backpressure Management:** 16 KB chunking with buffer drain regulation for smooth multi-megabyte transfers.
- **Bit-Perfect Checksums:** Optional SHA-256 integrity verification with visual verified badge.
- **Ephemeral Session History:** Session drawer tracking transfers during active tab lifecycle with 1-click re-download or text copy.

---

## Section 2: Major Milestone Sprints Roadmap

### Sprint 1: Foundation & Offline PWA Shell
- [x] Scaffolded Next.js 16 (App Router, TypeScript, Tailwind CSS, ESLint) project structure.
- [x] Implemented PWA readiness with `src/app/manifest.ts` and offline Service Worker (`public/sw.js`).
- [x] Created `useNetworkStatus` hook and dynamic mode availability logic.
- [x] Established automated Vitest testing environment with happy-dom.

### Sprint 2: Core UI & Mode 1 Internet Sharing
- [x] Built core responsive home interface with squircle channel option cards.
- [x] Implemented Mode 1 WebRTC data channels with 64KB/16KB chunking and progress modal.
- [x] Built ephemeral signaling API (`/api/signal`) and 6-digit room code generation.
- [x] Integrated `qrcode.react` generator and `html5-qrcode` camera scanner.

### Sprint 3: Mode 2 Same Wi-Fi Radar & Mode 3 Hotspot P2P
- [x] Implemented subnet discovery route (`/api/discover`) with host candidate prioritization.
- [x] Built interactive 360° device radar with animal identity avatars (Fox, Dolphin, Lion).
- [x] Created Mode 3 Wi-Fi hotspot setup guide and `WIFI:T:WPA;S:...` QR join generator.
- [x] Implemented offline camera-to-camera optical signaling for air-gapped handshakes.

### Sprint 4: Mode 4 Bluetooth & Native Share
- [x] Built honest multi-tiered Bluetooth sharing architecture respecting browser sandbox limits.
- [x] Integrated Web Share API (`navigator.share` with files) for Quick Share / AirDrop / Bluetooth handoff.
- [x] Added Web Bluetooth GATT Client interface for external peripheral hardware.
- [x] Added OS Bluetooth settings deep-links and ephemeral transfer history drawer.

### Sprint 5: Mode 5 Optical Camera Stream & Parity
- [x] Engineered pure visual optical data stream slicing files into sequenced QR frames (`QS1`/`QS2`).
- [x] Implemented Base45 alphanumeric encoding and BIP-39 style word recovery codes.
- [x] Implemented XOR parity stride engine for lost frame recovery without radio transmission.
- [x] Built multi-layout camera receiver (1x1, 2x2, 2x3) with memory-safe offscreen canvas recycling.

### Sprint 6: Mode 6 Cable & Experimental Ultrasonic
- [x] Built Mode 6 direct cable link interface for USB-C, Ethernet, and USB tethering.
- [x] Added Android USB tethering quick-launch configuration shortcuts.
- [x] Implemented experimental Frequency Shift Keying (FSK) acoustic data transfer (18–20 kHz).
- [x] Added real-time Web Audio API spectrum canvas visualization and nibble modulation.

### Sprint 7: Tactile UI Overhaul & Theme System
- [x] Established unified soft-glass tactile design system with semantic CSS variables.
- [x] Implemented interactive Dark/Light theme switching (`useTheme.ts`) with anti-FOUC script.
- [x] Extracted shared components: `SegmentedControl`, `RadarPanel`, `DirectConnectPanel`, and `FileTypeBadge`.
- [x] Modularized 1,200-line camera coordinator into `CameraSender`, `CameraReceiver`, and presentation views.

### Sprint 8: Production Signaling, Multi-File Queue & TURN Support
- [x] Hardened WebRTC signaling with Upstash Redis REST mode and memory fallback.
- [x] Implemented sequential multi-file batch queue and large-file streaming disk writer (>100MB).
- [x] Added SHA-256 file integrity calculation with verified visual badge.
- [x] Built server-side `/api/turn` route supporting public STUN pool, Metered.ca ephemeral TURN credentials, and static TURN env vars.

### Sprint 9: Stabilization, Diagnostics & Polish
- [x] Streamlined Mode 1: co-located live scannable QR code and PIN entry on both Send and Receive screens.
- [x] Fixed PeerJS receiver signaling timeout: added 12s signaling watchdog, 15s overall dial timeout, and internal `conn.peerConnection` ICE tracking.
- [x] Differentiated timeout diagnostics inside `TransferModal` (`"Room not found / Sender offline"` vs `"Blocked by 4G mobile network or firewall — TURN relay required"`).
- [x] Rendered `<ConnectionDiagnostics />` at bottom of Mode 1 and added subtle TURN availability notice.
- [x] Removed clutter copy and ensured 100% theme contrast consistency across all modals and cards.

---

## Historical Sprints & Maintenance Archive

For the complete, granular step-by-step checklist of historical engineering iterations (Sprints 1 through 33) and subsequent dated bugfix entries, see:
👉 [**documentation/archive/backlog_sprints_old.md**](archive/backlog_sprints_old.md)
