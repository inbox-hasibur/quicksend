"use client";

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from "react";
import {
  getLocalDeviceProfile,
  getServerDeviceProfile,
  subscribeToDeviceProfile,
  updateLocalDeviceName,
  updateLocalAvatar,
  cycleLocalAvatar,
  type DeviceProfile,
} from "@/lib/deviceIdentity";

export interface NearbyPeer {
  id: string;
  name: string;
  codename?: string;
  avatarEmoji?: string;
  avatarColor?: string;
  os?: string;
  browser?: string;
  formFactor: "desktop" | "laptop" | "mobile" | "tablet";
  peerId: string;
  lastSeen: number;
}

export interface IncomingBeamEvent {
  fromPeer: Partial<NearbyPeer>;
  roomCode: string;
  timestamp: number;
}

export function useLocalDiscovery(isAutoDiscovering = true) {
  const profile: DeviceProfile = useSyncExternalStore(
    subscribeToDeviceProfile,
    getLocalDeviceProfile,
    getServerDeviceProfile
  );
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [incomingBeam, setIncomingBeam] = useState<IncomingBeamEvent | null>(null);
  const isScanning = isAutoDiscovering;
  const announceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Announce local device to discovery endpoint
  const announcePresence = useCallback(async () => {
    // Avoid announcing while running with server fallback mock
    if (typeof window === "undefined" || profile.id === "srv_mock") {
      return;
    }

    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "announce",
          deviceId: profile.id,
          name: profile.name,
          codename: profile.codename,
          avatarEmoji: profile.avatarEmoji,
          avatarColor: profile.avatarColor,
          os: profile.os,
          browser: profile.browser,
          formFactor: profile.formFactor,
          peerId: `qs-lan-${profile.id}`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setNetworkId(data.networkId);
          setPeers(data.peers || []);
          if (data.incomingBeam) {
            setIncomingBeam(data.incomingBeam);
          } else {
            setIncomingBeam(null);
          }
          // If server reassigned avatar to avoid conflict on this subnet, update local profile
          if (
            data.assignedAvatar &&
            (data.assignedAvatar.avatarEmoji !== profile.avatarEmoji ||
              data.assignedAvatar.codename !== profile.codename)
          ) {
            updateLocalAvatar({
              emoji: data.assignedAvatar.avatarEmoji,
              codename: data.assignedAvatar.codename,
              color: data.assignedAvatar.avatarColor,
            });
          }
        }
      }
    } catch {
      // Ignore network hiccups during background discovery
    }
  }, [profile]);

  // Direct beam signaling from sender to receiver on same network
  const beamToPeer = useCallback(
    async (targetDeviceId: string, roomCode: string) => {
      try {
        await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "beam",
            targetDeviceId,
            roomCode,
            fromPeer: {
              id: profile.id,
              name: profile.name,
              codename: profile.codename,
              avatarEmoji: profile.avatarEmoji,
              avatarColor: profile.avatarColor,
              os: profile.os,
              browser: profile.browser,
              formFactor: profile.formFactor,
            },
          }),
        });
      } catch {
        // Ignore beam signaling hiccup
      }
    },
    [profile]
  );

  const clearIncomingBeam = useCallback(async () => {
    setIncomingBeam(null);
    try {
      await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clearBeam",
          deviceId: profile.id,
        }),
      });
    } catch {
      // Ignore
    }
  }, [profile.id]);

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
  };

  const cycleAvatar = useCallback(() => {
    cycleLocalAvatar();
  }, []);

  return {
    profile,
    peers,
    networkId,
    incomingBeam,
    beamToPeer,
    clearIncomingBeam,
    isScanning,
    updateName,
    cycleAvatar,
    refreshPeers: announcePresence,
  };
}
