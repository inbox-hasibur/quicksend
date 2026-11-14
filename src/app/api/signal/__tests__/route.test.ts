import { describe, it, expect, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/signal/route";
import { signalStore } from "@/lib/signalStore";

describe("Signaling API Route Handler", () => {
  beforeEach(async () => {
    await signalStore.clear?.();
  });

  it("should respond to GET status healthcheck with storage mode", async () => {
    const req = new Request("http://localhost:3000/api/signal");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.service).toBe("quicksend-signaling");
    expect(data.storage).toBe("memory");
    expect(typeof data.activeRooms).toBe("number");
  });

  it("should create room, join room, exchange signals, and clean up", async () => {
    // 1. Create Room
    const createReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-room" }),
    });
    const createRes = await POST(createReq);
    const createData = await createRes.json();

    expect(createRes.status).toBe(200);
    expect(createData.success).toBe(true);
    expect(createData.roomId).toBeDefined();
    expect(createData.code).toMatch(/^\d{6}$/);

    const { roomId, code } = createData;

    // 2. Query room by code via GET
    const getCodeReq = new Request(`http://localhost:3000/api/signal?code=${code}`);
    const getCodeRes = await GET(getCodeReq);
    const getCodeData = await getCodeRes.json();
    expect(getCodeData.success).toBe(true);
    expect(getCodeData.roomId).toBe(roomId);

    // 3. Query room by roomId via GET
    const getRoomIdReq = new Request(`http://localhost:3000/api/signal?roomId=${roomId}`);
    const getRoomIdRes = await GET(getRoomIdReq);
    const getRoomIdData = await getRoomIdRes.json();
    expect(getRoomIdData.success).toBe(true);
    expect(getRoomIdData.code).toBe(code);

    // 4. Join Room as receiver
    const joinReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join-room", code }),
    });
    const joinRes = await POST(joinReq);
    const joinData = await joinRes.json();

    expect(joinRes.status).toBe(200);
    expect(joinData.success).toBe(true);

    // 5. Poll signals for sender (should receive peer-joined)
    const pollSenderReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "poll-signals", roomId, role: "sender" }),
    });
    const pollSenderRes = await POST(pollSenderReq);
    const pollSenderData = await pollSenderRes.json();

    expect(pollSenderData.success).toBe(true);
    expect(pollSenderData.messages.some((m: { type: string }) => m.type === "peer-joined")).toBe(true);

    // 6. Send an offer from sender to receiver
    const sendOfferReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "send-signal",
        roomId,
        senderRole: "sender",
        targetRole: "receiver",
        type: "offer",
        payload: { sdp: "dummy-offer-sdp" },
      }),
    });
    const sendOfferRes = await POST(sendOfferReq);
    const sendOfferData = await sendOfferRes.json();
    expect(sendOfferData.success).toBe(true);

    // 7. Poll signals for receiver (should receive offer)
    const pollReceiverReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "poll-signals", roomId, role: "receiver" }),
    });
    const pollReceiverRes = await POST(pollReceiverReq);
    const pollReceiverData = await pollReceiverRes.json();

    expect(pollReceiverData.success).toBe(true);
    expect(pollReceiverData.messages.some((m: { type: string }) => m.type === "offer")).toBe(true);

    // 8. Leave room
    const leaveReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave-room", roomId }),
    });
    const leaveRes = await POST(leaveReq);
    expect(leaveRes.status).toBe(200);
  });

  it("should return clean 400 for invalid custom code length", async () => {
    const req = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-room", customCode: "ab" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("between 4 and 20 characters");
  });

  it("should return clean 409 when custom code collides with an active room", async () => {
    const req1 = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-room", customCode: "CONFLICT1" }),
    });
    const res1 = await POST(req1);
    expect(res1.status).toBe(200);

    const req2 = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-room", customCode: "CONFLICT1" }),
    });
    const res2 = await POST(req2);
    expect(res2.status).toBe(409);
    const data = await res2.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain("currently in use");
  });

  it("should return clean 404 for non-existent room query", async () => {
    const req = new Request("http://localhost:3000/api/signal?code=NONEXISTENT");
    const res = await GET(req);
    expect(res.status).toBe(404);
  });

  it("should return clean 400 for unknown action", async () => {
    const req = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "non-existent-action" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
