import { Bucket } from "@upstash/blob";
import { normalizeRoomCode } from "./codeGenerator";

/**
 * Client-side direct upload helper for encrypted blobs to Upstash storage.
 */
export interface UploadOptions {
  access?: string;
  contentType?: string;
  handleUploadUrl?: string;
  clientPayload?: string;
  onUploadProgress?: (progress: { percentage: number }) => void;
}

export interface PutBlobResult {
  url: string;
  pathname: string;
  contentType?: string;
}

export async function upload(
  pathname: string,
  body: Blob | ArrayBuffer,
  options?: UploadOptions
): Promise<PutBlobResult> {
  const handleUrl = options?.handleUploadUrl || "/api/relay/upload";
  const tokenRes = await fetch(handleUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pathname,
      clientPayload: options?.clientPayload,
    }),
  });

  if (!tokenRes.ok) {
    const errData = (await tokenRes.json().catch(() => ({}))) as { error?: string };
    throw new Error(errData.error || "Failed to generate upload URL");
  }

  const tokenData = (await tokenRes.json()) as {
    url?: string;
    uploadUrl?: string;
    publicUrl?: string;
    headers?: Record<string, string>;
  };

  const uploadUrl = tokenData.url || tokenData.uploadUrl;
  if (!uploadUrl) {
    throw new Error("No upload URL returned from relay");
  }

  const headers = tokenData.headers || {
    "Content-Type": options?.contentType || "application/octet-stream",
  };

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body,
  });

  if (!putRes.ok) {
    throw new Error("Failed to upload blob to storage");
  }

  if (options?.onUploadProgress) {
    options.onUploadProgress({ percentage: 100 });
  }

  const publicUrl = tokenData.publicUrl || uploadUrl.split("?")[0];
  return {
    url: publicUrl,
    pathname,
    contentType: options?.contentType,
  };
}

/**
 * Check if Upstash Blob environment variables are configured.
 */
export function isUpstashBlobConfigured(): boolean {
  return Boolean(process.env.UPSTASH_BLOB_TOKEN?.trim());
}

/**
 * Get configured bucket name or default.
 */
export function getUpstashBucketName(): string {
  return process.env.UPSTASH_BLOB_BUCKET?.trim() || "quicksend-relay";
}

/**
 * Return an initialized Upstash Blob Bucket instance.
 */
export function getUpstashBucket(): Bucket {
  const token = process.env.UPSTASH_BLOB_TOKEN?.trim();
  if (!token) {
    throw new Error("UPSTASH_BLOB_TOKEN is not configured");
  }
  if (typeof Bucket.fromEnv === "function") {
    try {
      return Bucket.fromEnv();
    } catch {
      return new Bucket({ token });
    }
  }
  return new Bucket({ token });
}

/**
 * Validate that a URL belongs to the allowed Upstash Blob storage domain and room path.
 */
export function isAllowedRelayUrl(urlStr: string, roomCode: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();
    let hostAllowed =
      host.endsWith(".blob.upstash.io") ||
      host.endsWith(".upstash.io") ||
      host.endsWith(".upstash-blob.com");

    const configuredBase = process.env.UPSTASH_BLOB_URL?.trim();
    if (configuredBase) {
      try {
        const confParsed = new URL(configuredBase);
        if (host === confParsed.hostname.toLowerCase()) {
          hostAllowed = true;
        }
      } catch {
        // ignore malformed UPSTASH_BLOB_URL
      }
    }

    if (!hostAllowed) {
      return false;
    }

    const cleanCode = normalizeRoomCode(roomCode);
    const hasRawPrefix = parsed.pathname.includes(`/relay/${roomCode}/`);
    const hasCleanPrefix = parsed.pathname.includes(`/relay/${cleanCode}/`);

    return hasRawPrefix || hasCleanPrefix;
  } catch {
    return false;
  }
}
