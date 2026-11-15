/**
 * Multi-Quadrant QR Decoder for 2x2 High-Throughput Optical Scanning.
 * Slices image frames into 4 overlapping quadrants with 8% inner padding
 * and decodes each quadrant with jsQR or custom QR decoders.
 */

import jsQR from "jsqr";

/**
 * Crops a sub-rectangle from an ImageData object.
 */
export function cropImageData(
  src: ImageData,
  x0: number,
  y0: number,
  w: number,
  h: number
): ImageData {
  const targetData = new Uint8ClampedArray(w * h * 4);
  const srcData = src.data;
  const srcW = src.width;

  for (let row = 0; row < h; row++) {
    const srcRow = y0 + row;
    const srcStart = (srcRow * srcW + x0) * 4;
    const srcEnd = srcStart + w * 4;
    const destStart = row * w * 4;
    targetData.set(srcData.subarray(srcStart, srcEnd), destStart);
  }

  if (typeof ImageData !== "undefined") {
    return new ImageData(targetData, w, h);
  }
  return {
    data: targetData,
    width: w,
    height: h,
    colorSpace: "srgb",
  } as ImageData;
}

/**
 * Splits image into 4 quadrants with 8% overlap padding on inner edges,
 * decodes each with decodeOne, and returns unique non-empty strings.
 */
export function decodeQuadrants(
  imageData: ImageData,
  decodeOne: (img: ImageData) => string | null
): string[] {
  const W = imageData.width;
  const H = imageData.height;
  if (W <= 0 || H <= 0) return [];

  const halfW = Math.floor(W / 2);
  const halfH = Math.floor(H / 2);
  const padX = Math.round(W * 0.08);
  const padY = Math.round(H * 0.08);

  const rects = [
    // Top-Left (TL)
    { x: 0, y: 0, w: Math.min(W, halfW + padX), h: Math.min(H, halfH + padY) },
    // Top-Right (TR)
    { x: Math.max(0, halfW - padX), y: 0, w: W - Math.max(0, halfW - padX), h: Math.min(H, halfH + padY) },
    // Bottom-Left (BL)
    { x: 0, y: Math.max(0, halfH - padY), w: Math.min(W, halfW + padX), h: H - Math.max(0, halfH - padY) },
    // Bottom-Right (BR)
    {
      x: Math.max(0, halfW - padX),
      y: Math.max(0, halfH - padY),
      w: W - Math.max(0, halfW - padX),
      h: H - Math.max(0, halfH - padY),
    },
  ];

  const results = new Set<string>();

  for (const rect of rects) {
    if (rect.w <= 0 || rect.h <= 0) continue;
    const cropped = cropImageData(imageData, rect.x, rect.y, rect.w, rect.h);
    try {
      const decoded = decodeOne(cropped);
      if (decoded && decoded.trim() !== "") {
        results.add(decoded.trim());
      }
    } catch {
      // Ignore individual quadrant decode errors
    }
  }

  return Array.from(results);
}

/**
 * Decodes a single QR code from an ImageData crop using jsQR (dontInvert).
 */
export function jsqrDecodeOne(img: ImageData): string | null {
  try {
    const res = jsQR(img.data, img.width, img.height, {
      inversionAttempts: "dontInvert",
    });
    return res?.data || null;
  } catch {
    return null;
  }
}
