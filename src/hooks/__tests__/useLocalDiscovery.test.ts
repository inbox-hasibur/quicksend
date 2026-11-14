import { describe, it, expect, beforeEach } from "vitest";
import { getLocalDeviceProfile } from "@/lib/deviceIdentity";

describe("useLocalDiscovery logic", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it("should initialize with local device profile", () => {
    const profile = getLocalDeviceProfile();
    expect(profile.id).toBeDefined();
    expect(profile.name).toBeDefined();
    expect(profile.formFactor).toBeDefined();
  });
});
