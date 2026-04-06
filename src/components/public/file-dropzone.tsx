"use client";

import * as React from "react";
import { FileText, Trash2, Upload } from "lucide-react";

type FileDropzoneProps = {
  file: File | null;
  previewUrl: string | null;
  accept?: string;
  label: React.ReactNode;
  helperText?: string;
  emptyText: string;
  emptySubtext?: string;
  removeLabel: string;
  onFileSelect: (file: File | null) => void;
};

export function FileDropzone({
  file,
  previewUrl,
  accept,
  label,
  helperText,
  emptyText,
  emptySubtext,
  removeLabel,
  onFileSelect,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  function handleIncomingFile(nextFile: File | null) {
    onFileSelect(nextFile);
    setIsDragging(false);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <label className="text-sm font-medium">{label}</label>
        {helperText ? (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </div>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          const nextFile = event.dataTransfer.files?.[0] || null;
          handleIncomingFile(nextFile);
        }}
        className={`rounded-2xl border-2 border-dashed p-5 transition-all ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border hover:border-primary/40 hover:bg-muted/30"
        } cursor-pointer`}
      >
        {previewUrl && file?.type.startsWith("image/") ? (
          <div className="space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={file.name}
              className="max-h-60 w-full rounded-xl border bg-background object-contain"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-sm text-muted-foreground">{file.name}</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
                onClick={(event) => {
                  event.stopPropagation();
                  handleIncomingFile(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {removeLabel}
              </button>
            </div>
          </div>
        ) : file ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-background p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-lg bg-muted p-2">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {Math.max(file.size / 1024 / 1024, 0.01).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              onClick={(event) => {
                event.stopPropagation();
                handleIncomingFile(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {removeLabel}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="mb-3 rounded-full bg-muted p-3">
              <Upload className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">{emptyText}</p>
            {emptySubtext ? (
              <p className="mt-1 text-xs text-muted-foreground">{emptySubtext}</p>
            ) : null}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(event) => handleIncomingFile(event.target.files?.[0] || null)}
      />
    </div>
  );
}
