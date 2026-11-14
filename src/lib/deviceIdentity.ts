/**
 * Client Device Identity Utility.
 * Detects device platform, browser, form-factor, and assigns memorable distinct avatars & codenames.
 */

export type DeviceFormFactor = "desktop" | "laptop" | "mobile" | "tablet";

export interface AvatarPreset {
  emoji: string;
  codename: string;
  color: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { emoji: "🦊", codename: "Curious Fox", color: "#F97316" },
  { emoji: "🐬", codename: "Swift Dolphin", color: "#06B6D4" },
  { emoji: "🦁", codename: "Golden Lion", color: "#F59E0B" },
  { emoji: "🐼", codename: "Gentle Panda", color: "#10B981" },
  { emoji: "🦉", codename: "Wise Owl", color: "#6366F1" },
  { emoji: "🦄", codename: "Mystic Unicorn", color: "#8B5CF6" },
  { emoji: "🐨", codename: "Calm Koala", color: "#14B8A6" },
  { emoji: "🐯", codename: "Bold Tiger", color: "#F43F5E" },
  { emoji: "🦩", codename: "Radiant Flamingo", color: "#EC4899" },
  { emoji: "🦅", codename: "Brave Eagle", color: "#0EA5E9" },
  { emoji: "🐙", codename: "Clever Octopus", color: "#A855F7" },
  { emoji: "🐺", codename: "Lone Wolf", color: "#64748B" },
];

export interface DeviceProfile {
  id: string;
  name: string;
  codename: string;
  avatarEmoji: string;
  avatarColor: string;
  formFactor: DeviceFormFactor;
  os: string;
  browser: string;
}

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
  if (uaLower.includes("samsungbrowser")) browser = "Samsung Browser";
  else if (uaLower.includes("edg/")) browser = "Edge";
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
    formFactor = "laptop";
  }

  return { os, browser, formFactor };
}

export function getLocalDeviceProfile(): DeviceProfile {
  if (typeof window === "undefined") {
    return {
      id: "srv_mock",
      name: "QuickSend Device",
      codename: "Curious Fox",
      avatarEmoji: "🦊",
      avatarColor: AVATAR_PRESETS[0].color,
      formFactor: "desktop",
      os: "Server",
      browser: "Node",
    };
  }

  const { os, browser, formFactor } = getPlatformInfo();

  let storedId = sessionStorage.getItem("quicksend_device_id");
  if (!storedId) {
    storedId = `dev_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 7)}`;
    sessionStorage.setItem("quicksend_device_id", storedId);
  }

  // Pick deterministic avatar preset based on id
  let hash = 0;
  for (let i = 0; i < storedId.length; i++) {
    hash = (hash << 5) - hash + storedId.charCodeAt(i);
  }
  const presetIndex = Math.abs(hash) % AVATAR_PRESETS.length;
  const preset = AVATAR_PRESETS[presetIndex];

  const storedName = localStorage.getItem("quicksend_device_name");
  const deviceName =
    storedName ||
    `${preset.codename} (${os} ${formFactor === "mobile" ? "Phone" : formFactor === "tablet" ? "Tablet" : "PC"})`;

  return {
    id: storedId,
    name: deviceName,
    codename: preset.codename,
    avatarEmoji: preset.emoji,
    avatarColor: preset.color,
    formFactor,
    os,
    browser,
  };
}

export function updateLocalDeviceName(newName: string): void {
  if (typeof window !== "undefined" && newName.trim()) {
    localStorage.setItem("quicksend_device_name", newName.trim());
  }
}
