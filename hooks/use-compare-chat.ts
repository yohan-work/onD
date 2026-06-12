"use client";

import { useCallback, useState } from "react";

import {
  buildCompareMessages,
  createCompareTurn,
} from "@/lib/chat-utils";
import { streamChat } from "@/lib/chat-stream";
import type {
  ChatSettings,
  CompareTurn,
  ConnectionStatus,
  ModelResponse,
} from "@/lib/types";

type UseCompareChatOptions = {
  settings: ChatSettings;
  setConnectionStatus: (status: ConnectionStatus) => void;
};

export function useCompareChat({
  settings,
  setConnectionStatus,
}: UseCompareChatOptions) {
  const [turns, setTurns] = useState<CompareTurn[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateResponse = useCallback(
    (
      turnId: string,
      model: string,
      updater: (response: ModelResponse) => ModelResponse,
    ) => {
      setTurns((current) =>
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

  const runModel = useCallback(
    async (
      turnId: string,
      model: string,
      activeTurns: CompareTurn[],
    ) => {
      updateResponse(turnId, model, (response) => ({
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
            activeTurns,
            turnId,
            model,
            settings.systemPrompt,
          ),
          settings,
          onContent: (content) => {
            updateResponse(turnId, model, (response) => ({
              ...response,
              content: response.content + content,
            }));
          },
        });
        updateResponse(turnId, model, (response) => ({
          ...response,
          status: "completed",
          responseTime,
          metrics,
        }));
        setConnectionStatus("connected");
      } catch (requestError) {
        updateResponse(turnId, model, (response) => ({
          ...response,
          status: "error",
          error:
            requestError instanceof Error
              ? requestError.message
              : "This model failed to respond. Please try again.",
        }));
      }
    },
    [setConnectionStatus, settings, updateResponse],
  );

  const submit = useCallback(async () => {
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
    const turn = createCompareTurn(content, selectedModels);
    const nextTurns = [...turns, turn];
    setInput("");
    setError(null);
    setTurns(nextTurns);
    setIsLoading(true);
    await Promise.allSettled(
      selectedModels.map((model) => runModel(turn.id, model, nextTurns)),
    );
    setIsLoading(false);
  }, [input, isLoading, runModel, settings.compareModels, turns]);

  const retry = useCallback(
    async (turnId: string, model: string) => {
      if (isLoading) return;
      setError(null);
      setIsLoading(true);
      await runModel(turnId, model, turns);
      setIsLoading(false);
    },
    [isLoading, runModel, turns],
  );

  const clear = useCallback(() => {
    setInput("");
    setTurns([]);
    setError(null);
  }, []);

  return {
    turns,
    input,
    setInput,
    isLoading,
    error,
    submit,
    retry,
    clear,
  };
}
