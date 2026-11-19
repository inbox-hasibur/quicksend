import { describe, it, expect } from "vitest";
import {
  GET,
  POST,
  getClientIp,
  computeNetworkId,
  normalizeIpv6Prefix,
  isLocalOrPrivateIp,
  getNetworkGroupInfo,
} from "../route";

describe("Discovery API Route (/api/discover)", () => {
  it("should extract client IP correctly prioritizing cf-connecting-ip then x-real-ip then x-forwarded-for", () => {
    // 1. cf-connecting-ip takes precedence
    const req1 = new Request("http://localhost/api/discover", {
      headers: {
        "cf-connecting-ip": "104.28.1.1",
        "x-real-ip": "192.168.1.1",
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      },
    });
    expect(getClientIp(req1)).toBe("104.28.1.1");

    // 2. x-real-ip when cf-connecting-ip is missing
    const req2 = new Request("http://localhost/api/discover", {
      headers: {
        "x-real-ip": "198.51.100.5",
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      },
    });
    expect(getClientIp(req2)).toBe("198.51.100.5");

    // 3. x-forwarded-for (first IP) when x-real-ip is missing
    const req3 = new Request("http://localhost/api/discover", {
      headers: {
        "x-forwarded-for": "203.0.113.88, 10.0.0.2",
      },
    });
    expect(getClientIp(req3)).toBe("203.0.113.88");

    // 4. Default fallback
    const req4 = new Request("http://localhost/api/discover");
    expect(getClientIp(req4)).toBe("127.0.0.1");
  });

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

  describe("nearby 4-digit pairing code grouping", () => {
    it("allows two clients with different IPs and the same code to see each other", async () => {
      // Client 1 on IPv4
      const client1Req = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.10" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_code_1",
          name: "Device 1",
          code: "5821",
        }),
      });
      const res1 = await POST(client1Req);
      const json1 = await res1.json();
      expect(json1.success).toBe(true);
      expect(json1.networkId).toBe("code:5821");
      expect(json1.groupLabel).toBe("code:5821");

      // Client 2 on completely different IPv6
      const client2Req = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "2001:db8:ffff:1234::5678",
        },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_code_2",
          name: "Device 2",
          code: "5821",
        }),
      });
      const res2 = await POST(client2Req);
      const json2 = await res2.json();
      expect(json2.success).toBe(true);
      expect(json2.networkId).toBe("code:5821");
      expect(json2.peers.some((p: { id: string }) => p.id === "dev_code_1")).toBe(true);
    });

    it("ensures clients with different codes do not see each other", async () => {
      const clientAReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.20" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_diff_a",
          name: "Device A",
          code: "1111",
        }),
      });
      await POST(clientAReq);

      const clientBReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.20" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_diff_b",
          name: "Device B",
          code: "2222",
        }),
      });
      const resB = await POST(clientBReq);
      const jsonB = await resB.json();
      expect(jsonB.success).toBe(true);
      expect(jsonB.networkId).toBe("code:2222");
      expect(jsonB.peers.some((p: { id: string }) => p.id === "dev_diff_a")).toBe(false);
    });

    it("keeps standard IP grouping when no code is provided", async () => {
      const req = new Request("http://localhost/api/discover", {
        headers: { "x-forwarded-for": "192.168.1.55" },
      });
      const res = await GET(req);
      const json = await res.json();
      expect(json.networkId).toBe("local-lan");
    });

    it("treats invalid codes as no code (keeps IP grouping)", async () => {
      // 3 digits
      const reqShort = new Request("http://localhost/api/discover?code=123", {
        headers: { "x-forwarded-for": "192.168.1.55" },
      });
      const resShort = await GET(reqShort);
      const jsonShort = await resShort.json();
      expect(jsonShort.networkId).toBe("local-lan");

      // letters
      const postReqLetters = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.55" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_invalid_code",
          name: "Invalid Code Dev",
          code: "abcd",
        }),
      });
      const postRes = await POST(postReqLetters);
      const postJson = await postRes.json();
      expect(postJson.networkId).toBe("local-lan");
    });
  });

  describe("4-Digit PIN Allocation, Pair Lookup, and Cross-Group Beaming", () => {
    it("allocates a unique 4-digit PIN per device across 200 registrations", async () => {
      const pins = new Set<string>();
      for (let i = 0; i < 200; i++) {
        const req = new Request("http://localhost/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.1" },
          body: JSON.stringify({
            action: "announce",
            deviceId: `dev_pin_alloc_${i}`,
            name: `Device ${i}`,
          }),
        });
        const res = await POST(req);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(typeof data.pin).toBe("string");
        expect(data.pin).toMatch(/^\d{4}$/);
        pins.add(data.pin);
      }
      expect(pins.size).toBe(200);
    });

    it("retains the same PIN on heartbeat", async () => {
      const devId = "dev_hb_pin_test";
      const req1 = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.2" },
        body: JSON.stringify({
          action: "announce",
          deviceId: devId,
          name: "Heartbeat Device",
        }),
      });
      const res1 = await POST(req1);
      const data1 = await res1.json();
      const originalPin = data1.pin;
      expect(originalPin).toBeTruthy();

      // Heartbeat announce
      const req2 = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.2" },
        body: JSON.stringify({
          action: "announce",
          deviceId: devId,
          name: "Heartbeat Device",
        }),
      });
      const res2 = await POST(req2);
      const data2 = await res2.json();
      expect(data2.pin).toBe(originalPin);
    });

    it("expires PIN with presence after TTL", async () => {
      const devId = "dev_ttl_pin_test";
      const req = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.3" },
        body: JSON.stringify({
          action: "announce",
          deviceId: devId,
          name: "Expiring Device",
        }),
      });
      const res = await POST(req);
      const data = await res.json();
      const pin = data.pin;
      expect(pin).toBeTruthy();

      // Check lookup is found now
      const lookupReq1 = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.4" },
        body: JSON.stringify({
          action: "pairLookup",
          pin,
        }),
      });
      const lookupRes1 = await POST(lookupReq1);
      const lookupData1 = await lookupRes1.json();
      expect(lookupData1.found).toBe(true);

      // Advance time past presence TTL (45s)
      const origNow = Date.now;
      Date.now = () => origNow() + 46000;
      try {
        const lookupReq2 = new Request("http://localhost/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "192.168.1.4" },
          body: JSON.stringify({
            action: "pairLookup",
            pin,
          }),
        });
        const lookupRes2 = await POST(lookupReq2);
        const lookupData2 = await lookupRes2.json();
        expect(lookupData2.found).toBe(false);
      } finally {
        Date.now = origNow;
      }
    });

    it("handles pairLookup found, not found, and invalid format without exposing IP", async () => {
      // Register target device
      const targetReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.5" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_lookup_target",
          name: "Alice Phone",
          os: "iOS",
        }),
      });
      const targetRes = await POST(targetReq);
      const targetData = await targetRes.json();
      const pin = targetData.pin;

      // Valid found
      const foundReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.50" },
        body: JSON.stringify({
          action: "pairLookup",
          pin,
        }),
      });
      const foundRes = await POST(foundReq);
      expect(foundRes.status).toBe(200);
      const foundData = await foundRes.json();
      expect(foundData.found).toBe(true);
      expect(foundData.peerId).toBe("dev_lookup_target");
      expect(foundData.name).toBe("Alice Phone");
      expect(foundData.os).toBe("iOS");
      expect(foundData.avatar).toBeDefined();
      // Verify no IP or network group is leaked
      expect(foundData.ip).toBeUndefined();
      expect(foundData.networkId).toBeUndefined();
      expect(foundData.groupLabel).toBeUndefined();

      // Not found
      const notFoundReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.50" },
        body: JSON.stringify({
          action: "pairLookup",
          pin: "0000",
        }),
      });
      const notFoundRes = await POST(notFoundReq);
      const notFoundData = await notFoundRes.json();
      expect(notFoundData.found).toBe(false);

      // Invalid format
      for (const invalidPin of ["12", "123", "12345", "abcd", ""]) {
        const invReq = new Request("http://localhost/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.50" },
          body: JSON.stringify({
            action: "pairLookup",
            pin: invalidPin,
          }),
        });
        const invRes = await POST(invReq);
        const invData = await invRes.json();
        expect(invData.found).toBe(false);
      }
    });

    it("enforces rate limit of 10 pairLookup calls per minute with HTTP 429", async () => {
      const testIp = "203.0.113.77";
      // 10 calls succeed
      for (let i = 0; i < 10; i++) {
        const req = new Request("http://localhost/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-forwarded-for": testIp },
          body: JSON.stringify({
            action: "pairLookup",
            pin: "1234",
          }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
      }

      // 11th call gets 429
      const blockedReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": testIp },
        body: JSON.stringify({
          action: "pairLookup",
          pin: "1234",
        }),
      });
      const blockedRes = await POST(blockedReq);
      expect(blockedRes.status).toBe(429);
      const blockedData = await blockedRes.json();
      expect(blockedData.error).toBe("Too many attempts");
    });

    it("allows beaming to a device in another group when target was found by pin", async () => {
      // Device A on Network 1
      const devAReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.1" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_cross_a",
          name: "Device A Network 1",
        }),
      });
      const devARes = await POST(devAReq);
      const devAData = await devARes.json();
      const pinA = devAData.pin;
      expect(pinA).toBeTruthy();

      // Device B on Network 2 looks up Device A via PIN
      const lookupReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.2" },
        body: JSON.stringify({
          action: "pairLookup",
          pin: pinA,
        }),
      });
      const lookupRes = await POST(lookupReq);
      const lookupData = await lookupRes.json();
      expect(lookupData.found).toBe(true);
      expect(lookupData.peerId).toBe("dev_cross_a");

      // Device B beams to Device A across groups
      const beamReq = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.2" },
        body: JSON.stringify({
          action: "beam",
          targetDeviceId: lookupData.peerId,
          fromPeer: { id: "dev_cross_b", name: "Device B Network 2" },
          roomCode: "CROSS-ROOM-777",
        }),
      });
      const beamRes = await POST(beamReq);
      expect(beamRes.status).toBe(200);

      // Device A announces again and receives the incoming beam
      const devAReq2 = new Request("http://localhost/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.1" },
        body: JSON.stringify({
          action: "announce",
          deviceId: "dev_cross_a",
          name: "Device A Network 1",
        }),
      });
      const devARes2 = await POST(devAReq2);
      const devAData2 = await devARes2.json();
      expect(devAData2.incomingBeam).toBeDefined();
      expect(devAData2.incomingBeam.roomCode).toBe("CROSS-ROOM-777");
      expect(devAData2.incomingBeam.fromPeer.id).toBe("dev_cross_b");
    });
  });
});
