"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  getLocalDeviceProfile,
  updateLocalDeviceName,
  type DeviceProfile,
} from "@/lib/deviceIdentity";

export interface NearbyPeer {
  id: string;
  name: string;
  formFactor: "desktop" | "laptop" | "mobile" | "tablet";
  peerId: string;
  lastSeen: number;
}

export function useLocalDiscovery(isAutoDiscovering = true) {
  const [profile, setProfile] = useState<DeviceProfile>(() => getLocalDeviceProfile());
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const isScanning = isAutoDiscovering;
  const announceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Announce local device to discovery endpoint
  const announcePresence = useCallback(async () => {
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "announce",
          deviceId: profile.id,
          name: profile.name,
          formFactor: profile.formFactor,
          peerId: `qs-lan-${profile.id}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNetworkId(data.networkId);
          setPeers(data.peers || []);
        }
      }
    } catch {
      // Ignore network hiccups during background discovery
    }
  }, [profile]);

  // Leave network when unmounting
  const leaveNetwork = useCallback(async () => {
    try {
      await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          deviceId: profile.id,
        }),
      });
    } catch {
      // Ignore leave errors
    }
  }, [profile.id]);

  useEffect(() => {
    if (!isAutoDiscovering) {
      if (announceTimerRef.current) {
        clearInterval(announceTimerRef.current);
        announceTimerRef.current = null;
      }
      return;
    }

    // Announce initially
    const initialTimer = setTimeout(() => {
      announcePresence();
    }, 0);

    // Heartbeat every 3 seconds
    announceTimerRef.current = setInterval(() => {
      announcePresence();
    }, 3000);

    return () => {
      clearTimeout(initialTimer);
      if (announceTimerRef.current) {
        clearInterval(announceTimerRef.current);
        announceTimerRef.current = null;
      }
      leaveNetwork();
    };
  }, [isAutoDiscovering, announcePresence, leaveNetwork]);

  const updateName = (newName: string) => {
    updateLocalDeviceName(newName);
    setProfile(getLocalDeviceProfile());
  };

  return {
    profile,
    peers,
    networkId,
    isScanning,
    updateName,
    refreshPeers: announcePresence,
  };
}
