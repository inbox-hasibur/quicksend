import { describe, it, expect } from "vitest";
import { GET, POST } from "@/app/api/signal/route";

describe("Signaling API Route Handler", () => {
  it("should respond to GET status healthcheck", async () => {
    const req = new Request("http://localhost:3000/api/signal");
    const res = await GET(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
    expect(data.service).toBe("share-anything-signaling");
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

    // 3. Join Room as receiver
    const joinReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join-room", code }),
    });
    const joinRes = await POST(joinReq);
    const joinData = await joinRes.json();

    expect(joinRes.status).toBe(200);
    expect(joinData.success).toBe(true);

    // 4. Poll signals for sender (should receive peer-joined)
    const pollSenderReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "poll-signals", roomId, role: "sender" }),
    });
    const pollSenderRes = await POST(pollSenderReq);
    const pollSenderData = await pollSenderRes.json();

    expect(pollSenderData.success).toBe(true);
    expect(pollSenderData.messages.some((m: { type: string }) => m.type === "peer-joined")).toBe(true);

    // 5. Send an offer from sender to receiver
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

    // 6. Poll signals for receiver (should receive offer)
    const pollReceiverReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "poll-signals", roomId, role: "receiver" }),
    });
    const pollReceiverRes = await POST(pollReceiverReq);
    const pollReceiverData = await pollReceiverRes.json();

    expect(pollReceiverData.success).toBe(true);
    expect(pollReceiverData.messages.some((m: { type: string }) => m.type === "offer")).toBe(true);

    // 7. Leave room
    const leaveReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "leave-room", roomId }),
    });
    const leaveRes = await POST(leaveReq);
    expect(leaveRes.status).toBe(200);
  });

  it("should create room with custom keyword or mobile number", async () => {
    const customCode = "HR998877";
    const createReq = new Request("http://localhost:3000/api/signal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create-room", customCode }),
    });
    const createRes = await POST(createReq);
    const createData = await createRes.json();

    expect(createRes.status).toBe(200);
    expect(createData.success).toBe(true);
    expect(createData.code).toBe(customCode);

    // Verify lookup by custom keyword
    const getReq = new Request(`http://localhost:3000/api/signal?code=${customCode}`);
    const getRes = await GET(getReq);
    const getData = await getRes.json();
    expect(getData.success).toBe(true);
    expect(getData.roomId).toBe(createData.roomId);

    // Clean up
    await POST(
      new Request("http://localhost:3000/api/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave-room", roomId: createData.roomId }),
      })
    );
  });
});
