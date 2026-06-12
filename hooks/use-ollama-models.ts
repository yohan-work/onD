"use client";

import { useCallback, useEffect, useState } from "react";

import {
  chooseCompareModels,
  chooseModel,
  readApiError,
} from "@/lib/chat-utils";
import type {
  ChatSettings,
  ConnectionStatus,
  ModelInfo,
  ModelListResponse,
} from "@/lib/types";

type UseOllamaModelsOptions = {
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
  enabled: boolean;
};

export function useOllamaModels({
  setSettings,
  enabled,
}: UseOllamaModelsOptions) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("checking");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setConnectionStatus("checking");
    try {
      const response = await fetch("/api/models", { cache: "no-store" });
      if (!response.ok) throw new Error(await readApiError(response));
      const payload = (await response.json()) as ModelListResponse;
      if (!Array.isArray(payload.models)) {
        throw new Error("Ollama returned an invalid model list.");
      }

      setModels(payload.models);
      setConnectionStatus("connected");
      setError(
        payload.models.length === 0
          ? "No Ollama models found. Run `ollama pull <model>` first."
          : null,
      );
      setSettings((current) => ({
        ...current,
        model: chooseModel(payload.models, current.model),
        compareModels: chooseCompareModels(
          payload.models,
          current.compareModels,
        ),
      }));
    } catch (loadError) {
      setConnectionStatus("disconnected");
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Ollama server is not running. Please start Ollama and try again.",
      );
    }
  }, [setSettings]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    async function initialize() {
      await Promise.resolve();
      if (active) await refresh();
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [enabled, refresh]);

  return {
    models,
    connectionStatus,
    setConnectionStatus,
    error,
    refresh,
  };
}
