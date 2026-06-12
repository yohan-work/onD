import { STORE_NAMES, withStore } from "@/lib/local-db";
import type { Conversation } from "@/lib/types";

const STORE = STORE_NAMES.conversations;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isConversation(value: unknown): value is Conversation {
  if (!isRecord(value) || !isRecord(value.settings)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    value.mode === "single" &&
    typeof value.model === "string" &&
    typeof value.favorite === "boolean" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    Array.isArray(value.messages) &&
    value.messages.every(
      (message) =>
        isRecord(message) &&
        typeof message.id === "string" &&
        (message.role === "user" || message.role === "assistant") &&
        typeof message.content === "string" &&
        typeof message.createdAt === "string" &&
        (message.status === "complete" ||
          message.status === "streaming" ||
          message.status === "stopped" ||
          message.status === "error"),
    ) &&
    typeof value.settings.temperature === "number" &&
    typeof value.settings.top_p === "number" &&
    typeof value.settings.num_ctx === "number" &&
    typeof value.settings.systemPrompt === "string"
  );
}

export async function listConversations() {
  const records = await withStore<unknown[]>(STORE, "readonly", (store) =>
    store.getAll(),
  );
  return records.filter(isConversation);
}

export function saveConversation(conversation: Conversation) {
  return withStore<IDBValidKey>(STORE, "readwrite", (store) =>
    store.put(conversation),
  );
}

export function deleteConversation(id: string) {
  return withStore<undefined>(STORE, "readwrite", (store) =>
    store.delete(id),
  );
}

export function sortConversations(conversations: Conversation[]) {
  return conversations.toSorted((a, b) => {
    if (a.favorite !== b.favorite) {
      return a.favorite ? -1 : 1;
    }
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function searchConversations(
  conversations: Conversation[],
  query: string,
) {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) {
    return sortConversations(conversations);
  }

  return sortConversations(
    conversations.filter(
      (conversation) =>
        conversation.title.toLocaleLowerCase().includes(normalized) ||
        conversation.messages.some((message) =>
          message.content.toLocaleLowerCase().includes(normalized),
        ),
    ),
  );
}

export function conversationToMarkdown(conversation: Conversation) {
  const lines = [
    `# ${conversation.title}`,
    "",
    `- Model: ${conversation.model}`,
    `- Updated: ${conversation.updatedAt}`,
    "",
  ];

  for (const message of conversation.messages) {
    lines.push(
      `## ${message.role === "user" ? "User" : "Assistant"}`,
      "",
      message.content,
      "",
    );
    for (const attachment of message.attachments ?? []) {
      lines.push(`> Attachment: ${attachment.name} (${attachment.size} bytes)`, "");
    }
  }

  return lines.join("\n");
}
