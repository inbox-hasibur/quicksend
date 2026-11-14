"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { UploadCloud, File, X } from "lucide-react";
import { formatBytes } from "@/lib/chunker";
import { SegmentedControl } from "@/components/SegmentedControl";

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
    <div className="w-full space-y-4">
      {/* Tabs: Files vs Text */}
      <SegmentedControl
        ariaLabel="Payload Type"
        value={activeTab}
        onChange={(val) => setActiveTab(val as "files" | "text")}
        options={[
          { value: "files", label: `Files ${files.length > 0 ? `(${files.length})` : ""}`.trim() },
          { value: "text", label: `Text / Link ${text.trim() ? "(Ready)" : ""}`.trim() },
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
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 scale-[0.99]"
                : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-900/40"
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
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
              Drag &amp; drop files here, or <span className="text-indigo-600 dark:text-indigo-400">browse</span>
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Any file type (documents, photos, videos, archives) up to gigabytes
            </p>
          </div>

          {/* Selected File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-mono px-1">
                <span>Selected ({files.length})</span>
                <span>Total: {formatBytes(totalSize)}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between p-3 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-850 text-xs shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <File className="h-4 w-4 shrink-0 text-indigo-500" />
                      <span className="truncate font-semibold text-neutral-800 dark:text-neutral-200">
                        {file.name}
                      </span>
                      <span className="shrink-0 text-neutral-400 font-mono text-[11px]">
                        ({formatBytes(file.size)})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile(i);
                      }}
                      className="p-1 rounded-full text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors cursor-pointer"
                      title="Remove file"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={handleTextChange}
            placeholder="Paste text snippets, code, terminal logs, or links to beam instantly..."
            rows={5}
            className="w-full p-4 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono resize-none placeholder:text-neutral-400 text-neutral-900 dark:text-neutral-100"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400 px-1 font-mono">
            <span>Instant clipboard beam</span>
            <span>{text.length} chars</span>
          </div>
        </div>
      )}
    </div>
  );
}
