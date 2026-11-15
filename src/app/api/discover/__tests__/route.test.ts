import { describe, it, expect } from "vitest";
import {
  GET,
  POST,
  computeNetworkId,
  normalizeIpv6Prefix,
  isLocalOrPrivateIp,
  getNetworkGroupInfo,
} from "../route";

describe("Discovery API Route (/api/discover)", () => {
  it("should return local-lan networkId for private LAN and loopback IPs", async () => {
    const req = new Request("http://localhost/api/discover", {
      headers: { "x-forwarded-for": "192.168.1.105" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.networkId).toBe("local-lan");
    expect(Array.isArray(json.peers)).toBe(true);
  });

  it("should classify loopback and private subnets under local-lan", () => {
    expect(isLocalOrPrivateIp("127.0.0.1")).toBe(true);
    expect(isLocalOrPrivateIp("::1")).toBe(true);
    expect(isLocalOrPrivateIp("192.168.0.1")).toBe(true);
    expect(isLocalOrPrivateIp("10.0.0.5")).toBe(true);
    expect(isLocalOrPrivateIp("172.16.5.10")).toBe(true);
    expect(isLocalOrPrivateIp("172.31.255.1")).toBe(true);
    expect(isLocalOrPrivateIp("fe80::1")).toBe(true);
    expect(isLocalOrPrivateIp("203.0.113.4")).toBe(false);

    expect(computeNetworkId("127.0.0.1")).toBe("local-lan");
    expect(computeNetworkId("::1")).toBe("local-lan");
    expect(computeNetworkId("192.168.1.5")).toBe("local-lan");
    expect(computeNetworkId("10.1.2.3")).toBe("local-lan");
    expect(computeNetworkId("172.20.0.1")).toBe("local-lan");
  });

  it("should normalize IPv6 /64 prefix so SLAAC devices group together", () => {
    const ip1 = "2001:db8:85a3:0042:1000:8a2e:0370:7334";
    const ip2 = "2001:db8:85a3:0042:2000:8a2e:0370:9999";
    const prefix1 = normalizeIpv6Prefix(ip1);
    const prefix2 = normalizeIpv6Prefix(ip2);

    expect(prefix1).toBe(prefix2);
    expect(computeNetworkId(ip1)).toBe(computeNetworkId(ip2));
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

  it("should handle direct beam signaling between local peers and clear notice", async () => {
    // 1. Send beam from client 1 to client 2
    const beamReq = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.4" },
      body: JSON.stringify({
        action: "beam",
        targetDeviceId: "dev_phone_2",
        roomCode: "lan123456",
        fromPeer: {
          id: "dev_mac_1",
          name: "Curious Fox",
          codename: "Curious Fox",
          avatarEmoji: "🦊",
          avatarColor: "#F97316",
        },
      }),
    });
    const beamRes = await POST(beamReq);
    expect(beamRes.status).toBe(200);

    // 2. Client 2 announces and should receive the incomingBeam notice
    const announceReq = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.4" },
      body: JSON.stringify({
        action: "announce",
        deviceId: "dev_phone_2",
        name: "Swift Dolphin",
        codename: "Swift Dolphin",
      }),
    });
    const announceRes = await POST(announceReq);
    const announceJson = await announceRes.json();
    expect(announceJson.success).toBe(true);
    expect(announceJson.incomingBeam).toBeDefined();
    expect(announceJson.incomingBeam.roomCode).toBe("lan123456");
    expect(announceJson.incomingBeam.fromPeer.avatarEmoji).toBe("🦊");

    // 3. Clear beam
    const clearReq = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "clearBeam",
        deviceId: "dev_phone_2",
      }),
    });
    const clearRes = await POST(clearReq);
    expect(clearRes.status).toBe(200);
  });

  it("should reassign colliding avatars so devices on the same network have distinct icons", async () => {
    // Client A joins with Curious Fox 🦊
    const clientAReq = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.1" },
      body: JSON.stringify({
        action: "announce",
        deviceId: "dev_a",
        name: "Device A",
        codename: "Curious Fox",
        avatarEmoji: "🦊",
        avatarColor: "#F97316",
      }),
    });
    const resA = await POST(clientAReq);
    const jsonA = await resA.json();
    expect(jsonA.success).toBe(true);
    expect(jsonA.assignedAvatar.avatarEmoji).toBe("🦊");

    // Client B joins with the same Curious Fox 🦊 on the same IP
    const clientBReq = new Request("http://localhost/api/discover", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.1" },
      body: JSON.stringify({
        action: "announce",
        deviceId: "dev_b",
        name: "Device B",
        codename: "Curious Fox",
        avatarEmoji: "🦊",
        avatarColor: "#F97316",
      }),
    });
    const resB = await POST(clientBReq);
    const jsonB = await resB.json();
    expect(jsonB.success).toBe(true);
    // Client B must be assigned a different avatar, not 🦊!
    expect(jsonB.assignedAvatar.avatarEmoji).not.toBe("🦊");
    expect(jsonB.peers.some((p: { avatarEmoji: string }) => p.avatarEmoji === "🦊")).toBe(true);
  });

  describe("groupLabel masking and ipFamily detection", () => {
    it("should mask IPv4 by keeping first two octets and replacing rest with x", () => {
      const info1 = getNetworkGroupInfo("203.0.113.4");
      expect(info1.groupLabel).toBe("203.0.x.x");
      expect(info1.ipFamily).toBe("v4");

      const info2 = getNetworkGroupInfo("198.51.100.25");
      expect(info2.groupLabel).toBe("198.51.x.x");
      expect(info2.ipFamily).toBe("v4");

      const info3 = getNetworkGroupInfo("::ffff:203.0.113.4");
      expect(info3.groupLabel).toBe("203.0.x.x");
      expect(info3.ipFamily).toBe("v4");
    });

    it("should mask IPv6 by keeping first two hextets and appending ...", () => {
      const info1 = getNetworkGroupInfo("2001:db8:85a3:0042:1000:8a2e:0370:7334");
      expect(info1.groupLabel).toBe("2001:db8...");
      expect(info1.ipFamily).toBe("v6");

      const info2 = getNetworkGroupInfo("2400:cb00:2048:1::c629:d7a2");
      expect(info2.groupLabel).toBe("2400:cb00...");
      expect(info2.ipFamily).toBe("v6");
    });

    it("should return local-lan and family local for loopback and private subnets", () => {
      expect(getNetworkGroupInfo("127.0.0.1")).toEqual({
        groupLabel: "local-lan",
        ipFamily: "local",
      });
      expect(getNetworkGroupInfo("::1")).toEqual({
        groupLabel: "local-lan",
        ipFamily: "local",
      });
      expect(getNetworkGroupInfo("192.168.1.5")).toEqual({
        groupLabel: "local-lan",
        ipFamily: "local",
      });
      expect(getNetworkGroupInfo("10.0.1.20")).toEqual({
        groupLabel: "local-lan",
        ipFamily: "local",
      });
      expect(getNetworkGroupInfo("172.16.0.1")).toEqual({
        groupLabel: "local-lan",
        ipFamily: "local",
      });
    });

    it("should include groupLabel and ipFamily in GET and POST responses", async () => {
      const getReq = new Request("http://localhost/api/discover", {
        headers: { "x-forwarded-for": "203.0.113.4" },
      });
      const getRes = await GET(getReq);
      const getJson = await getRes.json();
      expect(getJson.groupLabel).toBe("203.0.x.x");
      expect(getJson.ipFamily).toBe("v4");

      const postReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.4" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_mask_test",
          name: "Mask Tester",
        }),
      });
      const postRes = await POST(postReq);
      const postJson = await postRes.json();
      expect(postJson.groupLabel).toBe("203.0.x.x");
      expect(postJson.ipFamily).toBe("v4");
    });
  });
});
