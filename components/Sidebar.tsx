import { ModelSelector } from "@/components/ModelSelector";
import { SettingsPanel } from "@/components/SettingsPanel";
import { StatusBadge } from "@/components/StatusBadge";
import type {
  ConnectionStatus,
  ModelInfo,
} from "@/lib/types";

type SidebarProps = {
  models: ModelInfo[];
  selectedModel: string;
  temperature: number;
  topP: number;
  numCtx: number;
  systemPrompt: string;
  connectionStatus: ConnectionStatus;
  lastResponseTime: number | null;
  isLoading: boolean;
  hasMessages: boolean;
  onModelChange: (model: string) => void;
  onTemperatureChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onNumCtxChange: (value: number) => void;
  onSystemPromptChange: (value: string) => void;
  onClearChat: () => void;
};

export function Sidebar({
  models,
  selectedModel,
  temperature,
  topP,
  numCtx,
  systemPrompt,
  connectionStatus,
  lastResponseTime,
  isLoading,
  hasMessages,
  onModelChange,
  onTemperatureChange,
  onTopPChange,
  onNumCtxChange,
  onSystemPromptChange,
  onClearChat,
}: SidebarProps) {
  return (
    <aside className="border-b border-[var(--line)] bg-[var(--panel-muted)] md:w-[310px] md:shrink-0 md:border-r md:border-b-0">
      <div className="grid gap-6 p-5 sm:grid-cols-2 md:block md:h-full md:space-y-7 md:overflow-y-auto md:p-6">
        <ModelSelector
          models={models}
          selectedModel={selectedModel}
          disabled={connectionStatus === "checking" || isLoading}
          onChange={onModelChange}
        />

        <SettingsPanel
          temperature={temperature}
          topP={topP}
          numCtx={numCtx}
          systemPrompt={systemPrompt}
          disabled={isLoading}
          onTemperatureChange={onTemperatureChange}
          onTopPChange={onTopPChange}
          onNumCtxChange={onNumCtxChange}
          onSystemPromptChange={onSystemPromptChange}
        />

        <div className="space-y-3 sm:col-span-2">
          <button
            type="button"
            disabled={!hasMessages || isLoading}
            onClick={onClearChat}
            className="h-10 w-full rounded-xl border border-[var(--line)] bg-transparent text-sm font-medium text-[var(--ink-secondary)] transition hover:border-[var(--ink-secondary)] hover:bg-white hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear chat
          </button>

          <div className="rounded-xl border border-[var(--line)] bg-white/55 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[11px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                Runtime
              </span>
              <StatusBadge status={connectionStatus} compact />
            </div>
            <div className="mt-3 flex items-end justify-between gap-3">
              <span className="text-xs text-[var(--ink-secondary)]">
                Last response
              </span>
              <span className="font-mono text-sm font-medium">
                {lastResponseTime === null
                  ? "--"
                  : `${(lastResponseTime / 1000).toFixed(2)}s`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
