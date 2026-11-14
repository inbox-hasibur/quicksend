"use client";

import { useState, useCallback, useSyncExternalStore } from "react";

export interface BleDeviceInfo {
  id: string;
  name?: string;
  connected: boolean;
}

export interface BleServiceInfo {
  uuid: string;
  isPrimary: boolean;
  characteristics: string[];
}

export interface NearbyCapabilities {
  hasWebShare: boolean;
  canShareFiles: boolean;
  hasBluetooth: boolean;
}

// Minimal Web Bluetooth Web API types
interface BluetoothCharacteristic {
  uuid: string;
}

interface BluetoothService {
  uuid: string;
  isPrimary: boolean;
  getCharacteristics: () => Promise<BluetoothCharacteristic[]>;
}

interface BluetoothGATTServer {
  connected: boolean;
  connect: () => Promise<BluetoothGATTServer>;
  disconnect: () => void;
  getPrimaryServices: () => Promise<BluetoothService[]>;
}

interface BluetoothDeviceLike {
  id: string;
  name?: string;
  gatt?: BluetoothGATTServer;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface WebBluetoothAPI {
  requestDevice: (options: {
    acceptAllDevices?: boolean;
    optionalServices?: string[];
  }) => Promise<BluetoothDeviceLike>;
}

const emptySubscribe = () => () => {};

let cachedCapabilities: NearbyCapabilities | null = null;

function getCapabilitiesSnapshot(): NearbyCapabilities {
  if (!cachedCapabilities && typeof navigator !== "undefined") {
    const hasWebShare = "share" in navigator;
    let canShareFiles = false;

    if (hasWebShare && "canShare" in navigator) {
      try {
        const dummyFile = new File(["test"], "test.txt", { type: "text/plain" });
        canShareFiles = navigator.canShare({ files: [dummyFile] });
      } catch {
        canShareFiles = false;
      }
    }

    const hasBluetooth = "bluetooth" in navigator;

    cachedCapabilities = {
      hasWebShare,
      canShareFiles,
      hasBluetooth,
    };
  }

  return (
    cachedCapabilities ?? {
      hasWebShare: false,
      canShareFiles: false,
      hasBluetooth: false,
    }
  );
}

const serverCapabilities: NearbyCapabilities = {
  hasWebShare: false,
  canShareFiles: false,
  hasBluetooth: false,
};

export function useNearbyShare() {
  const capabilities = useSyncExternalStore(
    emptySubscribe,
    getCapabilitiesSnapshot,
    () => serverCapabilities
  );

  const [isSharing, setIsSharing] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);
  const [isConnectingBle, setIsConnectingBle] = useState(false);
  const [bleDevice, setBleDevice] = useState<BleDeviceInfo | null>(null);
  const [bleServices, setBleServices] = useState<BleServiceInfo[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Raw active bluetooth device reference
  const [activeDevice, setActiveDevice] = useState<BluetoothDeviceLike | null>(null);

  // Native OS Share Trigger (Quick Share, AirDrop, Windows Bluetooth)
  const shareViaNative = useCallback(
    async (payload: { files?: File[]; text?: string; title?: string }) => {
      setErrorMsg(null);
      setShareSuccess(false);

      if (typeof navigator === "undefined" || !("share" in navigator)) {
        setErrorMsg("Native Web Share is not supported in this browser. Use Chrome or Edge on Android/Windows/macOS.");
        return false;
      }

      const shareData: ShareData = {
        title: payload.title || "Share Anything Beam",
      };

      if (payload.text && payload.text.trim()) {
        shareData.text = payload.text;
      }

      if (payload.files && payload.files.length > 0) {
        if ("canShare" in navigator && navigator.canShare({ files: payload.files })) {
          shareData.files = payload.files;
        } else if (!shareData.text) {
          shareData.text = `Sharing ${payload.files.length} file(s): ${payload.files.map((f) => f.name).join(", ")}`;
        }
      }

      try {
        setIsSharing(true);
        await navigator.share(shareData);
        setShareSuccess(true);
        setTimeout(() => setShareSuccess(false), 3000);
        return true;
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return false;
        }
        setErrorMsg(err instanceof Error ? err.message : "Failed to open native share sheet.");
        return false;
      } finally {
        setIsSharing(false);
      }
    },
    []
  );

  // Web Bluetooth GATT Client Scanner & Connect
  const requestBleDevice = useCallback(async () => {
    setErrorMsg(null);

    if (typeof navigator === "undefined" || !("bluetooth" in navigator)) {
      setErrorMsg("Web Bluetooth is not supported in this browser. Supported in Chrome, Edge, and Opera on Android, Windows, ChromeOS, and macOS.");
      return;
    }

    try {
      setIsConnectingBle(true);
      const bluetooth = (navigator as unknown as { bluetooth: WebBluetoothAPI }).bluetooth;
      const device = await bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ["generic_access", "battery_service"],
      });

      setActiveDevice(device);
      setBleDevice({
        id: device.id,
        name: device.name || "Unnamed BLE Device",
        connected: false,
      });

      device.addEventListener("gattserverdisconnected", () => {
        setBleDevice((prev) => (prev ? { ...prev, connected: false } : null));
        setBleServices([]);
      });

      if (device.gatt) {
        const server = await device.gatt.connect();
        setBleDevice({
          id: device.id,
          name: device.name || "Unnamed BLE Device",
          connected: server.connected,
        });

        try {
          const services = await server.getPrimaryServices();
          const discovered: BleServiceInfo[] = [];

          for (const s of services) {
            let charUuids: string[] = [];
            try {
              const chars = await s.getCharacteristics();
              charUuids = chars.map((c: BluetoothCharacteristic) => c.uuid);
            } catch {
              // Service may restrict discovery
            }
            discovered.push({
              uuid: s.uuid,
              isPrimary: s.isPrimary,
              characteristics: charUuids,
            });
          }
          setBleServices(discovered);
        } catch {
          // Device may restrict general service enumeration
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "NotFoundError") {
        return;
      }
      setErrorMsg(err instanceof Error ? err.message : "Failed to connect to Bluetooth peripheral.");
    } finally {
      setIsConnectingBle(false);
    }
  }, []);

  const disconnectBleDevice = useCallback(() => {
    if (activeDevice?.gatt?.connected) {
      activeDevice.gatt.disconnect();
    }
    setActiveDevice(null);
    setBleDevice(null);
    setBleServices([]);
  }, [activeDevice]);

  return {
    capabilities,
    isSharing,
    shareSuccess,
    isConnectingBle,
    bleDevice,
    bleServices,
    errorMsg,
    shareViaNative,
    requestBleDevice,
    disconnectBleDevice,
    clearError: () => setErrorMsg(null),
  };
}
