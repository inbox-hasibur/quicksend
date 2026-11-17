import { describe, it, expect, beforeEach } from "vitest";
import { clientIp, hitLimit } from "../rateLimit";
import { signalStore } from "@/lib/signalStore";

describe("rateLimit", () => {
  beforeEach(async () => {
    await signalStore.clear?.();
  });

  describe("clientIp", () => {
    it("extracts first IP from x-forwarded-for header", () => {
      const req = new Request("https://example.com", {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18" },
      });
      expect(clientIp(req)).toBe("203.0.113.195");
    });

    it("returns single IP cleanly", () => {
      const req = new Request("https://example.com", {
        headers: { "x-forwarded-for": "192.168.1.100" },
      });
      expect(clientIp(req)).toBe("192.168.1.100");
    });

    it("falls back to unknown if missing or empty", () => {
      const reqWithoutHeader = new Request("https://example.com");
      expect(clientIp(reqWithoutHeader)).toBe("unknown");

      const reqEmptyHeader = new Request("https://example.com", {
        headers: { "x-forwarded-for": "" },
      });
      expect(clientIp(reqEmptyHeader)).toBe("unknown");
    });
  });

  describe("hitLimit", () => {
    it("allows hits up to limit and returns true when exceeded", async () => {
      const key = "test:ratelimit:ip1";
      const limit = 3;
      const windowSeconds = 60;

      // Hit 1
      expect(await hitLimit(key, limit, windowSeconds)).toBe(false);
      // Hit 2
      expect(await hitLimit(key, limit, windowSeconds)).toBe(false);
      // Hit 3
      expect(await hitLimit(key, limit, windowSeconds)).toBe(false);

      // Hit 4 (exceeded)
      expect(await hitLimit(key, limit, windowSeconds)).toBe(true);
      // Hit 5 (still exceeded)
      expect(await hitLimit(key, limit, windowSeconds)).toBe(true);
    });

    it("tracks different keys independently", async () => {
      const keyA = "test:ratelimit:userA";
      const keyB = "test:ratelimit:userB";

      expect(await hitLimit(keyA, 1, 60)).toBe(false);
      expect(await hitLimit(keyA, 1, 60)).toBe(true);

      // keyB is fresh
      expect(await hitLimit(keyB, 1, 60)).toBe(false);
    });
  });
});
