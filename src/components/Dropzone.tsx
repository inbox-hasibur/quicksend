"use client";

import { useState, useRef, ChangeEvent, DragEvent } from "react";
import { UploadCloud, File, X, FileText } from "lucide-react";
import { formatBytes } from "@/lib/chunker";

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
      <div className="flex rounded-xl bg-neutral-100 dark:bg-neutral-800 p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("files")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
            activeTab === "files"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <UploadCloud className="h-4 w-4" />
          <span>Files {files.length > 0 && `(${files.length})`}</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("text")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition-all ${
            activeTab === "text"
              ? "bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
              : "text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Text / Link {text.trim() && "(Ready)"}</span>
        </button>
      </div>

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
                ? "border-indigo-500 bg-indigo-50/60 dark:bg-indigo-950/30 scale-[0.99]"
                : "border-neutral-300 dark:border-neutral-700 hover:border-neutral-400 dark:hover:border-neutral-600 bg-neutral-50/40 dark:bg-neutral-900/40"
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
            <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 mb-3 shadow-inner">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
              Drag &amp; drop files here, or <span className="text-indigo-600 dark:text-indigo-400">browse</span>
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              Supports any file format (documents, images, zip, code) up to gigabytes
            </p>
          </div>

          {/* Selected File List */}
          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-neutral-500 font-mono px-1">
                <span>Selected Files ({files.length})</span>
                <span>Total: {formatBytes(totalSize)}</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <File className="h-4 w-4 shrink-0 text-indigo-500" />
                      <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
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
                      className="p-1 rounded-md text-neutral-400 hover:text-red-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
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
            placeholder="Paste text snippets, notes, terminal outputs, or long URLs to beam to peer..."
            rows={5}
            className="w-full p-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono resize-none placeholder:text-neutral-400"
          />
          <div className="flex items-center justify-between text-xs text-neutral-400 px-1">
            <span>Instant clipboard sharing</span>
            <span>{text.length} characters</span>
          </div>
        </div>
      )}
    </div>
  );
}
