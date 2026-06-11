"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChatWindow } from "@/components/ChatWindow";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { DEFAULT_MODEL, DEFAULT_SETTINGS } from "@/lib/constants";
import { loadSettings, saveSettings } from "@/lib/storage";
import type {
  ChatMessage,
  ChatSettings,
  ConnectionStatus,
  ModelInfo,
  ModelListResponse,
} from "@/lib/types";

type StreamChunk = {
  message?: {
    content?: unknown;
  };
  error?: unknown;
};

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

export default function Home() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");
  const hasHydratedRef = useRef(false);

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
          setSettings((current) => ({ ...current, model: "" }));
          setError(
            "No Ollama models found. Please run `ollama pull gemma4:e4b` first.",
          );
          return;
        }

        setSettings((current) => ({
          ...current,
          model: chooseModel(payload.models, storedSettings.model),
        }));
      } catch (loadError) {
        if (!isActive) {
          return;
        }

        setConnectionStatus("disconnected");
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Ollama server is not running. Please start Ollama and try again.",
        );
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

  const handleSubmit = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading || !settings.model) {
      return;
    }

    const userMessage: ChatMessage = { role: "user", content };
    const conversation = [...messages, userMessage];
    const requestMessages: ChatMessage[] = settings.systemPrompt.trim()
      ? [
          { role: "system", content: settings.systemPrompt.trim() },
          ...conversation,
        ]
      : conversation;
    const assistantIndex = conversation.length;

    setInput("");
    setError(null);
    setLastResponseTime(null);
    setIsLoading(true);
    setMessages([...conversation, { role: "assistant", content: "" }]);

    const start = performance.now();

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: settings.model,
          messages: requestMessages,
          options: {
            temperature: settings.temperature,
            top_p: settings.top_p,
            num_ctx: settings.num_ctx,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }

      if (!response.body) {
        throw new Error("Ollama returned an empty response stream.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const processLine = (line: string) => {
        const trimmedLine = line.trim();
        if (!trimmedLine) {
          return;
        }

        let chunk: StreamChunk;
        try {
          chunk = JSON.parse(trimmedLine) as StreamChunk;
        } catch {
          console.warn("Skipped malformed Ollama stream chunk.");
          return;
        }

        if (typeof chunk.error === "string") {
          throw new Error(chunk.error);
        }

        const nextContent = chunk.message?.content;
        if (typeof nextContent !== "string" || nextContent.length === 0) {
          return;
        }

        setMessages((current) =>
          current.map((message, index) =>
            index === assistantIndex
              ? { ...message, content: message.content + nextContent }
              : message,
          ),
        );
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(processLine);

        if (done) {
          break;
        }
      }

      processLine(buffer);
      setLastResponseTime(performance.now() - start);
      setConnectionStatus("connected");
    } catch (chatError) {
      setMessages((current) =>
        current.filter(
          (message, index) =>
            index !== assistantIndex || message.content.length > 0,
        ),
      );
      setError(
        chatError instanceof Error
          ? chatError.message
          : "The selected model failed to respond. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, settings]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setLastResponseTime(null);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1800px] flex-col bg-[var(--panel)] shadow-2xl shadow-black/5 md:h-dvh md:min-h-0">
      <Header
        connectionStatus={connectionStatus}
        selectedModel={settings.model}
      />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <Sidebar
          models={models}
          selectedModel={settings.model}
          temperature={settings.temperature}
          topP={settings.top_p}
          numCtx={settings.num_ctx}
          systemPrompt={settings.systemPrompt}
          connectionStatus={connectionStatus}
          lastResponseTime={lastResponseTime}
          isLoading={isLoading}
          hasMessages={messages.length > 0}
          onModelChange={(value) => updateSetting("model", value)}
          onTemperatureChange={(value) =>
            updateSetting("temperature", value)
          }
          onTopPChange={(value) => updateSetting("top_p", value)}
          onNumCtxChange={(value) => updateSetting("num_ctx", value)}
          onSystemPromptChange={(value) =>
            updateSetting("systemPrompt", value)
          }
          onClearChat={clearChat}
        />
        <ChatWindow
          messages={messages}
          input={input}
          selectedModel={settings.model}
          isLoading={isLoading}
          error={error}
          onInputChange={setInput}
          onSubmit={handleSubmit}
        />
      </div>
    </div>
  );
}
