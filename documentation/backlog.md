# Share Anything: Product Backlog & Sprint Roadmap

> **Target Deployment:** [shareit.vercel.app](https://shareit.vercel.app)  
> **Status Legend:** `[x]` Completed | `[ ]` Pending

---

## Section 1: Complete Feature List

### 1. Zero-Login Core Interface & 4-Mode Home Hub
- **Zero-Login Experience:** No accounts, passwords, email verifications, or authentication barriers.
- **Upfront 4-Mode Selection:** Immediately upon opening the app, users choose between:
  1. *Share via Internet* (Remote/Relay)
  2. *Share via Same Network* (LAN Wi-Fi)
  3. *Share via Wi-Fi + Hotspot* (Offline Transfer Interface)
  4. *Share via Bluetooth* (Nearby/WebShare/BLE)
- **Adaptive Responsive Design:** Mobile-first layout optimized for smartphones, tablets, lab desktop monitors, and widescreen displays.
- **Dark / Light Theme Support:** Automatically respects OS color scheme with manual override toggle.
- **Device & Connection Status Pill:** Real-time indicator displaying network state (Online / Offline / Local Only) and active device profile.

### 2. Mode 1: Internet Sharing (Unique Short Code + Dynamic QR)
- **Format Selection:** User selects **Unique Code** (6-digit PIN) or **QR Code** (dynamic URL).
- **Action Selection:** User chooses **Send** (upload files/paste text, generate room code/QR) or **Receive** (enter room code or scan QR with camera).
- **Ephemeral 6-Digit Room Code:** Unique, human-readable numeric/alphanumeric code for easy typing on keyboards.
- **Dynamic Scannable QR Code:** Instantly generated QR code containing the direct URL to the ephemeral session room.
- **Camera QR Scanner:** Built-in mobile and desktop camera scanner utilizing `html5-qrcode`.
- **WebRTC Signaling Relay:** Ephemeral session signaling exchange via lightweight WebSocket / serverless signaling channel.
- **RTCDataChannel File & Text Streaming:** Direct encrypted browser-to-browser data transfer using DTLS/SCTP.
- **NAT Traversal:** Public Google STUN servers with fallback timeout guidance for restrictive symmetric enterprise firewalls.

### 3. Mode 2: Same Network Wi-Fi P2P (LAN Transfer)
- **Local Subnet Peer Discovery:** Fast direct WebRTC connection prioritizing internal network interfaces.
- **Host Candidate Prioritization:** Direct internal IP-to-IP connection routing (RFC 1918 addresses) to bypass internet WAN bandwidth caps.
- **High-Throughput Local Transfers:** Optimized buffer chunking for gigabyte-scale files without external cloud throttling.
- **No-Internet LAN Fallback:** Optical camera-to-camera QR SDP handshake fallback when the local LAN has no external internet connection to reach a public signaling server.

### 4. Mode 3: Wi-Fi + Hotspot Offline Transfer Interface
- **Transfer Interface Model:** Guided offline workflow operating without requiring browser-hosted HTTP/WebSocket servers.
- **Sender Hotspot Setup:** Step-by-step assistant guiding the user through creating a mobile or laptop Wi-Fi hotspot, including Android settings deep-links (`intent:#Intent;action=android.settings.WIRELESS_SETTINGS;end`).
- **Wi-Fi QR Join Credential Generator:** Generates standardized `WIFI:T:WPA;S:<SSID>;P:<Password>;;` QR codes readable natively by iOS and Android camera apps for instant auto-joining.
- **Receiver Wi-Fi Assistant:** Guidance and Android Wi-Fi settings shortcuts to connect to the sender's hotspot.
- **Offline Optical QR-WebRTC Handshake:** Optical signaling method enabling two offline devices to exchange WebRTC SDP offers/answers via camera-scanned QR codes while running from the cached PWA shell.
- **Direct Hotspot Subnet P2P:** Streams files and text over the local hotspot network without internet.

### 5. Mode 4: Bluetooth Interface (Nearby / WebShare / BLE)
- **Honest Architectural Adaptation:** Respects the browser security boundary where browsers can only act as GATT Centrals (Clients) and cannot act as BLE Peripherals/Servers.
- **Multi-Tiered Sharing Strategy:**
  1. *Capability Detection:* Checks `'bluetooth' in navigator` and `'share' in navigator`.
  2. *Native OS Web Share:* Triggers native OS Share Sheet with files (`navigator.share`) for proximity handoff via Android Quick Share / Nearby Share, Windows Bluetooth File Transfer, or Apple AirDrop.
  3. *Android Bluetooth Settings Deep-Link:* Quick launch shortcut (`intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end`) to prepare receiving devices.
  4. *GATT Client Interface:* Connects to external BLE peripheral hardware (microcontrollers, loggers) to read/write characteristic data streams.

### 6. Offline PWA & Adaptive Degradation
- **Progressive Web App (PWA):** Installable on Android, iOS, Windows, macOS, and Linux with `src/app/manifest.ts`.
- **Service Worker Offline Cache:** Offline availability for the application shell, UI components, icons, and client-side QR tools.
- **Real-Time Connectivity Monitor:** Global network listener (`navigator.onLine`, `online`/`offline` events) powering UI state.
- **Dynamic Auto Grey-Out:** Automatically disables and greys out internet-dependent modes (Mode 1) when disconnected from the internet, while highlighting offline-capable modes (Mode 2 offline, Mode 3, Mode 4).

### 7. Input Handling & Clipboard Utilities
- **Drag-and-Drop Dropzone:** Multi-file drag-and-drop target with visual hover states and size/MIME validation.
- **Text & Link Paste Area:** Dedicated text area for quick snippet, code, and link transmission.
- **One-Click Clipboard Copy:** Instant copy button on received text snippets with feedback toast.
- **Direct File Downloader:** Immediate, zero-cloud download triggering using in-memory `Blob` URLs.

### 8. Transfer Progress, Verification & Session History
- **Real-Time Transfer Metrics:** Streaming progress bar, transfer rate (MB/s), elapsed time, and estimated time remaining (ETA).
- **Integrity Verification:** Optional SHA-256 checksum calculation to verify bit-perfect data integrity between peers.
- **Ephemeral Session History:** In-memory session log recording transferred items during the active session (cleared on tab close).
- **Graceful Error Recovery:** Clear diagnostics for interrupted connections, dropped peers, or declined transfers.

---

## Section 2: Sprint-wise Breakdown

### Sprint 1: Foundation & Offline PWA Shell
- [x] Scaffold clean Next.js 16 (App Router, TypeScript, Tailwind CSS, ESLint) project structure.
- [x] Configure directory architecture (`src/app`, `src/components`, `src/lib`, `src/hooks`, `src/types`).
- [x] Install core UI & QR utilities (`lucide-react`, `qrcode.react`, `html5-qrcode`).
- [x] Create project documentation root (`documentation/` directory, `README.md`, `about_project.md`, `backlog.md`, `codebase_map.md`, `AGENTS.md`).
- [x] Configure basic PWA readiness in `src/app/manifest.ts` and verify clean build with zero errors.
- [x] Implement `useNetworkStatus` hook to track online/offline connectivity in real time.
- [x] Configure Service Worker registration for offline asset caching (app shell, fonts, icons).
- [x] Build adaptive 4-mode home cards with auto grey-out state for internet-dependent modes when offline.
- [x] **Sprint 1 Testing & Verification Gate:**
  - Setup `Vitest` and `happy-dom`.
  - Write unit tests for `useNetworkStatus` hook and mode availability logic.
  - Verify that `npm test`, `npm run lint`, and `npm run build` all pass cleanly with zero errors.

### Sprint 2: Core UI & Mode 1 Internet Sharing
- [x] Build Home Hub UI displaying the 4 upfront modes with responsive card layouts.
- [x] Implement Mode 1 workflow: Choose `Unique Code` or `QR Code` -> Choose `Send` or `Receive`.
- [x] Implement multi-file drag-and-drop dropzone and text/link paste card.
- [x] Implement 6-digit ephemeral room code generator and dynamic QR display component (`qrcode.react`).
- [x] Integrate camera QR scanner component (`html5-qrcode`) with camera selection and permission handling.
- [x] Implement WebRTC signaling client and ephemeral room coordination API (`/api/signal`).
- [x] Implement WebRTC peer connection manager with `RTCDataChannel` chunking (64KB slices).
- [x] Build transfer progress modal: live progress percentage, transfer speed (MB/s), and cancel action.
- [x] Implement receiver acceptance prompt, stream reassembly, file auto-download, and text copy-to-clipboard.
- [x] **Sprint 2 Testing & Verification Gate:**
  - Unit tests for 6-digit room code generator and binary chunker/reassembler (`npm test`).
  - Route handler tests verifying room signaling API endpoints respond correctly.
  - Verification that `npm test` (21/21 passed), `npm run lint` (0 errors), and `npm run build` pass cleanly with zero errors.

### Sprint 3: Mode 2 Same Network & Mode 3 Wi-Fi/Hotspot Offline P2P
- [ ] Build Mode 2 (Same Network Wi-Fi) interface prioritizing local host ICE candidates (`host` vs `srflx`).
- [ ] Implement LAN network detection and local peer handshake optimization.
- [ ] Build Mode 3 (Wi-Fi + Hotspot) interactive transfer assistant:
  - Send: Hotspot activation guide, Android settings intent link, and `WIFI:T:WPA;S:...` QR generator.
  - Receive: Hotspot join guide, Android Wi-Fi settings shortcut, and camera QR join scan.
- [ ] Implement offline camera-to-camera optical signaling (animated/chunked QR-based SDP offer/answer exchange) for pure offline P2P.
- [ ] Validate offline direct data transmission over established local Wi-Fi / Hotspot subnet without internet.
- [ ] **Sprint 3 Testing & Verification Gate:**
  - Unit tests for `WIFI:T:WPA...` string builder and compressed SDP QR payload encoder/decoder (`npm test`).
  - Offline PWA verification in browser DevTools (`Network: Offline`).
  - Verify that `npm test`, `npm run lint`, and `npm run build` pass cleanly with zero errors.

### Sprint 4: Mode 4 Bluetooth, Polish & Vercel Deployment
- [ ] Implement `useBluetoothCapability` hook for browser and hardware support detection (`'bluetooth' in navigator` and `'share' in navigator`).
- [ ] Build Mode 4 multi-tiered UI:
  - Native OS Share Sheet integration (`navigator.share` with file payloads for Quick Share/AirDrop/Bluetooth).
  - Android Bluetooth settings deep-link button (`intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end`).
  - Web-BLE GATT Client interface for connecting to compatible BLE peripherals.
- [ ] Build user-friendly fallback messaging for unsupported browsers (iOS Safari, Mozilla Firefox).
- [ ] Implement ephemeral session transfer history log and session teardown cleanup.
- [ ] Perform cross-browser and cross-device testing (Chrome, Edge, Safari, Android Chrome, iOS Safari).
- [ ] Prepare final production deployment configuration for Vercel (`shareit.vercel.app`).
- [ ] **Sprint 4 Testing & Verification Gate:**
  - Unit tests for Bluetooth/WebShare capability detection hooks (`npm test`).
  - Full end-to-end regression test suite passing across all components and utilities.
  - Verify that `npm test`, `npm run lint`, and `npm run build` pass cleanly with zero errors.
