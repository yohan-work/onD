import type { ModelInfo } from "@/lib/types";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";

type OllamaTagsResponse = {
  models?: Array<{
    name?: unknown;
    modified_at?: unknown;
    size?: unknown;
  }>;
};

export function getOllamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(
    /\/+$/,
    "",
  );
}

export function normalizeModels(payload: OllamaTagsResponse): ModelInfo[] {
  if (!Array.isArray(payload.models)) {
    return [];
  }

  return payload.models.flatMap((model) => {
    if (typeof model.name !== "string" || model.name.length === 0) {
      return [];
    }

    return [
      {
        name: model.name,
        ...(typeof model.modified_at === "string"
          ? { modified_at: model.modified_at }
          : {}),
        ...(typeof model.size === "number" ? { size: model.size } : {}),
      },
    ];
  });
}

export function ollamaConnectionErrorMessage() {
  return "Ollama server is not running. Please start Ollama and try again.";
}

export async function readOllamaError(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    // Fall through to a stable message when Ollama does not return JSON.
  }

  return "The selected model failed to respond. Please check the model name or Ollama logs.";
}
