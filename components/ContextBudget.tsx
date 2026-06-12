import type { ContextPlan } from "@/lib/types";

type ContextBudgetProps = {
  plan: ContextPlan;
};

export function ContextBudget({ plan }: ContextBudgetProps) {
  const ratio =
    plan.inputBudget > 0
      ? plan.estimatedInputTokens / plan.inputBudget
      : 0;
  const tone =
    plan.isOverBudget || ratio >= 0.9
      ? "error"
      : ratio >= 0.7
        ? "warning"
        : "normal";
  const barClass =
    tone === "error"
      ? "bg-[var(--error)]"
      : tone === "warning"
        ? "bg-amber-500"
        : "bg-[var(--accent)]";
  const textClass =
    tone === "error"
      ? "text-[var(--error)]"
      : tone === "warning"
        ? "text-amber-700"
        : "text-[var(--ink-muted)]";

  return (
    <div className="mb-2 rounded-xl border border-[var(--line)] bg-white/75 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className={`font-mono text-[10px] ${textClass}`}>
          Estimated context
        </span>
        <span className={`font-mono text-[10px] ${textClass}`}>
          {plan.estimatedInputTokens.toLocaleString()} /{" "}
          {plan.inputBudget.toLocaleString()} input tokens
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--panel-muted)]">
        <div
          className={`h-full rounded-full transition-[width] ${barClass}`}
          style={{ width: `${Math.min(100, ratio * 100)}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[9px] text-[var(--ink-muted)]">
        <span>system {plan.breakdown.system}</span>
        <span>history {plan.breakdown.history}</span>
        <span>input {plan.breakdown.input}</span>
        <span>files {plan.breakdown.attachments}</span>
        {plan.excludedTurns > 0 ? (
          <span className="text-amber-700">
            {plan.excludedTurns} earlier turn
            {plan.excludedTurns === 1 ? "" : "s"} excluded
          </span>
        ) : null}
      </div>
      {plan.isOverBudget ? (
        <p className="mt-1.5 text-[10px] leading-4 text-[var(--error)]">
          Reduce the system prompt or attachments, or choose a larger context.
        </p>
      ) : null}
    </div>
  );
}
