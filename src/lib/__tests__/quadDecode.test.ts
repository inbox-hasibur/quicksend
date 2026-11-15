import { describe, it, expect, vi } from "vitest";
import { decodeQuadrants, cropImageData, jsqrDecodeOne } from "../quadDecode";

describe("quadDecode", () => {
  function createTestImageData(width: number, height: number): ImageData {
    const data = new Uint8ClampedArray(width * height * 4);
    if (typeof ImageData !== "undefined") {
      return new ImageData(data, width, height);
    }
    return {
      data,
      width,
      height,
      colorSpace: "srgb",
    } as ImageData;
  }

  it("should crop an ImageData region accurately", () => {
    const src = createTestImageData(100, 100);
    // Fill specific pixel at (10, 10) with red (255, 0, 0, 255)
    const idx = (10 * 100 + 10) * 4;
    src.data[idx] = 255;
    src.data[idx + 3] = 255;

    const crop = cropImageData(src, 10, 10, 20, 20);
    expect(crop.width).toBe(20);
    expect(crop.height).toBe(20);
    // Pixel (0, 0) of the cropped image must match pixel (10, 10) of src
    expect(crop.data[0]).toBe(255);
    expect(crop.data[3]).toBe(255);
  });

  it("should split into 4 quadrants with 8% overlap padding and deduplicate results", () => {
    const W = 1000;
    const H = 800;
    const img = createTestImageData(W, H);

    const halfW = 500;
    const halfH = 400;
    const padX = 80; // 8% of 1000
    const padY = 64; // 8% of 800

    const recordedCrops: Array<{ width: number; height: number }> = [];

    const fakeDecodeOne = vi.fn((crop: ImageData): string | null => {
      recordedCrops.push({ width: crop.width, height: crop.height });
      // Return duplicate on 2 quadrants to test deduplication
      if (recordedCrops.length === 1) return "QS1|first";
      if (recordedCrops.length === 2) return "QS1|second";
      if (recordedCrops.length === 3) return "QS1|first"; // Duplicate!
      return ""; // Empty string should be filtered
    });

    const results = decodeQuadrants(img, fakeDecodeOne);

    expect(recordedCrops.length).toBe(4);

    // Top-Left dimensions: halfW + padX by halfH + padY
    expect(recordedCrops[0].width).toBe(halfW + padX); // 580
    expect(recordedCrops[0].height).toBe(halfH + padY); // 464

    // Top-Right dimensions: W - (halfW - padX) = 1000 - 420 = 580
    expect(recordedCrops[1].width).toBe(halfW + padX); // 580
    expect(recordedCrops[1].height).toBe(halfH + padY); // 464

    // Bottom-Left dimensions
    expect(recordedCrops[2].width).toBe(halfW + padX);
    expect(recordedCrops[2].height).toBe(halfH + padY);

    // Bottom-Right dimensions
    expect(recordedCrops[3].width).toBe(halfW + padX);
    expect(recordedCrops[3].height).toBe(halfH + padY);

    // Duplicates and empty strings must be removed
    expect(results).toEqual(["QS1|first", "QS1|second"]);
  });

  it("should safely return empty array for 0x0 or invalid ImageData", () => {
    const emptyImg = createTestImageData(0, 0);
    const results = decodeQuadrants(emptyImg, () => "test");
    expect(results).toEqual([]);
  });

  it("should return null from jsqrDecodeOne when no QR is present in blank image", () => {
    const blank = createTestImageData(100, 100);
    const result = jsqrDecodeOne(blank);
    expect(result).toBeNull();
  });
});
