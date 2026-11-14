import React from "react";

export function getFileTypeInfo(fileName?: string, mimeType?: string) {
  const ext = fileName ? fileName.split(".").pop()?.toLowerCase() : "";

  if (ext === "pdf" || mimeType?.includes("pdf")) {
    return {
      label: "PDF",
      bg: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25",
    };
  }

  if (
    ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "avif"].includes(ext || "") ||
    mimeType?.startsWith("image/")
  ) {
    return {
      label: "IMG",
      bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/25",
    };
  }

  if (
    ["doc", "docx", "odt", "rtf", "pages"].includes(ext || "") ||
    mimeType?.includes("word")
  ) {
    return {
      label: "DOC",
      bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25",
    };
  }

  if (
    ["zip", "rar", "7z", "tar", "gz", "bz2", "xz"].includes(ext || "") ||
    mimeType?.includes("zip") ||
    mimeType?.includes("compressed")
  ) {
    return {
      label: "ZIP",
      bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25",
    };
  }

  if (
    ["mp4", "mkv", "avi", "mov", "webm", "m4v"].includes(ext || "") ||
    mimeType?.startsWith("video/")
  ) {
    return {
      label: "VID",
      bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25",
    };
  }

  if (
    ["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext || "") ||
    mimeType?.startsWith("audio/")
  ) {
    return {
      label: "AUD",
      bg: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/25",
    };
  }

  if (
    ["txt", "md", "json", "js", "ts", "tsx", "jsx", "py", "html", "css", "csv"].includes(
      ext || ""
    ) ||
    mimeType?.startsWith("text/")
  ) {
    return {
      label: "TXT",
      bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25",
    };
  }

  return {
    label: (ext || "FILE").toUpperCase().slice(0, 4),
    bg: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/25",
  };
}

export function FileTypeBadge({
  fileName,
  mimeType,
  className = "",
}: {
  fileName?: string;
  mimeType?: string;
  className?: string;
}) {
  const { label, bg } = getFileTypeInfo(fileName, mimeType);

  return (
    <span
      className={`inline-flex items-center justify-center font-mono font-bold text-[10px] tracking-wider px-1.5 py-0.5 rounded-md border shrink-0 ${bg} ${className}`}
    >
      {label}
    </span>
  );
}
