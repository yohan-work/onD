"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatWindow } from "@/components/ChatWindow";
import { CompareWindow } from "@/components/CompareWindow";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { streamChat } from "@/lib/chat-stream";
import { DEFAULT_MODEL, DEFAULT_SETTINGS } from "@/lib/constants";
import { loadSettings, saveSettings } from "@/lib/storage";
import type {
  ChatMessage,
  ChatMode,
  ChatSettings,
  CompareTurn,
  ConnectionStatus,
  ModelInfo,
  ModelListResponse,
  ModelResponse,
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

export default function Home() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [singleMessages, setSingleMessages] = useState<ChatMessage[]>([]);
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

  const isLoading = isSingleLoading || isCompareLoading;

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
        const response = await fetch("/api/models", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(await readErrorMessage(response));
        }

        const payload = (await response.json()) as ModelListResponse;
        if (!Array.isArray(payload.models)) {
          throw new Error("Ollama returned an invalid model list.");
        }

        if (!isActive) {
          return;
        }

        setModels(payload.models);
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
        const responseTime = await streamChat({
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

  const handleSingleSubmit = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading || !settings.model) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content };
    const conversation = [...singleMessages, userMessage];
    const requestMessages: ChatMessage[] = settings.systemPrompt.trim()
      ? [
          { role: "system", content: settings.systemPrompt.trim() },
          ...conversation,
        ]
      : conversation;
    const assistantIndex = conversation.length;

    setInput("");
    setSingleError(null);
    setLastResponseTime(null);
    setIsSingleLoading(true);
    setSingleMessages([
      ...conversation,
      { role: "assistant", content: "" },
    ]);

    try {
      const responseTime = await streamChat({
        model: settings.model,
        messages: requestMessages,
        settings,
        onContent: (nextContent) => {
          setSingleMessages((current) =>
            current.map((message, index) =>
              index === assistantIndex
                ? { ...message, content: message.content + nextContent }
                : message,
            ),
          );
        },
      });

      setLastResponseTime(responseTime);
      setConnectionStatus("connected");
    } catch (chatError) {
      setSingleMessages((current) =>
        current.filter(
          (message, index) =>
            index !== assistantIndex || message.content.length > 0,
        ),
      );
      setSingleError(
        chatError instanceof Error
          ? chatError.message
          : "The selected model failed to respond. Please try again.",
      );
    } finally {
      setIsSingleLoading(false);
    }
  }, [input, isLoading, settings, singleMessages]);

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

  const clearCurrentChat = useCallback(() => {
    setInput("");
    if (settings.mode === "single") {
      setSingleMessages([]);
      setSingleError(null);
      setLastResponseTime(null);
      return;
    }

    setCompareTurns([]);
    setCompareError(null);
  }, [settings.mode]);

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

        {settings.mode === "single" ? (
          <ChatWindow
            messages={singleMessages}
            input={input}
            selectedModel={settings.model}
            isLoading={isSingleLoading}
            error={singleError}
            onInputChange={setInput}
            onSubmit={handleSingleSubmit}
          />
        ) : (
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
        )}
      </div>
    </div>
  );
}
