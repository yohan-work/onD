import type { ModelInfo } from "@/lib/types";

const MIN_MODELS = 2;
const MAX_MODELS = 4;

type MultiModelSelectorProps = {
  models: ModelInfo[];
  selectedModels: string[];
  disabled: boolean;
  onChange: (models: string[]) => void;
};

export function MultiModelSelector({
  models,
  selectedModels,
  disabled,
  onChange,
}: MultiModelSelectorProps) {
  const selectionIsValid =
    selectedModels.length >= MIN_MODELS &&
    selectedModels.length <= MAX_MODELS;

  return (
    <fieldset disabled={disabled} className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <legend className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-secondary)]">
          Compare models
        </legend>
        <span
          className={`font-mono text-[9px] ${
            selectionIsValid
              ? "text-[var(--accent)]"
              : "text-[var(--error)]"
          }`}
        >
          {selectedModels.length} / {MAX_MODELS}
        </span>
      </div>

      <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-[var(--line)] bg-white p-1">
        {models.map((model) => {
          const isSelected = selectedModels.includes(model.name);
          const selectionFull =
            selectedModels.length >= MAX_MODELS && !isSelected;

          return (
            <label
              key={model.name}
              className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition ${
                selectionFull
                  ? "cursor-not-allowed text-[var(--ink-muted)]"
                  : "cursor-pointer hover:bg-[var(--panel-muted)]"
              }`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={disabled || selectionFull}
                onChange={(event) => {
                  onChange(
                    event.target.checked
                      ? [...selectedModels, model.name]
                      : selectedModels.filter((name) => name !== model.name),
                  );
                }}
                className="h-3 w-3 accent-[var(--accent)]"
              />
              <span className="min-w-0 truncate font-mono">{model.name}</span>
            </label>
          );
        })}
      </div>

      <p
        className={`mt-1.5 text-[10px] leading-4 ${
          selectionIsValid
            ? "text-[var(--ink-muted)]"
            : "text-[var(--error)]"
        }`}
      >
        Select 2 to 4 models. Requests run at the same time.
      </p>
    </fieldset>
  );
}
