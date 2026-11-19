# QuickSend: Development & Fix Log (Archived Sprints & Maintenance)

> **Archive Notice:** This file contains the complete, detailed historical task checklists and verification gates for all historical engineering iterations (Sprints 1 through 33) and subsequent maintenance fixes. For the clean major milestone sprint roadmap, see [backlog.md](../backlog.md).

---

## Historical Sprint Checklists

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

### Sprint 14: Isolated Html5Qrcode Scanner Lifecycle & DOM Error Protection
- [x] Create Isolated Scanner Hook (`src/hooks/useHtml5Scanner.ts`):
  - Manages `Html5Qrcode` lifecycle inside an unmanaged child DOM node created with `document.createElement`, detached cleanly on stop/clear.
  - Zero React children inside `containerRef`: completely isolates `Html5Qrcode` DOM insertions and removals from React's reconciliation engine.
  - Safe mutex-guarded `stop()`: handles multiple stop invocations, missing parent node exceptions, and auto-cleanup on unmount.
  - Secure context detection: guards camera calls against non-HTTPS local IP access with actionable guidance.
  - File upload scanner (`scanFile`) and camera device enumeration (`getCameras`).
- [x] Integrate Hook in `src/components/CameraStreamCard.tsx`:
  - Replaced direct `Html5Qrcode` usage with `useHtml5Scanner()`.
  - Added `completedRef` guard to ignore subsequent frames once reassembly finishes.
  - Awaits `stopScanner()` before updating React state to the finished payload UI.
  - Separated scanner container from overlay and button siblings; added `translate="no"` on root container.
- [x] Integrate Hook in `src/components/QRScannerModal.tsx`:
  - Replaced direct `Html5Qrcode` with `useHtml5Scanner()`.
  - Empty container div with sibling status overlays; added `translate="no"` on root modal.
- [x] Add Anti-Translation Meta Tag (`src/app/layout.tsx`):
  - Added `<meta name="google" content="notranslate" />` to `<head>` to prevent browser translation extensions from mutating React text nodes.
- [x] Automated Unit Tests (`src/hooks/__tests__/useHtml5Scanner.test.ts`):
  - Verified calling `stop()` twice does not throw.
  - Verified `stop()` does not throw when child div was already detached from DOM.
  - Verified component unmount while running calls `stop()` once.
  - Verified container has zero child nodes after `stop()`.
- [x] **Sprint 14 Verification:** 152/152 unit tests passing across 28 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 15: Optical Camera Preview Fix, Size Expansion & Diagnostics Line
- [x] Fix Scanner Container Visibility & Sizing (`src/hooks/useHtml5Scanner.ts`, `src/components/CameraStreamCard.tsx`, `src/components/QRScannerModal.tsx`):
  - Removed `display: none` / `hidden` class from container when idle; preserved full layout dimensions with `opacity-0 pointer-events-none`.
  - Added 2-tick `requestAnimationFrame` await in `start()` to guarantee settled layout before `Html5Qrcode` measures dimensions.
  - Expanded viewfinder container to `relative w-full max-w-md mx-auto aspect-[3/4] sm:aspect-square overflow-hidden rounded-2xl bg-black qs-scanner`, removing the fixed 280px minimum height.
  - Imperatively created child div given `style.width = "100%"`, `style.height = "100%"`, and `style.position = "relative"`.
- [x] Viewfinder CSS Rules (`src/app/globals.css`):
  - Added scoped `.qs-scanner` rules: `video` full cover (`width: 100% !important`, `height: 100% !important`, `object-fit: cover !important`, `display: block !important`), `canvas` hidden (`display: none !important`), full-size scan regions, and hidden shaded regions / overlays.
- [x] Video Playing Watchdog (`src/hooks/useHtml5Scanner.ts`):
  - Listens for `"playing"` event on `<video>` or polls up to 3 seconds.
  - Sets readable error `"Camera started but no video. Tap Stop, then Start again."` and cleanly stops scanner if `videoWidth === 0`.
- [x] Receiver Diagnostic Line (`src/components/CameraStreamCard.tsx`):
  - Added small monospace line: `Decoded 0 | Valid 0 | Invalid 0 | Last: none` updated at most 4 times per second via refs and timer throttler.
- [x] Streamlined Zero-Screenshot Flow:
  - Removed "Scan from Screenshot / Image" button, file input, and `scanFile` utility.
  - Clean error notice if `navigator.mediaDevices` is absent: `"Camera needs HTTPS. Open the https site."`.
- [x] Reorganized Receiver Panel Layout:
  - Sequence: large preview container first, then "Camera Active" pill, then camera dropdown and Stop button, then diagnostic line, and finally progress bar and frame counter.
- [x] Automated Unit Tests (`src/hooks/__tests__/useHtml5Scanner.test.ts`):
  - Added test verifying container is never given `display: none` or hidden classes on `start()`.
  - Verified `stop()` leaves zero children.
- [x] **Sprint 15 Verification:** 153/153 unit tests passing across 28 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 16: Optical Parity Frames, Typed Recovery Codes & 2x2 Grid Scanning
- [x] XOR Parity Frame Generation & Automatic Ingestion (`src/lib/opticalDataStream.ts`):
  - Stride-grouped XOR parity frames: $S = \lceil K / 10 \rceil$ groups with group $g = i \pmod S$ to distribute bursts of camera-shake packet loss.
  - Parity frame protocol: `QP1|<g>/<S>|<sessionHash>|<base64 xor>[|<lastChunkLen>]`.
  - Automatic single-packet recovery in `OpticalDataCollector` whenever exactly one data chunk in a stride group is missing.
  - Added 5 new automated tests in `src/lib/__tests__/opticalDataStream.test.ts` covering stride recovery, burst packet drops, last short chunk reconstruction, and corrupted chunk prevention.
- [x] Typed Recovery Code System (`src/lib/opticalRecovery.ts` & `src/lib/__tests__/opticalRecovery.test.ts`):
  - Compact format: `QSR-<hashPrefix>-<ranges>-<checksum>` where ranges is a 1-based comma-separated condensed list (e.g. `22,43-46,120`).
  - Strict 600-character length limit, case-insensitive whitespace-tolerant decoding, 2-character base-36 range checksum, and session hash validation.
  - Comprehensive unit test coverage with 6/6 tests.
- [x] 2x2 Multi-Quadrant Decoding Engine (`src/lib/quadDecode.ts` & `src/hooks/useQuadScanner.ts`):
  - 4-quadrant image splitting with 8% overlap padding on inner edges.
  - Quadrant decoding via native `BarcodeDetector` when available, falling back to `jsQR` (`jsqrDecodeOne`).
  - Isolated DOM video hook with 10 decodes/sec rAF loop and zero React children.
  - Added unit tests in `src/lib/__tests__/quadDecode.test.ts` and `src/hooks/__tests__/useQuadScanner.test.ts`.
