"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatWindow } from "@/components/ChatWindow";
import { CompareWindow } from "@/components/CompareWindow";
import { Header } from "@/components/Header";
import { BenchmarkLab } from "@/components/BenchmarkLab";
import { Sidebar } from "@/components/Sidebar";
import { streamChat } from "@/lib/chat-stream";
import { buildAttachmentContext, estimateTokens } from "@/lib/attachments";
import { saveSuite } from "@/lib/benchmark-db";
import { DEFAULT_MODEL, DEFAULT_SETTINGS } from "@/lib/constants";
import {
  conversationToMarkdown,
  deleteConversation,
  listConversations,
  saveConversation,
  searchConversations,
  sortConversations,
} from "@/lib/conversation-db";
import { loadSettings, saveSettings } from "@/lib/storage";
import type {
  ChatMessage,
  ChatMode,
  ChatSettings,
  CompareTurn,
  Conversation,
  ConnectionStatus,
  ModelInfo,
  ModelListResponse,
  ModelResponse,
  StoredMessage,
  TextAttachment,
} from "@/lib/types";

async function readErrorMessage(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "message" in payload &&
      typeof payload.message === "string"
    ) {
      return payload.message;
    }
  } catch {
    // Use the stable fallback below for non-JSON errors.
  }

  return "The selected model failed to respond. Please check the model name or Ollama logs.";
}

function chooseModel(models: ModelInfo[], preferredModel: string) {
  if (models.some((model) => model.name === preferredModel)) {
    return preferredModel;
  }

  if (models.some((model) => model.name === DEFAULT_MODEL)) {
    return DEFAULT_MODEL;
  }

  return models[0]?.name ?? "";
}

function chooseCompareModels(
  models: ModelInfo[],
  preferredModels: string[],
) {
  const availableNames = models.map((model) => model.name);
  const selected = preferredModels
    .filter((model, index) => {
      return availableNames.includes(model) && preferredModels.indexOf(model) === index;
    })
    .slice(0, 4);

  for (const model of availableNames) {
    if (selected.length >= 2) {
      break;
    }
    if (!selected.includes(model)) {
      selected.push(model);
    }
  }

  return selected;
}

function buildCompareMessages(
  turns: CompareTurn[],
  turnId: string,
  model: string,
  systemPrompt: string,
) {
  const messages: ChatMessage[] = [];
  if (systemPrompt.trim()) {
    messages.push({ role: "system", content: systemPrompt.trim() });
  }

  for (const turn of turns) {
    messages.push({ role: "user", content: turn.prompt });

    if (turn.id === turnId) {
      break;
    }

    const previousResponse = turn.responses.find(
      (response) => response.model === model,
    );
    if (
      previousResponse?.status === "completed" &&
      previousResponse.content
    ) {
      messages.push({
        role: "assistant",
        content: previousResponse.content,
      });
    }
  }

  return messages;
}

function createTurn(prompt: string, models: string[]): CompareTurn {
  return {
    id: crypto.randomUUID(),
    prompt,
    responses: models.map((model) => ({
      model,
      content: "",
      status: "queued",
      responseTime: null,
      error: null,
    })),
  };
}

function createStoredMessage(
  role: "user" | "assistant",
  content: string,
  status: StoredMessage["status"] = "complete",
  attachments?: TextAttachment[],
): StoredMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    status,
    createdAt: new Date().toISOString(),
    ...(attachments?.length ? { attachments } : {}),
  };
}

