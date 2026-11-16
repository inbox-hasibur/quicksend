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

function getGridRects(
  W: number,
  H: number,
  cols: number,
  rows: number
): Array<{ x: number; y: number; w: number; h: number }> {
  if (W <= 0 || H <= 0 || cols <= 0 || rows <= 0) return [];
  const padX = Math.round(W * 0.08);
  const padY = Math.round(H * 0.08);
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];

  for (let r = 0; r < rows; r++) {
    const y0_base = Math.floor(r * (H / rows));
    const y1_base = Math.floor((r + 1) * (H / rows));
    const y0 = r > 0 ? Math.max(0, y0_base - padY) : 0;
    const y1 = r < rows - 1 ? Math.min(H, y1_base + padY) : H;

    for (let c = 0; c < cols; c++) {
      const x0_base = Math.floor(c * (W / cols));
      const x1_base = Math.floor((c + 1) * (W / cols));
      const x0 = c > 0 ? Math.max(0, x0_base - padX) : 0;
      const x1 = c < cols - 1 ? Math.min(W, x1_base + padX) : W;

      rects.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }

  return rects;
}

/**
 * Splits image into a grid of (cols x rows) sub-regions with 8% inner overlap padding,
 * decodes each with decodeOne, and returns unique non-empty strings.
 */
export function decodeGrid(
  imageData: ImageData,
  cols: number,
  rows: number,
  decodeOne: (img: ImageData) => string | null
): string[] {
  const W = imageData.width;
  const H = imageData.height;
  if (W <= 0 || H <= 0 || cols <= 0 || rows <= 0) return [];

  const rects = getGridRects(W, H, cols, rows);
  const results = new Set<string>();

  for (const rect of rects) {
    if (rect.w <= 0 || rect.h <= 0) continue;
    const cropped =
      rect.x === 0 && rect.y === 0 && rect.w === W && rect.h === H
        ? imageData
        : cropImageData(imageData, rect.x, rect.y, rect.w, rect.h);
    try {
      const decoded = decodeOne(cropped);
      if (decoded && decoded.trim() !== "") {
        results.add(decoded.trim());
      }
    } catch {
      // Ignore individual cell decode errors
    }
  }

  return Array.from(results);
}

/**
 * Splits image into 4 quadrants with 8% overlap padding on inner edges,
 * decodes each with decodeOne, and returns unique non-empty strings.
 */
export function decodeQuadrants(
  imageData: ImageData,
  decodeOne: (img: ImageData) => string | null
): string[] {
  return decodeGrid(imageData, 2, 2, decodeOne);
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