- [x] Camera Stream UI Enhancements (`src/components/CameraStreamCard.tsx`):
  - Sender: `Layout: Single / Grid 2x2` segmented control. In Grid mode, renders 4 synchronized `QRCodeSVG` codes with 4 frames per tick ($4t$ to $4t+3$) and blank squares for remainder; automatically adjusts Large density to Medium.
  - Sender: Collapsible "Replay missing frames" section with typed recovery code input, checksum validation, and dedicated replay loop mode.
  - Receiver: `Layout: Single / Grid 2x2` segmented control switching between `useHtml5Scanner` and `useQuadScanner`.
  - Receiver: Removed chunk dots matrix grid, keeping clean progress bar; added "Missing frames code" button generating copyable recovery code with real-time missing count.
- [x] Transfer Time Estimation Integration (`src/lib/transferEstimate.ts` & `src/components/EstimateBadge.tsx`):
  - Added `opts.framesPerTick` parameter to `estimateSeconds` and `EstimateBadge` for accurate 4x accelerated ETA calculations in Grid mode.
- [x] **Sprint 16 Verification:** 172/172 unit tests passing across 31 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 17: Base45 QR Alphanumeric Mode, Multi-Layout Grid Engine & Word Recovery Codes
- [x] Base45 RFC 9285 Codec (`src/lib/base45.ts` & `src/lib/__tests__/base45.test.ts`):
  - Implemented `encodeBase45` and `decodeBase45` strictly conforming to RFC 9285 alphanumeric QR mode (~97% efficiency).
  - Verified RFC test vectors, empty input, 1000-byte random round-trip, and invalid character rejection.
- [x] Base45 Optical Frame Protocol (`src/lib/opticalDataStream.ts` & `src/lib/__tests__/opticalDataStream.test.ts`):
  - Switched frame formats to alphanumeric `QS2:<index>:<total>:<HASH>:<fileNameB45>:<fileSize>:<mimeB45>:<isCompressed>:<base45Data>.` and parity `QP2:<g>:<S>:<HASH>:<lastLen>:<base45 xor>.`.
  - Uppercase hex FNV-1a checksums and trailing period delimiters (`.`).
  - Raw chunk presets adjusted to small 90, medium 200, large 390 bytes.
  - Rejection of legacy `QS1|` and `QP1|` payloads.
- [x] Word Recovery Code Engine (`src/lib/recoveryWords.ts`, `src/lib/opticalRecovery.ts` & `src/lib/__tests__/opticalRecovery.test.ts`):
  - 256 common English words dictionary with unique 3-letter prefixes and $O(1)$ prefix lookup (`wordToIndex`).
  - LEB128 varint encoding for missing frame ranges (gap & length) with checksum word, bounded to max 40 words.
  - Case-insensitive, hyphen/comma-tolerant decoder returning clear reason status ("word" | "format" | "session" | "checksum").
- [x] Multi-Region Grid QR Layout & Auto-Layout Detection (`src/lib/quadDecode.ts`, `src/hooks/useQuadScanner.ts` & tests):
  - `decodeGrid(imageData, cols, rows, decodeOne)` with 8% overlap padding on inner edges.
  - Pure helper `pickLayout(lastGood, missStreak, rotateIndex)` rotating candidates on 5-miss streak with auto-reset.
  - Exposing `detectedLayout` in `useQuadScanner`.
- [x] Camera Stream UI Enhancements (`src/components/CameraStreamCard.tsx`):
  - Sender layout options: "Single", "2x2" and multi-frame grid with Large density, CSS grid with 2px gap, crispEdges.
  - Receiver scanner segmented control: "Scanner: Auto / Classic" (default Auto using `useQuadScanner` with auto-layout).
  - Diagnostic line displaying detected layout (`Layout ...`).
  - Natural word-wrapped recovery code display in bordered card with copy button.
  - 2-row textarea for Replay input on sender with friendly error messaging.
- [x] Service Worker Cache Update (`public/sw.js`):
  - Incremented cache version string to `quicksend-v2`.
- [x] **Sprint 17 Verification:** 188/188 unit tests passing across 32 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 18: Mobile Portrait 2x3 Grid Layout & Default 2x2 Large Density
- [x] Replaced Landscape Grid with 2x3 Portrait Grid (`src/components/CameraStreamCard.tsx`, `src/hooks/useQuadScanner.ts`):
  - Updated sender layout options to "Single", "2x2", "2x3" with default layout "2x2" and default density "Large".
  - Implemented `parseLayoutDims(layout)` splitting on "x" to dynamically calculate `cols`, `rows`, and `framesPerTick` (1 for Single, 4 for 2x2, 6 for 2x3).
  - Dynamic wrapper width styling `min(100%, 520px, calc(80vh * cols / rows))` ensuring tall 2x3 grid fits mobile and desktop viewports without page scroll.
  - Dynamic layout hint text: `"Hard to scan? Use 2x2 or Medium density."` for Single, and `"Hard to scan? Use Single or Medium density."` for 2x2 and 2x3.
- [x] Receiver Multi-Layout Auto-Detection Updates (`src/hooks/useQuadScanner.ts` & tests):
  - Candidate rotation list updated to `["2x2", "2x3", "1x1"]` with initial `lastGood` set to `"2x2"`.
  - Dynamic string split parsing `cols` and `rows` before calling `decodeGrid(imgData, cols, rows, jsqrDecodeOne)`.
  - Updated `pickLayout` unit tests in `src/hooks/__tests__/useQuadScanner.test.ts` for candidate order and rotation.
- [x] Grid Decoding & Transfer Estimation Tests (`src/lib/__tests__/quadDecode.test.ts`, `src/lib/__tests__/transferEstimate.test.ts`):
  - Added unit test verifying 2x3 grid crop dimensions (348x372 for corner cells, 348x444 for inner edge cells) with 8% overlap padding.
  - Updated transfer estimation test title and parameters for 2x3 grid mode (6 frames per tick).
- [x] Service Worker Cache Increment (`public/sw.js`):
  - Bumped cache version string to `quicksend-v3`.
- [x] Zero Legacy Grid References Guarantee:
  - Removed all occurrences of the former landscape grid across all source code, tests, and documentation.
- [x] **Sprint 18 Verification:** 188/188 unit tests passing across 32 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 19: WebRTC Connection Diagnostics & Subnet Group Masking
- [x] WebRTC Diagnostics & Debug Log Ring Buffer (`src/hooks/useWebRTC.ts`):
  - Implemented 40-entry debug log ring buffer recording `{ t, msg }` (milliseconds elapsed since session start).
  - Maintained diagnostics object: `{ iceState, gatheringState, signalingState, channelState, candidateCounts: { host, srflx, relay }, selectedPair, lastError }`.
  - Wired into `oniceconnectionstatechange`, `onicegatheringstatechange`, `onsignalingstatechange`, `onicecandidate` (reading type after "typ " in candidate string), data channel `onopen`, `onclose`, and `onerror`.
  - Querying `pc.getStats()` once upon `connected` or `completed` ICE state to inspect selected candidate pair local and remote `candidateType`.
  - Instrumented logging for offer created, answer received, remote description set, and number of queued candidates flushed.
