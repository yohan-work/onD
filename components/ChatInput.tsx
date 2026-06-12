import { useEffect, useRef } from "react";
import {
  estimateTokens,
  MAX_ATTACHMENTS,
  readTextAttachment,
} from "@/lib/attachments";
import type { TextAttachment } from "@/lib/types";

type ChatInputProps = {
  value: string;
  placeholder: string;
  disabled: boolean;
  isGenerating?: boolean;
  attachments?: TextAttachment[];
  attachmentError?: string | null;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  onAttachmentsChange?: (attachments: TextAttachment[]) => void;
  onAttachmentError?: (message: string | null) => void;
};

export function ChatInput({
  value,
  placeholder,
  disabled,
  isGenerating = false,
  attachments = [],
  attachmentError = null,
  onChange,
  onSubmit,
  onStop,
  onAttachmentsChange,
  onAttachmentError,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [value]);

  const canSubmit = value.trim().length > 0 && !disabled;

  return (
    <div className="border-t border-[var(--line)] bg-[var(--panel)]/95 px-4 py-4 backdrop-blur-sm sm:px-6">
      <div className="mx-auto max-w-[860px]">
        {attachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.id}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white px-2.5 py-1.5 text-[10px] text-[var(--ink-secondary)]"
              >
                <span className="max-w-44 truncate">{attachment.name}</span>
                <span className="font-mono text-[var(--ink-muted)]">
                  ~{estimateTokens(attachment.content).toLocaleString()} tok
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() =>
                    onAttachmentsChange?.(
                      attachments.filter((item) => item.id !== attachment.id),
                    )
                  }
                  className="text-[var(--error)]"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        {attachmentError ? (
          <p className="mb-2 text-xs text-[var(--error)]">{attachmentError}</p>
        ) : null}
        <div className="flex items-end gap-3 rounded-[20px] border border-[var(--line)] bg-white p-2.5 pl-4 shadow-[var(--shadow)] transition focus-within:border-[var(--accent)] focus-within:ring-3 focus-within:ring-[var(--accent-soft)]">
          {onAttachmentsChange ? (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                multiple
                className="hidden"
                onChange={async (event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = "";
                  try {
                    const remaining = MAX_ATTACHMENTS - attachments.length;
                    if (files.length > remaining) {
                      throw new Error(`Attach up to ${MAX_ATTACHMENTS} files.`);
                    }
                    const next = await Promise.all(files.map(readTextAttachment));
                    onAttachmentError?.(null);
                    onAttachmentsChange([...attachments, ...next]);
                  } catch (error) {
                    onAttachmentError?.(
                      error instanceof Error
                        ? error.message
                        : "Could not read the selected file.",
                    );
                  }
                }}
              />
              <button
                type="button"
                disabled={disabled || attachments.length >= MAX_ATTACHMENTS}
                onClick={() => fileInputRef.current?.click()}
                className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-[var(--line)] text-lg text-[var(--ink-secondary)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-35"
                aria-label="Attach text or Markdown file"
                title="Attach .txt or .md"
              >
                +
              </button>
            </>
          ) : null}
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            disabled={disabled}
            aria-label="Chat message"
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (
                event.key === "Enter" &&
                !event.shiftKey &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault();
                if (canSubmit) {
                  onSubmit();
                }
              }
            }}
            className="max-h-40 min-h-10 flex-1 bg-transparent py-2 text-[15px] leading-6 outline-none placeholder:text-[var(--ink-muted)] disabled:cursor-not-allowed"
          />
          <button
            type="button"
            disabled={!isGenerating && !canSubmit}
            onClick={isGenerating ? onStop : onSubmit}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--ink-muted)]"
            aria-label={isGenerating ? "Stop generation" : "Send message"}
          >
            {isGenerating ? (
              <span className="h-3 w-3 rounded-[2px] bg-white" />
            ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="m5 12 7-7 7 7" />
              <path d="M12 19V5" />
            </svg>
            )}
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-[var(--ink-muted)]">
          ENTER TO SEND · SHIFT + ENTER FOR NEW LINE · LOCAL ONLY
        </p>
      </div>
    </div>
  );
}
