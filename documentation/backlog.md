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

### Historical Sprints Archive (Sprint 1 – Sprint 26)
Detailed task checklists and verification records for Sprints 1 through 26 have been moved to [documentation/archive/backlog_sprints_old.md](archive/backlog_sprints_old.md).

| Sprint | Title | Summary |
| :--- | :--- | :--- |
| **Sprint 1** | Foundation & Offline PWA Shell | Initialized Next.js 16 structure, PWA manifest, service worker caching, and theme tokens. |
| **Sprint 2** | Core UI & Mode 1 Internet Sharing | Built WebRTC P2P data channels, 6-digit signaling rooms, chunker, and file transfer modal. |
| **Sprint 3** | Mode 2 Same Network & Mode 3 Wi-Fi/Hotspot Offline P2P | Added subnet IP discovery, Wi-Fi QR code generator, and direct LAN WebRTC connections. |
| **Sprint 4** | Mode 4 Bluetooth, Polish & Vercel Deployment | Integrated Web Share API fallback, initial Bluetooth card, and production deployment on Vercel. |
| **Sprint 9** | Camera Scanner Hardening & Optical Stream Polish | Hardened optical QR stream frame rate, camera scanning lifecycle, and chunk reassembly. |
| **Sprint 10** | Hotspot Radar Engine & Streamlined Honest Bluetooth Share | Implemented radar peer UI for hotspot mode and honest Bluetooth guidance. |
| **Sprint 11** | Tab Title, Via Cable Mode & Ultrasonic Sound Data Transfer | Added Mode 6 USB/Ethernet cable card and experimental acoustic sound data transfer. |
| **Sprint 12** | Optical Camera Scan Hardening & Error Boundary Crash Guard | Hardened camera viewfinder cleanup and error boundaries against scanner crashes. |
| **Sprint 13** | Universal Transfer Time Estimation & Channel Estimate Badges | Added transfer time estimation math and channel speed badges across modes. |
| **Sprint 14** | Isolated Html5Qrcode Scanner Lifecycle & DOM Error Protection | Encapsulated HTML5 QR scanner lifecycle to prevent DOM element race conditions. |
| **Sprint 15** | Optical Camera Preview Fix, Size Expansion & Diagnostics Line | Fixed camera preview aspect ratio, expanded scan viewfinder, and added debug stats. |
| **Sprint 16** | Optical Parity Frames, Typed Recovery Codes & 2x2 Grid Scanning | Introduced XOR parity frames for loss recovery and prototype multi-QR grid scanning. |
| **Sprint 17** | Base45 QR Alphanumeric Mode, Multi-Layout Grid Engine & Word Recovery Codes | Added compact Base45 encoding, BIP-39 style word recovery codes, and 1x1/2x2 layouts. |
| **Sprint 18** | Mobile Portrait 2x3 Grid Layout & Default 2x2 Large Density | Added 2x3 vertical layout for mobile screens and adjusted density settings. |
| **Sprint 19** | WebRTC Connection Diagnostics & Subnet Group Masking | Added real-time ICE diagnostics panel and subnet hash grouping for local discovery. |
| **Sprint 20** | Cross-IP Nearby Pairing Codes & WebRTC Send Path Hardening | Implemented 4-digit nearby pairing codes and hardened WebRTC chunk send pipelines. |
| **Sprint 21** | Honest Bluetooth Mode Reorganization & Radar Navigation | Restructured Bluetooth mode to prioritize OS share sheets (Quick Share / AirDrop). |
| **Sprint 22** | Nearby Pair Redesign & Cross-Group PIN Allocation | Added unique 4-digit PIN allocation and peer beam requests for cross-group discovery. |
| **Sprint 23** | Core Navigation Reset & Transfer Cancellation | Added header home reset, removed 10s ICE kill, and added universal transfer cancellation. |
| **Sprint 24** | Optical Camera Stream Reliability | Set single QR default, auto-detection scanner, and end-to-end file receive/download actions. |
| **Sprint 25** | Bluetooth Channel Restoration | Restored Bluetooth channel name/tile, removed PIN clutter, and built clean OS share flow. |
| **Sprint 26** | Dead File, Dead Code & Asset Elimination | Pruned unused assets, dead exports, unreferenced components, and extraneous React imports. |

---