- [x] Discovery Subnet Group Masking & Poll Status (`src/app/api/discover/route.ts`, `src/hooks/useLocalDiscovery.ts` & tests):
  - Created `getNetworkGroupInfo(rawIp)` producing `groupLabel` (IPv4 first two octets + `x.x`, IPv6 first two hextets + `...`, loopback/RFC 1918 `local-lan`) and `ipFamily` ("v4" | "v6" | "local").
  - Returned `groupLabel` and `ipFamily` across `GET` (list) and `POST` (announce/register) route responses.
  - Exposed `status` in `useLocalDiscovery` (`lastPollOk`, `lastPollAt`, `lastError`, `peerCount`, `groupLabel`, `ipFamily`) updated on every poll heartbeat.
  - Added unit test suite for IPv4/IPv6/local-lan masking and route response schema in `src/app/api/discover/__tests__/route.test.ts`.
- [x] Connection Diagnostics Panel (`src/components/ConnectionDiagnostics.tsx` & tests):
  - Native `<details>` titled "Connection details", closed by default with small muted monospace text.
  - Fetches `GET /api/health` once on expand, warning if memory storage is used across multi-instance server deployments.
  - Displays Network group, Radar status, ICE/gathering/signaling/channel states, candidate counts, selected pair types, last error, and formatted debug log.
  - One-click "Copy report" button copying plain-text report to clipboard with temporary 2-second "Copied" feedback.
  - Comprehensive unit tests in `src/components/__tests__/ConnectionDiagnostics.test.tsx` verifying default closed state, health fetch and field rendering on open, and clipboard export containing "ICE state".
- [x] Transferred Diagnostics into Same-Network & Hotspot Cards (`src/components/SameNetworkCard.tsx`, `src/components/HotspotAssistantCard.tsx`):
  - Placed `<ConnectionDiagnostics />` at the bottom of both Same Wi-Fi and Hotspot cards wired to their existing `useWebRTC` and `useLocalDiscovery` hook states.
- [x] **Sprint 19 Verification:** 195/195 unit tests passing across 33 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 20: Cross-IP Nearby Pairing Codes & WebRTC Send Path Hardening
- [x] Server Nearby Code Pairing (`src/app/api/discover/route.ts` & tests):
  - Added optional 4-digit numeric code support (`/^\d{4}$/`) in `GET` (list) and `POST` (announce/register).
  - When valid `code` is supplied, assigns `networkId = "code:" + code`, `groupLabel = "code:" + code`, and `ipFamily = "local"`, bypassing IP grouping so devices on different public IPs (e.g. IPv4 vs IPv6, or CGNAT) discover each other.
  - Retained strict IP-based grouping when code is omitted or invalid.
  - Added route tests in `src/app/api/discover/__tests__/route.test.ts` verifying cross-IP discovery with identical codes, isolation between different codes, and fallback to IP grouping when code is invalid or missing.
- [x] Client Nearby Code Management (`src/hooks/useLocalDiscovery.ts`):
  - Updated hook signature to `useLocalDiscovery(isAutoDiscovering = true, code?: string)`.
  - Normalizes code with `/^\d{4}$/`, transmitting `code` in presence announcements and leave requests.
  - Restarts presence heartbeat loop and clears peers whenever `validCode` changes.
- [x] Nearby Pairing Code UI (`src/components/SameNetworkCard.tsx`, `src/components/HotspotAssistantCard.tsx`):
  - Added collapsible `<details>` section "Can't see the other device?" containing a 4-digit numeric input, a "Generate" button, a "Clear" button, and descriptive helper text.
  - Wired pairing code state directly into `useLocalDiscovery(true, nearbyCode)`.
  - Fixed receiver prompt lifecycle by resetting `processedBeamCodeRef.current = null` on modal close and accepting incoming beams from completed/error states.
- [x] WebRTC Send Path Hardening (`src/hooks/useWebRTC.ts` & tests):
  - Extracted and exported `waitForDrain(channel, threshold, timeoutMs = 5000)` backpressure utility that resolves immediately if buffered amount is <= threshold, sets `bufferedAmountLowThreshold`, listens for `"bufferedamountlow"` event, and enforces a 5s safety timeout against lost events.
  - Added `waitForChannelOpen(timeoutMs = 10000)` ensuring sender waits for DataChannel readyState `"open"` before transmitting header JSON, resolving stalled sends on immediate connections.
  - Configured `bufferedAmountLowThreshold` prior to initial chunk transmission in `sendFiles` and `sendText`.
  - Safely wrapped queued candidate flushes in try-catch blocks in both offer and answer flows to prevent stale candidates from aborting queue processing.
  - Updated ICE connection failure and 10s connection timeout handlers to append `"Open Connection details below and copy the report."` with `FIREWALL_MSG_WITH_DIAGNOSTICS`.
  - Added unit test suite in `src/hooks/__tests__/useWebRTC.test.ts` testing `waitForDrain` behaviors.
- [x] **Sprint 20 Verification:** 204/204 unit tests passing across 34 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 21: Honest Bluetooth Mode Reorganization & Radar Navigation
- [x] Honest Mode Reorganization (`src/components/NearbyShareCard.tsx`):
  - Prioritized native OS share sheet (Quick Share, AirDrop, Windows Bluetooth) as primary 1-tap flow with Dropzone and dynamic transfer time estimation.
  - Positioned honest plain-English receiving instructions explaining OS-level reception requirements.
  - Added neutral info box clarifying browser Bluetooth sandbox realities ("Browsers cannot scan or pair with other phones over Bluetooth. Quick Share and AirDrop do the nearby discovery for you. To send without internet, use Wi-Fi Hotspot mode.") with 1-tap navigation buttons to "Open Wi-Fi Hotspot mode" and "Open Same Wi-Fi mode".
  - Maintained dedicated Android Bluetooth settings shortcut button.
  - Moved Web Bluetooth GATT Client into advanced collapsed section titled "BLE hardware (sensors, microcontrollers)" with explicit notice that phones will not appear and renamed CTA to "Choose BLE device".
  - Cleanly hides share button area and shows informative unsupported notice when `navigator.share` is unavailable.
- [x] Inter-Mode Navigation Wiring (`src/components/ModeSelector.tsx`):
  - Passed `onOpenMode={(modeId) => handleSelectMode(modeId as TransferMode)}` prop from `ModeSelector` into `NearbyShareCard` allowing seamless in-app transitions to `"hotspot"` and `"same-network"` channels.
- [x] Unit Testing & Verification (`src/components/__tests__/NearbyShareCard.test.tsx`):
  - Tested honest share guidance, neutral info box visibility, and unsupported Web Share message when absent.
  - Verified BLE hardware section is collapsed by default and reveals GATT details on click.
  - Tested navigation callbacks firing `onOpenMode("hotspot")` and `onOpenMode("same-network")`.
- [x] **Sprint 21 Verification:** 206/206 unit tests passing across 34 test suites, `npm run lint` passing with 0 errors/0 warnings, `npm run build` Turbopack compilation passing with 0 errors.

### Sprint 22: Nearby Pair Redesign & Cross-Group PIN Allocation
- [x] Signal Store Generic Key APIs (`src/lib/signalStore.ts`, `src/lib/__tests__/signalStore.test.ts`):
  - Extended `SignalStoreAdapter` with generic key operations: `getKey(key)`, `setKey(key, value, ttlSeconds?)`, and `deleteKey(key)`.
  - Implemented generic key mapping in `MemorySignalStore` with TTL expiration and stale pruning.
  - Implemented Redis REST commands in `RedisSignalStore` (`GET`, `SET [EX]`, `DEL`) for distributed key coordination.
  - Added unit test suite covering set, get, delete, and TTL expiration.
