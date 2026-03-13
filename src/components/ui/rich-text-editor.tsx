"use client";

import * as React from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Heading2,
  Heading3,
  Pilcrow,
  Minus,
  Undo2,
  Redo2,
  Eraser,
} from "lucide-react";
import { isRichTextEmpty, sanitizeRichTextHtml } from "@/utils/rich-text";

type RichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

type ToolbarButtonProps = {
  active?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({
  active = false,
  disabled = false,
  label,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex h-8 items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border hover:bg-muted"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Tulis konten...",
  disabled = false,
}: RichTextEditorProps) {
  const [initialContent] = React.useState(() => sanitizeRichTextHtml(value));
  const lastAppliedValueRef = React.useRef<string>(initialContent);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: initialContent,
    editable: !disabled,
    onUpdate: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      lastAppliedValueRef.current = html;
      onChange(isRichTextEmpty(html) ? "" : html);
    },
    onBlur: ({ editor: currentEditor }) => {
      const html = currentEditor.getHTML();
      const sanitized = sanitizeRichTextHtml(html);

      if (sanitized !== html) {
        currentEditor.commands.setContent(sanitized, { emitUpdate: false });
      }

      lastAppliedValueRef.current = sanitized;
      onChange(isRichTextEmpty(sanitized) ? "" : sanitized);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[240px] px-4 py-3 text-sm outline-none [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_hr]:my-4 [&_hr]:border-border [&_li]:ml-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  React.useEffect(() => {
    if (!editor) return;
    if (editor.isFocused) return;

    const sanitized = sanitizeRichTextHtml(value);
    if (sanitized === sanitizeRichTextHtml(lastAppliedValueRef.current)) return;

    lastAppliedValueRef.current = sanitized;
    editor.commands.setContent(sanitized, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return <div className="min-h-[240px] rounded-xl border bg-background" />;
  }

  return (
    <div className="rounded-xl border bg-background">
      <div className="flex flex-wrap gap-2 border-b p-3">
        <ToolbarButton
          label="Bold"
          active={editor.isActive("bold")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Italic"
          active={editor.isActive("italic")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Underline"
          active={editor.isActive("underline")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Strike"
          active={editor.isActive("strike")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 2"
          active={editor.isActive("heading", { level: 2 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Heading 3"
          active={editor.isActive("heading", { level: 3 })}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Paragraph"
          active={editor.isActive("paragraph")}
          disabled={disabled}
          onClick={() => editor.chain().focus().setParagraph().run()}
        >
          <Pilcrow className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Bullet List"
          active={editor.isActive("bulletList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Numbered List"
          active={editor.isActive("orderedList")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Quote"
          active={editor.isActive("blockquote")}
          disabled={disabled}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Divider"
          disabled={disabled}
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        >
          <Minus className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Clear Formatting"
          disabled={disabled}
          onClick={() =>
            editor.chain().focus().unsetAllMarks().clearNodes().setParagraph().run()
          }
        >
          <Eraser className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Undo"
          disabled={disabled || !editor.can().chain().focus().undo().run()}
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={disabled || !editor.can().chain().focus().redo().run()}
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
}
