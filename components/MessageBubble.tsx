import type { ChatMessage } from "@/lib/types";

type MessageBubbleProps = {
  message: ChatMessage;
  isStreaming?: boolean;
};

export function MessageBubble({
  message,
  isStreaming = false,
}: MessageBubbleProps) {
  if (message.role === "user") {
    return (
      <article className="flex justify-end">
        <div className="max-w-[85%] rounded-[18px] rounded-br-md bg-[var(--accent)] px-4 py-3 text-[15px] leading-6 whitespace-pre-wrap text-white shadow-sm sm:max-w-[72%]">
          {message.content}
        </div>
      </article>
    );
  }

  return (
    <article className="grid grid-cols-[30px_minmax(0,1fr)] gap-3">
      <div className="mt-0.5 grid h-7 w-7 place-items-center rounded-lg border border-[var(--line)] bg-[var(--panel-muted)] font-mono text-[9px] font-semibold text-[var(--accent)]">
        AI
      </div>
      <div className="min-w-0 pt-0.5 text-[15px] leading-7 whitespace-pre-wrap break-words text-[var(--ink)]">
        {message.content ? (
          message.content
        ) : isStreaming ? (
          <span className="inline-flex h-7 items-center gap-1.5" aria-label="Generating">
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
        ) : null}
      </div>
    </article>
  );
}
