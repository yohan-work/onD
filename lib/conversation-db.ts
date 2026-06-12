import { STORE_NAMES, withStore } from "@/lib/local-db";
import type { Conversation } from "@/lib/types";

const STORE = STORE_NAMES.conversations;

export function listConversations() {
  return withStore<Conversation[]>(STORE, "readonly", (store) =>
    store.getAll(),
  );
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
