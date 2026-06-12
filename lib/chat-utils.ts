import { buildAttachmentContext } from "@/lib/attachments";
import { DEFAULT_MODEL } from "@/lib/constants";
import type {
  ChatMessage,
  CompareTurn,
  ModelInfo,
  StoredMessage,
  TextAttachment,
} from "@/lib/types";

export function chooseModel(models: ModelInfo[], preferredModel: string) {
  if (models.some((model) => model.name === preferredModel)) {
    return preferredModel;
  }
  if (models.some((model) => model.name === DEFAULT_MODEL)) {
    return DEFAULT_MODEL;
  }
  return models[0]?.name ?? "";
}

export function chooseCompareModels(
  models: ModelInfo[],
  preferredModels: string[],
) {
  const availableNames = models.map((model) => model.name);
  const selected = preferredModels
    .filter(
      (model, index) =>
        availableNames.includes(model) &&
        preferredModels.indexOf(model) === index,
    )
    .slice(0, 4);

  for (const model of availableNames) {
    if (selected.length >= 2) break;
    if (!selected.includes(model)) selected.push(model);
  }
  return selected;
}

export function buildCompareMessages(
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
    if (turn.id === turnId) break;
    const previousResponse = turn.responses.find(
      (response) => response.model === model,
    );
    if (previousResponse?.status === "completed" && previousResponse.content) {
      messages.push({ role: "assistant", content: previousResponse.content });
    }
  }
  return messages;
}

export function createStoredMessage(
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

export function createCompareTurn(prompt: string, models: string[]): CompareTurn {
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

export function titleFromContent(content: string) {
  const compact = content.replace(/\s+/g, " ").trim();
  return compact.length > 42 ? `${compact.slice(0, 42)}…` : compact || "New chat";
}

export function toRequestMessage(message: StoredMessage): ChatMessage {
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
}

export async function readApiError(response: Response) {
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
    // Use the stable fallback below.
  }
  return "The selected model failed to respond. Please check the model name or Ollama logs.";
}

export function downloadText(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
