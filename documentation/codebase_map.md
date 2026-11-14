# QuickSend: Codebase Map & Dependency Graph

> **Last Updated:** Sprint 4 Complete (Mode 4 Bluetooth, Polish, History & Vercel Deployment)  
> **Target Deployment:** [quicksend.vercel.app](https://quicksend.vercel.app)  
> **Module Path Alias:** `@/*` -> `./src/*`

This document provides a high-density, comprehensive map of the repository's modules, files, dependencies, exports, and browser API integrations. Any AI coding assistant or engineer can read this single document to understand the codebase without scanning raw files.

---

## 1. System Dependency & Architecture Graph

```mermaid
flowchart TD
    subgraph Browser_APIs["Browser & Hardware Runtime APIs"]
        RTC["WebRTC (RTCDataChannel, RTCPeerConnection)"]
        BLE["Web Bluetooth GATT Client (navigator.bluetooth)"]
        Share["Web Share API (navigator.share with files)"]
        NetStat["Network Information (navigator.onLine, online/offline events)"]
        Cam["MediaDevices / Camera (HTML5 QR Scanner)"]
        SW["Service Worker (public/sw.js, CacheStorage)"]
    end

    subgraph External_Libraries["Installed Core Packages"]
        NextJS["Next.js 16 (App Router, Turbopack, Route Handlers)"]
        React19["React 19 (useSyncExternalStore, Client Components)"]
        Lucide["lucide-react (Icons: Globe, Wifi, Smartphone, Bluetooth, Zap, etc.)"]
        QRGen["qrcode.react (QRCodeSVG Generator)"]
        QRScan["html5-qrcode (Html5Qrcode Camera Scanner)"]
        Tailwind["Tailwind CSS v4 (@tailwindcss/turbopack)"]
        Vitest["Vitest v5 + happy-dom (37 Passing Tests)"]
    end

    subgraph App_Routes["src/app/ (App Router & Route Handlers)"]
        Layout["layout.tsx (Root Shell, Font Injection)"]
        Page["page.tsx (4-Mode Home Hub & URL Param Receiver)"]
        Manifest["manifest.ts (PWA Web App Manifest)"]
        SignalAPI["api/signal/route.ts (Room Signaling & Ephemeral Relay)"]
        SignalAPITests["api/signal/__tests__/route.test.ts (API Route Tests)"]
    end

    subgraph Src_Components["src/components/ (UI & Presentation Components)"]
        AppHdr["AppHeader.tsx (Logo, Session History Pill, Status Badge)"]
        ModeSel["ModeSelector.tsx (4-Mode Grid & Active Panels)"]
        NetBadge["NetworkStatusBadge.tsx (Online/Offline Real-Time Pill)"]
        SWReg["ServiceWorkerRegister.tsx (PWA /sw.js Registration)"]
        InternetCard["InternetSharingCard.tsx (Mode 1 Controller: PIN/QR & Send/Receive)"]
        SameNetCard["SameNetworkCard.tsx (Mode 2 Controller: Local LAN & Optical QR)"]
        HotspotCard["HotspotAssistantCard.tsx (Mode 3 Controller: Hotspot QR & Wizard)"]
        NearbyCard["NearbyShareCard.tsx (Mode 4 Controller: Quick Share & BLE Client)"]
        OpticalModal["OpticalHandshakeModal.tsx (Camera-to-Camera Optical QR Handshake)"]
        DropzoneComp["Dropzone.tsx (Drag & Drop Files / Text Paste Tabs)"]
        QRDisp["QRCodeDisplay.tsx (SVG QR Generator & 6-Digit PIN Display)"]
        QRModal["QRScannerModal.tsx (Camera Viewport Scanner Dialog)"]
        TransferMod["TransferModal.tsx (Incoming Prompt, Speed, Progress Bar)"]
        HistoryMod["TransferHistoryModal.tsx (Ephemeral Session Transfer Drawer)"]
    end

    subgraph Src_Hooks["src/hooks/ (Custom React Hooks)"]
        UseNet["useNetworkStatus.ts (useNetworkStatus, useBrowserCapabilities)"]
        UseRTC["useWebRTC.ts (useWebRTC: Peer Connection & Stream Controller)"]
        UseNearby["useNearbyShare.ts (useNearbyShare: Web Share & Web-BLE Client)"]
        UseHist["useTransferHistory.ts (useTransferHistory: Ephemeral Session Storage)"]
    end

    subgraph Src_Lib["src/lib/ (Protocols, Pure Logic & Utilities)"]
        ModeAvail["modeAvailability.ts (isModeAvailable, getModeStatus, getAllModesStatus)"]
        CodeGen["codeGenerator.ts (generateRoomCode, formatRoomCode, normalizeRoomCode)"]
        Chunker["chunker.ts (sliceBlobIntoChunks, reassembly, formatBytes, formatSpeed)"]
        SigClient["signalingClient.ts (SignalingClient: Room & Signal Polling Engine)"]
        WifiQr["wifiQr.ts (buildWifiQrString, parseWifiQrString, ANDROID_INTENTS)"]
        OpticalSdp["opticalSdp.ts (encodeOpticalSdp, decodeOpticalSdp, compactSdp)"]
    end

    subgraph Src_Types["src/types/ (TypeScript Domain Interfaces)"]
        ModeTypes["mode.ts (TransferMode, ModeStatus, BrowserCapabilities)"]
        SignalTypes["signaling.ts (PeerRole, SignalMessage, SignalingRoomState)"]
        TransferTypes["transfer.ts (FileMetadata, TransferPayloadHeader, TransferProgressState)"]
    end

    %% Active Wired Dependencies
    Layout --> SWReg
    Layout --> Page
    Page --> NetBadge
    Page --> ModeSel
    NetBadge --> UseNet
    ModeSel --> UseNet
    ModeSel --> ModeAvail
    ModeSel --> InternetCard
    ModeSel --> SameNetCard
    ModeSel --> HotspotCard

    InternetCard --> UseRTC
    InternetCard --> DropzoneComp
    InternetCard --> QRDisp
    InternetCard --> QRModal
    InternetCard --> TransferMod
    InternetCard --> CodeGen

    SameNetCard --> UseRTC
    SameNetCard --> DropzoneComp
    SameNetCard --> OpticalModal
    SameNetCard --> TransferMod
    SameNetCard --> OpticalSdp

    HotspotCard --> UseRTC
    HotspotCard --> DropzoneComp
    HotspotCard --> OpticalModal
    HotspotCard --> TransferMod
    HotspotCard --> WifiQr
    HotspotCard --> OpticalSdp
    HotspotCard --> QRGen

    OpticalModal --> QRGen
    OpticalModal --> QRModal
    OpticalModal --> OpticalSdp

    QRDisp --> QRGen
    QRDisp --> CodeGen
    QRModal --> QRScan
    QRModal --> CodeGen
    DropzoneComp --> Chunker
    TransferMod --> Chunker
    UseRTC --> SigClient
    UseRTC --> Chunker
    UseRTC --> RTC
    SigClient --> SignalAPI
    SignalAPI --> CodeGen
    SignalAPI --> SignalTypes
```

---

## 2. Directory & Module Roles

| Directory | Role & Responsibilities | Key Dependencies |
| :--- | :--- | :--- |
| `src/app/` | Next.js App Router entry points, layout, metadata, and `/api/signal` room signaling handler. | `next`, `react`, `lucide-react` |
| `src/app/api/signal/` | Ephemeral serverless WebRTC room signaling and ICE/SDP message queue. | `src/lib/codeGenerator`, `src/types/signaling` |
| `src/components/` | Presentation & interactive units: 4-mode selector, Internet mode, Same-Network mode, Hotspot assistant, Optical Handshake modal, Dropzone, QR display/scanner, and transfer progress modal. | `lucide-react`, `qrcode.react`, `html5-qrcode`, `src/hooks/` |
| `src/hooks/` | Stateful React lifecycle hooks managing network connectivity (`useNetworkStatus`) and WebRTC P2P streams (`useWebRTC`). | `react`, `src/lib/` |
| `src/lib/` | Pure TypeScript domain functions: binary packet chunking, room code generators, Wi-Fi pairing QR strings, optical SDP compression, and mode availability evaluators. | `src/types/`, `vitest` |
| `src/types/` | Domain TypeScript interfaces: transfer headers, progress state, signaling messages, and mode contracts. | TypeScript |
| `public/` | Static SVG icons, PWA Service Worker (`sw.js`), and public web assets. | Browser CacheStorage |
| `documentation/` | Living project governance, sprint roadmaps, architecture specifications, and codebase maps. | Markdown Docs |

---

## 3. Comprehensive File Index

### 3.1 Application Routes & Route Handlers (`src/app/`)

#### `src/app/page.tsx`
- **Purpose:** Primary landing hub for "QuickSend". Wraps `<ModeSelector />` in `<Suspense>` so dynamic search params (`?room=123456`) hydrate cleanly while maintaining static prerendering.
- **Exports:** `default Home(): JSX.Element`

#### `src/app/api/signal/route.ts`
- **Purpose:** Next.js Route Handler (`GET`, `POST`) for ephemeral room coordination, SDP offer/answer exchange, and ICE candidate delivery. Automatically cleans up expired rooms (>15 mins).
- **Exports:** `GET(request: Request)`, `POST(request: Request)`

#### `src/app/api/signal/__tests__/route.test.ts`
- **Purpose:** Integration test suite verifying room creation, room query by code, peer joining, signaling delivery, and cleanup.

---

### 3.2 UI Components (`src/components/`)

#### `src/components/SameNetworkCard.tsx`
- **Purpose:** Mode 2 Controller (Same Network Wi-Fi). Prioritizes internal host ICE candidates across the local router subnet and supports Camera-to-Camera Optical QR fallback when the local network has no internet.
- **Exports:** `SameNetworkCard(): JSX.Element`

#### `src/components/HotspotAssistantCard.tsx`
- **Purpose:** Mode 3 Controller (Wi-Fi + Hotspot Interface). Guided wizard for mobile/laptop AP activation, Android settings shortcuts (`TETHER_SETTINGS`), standardized `WIFI:T:WPA;S:...` pairing QR code generation, and offline optical WebRTC handshake.
- **Exports:** `HotspotAssistantCard(): JSX.Element`

#### `src/components/OpticalHandshakeModal.tsx`
- **Purpose:** Visual modal for 100% zero-internet optical WebRTC signaling. Displays compressed Offer/Answer QR codes and launches the camera scanner to exchange SDP descriptions directly across device screens.
- **Exports:** `OpticalHandshakeModal({ isOpen, role, localPayloadQr, onOfferScanned, onAnswerScanned, onClose }: OpticalHandshakeModalProps): JSX.Element | null`

#### `src/components/InternetSharingCard.tsx`
- **Purpose:** Mode 1 Interactive Controller. Manages Format (`PIN / Mobile / Keyword` or `QR Code`) and Role (`Send` or `Receive`). Offers flexible sender strategies (Auto 6-digit PIN, memorized Mobile Number, or Custom Keyword), dynamic room code lookup, dropzone payload selection, peer connection status, and transfer modal trigger.
- **Exports:** `InternetSharingCard({ initialRoomCode }: InternetSharingCardProps): JSX.Element`

#### `src/components/Dropzone.tsx`
- **Purpose:** Dual-mode payload selector with "Files" tab (multi-file drag-and-drop, format/size formatting, individual item removal) and "Text / Link" tab (instant clipboard snippet input).
- **Exports:** `Dropzone({ onSelectionChange }: DropzoneProps): JSX.Element`

#### `src/components/QRCodeDisplay.tsx`
- **Purpose:** High-contrast QR code renderer powered by `qrcode.react` (`QRCodeSVG`). Displays the dynamic room URL, 6-digit PIN with center hyphen, and one-click copy buttons.
- **Exports:** `QRCodeDisplay({ code, url }: QRCodeDisplayProps): JSX.Element`

#### `src/components/QRScannerModal.tsx`
- **Purpose:** In-browser camera QR code reader using `html5-qrcode`. Features permission handling, camera stream initialization, auto-parsing of room URLs (`?room=...`), and direct PIN extraction.
- **Exports:** `QRScannerModal({ isOpen, onClose, onScanSuccess }: QRScannerModalProps): JSX.Element | null`

#### `src/components/TransferModal.tsx`
- **Purpose:** Multi-state transfer progress dialog:
  1. *Waiting for Acceptance:* Receiver prompt with file/text preview and Accept/Decline actions.
  2. *Transferring:* Live progress bar, throughput speed (MB/s), and byte counts.
  3. *Completed:* Auto-download confirmation for files, or one-click copy button for text snippets.
  4. *Error / Declined:* Informative status feedback.
- **Exports:** `TransferModal({ progress, onAccept, onReject, onClose }: TransferModalProps): JSX.Element | null`

#### `src/components/ModeSelector.tsx`
- **Purpose:** Client component rendering the 4 compact, rounded option tiles, auto grey-out state when offline, and focused dedicated mode workspace transitions with a top "All Modes" back pill navigation.
- **Exports:** `ModeSelector(): JSX.Element`

#### `src/components/NetworkStatusBadge.tsx`
- **Purpose:** Live connection status pill reflecting online/offline state.

#### `src/components/ServiceWorkerRegister.tsx`
- **Purpose:** Registers `/sw.js` in production environments.

---

### 3.3 Custom Hooks (`src/hooks/`)

#### `src/hooks/useWebRTC.ts`
- **Purpose:** Complete WebRTC peer connection and DataChannel manager. Orchestrates signaling exchange, candidate queuing, 64KB binary chunk slicing with buffer backpressure, transfer progress calculation, and receiver file/text reassembly.
- **Exports:** `useWebRTC(): { role, roomId, roomCode, isConnected, progress, pendingHeader, startSender, startReceiver, sendPayload, acceptIncomingTransfer, rejectIncomingTransfer, cleanup }`

#### `src/hooks/useNetworkStatus.ts`
- **Purpose:** Hydration-safe network and browser capability detection hooks built with `useSyncExternalStore`.
- **Exports:** `useNetworkStatus(): boolean`, `useBrowserCapabilities(): BrowserCapabilities`

---

### 3.4 Protocol & Domain Libraries (`src/lib/`)

#### `src/lib/wifiQr.ts`
- **Purpose:** Standardized Wi-Fi configuration string generator (`WIFI:T:WPA;S:...`) and parser recognized by iOS/Android camera apps, with Android intent deep-links.
- **Exports:** `buildWifiQrString`, `parseWifiQrString`, `ANDROID_INTENTS`.

#### `src/lib/opticalSdp.ts`
- **Purpose:** WebRTC SDP compressor, host candidate filter, and base64 encoder/decoder for camera-to-camera optical signaling (`OPTSDP:...`).
- **Exports:** `compactSdp`, `encodeOpticalSdp`, `decodeOpticalSdp`, `isOpticalSdp`.

#### `src/lib/codeGenerator.ts`
- **Purpose:** Cryptographically secure 6-digit room PIN generation, custom key/mobile number preservation, normalization, and flexible 4–20 character room key validation.
- **Exports:** `generateRoomCode`, `formatRoomCode`, `normalizeRoomCode`, `isValidRoomCode`.

#### `src/lib/chunker.ts`
- **Purpose:** ArrayBuffer slicing (64KB chunks), async chunk generator, stream reassembly to Blob or UTF-8 text, and byte/speed formatting.
- **Exports:** `createFileHeader`, `createTextHeader`, `formatBytes`, `formatSpeed`, `sliceBlobIntoChunks`, `reassembleChunksToBlob`, `reassembleChunksToText`.

#### `src/lib/signalingClient.ts`
- **Purpose:** Client-side HTTP polling signaling engine coordinating with `/api/signal`. Manages message timestamps, room join notifications, and signal transmission.
- **Exports:** `SignalingClient` class.

#### `src/lib/modeAvailability.ts`
- **Purpose:** Pure business logic functions determining mode accessibility, descriptions, and dynamic badges based on network status and hardware support.
- **Exports:** `isModeAvailable`, `getModeStatus`, `getAllModesStatus`.

---

### 3.5 Domain Types (`src/types/`)

| File | Key Exported Types |
| :--- | :--- |
| `src/types/transfer.ts` | `FileMetadata`, `TextMetadata`, `TransferPayloadHeader`, `TransferProgressState`, `TransferStatus`. |
| `src/types/signaling.ts` | `PeerRole`, `SignalPayloadType`, `SignalMessage`, `SignalingRoomState`. |
| `src/types/mode.ts` | `TransferMode`, `InternetFormat`, `TransferRole`, `ModeStatus`, `BrowserCapabilities`. |

---

### 3.6 Governance & Root Configuration Files

| File | Purpose | Key Details |
| :--- | :--- | :--- |
| `AGENTS.md` | AI Coding Agent operational governance rules. | Enforces 2-5 word commit format, mandatory doc sync, mandatory testing gate, and automatic GitHub push. |
| `package.json` | Project scripts and dependency declarations. | Scripts: `dev`, `build`, `start`, `lint`, `test` (`vitest run`). |
| `vitest.config.mts` | Vitest configuration file. | `happy-dom` environment, `@/*` import alias mapping. |
| `next.config.ts` | Next.js configuration. | Turbopack CSS loaders, `cacheComponents: true`, `partialPrefetching: true`. |
| `eslint.config.mjs` | Flat ESLint configuration. | Core Web Vitals + TypeScript rules. |
| `vercel.json` | Production deployment configuration for Vercel. | Next.js framework preset, security CSP headers, and PWA cache-control headers. |

---

## 4. Sprint Status: All Sprints Completed
All four core sprints (Sprint 1: Foundation & Offline PWA, Sprint 2: Core UI & Mode 1 Internet, Sprint 3: Mode 2 Same Network & Mode 3 Hotspot, Sprint 4: Mode 4 Bluetooth, History & Vercel) are fully implemented, verified with 37 passing unit tests, and production build ready.
```
