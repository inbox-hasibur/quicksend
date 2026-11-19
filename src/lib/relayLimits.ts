// Constants for chunk-based encrypted cloud relay (client & server)

export const RELAY_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MiB chunks
export const RELAY_MAX_FILE_BYTES = 200 * 1024 * 1024; // 200 MiB max per file
export const RELAY_MAX_TRANSFER_BYTES = 300 * 1024 * 1024; // 300 MiB max per transfer
export const RELAY_MAX_FILES = 5; // Max 5 files per transfer
export const RELAY_MAX_CHUNKS_PER_FILE = 50; // 200 MiB / 4 MiB = 50 chunks max
export const RELAY_TAG_BYTES = 16; // AES-GCM 128-bit authentication tag
export const RELAY_TTL_MINUTES = 15; // Relay data expiration TTL in minutes
