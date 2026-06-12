import { StatusBadge } from "@/components/StatusBadge";
import type { ChatMode, ConnectionStatus } from "@/lib/types";

type HeaderProps = {
  connectionStatus: ConnectionStatus;
  selectedModel: string;
  mode: ChatMode;
  compareModelCount: number;
  disabled: boolean;
  onModeChange: (mode: ChatMode) => void;
};

export function Header({
  connectionStatus,
  selectedModel,
  mode,
  compareModelCount,
  disabled,
  onModeChange,
}: HeaderProps) {
  const activeLabel =
    mode === "single"
      ? selectedModel || "NO MODEL"
      : mode === "compare"
        ? `${compareModelCount} MODELS`
        : "EVALUATION LAB";

  return (
    <header className="flex min-h-20 shrink-0 flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] bg-[var(--panel)] px-5 py-4 md:flex-nowrap md:px-7">
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
            LOCAL / {activeLabel}
          </p>
        </div>
      </div>

      <div className="order-3 flex w-full justify-center md:order-none md:w-auto">
        <div className="inline-flex rounded-xl border border-[var(--line)] bg-[var(--panel-muted)] p-1">
          {(["single", "compare", "lab"] as const).map((nextMode) => (
            <button
              key={nextMode}
              type="button"
              disabled={disabled}
              onClick={() => onModeChange(nextMode)}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition disabled:cursor-not-allowed ${
                mode === nextMode
                  ? "bg-white text-[var(--ink)] shadow-sm"
                  : "text-[var(--ink-secondary)] hover:text-[var(--ink)]"
              }`}
            >
              {nextMode === "single"
                ? "Chat"
                : nextMode === "compare"
                  ? "Multi Agent"
                  : "Benchmark"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge status={connectionStatus} />
        {activeLabel ? (
          <span className="hidden max-w-52 truncate rounded-full bg-[var(--panel-muted)] px-3 py-1.5 font-mono text-xs text-[var(--ink-secondary)] lg:inline">
            {activeLabel}
          </span>
        ) : null}
      </div>
    </header>
  );
}
