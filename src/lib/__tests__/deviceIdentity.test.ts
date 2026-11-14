import { describe, it, expect, beforeEach } from "vitest";
import {
  getPlatformInfo,
  getLocalDeviceProfile,
  updateLocalDeviceName,
} from "@/lib/deviceIdentity";

describe("Device Identity Utility", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it("should accurately detect Windows and Chrome", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const info = getPlatformInfo(ua);
    expect(info.os).toBe("Windows");
    expect(info.browser).toBe("Chrome");
    expect(info.formFactor).toBe("laptop");
  });

  it("should accurately detect iPhone and Safari", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    const info = getPlatformInfo(ua);
    expect(info.os).toBe("iOS");
    expect(info.browser).toBe("Safari");
    expect(info.formFactor).toBe("mobile");
  });

  it("should generate and persist device profile", () => {
    const profile1 = getLocalDeviceProfile();
    expect(profile1.id).toBeDefined();
    expect(profile1.name).toBeDefined();
    expect(profile1.avatarColor).toBeDefined();

    // Calling again in same session should retain id
    const profile2 = getLocalDeviceProfile();
    expect(profile2.id).toBe(profile1.id);
  });

  it("should allow updating local device name", () => {
    updateLocalDeviceName("Hasibur's Office Laptop");
    const profile = getLocalDeviceProfile();
    expect(profile.name).toBe("Hasibur's Office Laptop");
  });
});
