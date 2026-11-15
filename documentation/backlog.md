# QuickSend: Product Backlog & Sprint Roadmap

> **Target Deployment:** [quicksend.vercel.app](https://quicksend.vercel.app)  
> **Status Legend:** `[x]` Completed | `[ ]` Pending

---

## Section 1: Complete Feature List

### 1. Zero-Login Core Interface & 4-Mode Home Hub
- **Zero-Login Experience:** No accounts, passwords, email verifications, or authentication barriers.
- **Compact 4-Mode Option Tiles:** Clean, uncluttered option tiles (`rounded-3xl` with squircle icons and arrow indicators) replacing bulky subscription-like cards.
- **Dedicated Step Workspace Navigation:** Tapping any mode smoothly transitions into a focused workspace view with an "← All Modes" back pill.
- **Segmented Control Pill Styling:** Modern segmented pill toggles (`rounded-full` controls for `Send | Receive`, `Files | Text`, and pairing strategies) inspired by modern mobile apps.
- **Adaptive Responsive Design:** Mobile-first layout optimized for smartphones, tablets, lab desktop monitors, and widescreen displays.
- **Dark / Light Theme Support:** Soft, warm neutral tones (`#F8F9FB` light, `#0B0C10` dark) with gentle neumorphic-style shadows.
- **Device & Connection Status Pill:** Real-time indicator displaying network state (Online / Offline / Local Only) and active device profile.

### 2. Mode 1: Internet Sharing (PIN, Mobile Number, Custom Keyword & QR)
- **Format Selection:** User selects **Code Entry** (PIN, Mobile Number, or Custom Keyword) or **QR Code** (dynamic URL).
- **Flexible Pairing Key Support:**
  - *Auto 6-digit PIN:* Fast random numeric PIN for immediate single-session sharing.
  - *Mobile Number:* Use sender's memorized phone number (no need to memorize a new PIN).
  - *Custom Keyword / Secret:* Type a familiar unique secret phrase (e.g., `HR998877`).
  - *4–20 Character Length:* Receiver input accepts any valid PIN, phone number, or custom keyword without rigid length restrictions.
- **Action Selection:** User chooses **Send** (upload files/paste text, generate room code/QR) or **Receive** (enter room code or scan QR with camera).
- **Dynamic Scannable QR Code:** Instantly generated QR code containing the direct URL to the ephemeral session room.
- **Camera QR Scanner:** Built-in mobile and desktop camera scanner utilizing `html5-qrcode`.
- **WebRTC Signaling Relay:** Ephemeral session signaling exchange via lightweight serverless signaling channel.
- **RTCDataChannel File & Text Streaming:** Direct encrypted browser-to-browser data transfer using DTLS/SCTP.
- **NAT Traversal:** Public Google STUN servers with fallback timeout guidance for restrictive symmetric enterprise firewalls.

### 3. Mode 2: Same Network Wi-Fi P2P (Interactive Radar & LAN Transfer)
- **Local Wi-Fi Radar & Auto-Discovery:** Automated device discovery across peers sharing the same Wi-Fi router via `/api/discover`.
- **Tactile Radar Interface:** Interactive 360-degree sweep radar showing this device in the center and nearby devices floating on orbits.
- **1-Click Beaming:** Select files in dropzone and tap any discovered peer on the radar to transfer immediately over WebRTC.
- **Host Candidate Prioritization:** Direct internal IP-to-IP connection routing (RFC 1918 addresses) to bypass internet WAN bandwidth caps.
- **No-Internet LAN Fallback:** Direct 6-digit PIN connect and camera optical QR SDP handshake fallback when router client isolation is active.

### 4. Mode 5: Via Camera (Air-Gapped Optical Data Stream)
- **Zero-Network Optical Transfer:** Transfer files and text with no Wi-Fi, no Bluetooth, and no internet.
- **Visual QR Streaming:** Slices files into sequenced compact QR frames (`QS1|...`) playing at configurable speeds (Slow 500ms, Normal 320ms, Fast 220ms).
- **Camera Frame Collector:** `Html5Qrcode` camera viewfinder with real-time chunk matrix and out-of-order reassembly.
- **Auto Download & Integrity Check:** Assembles Blob, validates data, auto-triggers download, and saves to session history.

### 5. Mode 3: Wi-Fi + Hotspot Offline Transfer Interface
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
- [x] Build Mode 2 (Same Network Wi-Fi) interface prioritizing local host ICE candidates (`host` vs `srflx`).
- [x] Implement LAN network detection and local peer handshake optimization.
- [x] Build Mode 3 (Wi-Fi + Hotspot) interactive transfer assistant:
  - Send: Hotspot activation guide, Android settings intent link, and `WIFI:T:WPA;S:...` QR generator.
  - Receive: Hotspot join guide, Android Wi-Fi settings shortcut, and camera QR join scan.
- [x] Implement offline camera-to-camera optical signaling (animated/chunked QR-based SDP offer/answer exchange) for pure offline P2P.
- [x] Validate offline direct data transmission over established local Wi-Fi / Hotspot subnet without internet.
- [x] **Sprint 3 Testing & Verification Gate:**
  - Unit tests for `WIFI:T:WPA...` string builder and compressed SDP QR payload encoder/decoder (`npm test`).
  - Offline PWA verification and build compilation test.
  - Verification that `npm test` (30/30 passed), `npm run lint` (0 errors), and `npm run build` pass cleanly with zero errors.

### Sprint 4: Mode 4 Bluetooth, Polish & Vercel Deployment
- [x] Implement `useNearbyShare` hook for browser and hardware support detection (`'bluetooth' in navigator` and `'share' in navigator` with file sharing verification).
- [x] Build Mode 4 multi-tiered UI (`src/components/NearbyShareCard.tsx`):
  - Native OS Share Sheet integration (`navigator.share` with file payloads for Quick Share/AirDrop/Bluetooth).
  - Android Bluetooth settings deep-link button (`intent:#Intent;action=android.settings.BLUETOOTH_SETTINGS;end`).
  - Web-BLE GATT Client interface for connecting to compatible BLE peripherals.
- [x] Build user-friendly fallback messaging for unsupported browsers (iOS Safari, Mozilla Firefox).
- [x] Implement ephemeral session transfer history log (`useTransferHistory.ts`, `TransferHistoryModal.tsx`, `AppHeader.tsx`) and session teardown cleanup.
- [x] Perform cross-browser and cross-device testing (Chrome, Edge, Safari, Android Chrome, iOS Safari).
- [x] Prepare final production deployment configuration for Vercel (`vercel.json` with CSP, PWA cache policies, clean URLs).
- [x] Rename project identity, package, PWA manifest, service worker cache, and documentation from Share Anything to QuickSend (`quicksend.vercel.app`).
- [x] Establish tactile design system foundation tokens in `src/app/globals.css` (`#F6F7FB` light / `#0B0D14` dark canvas, elevated cards, hairline borders, rich indigo-violet accents, `.tactile-card`, `.squircle`, `.pill-track`, and `.tabular-nums`).
- [x] Create reusable `SegmentedControl` component with glass track and keyboard arrow navigation (`src/components/SegmentedControl.tsx`).
- [x] Integrate `SegmentedControl` in `InternetSharingCard` (Send/Receive and pairing method) and `Dropzone` (Files/Text tabs).
- [x] Apply `.glass-card` soft glass styling to `AppHeader` (with date display) and `ModeSelector` (accent squircle icon boxes and round arrows).
- [x] Streamline workspace into a clean, linear 4-channel flow in `ModeSelector.tsx`: removed artificial sidebars and bottom navigation menus, providing an uncluttered Option Hub and focused workspace.
- [x] Create reusable `FileTypeBadge` component (`src/components/FileTypeBadge.tsx`) with color-coded badges for PDF, images, docs, archives, video, audio, and text.
- [x] Harmonize tactile theme and corner radius scale across all components (`rounded-3xl` frames, `rounded-2xl` tiles, `rounded-xl` controls) matching reference UI.
- [x] Upgrade typography across all components (`Dropzone`, `QRCodeDisplay`, `TransferModal`, `TransferHistoryModal`) with oversized `tabular-nums` for PINs, file sizes, and transfer rates.
- [x] Harden WebRTC signaling backend with dual-mode store (`src/lib/signalStore.ts`): zero-dependency Redis REST mode (`UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL`) and in-memory fallback with TTL pruning and capacity guard.
- [x] Refactor `/api/signal` route handler to return clean standard HTTP status codes (`400`, `404`, `409`, `200`).
- [x] Build resilient multi-provider public STUN pool (`src/lib/iceConfig.ts`) with Google and Cloudflare STUN servers, plus optional TURN server injection (`NEXT_PUBLIC_TURN_URL`).
- [x] Add 10-second ICE connection timeout watchdog and restrictive firewall/symmetric NAT fallback diagnostic prompt.
- [x] Implement health check endpoint `GET /api/health` returning app identifier, storage mode, and server timestamp.
- [x] Implement sequential multi-file batch queue (`useWebRTC.ts`, `TransferModal.tsx`, `Dropzone.tsx`) beaming multi-file selections sequentially without dropping connection.
- [x] Add SHA-256 file integrity checksum generation and receiver verification (`src/lib/chunker.ts`) with `"Verified ✓"` visual badge.
- [x] Add large-file disk streaming fallback (`src/lib/diskStream.ts`) leveraging `window.showSaveFilePicker` for files > 100MB to prevent browser RAM overflow.
- [x] Implement multi-frame sequenced optical SDP protocol (`splitOpticalFrames`, `OpticalFrameCollector`) with `QS1|<index>/<total>|<hash>|<chunk>` format for low-res camera scanning.
- [x] Build animated QR carousel in `OpticalHandshakeModal.tsx` with ~350ms/700ms speed toggles, play/pause controls, frame progress pills, and live incremental collection counter.
- [x] Add webcam-free manual code fallback (copy/paste compact `OPTSDP:...` strings) for PCs without cameras.
- [x] Add 1-click strong password generator in `HotspotAssistantCard.tsx` and offline detection banner in `SameNetworkCard.tsx`.
- [x] Finalize unified reactive ephemeral session history (`src/hooks/useTransferHistory.ts` via `useSyncExternalStore`) wired consistently across Mode 1, Mode 2, Mode 3, and Mode 4.
- [x] Add 1-click "Copy Text" snippet action and "Clear History" confirmation in `TransferHistoryModal.tsx`.
- [x] Polish Mode 4 (`NearbyShareCard.tsx`) with multi-file Dropzone integration and clear jargon-free fallback card when Web Bluetooth is unsupported.
- [x] Harden Service Worker (`public/sw.js`) to strictly bypass caching for `/api/*` endpoints (`NetworkOnly`) and configure `no-store` API headers in `vercel.json`.
- [x] Redesign navbar into an ultra-minimal, clean header with brand mark, monospace subtitle, network status, history trigger, and tactile dark/light mode toggle (`src/components/AppHeader.tsx`, `src/components/ThemeToggle.tsx`).
- [x] Implement interactive Dark Mode / Light Mode system (`src/hooks/useTheme.ts`, `globals.css` with `@custom-variant dark`, and anti-FOUC layout script in `src/app/layout.tsx`).
- [x] Harden WebRTC DataChannel and ICE teardown state transitions: guard `status: "completed"` against false error overrides when sender terminates connection after successful file transfer.
- [x] Implement Same Network beam signaling (`action: "beam"` & `action: "clearBeam"` in `/api/discover`) enabling 1-tap beaming from radar to receiver with zero manual room entry.
- [x] Assign vibrant animal & creature avatars (🦊 Curious Fox, 🐬 Swift Dolphin, 🦁 Golden Lion, etc.) with device/OS badges to distinguish multiple devices at a glance even when mobile browsers mask phone models.
- [x] Eliminate aggressive 30-second passive timeout in WebRTC: listening and pairing remain active until user navigates away or cancels.
- [x] Fix QR code URL generation in local dev to point to production domain, preventing mobile camera scan failures ("this page couldn't load").
- [x] Auto-connect receiver upon URL query navigation (`/?room=123456`) and fix modal dismiss handling.
- [x] Fix React 19 `useSyncExternalStore` snapshot referential identity: ensure `getLocalDeviceProfile()` caches the snapshot reference at module level, `SERVER_DEVICE_PROFILE` is frozen, and audit `useNetworkStatus`, `useNearbyShare`, and `useTransferHistory`.
- [x] Fix DataChannel packet overflow: reduce `DEFAULT_CHUNK_SIZE` from 64 KB to 16 KB (safe standard for SCTP data channel on mobile and desktop, resolving `DataChannel error occurred during transfer`).
- [x] Fix WebRTC cleanup & Close button responsiveness: detach all listeners on DataChannel and PeerConnection before calling close/destroy, preventing ghost error state triggers upon closing.
- [x] Add OpenRelay community TURN relay fallback in `iceConfig.ts` to guarantee connection establishment across symmetric NAT, mobile cellular networks, and restrictive firewalls.
- [x] Add prominent 1-tap "Save / Download File" action in `TransferModal.tsx` for mobile browsers that block asynchronous programmatic download clicks.
- [x] Simplify Same Wi-Fi fallback flow with local 6-digit PIN display, instant room QR code, and 1-tap direct camera scanner without extra steps.
- [x] Add visual speed indicator signal bars to all transfer channels (5/5 for Same Wi-Fi & Hotspot, 4/5 for Internet, 3/5 for Bluetooth, 2/5 for Camera Scan).
- [x] Remove artificial "100% Offline" and "Live radar" badges from Via Camera Scan and Same Wi-Fi.
- [x] Eliminate dual transport race condition: isolate PeerJS and raw WebRTC transports with `activeTransportRef`, suppress redundant error overrides, and provide unified chunk sending with backpressure.
- [x] Provide STUN pool for Mode 2 (Same Wi-Fi) in `iceConfig.ts` to overcome mDNS `.local` host obfuscation across mobile and desktop.
- [x] Fix TransferModal Close button: introduce user-dismissal state so dismissed error/completed dialogs stay closed and do not re-trigger in a loop.
- [x] Prevent auto-connect infinite loop in `InternetSharingCard.tsx`: track initial room connection with `hasAutoConnectedRef` so it executes once on mount.
- [x] Redesign Speed Indicator: reusable `SpeedIndicator.tsx` with explicit "Speed" label, Lucide Gauge icon, and 5 solid high-contrast stepped pill segments (Emerald for 5/5, Indigo for 4/5, Blue for 3/5, Amber for 2/5).
- [x] Pause Via Camera Scan QR stream by default on Frame 1, add primary "Start Stream" / "Pause" / "Resume" controls, "Reset to Frame 1" jump, and non-blocking advisory banner for large payloads (> 300 frames).
- [x] Fix Via Camera Scan receiver: keep viewfinder container always mounted to prevent zero-dimension crashes, add automatic camera constraints fallback for laptops/webcams without `environment` facingMode, upgrade Html5Qrcode to 20 fps with native barcode detection, and add "Scan from Screenshot / Image" fallback.
- [x] Fix TransferModal Close button responsiveness: deterministic dismissal key based on payload & error state, guaranteed dismissal on Close button, X icon, backdrop click, and Escape key, with complete unit test suite (`src/components/__tests__/TransferModal.test.tsx`).
- [x] Eliminate zombie background callbacks in `useWebRTC.ts`: add `sessionGenRef` to invalidate in-flight promises from PeerJS loader and HTTP signaling polling upon session reset or modal close.
- [x] Fix DataChannel error crash during transfer: prevent `dc.onerror` from overriding completed transfers or active PeerJS transports, and safely strip listeners before tearing down competing raw RTCPeerConnection.
- [x] Remove defunct `openrelay.metered.ca` from `iceConfig.ts` which resolved to non-routable black-hole IP `192.0.2.1`, eliminating 30-second ICE candidate stalls and timeout crashes.
- [x] Enhance `normalizeRoomCode` in `codeGenerator.ts`: automatically parse and extract room query parameter (`?room=123456`, `?code=`, `?pin=`) from full or relative URLs, fixing in-app QR camera scans.
- [x] Reorder channel tiles: move "Via Camera Scan" to the 5th and final position after Bluetooth (`["internet", "same-network", "hotspot", "bluetooth", "camera"]`).
- [x] Redesign brand favicon and web app icon: generate custom lightning bolt squircle icon matching AppHeader logo in SVG (`src/app/icon.svg`, `public/icon.svg`) with dark/light mode responsiveness and 32x32 ICO format (`src/app/favicon.ico`, `public/favicon.ico`).
- [x] **Sprint 8 Verification:** 127/127 unit tests passing across 21 suites, `npm run lint` 0 errors/0 warnings, `npm run build` Turbopack production compilation passing.

### Sprint 9: Camera Scanner Hardening & Optical Stream Polish
- [x] Fix `Scan / Receive` in Via Camera Scan (`src/components/CameraStreamCard.tsx`): implement serialized async mutex/ref guard (`isStartingRef`, `isUnmountedRef`, `shouldStopRef`, `scannerRef`) preventing React 19 StrictMode double-mount lifecycle crashes and unmounted camera leaks.
- [x] Viewfinder & Camera Constraints Fallback: keep `#camera-optical-viewfinder` mounted with explicit `min-h-[280px]`, test `{ facingMode: "environment" }` -> `{ facingMode: "user" }` -> enumerated cameras -> `{}`, and add camera switcher dropdown UI when multiple cameras are detected.
- [x] Secure Context & Diagnostics: detect non-HTTPS / missing `mediaDevices` with clear advisory notice and "Scan QR from Image" fallback; display live diagnostics (camera active status, last detected frame indicator, unrecognized format notice, and manual Stop Camera action).
- [x] Compact & Highly Scannable Animated QR Codes: optimize `DEFAULT_CHUNK_RAW_BYTES` to 66 bytes (producing <= 88 base64 chars, <= 90 max payload chars) in `src/lib/opticalDataStream.ts`; render `<QRCodeSVG>` with `size={280}`, `level="L"`, `bgColor="#FFFFFF"`, `fgColor="#000000"`, `marginSize={3}`.
- [x] Unit test in `src/lib/__tests__/opticalDataStream.test.ts` verifying compact frame payload sizes and bit-perfect reassembly at 66 raw bytes.
- [x] **Sprint 9 Verification:** 128/128 unit tests passing across 21 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 10: Hotspot Radar Engine & Streamlined Honest Bluetooth Share
- [x] Upgrade Mode 3 (`HotspotAssistantCard.tsx`): replace static guide feel with real working transfer engine combining 1-tap Android Hotspot/Wi-Fi settings shortcuts, optional collapsible Wi-Fi QR generator, and real-time Hotspot Radar & Subnet Beaming via `useLocalDiscovery(true)` + `useWebRTC("hotspot")`.
- [x] Mode 3 Offline Backup: collapsible `"No mobile data? Use Offline Direct PIN / QR Pairing"` section for air-gapped hotspot transfers without cellular data, with 6-digit session PIN and camera QR scanner.
- [x] Streamline Mode 4 (`NearbyShareCard.tsx`): remove confusing browser Bluetooth receive expectations; implement honest 1-tap Device Share (`navigator.share`) with automatic history logging, plain-English receiving instructions explaining OS Quick Share / AirDrop / Bluetooth settings, and a secondary collapsible BLE Hardware section for sensors and microcontrollers.
- [x] Add automated component tests in `src/components/__tests__/HotspotAssistantCard.test.tsx` and `src/components/__tests__/NearbyShareCard.test.tsx`.
- [x] **Sprint 10 Verification:** 132/132 unit tests passing across 23 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 11: Tab Title, Via Cable Mode & Ultrasonic Sound Data Transfer
- [x] Clean browser tab title: simplified `src/app/layout.tsx` metadata title to pure `"QuickSend"` (removed extra descriptor suffixes).
- [x] Add "Via Cable" Transfer Channel (`src/components/CableTransferCard.tsx`): 6th channel in ModeSelector with 5/5 line speed rating (1-10 Gbps), Android USB tethering deep-link shortcut, direct link-local WebRTC P2P PIN/QR pairing, and WebUSB/WebSerial direct port interface.
- [x] Implement Ultrasonic Sound Data Transfer (`src/lib/ultrasonicStream.ts` & `src/components/UltrasonicCard.tsx`): standalone acoustic transfer section at the bottom of the home hub outside `ModeSelector`.
- [x] Multi-tone FSK acoustic transmission via Web Audio API oscillators (18,000–19,800 Hz near-ultrasonic and 1,500–3,000 Hz audible chirp presets) with real-time microphone AnalyserNode (4096-point FFT) decoder and live spectrum canvas visualizer.
- [x] Add unit tests in `src/lib/__tests__/ultrasonicStream.test.ts`, `src/components/__tests__/CableTransferCard.test.tsx`, and `src/components/__tests__/UltrasonicCard.test.tsx`.
- [x] **Sprint 11 Verification:** 142/142 unit tests passing across 26 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 12: Optical Camera Scan Hardening & Error Boundary Crash Guard
- [x] Harden Optical Data Stream Protocol (`src/lib/opticalDataStream.ts`):
  - FNV-1a checksum calculation embedded in 10th pipe field of frame format (`QS1|<transferId>|<index>|<total>|<fileName>|<fileSize>|<mimeType>|<isCompressed>|<base64>|<hash>`).
  - Symmetrical compression/decompression algorithm using `deflate` with raw fallback when compressed size is not smaller.
  - Robust exception-free frame parser (`parseOpticalDataFrame`) returning `null` on corrupt/garbage input without throwing.
  - Collector session reset: automatically resets chunks and expected hash when session id or total frames change, preventing cross-session pollution.
  - Integrity check: computes reconstructed hash and returns `{ status: "error", error: "..." }` on mismatch (not an unhandled exception).
  - Exported chunk size presets: `OPTICAL_CHUNK_PRESETS` (`small: 66`, `medium: 150`, `large: 300`) with medium default.
  - Collector caching: caches completed payload so duplicate carousel frames do not trigger expensive repeated decompressions.
  - Dual collector API: supports both `collector.add(raw)` and `collector.ingestFrame(raw)`.
- [x] Harden Receiver Camera Scanner (`src/components/CameraStreamCard.tsx`):
  - Collector kept strictly in `useRef(new OpticalDataCollector())` to eliminate stale closure bugs in scanner callbacks.
  - Sub-100ms duplicate frame suppression to reduce CPU load.
  - Throttled progress updates (max 5 state dispatches per second / 200ms) eliminating UI stutter and frame drops.
  - Try/catch wrapped callback displaying readable diagnostics in place of crashes.
  - Safe completion sequence: stops camera scanner before finalization, sets payload in state, records history, and surfaces primary "Save file" button (avoiding mobile browser programmatic download blocks).
  - Copy button for text snippets and Blob URL cleanup on unmount via ref tracking.
  - Display progress as `"Received X of Y frames (Z%)"` with percentage progress bar.
  - Html5Qrcode video constraints: `fps: 15`, no `qrbox` restriction (scanning full frame), `disableFlip: true`, ideal 1280x720.
  - Sender UI: 3-option segmented selector "Small / Medium / Large" labeled "QR density" with hint "Smaller is easier to scan, larger is faster", rebuilding stream from Frame 1 on change.
- [x] Application Crash Guard (`src/app/error.tsx`):
  - Created client error boundary displaying human-readable failure notice, a Reload button, and logging error to `console.error`.
- [x] Automated Tests (`src/lib/__tests__/opticalDataStream.test.ts`):
  - 20KB random binary file round-trip test with shuffled delivery, 30% duplicates, and first 5 frames looped at the end.
  - Short text torture round-trip test.
  - Session reset test after incomplete first session.
  - Garbage input parser resilience test.
  - Hash integrity mismatch error test.
  - Preset capacity test ensuring all presets stay within QR bounds (<= 500 chars for large).
- [x] **Sprint 12 Verification:** 143/143 unit tests passing across 26 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 13: Universal Transfer Time Estimation & Channel Estimate Badges
- [x] Create Transfer Time Estimation Engine (`src/lib/transferEstimate.ts`):
  - Baseline default throughput constants: internet (1.5 MB/s), same-network (15 MB/s), hotspot (6 MB/s), bluetooth (0.8 MB/s), cable (40 MB/s), with 1s fixed handshake overhead.
  - Camera optical transfer calculation based on frames count and frame interval ms (Slow 500ms, Normal 320ms, Fast 220ms) without handshake overhead.
  - Live measured throughput override (`measuredBytesPerSec`) using actual bytes transferred / speed for exact real-time ETA (`approximate: false`).
  - Human-friendly duration formatter (`formatDuration`) producing `"under 1 sec"`, `"12 sec"`, `"3 min 20 sec"`, `"1 hr 5 min"`.
  - Exported `estimateCameraFrames(totalBytes, chunkRawBytes)` and `getPayloadBytes(files, text)` helpers.
- [x] Create Reusable `EstimateBadge` Component (`src/components/EstimateBadge.tsx`):
  - Renders compact, neutral `rounded-xl` muted row with Lucide `Clock` icon and text `Estimated time: ~3 min 20 sec (approx.)`.
  - Automatically hidden when payload size is 0 bytes (`totalBytes <= 0`).
- [x] Remove Large Payload Advisory Banner (`src/components/CameraStreamCard.tsx`):
  - Deleted warning banner block and threshold check.
  - Embedded `EstimateBadge` directly under file name and frame counter, dynamically updating when speed or QR density changes.
- [x] Add Estimate Badges Across All Channels:
  - `InternetSharingCard.tsx`: rendered directly below Dropzone using channel `"internet"`.
  - `SameNetworkCard.tsx`: rendered directly below Dropzone using channel `"same-network"`.
  - `HotspotAssistantCard.tsx`: rendered directly below Dropzone using channel `"hotspot"`.
  - `NearbyShareCard.tsx`: rendered directly below Dropzone using channel `"bluetooth"`.
  - `CableTransferCard.tsx`: rendered directly below Dropzone using channel `"cable"`.
- [x] TransferModal Live ETA (`src/components/TransferModal.tsx`):
  - Calculates remaining duration during live transfer using `estimateSeconds("internet", remainingBytes, { measuredBytesPerSec })` and formats with `formatDuration`.
- [x] Unit Tests (`src/lib/__tests__/transferEstimate.test.ts`):
  - Validated channel default speeds + 1s overhead, measured speed override, camera frames calculation, duration formatting edge cases, and zero bytes handling.
- [x] **Sprint 13 Verification:** 148/148 unit tests passing across 27 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.
