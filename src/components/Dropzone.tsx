"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { UploadCloud, X, ShieldCheck } from "lucide-react";
import { formatBytes } from "@/lib/chunker";
import { SegmentedControl } from "@/components/SegmentedControl";
import { FileTypeBadge } from "@/components/FileTypeBadge";

interface DropzoneProps {
  onSelectionChange: (payload: { files: File[]; text: string }) => void;
}

export function Dropzone({ onSelectionChange }: DropzoneProps) {
  const [activeTab, setActiveTab] = useState<"files" | "text">("files");
  const [files, setFiles] = useState<File[]>([]);
  const [text, setText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesAdded = (newFiles: FileList | File[]) => {
    const updated = [...files, ...Array.from(newFiles)];
    setFiles(updated);
    onSelectionChange({ files: updated, text });
  };

  const handleRemoveFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    setFiles(updated);
    onSelectionChange({ files: updated, text });
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);
    onSelectionChange({ files, text: newText });
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesAdded(e.dataTransfer.files);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full space-y-3.5">
      {/* Segmented Pill Tabs */}
      <SegmentedControl
        ariaLabel="Payload Type"
        value={activeTab}
        onChange={(val) => setActiveTab(val as "files" | "text")}
        options={[
          {
            value: "files",
            label: `Files ${files.length > 0 ? `(${files.length})` : ""}`.trim(),
          },
          {
            value: "text",
            label: `Text / Link ${text.trim() ? "(Ready)" : ""}`.trim(),
          },
        ]}
      />

      {activeTab === "files" ? (
        <div className="space-y-3">
          {/* Drop Target */}
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? "border-neutral-800 dark:border-white bg-neutral-100/70 dark:bg-neutral-800/60 scale-[0.99]"
                : "border-[var(--border-hairline)] hover:border-neutral-400 dark:hover:border-neutral-600 bg-[var(--surface-subtle)]"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesAdded(e.target.files);
              }}
            />
            <div className="h-11 w-11 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/60 dark:border-neutral-700/60 shadow-2xs flex items-center justify-center text-neutral-800 dark:text-neutral-200 mb-3">
              <UploadCloud className="h-5 w-5" />
            </div>
            <p className="text-sm font-bold text-[var(--text)]">
              Drag &amp; drop files here, or <span className="underline">browse</span>
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Documents, photos, videos, archives up to gigabytes
            </p>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center justify-center gap-1 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span>Zero server uploads — files stay on your device until direct P2P transfer</span>
            </p>
          </div>

          {/* Selected File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-mono px-1 tabular-nums">
                <span>Selected ({files.length})</span>
                <span>Total: {formatBytes(totalSize)}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <FileTypeBadge fileName={file.name} mimeType={file.type} />
                      <span className="truncate font-semibold text-[var(--text)]">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-[var(--text-muted)] font-mono text-[11px] tabular-nums">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(i);
                      }}
                      className="p-1 rounded-full text-neutral-400 hover:text-red-500 hover:bg-neutral-200/60 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Text / Link Input */
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Type or paste any text, URL, code snippet, or notes here..."
            rows={5}
            className="w-full p-4 text-xs font-mono rounded-2xl border border-[var(--border-hairline)] bg-[var(--surface-subtle)] text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-white resize-none placeholder:text-[var(--text-muted)]"
          />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] px-1 font-mono tabular-nums">
            <span>{text.length} characters</span>
            <span>{text.split(/\s+/).filter(Boolean).length} words</span>
          </div>
        </div>
      )}
    </div>
  );
}
