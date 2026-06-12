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
  const selected = models.find((model) => model.name === selectedModel);

  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-secondary)]">
        Active model
      </span>
      <select
        value={selectedModel}
        disabled={disabled || models.length === 0}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-lg border border-[var(--line)] bg-white px-2.5 font-mono text-xs text-[var(--ink)] outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed disabled:text-[var(--ink-muted)]"
      >
        {models.length === 0 ? (
          <option value={selectedModel}>
            {disabled ? "Loading models..." : "No models available"}
          </option>
        ) : (
          models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.loaded ? "● " : ""}
              {model.name}
              {model.parameterSize ? ` · ${model.parameterSize}` : ""}
            </option>
          ))
        )}
      </select>
      {selected ? (
        <span className="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[9px] text-[var(--ink-muted)]">
          <span>{selected.loaded ? "LOADED" : "INSTALLED"}</span>
          {selected.size ? (
            <span>{(selected.size / 1024 ** 3).toFixed(1)} GB</span>
          ) : null}
          {selected.quantizationLevel ? (
            <span>{selected.quantizationLevel}</span>
          ) : null}
          {selected.contextLength ? (
            <span>{selected.contextLength.toLocaleString()} ctx</span>
          ) : null}
        </span>
      ) : null}
    </label>
  );
}
