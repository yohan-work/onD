"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { BenchmarkLab } from "@/components/BenchmarkLab";
import { ChatWindow } from "@/components/ChatWindow";
import { CompareWindow } from "@/components/CompareWindow";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { useCompareChat } from "@/hooks/use-compare-chat";
import { useConversations } from "@/hooks/use-conversations";
import { useOllamaModels } from "@/hooks/use-ollama-models";
import { useSingleChat } from "@/hooks/use-single-chat";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { loadSettings, saveSettings } from "@/lib/storage";
import type { ChatMode, ChatSettings } from "@/lib/types";

export default function Home() {
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [isHydrated, setIsHydrated] = useState(false);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      await Promise.resolve();
      if (!active) return;
      setSettings(loadSettings());
      hasHydratedRef.current = true;
      setIsHydrated(true);
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (hasHydratedRef.current) {
      saveSettings(settings);
    }
  }, [settings]);

  const updateSetting = useCallback(
    <Key extends keyof ChatSettings>(
      key: Key,
      value: ChatSettings[Key],
    ) => {
      setSettings((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const ollama = useOllamaModels({ setSettings, enabled: isHydrated });
  const conversations = useConversations({
    settings,
    setSettings,
    isLoading: false,
  });
  const single = useSingleChat({
    settings,
    conversations,
    setConnectionStatus: ollama.setConnectionStatus,
  });
  const compare = useCompareChat({
    settings,
    setConnectionStatus: ollama.setConnectionStatus,
  });
  const isLoading = single.isLoading || compare.isLoading;

  const changeMode = useCallback(
    (mode: ChatMode) => {
      if (!isLoading) {
        updateSetting("mode", mode);
      }
    },
    [isLoading, updateSetting],
  );

  const startNewConversation = useCallback(() => {
    conversations.startNew();
    single.setInput("");
    single.setAttachments([]);
    single.setAttachmentError(null);
  }, [conversations, single]);

  const selectConversation = useCallback(
    (id: string) => {
      conversations.select(id);
      single.setInput("");
      single.setAttachments([]);
      single.setAttachmentError(null);
    },
    [conversations, single],
  );

  const createBenchmarkFromConversation = conversations.createBenchmark;
  const createBenchmark = useCallback(
    async (
      conversation: Parameters<typeof createBenchmarkFromConversation>[0],
    ) => {
      if (await createBenchmarkFromConversation(conversation)) {
        updateSetting("mode", "lab");
      }
    },
    [createBenchmarkFromConversation, updateSetting],
  );

  const clearCurrentChat = useCallback(async () => {
    if (settings.mode === "single") {
      single.setInput("");
      await conversations.clear();
    } else {
      compare.clear();
    }
  }, [compare, conversations, settings.mode, single]);

  const singleError =
    single.error ?? conversations.error ?? ollama.error;
  const compareError = compare.error ?? ollama.error;

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1800px] flex-col bg-[var(--panel)] shadow-2xl shadow-black/5 md:h-dvh md:min-h-0">
      <Header
        connectionStatus={ollama.connectionStatus}
        selectedModel={settings.model}
        mode={settings.mode}
        compareModelCount={settings.compareModels.length}
        disabled={isLoading}
        onModeChange={changeMode}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {settings.mode !== "lab" ? (
          <Sidebar
            mode={settings.mode}
            models={ollama.models}
            selectedModel={settings.model}
            selectedModels={settings.compareModels}
            temperature={settings.temperature}
            topP={settings.top_p}
            numCtx={settings.num_ctx}
            systemPrompt={settings.systemPrompt}
            connectionStatus={ollama.connectionStatus}
            lastResponseTime={single.lastResponseTime}
            isLoading={isLoading}
            hasMessages={
              settings.mode === "single"
                ? conversations.messages.length > 0
                : compare.turns.length > 0
            }
            conversations={conversations.visibleConversations}
            activeConversationId={conversations.activeId}
            conversationQuery={conversations.query}
            onConversationQueryChange={conversations.setQuery}
            onNewConversation={startNewConversation}
            onSelectConversation={selectConversation}
            onRenameConversation={conversations.rename}
            onToggleFavorite={conversations.toggleFavorite}
            onExportConversation={conversations.exportConversation}
            onCreateBenchmark={createBenchmark}
            onDeleteConversation={conversations.remove}
            onRefreshModels={() => void ollama.refresh()}
            onModelChange={(value) => updateSetting("model", value)}
            onModelsChange={(value) => updateSetting("compareModels", value)}
            onTemperatureChange={(value) =>
              updateSetting("temperature", value)
            }
            onTopPChange={(value) => updateSetting("top_p", value)}
            onNumCtxChange={(value) => updateSetting("num_ctx", value)}
            onSystemPromptChange={(value) =>
              updateSetting("systemPrompt", value)
            }
            onClearChat={clearCurrentChat}
          />
        ) : null}

        {settings.mode === "single" ? (
          <ChatWindow
            messages={conversations.messages}
            input={single.input}
            selectedModel={settings.model}
            isLoading={single.isLoading}
            error={singleError}
            attachments={single.attachments}
            attachmentError={single.attachmentError}
            contextPlan={single.draftPlan}
            onInputChange={single.setInput}
            onSubmit={single.submit}
            onStop={single.stop}
            onRetry={single.retry}
            onContinue={single.continueResponse}
            onBranch={single.branch}
            onAttachmentsChange={single.setAttachments}
            onAttachmentError={single.setAttachmentError}
          />
        ) : settings.mode === "compare" ? (
          <CompareWindow
            turns={compare.turns}
            input={compare.input}
            selectedModelCount={settings.compareModels.length}
            isLoading={compare.isLoading}
            error={compareError}
            onInputChange={compare.setInput}
            onSubmit={compare.submit}
            onRetry={compare.retry}
          />
        ) : (
          <BenchmarkLab
            models={ollama.models}
            settings={settings}
            judgeModel={settings.judgeModel}
            onJudgeModelChange={(model) =>
              updateSetting("judgeModel", model)
            }
          />
        )}
      </div>
    </div>
  );
}
