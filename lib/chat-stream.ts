import type {
  ChatMessage,
  ChatSettings,
  GenerationMetrics,
} from "@/lib/types";

type StreamChunk = {
  message?: {
    content?: unknown;
  };
  error?: unknown;
  done?: unknown;
  done_reason?: unknown;
  total_duration?: unknown;
  load_duration?: unknown;
  prompt_eval_count?: unknown;
  prompt_eval_duration?: unknown;
  eval_count?: unknown;
  eval_duration?: unknown;
};

export async function readErrorMessage(response: Response) {
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

type StreamChatOptions = {
  model: string;
  messages: ChatMessage[];
  settings: Pick<ChatSettings, "temperature" | "top_p" | "num_ctx">;
  onContent: (content: string) => void;
  format?: "json" | Record<string, unknown>;
  signal?: AbortSignal;
};

export async function streamChat({
  model,
  messages,
  settings,
  onContent,
  format,
  signal,
}: StreamChatOptions) {
  const start = performance.now();
  let firstTokenTime: number | null = null;
  let metrics: GenerationMetrics = {
    totalDuration: null,
    loadDuration: null,
    promptEvalCount: null,
    promptEvalDuration: null,
    evalCount: null,
    evalDuration: null,
    tokensPerSecond: null,
    firstTokenTime: null,
    doneReason: null,
  };
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      options: {
        temperature: settings.temperature,
        top_p: settings.top_p,
        num_ctx: settings.num_ctx,
      },
      ...(format ? { format } : {}),
    }),
    signal,
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
    if (typeof nextContent === "string" && nextContent.length > 0) {
      if (firstTokenTime === null) {
        firstTokenTime = performance.now() - start;
      }
      onContent(nextContent);
    }

    if (chunk.done === true) {
      const evalCount =
        typeof chunk.eval_count === "number" ? chunk.eval_count : null;
      const evalDuration =
        typeof chunk.eval_duration === "number"
          ? chunk.eval_duration
          : null;

      metrics = {
        totalDuration:
          typeof chunk.total_duration === "number"
            ? chunk.total_duration
            : null,
        loadDuration:
          typeof chunk.load_duration === "number"
            ? chunk.load_duration
            : null,
        promptEvalCount:
          typeof chunk.prompt_eval_count === "number"
            ? chunk.prompt_eval_count
            : null,
        promptEvalDuration:
          typeof chunk.prompt_eval_duration === "number"
            ? chunk.prompt_eval_duration
            : null,
        evalCount,
        evalDuration,
        tokensPerSecond:
          evalCount !== null && evalDuration
            ? evalCount / (evalDuration / 1_000_000_000)
            : null,
        firstTokenTime,
        doneReason:
          typeof chunk.done_reason === "string" ? chunk.done_reason : null,
      };
    }
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
  return {
    responseTime: performance.now() - start,
    metrics,
  };
}
