import { describe, it, expect } from "vitest";
import { getFileTypeInfo } from "@/components/FileTypeBadge";

describe("FileTypeBadge helper", () => {
  it("should categorize PDF files correctly", () => {
    const info = getFileTypeInfo("invoice.pdf");
    expect(info.label).toBe("PDF");
    expect(info.bg).toContain("text-red");
  });

  it("should categorize image formats correctly", () => {
    expect(getFileTypeInfo("photo.PNG").label).toBe("IMG");
    expect(getFileTypeInfo("banner.webp").label).toBe("IMG");
    expect(getFileTypeInfo(undefined, "image/jpeg").label).toBe("IMG");
  });

  it("should categorize documents and archives correctly", () => {
    expect(getFileTypeInfo("contract.docx").label).toBe("DOC");
    expect(getFileTypeInfo("dataset.zip").label).toBe("ZIP");
    expect(getFileTypeInfo("archive.tar.gz").label).toBe("ZIP");
  });

  it("should categorize code and text files correctly", () => {
    expect(getFileTypeInfo("script.ts").label).toBe("TXT");
    expect(getFileTypeInfo("notes.txt").label).toBe("TXT");
  });

  it("should fallback gracefully for unknown file types", () => {
    const info = getFileTypeInfo("data.xyz123");
    expect(info.label).toBe("XYZ1");
    expect(info.bg).toContain("text-neutral");
  });
});
