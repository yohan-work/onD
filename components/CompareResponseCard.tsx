import type { ModelResponse } from "@/lib/types";
import { MarkdownContent } from "@/components/MarkdownContent";

type CompareResponseCardProps = {
  response: ModelResponse;
  retryDisabled: boolean;
  onRetry: () => void;
};

const STATUS_LABELS: Record<ModelResponse["status"], string> = {
  queued: "Queued",
  streaming: "Generating",
  completed: "Completed",
  error: "Failed",
};

export function CompareResponseCard({
  response,
  retryDisabled,
  onRetry,
}: CompareResponseCardProps) {
  const isActive =
    response.status === "queued" || response.status === "streaming";

  return (
    <article className="flex min-h-56 min-w-0 flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel-muted)]/60 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-mono text-xs font-semibold text-[var(--ink)]">
            {response.model}
          </p>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
            Local agent
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`text-[10px] font-semibold uppercase tracking-[0.1em] ${
              response.status === "error"
                ? "text-[var(--error)]"
                : response.status === "completed"
                  ? "text-[var(--success)]"
                  : "text-[var(--accent)]"
            }`}
          >
            {STATUS_LABELS[response.status]}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--ink-muted)]">
            {response.responseTime === null
              ? "--"
              : `${(response.responseTime / 1000).toFixed(2)}s`}
          </p>
        </div>
      </header>

      <div className="flex flex-1 flex-col p-4">
        {response.content ? (
          <div className="text-sm leading-7 break-words text-[var(--ink)]">
            <MarkdownContent content={response.content} />
          </div>
        ) : isActive ? (
          <span
            className="inline-flex h-7 items-center gap-1.5"
            aria-label={`${response.model} is generating`}
          >
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            <span className="thinking-dot h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          </span>
        ) : null}

        {response.error ? (
          <div className="mt-auto pt-4">
            <p className="rounded-lg bg-[var(--error-soft)] px-3 py-2 text-xs leading-5 text-[var(--error)]">
              {response.error}
            </p>
            <button
              type="button"
              disabled={retryDisabled}
              onClick={onRetry}
              className="mt-3 h-9 rounded-lg border border-[var(--error)]/30 px-3 text-xs font-medium text-[var(--error)] transition hover:bg-[var(--error-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Retry this model
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}
