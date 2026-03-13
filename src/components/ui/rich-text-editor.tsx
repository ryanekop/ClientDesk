"use client";

import * as React from "react";
import { sanitizeRichTextHtml, isRichTextEmpty } from "@/utils/rich-text";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type ToolbarAction = {
  label: string;
  command: string;
  value?: string;
};

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "B", command: "bold" },
  { label: "I", command: "italic" },
  { label: "U", command: "underline" },
  { label: "H2", command: "formatBlock", value: "<h2>" },
  { label: "P", command: "formatBlock", value: "<p>" },
  { label: "• List", command: "insertUnorderedList" },
  { label: "1. List", command: "insertOrderedList" },
  { label: "Quote", command: "formatBlock", value: "<blockquote>" },
  { label: "Clear", command: "removeFormat" },
];

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis konten...",
  disabled = false,
}: RichTextEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const isEmpty = isRichTextEmpty(value);

  React.useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML === value) return;
    editorRef.current.innerHTML = value;
  }, [value]);

  const emitChange = React.useCallback(() => {
    if (!editorRef.current) return;
    const sanitized = sanitizeRichTextHtml(editorRef.current.innerHTML);
    if (editorRef.current.innerHTML !== sanitized) {
      editorRef.current.innerHTML = sanitized;
    }
    onChange(sanitized);
  }, [onChange]);

  const runCommand = React.useCallback(
    (command: string, commandValue?: string) => {
      if (disabled || !editorRef.current || typeof document === "undefined") return;
      editorRef.current.focus();
      document.execCommand(command, false, commandValue);
      emitChange();
    },
    [disabled, emitChange],
  );

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex flex-wrap gap-2 border-b p-3">
        {TOOLBAR_ACTIONS.map((action) => (
          <button
            key={`${action.command}-${action.label}`}
            type="button"
            onClick={() => runCommand(action.command, action.value)}
            disabled={disabled}
            className="inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action.label}
          </button>
        ))}
      </div>

      <div className="relative">
        {isEmpty && (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emitChange}
          onBlur={emitChange}
          className="min-h-[220px] px-4 py-3 text-sm outline-none [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_li]:ml-5 [&_li]:list-item [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
        />
      </div>
    </div>
  );
}
