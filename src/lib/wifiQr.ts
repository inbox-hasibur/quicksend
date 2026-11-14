export type WifiEncryption = "WPA" | "WEP" | "nopass";

export interface WifiCredentials {
  ssid: string;
  password?: string;
  encryption?: WifiEncryption;
  hidden?: boolean;
}

// Android Intent deep-links to launch OS Wi-Fi and Tethering settings directly
export const ANDROID_INTENTS = {
  WIFI_SETTINGS: "intent:#Intent;action=android.settings.WIFI_SETTINGS;end",
  WIRELESS_SETTINGS: "intent:#Intent;action=android.settings.WIRELESS_SETTINGS;end",
  TETHER_SETTINGS: "intent:#Intent;action=android.settings.TETHER_SETTINGS;end",
} as const;

/**
 * Builds a standardized Wi-Fi pairing string recognized natively by iOS and Android camera apps.
 * Format: WIFI:T:WPA;S:MyNetwork;P:MyPassword;H:false;;
 */
export function buildWifiQrString(creds: WifiCredentials): string {
  const { ssid, password = "", encryption = "WPA", hidden = false } = creds;

  // Escape special characters: backslash, semicolon, comma, colon, quote
  const escapeVal = (val: string) => val.replace(/([\\;,":])/g, "\\$1");

  const escapedSsid = escapeVal(ssid);
  const escapedPassword = escapeVal(password);
  const encType = password ? encryption : "nopass";

  let result = `WIFI:T:${encType};S:${escapedSsid};`;
  if (encType !== "nopass" && password) {
    result += `P:${escapedPassword};`;
  }
  if (hidden) {
    result += "H:true;";
  }
  result += ";";

  return result;
}

/**
 * Parses a standard WIFI:T:... string back into WifiCredentials.
 */
export function parseWifiQrString(qrString: string): WifiCredentials | null {
  if (!qrString.startsWith("WIFI:")) {
    return null;
  }

  const unescapeVal = (val: string) => val.replace(/\\([\\;,":])/g, "$1");

  const matchT = qrString.match(/T:([^;]*);/);
  const matchS = qrString.match(/S:([^;]*);/);
  const matchP = qrString.match(/P:([^;]*);/);
  const matchH = qrString.match(/H:([^;]*);/);

  if (!matchS) return null;

  const encryption = (matchT ? matchT[1] : "WPA") as WifiEncryption;
  const ssid = unescapeVal(matchS[1]);
  const password = matchP ? unescapeVal(matchP[1]) : "";
  const hidden = matchH ? matchH[1].toLowerCase() === "true" : false;

  return {
    ssid,
    password,
    encryption,
    hidden,
  };
}
