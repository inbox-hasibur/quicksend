import { describe, it, expect } from "vitest";
import { GET, POST } from "../route";

describe("Discovery API Route (/api/discover)", () => {
  it("should return networkId and empty peer list on initial GET", async () => {
    const req = new Request("http://localhost/api/discover", {
      headers: { "x-forwarded-for": "192.168.1.105" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.networkId).toMatch(/^lan_/);
    expect(Array.isArray(json.peers)).toBe(true);
  });

  it("should register peer announcement and return other active peers on the same network", async () => {
    const client1Req = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.4" },
      body: JSON.stringify({
        action: "announce",
        deviceId: "dev_mac_1",
        name: "MacBook Pro",
        formFactor: "laptop",
        peerId: "qs_dev_mac_1",
      }),
    });
    const res1 = await POST(client1Req);
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    expect(json1.success).toBe(true);

    // Client 2 announces on the same IP
    const client2Req = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.4" },
      body: JSON.stringify({
        action: "announce",
        deviceId: "dev_phone_2",
        name: "iPhone 15",
        formFactor: "mobile",
        peerId: "qs_dev_phone_2",
      }),
    });
    const res2 = await POST(client2Req);
    const json2 = await res2.json();
    expect(json2.success).toBe(true);
    // Client 2 should see Client 1 in the peers list!
    expect(json2.peers.some((p: { id: string }) => p.id === "dev_mac_1")).toBe(true);
  });

  it("should handle leave action and prune peer", async () => {
    const leaveReq = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.4" },
      body: JSON.stringify({
        action: "leave",
        deviceId: "dev_mac_1",
      }),
    });
    const res = await POST(leaveReq);
    expect(res.status).toBe(200);

    // Verify it's gone
    const checkReq = new Request("http://localhost/api/discover", {
      headers: { "x-forwarded-for": "203.0.113.4" },
    });
    const checkRes = await GET(checkReq);
    const checkJson = await checkRes.json();
    expect(checkJson.peers.some((p: { id: string }) => p.id === "dev_mac_1")).toBe(false);
  });
});
