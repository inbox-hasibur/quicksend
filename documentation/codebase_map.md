# QuickSend: Codebase Map & Dependency Graph

> **Last Updated:** Fix 5 Complete (Mode 1 Encrypted Cloud Relay UI & Client Integration, Live ExpressTURN & Upstash Redis)
> **Target Deployment:** [quicksend.vercel.app](https://quicksend.vercel.app)  
> **Module Path Alias:** `@/*` -> `./src/*`

This document provides a high-density, comprehensive map of the repository's modules, files, dependencies, exports, architecture, and browser API integrations. Any AI coding assistant or engineer can read this single document to understand the entire codebase without scanning raw files.

---

## 1. System Dependency & Architecture Graph

```mermaid
flowchart TD
    subgraph Browser_APIs["Browser & Hardware Runtime APIs"]
        RTC["WebRTC (RTCDataChannel, RTCPeerConnection)"]
        BLE["Web Bluetooth GATT Client (navigator.bluetooth)"]
        Share["Web Share API (navigator.share with files)"]
        NetStat["Network Information (navigator.onLine, online/offline events)"]
        Cam["MediaDevices / Camera (getUserMedia, BarcodeDetector)"]
        Audio["Web Audio API (AudioContext, AnalyserNode, OscillatorNode)"]
        FS["File System Access API (showSaveFilePicker, writable streams)"]
        SW["Service Worker (public/sw.js, CacheStorage)"]
    end

    subgraph External_Libraries["Installed Core Packages"]
        NextJS["Next.js 16 (App Router, Turbopack, Route Handlers, React 19)"]
        Lucide["lucide-react (Icons: Globe, Wifi, Smartphone, Bluetooth, Camera, Cable, Zap, etc.)"]
        QRGen["qrcode.react (QRCodeSVG Generator)"]
        QRScan["html5-qrcode (Html5Qrcode Camera Scanner)"]
        Tailwind["Tailwind CSS 3.4 (Glassmorphic dark/light design system)"]
        BlobPkg["@upstash/blob (Upstash Blob Server & Client SDK)"]
        Vitest["Vitest 5.1 + happy-dom (289 Passing Tests across 46 Suites)"]
    end

    subgraph App_Routes["src/app/ (App Router & Route Handlers)"]
        Layout["layout.tsx (Root Shell, HTML lang, Font Injection)"]
        Page["page.tsx (6-Channel Home Hub, Suspense & URL Param Receiver)"]
        Manifest["manifest.ts (PWA Web App Manifest)"]
        ErrBoundary["error.tsx (Client Error Boundary & Crash Guard)"]
        GlobalCSS["globals.css (Tailwind CSS Tokens & Soft Glass Theme Variables)"]
        HealthAPI["api/health/route.ts (Health Check & Upstash/Memory Telemetry)"]
        SignalAPI["api/signal/route.ts (Room Signaling & Ephemeral Relay)"]
        DiscoverAPI["api/discover/route.ts (Subnet Discovery, CGNAT Pairing PIN, Beaming)"]
        TurnAPI["api/turn/route.ts (Dynamic TURN Relay Credentials & CGNAT Mobile Traversal)"]
        RelayStatusAPI["api/relay/status/route.ts (Encrypted Relay Availability & Limits)"]
        RelayAttachAPI["api/relay/attach/route.ts (Relay Metadata & Ciphertext Registry)"]
        RelayCompleteAPI["api/relay/complete/route.ts (Relay Blob Purge & Session Complete)"]
        RelayUploadAPI["api/relay/upload/route.ts (Vercel Blob Client Upload Token Handler)"]
        RelayCleanupAPI["api/relay/cleanup/route.ts (Automated 30-min Stale Blob Cron)"]
    end

    subgraph Src_Components["src/components/ (UI & Presentation Components)"]
        AppHdr["AppHeader.tsx (Logo, QuickSend Reset Link, History Counter, ThemeToggle)"]
        ModeSel["ModeSelector.tsx (6-Channel Grid, Active Workspace, return pill)"]
        ThemeTgl["ThemeToggle.tsx (Tactile Light/Dark Mode Switcher)"]
        HistoryMod["TransferHistoryModal.tsx (Session Transfer Drawer)"]
        SWReg["ServiceWorkerRegister.tsx (PWA /sw.js Registration)"]
        InternetCard["InternetSharingCard.tsx (Mode 1 Controller: Zero-Knowledge OTP/QR Cloud Relay)"]
        SameNetCard["SameNetworkCard.tsx (Mode 2 Controller: Local Radar & Device Beaming)"]
        HotspotCard["HotspotAssistantCard.tsx (Mode 3 Controller: Hotspot QR & Wizard)"]
        NearbyCard["NearbyShareCard.tsx (Mode 4 Controller: Bluetooth & Native Quick Share)"]
        CameraCard["CameraStreamCard.tsx (Mode 5 Controller: Air-Gapped Optical QR Stream)"]
        CableCard["CableTransferCard.tsx (Mode 6 Controller: Direct Cable & Tethering)"]
        UltrasonicCard["UltrasonicCard.tsx (Bonus Acoustic FSK Sound Modem)"]
        ConnDiag["ConnectionDiagnostics.tsx (Collapsible Connection Details Drawer)"]
        DropzoneComp["Dropzone.tsx (Drag & Drop Files / Text Paste Tabs)"]
        EstimateBdg["EstimateBadge.tsx (Channel Transfer Time Estimation Badge)"]
        FileTypeBdg["FileTypeBadge.tsx (Color-coded file type chips PDF, IMG, DOC, etc.)"]
        OpticalModal["OpticalHandshakeModal.tsx (Zero-Internet Optical WebRTC Signaling)"]
        QRDisp["QRCodeDisplay.tsx (SVG QR Generator & 6-Digit PIN Display)"]
        QRModal["QRScannerModal.tsx (Camera Viewport Scanner Dialog)"]
        SegControl["SegmentedControl.tsx (Tactile Pill Track & Keyboard Navigation)"]
        SpeedInd["SpeedIndicator.tsx (Solid High-Contrast Speed Indicator)"]
        TransferMod["TransferModal.tsx (Incoming Prompt, Speed, Progress Bar, Cancel)"]
    end

    subgraph Src_Hooks["src/hooks/ (Custom React Hooks)"]
        UseRTC["useWebRTC.ts (useWebRTC: Peer Connection & Stream Controller)"]
        UseRelay["useRelayTransfer.ts (useRelayTransfer: Encrypted Cloud Relay Controller)"]
        UseLocalDisc["useLocalDiscovery.ts (Radar Subnet Discovery & 4-Digit Pairing)"]
        UseNearby["useNearbyShare.ts (useNearbyShare: Web Share & Web-BLE Client)"]
        UseNet["useNetworkStatus.ts (useBrowserCapabilities)"]
        UseQuadScan["useQuadScanner.ts (1x1, 2x2, 2x3 Grid Decoding with Auto-Candidate)"]
        UseHtml5Scan["useHtml5Scanner.ts (Isolated html5-qrcode Lifecycle Controller)"]
        UseThm["useTheme.ts (useTheme: Light / Dark Mode Controller)"]
        UseHist["useTransferHistory.ts (useTransferHistory: Ephemeral Session Storage)"]
    end

    subgraph Src_Lib["src/lib/ (Protocols, Pure Logic & Utilities)"]
        Base45["base45.ts (RFC 9285 Alphanumeric QR Encoder/Decoder)"]
        RecoveryWords["recoveryWords.ts (256-Word Phonetic English Recovery Dictionary)"]
        QuadDecode["quadDecode.ts (Multi-Region Grid Cropping & Decoding)"]
        OptRecovery["opticalRecovery.ts (Word Recovery Codes with Parity Checksum)"]
        OptStream["opticalDataStream.ts (Base45 Optical Chunker & XOR Parity FEC)"]
        OptSdp["opticalSdp.ts (WebRTC SDP Compression & Optical Splitter)"]
        TransferEst["transferEstimate.ts (Channel Transfer Time & Duration Formatter)"]
        WifiQr["wifiQr.ts (WIFI:S:... QR Formatter & Android Intent Shortcuts)"]
        CodeGen["codeGenerator.ts (generateRoomCode, formatRoomCode, normalizeRoomCode)"]
        Chunker["chunker.ts (sliceBlobIntoChunks, reassembly, formatBytes, formatSpeed)"]
        DevId["deviceIdentity.ts (Device Avatars & Non-Colliding Identity)"]
        DiskStream["diskStream.ts (File System Access Large File Streamer)"]
        IceConfig["iceConfig.ts (STUN Pool, TURN Injection, getRtcConfig)"]
        ModeAvail["modeAvailability.ts (isModeAvailable, getModeStatus, getAllModesStatus)"]
        SigClient["signalingClient.ts (SignalingClient: Room & Signal Polling Engine)"]
        SignalStore["signalStore.ts (Dual-Mode: Upstash Redis REST + Memory TTL)"]
        UpstashBlob["upstashBlob.ts (Upstash Blob Client Initializer & URL Validator)"]
        RelayCrypto["relayCrypto.ts (Client AES-GCM 256 Cryptography & Chunk Crypto)"]
        RelayLimits["relayLimits.ts (Relay Chunk, File & Transfer Bounds)"]
        RelayChunks["relayChunks.ts (Chunk Planning, Path Validation & AAD)"]
        RateLimit["rateLimit.ts (Serverless Sliding-Window Rate Limiter)"]
        Ultrasonic["ultrasonicStream.ts (Frequency Shift Keying FSK Codec)"]
    end

    subgraph Src_Types["src/types/ (TypeScript Domain Interfaces)"]
        ModeTypes["mode.ts (TransferMode, ModeStatus, BrowserCapabilities)"]
        SignalTypes["signaling.ts (PeerRole, SignalMessage, SignalingRoomState)"]
        TransferTypes["transfer.ts (FileMetadata, TransferPayloadHeader, TransferProgressState)"]
    end

    %% Active Wired Dependencies
    Layout --> SWReg
    Layout --> Page
    Page --> AppHdr
    Page --> ModeSel
    Page --> UltrasonicCard

    AppHdr --> ThemeTgl
    AppHdr --> HistoryMod
    ThemeTgl --> UseThm
    HistoryMod --> UseHist

    ModeSel --> UseNet
    ModeSel --> ModeAvail
    ModeSel --> InternetCard
    ModeSel --> SameNetCard
    ModeSel --> HotspotCard
    ModeSel --> NearbyCard
    ModeSel --> CameraCard
    ModeSel --> CableCard

    InternetCard --> UseRTC
    InternetCard --> UseRelay
    InternetCard --> DropzoneComp
    InternetCard --> QRDisp
    InternetCard --> QRModal
    InternetCard --> TransferMod
    InternetCard --> CodeGen
    InternetCard --> SegControl
    InternetCard --> EstimateBdg
    InternetCard --> ConnDiag

    SameNetCard --> UseRTC
    SameNetCard --> UseLocalDisc
    SameNetCard --> DevId
    SameNetCard --> DropzoneComp
    SameNetCard --> OpticalModal
    SameNetCard --> TransferMod
    SameNetCard --> EstimateBdg
    SameNetCard --> ConnDiag

    HotspotCard --> UseRTC
    HotspotCard --> UseLocalDisc
    HotspotCard --> DropzoneComp
    HotspotCard --> OpticalModal
    HotspotCard --> TransferMod
    HotspotCard --> WifiQr
    HotspotCard --> QRGen
    HotspotCard --> EstimateBdg
    HotspotCard --> ConnDiag

    NearbyCard --> UseNearby
    NearbyCard --> DropzoneComp
    NearbyCard --> EstimateBdg
    NearbyCard --> UseHist
    NearbyCard --> BLE
    NearbyCard --> Share

    CameraCard --> UseQuadScan
    CameraCard --> UseHtml5Scan
    CameraCard --> Base45
    CameraCard --> OptStream
    CameraCard --> OptRecovery
    CameraCard --> RecoveryWords
    CameraCard --> EstimateBdg
    CameraCard --> DropzoneComp

    CableCard --> UseRTC
    CableCard --> DropzoneComp
    CableCard --> TransferMod
    CableCard --> EstimateBdg

    UltrasonicCard --> Ultrasonic
    UltrasonicCard --> Audio
    UltrasonicCard --> DropzoneComp

    OpticalModal --> QRGen
    OpticalModal --> QRModal
    OpticalModal --> OptSdp

    DropzoneComp --> Chunker
    DropzoneComp --> SegControl
    DropzoneComp --> FileTypeBdg
    TransferMod --> Chunker
    TransferMod --> SpeedInd
    TransferMod --> DiskStream
    TransferMod --> UseRelay

    UseRelay --> RelayCrypto
    UseRelay --> RelayStatusAPI
    UseRelay --> RelayAttachAPI
    UseRelay --> RelayCompleteAPI
    UseRelay --> RelayUploadAPI
    RelayAttachAPI --> SignalStore
    RelayCompleteAPI --> SignalStore
    RelayCompleteAPI --> BlobPkg
    RelayUploadAPI --> BlobPkg
    RelayUploadAPI --> RateLimit
    RelayCleanupAPI --> BlobPkg

    UseRTC --> SigClient
    UseRTC --> Chunker
    UseRTC --> IceConfig
    UseRTC --> RTC
    SigClient --> SignalAPI
    SignalAPI --> SignalStore
    SignalAPI --> CodeGen
    SignalAPI --> SignalTypes
    DiscoverAPI --> SignalStore
    DiscoverAPI --> DevId
    UseLocalDisc --> DiscoverAPI
```

---

## 2. Directory & Module Roles

| Directory | Role & Responsibilities | Key Dependencies |
| :--- | :--- | :--- |
| `src/app/` | Next.js 16 App Router entry points, layout, metadata, error boundary, and route handlers (`/api/health`, `/api/signal`, `/api/discover`, `/api/turn`, `/api/relay/*`). | `next`, `react`, `lucide-react`, Tailwind CSS |
| `src/app/api/signal/` | Ephemeral serverless WebRTC room signaling and ICE/SDP message queue. | `src/lib/signalStore`, `src/lib/codeGenerator`, `src/types/signaling` |
| `src/app/api/discover/` | Local subnet peer discovery, IP detection, CGNAT 4-digit pairing PIN, and beaming endpoints. | `src/lib/signalStore`, `src/lib/deviceIdentity` |
| `src/app/api/health/` | Public health check returning runtime environment, Redis/Memory storage telemetry, and uptime. | `src/lib/signalStore` |
| `src/app/api/turn/` | Ephemeral TURN credentials resolver querying Metered.ca with in-memory caching and STUN fallback. | `src/lib/iceConfig` |
| `src/app/api/relay/` | Zero-knowledge encrypted cloud relay routes (`status`, `attach`, `complete`, `upload`, `file`, `cleanup`). | `@upstash/blob`, `src/lib/signalStore`, `src/lib/rateLimit` |
| `src/components/` | Presentation & interactive units: 6-channel mode selector, channel controller cards, diagnostic drawer, dropzone, QR displays, modals, badges, and progress indicators. | `lucide-react`, `qrcode.react`, `html5-qrcode`, `src/hooks/`, `src/lib/` |
| `src/hooks/` | Stateful React lifecycle hooks managing WebRTC connections (`useWebRTC`), subnet discovery (`useLocalDiscovery`), camera scanners (`useQuadScanner`, `useHtml5Scanner`), theme, and history. | `react`, `src/lib/`, browser runtime APIs |
| `src/lib/` | Pure TypeScript domain libraries: Base45 encoding, word recovery codes, multi-QR grid splitting, optical XOR parity stream, chunking, STUN/TURN ICE config, disk streaming, and transfer estimation. | `src/types/`, `vitest` |
| `src/types/` | Domain TypeScript interfaces: transfer headers, progress state, signaling messages, device identities, and mode contracts. | TypeScript 5 |
| `public/` | Static SVG icons, hero preview image (`preview.jpg`), PWA Service Worker (`sw.js`), and public web assets. | Browser CacheStorage |
| `documentation/` | Living project governance, sprint roadmaps, architecture specifications, and codebase maps. | Markdown Docs |

---

## 3. Comprehensive File Index

### 3.1 Application Routes & Route Handlers (`src/app/`)

#### `src/app/page.tsx`
- **Purpose:** Primary landing hub for "QuickSend". Wraps `<ModeSelector />` in `<Suspense>` so dynamic search params (`?room=123456`) hydrate cleanly while maintaining static prerendering. Hosts `AppHeader`, `ModeSelector`, and the experimental `UltrasonicCard` section.
- **Exports:** `default function Home(): JSX.Element`

#### `src/app/layout.tsx`
- **Purpose:** Root application shell configuring HTML `lang="en"`, dynamic viewport, theme script injection, and metadata for PWA and SEO. Injects `<ServiceWorkerRegister />` to register `/sw.js`.
- **Exports:** `metadata: Metadata`, `viewport: Viewport`, `default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element`

#### `src/app/error.tsx`
- **Purpose:** Next.js client-side error boundary that gracefully traps unhandled rendering crashes, prevents black-screen errors, and renders a glassmorphic crash recovery card with a retry button.
- **Exports:** `default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }, reset: () => void }): JSX.Element`

#### `src/app/manifest.ts`
- **Purpose:** Dynamic Web App Manifest generator defining PWA identity, standalone display mode, background color `#0B0F17`, theme color `#2563EB`, and SVG app icons.
- **Exports:** `default function manifest(): MetadataRoute.Manifest`

#### `src/app/globals.css`
- **Purpose:** Global styling, theme tokens (light & dark mode soft glass variables: `--bg`, `--surface`, `--surface-glass`, `--border-soft`, `--text`, `--text-muted`, `--accent`, `--accent-soft`, `--radius-card`, `--shadow-soft`), and utility classes (`.glass-card`, `.pill`, `.pill-active`).

#### `src/app/api/health/route.ts`
- **Purpose:** Public operational health endpoint returning `{ ok: true, app: "quicksend", storage: "redis" | "memory", timestamp }`.
- **Exports:** `GET(): Promise<NextResponse>`

#### `src/app/api/signal/route.ts`
- **Purpose:** Next.js Route Handler (`GET`, `POST`) for ephemeral room coordination, SDP offer/answer exchange, and ICE candidate delivery. Backed by `signalStore` adapter with clean HTTP status codes (`400`, `404`, `409`, `200`).
- **Exports:** `GET(request: Request)`, `POST(request: Request)`

#### `src/app/api/discover/route.ts`
- **Purpose:** Local network subnet discovery endpoint (`GET`, `POST`). Extracts client IP with `cf-connecting-ip` -> `x-real-ip` -> `x-forwarded-for` priority, groups devices by private subnet (`local-lan`), IPv6 `/64` prefix, public IPv4 `/24` prefix (for ISP CGNAT pool grouping), or optional 4-digit pairing code (`code:XXXX`) for cross-IP environments, maintains 45-second presence TTL (`PRESENCE_TTL_SECONDS = 45`), sanitizes Upstash REST credentials, ensures concurrent-safe peer saving before returning active peers, and coordinates instant 1-tap beaming requests.
- **Exports:** `GET(request: Request)`, `POST(request: Request)`, `getClientIp(request: Request): string`, `isLocalOrPrivateIp(cleanIp: string): boolean`, `computeNetworkId(rawIp: string): string`, `normalizeIpv6Prefix(cleanIp: string): string`, `getNetworkGroupInfo(rawIp: string)`, `PRESENCE_TTL_SECONDS`, `PEER_EXPIRY_MS`, `REDIS_CONTAINER_TTL_SECONDS`, `DiscoveredPeer`, `IncomingBeamNotice`.

#### `src/app/api/turn/route.ts`
- **Purpose:** Dynamic ICE & TURN credential endpoint (`GET`). Delivers public STUN pool, queries ephemeral TURN credentials securely from Metered.ca without exposing the secret API key to clients, supports static TURN variables, and caches server responses in memory with a 10-minute TTL.
- **Exports:** `GET(): Promise<NextResponse>`, `_resetTurnCacheForTest(): void`.

#### `src/app/api/relay/status/route.ts`
- **Purpose:** Ephemeral encrypted cloud relay availability endpoint (`GET`). Returns `{ available, maxFileBytes, maxTransferBytes, maxFiles, chunkBytes, ttlMinutes }` reading constants from `relayLimits.ts` with `Cache-Control: no-store`.
- **Exports:** `GET(): Promise<NextResponse>`.

#### `src/app/api/relay/attach/route.ts`
- **Purpose:** Encrypted relay attachment endpoint (`GET`, `POST`). Validates room codes, `rid` (32 hex), `baseUrl` with `isAllowedRelayUrl()`, bounds file size to 750MB (total 800MB), files to 5, and verifies chunkCount matches `ceil(size / 8MB)`. Supports text-only payloads (`files: []` + `text`). Stores relay manifest in `signalStore` without server-side key exposure. Rate-limited to 30 req/min per IP.
- **Exports:** `GET(request: Request): Promise<NextResponse>`, `POST(request: Request): Promise<NextResponse>`.

#### `src/app/api/relay/complete/route.ts`
- **Purpose:** Relay completion & cleanup endpoint (`POST`). Idempotently purges verified chunk paths from `@upstash/blob` via `bucket.del()` using paths derived from the stored manifest (`chunkPath`) and purges leftover unattached objects under `relay/<roomCode>/<rid>/` via `bucket.list()`. Rate-limited to 30 req/min per IP.
- **Exports:** `POST(request: Request): Promise<NextResponse>`.

#### `src/app/api/relay/upload/route.ts`
- **Purpose:** Secure Upstash Blob presigned chunk upload URL generator (`POST`) via `bucket.signedUploadUrl()`. Accepts `{ roomCode, rid, chunks }` (max 100 chunks/request), validates every chunk path via `isValidChunkPath`, and issues 10-minute presigned upload URLs and public CDN `baseUrl`. Enforces IP byte rate limiting (2 GiB/hr) and daily upload budget via `process.env.RELAY_DAILY_BYTES` (default 2 GiB).
- **Exports:** `POST(request: Request): Promise<NextResponse>`.

#### `src/app/api/relay/cleanup/route.ts`
- **Purpose:** Automated cron cleanup endpoint (`GET`). Authenticates via `CRON_SECRET` bearer token, pages through `@upstash/blob` objects with prefix `relay/`, and purges blobs older than 30 minutes via `bucket.del()`.
- **Exports:** `GET(request: Request): Promise<NextResponse>`.

#### `src/app/api/relay/file/route.ts`
- **Purpose:** Hardened chunk streaming proxy endpoint (`GET /api/relay/file?code=<roomCode>&f=<fileId>&i=<index>`). Verifies fileId in stored room manifest and chunk index bounds, constructs canonical path with `chunkPath`, and fetches upstream chunk via `bucket.signedReadUrl(path)` (or verified baseUrl), completely preventing SSRF by never fetching arbitrary query URLs. Rate-limited to 600 req/10m per IP.
- **Exports:** `GET(request: Request): Promise<Response>`.

---

### 3.2 UI Components (`src/components/`)

#### `src/components/AppHeader.tsx`
- **Purpose:** Soft glass header (`.glass-card`) displaying clickable bold "QuickSend" title with Zap icon that dispatches `quicksend:go-home` and navigates to `/` (clearing `?room=`), session transfer history drawer toggle with counter badge, and ThemeToggle.
- **Exports:** `AppHeader(): JSX.Element`

#### `src/components/ModeSelector.tsx`
- **Purpose:** Clean, linear 6-channel workspace coordinator. In the default Home state, renders the transfer option tiles in a tactile responsive grid directly styled after the reference card aesthetic (soft surface, squircle icon, clean typography). Selecting any mode smoothly transitions into a focused workspace card with an "All Channels" return pill. Automatically handles `#otp=` hash parameters on load to route into Mode 1 Receive mode.
- **Exports:** `ModeSelector(): JSX.Element`

#### `src/components/InternetSharingCard.tsx`
- **Purpose:** Mode 1 Interactive Controller (Via Internet). Clean 2-tab zero-scroll step-by-step wizard powered by zero-knowledge chunked cloud relay (`useRelayTransfer`). Send tab provides Dropzone file/text picker, live chunk progress upload, centered QR code encoding `#otp=`, and single 6-digit numeric OTP box with 1-click copy. Receive tab provides QR camera scanner, formatted 6-digit numeric input with auto-download, live download progress, and completed view.
- **Exports:** `InternetSharingCard({ initialRoomCode, initialOtp }: InternetSharingCardProps): JSX.Element`

#### `src/components/SameNetworkCard.tsx`
- **Purpose:** Mode 2 Controller (Same Network Wi-Fi). Zero-scroll 2-tab wizard matching Mode 1 simplicity. Send tab features Step 1 (Dropzone payload selection + EstimateBadge + Find Devices action) and Step 2 (live RadarPanel with 1-tap peer beaming, Change Files button, and subtle PIN/QR fallback toggle). Receive tab features live RadarPanel with pulsing device identity awaiting incoming transfers. Technical diagnostics are kept cleanly hidden inside the fallback panel.
- **Exports:** `SameNetworkCard(): JSX.Element`

#### `src/components/LanDirectFallback.tsx`
- **Purpose:** Compact fallback and direct connect panel for local network mode. Bridges subnets/CGNAT via 4-digit pairing code, direct 6-digit PIN connect, camera QR scanning, room QR modal, and collapsible advanced WebRTC diagnostics.
- **Exports:** `LanDirectFallback(props: LanDirectFallbackProps): JSX.Element`, `LanDirectFallbackProps`.

#### `src/components/HotspotAssistantCard.tsx`
- **Purpose:** Mode 3 Controller (Wi-Fi Hotspot Transfer Engine). Dual-phase transfer architecture combining compact 1-tap Android Hotspot/Wi-Fi settings shortcuts (`ANDROID_INTENTS`), optional collapsible Wi-Fi QR code generator, live Hotspot Radar with 1-tap subnet beaming via `useLocalDiscovery(true)` + `useWebRTC("hotspot")`, collapsible offline 6-digit PIN / QR pairing backup, and collapsible ConnectionDiagnostics.
- **Exports:** `HotspotAssistantCard(): JSX.Element`

#### `src/components/NearbyShareCard.tsx`
- **Purpose:** Mode 4 Controller (Bluetooth & Native Quick Share). Clean, honest Bluetooth workspace with 2-step transfer flow (drag-and-drop/text input with `EstimateBadge`, primary system share handoff via `navigator.share` delegating to native Bluetooth, Quick Share, or AirDrop with transfer history logging), transparent guidance explaining browser Bluetooth radio limitations with Android settings shortcut, and collapsible Web Bluetooth BLE sensor hardware scanner (`navigator.bluetooth`).
- **Exports:** `NearbyShareCard(): JSX.Element`

#### `src/components/CameraStreamCard.tsx`
- **Purpose:** Mode 5 Controller (Via Camera Scan). Lightweight parent coordinator housing the mode heading, role SegmentedControl ("Stream / Send" vs "Scan / Receive"), and conditionally mounting `CameraSender` or `CameraReceiver`.
- **Exports:** `CameraStreamCard(): JSX.Element`, `CameraLayout`.

#### `src/components/camera/CameraSender.tsx`
- **Purpose:** Sender-side controller for air-gapped optical streaming. Handles payload dropping/encoding into sequenced Base45 frames and XOR parity frames, dynamic frame ticking ticker with speed presets (Slow, Normal, Fast), layout switcher (`Single`, `2x2`, `2x3`), density presets (`Small`, `Medium`, `Large`), animated SVG QR rendering, frame progress estimation via `EstimateBadge`, and typed recovery code replaying.
- **Exports:** `CameraSender(props: CameraSenderProps): JSX.Element`, `CameraLayout`, `parseLayoutDims`, `getFramesPerTick`.

#### `src/components/camera/CameraReceiver.tsx`
- **Purpose:** Receiver-side controller for camera stream scanning. Orchestrates `useQuadScanner` (multi-quadrant auto-detection) and `useHtml5Scanner` (classic single-stream camera scanner), throttled frame ingestion into `OpticalDataCollector`, real-time decoding diagnostics line, and session hash tracking.
- **Exports:** `CameraReceiver(props: CameraReceiverProps): JSX.Element`.

#### `src/components/camera/ReceiverCompleteView.tsx`
- **Purpose:** Presentational view displayed when optical transfer reassembly completes with 100% data integrity. Features file metadata display, text snippet viewer, copy text button, and prominent "Save / Download File" action.
- **Exports:** `ReceiverCompleteView(props: ReceiverCompleteViewProps): JSX.Element`.

#### `src/components/camera/ReceiverProgressView.tsx`
- **Purpose:** Presentational live collection progress bar and collapsible missing frames recovery code generator with 1-click clipboard copy.
- **Exports:** `ReceiverProgressView(props: ReceiverProgressViewProps): JSX.Element`.

#### `src/components/RadarPanel.tsx`
- **Purpose:** Reusable discovery radar screen component utilized by `SameNetworkCard` and `HotspotAssistantCard`. Renders animated concentric radar rings, sweeping radar line gradient, center node representing local device identity with avatar customization trigger, radial placement of discovered peer nodes with "Tap to Send" triggers, live connection pulse indicators, and custom empty state notifications.
- **Exports:** `RadarPanel(props: RadarPanelProps): JSX.Element`, `RadarPanelProps`, `RadarIdentity`.

#### `src/components/DirectConnectPanel.tsx`
- **Purpose:** Reusable fallback and direct PIN/QR pairing component utilized by `SameNetworkCard`, `HotspotAssistantCard`, and `CableTransferCard`. Renders local device PIN display with 1-click clipboard copy, "Show QR" modal trigger, peer PIN input field with automated whitespace and hyphen normalization, "Connect" action button, and "Scan QR Code with Camera" button.
- **Exports:** `DirectConnectPanel(props: DirectConnectPanelProps): JSX.Element`, `DirectConnectPanelProps`.

#### `src/components/CableTransferCard.tsx`
- **Purpose:** Mode 6 Controller (Via Cable). Direct gigabit line-speed transfer over USB-C to USB-C or Ethernet cable links. Features 1-tap Android USB tethering shortcut (`ANDROID_INTENTS.TETHER_SETTINGS`), direct link-local WebRTC P2P PIN/QR pairing, and host candidate priority.
- **Exports:** `CableTransferCard(): JSX.Element`

#### `src/components/UltrasonicCard.tsx`
- **Purpose:** Standalone acoustic sound data transfer section situated at the bottom of the home hub. Emits and receives Frequency Shift Keying (FSK) audio over speaker and microphone (near-ultrasonic 18–20 kHz and audible 1.5–3 kHz presets) with live canvas FFT frequency spectrum visualization.
- **Exports:** `UltrasonicCard(): JSX.Element`

#### `src/components/ConnectionDiagnostics.tsx`
- **Purpose:** Collapsible native `<details>` diagnostics panel for WebRTC connections. Displays live server storage mode (with memory multi-instance warning via `/api/health`), masked network group label (`groupLabel`), IP family, discovery radar poll status, ICE connection/gathering/signaling states, DataChannel state, candidate type counts (host, srflx, relay), selected candidate pair, last error, and 40-entry debug log ring buffer with one-click plain text clipboard report export.
- **Exports:** `ConnectionDiagnostics({ diagnostics, debugLog, discoveryStatus }: ConnectionDiagnosticsProps): JSX.Element`, `ConnectionDiagnosticsProps`.

#### `src/components/Dropzone.tsx`
- **Purpose:** Dual-mode payload selector with "Files" tab (multi-file drag-and-drop, format/size formatting, individual item removal, FileTypeBadge chips) and "Text / Link" tab (instant clipboard snippet input).
- **Exports:** `Dropzone({ onSelectionChange }: DropzoneProps): JSX.Element`

#### `src/components/EstimateBadge.tsx`
- **Purpose:** Dynamic badge displaying expected transfer duration calculated by `transferEstimate.ts` based on payload size and active channel throughput. Renders clean icon and time text (e.g. `~3s`, `< 1s`, `42 frames`).
- **Exports:** `EstimateBadge({ channel, payload, frames, className }: EstimateBadgeProps): JSX.Element`, `EstimateBadgeProps`.

#### `src/components/FileTypeBadge.tsx`
- **Purpose:** Color-coded visual file-type badge component categorizing payloads into distinct semantic visual tags (`PDF` in red, `IMG` in purple, `DOC` in blue, `ZIP` in amber, `VID` in rose, `AUD` in cyan, `TXT` in emerald, and `FILE` fallback in neutral).
- **Exports:** `FileTypeBadge({ name, mimeType, className }: FileTypeBadgeProps): JSX.Element`, `getFileTypeInfo`.

#### `src/components/OpticalHandshakeModal.tsx`
- **Purpose:** Standalone visual modal for 100% zero-internet optical WebRTC signaling. Displays compressed Offer/Answer QR codes and launches the camera scanner to exchange SDP descriptions directly across device screens.
- **Exports:** `OpticalHandshakeModal({ isOpen, role, localPayloadQr, onOfferScanned, onAnswerScanned, onClose }: OpticalHandshakeModalProps): JSX.Element | null`

#### `src/components/QRCodeDisplay.tsx`
- **Purpose:** High-contrast QR code renderer powered by `qrcode.react` (`QRCodeSVG`). Displays the dynamic room URL, 6-digit PIN with center hyphen, and one-click copy buttons.
- **Exports:** `QRCodeDisplay({ code, url }: QRCodeDisplayProps): JSX.Element`

#### `src/components/QRScannerModal.tsx`
- **Purpose:** In-browser camera QR code reader using `html5-qrcode`. Features permission handling, camera stream initialization, auto-parsing of room URLs (`?room=...`), and direct PIN extraction.
- **Exports:** `QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps): JSX.Element | null`

#### `src/components/SegmentedControl.tsx`
- **Purpose:** Reusable segmented option switch matching the tactile reference UI. Features a soft neutral pill track, pure white elevated active tab with subtle shadow, `role="tablist"` accessibility, and keyboard arrow key navigation.
- **Exports:** `SegmentedControl({ options, value, onChange, ariaLabel }: SegmentedControlProps): JSX.Element`, `SegmentedControlProps`, `SegmentedControlOption`.

#### `src/components/SpeedIndicator.tsx`
- **Purpose:** Reusable transfer speed indicator with an explicit "Speed" text label, Lucide Gauge icon, and 5 solid high-contrast stepped pill segments (Emerald for 5/5, Indigo for 4/5, Blue for 3/5, Amber for 2/5). Clearly visible across both dark and light modes.
- **Exports:** `SpeedIndicator({ speedBars, total, className, showIcon, showLabel }: SpeedIndicatorProps): JSX.Element`, `getSpeedColorClass(speedBars: number): string`

#### `src/components/ThemeToggle.tsx`
- **Purpose:** Accessible tactile toggle button switching between light and dark modes with persistent `localStorage` synchronization and smooth CSS variable transitions.
- **Exports:** `ThemeToggle(): JSX.Element`

#### `src/components/TransferHistoryModal.tsx`
- **Purpose:** Slide-over ephemeral drawer listing sent and received items from the current session (item name, type chip, byte size, timestamp, channel, and direct download/re-copy actions).
- **Exports:** `TransferHistoryModal({ isOpen, onClose }: TransferHistoryModalProps): JSX.Element | null`

#### `src/components/TransferModal.tsx`
- **Purpose:** Multi-state transfer progress dialog with universal cancellation:
  1. *Connecting:* Early modal display during connection establishment with clear "Cancel Transfer" button.
  2. *Waiting for Acceptance:* Receiver prompt with file/text preview and Accept / Cancel Transfer actions.
  3. *Transferring:* Live progress bar, throughput speed (MB/s), byte counts, and active "Cancel Transfer" action.
  4. *Completed:* Auto-download confirmation for files, or one-click copy button for text snippets.
  5. *Error / Declined:* Informative status feedback with immediate dismiss via close button or Escape key, plus optional "Send via encrypted cloud relay" fallback trigger.
  6. *Encrypted Cloud Relay Receive:* Displays encrypted payload card, prefilled relay code input, decrypt progress, and error feedback.
- **Exports:** `TransferModal(props: TransferModalProps): JSX.Element | null`

#### `src/components/ServiceWorkerRegister.tsx`
- **Purpose:** Registers `/sw.js` in production environments and logs service worker registration status.
- **Exports:** `ServiceWorkerRegister(): null`

---

### 3.3 Custom Hooks (`src/hooks/`)

#### `src/hooks/useWebRTC.ts`
- **Purpose:** Complete WebRTC peer connection and DataChannel manager, backed by focused submodules in `src/lib/webrtc/`. Orchestrates signaling exchange, candidate queuing, binary chunk slicing with buffer backpressure via `waitForDrain` (`@/lib/webrtc/backpressure`), dynamic TURN fetching via `fetchIceConfig`, 12-second Peer/Signaling watchdog, 15-second receiver dial timeout with clear room not found vs 4G firewall error differentiation, automated one-shot `pc.restartIce()`, PeerJS internal `conn.peerConnection` ICE tracking via `@/lib/webrtc/peerJsHelper`, transport isolation (`activeTransportRef`), live diagnostics metrics collection via `@/lib/webrtc/diagnostics` (ICE, gathering, signaling, channel, candidate counts, selected pair), and 40-entry debug log ring buffer.
- **Exports:** `useWebRTC(mode): { role, roomId, roomCode, isConnected, progress, pendingHeader, brokerNotice, startSender, startReceiver, sendFiles, sendText, sendPayload, acceptIncomingTransfer, rejectIncomingTransfer, cleanup, debugLog, diagnostics }`, `waitForDrain`, `DrainableChannel`, `WebRTCDiagnostics`, `DebugLogEntry`, `CandidateCounts`, `SelectedCandidatePair`, `FIREWALL_BLOCKED_MESSAGE`, `ROOM_NOT_FOUND_MESSAGE`.

#### `src/hooks/useRelayTransfer.ts`
- **Purpose:** Chunk-based client-side encrypted cloud relay controller supporting 8 MiB chunks (up to 750 MB per file / 800 MB total, max 100 chunks). Generates single zero-knowledge 6-digit numeric OTPs (`otpCode`), derives hashed `roomCode = SHA-256("qs-room:" + otp6)` for server registration without exposing the OTP, and exposes QR URL (`#otp=<otp6>`). Features `startRelaySend`, `receiveByOtp`, 32-chunk batching, concurrency 2 XMLHttpRequest PUT uploads with real-time continuous byte progress and exponential backoff retries, safe header filtering, clear CORS/CSP/HTTP diagnostic error reporting, offline pause/online resume, concurrency 2 sequential chunk downloading with direct Upstash bucket fetch, resilient chunk download retries (up to 2 retries), and `/api/relay/file` fallback, large-file disk streaming (>100MB) via `diskStream.ts`, progress reporting, and automatic completion cleanup via `/api/relay/complete`.
- **Exports:** `useRelayTransfer`, `RelayState`, `RelayStatus`, `RelayFileMetadata`, `RelayItemMetadata`, `RelayPayloadData`.

#### `src/hooks/useLocalDiscovery.ts`
- **Purpose:** Local network peer discovery via `/api/discover`. Manages peer heartbeat polling every 3s, in-flight request deduplication, dynamic avatar conflict resolution without premature teardown (via decoupled `profileRef`), incoming beam handling, optional 4-digit pairing code for cross-IP / CGNAT discovery, and exposes detailed poll status (`DiscoveryStatus` with `groupLabel` and `ipFamily`).
- **Exports:** `useLocalDiscovery(isAutoDiscovering, code): { profile, peers, networkId, incomingBeam, beamToPeer, clearIncomingBeam, isScanning, updateName, cycleAvatar, refreshPeers, status, pin, lookupPin }`, `DiscoveryStatus`, `NearbyPeer`, `IncomingBeamEvent`.

#### `src/hooks/useNearbyShare.ts`
- **Purpose:** Web Share API (`navigator.share`) delegating files and text to native OS Bluetooth, Quick Share, or AirDrop, combined with a Web Bluetooth GATT client (`navigator.bluetooth`) connecting to peripheral BLE hardware sensors.
- **Exports:** `useNearbyShare(): { capabilities, isSharing, shareSuccess, isConnectingBle, bleDevice, bleServices, errorMsg, shareViaNative, requestBleDevice, disconnectBleDevice, clearError }`, `BleDeviceInfo`, `BleServiceInfo`, `NearbyCapabilities`.

#### `src/hooks/useNetworkStatus.ts`
- **Purpose:** Hydration-safe network and browser capability detection hooks built with `useSyncExternalStore`.
- **Exports:** `useBrowserCapabilities(): BrowserCapabilities`

#### `src/hooks/useHtml5Scanner.ts`
- **Purpose:** Isolated lifecycle and DOM manager for `html5-qrcode`. Completely separates scanner DOM manipulations from React reconciliation to prevent fatal `removeChild` DOM errors. Supports 2-tick rAF layout settling, zero-dimension prevention, sequential fallback constraints, camera device enumeration, and 3s video playing watchdog.
- **Exports:** `useHtml5Scanner(): UseHtml5ScannerReturn`, `UseHtml5ScannerReturn`

#### `src/hooks/useQuadScanner.ts`
- **Purpose:** Multi-layout camera scanner hook supporting 1x1, 2x2, and 2x3 grid decoding. Captures video via `getUserMedia`, runs 10fps loop, and decodes frames using native `BarcodeDetector` or `jsQR` multi-region splitting (`decodeGrid`) with auto-layout candidate rotation starting with 1x1 single QR. Reuses a single offscreen `<canvas>` with 720p dimension capping to completely prevent memory spikes and browser tab crashes on mobile devices.
- **Exports:** `useQuadScanner(): UseQuadScannerReturn`, `pickLayout`, `UseQuadScannerReturn`.

#### `src/hooks/useTheme.ts`
- **Purpose:** Light / dark mode controller using `useSyncExternalStore` for SSR-safe hydration, syncing with `localStorage` and `prefers-color-scheme`.
- **Exports:** `useTheme(): { theme, resolvedTheme, setTheme, toggleTheme }`, `Theme`, `THEME_STORAGE_KEY`.

#### `src/hooks/useTransferHistory.ts`
- **Purpose:** Ephemeral transfer history state hook persisting sent and received files in `sessionStorage` (up to 50 items) with reactive cross-component broadcast.
- **Exports:** `useTransferHistory(): { history, addSentItem, addReceivedItem, clearHistory }`, `addTransferHistoryItem`, `getTransferHistorySnapshot`, `TransferHistoryItem`, `SESSION_STORAGE_KEY`, `MAX_HISTORY_ITEMS`.

---

### 3.4 Protocol & Domain Libraries (`src/lib/`)

#### `src/lib/base45.ts`
- **Purpose:** RFC 9285 Base45 encoder and decoder for QR alphanumeric mode (~97% packing efficiency).
- **Exports:** `encodeBase45(bytes: Uint8Array): string`, `decodeBase45(str: string): Uint8Array`.

#### `src/lib/recoveryWords.ts`
- **Purpose:** 256-word phonetic English dictionary (3-6 chars, unique 3-letter prefixes) for human-readable recovery codes.
- **Exports:** `RECOVERY_WORDS: readonly string[]`, `wordToIndex(rawWord: string): number`.

#### `src/lib/quadDecode.ts`
- **Purpose:** Multi-region image grid splitting (2x2, 2x3, 1x1) with 8% overlap padding on inner edges for multi-QR camera stream decoding. Decodes regions with `decodeGrid`, `decodeQuadrants`, and `jsqrDecodeOne`.
- **Exports:** `cropImageData`, `decodeGrid`, `decodeQuadrants`, `jsqrDecodeOne`, `GridRect`.

#### `src/lib/opticalRecovery.ts`
- **Purpose:** Optical Transfer word recovery code encoder and decoder. Generates human-friendly word sequences mapping session byte, LEB128 varint missing frame ranges, and modulo checksum word (max 40 words). Tolerates hyphens, commas, mixed case, and 3-letter abbreviations.
- **Exports:** `encodeRecoveryCode`, `decodeRecoveryCode`, `formatMissingRanges`, `parseMissingRanges`, `DecodeRecoveryResult`.

#### `src/lib/opticalDataStream.ts`
- **Purpose:** Optical Data Stream protocol for zero-network air-gapped camera-to-screen transfer. Features Base45 alphanumeric QR frames (`QS2:...` and parity `QP2:...`), FNV-1a checksums, symmetrical compression, stride-grouped XOR parity frames (`buildParityFrames`), and automatic single-packet loss reconstruction in `OpticalDataCollector`.
- **Exports:** `encodeFileToOpticalFrames`, `encodeTextToOpticalFrames`, `buildParityFrames`, `getTotalFrameCount`, `parseOpticalDataFrame`, `computePayloadHash`, `OpticalDataCollector`, `OPTICAL_CHUNK_PRESETS`, `splitFirstN`.

#### `src/lib/opticalSdp.ts`
- **Purpose:** WebRTC SDP compressor, host candidate filter, multi-frame sequenced QR frame splitter (`splitOpticalFrames`), and incremental stream collector (`OpticalFrameCollector`) supporting animated QR carousels, out-of-order frame reassembly, and camera-free manual copy/paste.
- **Exports:** `compactSdp`, `encodeOpticalSdp`, `decodeOpticalSdp`, `isOpticalSdp`, `isOpticalFrame`, `splitOpticalFrames`, `computeShortHash`, `OpticalFrameCollector`.

#### `src/lib/transferEstimate.ts`
- **Purpose:** Universal transfer time estimation engine providing baseline transfer speeds per channel, live measured throughput overrides, optical camera frame calculations (with `framesPerTick` multiplier for 2x2 Grid mode), and human-friendly duration formatting.
- **Exports:** `estimateSeconds`, `formatDuration`, `estimateCameraFrames`, `getPayloadBytes`, `ChannelId`.

#### `src/lib/wifiQr.ts`
- **Purpose:** Standardized Wi-Fi configuration string generator (`WIFI:T:WPA;S:...`) and parser recognized by iOS/Android camera apps, with Android intent deep-links.
- **Exports:** `buildWifiQrString`, `parseWifiQrString`, `ANDROID_INTENTS`, `WifiEncryption`.

#### `src/lib/codeGenerator.ts`
- **Purpose:** Cryptographically secure 6-digit room PIN generation, custom key/mobile number preservation, normalization, and flexible 4–20 character room key validation.
- **Exports:** `generateRoomCode`, `formatRoomCode`, `normalizeRoomCode`, `isValidRoomCode`.

#### `src/lib/chunker.ts`
- **Purpose:** ArrayBuffer slicing (64KB chunks), async chunk generator, stream reassembly to Blob or UTF-8 text, and byte/speed formatting.
- **Exports:** `createFileHeader`, `createTextHeader`, `formatBytes`, `formatSpeed`, `sliceBlobIntoChunks`, `reassembleChunksToBlob`, `reassembleChunksToText`.

#### `src/lib/deviceIdentity.ts`
- **Purpose:** Generates non-colliding device identities, operating system detection (`desktop`, `laptop`, `mobile`, `tablet`), and playful visual avatar presets (animals, celestial bodies, and colors) for local subnet radar.
- **Exports:** `getDeviceProfile(): DeviceProfile`, `saveDeviceProfile(profile: DeviceProfile): void`, `AVATAR_PRESETS`, `DeviceProfile`, `AvatarPreset`, `DeviceFormFactor`.

#### `src/lib/signalStore.ts`
- **Purpose:** Dual-mode storage adapter for ephemeral signaling rooms. Seamlessly switches between zero-dependency Redis REST mode (using native `fetch` with Upstash Redis / Vercel KV REST API with trailing slash URL sanitization, command error propagation, and fallback `SET` on unsupported `KEEPTTL`) and in-memory TTL mode with capacity guard and automatic 15-minute pruning.
- **Exports:** `signalStore`, `MemorySignalStore`, `RedisSignalStore`, `isRedisConfigured`, `getSignalStore`.

#### `src/lib/iceConfig.ts`
- **Purpose:** Resilient WebRTC ICE / STUN configuration providing multi-provider public STUN pool (Google + Cloudflare), dynamic `/api/turn` fetching with 2s timeout and client caching, optional static TURN relay injection (`NEXT_PUBLIC_TURN_URL`), and mode-specific RTCConfiguration generator (`getRtcConfig`, `fetchIceConfig`).
- **Exports:** `PUBLIC_STUN_SERVERS`, `getTurnServers`, `getRtcConfig`, `fetchIceConfig`, `_resetDynamicIceCacheForTest`, `FIREWALL_FALLBACK_MESSAGE`.

#### `src/lib/diskStream.ts`
- **Purpose:** Large-file streaming layer leveraging File System Access API (`showSaveFilePicker`) for browser files > 100MB, streaming chunks directly to user disk to prevent tab memory exhaustion while safely falling back to in-memory Blob reassembly when unsupported (Safari, Firefox, small files).
- **Exports:** `DISK_STREAM_THRESHOLD`, `isFileSystemAccessSupported`, `createDiskStreamWriter`.

#### `src/lib/upstashBlob.ts`
- **Purpose:** Upstash Blob SDK integration wrapper for encrypted cloud relay. Handles bucket initialization via Bucket.fromEnv(), environment variable validation (`UPSTASH_BLOB_TOKEN`), storage URL hostname verification (`isAllowedRelayUrl`), and client-side direct upload execution.
- **Exports:** `isUpstashBlobConfigured`, `getUpstashBucketName`, `getUpstashBucket`, `isAllowedRelayUrl`, `upload`, `UploadOptions`, `PutBlobResult`.

#### `src/lib/relayCrypto.ts`
- **Purpose:** Zero-knowledge client-side cryptography module for encrypted cloud relay transfers. Generates 6-digit numeric OTPs (`generateNumericOtp`), normalizes OTPs (`normalizeNumericOtp`), derives uppercase zero-knowledge room IDs via SHA-256 (`deriveRoomIdFromOtp`), generates 8-character legacy codes, 16-byte random salts, derives non-extractable AES-GCM 256 keys via PBKDF2 (SHA-256, 200,000 iterations) from numeric OTPs or legacy codes, and performs authenticated symmetric encryption/decryption with random 12-byte IVs. Supports chunk-based authenticated encryption (`encryptChunk`, `decryptChunk`) with deterministic 12-byte IVs (4-byte base64 prefix + 8-byte big-endian index) and AAD binding.
- **Exports:** `generateRelayCode`, `normalizeRelayCode`, `generateNumericOtp`, `normalizeNumericOtp`, `deriveRoomIdFromOtp`, `generateSalt`, `generateIvPrefix`, `deriveRelayKey`, `encryptText`, `decryptText`, `encryptChunk`, `decryptChunk`.

#### `src/lib/relayLimits.ts`
- **Purpose:** Centralized operational constraints for chunk-based encrypted cloud relay shared across client and server routes. Defines 8 MiB chunk sizing, 750 MiB max per file, 800 MiB max transfer, max 100 chunks per file, authentication tag sizes, and storage TTLs.
- **Exports:** `RELAY_CHUNK_BYTES`, `RELAY_MAX_FILE_BYTES`, `RELAY_MAX_TRANSFER_BYTES`, `RELAY_MAX_FILES`, `RELAY_MAX_CHUNKS_PER_FILE`, `RELAY_TAG_BYTES`, `RELAY_TTL_MINUTES`.

#### `src/lib/relayChunks.ts`
- **Purpose:** Chunk planning, canonical path construction, and AAD generation for chunk-based encrypted cloud relay objects with strict path traversal validation.
- **Exports:** `newRelayId`, `newFileId`, `planChunks`, `chunkPath`, `chunkAad`, `isValidChunkPath`, `cipherSize`, `ChunkPlan`.

#### `src/lib/rateLimit.ts`
- **Purpose:** Lightweight serverless rate limiter utilizing `signalStore` generic key storage with TTL preservation (KEEPTTL). Extracts client IP via `x-forwarded-for` and fallback headers.
- **Exports:** `clientIp(request: Request): string`, `hitLimit(key: string, limit: number, windowSeconds: number): Promise<boolean>`.

#### `src/lib/ultrasonicStream.ts`
- **Purpose:** Frequency Shift Keying (FSK) codec for acoustic sound data transfer. Converts text into hexadecimal nibbles, maps symbols to near-ultrasonic (18–20 kHz) or audible frequencies, and classifies start/stop/data tones.
- **Exports:** `textToNibbles`, `nibblesToText`, `nibbleToFrequency`, `frequencyToNibble`, `classifyTone`, `ULTRASONIC_PRESETS`, `UltrasonicConfig`.

#### `src/lib/signalingClient.ts`
- **Purpose:** Client-side HTTP polling signaling engine coordinating with `/api/signal`. Manages message timestamps, room join notifications, and signal transmission.
- **Exports:** `SignalingClient` class.

#### `src/lib/modeAvailability.ts`
- **Purpose:** Pure business logic functions determining mode accessibility, descriptions, and dynamic badges based on network status and hardware support.
- **Exports:** `isModeAvailable`, `getModeStatus`, `getAllModesStatus`.

#### `src/lib/webrtc/` (Modular WebRTC Protocol Subsystem)
- **`src/lib/webrtc/types.ts`**: Shared TypeScript interfaces (`WebRTCDiagnostics`, `DebugLogEntry`, `CandidateCounts`, `SelectedCandidatePair`, `DrainableChannel`, `PeerJsConnection`, `PeerJsInstance`, `ActiveTransport`) and error message constants (`FIREWALL_BLOCKED_MESSAGE`, `ROOM_NOT_FOUND_MESSAGE`).
- **`src/lib/webrtc/backpressure.ts`**: Stream flow control and buffer backpressure (`waitForDrain`, `waitForChannelOpen`, `normalizeChunkBuffer`, `triggerBlobDownload`, `streamBlobChunks`, `finalizeReceivedPayload`).
- **`src/lib/webrtc/diagnostics.ts`**: WebRTC diagnostics, candidate inspection (`inspectSelectedCandidatePair`, `parseCandidateType`), debug ring-buffer logging (`appendDebugLog`), and standard RTCPeerConnection event listener wiring (`setupRtcPeerConnectionListeners`).
- **`src/lib/webrtc/peerJsHelper.ts`**: Cloud broker adapter for PeerJS (`loadPeerConstructor`, `formatPeerJsId`, `wirePeerConnectionEvents`, `createPeerJsSender`, `createPeerJsReceiver`).
- **`src/lib/webrtc/index.ts`**: Barrel export re-exporting all modular WebRTC primitives and types.

---

### 3.5 Domain Types (`src/types/`)

#### `src/types/mode.ts`
- **Purpose:** Domain type definitions for transfer channels, online/offline status, and browser hardware capabilities.
- **Exports:** `TransferMode` (`"internet" | "same-network" | "hotspot" | "bluetooth" | "camera" | "cable"`), `TransferRole`, `ModeStatus`, `BrowserCapabilities`.

#### `src/types/signaling.ts`
- **Purpose:** Domain type definitions for WebRTC ephemeral signaling rooms, message payloads, and zero-knowledge encrypted cloud relay metadata (`rid`, `baseUrl`, `files`, plus legacy `items` and `text`).
- **Exports:** `PeerRole` (`"sender" | "receiver"`), `SignalPayloadType` (`"offer" | "answer" | "candidate"`), `SignalMessage`, `SignalingRoomState`.

#### `src/types/transfer.ts`
- **Purpose:** Domain type definitions for file chunking, metadata headers, and transfer progress states.
- **Exports:** `FileMetadata`, `TextMetadata`, `TransferPayloadHeader`, `TransferProgressState`, `TransferStatus`, `TransferItemType`.

---

### 3.6 Governance, Configuration & Documentation Files

| File | Purpose | Key Details |
| :--- | :--- | :--- |
| `AGENTS.md` | AI Coding Agent operational governance rules. | Enforces 2-5 word commit format, mandatory doc sync, mandatory testing gate, and automatic GitHub push. |
| `package.json` | Project scripts and dependency declarations. | Scripts: `dev`, `build`, `start`, `lint`, `test` (`vitest run`). |
| `vitest.config.mts` | Vitest configuration file. | `happy-dom` environment, `@/*` import alias mapping. |
| `next.config.ts` | Next.js configuration. | Turbopack CSS loaders, `cacheComponents: true`, `partialPrefetching: true`. |
| `eslint.config.mjs` | Flat ESLint configuration. | Core Web Vitals + TypeScript rules. |
| `vercel.json` | Production deployment configuration for Vercel. | Next.js framework preset, security CSP headers, and PWA cache-control headers. |
| `tsconfig.json` | TypeScript compiler configuration. | ES2022 target, strict mode, Next.js plugin, and `@/*` path alias mapping. |
| `.gitignore` | Git file ignore rules. | Excludes `node_modules`, `.next`, `.env*`, build artifacts, and system files. |
| `README.md` | Central project showcase and repository README. | Hero layout, feature breakdown, 6-channel guide, tech stack, and setup instructions. |
| `documentation/about_project.md` | Architectural specifications & file tree. | Core architecture, transfer channel mechanics, protocols, and ASCII directory tree. |
| `documentation/archive/backlog_sprints_old.md` | Historical sprint archive. | Detailed task checklists and verification gates for historical Sprints 1 through 22. |
| `documentation/backlog.md` | Active product backlog & sprint roadmap. | Feature specifications, historical sprint index table, and detailed recent sprints (23–29). |
| `documentation/codebase_map.md` | High-density codebase dependency map. | System dependency graph, module roles, complete file index, and test mapping. |

---

### 3.7 Public & Static Web Assets (`public/` & `src/app/`)

| File | Purpose | Key Details |
| :--- | :--- | :--- |
| `public/favicon.ico` | Browser tab icon. | Standard browser favicon for web visits. |
| `public/icon.svg` | Vector application icon. | High-resolution scalable vector icon used across PWA installation and app headers. |
| `public/preview.jpg` | Hero interface preview image. | Visual application screenshot used in README showcase and social preview cards. |
| `public/sw.js` | PWA Service Worker script. | Caches application shell, static assets, and icons for instant offline launch. |
| `src/app/favicon.ico` | App Router favicon fallback. | Next.js App Router metadata icon convention. |
| `src/app/icon.svg` | App Router dynamic vector icon. | Next.js App Router dynamic icon route for browser bookmarks and PWA manifests. |

---

### 3.8 Automated Vitest Test Suites (46 Test Suites, 289 Passing Tests)

| Test Suite Path | Target Module | Verified Coverage & Capabilities |
| :--- | :--- | :--- |
| `src/app/api/discover/__tests__/route.test.ts` | `api/discover/route.ts` | Local IP detection, subnet grouping, 4-digit PIN pairing, beam delivery, and TTL expiration. |
| `src/app/api/health/__tests__/route.test.ts` | `api/health/route.ts` | Operational health check JSON payload, Redis/memory storage telemetry, and HTTP 200. |
| `src/app/api/relay/__tests__/cleanup.test.ts` | `api/relay/cleanup/route.ts` | Bearer CRON_SECRET auth, Blob list cursor pagination, 30-minute stale blob del() purge. |
| `src/app/api/relay/__tests__/route.test.ts` | `api/relay/status, attach, complete, file` | Status limits, foreign baseUrl rejection, chunkCount mismatch, 300MB total ceiling, SSRF file proxy prevention, and exact manifest blob deletion. |
| `src/app/api/relay/__tests__/upload.test.ts` | `api/relay/upload/route.ts` | Chunk batch validation (max 64), bad path/rid rejection, oversized chunks, hourly byte limiter (600MB/hr), and daily budget (process.env.RELAY_DAILY_BYTES). |
| `src/app/api/signal/__tests__/route.test.ts` | `api/signal/route.ts` | Room creation, room query by code, peer joining, signaling delivery, error codes, and cleanup. |
| `src/app/api/turn/__tests__/route.test.ts` | `api/turn/route.ts` | Dynamic TURN fetching, Metered API caching, STUN fallback, and static config. |
| `src/components/__tests__/CableTransferCard.test.tsx` | `CableTransferCard.tsx` | Mode 6 cable UI, Android USB tethering shortcut button, and direct PIN connection flow. |
| `src/components/__tests__/CameraStreamCard.test.tsx` | `CameraStreamCard.tsx` | Mode 5 optical coordinator, role switching (Send/Receive), layout switching, and rendering. |
| `src/components/__tests__/ConnectionDiagnostics.test.tsx` | `ConnectionDiagnostics.tsx` | Diagnostics drawer rendering, ICE candidate stats, connection state changes, and error reporting. |
| `src/components/__tests__/DirectConnectPanel.test.tsx` | `DirectConnectPanel.tsx` | Formatted PIN display, clipboard copy, input whitespace/hyphen normalization, and camera QR trigger. |
| `src/components/__tests__/FileTypeBadge.test.tsx` | `FileTypeBadge.tsx` | Color-coded file chips across document, image, video, audio, archive, and code extensions. |
| `src/components/__tests__/HotspotAssistantCard.test.tsx` | `HotspotAssistantCard.tsx` | Mode 3 Wi-Fi hotspot setup, Wi-Fi QR generator, peer radar, and unified fallback details. |
| `src/components/__tests__/InternetSharingCard.test.tsx` | `InternetSharingCard.tsx` | Send/Receive views, live QR and PIN co-location, Auto PIN/Mobile/Keyword pairing modes, ConnectionDiagnostics rendering, relay consent, and ready PIN. |
| `src/components/__tests__/NearbyShareCard.test.tsx` | `NearbyShareCard.tsx` | Mode 4 Bluetooth guidance, Web Share API handoff, history logging, and BLE GATT scanner. |
| `src/components/__tests__/RadarPanel.test.tsx` | `RadarPanel.tsx` | Concentric radar rings, center identity node, avatar modal callback, peer radial layout, and beam triggering. |
| `src/components/__tests__/SameNetworkCard.test.tsx` | `SameNetworkCard.tsx` | 2-tab step-by-step wizard, Step 1 Dropzone & Find Devices, Step 2 RadarPanel & fallback swap. |
| `src/components/__tests__/SegmentedControl.test.tsx` | `SegmentedControl.tsx` | Pill track rendering, option selection state, keyboard navigation, and custom class names. |
| `src/components/__tests__/SpeedIndicator.test.tsx` | `SpeedIndicator.tsx` | Real-time throughput calculations, MB/s rendering, progress percentages, and status colors. |
| `src/components/__tests__/TransferModal.test.tsx` | `TransferModal.tsx` | Transfer modal prompt, file metadata, progress tracking, transfer cancellation, auto-download, relay error button, and encrypted card. |
| `src/components/__tests__/UltrasonicCard.test.tsx` | `UltrasonicCard.tsx` | FSK sound transmission, audio spectrum canvas visualization, and tone modulation presets. |
| `src/components/camera/__tests__/CameraParts.test.tsx` | `camera/Receiver*.tsx` | ReceiverProgressView block updates, word recovery codes, and ReceiverCompleteView download actions. |
| `src/hooks/__tests__/nearbyShare.test.ts` | `useNearbyShare.ts` | Web Share API payload delegation, file support detection, and BLE hardware scanner status. |
| `src/hooks/__tests__/useHtml5Scanner.test.ts` | `useHtml5Scanner.ts` | Single-stream camera scanner lifecycle, canvas rendering, and robust DOM error cleanup. |
| `src/hooks/__tests__/useLocalDiscovery.test.tsx` | `useLocalDiscovery.ts` | Subnet discovery polling, peer list diffing, 4-digit PIN registration, and incoming beams. |
| `src/hooks/__tests__/useQuadScanner.test.ts` | `useQuadScanner.ts` | Multi-quadrant scanner initialization, layout rotation, canvas recycling, and track cleanup. |
| `src/hooks/__tests__/useRelayTransfer.test.ts` | `useRelayTransfer.ts` | Status fetching, polling cancellation, 10 MiB 2-chunk upload, chunk failure retry & backoff, 4-failure error reporting, offline pause/online resume, wrong relay code error guard without calling complete, cancel cleanup, and >100MB disk streaming writer invocation. |
| `src/hooks/__tests__/useTheme.test.tsx` | `useTheme.ts` | Dark/light theme state toggling, class application to document root, and localStorage persistence. |
| `src/hooks/__tests__/useTransferHistory.test.ts` | `useTransferHistory.ts` | Transfer history logging, drawer state management, session persistence, and re-download links. |
| `src/hooks/__tests__/useWebRTC.test.ts` | `useWebRTC.ts` | WebRTC connection setup, 12s/15s receiver dial timeouts, PeerJS conn.peerConnection ICE watchdog, buffer draining, and room/firewall diagnostics. |
| `src/lib/__tests__/base45.test.ts` | `base45.ts` | Base45 alphanumeric encoding and decoding round-trip with arbitrary binary buffers. |
| `src/lib/__tests__/chunker.test.ts` | `chunker.ts` | Binary Blob chunking into 64KB packets, packet header framing, and EOF flags. |
| `src/lib/__tests__/codeGenerator.test.ts` | `codeGenerator.ts` | 6-digit numeric room code and PIN generation, uniqueness, and format compliance. |
| `src/lib/__tests__/deviceIdentity.test.ts` | `deviceIdentity.ts` | Random avatar emoji assignment, device model label detection, and profile persistence. |
| `src/lib/__tests__/diskStream.test.ts` | `diskStream.ts` | File System Access API feature detection and writable stream disk writer creation. |
| `src/lib/__tests__/iceConfig.test.ts` | `iceConfig.ts` | Multi-provider STUN server resolution, TURN credentials, and RTCConfiguration generation. |
| `src/lib/__tests__/modeAvailability.test.ts` | `modeAvailability.ts` | Online/offline mode accessibility logic, dynamic badge labels, and descriptions. |
| `src/lib/__tests__/opticalDataStream.test.ts` | `opticalDataStream.ts` | Optical stream reassembly, frame parsing, sequence indexing, and FNV-1a checksum validation. |
| `src/lib/__tests__/opticalRecovery.test.ts` | `opticalRecovery.ts` | XOR parity stride computation, missing packet reconstruction, and recovery validation. |
| `src/lib/__tests__/opticalSdp.test.ts` | `opticalSdp.ts` | SDP session description compression and serialization into scannable QR payloads. |
| `src/lib/__tests__/quadDecode.test.ts` | `quadDecode.ts` | Canvas quadrant geometry calculation, coordinate slicing, and video frame partitioning. |
| `src/lib/__tests__/rateLimit.test.ts` | `rateLimit.ts` | Sliding window hit rate counting, window expiration, IP extraction fallback. |
| `src/lib/__tests__/relayChunks.test.ts` | `relayChunks.ts` | Boundary chunk planning (0, 1, 4MB, 4MB+1, 200MB), AAD generation, cipher sizing, and strict path validation against traversal and out-of-bounds indices. |
| `src/lib/__tests__/relayCrypto.test.ts` | `relayCrypto.ts` | PBKDF2 key derivation, AES-GCM 256 text encryption/decryption, bit-tampering detection, chunk roundtrip, swapped chunk order rejection (AAD mismatch), and IV prefix generation. |
| `src/lib/__tests__/signalStore.test.ts` | `signalStore.ts` | Memory and Redis signaling store adapters, room creation, TTL expiration, and capacity limits. |
| `src/lib/__tests__/transferEstimate.test.ts` | `transferEstimate.ts` | Dynamic duration calculation across transfer channels and payload sizes. |
| `src/lib/__tests__/ultrasonicStream.test.ts` | `ultrasonicStream.ts` | FSK sound nibble encoding, frequency tone mapping, tone classification, and decoding. |
| `src/lib/__tests__/wifiQr.test.ts` | `wifiQr.ts` | Standard Wi-Fi credential QR string formatting, escaping, and authentication flags. |

---

## 4. Sprint & Maintenance Status: All Sprints & Fixes Verified
All historical sprints and recent production maintenance fixes (Fix 1: PeerJS 15s watchdog; Fix 2: README simplification; Fix 3: Encrypted cloud relay backend core; Fix 4: Upload token rate limiting, cron cleanup, CSP & SW hardening; Fix 5: Encrypted cloud relay UI, client PBKDF2/AES-GCM encryption, `#rc=` PIN fragment appending, and live ExpressTURN + Upstash Redis integration) are fully implemented, verified with 289 passing unit tests across 46 test suites, zero lint warnings, and clean production Turbopack build.
