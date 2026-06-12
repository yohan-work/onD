import { ModelSelector } from "@/components/ModelSelector";
import { MultiModelSelector } from "@/components/MultiModelSelector";
import { SettingsPanel } from "@/components/SettingsPanel";
import { StatusBadge } from "@/components/StatusBadge";
import { ConversationLibrary } from "@/components/ConversationLibrary";
import type {
  ChatMode,
  Conversation,
  ConnectionStatus,
  ModelInfo,
} from "@/lib/types";

type SidebarProps = {
  mode: ChatMode;
  models: ModelInfo[];
  selectedModel: string;
  selectedModels: string[];
  temperature: number;
  topP: number;
  numCtx: number;
  systemPrompt: string;
  connectionStatus: ConnectionStatus;
  lastResponseTime: number | null;
  isLoading: boolean;
  hasMessages: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  conversationQuery: string;
  onConversationQueryChange: (query: string) => void;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
  onRenameConversation: (conversation: Conversation) => void;
  onToggleFavorite: (conversation: Conversation) => void;
  onExportConversation: (
    conversation: Conversation,
    format: "json" | "markdown",
  ) => void;
  onCreateBenchmark: (conversation: Conversation) => void;
  onDeleteConversation: (conversation: Conversation) => void;
  onRefreshModels: () => void;
  onModelChange: (model: string) => void;
  onModelsChange: (models: string[]) => void;
  onTemperatureChange: (value: number) => void;
  onTopPChange: (value: number) => void;
  onNumCtxChange: (value: number) => void;
  onSystemPromptChange: (value: string) => void;
  onClearChat: () => void;
};

export function Sidebar({
  mode,
  models,
  selectedModel,
  selectedModels,
  temperature,
  topP,
  numCtx,
  systemPrompt,
  connectionStatus,
  lastResponseTime,
  isLoading,
  hasMessages,
  conversations,
  activeConversationId,
  conversationQuery,
  onConversationQueryChange,
  onNewConversation,
  onSelectConversation,
  onRenameConversation,
  onToggleFavorite,
  onExportConversation,
  onCreateBenchmark,
  onDeleteConversation,
  onRefreshModels,
  onModelChange,
  onModelsChange,
  onTemperatureChange,
  onTopPChange,
  onNumCtxChange,
  onSystemPromptChange,
  onClearChat,
}: SidebarProps) {
  return (
    <aside className="border-b border-[var(--line)] bg-[var(--panel-muted)] md:w-[280px] md:shrink-0 md:border-r md:border-b-0">
      <div className="grid gap-4 p-4 sm:grid-cols-2 md:block md:h-full md:space-y-5 md:overflow-y-auto md:p-4">
        {mode === "single" ? (
          <ConversationLibrary
            conversations={conversations}
            activeId={activeConversationId}
            query={conversationQuery}
            disabled={isLoading}
            onQueryChange={onConversationQueryChange}
            onNew={onNewConversation}
            onSelect={onSelectConversation}
            onRename={onRenameConversation}
            onToggleFavorite={onToggleFavorite}
            onExport={onExportConversation}
            onCreateBenchmark={onCreateBenchmark}
            onDelete={onDeleteConversation}
          />
        ) : null}

        {mode === "single" ? (
          <div className="space-y-2">
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              disabled={connectionStatus === "checking" || isLoading}
              onChange={onModelChange}
            />
            <button
              type="button"
              disabled={connectionStatus === "checking" || isLoading}
              onClick={onRefreshModels}
              className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)] hover:text-[var(--accent)] disabled:opacity-40"
            >
              Refresh models
            </button>
          </div>
        ) : (
          <MultiModelSelector
            models={models}
            selectedModels={selectedModels}
            disabled={connectionStatus === "checking" || isLoading}
            onChange={onModelsChange}
          />
        )}

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

        <div className="space-y-2 sm:col-span-2">
          <button
            type="button"
            disabled={!hasMessages || isLoading}
            onClick={onClearChat}
            className="h-8 w-full rounded-lg border border-[var(--line)] bg-transparent text-xs font-medium text-[var(--ink-secondary)] transition hover:border-[var(--ink-secondary)] hover:bg-white hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear chat
          </button>

          <div className="rounded-lg border border-[var(--line)] bg-white/55 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
                Runtime
              </span>
              <StatusBadge status={connectionStatus} compact />
            </div>
            <div className="mt-2 flex items-end justify-between gap-2">
              <span className="text-[11px] text-[var(--ink-secondary)]">
                {mode === "single" ? "Last response" : "Response times"}
              </span>
              <span className="font-mono text-xs font-medium">
                {mode === "compare"
                  ? "Per card"
                  : lastResponseTime === null
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