- [x] Ephemeral 4-Digit PIN Allocation & Pair Lookup (`src/app/api/discover/route.ts`, `src/app/api/discover/__tests__/route.test.ts`):
  - Allocated unique 4-digit PINs (`0000`–`9999`) with 15s presence TTL refreshed on heartbeat; cleaned up PIN keys upon `leave`.
  - Added `action: "pairLookup"` with PIN regex validation (`/^\d{4}$/`), rate-limiting (max 10 calls/min per IP, HTTP 429 `{ error: "Too many attempts" }`), and returning `{ found: true, peerId, name, avatar, os }` without exposing IP or group info.
  - Enabled cross-network beaming (`action: "beam"`) routed directly by target device ID.
  - Added comprehensive test coverage verifying unique PIN distribution across 200 devices, heartbeat retention, TTL expiry, rate limiting, and cross-group beam coordination.
- [x] Discovery Hook Enhancements (`src/hooks/useLocalDiscovery.ts`, `src/hooks/__tests__/useLocalDiscovery.test.tsx`):
  - Exposed `pin: string | null` state updated from announcement responses.
  - Implemented `lookupPin(pin: string): Promise<NearbyPeer | null>` with 429 error handling.
  - Made `beamToPeer` accept either string device IDs or peer objects.
- [x] Nearby Pair UI Flow & Components (`src/components/NearbyShareCard.tsx`, `NearbyPeerCard.tsx`, `NearbyPairRequestModal.tsx`):
  - Created `NearbyPeerCard.tsx` with squircle avatar emoji, avatar color, peer name, OS badge, and "Send request" label.
  - Created `NearbyPairRequestModal.tsx` with peer name, avatar, Accept/Decline action buttons, and 45-second auto-decline countdown progress bar.
  - Implemented tri-state pairing flow (`"idle"` | `"requesting"` | `"connected"`) in `NearbyShareCard.tsx` using `useLocalDiscovery(true)` and `useWebRTC("internet")`.
  - Idle state renders "This device" card with prominent PIN and copy button, nearby peer grid, and 4-digit PIN input with Connect button.
  - Requesting state initiates sender WebRTC session and beams room code with 45s timeout.
  - Incoming request alerts user with auto-declining modal.
  - Connected state provides file/text dropzone and send controls for sender, waiting state for receiver, and live `ConnectionDiagnostics`.
- [x] Mode Rebranding & Offline Graceful Degradation (`src/components/ModeSelector.tsx`, `src/lib/modeAvailability.ts`):
  - Renamed mode to "Nearby Pair", updated summary to `"Tap a nearby device or enter a PIN. Send after they accept."`, and changed icon to `Users` from `lucide-react`.
  - Removed Web Bluetooth GATT client UI and obsolete `onOpenMode` prop.
  - Moved system share sheet, receiving instructions, and Bluetooth settings shortcut into collapsed `<details>` titled `"More ways: System share (Quick Share, AirDrop, Bluetooth)"`.
  - Handled offline state via `useNetworkStatus()`: hides pairing sections, displays `"Pairing needs internet. System share below works without internet."`, and opens the "More ways" section by default.
  - Updated `modeAvailability.ts` status text to `"Pair online, share offline"`.
- [x] Unit Testing & Verification (`src/components/__tests__/NearbyShareCard.test.tsx`, `src/lib/__tests__/modeAvailability.test.ts`):
  - Tested "Nearby Pair" heading and status badge, idle PIN display, peer card clicks triggering beam, PIN input validation, successful beam and not found errors, incoming request modal accept/decline, connected sender dropzone, and offline details behavior.
- [x] Modern README Showcase Overhaul (`README.md`):
  - Redesigned README with centered hero logo, Shields.io badges (Live App, Next.js 16, TypeScript 5, Tailwind CSS, WebRTC DTLS/SRTP, Platform, 221 Tests, MIT License), clear value proposition, and CTA launch link.
  - Structured concise "About QuickSend", core highlights, 6-channel matrix, tech stack, local setup guide, and security/privacy architecture.

### Sprint 23: Core Navigation Reset, Connection Timeout Elimination, Transfer Cancellation, and Internet/LAN Transport Reliability
- [x] Navbar Logo/Title Home Reset (`src/components/AppHeader.tsx`, `src/components/ModeSelector.tsx`):
  - Made QuickSend logo and title in `AppHeader.tsx` a clickable button/link (`cursor-pointer`) that resets app state to Home Hub ("All Channels") from any active channel.
  - Dispatched `quicksend:go-home` custom window event and called `router.replace("/")` to clear `?room=` parameter without hard refresh.
  - Subscribed `ModeSelector.tsx` to `quicksend:go-home` event to reset `selectedModeOverride` to `"home"`.
- [x] Connection Timeout Elimination & ICE Restart (`src/hooks/useWebRTC.ts`):
  - Removed aggressive 10s `ICE_CONNECTION_TIMEOUT_MS` fatal error kill; connections and waiting states remain open until user cancels or WebRTC permanently fails.
  - Implemented single-shot ICE restart via `hasRestartedIceRef` upon ICE or connection failure (`pc.restartIce()` and new offer creation) before flagging permanent failure.
- [x] Universal Transfer Cancellation (`src/components/TransferModal.tsx`):
  - Rendered explicit **"Cancel Transfer"** button across `"connecting"`, `"waiting-acceptance"`, and `"transferring"` states.
  - Enabled header `X` close button and Escape key dismiss during active transfer states.
  - Modal mounts on `"connecting"` state to ensure immediate cancelability from the first second of peer connection negotiation.
- [x] Dual-Transport PeerJS & Same-Network Reliability (`src/hooks/useWebRTC.ts`, `src/components/SameNetworkCard.tsx`):
  - Updated PeerJS broker IDs to `qs-v2-${code.toLowerCase()}` to prevent collisions on public `0.peerjs.com` cloud server.
  - Implemented silent 1.5s retry loop on `peer-unavailable` error in receiver when sender hasn't fully registered.
  - Strictly isolated `activeTransportRef` so raw-WebRTC signaling and background timers never override active or connecting PeerJS sessions.
  - Simplified `SameNetworkCard.tsx` by removing confusing duplicate 4-digit code section and preserving ONE clean collapsible fallback titled `"Connect by PIN or QR"`.
- [x] Testing & Verification (`src/components/__tests__/TransferModal.test.tsx`, `src/hooks/__tests__/useWebRTC.test.ts`):
  - Added unit tests in `TransferModal.test.tsx` verifying Cancel Transfer during `"connecting"` and `"transferring"`.
  - Added test in `useWebRTC.test.ts` verifying starting a sender does not trigger a fatal error after 10 or 30 seconds.
  - Verified full test suite (34 suites, 224 tests passing), zero ESLint warnings, and zero Next.js build errors.

### Sprint 24: Optical Camera Stream Reliability & Tab Crash Elimination
- [x] Single + Medium Sender Defaults (`src/components/CameraStreamCard.tsx`):
  - Set default sender layout to `"single"` (with `"2x2"` and `"2x3"` retained as optional layouts) and default density to `"medium"`.
  - Confirmed absence of large-payload advisory banners, relying cleanly on `EstimateBadge` for duration estimation.
