import { MarkdownContent } from "@/components/MarkdownContent";
import type { StoredMessage } from "@/lib/types";

type MessageBubbleProps = {
  message: StoredMessage;
  isStreaming?: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onContinue?: () => void;
  onBranch?: () => void;
};

export function MessageBubble({
  message,
  isStreaming = false,
  onCopy,
  onRetry,
  onContinue,
  onBranch,
}: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <article className="flex justify-end">
        <div className="group max-w-[85%] sm:max-w-[72%]">
          <div className="rounded-[18px] rounded-br-md bg-[var(--accent)] px-4 py-3 text-[15px] leading-6 whitespace-pre-wrap text-white shadow-sm">
            {message.content}
            {(message.attachments ?? []).map((attachment) => (
              <span
                key={attachment.id}
                className="mt-2 block rounded-lg bg-white/10 px-2.5 py-1.5 font-mono text-[10px]"
              >
                {attachment.name}
              </span>
            ))}
          </div>
          {onBranch ? (
            <button
              type="button"
              onClick={onBranch}
              className="mt-1.5 float-right text-[10px] text-[var(--ink-muted)] opacity-0 transition hover:text-[var(--accent)] group-hover:opacity-100"
            >
              Edit & branch
            </button>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
      <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] bg-[var(--panel-muted)] font-mono text-[9px] font-semibold text-[var(--accent)]">
        AI
      </div>
      <div className="group min-w-0 pt-0.5 text-[15px] leading-7 break-words text-[var(--ink)]">
        {message.content ? (
          <MarkdownContent content={message.content} />
        ) : isStreaming ? (
          <span className="inline-flex h-7 items-center gap-1.5" aria-label="Generating">
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
        ) : null}
        {message.content ? (
          <div className="mt-2 flex gap-3 text-[10px] text-[var(--ink-muted)] opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <button type="button" onClick={onCopy} className="hover:text-[var(--accent)]">
              Copy
            </button>
            {onRetry ? (
              <button type="button" onClick={onRetry} className="hover:text-[var(--accent)]">
                Regenerate
              </button>
            ) : null}
            {onContinue ? (
              <button type="button" onClick={onContinue} className="hover:text-[var(--accent)]">
                Continue
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}
