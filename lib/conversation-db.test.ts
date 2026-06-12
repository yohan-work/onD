import "fake-indexeddb/auto";

import { beforeEach, describe, expect, it } from "vitest";

import {
  deleteConversation,
  listConversations,
  saveConversation,
  searchConversations,
} from "@/lib/conversation-db";
import { DATABASE_NAME, openDatabase, STORE_NAMES } from "@/lib/local-db";
import type { Conversation } from "@/lib/types";

function conversation(id = "one"): Conversation {
  return {
    id,
    title: "Local notes",
    mode: "single",
    model: "gemma",
    settings: {
      temperature: 0.7,
      top_p: 0.9,
      num_ctx: 4096,
      systemPrompt: "",
    },
    messages: [{
      id: "message",
      role: "user",
      content: "Explain quantization",
      status: "complete",
      createdAt: "2026-06-12T00:00:00.000Z",
    }],
    favorite: false,
    branch: null,
    createdAt: "2026-06-12T00:00:00.000Z",
    updatedAt: "2026-06-12T00:00:00.000Z",
  };
}

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DATABASE_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
});

describe("conversation repository", () => {
  it("saves and deletes after transactions complete", async () => {
    await saveConversation(conversation());
    expect(await listConversations()).toHaveLength(1);
    await deleteConversation("one");
    expect(await listConversations()).toEqual([]);
  });

  it("isolates malformed records instead of failing the whole load", async () => {
    await saveConversation(conversation());
    const database = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        STORE_NAMES.conversations,
        "readwrite",
      );
      transaction.objectStore(STORE_NAMES.conversations).put({
        id: "broken",
        title: 123,
      });
      transaction.oncomplete = () => {
        database.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });

    expect(await listConversations()).toEqual([conversation()]);
  });

  it("searches title and message content", () => {
    const records = [
      conversation(),
      {
        ...conversation("two"),
        title: "Coding",
        messages: [{
          ...conversation().messages[0],
          id: "typescript",
          content: "Write TypeScript",
        }],
      },
    ];

    expect(searchConversations(records, "quantization")).toHaveLength(1);
    expect(searchConversations(records, "coding")[0].id).toBe("two");
  });
});