- [x] Receiver Scanner Auto-Detection & Crash-Free Pipeline (`src/hooks/useQuadScanner.ts`, `src/lib/quadDecode.ts`):
  - Set `LAYOUT_CANDIDATES` and initial scanner candidate to `"1x1"` so standard webcams and mobile cameras lock onto single QR codes first.
  - Reused a single offscreen `<canvas>` stored in `canvasRef` rather than allocating new canvas elements on every frame.
  - Capped maximum decode dimensions to 720px to prevent memory spikes and browser tab crashes ("This page couldn't load") on mobile devices.
  - Optimized `decodeGrid` in `quadDecode.ts` to skip redundant image cropping on 1x1 full-frame decodes.
- [x] End-to-End Camera Receive & Download Actions (`src/components/CameraStreamCard.tsx`, `public/sw.js`):
  - Ingested incoming `QS2:` data and `QP2:` parity frames directly into `OpticalDataCollector`.
  - Upon 100% completion: cleanly stopped the camera scanner, reassembled the verified `Blob` / UTF-8 text, logged to `useTransferHistory`, safely triggered programmatic file download, and displayed a prominent **"Save / Download File"** card action.
  - Hardened `public/sw.js` navigation and fetch error catches to never resolve with `undefined` or crash browser tabs.
- [x] Unit Testing & Verification (`src/components/__tests__/CameraStreamCard.test.tsx`, `src/hooks/__tests__/useQuadScanner.test.ts`):
  - Added `CameraStreamCard.test.tsx` verifying default Single + Medium layouts without advisory banners, multi-frame `QS2:` receive with parity recovery, clean camera stop, and prominent Save / Download button.
  - Updated `useQuadScanner.test.ts` candidate rotation tests for `"1x1"` priority.
  - Full suite verification: 35 test files, 226 tests passing, zero lint warnings, clean build.

### Sprint 25: Bluetooth Channel Restoration & Clutter Removal
- [x] Rebranding & Home Hub Tile Restoration (`src/components/ModeSelector.tsx`, `src/lib/modeAvailability.ts`):
  - Restored 4th channel name to **`Bluetooth`** with the `Bluetooth` icon and subtitle `"Send via system Bluetooth, Quick Share, or AirDrop"`.
  - Maintained `"bluetooth"` in the 5-channel Home Hub (`["internet", "same-network", "hotspot", "bluetooth", "camera"]` + `"cable"`).
  - Updated `modeAvailability.ts` with `"Direct Radio / Share"` badge and honest capability description.
- [x] Honest & Clean Bluetooth Workspace (`src/components/NearbyShareCard.tsx`):
  - Removed 4-digit PIN allocation, peer radar grid, and 45-second pairing request modal clutter.
  - Deleted unused components `NearbyPeerCard.tsx` and `NearbyPairRequestModal.tsx`.
  - Structured 2-step workspace: Step 1 file/text attachment via `Dropzone` with `EstimateBadge`, Step 2 primary "Send via Bluetooth / Quick Share / AirDrop" button via `shareViaNative` logging to `useTransferHistory`.
  - Added honest guidance card explaining browser sandbox limits on raw incoming Bluetooth radio, with 1-tap Android Bluetooth settings shortcut and Wi-Fi Hotspot recommendation for browser-to-browser transfers.
  - Tucked optional Web Bluetooth BLE hardware sensor connection in a clean bottom collapsible `<details>`.
- [x] Unit Testing & Verification (`src/components/__tests__/NearbyShareCard.test.tsx`, `src/lib/__tests__/modeAvailability.test.ts`):
  - Updated `NearbyShareCard.test.tsx` to verify Bluetooth title, subtitle, honest receiving guidance card, native share trigger with history logging, and BLE hardware scanning.
  - Updated `modeAvailability.test.ts` for Bluetooth channel metadata.
  - Full suite verification: 35 test files, 226 tests passing, zero lint warnings, clean build.

