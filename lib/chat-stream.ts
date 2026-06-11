import type { ChatMessage, ChatSettings } from "@/lib/types";

type StreamChunk = {
  message?: {
    content?: unknown;
  };
  error?: unknown;
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
};

export async function streamChat({
  model,
  messages,
  settings,
  onContent,
}: StreamChatOptions) {
  const start = performance.now();
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
    if (typeof nextContent === "string" && nextContent.length > 0) {
      onContent(nextContent);
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
  return performance.now() - start;
}
