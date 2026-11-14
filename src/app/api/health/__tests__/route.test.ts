import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/health/route";

describe("Health API Route Handler", () => {
  it("should respond with ok status, app identifier, storage mode, and timestamp", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.app).toBe("quicksend");
    expect(["memory", "redis"]).toContain(data.storage);
    expect(typeof data.timestamp).toBe("number");
    expect(data.timestamp).toBeLessThanOrEqual(Date.now());
  });
});