### Sprint 26: Dead File, Dead Code & Asset Elimination
- [x] Starter Asset & Gitkeep Pruning:
  - Removed unused template SVG files from `public/`: `file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, and `window.svg` (zero code or config references).
  - Preserved `public/preview.jpg` (referenced by `README.md` and project architecture docs).
  - Preserved duplicate icon pairs (`public/favicon.ico` + `src/app/favicon.ico`, `public/icon.svg` + `src/app/icon.svg`) because `/favicon.ico` and `/icon.svg` are explicitly referenced in `layout.tsx`, `manifest.ts`, and `sw.js`.
  - Deleted obsolete `.gitkeep` files from non-empty folders: `documentation/.gitkeep`, `src/components/.gitkeep`, `src/hooks/.gitkeep`, `src/lib/.gitkeep`, and `src/types/.gitkeep`.
  - Confirmed `.gitignore` ignores `next-env.d.ts` and confirmed untracked status.
- [x] Dead Component & Test Organization:
  - Deleted proven unused component `src/components/NetworkStatusBadge.tsx` (unreferenced across all application routes and components).
  - Relocated `src/lib/__tests__/nearbyShare.test.ts` to `src/hooks/__tests__/nearbyShare.test.ts` to properly co-locate with `useNearbyShare.ts`.
  - Preserved `OpticalHandshakeModal.tsx` and `TransferHistoryModal.tsx` as standalone fallback utilities.
- [x] Dead Export & Dead Code Elimination:
  - Removed unused `export` from `parseLayoutDims` and `getFramesPerTick` in `src/components/CameraStreamCard.tsx`.
  - Removed unused `export` from `LAYOUT_CANDIDATES` in `src/hooks/useQuadScanner.ts`.
  - Removed unused `export` from `getThemeSnapshot` and `applyThemeToDOM` in `src/hooks/useTheme.ts`.
  - Removed unused `export` from `useNetworkStatus` in `src/hooks/useNetworkStatus.ts` (kept internal).
  - Removed unused `export` from `FIREWALL_MSG_WITH_DIAGNOSTICS` in `src/hooks/useWebRTC.ts`.
  - Removed unused `export` from `BASE45_ALPHABET` in `src/lib/base45.ts`.
  - Removed unused `export` from `extractRoomCodeFromUrl` in `src/lib/codeGenerator.ts`.
  - Removed unused `export` from `notifyProfileListeners` and `invalidateDeviceProfileCache` in `src/lib/deviceIdentity.ts`.
  - Removed unused `export` from `PUBLIC_TURN_SERVERS` in `src/lib/iceConfig.ts`.
  - In `src/lib/opticalDataStream.ts`: removed `export` from `DEFAULT_CHUNK_RAW_BYTES`, `base64ToBytes`, `encodeB45Header`, `decodeB45Header`, `parseOpticalParityFrame`; deleted completely dead function `bytesToBase64`; deleted redundant `totalFrameCount` alias and unused `isOpticalDataFrame`.
  - Removed unused `export` from `getGridRects` in `src/lib/quadDecode.ts`.
  - In `src/lib/signalStore.ts`: deleted unused field `private lastCleanup: number`.
  - In `src/types/mode.ts`: deleted unused type `InternetFormat`.
  - In `src/lib/chunker.ts`: made `BatchFileOptions` internal interface.
  - In `src/lib/opticalSdp.ts`: made `OpticalSdpPackage` internal interface.
  - Removed unused `React` imports from 12 components and test files (`CableTransferCard.test.tsx`, `ConnectionDiagnostics.test.tsx`, `HotspotAssistantCard.test.tsx`, `SegmentedControl.test.tsx`, `SpeedIndicator.test.tsx`, `TransferModal.test.tsx`, `UltrasonicCard.test.tsx`, `FileTypeBadge.tsx`, `NearbyShareCard.tsx`, `SegmentedControl.tsx`, `useLocalDiscovery.test.tsx`, `useTheme.test.tsx`).
- [x] Verification Gate & Test Counts:
  - Passing tests before cleanup: 224 passed across 35 test suites.
  - Passing tests after cleanup: 224 passed across 35 test suites.
  - Zero lint warnings, zero unused local errors, clean production build verified.

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

### Sprint 33: Dynamic TURN Relay Credentials & CGNAT / 4G Resilient Connectivity
- [x] Server-Side TURN Relay Route (`src/app/api/turn/route.ts`):
  - Created `GET /api/turn` route returning `{ iceServers: RTCIceServer[], hasTurn: boolean }`.
  - Integrated public STUN pool with optional ephemeral TURN credentials from Metered (`METERED_TURN_DOMAIN` and `METERED_TURN_API_KEY`) and static TURN environment variables (`NEXT_PUBLIC_TURN_URL`, `NEXT_PUBLIC_TURN_USERNAME`, `NEXT_PUBLIC_TURN_CREDENTIAL`).
  - Added 10-minute in-memory server cache and safe STUN-only fallback on network failures without exposing secret API keys.
- [x] Dynamic ICE Fetching & Client Integration (`src/lib/iceConfig.ts`, `src/hooks/useWebRTC.ts`):
  - Added `fetchIceConfig(mode)` in `src/lib/iceConfig.ts` with 2-second timeout, 5-minute client cache, and synchronous local fallback.
  - Wired `fetchIceConfig(mode)` in `useWebRTC.ts` before creating `RTCPeerConnection` and initializing PeerJS for both sender and receiver roles.
- [x] Automated Tests & Verification (`src/app/api/turn/__tests__/route.test.ts`, `src/lib/__tests__/iceConfig.test.ts`):
  - Added unit tests verifying STUN defaults, Metered API fetching, credential hiding, caching, and fallback behavior.
  - Added `fetchIceConfig` tests verifying offline bypass, dynamic server retrieval, and network error resilience.
  - 248 tests passing across 40 test suites (100% pass rate).
  - ESLint 9 checks passing with 0 errors and 0 warnings.
  - Turbopack production build verified cleanly (`npm run build`).

---

## Maintenance & Fixes Log

### Fix 1 (2026-11-17): PeerJS Watchdog, 15s Signaling Timeout & Mode 1 Diagnostics
- [x] Fix PeerJS Watchdog & Signaling Timeout (`src/hooks/useWebRTC.ts`):
  - In PeerJS (`peer.connect(...)`), `conn.on("open")` only fires after full WebRTC ICE/DTLS negotiation succeeds.
  - Attached explicit 12-second Peer/Signaling Watchdog and 15-second overall receiver dialing timeout aborting cleanly when neither PeerJS nor `/api/signal` opens the data channel.
  - Wired 15-second ICE state watchdog to PeerJS's internal `conn.peerConnection` on both sender and receiver to capture live ICE states and candidate counts (`host`, `srflx`, `relay`).
  - Differentiated timeout error messages in `TransferModal`: `"Room not found / Sender offline"` when room does not exist vs `"Blocked by 4G mobile network or firewall — TURN relay required"` when signaling was exchanged but NAT traversal failed.
- [x] Show Diagnostics & Relay Telemetry in Mode 1 (`src/components/InternetSharingCard.tsx`):
  - Rendered `<ConnectionDiagnostics />` at the bottom of `InternetSharingCard.tsx` for both Send and Receive views (including during connecting).
  - Queried `/api/turn` on mount: displayed a subtle single-line amber notice when `hasTurn` is `false` (`"TURN relay not configured — works on same Wi-Fi; 4G mobile data may require TURN."`).
- [x] Verification & Automated Tests:
  - Added unit tests in `src/hooks/__tests__/useWebRTC.test.ts` for room not found and 4G firewall block timeouts.
  - Added unit tests in `src/components/__tests__/InternetSharingCard.test.tsx` verifying diagnostics and TURN notice.
  - All 40 test suites, 251 tests passing with 100% pass rate.
  - ESLint 9 checks passing with zero warnings or errors.
  - Next.js Turbopack production build verified cleanly (`npm run build`).

### Fix 2 (2026-11-17): Skimmable README & Clear Problem-Solution Value Proposition
- [x] Restructured `README.md` for fast visual skimming and human-centric clarity:
  - Added concise **Why QuickSend? (Problem & Solution)** section addressing untrusted public computers, login fatigue, file size caps, and cloud storage risks.
  - Replaced technical jargon with plain English across Key Features, 6-Channel Overview, and Privacy sections.
  - Verified absence of obsolete `Architecture & How It Works` diagrams.
- [x] Build & Verification:
  - ESLint 9 checks passing with zero warnings or errors.
  - Next.js Turbopack production build verified cleanly (`npm run build`).

### Fix 3 (2026-11-17): Encrypted Cloud Relay Backend Core
- [x] Zero-Knowledge Relay Cryptography (`src/lib/relayCrypto.ts` & `src/lib/__tests__/relayCrypto.test.ts`):
  - `generateRelayCode()`: creates 8-char Crockford-style base-32 PIN (`XXXX-XXXX`) via `crypto.getRandomValues`.
  - `normalizeRelayCode()`: whitespace/hyphen-tolerant normalization, case conversion, and strict validation.
  - `generateSalt()`: 16-byte random salt encoded as base64.
  - `deriveRelayKey()`: non-extractable AES-GCM 256 key derived with PBKDF2 (SHA-256, 200,000 iterations).
  - `encryptBytes()`, `decryptBytes()`, `encryptText()`, `decryptText()`: AES-GCM with 12-byte random IV. Throws `"Wrong relay code"` on failure, with HTTPS subtle crypto guard.
- [x] Serverless Sliding-Window Rate Limiter (`src/lib/rateLimit.ts` & `src/lib/__tests__/rateLimit.test.ts`):
  - `clientIp()`: extracts client IP from `x-forwarded-for` header with `"unknown"` fallback.
  - `hitLimit()`: tracks window hits against `signalStore` with TTL, returning boolean exceeded flag.
- [x] Room State Relay Extension (`src/types/signaling.ts`):
  - Added optional `relay` field to `SignalingRoomState` storing salt, metadata, encrypted blob items, and optional encrypted text. Commented that no key is ever stored.
- [x] Serverless Relay Route Handlers (`src/app/api/relay/`):
  - `GET /api/relay/status`: returns `{ available, maxFileBytes, maxFiles, ttlMinutes }` checking `BLOB_READ_WRITE_TOKEN`.
  - `POST /api/relay/attach`: validates room code, blob domain (`.blob.vercel-storage.com`), path prefix (`/relay/<roomCode>/`), max 5 files, 50MB size limit. Upserts room in store with 15-minute TTL.
  - `GET /api/relay/attach`: returns relay metadata for code with 30 req/min IP rate limiting.
  - `POST /api/relay/complete`: calls `@vercel/blob` `del()` using ONLY verified URLs in store, clears relay state idempotently.
- [x] Automated Test & Build Verification:
  - Route tests in `src/app/api/relay/__tests__/route.test.ts` (mocking `@vercel/blob`).
  - 43 test suites, 271/271 tests passing (100% pass rate).
  - ESLint 9: 0 warnings, 0 errors.
  - Turbopack production build verified cleanly (`npm run build`).

### Fix 4 (2026-11-17): Upload Token Security, Cron Cleanup, CSP & Service Worker Hardening
- [x] Client Upload Token Route (`src/app/api/relay/upload/route.ts` & `src/app/api/relay/__tests__/upload.test.ts`):
  - Implemented `POST /api/relay/upload` using `handleUpload` from `@vercel/blob/client` with 503 fallback when `BLOB_READ_WRITE_TOKEN` is unset.
  - In `onBeforeGenerateToken`: parsed payload for room code and file size (1 to 50MB), enforced strict regex `^relay/<roomCode>/[A-Za-z0-9._-]{1,80}$`.
  - Rate limiting: enforced 6 token requests per hour per IP via `hitLimit`.
  - Daily upload budget: tracked daily byte counter `relay-bytes:<YYYY-MM-DD>` with 86400s TTL, bounding total daily uploads to 600MB.
  - Token options: restricted content type to `application/octet-stream`, max size to `size + 16` bytes, enabled random suffix, and set 10-minute token validity.
- [x] Automated Stale Blob Cleanup Route (`src/app/api/relay/cleanup/route.ts` & `src/app/api/relay/__tests__/cleanup.test.ts`):
  - Implemented `GET /api/relay/cleanup` verifying `CRON_SECRET` bearer authorization when configured.
  - Paged through `list({ prefix: "relay/", limit: 100, cursor })` and purged blobs older than 30 minutes via `del()`.
- [x] Deployment & Security Policies (`vercel.json`, `public/sw.js`):
  - Added daily cleanup cron schedule `0 3 * * *` to `vercel.json`.
  - Enforced CSP `connect-src` allowing `https://vercel.com` and `https://*.blob.vercel-storage.com`.
  - Hardened Service Worker fetch handler to return early (bypass cache) for external origins and `/api/` paths; incremented cache name to `quicksend-v4`.
