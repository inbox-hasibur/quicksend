// Constants for chunk-based encrypted cloud relay (client & server)

export const RELAY_CHUNK_BYTES = 16 * 1024 * 1024; // 16 MiB chunks
export const RELAY_MAX_FILE_BYTES = 750 * 1024 * 1024; // 750 MiB max per file
export const RELAY_MAX_TRANSFER_BYTES = 800 * 1024 * 1024; // 800 MiB max per transfer
export const RELAY_MAX_FILES = 5; // Max 5 files per transfer
export const RELAY_MAX_CHUNKS_PER_FILE = 50; // Max 50 chunks per file
export const RELAY_TAG_BYTES = 16; // AES-GCM 128-bit authentication tag
export const RELAY_TTL_MINUTES = 15; // Relay data expiration TTL in minutes
