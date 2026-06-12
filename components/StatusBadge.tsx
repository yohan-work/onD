import type { ConnectionStatus } from "@/lib/types";

type StatusBadgeProps = {
  status: ConnectionStatus;
  compact?: boolean;
};

const STATUS_CONTENT: Record<
  ConnectionStatus,
  { label: string; dotClassName: string }
> = {
  checking: {
    label: "Checking...",
    dotClassName: "bg-amber-500",
  },
  connected: {
    label: "Connected",
    dotClassName: "bg-[var(--success)]",
  },
  disconnected: {
    label: "Ollama not running",
    dotClassName: "bg-[var(--error)]",
  },
};

export function StatusBadge({
  status,
  compact = false,
}: StatusBadgeProps) {
  const content = STATUS_CONTENT[status];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] bg-white/75 px-2 py-1 text-[10px] font-medium text-[var(--ink-secondary)]"
      title={content.label}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${content.dotClassName} ${
          status === "checking" ? "animate-pulse" : ""
        }`}
      />
      {compact ? (
        <span className="sr-only">{content.label}</span>
      ) : (
        content.label
      )}
    </span>
  );
}