### Sprint 27: Camera Stream Card Component Modularization & Refactoring
- [x] CameraStreamCard Decomposition:
  - Refactored monolithic `src/components/CameraStreamCard.tsx` from 1,217 lines down to 42 lines (well under 150-line target).
  - Extracted sender-only states, tickers, and QR grid rendering into `src/components/camera/CameraSender.tsx` (557 lines).
  - Extracted receiver-only scanner controls, auto/classic scanner switches, and diagnostics into `src/components/camera/CameraReceiver.tsx` (543 lines).
  - Extracted receiver presentation components `ReceiverCompleteView.tsx` (82 lines) and `ReceiverProgressView.tsx` (109 lines) into `src/components/camera/`.
  - Preserved default export, named export, and file path so `ModeSelector.tsx` remains untouched.
  - Ensured unmounting cleanly cancels timers, camera streams, and scanner instances without regressions.
- [x] Verification & Testing:
  - All existing assertions in `src/components/__tests__/CameraStreamCard.test.tsx` pass without modification.
  - Added unit test suite `src/components/camera/__tests__/CameraParts.test.tsx` covering `CameraSender`, `CameraReceiver`, `ReceiverCompleteView`, and `ReceiverProgressView`.
  - Passing tests: 228 passed across 36 test suites (100% pass rate).
  - ESLint 9 / React 19 compiler lint checks passing with zero warnings or errors.
  - Clean Turbopack production build verified (`npm run build`).

### Sprint 28: Radar and Direct Connect Component Deduplication
- [x] RadarPanel Extraction:
  - Created reusable `src/components/RadarPanel.tsx` extracting repeated radar concentric rings, radar sweep animation, center node identity avatar, discovered peer radial layout, status pulses, and empty state messaging.
  - Replaced duplicate radar JSX in `src/components/SameNetworkCard.tsx` (reduced from 578 to 437 lines) and `src/components/HotspotAssistantCard.tsx` (reduced from 715 to 525 lines).
- [x] DirectConnectPanel Extraction:
  - Created reusable `src/components/DirectConnectPanel.tsx` extracting local device PIN display, 1-click clipboard copy, Show QR button, peer PIN input, connect button, and scan QR camera button.
  - Normalized typed PIN input by removing spaces and hyphens before executing connection callbacks.
  - Replaced duplicate PIN/QR connection blocks in `SameNetworkCard.tsx`, `HotspotAssistantCard.tsx`, and `CableTransferCard.tsx` (reduced from 469 to 397 lines).
- [x] Unified "Can't see your device?" Fallback:
  - Consolidated duplicate fallback sections in `SameNetworkCard.tsx` and `HotspotAssistantCard.tsx` into a single collapsed `<details>` titled "Can't see your device?", offering two distinct options: "Use a nearby code" and "Connect with PIN or QR".
- [x] Verification & Automated Tests:
  - Added test suite `src/components/__tests__/RadarPanel.test.tsx` verifying empty/active radar renders, avatar switching, and peer beaming callbacks.
  - Added test suite `src/components/__tests__/DirectConnectPanel.test.tsx` verifying formatted PIN rendering, copy functionality, and whitespace/hyphen normalization.
  - Updated `src/components/__tests__/HotspotAssistantCard.test.tsx` to align with the unified fallback structure.
  - All 38 test files, 235 tests passing with 100% pass rate.
  - ESLint 9 checks passing with zero warnings or errors.
  - Production build passing cleanly (`npm run build`).

### Sprint 29: Documentation Streamlining and Backlog Archive
- [x] Streamlined documentation: moved historical Sprints 1–22 checklists into `documentation/archive/backlog_sprints_old.md` with an index table in `backlog.md`.
- [x] Regenerated exact ASCII repository file tree in `about_project.md` from `git ls-files` (dropping `package-lock.json`).
- [x] Updated `codebase_map.md` with complete 38-suite test coverage (235 tests), refreshed timestamps, and ensured full 1:1 file parity with the repository.
- [x] Updated `AGENTS.md` documentation sync rule for lean, targeted updates.

### Sprint 30: Sender QR Visibility and Smart ICE Watchdog Hardening
- [x] Sender QR/PIN Non-blocking Display:
  - Kept sender QR and 6-digit PIN fully visible and unblurred in `InternetSharingCard.tsx` while waiting for peer connection.
  - Replaced blocking modal during passive waiting with an inline status indicator (`"Waiting for receiver to connect..."`).
  - Restricted `TransferModal.tsx` trigger on the sender side to active handshake/transfer states (`waiting-acceptance`, `transferring`, `completed`, `error`).
  - Added clean connecting state in `TransferModal.tsx` displaying `"Connecting to sender..."` with room PIN instead of `"File Payload 0 Bytes"`.
