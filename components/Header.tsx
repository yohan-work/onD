import { StatusBadge } from "@/components/StatusBadge";
import type { ConnectionStatus } from "@/lib/types";

type HeaderProps = {
  connectionStatus: ConnectionStatus;
  selectedModel: string;
};

export function Header({
  connectionStatus,
  selectedModel,
}: HeaderProps) {
  return (
    <header className="flex min-h-20 shrink-0 items-center justify-between gap-5 border-b border-[var(--line)] bg-[var(--panel)] px-5 py-4 md:px-7">
      <div className="flex min-w-0 items-center gap-3.5">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent)] font-mono text-sm font-semibold text-white shadow-sm">
          OL
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-3">
            <h1 className="truncate text-[17px] font-semibold tracking-[-0.02em]">
              Ollama Chat Lab
            </h1>
            <span className="hidden text-xs text-[var(--ink-muted)] sm:inline">
              Local LLM playground
            </span>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--ink-secondary)]">
            LOCAL / {selectedModel || "NO MODEL"}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={connectionStatus} />
        {selectedModel ? (
          <span className="hidden max-w-52 truncate rounded-full bg-[var(--panel-muted)] px-3 py-1.5 font-mono text-xs text-[var(--ink-secondary)] lg:inline">
            {selectedModel}
          </span>
        ) : null}
      </div>
    </header>
  );
}
