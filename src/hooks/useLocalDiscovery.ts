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

export interface DiscoveryStatus {
  lastPollOk: boolean;
  lastPollAt: number | null;
  lastError: string | null;
  peerCount: number;
  groupLabel: string | null;
  ipFamily: string | null;
}

export function useLocalDiscovery(isAutoDiscovering = true, code?: string) {
  const normalizedCode = code?.trim() || "";
  const validCode = /^\d{4}$/.test(normalizedCode) ? normalizedCode : undefined;

  const profile: DeviceProfile = useSyncExternalStore(
    subscribeToDeviceProfile,
    getLocalDeviceProfile,
    getServerDeviceProfile
  );
  const [peers, setPeers] = useState<NearbyPeer[]>([]);
  const [networkId, setNetworkId] = useState<string | null>(null);
  const [incomingBeam, setIncomingBeam] = useState<IncomingBeamEvent | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [status, setStatus] = useState<DiscoveryStatus>({
    lastPollOk: false,
    lastPollAt: null,
    lastError: null,
    peerCount: 0,
    groupLabel: null,
    ipFamily: null,
  });
  const isScanning = isAutoDiscovering;
  const announceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeCodeRef = useRef<string | undefined>(validCode);
  const profileRef = useRef<DeviceProfile>(profile);
  const currentNetworkIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    activeCodeRef.current = validCode;
    setPeers([]);
  }, [validCode]);

  // Announce local device to discovery endpoint
  const announcePresence = useCallback(async () => {
    // Avoid announcing while running with server fallback mock
    if (typeof window === "undefined") {
      return;
    }
    const currentProfile = profileRef.current;
    if (!currentProfile || currentProfile.id === "srv_mock") {
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const codeToSend = activeCodeRef.current;
      const announcePayload: Record<string, unknown> = {
        action: "announce",
        deviceId: currentProfile.id,
        name: currentProfile.name,
        codename: currentProfile.codename,
        avatarEmoji: currentProfile.avatarEmoji,
        avatarColor: currentProfile.avatarColor,
        os: currentProfile.os,
        browser: currentProfile.browser,
        formFactor: currentProfile.formFactor,
        peerId: `qs-lan-${currentProfile.id}`,
      };
      if (codeToSend) {
        announcePayload.code = codeToSend;
      }

      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(announcePayload),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          currentNetworkIdRef.current = data.networkId || null;
          setNetworkId(data.networkId);
          const activePeers = data.peers || [];
          setPeers(activePeers);
          setStatus({
            lastPollOk: true,
            lastPollAt: Date.now(),
            lastError: null,
            peerCount: activePeers.length,
            groupLabel: data.groupLabel || null,
            ipFamily: data.ipFamily || null,
          });
          if (data.incomingBeam) {
            setIncomingBeam(data.incomingBeam);
          } else {
            setIncomingBeam(null);
          }
          if (data.pin !== undefined) {
            setPin(data.pin);
          }
          // If server reassigned avatar to avoid conflict on this subnet, update local profile
          if (
            data.assignedAvatar &&
            (data.assignedAvatar.avatarEmoji !== currentProfile.avatarEmoji ||
              data.assignedAvatar.codename !== currentProfile.codename)
          ) {
            updateLocalAvatar({
              emoji: data.assignedAvatar.avatarEmoji,
              codename: data.assignedAvatar.codename,
              color: data.assignedAvatar.avatarColor,
            });
          }
        } else {
          setStatus((prev) => ({
            ...prev,
            lastPollOk: false,
            lastPollAt: Date.now(),
            lastError: data.error || "Announcement failed",
          }));
        }
      } else {
        setStatus((prev) => ({
          ...prev,
          lastPollOk: false,
          lastPollAt: Date.now(),
          lastError: `HTTP ${res.status}`,
        }));
      }
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        lastPollOk: false,
        lastPollAt: Date.now(),
        lastError: err instanceof Error ? err.message : "Network error",
      }));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Direct beam signaling from sender to receiver on same network or across networks
  const beamToPeer = useCallback(
    async (target: string | { id: string }, roomCode: string) => {
      const targetDeviceId = typeof target === "string" ? target : target.id;
      const currentProfile = profileRef.current;
      try {
        const beamPayload: Record<string, unknown> = {
          action: "beam",
          targetDeviceId,
          roomCode,
          fromPeer: {
            id: currentProfile.id,
            name: currentProfile.name,
            codename: currentProfile.codename,
            avatarEmoji: currentProfile.avatarEmoji,
            avatarColor: currentProfile.avatarColor,
            os: currentProfile.os,
            browser: currentProfile.browser,
            formFactor: currentProfile.formFactor,
          },
        };
        if (activeCodeRef.current) {
          beamPayload.code = activeCodeRef.current;
        }

        await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(beamPayload),
        });
      } catch {
        // Ignore beam signaling hiccup
      }
    },
    []
  );

  const lookupPin = useCallback(async (searchPin: string): Promise<NearbyPeer | null> => {
    const cleanPin = searchPin.trim();
    const res = await fetch("/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "pairLookup",
        pin: cleanPin,
      }),
    });
    if (res.status === 429) {
      throw new Error("Too many attempts");
    }
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    if (data.found && data.peerId) {
      return {
        id: data.peerId,
        name: data.name || "Nearby Peer",
        avatarEmoji: data.avatar || "🦊",
        os: data.os || "Device",
        peerId: data.peerId,
        formFactor: "mobile",
        lastSeen: Date.now(),
      };
    }
    return null;
  }, []);

  const clearIncomingBeam = useCallback(async () => {
    setIncomingBeam(null);
    const currentProfile = profileRef.current;
    if (!currentProfile || currentProfile.id === "srv_mock") return;
    try {
      await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clearBeam",
          deviceId: currentProfile.id,
        }),
      });
    } catch {
      // Ignore
    }
  }, []);

  // Leave network when unmounting or changing code
  const leaveNetwork = useCallback(async () => {
    const currentProfile = profileRef.current;
    if (!currentProfile || currentProfile.id === "srv_mock") return;
    try {
      const leavePayload: Record<string, unknown> = {
        action: "leave",
        deviceId: currentProfile.id,
      };
      if (currentNetworkIdRef.current) {
        leavePayload.networkId = currentNetworkIdRef.current;
      } else if (activeCodeRef.current) {
        leavePayload.code = activeCodeRef.current;
      }

      await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leavePayload),
      });
    } catch {
      // Ignore leave errors
    } finally {
      currentNetworkIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!isAutoDiscovering) {
      if (announceTimerRef.current) {
        clearInterval(announceTimerRef.current);
        announceTimerRef.current = null;
      }
      return;
    }

    // Announce initially
    announcePresence();

    // Heartbeat every 3 seconds
    announceTimerRef.current = setInterval(() => {
      announcePresence();
    }, 3000);

    return () => {
      if (announceTimerRef.current) {
        clearInterval(announceTimerRef.current);
        announceTimerRef.current = null;
      }
      leaveNetwork();
    };
  }, [isAutoDiscovering, validCode, announcePresence, leaveNetwork]);

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
    status,
    pin,
    lookupPin,
  };
}