- [x] Smart ICE Watchdog & Dual-Transport Arbitration:
  - Preserved indefinite passive waiting with zero forced timeout before peer handshake.
  - Implemented 15s ICE handshake watchdog in `useWebRTC.ts` triggering automatic `restartIce()` at 7s when ICE is stuck in `checking`.
  - Surfaced descriptive error message advising user of 4G/firewall block and suggesting alternative channels (Same Wi-Fi, Hotspot, TURN relay).
  - Ensured cleanup state properly resets across new sessions to prevent dropped ICE events.
- [x] Verification & Automated Tests:
  - Updated `src/components/__tests__/TransferModal.test.tsx` and `src/hooks/__tests__/useWebRTC.test.ts`.
  - All 38 test files, 238 tests passing (100% pass rate).
  - ESLint 9 checks passing with zero warnings or errors.
  - Production build passing cleanly with Turbopack (`npm run build`).

### Sprint 31: Global Dark/Light Theme Contrast Fix and Privacy Reassurance Copy Removal
- [x] Global Semantic Color Token Migration (`src/app/globals.css`, `src/components/*`):
  - Added semantic theme tokens in `globals.css` for `--surface-muted` and `--shadow-card` across light and dark modes.
  - Audited all components and modals across the application to replace non-existent or hardcoded classes (such as `dark:bg-neutral-850`, `dark:bg-neutral-750`, `bg-neutral-900 ... dark:bg-white`) with unified CSS variables (`var(--accent)`, `var(--accent-hover)`, `var(--bg)`, `var(--surface)`, `var(--surface-subtle)`, `var(--surface-muted)`, `var(--border-hairline)`, `var(--text)`, `var(--text-muted)`).
  - Fixed dark mode contrast defect in `TransferModal.tsx` preventing white text on light boxes in dark theme.
  - Standardized interactive action buttons across all channel cards (`DirectConnectPanel`, `SameNetworkCard`, `HotspotAssistantCard`, `CableTransferCard`, `NearbyShareCard`, `CameraSender`, `CameraReceiver`, `ReceiverCompleteView`, `ReceiverProgressView`, `UltrasonicCard`) to use high-contrast `--accent` tokens.
- [x] Reassurance & Privacy Copy Removal:
  - Removed redundant `"Zero server uploads — files stay on your device until direct P2P transfer"` and other duplicate reassurance banners from `Dropzone.tsx`, `InternetSharingCard.tsx`, and `README.md`.
  - Cleaned up `README.md` hero badges (removed duplicate test and platform clutter, kept core technology and live links).
- [x] Verification & Automated Tests:
  - All 38 test suites, 238 tests passing with 100% pass rate.
  - ESLint 9 checks passing with 0 errors and 0 warnings.
  - Production build passing cleanly with Turbopack (`npm run build`).

### Sprint 32: Mode 1 Code + QR Streamlining and README Visual Simplification
- [x] Mode 1 Always-Available Code + QR (`src/components/InternetSharingCard.tsx`):
  - Removed separate `"Code | QR"` pairing format toggle, retaining only the clean top `Send | Receive` role switcher.
  - In `Send` view: always displays the Pairing Key selector (`Auto PIN` | `Mobile No.` | `Keyword`) alongside the live scannable `QRCodeDisplay` and 6-digit Room PIN so receivers can connect immediately via camera or manual typing.
  - In `Receive` view: always provides the prominent "Scan Sender's QR Code" camera button and the Room Code / PIN input with Connect button together on the same screen.
  - Auto-initializes `startSender()` on mount for instant session creation without requiring payload selection first.
- [x] README Simplification (`README.md`):
  - Removed dense technical jargon (`DTLS/SCTP`, `RFC 1918`, `FNV-1a`, `NAT traversal`) and the heavy architecture sequence diagram.
  - Kept hero showcase, badges, preview screenshot, crisp plain-English features list, 6-channel summary table, short local setup steps, and license.
- [x] Verification & Unit Testing (`src/components/__tests__/InternetSharingCard.test.tsx`):
  - Added test suite covering Send view defaults, live QR/PIN rendering, mobile key input switching, and Receive view dual scan/input controls.
  - Passing tests: 241 tests passing across 39 suites (100% pass rate).
  - ESLint 9 checks passing with 0 errors and 0 warnings.
  - Turbopack production build verified cleanly (`npm run build`).

