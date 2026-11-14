/**
 * Client Device Identity Utility.
 * Detects device platform, browser, form-factor, and manages customizable device name.
 */

export type DeviceFormFactor = "desktop" | "laptop" | "mobile" | "tablet";

export interface DeviceProfile {
  id: string;
  name: string;
  formFactor: DeviceFormFactor;
  os: string;
  browser: string;
  avatarColor: string;
}

const AVATAR_COLORS = [
  "#6366F1", // Indigo
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#8B5CF6", // Purple
  "#06B6D4", // Cyan
];

export function getPlatformInfo(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): {
  os: string;
  browser: string;
  formFactor: DeviceFormFactor;
} {
  const uaLower = ua.toLowerCase();

  // Detect OS (check mobile devices before desktop mac)
  let os = "Device";
  if (uaLower.includes("iphone") || uaLower.includes("ipad") || uaLower.includes("ipod")) os = "iOS";
  else if (uaLower.includes("android")) os = "Android";
  else if (uaLower.includes("win")) os = "Windows";
  else if (uaLower.includes("mac")) os = "macOS";
  else if (uaLower.includes("linux")) os = "Linux";

  // Detect Browser
  let browser = "Browser";
  if (uaLower.includes("edg/")) browser = "Edge";
  else if (uaLower.includes("chrome") && !uaLower.includes("edg/")) browser = "Chrome";
  else if (uaLower.includes("safari") && !uaLower.includes("chrome")) browser = "Safari";
  else if (uaLower.includes("firefox")) browser = "Firefox";

  // Detect Form Factor
  let formFactor: DeviceFormFactor = "desktop";
  if (/ipad|tablet|(android(?!.*mobile))/i.test(uaLower)) {
    formFactor = "tablet";
  } else if (/mobile|iphone|ipod|android/i.test(uaLower)) {
    formFactor = "mobile";
  } else if (os === "macOS" || os === "Windows" || os === "Linux") {
    // If screen is smaller than 1400 and has battery API, likely laptop
    formFactor = "laptop";
  }

  return { os, browser, formFactor };
}

export function getLocalDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") {
    return {
      id: "srv_mock",
      name: "QuickSend Device",
      formFactor: "desktop",
      os: "Server",
      browser: "Node",
      avatarColor: AVATAR_COLORS[0],
    };
  }

  const { os, browser, formFactor } = getPlatformInfo();

  let storedId = sessionStorage.getItem("quicksend_device_id");
  if (!storedId) {
    storedId = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    sessionStorage.setItem("quicksend_device_id", storedId);
  }

  const storedName = localStorage.getItem("quicksend_device_name");
  const deviceName =
    storedName ||
    `${os} ${formFactor === "mobile" ? "Phone" : formFactor === "tablet" ? "Tablet" : "PC"} (${browser})`;

  // Pick deterministic avatar color based on id
  let hash = 0;
  for (let i = 0; i < storedId.length; i++) {
    hash = (hash << 5) - hash + storedId.charCodeAt(i);
  }
  const colorIndex = Math.abs(hash) % AVATAR_COLORS.length;

  return {
    id: storedId,
    name: deviceName,
    formFactor,
    os,
    browser,
    avatarColor: AVATAR_COLORS[colorIndex],
  };
}

export function updateLocalDeviceName(newName: string): void {
  if (typeof window !== "undefined" && newName.trim()) {
    localStorage.setItem("quicksend_device_name", newName.trim());
  }
}