function titleFromContent(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 42)}…` : compact || "New chat";
}

function toRequestMessages(messages: StoredMessage[]): ChatMessage[] {
  return messages.map((message) => {
    const attachmentContext =
      message.role === "user"
        ? buildAttachmentContext(message.attachments ?? [])
        : "";
    return {
      role: message.role,
      content: attachmentContext
        ? `${message.content}\n\n${attachmentContext}`
        : message.content,
    };
  });
}

function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [singleMessages, setSingleMessages] = useState<StoredMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [conversationQuery, setConversationQuery] = useState("");
  const [attachments, setAttachments] = useState<TextAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [compareTurns, setCompareTurns] = useState<CompareTurn[]>([]);
  const [input, setInput] = useState("");
  const [isSingleLoading, setIsSingleLoading] = useState(false);
  const [isCompareLoading, setIsCompareLoading] = useState(false);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");
  const hasHydratedRef = useRef(false);
  const singleAbortRef = useRef<AbortController | null>(null);

  const isLoading = isSingleLoading || isCompareLoading;

  const refreshModels = useCallback(async () => {
    setConnectionStatus("checking");
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const payload = (await response.json()) as ModelListResponse;
      if (!Array.isArray(payload.models)) {
        throw new Error("Ollama returned an invalid model list.");
      }
      setModels(payload.models);
      setConnectionStatus("connected");
      setSettings((current) => ({
        ...current,
        model: chooseModel(payload.models, current.model),
        compareModels: chooseCompareModels(
          payload.models,
          current.compareModels,
        ),
      }));
      if (payload.models.length === 0) {
        setSingleError("No Ollama models found. Run `ollama pull <model>` first.");
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Ollama server is not running. Please start Ollama and try again.";
      setConnectionStatus("disconnected");
      setSingleError(message);
      setCompareError(message);
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    const storedSettings = loadSettings();

    async function initialize() {
      await Promise.resolve();
      if (!isActive) {
        return;
      }

      hasHydratedRef.current = true;
      setSettings(storedSettings);

      try {
        const [response, storedConversations] = await Promise.all([
          fetch("/api/models", { cache: "no-store" }),
          listConversations(),
        ]);
        if (!response.ok) throw new Error(await readErrorMessage(response));
        const payload = (await response.json()) as ModelListResponse;
        if (!Array.isArray(payload.models)) throw new Error("Ollama returned an invalid model list.");
        if (!isActive) {
          return;
        }

        setModels(payload.models);
        setConversations(sortConversations(storedConversations));
        setConnectionStatus("connected");

        if (payload.models.length === 0) {
          setSettings((current) => ({
            ...current,
            model: "",
            compareModels: [],
          }));
          setSingleError(
            "No Ollama models found. Please run `ollama pull gemma4:e4b` first.",
          );
          return;
        }

        setSettings((current) => ({
          ...current,
          model: chooseModel(payload.models, storedSettings.model),
          compareModels: chooseCompareModels(
            payload.models,
            storedSettings.compareModels,
          ),
        }));
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : "Ollama server is not running. Please start Ollama and try again.";
        setConnectionStatus("disconnected");
        setSingleError(message);
        setCompareError(message);
      }
    }

    void initialize();

    return () => {
      isActive = false;
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

  const updateCompareResponse = useCallback(
    (
      turnId: string,
      model: string,
      updater: (response: ModelResponse) => ModelResponse,
    ) => {
      setCompareTurns((current) =>
        current.map((turn) =>
          turn.id === turnId
            ? {
                ...turn,
                responses: turn.responses.map((response) =>
                  response.model === model ? updater(response) : response,
                ),
              }
            : turn,
        ),
      );
    },
    [],
  );

  const runCompareModel = useCallback(
    async (
      turnId: string,
      model: string,
      turns: CompareTurn[],
      activeSettings: ChatSettings,
    ) => {
      updateCompareResponse(turnId, model, (response) => ({
        ...response,
        content: "",
        status: "streaming",
        responseTime: null,
        error: null,
      }));

      try {
        const { responseTime, metrics } = await streamChat({
          model,
          messages: buildCompareMessages(
            turns,
            turnId,
            model,
            activeSettings.systemPrompt,
          ),
          settings: activeSettings,
          onContent: (content) => {
            updateCompareResponse(turnId, model, (response) => ({
              ...response,
              content: response.content + content,
            }));
          },
        });

        updateCompareResponse(turnId, model, (response) => ({
          ...response,
          status: "completed",
          responseTime,
          metrics,
        }));
        setConnectionStatus("connected");
      } catch (requestError) {
        updateCompareResponse(turnId, model, (response) => ({
          ...response,
          status: "error",
          error:
            requestError instanceof Error
              ? requestError.message
              : "This model failed to respond. Please try again.",
        }));
      }
    },
    [updateCompareResponse],
  );

  const commitConversation = useCallback(async (conversation: Conversation) => {
    setConversations((current) =>
      sortConversations([
        conversation,
        ...current.filter((candidate) => candidate.id !== conversation.id),
      ]),
    );
    await saveConversation(conversation);
  }, []);

  const runSingleGeneration = useCallback(
    async (
      baseMessages: StoredMessage[],
      seed: Conversation,
      requestOverride?: ChatMessage[],
    ) => {
      const assistant = createStoredMessage("assistant", "", "streaming");
      let workingMessages = [...baseMessages, assistant];
      let workingConversation: Conversation = {
        ...seed,
        model: settings.model,
        settings: {
          temperature: settings.temperature,
          top_p: settings.top_p,
          num_ctx: settings.num_ctx,
          systemPrompt: settings.systemPrompt,
        },
        messages: workingMessages,
        updatedAt: new Date().toISOString(),
      };
      const controller = new AbortController();
      singleAbortRef.current = controller;

      setActiveConversationId(workingConversation.id);
      setSingleMessages(workingMessages);
      setSingleError(null);
      setLastResponseTime(null);
      setIsSingleLoading(true);
      await commitConversation(workingConversation);

      const requestMessages = requestOverride ?? toRequestMessages(baseMessages);
      const messages: ChatMessage[] = settings.systemPrompt.trim()
        ? [
            { role: "system", content: settings.systemPrompt.trim() },
            ...requestMessages,
          ]
        : requestMessages;

      try {
        const { responseTime, metrics } = await streamChat({
          model: settings.model,
          messages,
          settings,
          signal: controller.signal,
          onContent: (nextContent) => {
            workingMessages = workingMessages.map((message) =>
              message.id === assistant.id
                ? { ...message, content: message.content + nextContent }
                : message,
            );
            setSingleMessages(workingMessages);
          },
        });
        workingMessages = workingMessages.map((message) =>
          message.id === assistant.id
            ? { ...message, status: "complete", metrics }
            : message,
        );
        setLastResponseTime(responseTime);
        setConnectionStatus("connected");
      } catch (error) {
        const wasStopped = controller.signal.aborted;
        workingMessages = workingMessages.map((message) =>
          message.id === assistant.id
            ? { ...message, status: wasStopped ? "stopped" : "error" }
            : message,
        );
        if (!wasStopped) {
          setSingleError(
            error instanceof Error
              ? error.message
              : "The selected model failed to respond. Please try again.",
          );
        }
      } finally {
        workingConversation = {
          ...workingConversation,
          messages: workingMessages,
          updatedAt: new Date().toISOString(),
        };
        setSingleMessages(workingMessages);
        await commitConversation(workingConversation);
        singleAbortRef.current = null;
        setIsSingleLoading(false);
      }
    },
    [commitConversation, settings],
  );

  const handleSingleSubmit = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading || !settings.model) {
      return;
    }
    const attachmentTokens = attachments.reduce(
      (total, attachment) => total + estimateTokens(attachment.content),
      estimateTokens(content),
    );
    if (attachmentTokens > settings.num_ctx * 0.8) {
      setAttachmentError(
        `The message and attachments use about ${attachmentTokens.toLocaleString()} tokens, which is too large for the selected context.`,
      );
      return;
    }

    const userMessage = createStoredMessage(
      "user",
      content,
      "complete",
      attachments,
    );
    const baseMessages = [...singleMessages, userMessage];
    const existing = conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
    const timestamp = new Date().toISOString();
    const seed: Conversation =
      existing ?? {
        id: crypto.randomUUID(),
        title: titleFromContent(content),
        mode: "single",
        model: settings.model,
        settings: {
          temperature: settings.temperature,
          top_p: settings.top_p,
          num_ctx: settings.num_ctx,
          systemPrompt: settings.systemPrompt,
        },
        messages: [],
        favorite: false,
        branch: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

    setInput("");
    setAttachments([]);
    setAttachmentError(null);
    await runSingleGeneration(baseMessages, seed);
  }, [
    activeConversationId,
    attachments,
    conversations,
    input,
    isLoading,
    runSingleGeneration,
    settings,
    singleMessages,
  ]);

  const stopSingleGeneration = useCallback(() => {
    singleAbortRef.current?.abort();
  }, []);

  const retrySingleMessage = useCallback(
    async (messageId: string) => {
      const index = singleMessages.findIndex((message) => message.id === messageId);
      const conversation = conversations.find(
        (candidate) => candidate.id === activeConversationId,
      );
      if (index < 0 || !conversation || isLoading) return;
      await runSingleGeneration(singleMessages.slice(0, index), conversation);
    },
    [
      activeConversationId,
      conversations,
      isLoading,
      runSingleGeneration,
      singleMessages,
    ],
  );

  const continueSingleMessage = useCallback(
    async (messageId: string) => {
      const index = singleMessages.findIndex((message) => message.id === messageId);
      const conversation = conversations.find(
        (candidate) => candidate.id === activeConversationId,
      );
      if (index < 0 || !conversation || isLoading) return;
      const base = singleMessages.slice(0, index + 1);
      await runSingleGeneration(base, conversation, [
        ...toRequestMessages(base),
        {
          role: "user",
          content:
            "Continue the previous response from where it ended. Do not repeat completed content.",
        },
      ]);
    },
    [
      activeConversationId,
      conversations,
      isLoading,
      runSingleGeneration,
      singleMessages,
    ],
  );

  const branchConversation = useCallback(
    async (messageId: string) => {
      const source = conversations.find(
        (conversation) => conversation.id === activeConversationId,
      );
      const index = singleMessages.findIndex((message) => message.id === messageId);
      if (!source || index < 0) return;
      const editedContent = window.prompt(
        "Edit the message for the new branch",
        singleMessages[index].content,
      )?.trim();
      if (!editedContent) return;
      const timestamp = new Date().toISOString();
      const branchMessages = singleMessages.slice(0, index + 1).map((message) =>
        message.id === messageId
          ? { ...message, content: editedContent, createdAt: timestamp }
          : message,
      );
      const branch: Conversation = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} · branch`,
        messages: branchMessages,
        favorite: false,
        branch: {
          sourceConversationId: source.id,
          sourceMessageId: messageId,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await commitConversation(branch);
      setActiveConversationId(branch.id);
      setSingleMessages(branch.messages);
    },
    [
      activeConversationId,
      commitConversation,
      conversations,
      singleMessages,
    ],
  );

  const handleCompareSubmit = useCallback(async () => {
    const content = input.trim();
    const selectedModels = settings.compareModels;
    if (
      !content ||
      isLoading ||
      selectedModels.length < 2 ||
      selectedModels.length > 4
    ) {
      return;
    }

    const turn = createTurn(content, selectedModels);
    const nextTurns = [...compareTurns, turn];

    setInput("");
    setCompareError(null);
    setCompareTurns(nextTurns);
    setIsCompareLoading(true);

    await Promise.allSettled(
      selectedModels.map((model) =>
        runCompareModel(turn.id, model, nextTurns, settings),
      ),
    );

    setIsCompareLoading(false);
  }, [compareTurns, input, isLoading, runCompareModel, settings]);

  const handleRetry = useCallback(
    async (turnId: string, model: string) => {
      if (isLoading) {
        return;
      }

      setCompareError(null);
      setIsCompareLoading(true);
      await runCompareModel(turnId, model, compareTurns, settings);
      setIsCompareLoading(false);
    },
    [compareTurns, isLoading, runCompareModel, settings],
  );

  const newConversation = useCallback(() => {
    setActiveConversationId(null);
    setSingleMessages([]);
    setInput("");
    setAttachments([]);
    setAttachmentError(null);
    setSingleError(null);
    setLastResponseTime(null);
  }, []);

  const selectConversation = useCallback(
    (id: string) => {
      const conversation = conversations.find((candidate) => candidate.id === id);
      if (!conversation || isLoading) return;
      setActiveConversationId(id);
      setSingleMessages(conversation.messages);
      setSettings((current) => ({
        ...current,
        model: conversation.model,
        ...conversation.settings,
      }));
      setInput("");
      setAttachments([]);
      setSingleError(null);
    },
    [conversations, isLoading],
  );

  const renameConversation = useCallback(
    async (conversation: Conversation) => {
      const title = window.prompt("Conversation title", conversation.title)?.trim();
      if (!title) return;
      await commitConversation({
        ...conversation,
        title,
        updatedAt: new Date().toISOString(),
      });
    },
    [commitConversation],
  );

  const toggleFavorite = useCallback(
    async (conversation: Conversation) => {
      await commitConversation({
        ...conversation,
        favorite: !conversation.favorite,
        updatedAt: new Date().toISOString(),
      });
    },
    [commitConversation],
  );

  const exportConversation = useCallback(
    (conversation: Conversation, format: "json" | "markdown") => {
      const safeTitle = conversation.title.replace(/[^\w가-힣-]+/g, "-");
      if (format === "json") {
        downloadText(
          `${safeTitle}.json`,
          JSON.stringify(conversation, null, 2),
          "application/json",
        );
        return;
      }
      downloadText(
        `${safeTitle}.md`,
        conversationToMarkdown(conversation),
        "text/markdown",
      );
    },
    [],
  );

  const removeConversation = useCallback(
    async (conversation: Conversation) => {
      if (!window.confirm(`Delete "${conversation.title}"?`)) return;
      await deleteConversation(conversation.id);
      setConversations((current) =>
        current.filter((candidate) => candidate.id !== conversation.id),
      );
      if (activeConversationId === conversation.id) {
        newConversation();
      }
    },
    [activeConversationId, newConversation],
  );

  const createBenchmarkFromConversation = useCallback(
    async (conversation: Conversation) => {
      const prompts = conversation.messages.filter(
        (message) => message.role === "user" && message.content.trim(),
      );
      if (prompts.length === 0) {
        setSingleError("This conversation has no user prompts to benchmark.");
        return;
      }
      const timestamp = new Date().toISOString();
      await saveSuite({
        id: crypto.randomUUID(),
        name: `${conversation.title} benchmark`,
        description: `Created from the saved conversation "${conversation.title}".`,
        createdAt: timestamp,
        updatedAt: timestamp,
        cases: prompts.map((message, index) => ({
          id: crypto.randomUUID(),
          title: titleFromContent(message.content) || `Prompt ${index + 1}`,
          prompt: message.content,
          category: "general",
        })),
      });
      updateSetting("mode", "lab");
      setInput("");
    },
    [updateSetting],
  );

  const clearCurrentChat = useCallback(async () => {
    setInput("");
    if (settings.mode === "single") {
      setSingleMessages([]);
      setSingleError(null);
      setLastResponseTime(null);
      const conversation = conversations.find(
        (candidate) => candidate.id === activeConversationId,
      );
      if (conversation) {
        await commitConversation({
          ...conversation,
          messages: [],
          updatedAt: new Date().toISOString(),
        });
      }
      return;
    }

    setCompareTurns([]);
    setCompareError(null);
  }, [
    activeConversationId,
    commitConversation,
    conversations,
    settings.mode,
  ]);

  const changeMode = useCallback(
    (mode: ChatMode) => {
      if (!isLoading) {
        updateSetting("mode", mode);
        setInput("");
      }
    },
    [isLoading, updateSetting],
  );

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1800px] flex-col bg-[var(--panel)] shadow-2xl shadow-black/5 md:h-dvh md:min-h-0">
      <Header
        connectionStatus={connectionStatus}
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
          models={models}
          selectedModel={settings.model}
          selectedModels={settings.compareModels}
          temperature={settings.temperature}
          topP={settings.top_p}
          numCtx={settings.num_ctx}
          systemPrompt={settings.systemPrompt}
          connectionStatus={connectionStatus}
          lastResponseTime={lastResponseTime}
          isLoading={isLoading}
          hasMessages={
            settings.mode === "single"
              ? singleMessages.length > 0
              : compareTurns.length > 0
          }
          conversations={searchConversations(conversations, conversationQuery)}
          activeConversationId={activeConversationId}
          conversationQuery={conversationQuery}
          onConversationQueryChange={setConversationQuery}
          onNewConversation={newConversation}
          onSelectConversation={selectConversation}
          onRenameConversation={renameConversation}
          onToggleFavorite={toggleFavorite}
          onExportConversation={exportConversation}
          onCreateBenchmark={createBenchmarkFromConversation}
          onDeleteConversation={removeConversation}
          onRefreshModels={() => void refreshModels()}
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
            messages={singleMessages}
            input={input}
            selectedModel={settings.model}
            isLoading={isSingleLoading}
            error={singleError}
            attachments={attachments}
            attachmentError={attachmentError}
            onInputChange={setInput}
            onSubmit={handleSingleSubmit}
            onStop={stopSingleGeneration}
            onRetry={retrySingleMessage}
            onContinue={continueSingleMessage}
            onBranch={branchConversation}
            onAttachmentsChange={setAttachments}
            onAttachmentError={setAttachmentError}
          />
        ) : settings.mode === "compare" ? (
          <CompareWindow
            turns={compareTurns}
            input={input}
            selectedModelCount={settings.compareModels.length}
            isLoading={isCompareLoading}
            error={compareError}
            onInputChange={setInput}
            onSubmit={handleCompareSubmit}
            onRetry={handleRetry}
          />
        ) : (
          <BenchmarkLab
            models={models}
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
