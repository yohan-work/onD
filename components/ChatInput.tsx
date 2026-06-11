import { useEffect, useRef } from "react";

type ChatInputProps = {
  value: string;
  selectedModel: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function ChatInput({
  value,
  selectedModel,
  disabled,
  onChange,
  onSubmit,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
        <div className="flex items-end gap-3 rounded-[20px] border border-[var(--line)] bg-white p-2.5 pl-4 shadow-[var(--shadow)] transition focus-within:border-[var(--accent)] focus-within:ring-3 focus-within:ring-[var(--accent-soft)]">
          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            disabled={disabled}
            aria-label="Chat message"
            placeholder={
              selectedModel
                ? `Message ${selectedModel}...`
                : "Select a model to start..."
            }
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
            disabled={!canSubmit}
            onClick={onSubmit}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--ink)] text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--line)] disabled:text-[var(--ink-muted)]"
            aria-label="Send message"
          >
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
          </button>
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-[var(--ink-muted)]">
          ENTER TO SEND · SHIFT + ENTER FOR NEW LINE · LOCAL ONLY
        </p>
      </div>
    </div>
  );
}
