// Constants for chunk-based encrypted cloud relay (client & server)

export const RELAY_CHUNK_BYTES = 8 * 1024 * 1024; // 8 MiB chunks
export const RELAY_MAX_FILE_BYTES = 750 * 1024 * 1024; // 750 MiB max per file
export const RELAY_MAX_TRANSFER_BYTES = 800 * 1024 * 1024; // 800 MiB max per transfer
export const RELAY_MAX_FILES = 5; // Max 5 files per transfer
export const RELAY_MAX_CHUNKS_PER_FILE = 100; // Max 100 chunks per file (8 MiB * 100 = 800 MiB)
export const RELAY_TAG_BYTES = 16; // AES-GCM 128-bit authentication tag
export const RELAY_TTL_MINUTES = 15; // Relay data expiration TTL in minutes
