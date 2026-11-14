import { describe, it, expect } from "vitest";
import { buildWifiQrString, parseWifiQrString, ANDROID_INTENTS } from "@/lib/wifiQr";

describe("wifiQr string builder and parser", () => {
  it("should build standard WPA Wi-Fi pairing string", () => {
    const qr = buildWifiQrString({
      ssid: "Lab-Workstation-AP",
      password: "secretPassword123",
      encryption: "WPA",
    });
    expect(qr).toBe("WIFI:T:WPA;S:Lab-Workstation-AP;P:secretPassword123;;");
  });

  it("should build open network Wi-Fi string without password", () => {
    const qr = buildWifiQrString({
      ssid: "Public-Library-Wifi",
      password: "",
    });
    expect(qr).toBe("WIFI:T:nopass;S:Public-Library-Wifi;;");
  });

  it("should escape special characters in SSID and password", () => {
    const qr = buildWifiQrString({
      ssid: "My;Network:Special",
      password: "pass;word\\test",
    });
    expect(qr).toContain("S:My\\;Network\\:Special;");
    expect(qr).toContain("P:pass\\;word\\\\test;");
  });

  it("should parse standard WIFI QR string back into credentials", () => {
    const qr = "WIFI:T:WPA;S:CampusNet;P:myPass123;;";
    const parsed = parseWifiQrString(qr);
    expect(parsed).not.toBeNull();
    expect(parsed?.ssid).toBe("CampusNet");
    expect(parsed?.password).toBe("myPass123");
    expect(parsed?.encryption).toBe("WPA");
    expect(parsed?.hidden).toBe(false);
  });

  it("should return null for non-Wi-Fi strings", () => {
    expect(parseWifiQrString("https://shareit.vercel.app")).toBeNull();
    expect(parseWifiQrString("")).toBeNull();
  });

  it("should export Android settings intent constants", () => {
    expect(ANDROID_INTENTS.WIFI_SETTINGS).toContain("android.settings.WIFI_SETTINGS");
    expect(ANDROID_INTENTS.TETHER_SETTINGS).toContain("android.settings.TETHER_SETTINGS");
  });
});
