import { CONTEXT_LENGTHS } from "@/lib/constants";

type SettingsPanelProps = {
  temperature: number;
  topP: number;
  numCtx: number;
  systemPrompt: string;
  disabled: boolean;
  onTemperatureChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onNumCtxChange: (value: number) => void;
  onSystemPromptChange: (value: string) => void;
};

type RangeSettingProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
};

function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: RangeSettingProps) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-xs text-[var(--ink-secondary)]">
        <span>{label}</span>
        <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[11px] text-[var(--ink)]">
          {value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

export function SettingsPanel({
  temperature,
  topP,
  numCtx,
  systemPrompt,
  disabled,
  onTemperatureChange,
  onTopPChange,
  onNumCtxChange,
  onSystemPromptChange,
}: SettingsPanelProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-secondary)]">
          Generation controls
        </h2>
        <span className="font-mono text-[10px] text-[var(--ink-muted)]">
          LIVE
        </span>
      </div>

      <RangeSetting
        label="Temperature"
        value={temperature}
        min={0}
        max={2}
        step={0.1}
        disabled={disabled}
        onChange={onTemperatureChange}
      />
      <RangeSetting
        label="Top P"
        value={topP}
        min={0}
        max={1}
        step={0.05}
        disabled={disabled}
        onChange={onTopPChange}
      />

      <label className="block">
        <span className="mb-2 block text-xs text-[var(--ink-secondary)]">
          Context length
        </span>
        <select
          value={numCtx}
          disabled={disabled}
          onChange={(event) => onNumCtxChange(Number(event.target.value))}
          className="h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-mono text-xs outline-none transition focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed"
        >
          {CONTEXT_LENGTHS.map((length) => (
            <option key={length} value={length}>
              {length.toLocaleString()} tokens
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-2 flex items-center justify-between text-xs text-[var(--ink-secondary)]">
          <span>System prompt</span>
          <span className="font-mono text-[10px] text-[var(--ink-muted)]">
            OPTIONAL
          </span>
        </span>
        <textarea
          value={systemPrompt}
          disabled={disabled}
          rows={5}
          placeholder="Define how the model should respond..."
          onChange={(event) => onSystemPromptChange(event.target.value)}
          className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2.5 text-sm leading-6 outline-none transition placeholder:text-[var(--ink-muted)] focus:border-[var(--accent)] focus:ring-3 focus:ring-[var(--accent-soft)] disabled:cursor-not-allowed"
        />
      </label>
    </div>
  );
}