- [x] Automated Test & Build Verification:
  - Unit tests in `src/app/api/relay/__tests__/upload.test.ts` and `src/app/api/relay/__tests__/cleanup.test.ts`.
  - 45 test suites, 279/279 tests passing (100% pass rate).
  - ESLint 9: 0 warnings, 0 errors.
  - Turbopack production build verified cleanly (`npm run build`).

### Fix 5 (2026-11-17): Mode 1 Encrypted Cloud Relay UI & Client Integration
- [x] Client Relay Transfer Controller (`src/hooks/useRelayTransfer.ts` & `src/hooks/__tests__/useRelayTransfer.test.ts`):
  - Created custom hook tracking relay configuration status (`/api/relay/status`), transfer phase state machine (`idle` | `encrypting` | `uploading` | `ready` | `error`), progress percent, and generated relay PIN.
  - Sender: `startRelayUpload(roomCode, files, text)` enforces file count and size limits, derives AES-GCM 256 key client-side via PBKDF2 with 200,000 iterations, encrypts files/text into binary octet streams with random 12-byte IVs, uploads encrypted blobs to `/api/relay/upload` using `@vercel/blob/client`, and posts ciphertext metadata to `/api/relay/attach`.
  - Receiver: `pollRelay(roomCode)` polls `/api/relay/attach` with 4s intervals up to 120s; `downloadRelay(relay, relayCode)` normalizes PIN, derives key, downloads blobs, decrypts contents, triggers downloads or clipboard copy, logs to `useTransferHistory` with mode `internet`, and calls `/api/relay/complete`. Throws `"Wrong relay code"` without calling complete on decrypt failure.
- [x] Mode 1 UI & Dialog Integration (`src/components/InternetSharingCard.tsx`, `src/components/TransferModal.tsx`):
  - Added opt-in "Send via encrypted cloud relay" button on sender when files/text are staged and relay is available.
  - Added clear ephemeral consent disclosure before upload: *"This uploads an encrypted copy to temporary cloud storage. It is deleted after download or within 24 hours."*
  - Displayed large 8-char relay PIN with copy button upon upload completion, informing sender: *"Receiver enters PIN <pin>, then this relay code."*
  - Automatically appended `#rc=<relayCode>` hash fragment to generated QR URL for zero-friction scanning without sending the key to the server.
  - Updated `TransferModal` on sender error to present the encrypted cloud relay fallback option.
  - Integrated encrypted download view on receiver with encrypted badge, prefilled/hashchange-listening PIN input, and decrypt action.
  - Replaced amber TURN styling with clean neutral design tokens (`var(--surface-subtle)`, `var(--border-hairline)`, `var(--text-muted)`).
- [x] Branding & Footer Alignment (`src/app/page.tsx`):
  - Updated footer bullet from "No Server Storage" to "Direct by default" to accurately convey peer-to-peer priority while accommodating the opt-in encrypted relay.
- [x] Automated Test & Build Verification:
  - 46 test suites, 289/289 tests passing (100% pass rate).
  - ESLint 9: 0 warnings, 0 errors.
  - Turbopack production build verified cleanly (`npm run build`).

### Fix 6 (2026-11-18): Migration from @vercel/blob to @upstash/blob
- [x] Package Migration & Upstash Client Wrapper (`package.json`, `src/lib/upstashBlob.ts`):
  - Completely uninstalled `@vercel/blob` and installed `@upstash/blob`.
  - Created `src/lib/upstashBlob.ts` exporting:
    - `isUpstashBlobConfigured()`: checks presence of `UPSTASH_BLOB_URL` and `UPSTASH_BLOB_TOKEN`.
    - `getUpstashBucketName()`: returns configured bucket or fallback `"quicksend-relay"`.
    - `getUpstashBucket()`: returns initialized `Bucket` instance from `@upstash/blob`.
    - `isAllowedRelayUrl()`: verifies HTTPS protocol, valid Upstash domain (`.upstash.io`, `.upstash-blob.com` or configured host), and room path matching.
    - `upload()`: direct browser upload helper using Upstash signed upload URLs.
- [x] Serverless Route Handlers Migration (`src/app/api/relay/`):
  - `GET /api/relay/status`: returns `{ available: isUpstashBlobConfigured(), maxFileBytes: 52428800, maxFiles: 5, ttlMinutes: 15 }` with `no-store` cache.
  - `POST /api/relay/upload`: 503 fallback when unconfigured, generates presigned upload URLs via `bucket.signedUploadUrl()` with 10m TTL, validates room code, 1..50MB size bounds, pathname regex, 6/hr per IP rate limit, and 600MB daily budget.
  - `POST & GET /api/relay/attach`: validates each blob URL with `isAllowedRelayUrl()`, bounds size to 52428816 bytes, enforces max 5 files and 30 req/min rate limit.
  - `POST /api/relay/complete`: deletes only stored blob targets via `bucket.del()` and idempotently clears room relay state.
  - `GET /api/relay/cleanup`: verifies `CRON_SECRET` bearer token when configured, scans blobs via `bucket.list({ prefix: "relay/" })`, and purges blobs older than 30 minutes.
