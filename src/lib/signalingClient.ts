import type { PeerRole, SignalMessage, SignalPayloadType } from "@/types/signaling";

export class SignalingClient {
  private roomId: string | null = null;
  private role: PeerRole | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastTimestamp = 0;
  private isPolling = false;

  async createRoom(): Promise<{ roomId: string; code: string }> {
    const res = await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-room" }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to create room");
    }

    this.roomId = data.roomId;
    this.role = "sender";
    return { roomId: data.roomId, code: data.code };
  }

  async joinRoom(code: string): Promise<{ roomId: string; code: string }> {
    const res = await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join-room", code }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to join room");
    }

    this.roomId = data.roomId;
    this.role = "receiver";
    return { roomId: data.roomId, code: data.code };
  }

  async sendSignal(
    type: SignalPayloadType,
    payload?: unknown,
    targetRole?: PeerRole
  ): Promise<void> {
    if (!this.roomId || !this.role) {
      throw new Error("Cannot send signal without an active room and role");
    }

    const defaultTarget: PeerRole = this.role === "sender" ? "receiver" : "sender";
    const res = await fetch("/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send-signal",
        roomId: this.roomId,
        senderRole: this.role,
        targetRole: targetRole || defaultTarget,
        type,
        payload,
      }),
    });

    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || "Failed to deliver signal");
    }
  }

  startPolling(onMessage: (message: SignalMessage) => void, intervalMs = 600): void {
    if (this.isPolling) return;
    this.isPolling = true;

    this.pollInterval = setInterval(async () => {
      if (!this.roomId || !this.role || !this.isPolling) return;

      try {
        const res = await fetch("/api/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "poll-signals",
            roomId: this.roomId,
            role: this.role,
            afterTimestamp: this.lastTimestamp,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
              if (msg.timestamp > this.lastTimestamp) {
                this.lastTimestamp = msg.timestamp;
              }
              onMessage(msg);
            }
          }
        }
      } catch {
        // Silently tolerate intermittent network hiccups during polling
      }
    }, intervalMs);
  }

  stopPolling(): void {
    this.isPolling = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async leaveRoom(): Promise<void> {
    this.stopPolling();
    if (this.roomId) {
      try {
        await fetch("/api/signal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "leave-room", roomId: this.roomId }),
        });
      } catch {
        // Ignore leave errors
      }
      this.roomId = null;
      this.role = null;
    }
  }
}
