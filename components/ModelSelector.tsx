import type { ModelInfo } from "@/lib/types";

type ModelSelectorProps = {
  models: ModelInfo[];
  selectedModel: string;
  disabled: boolean;
  onChange: (model: string) => void;
};

export function ModelSelector({
  models,
  selectedModel,
  disabled,
  onChange,
}: ModelSelectorProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-secondary)]">
        Active model
      </span>
      <select
        value={selectedModel}
        disabled={disabled || models.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-mono text-sm text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:text-[var(--ink-muted)]"
      >
        {models.length === 0 ? (
          <option value={selectedModel}>
            {disabled ? "Loading models..." : "No models available"}
          </option>
        ) : (
          models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name}
            </option>
          ))
        )}
      </select>
    </label>
  );
}