- [x] Security Policy & Service Worker Hardening (`vercel.json`, `public/sw.js`):
  - Updated CSP `connect-src` in `vercel.json` to allow `https://*.upstash.io` and `https://*.upstash-blob.com`, removing `@vercel/blob` endpoints.
  - Incremented PWA cache version to `quicksend-v5` in `public/sw.js`.
- [x] Automated Vitest Suites Migration:
  - Updated `route.test.ts`, `upload.test.ts`, `cleanup.test.ts`, and `useRelayTransfer.test.ts` to mock `@upstash/blob`.
  - 46 test suites, 289/289 tests passing (100% pass rate).
  - ESLint 9: 0 warnings, 0 errors.
  - Turbopack production build verified cleanly (`npm run build`).

### Fix 7 (2026-11-18): Single UPSTASH_BLOB_TOKEN configuration and CSP refinement
- [x] Streamlined Upstash Blob configuration in `src/lib/upstashBlob.ts`:
  - `isUpstashBlobConfigured()` checks exclusively for `UPSTASH_BLOB_TOKEN` without requiring `UPSTASH_BLOB_URL`.
  - `getUpstashBucket()` instantiates via `Bucket.fromEnv()` (with safe fallback) reading official `UPSTASH_BLOB_TOKEN`.
  - `isAllowedRelayUrl()` validates `.blob.upstash.io` and `.upstash.io` hostnames and room paths cleanly.
  - Added `https://*.blob.upstash.io` to CSP `connect-src` in `vercel.json`.

### Fix 8 (2026-11-18): Rate limiting and 4-character room code validation fix
- [x] Fixed rate limit expiration sliding behavior in `src/lib/rateLimit.ts` and `src/lib/signalStore.ts`:
  - Preserved existing window TTL on count increments (via Redis `KEEPTTL` and in-memory expiration preservation) avoiding infinite lockouts.
  - Broadened client IP resolution with `x-real-ip` and `cf-connecting-ip` fallbacks.
  - Increased upload token limit in `/api/relay/upload` from 6 to 50 uploads per hour per IP.
- [x] Case-insensitive 4-character room code validation (`src/app/api/relay/upload/route.ts`, `src/app/api/relay/attach/route.ts`, `src/lib/upstashBlob.ts`):
  - Added case-insensitive regex matching for room code path validation (`^relay/<roomCode>/[A-Za-z0-9._-]{1,80}$`, `i`).
  - Handled case-insensitive prefix matching in `/api/relay/attach` and `isAllowedRelayUrl`.
  - Updated `src/lib/upstashBlob.ts` `upload()` to forward all signed headers and provide clear Network/CORS and HTTP error diagnostics.

### Fix 9 (2026-11-19): Restore 6-digit numeric room PIN and decoupled relay code architecture
- [x] Auto pairing mode restored to 6-digit crypto-random numerical PIN via `generateRoomCode()` in `src/lib/codeGenerator.ts`, formatted as `123-456`.
- [x] Relay encryption code (`XXXX-XXXX`) decoupled and restricted strictly to client-side encryption key derivation for cloud relay fallback (preserving `#rc=` URL hash fragment).
- [x] Receiver input in `src/components/InternetSharingCard.tsx` enhanced with `inputMode="numeric"`, `placeholder="123 456"`, non-digit stripping, and automatic submission upon 6-digit completion while retaining Mobile-number and Custom-keyword modes via SegmentedControl and auto-detection.
- [x] Preserved `/api/relay/file` streaming fallback and R2 domain support in `vercel.json` CSP and `src/lib/upstashBlob.ts`.
- [x] Added unit tests for 6-digit crypto-random generation and receiver auto-submission in `codeGenerator.test.ts` and `InternetSharingCard.test.tsx`.

### Fix 10 (2026-11-19): Chunk-based encrypted cloud relay foundation
- [x] Defined centralized relay chunk constants in `src/lib/relayLimits.ts`:
  - `RELAY_CHUNK_BYTES = 4 * 1024 * 1024` (4 MiB chunks).
  - `RELAY_MAX_FILE_BYTES = 200 * 1024 * 1024` (200 MiB max per file).
  - `RELAY_MAX_TRANSFER_BYTES = 300 * 1024 * 1024` (300 MiB max per transfer).
  - `RELAY_MAX_FILES = 5`, `RELAY_MAX_CHUNKS_PER_FILE = 50`, `RELAY_TAG_BYTES = 16`, `RELAY_TTL_MINUTES = 15`.
- [x] Implemented chunk cryptography in `src/lib/relayCrypto.ts`:
  - `generateIvPrefix()`: generates 4 crypto-random bytes as base64 string.
  - `encryptChunk(key, plain, ivPrefixBase64, index, aad)`: deterministic 12-byte IV (4-byte prefix + 8-byte big-endian index) and UTF-8 AAD authenticated encryption.
  - `decryptChunk(key, cipher, ivPrefixBase64, index, aad)`: authenticated decryption rejecting tampered chunks or mismatched AAD with `Error("Wrong relay code")`. Key is derived once per transfer via PBKDF2.
- [x] Implemented chunk planning and path management in `src/lib/relayChunks.ts`:
  - `newRelayId()` (32-character lowercase hex) and `newFileId()` (16-character lowercase hex).
  - `planChunks(size)`: generates `{ index, start, end }[]` slices for any file size up to 200 MiB.
  - `chunkPath(roomCode, rid, fileId, index)`: formats canonical storage object path `relay/<roomCode>/<rid>/<fileId>-<index>.bin`.
  - `chunkAad(fileId, index, count)`: generates `<fileId>:<index>:<count>` authentication data.
  - `isValidChunkPath(path, roomCode, rid)`: strict regex validating 16-hex fileId, chunk index 0..49, matching roomCode/rid, and rejecting path traversal (`..`).
  - `cipherSize(plainBytes)`: calculates `plainBytes + RELAY_TAG_BYTES`.
- [x] Enhanced `SignalingRoomState` in `src/types/signaling.ts`:
  - Added optional `files` array (`id`, `name`, `size`, `mimeType`, `chunkCount`, `ivPrefix`), `rid`, and `baseUrl` with zero server-side key exposure while retaining backwards compatibility with legacy `items` and `text`.
- [x] Comprehensive automated test coverage:
  - Added `src/lib/__tests__/relayChunks.test.ts` covering boundary chunk planning (0, 1, 4 MiB, 4 MiB + 1, 200 MiB), AAD generation, cipher sizing, and strict path validation against traversal and out-of-bounds indices.
  - Added chunk encryption/decryption tests in `src/lib/__tests__/relayCrypto.test.ts` verifying 3-chunk round-trip, AAD mismatch on chunk swap, wrong code rejection, and IV prefix generation.
  - Verified 47/47 test files passing (310/310 unit tests), 0 ESLint warnings/errors, and clean Turbopack production build.
