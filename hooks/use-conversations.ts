"use client";

import { useCallback, useEffect, useState } from "react";

import { saveSuite } from "@/lib/benchmark-db";
import {
  downloadText,
  titleFromContent,
} from "@/lib/chat-utils";
import {
  conversationToMarkdown,
  deleteConversation,
  listConversations,
  saveConversation,
  searchConversations,
  sortConversations,
} from "@/lib/conversation-db";
import type {
  ChatSettings,
  Conversation,
  StoredMessage,
} from "@/lib/types";

type UseConversationsOptions = {
  settings: ChatSettings;
  setSettings: React.Dispatch<React.SetStateAction<ChatSettings>>;
  isLoading: boolean;
};

export function useConversations({
  settings,
  setSettings,
  isLoading,
}: UseConversationsOptions) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    listConversations()
      .then((records) => {
        if (active) setConversations(sortConversations(records));
      })
      .catch((loadError) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Could not load saved conversations.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback(async (conversation: Conversation) => {
    setConversations((current) =>
      sortConversations([
        conversation,
        ...current.filter((candidate) => candidate.id !== conversation.id),
      ]),
    );
    try {
      await saveConversation(conversation);
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save the conversation.",
      );
      throw saveError;
    }
  }, []);

  const startNew = useCallback(() => {
    setActiveId(null);
    setMessages([]);
    setError(null);
  }, []);

  const select = useCallback(
    (id: string) => {
      const conversation = conversations.find((candidate) => candidate.id === id);
      if (!conversation || isLoading) return;
      setActiveId(id);
      setMessages(conversation.messages);
      setSettings((current) => ({
        ...current,
        model: conversation.model,
        ...conversation.settings,
      }));
      setError(null);
    },
    [conversations, isLoading, setSettings],
  );

  const rename = useCallback(
    async (conversation: Conversation) => {
      const title = window.prompt("Conversation title", conversation.title)?.trim();
      if (!title) return;
      await commit({
        ...conversation,
        title,
        updatedAt: new Date().toISOString(),
      });
    },
    [commit],
  );

  const toggleFavorite = useCallback(
    async (conversation: Conversation) => {
      await commit({
        ...conversation,
        favorite: !conversation.favorite,
        updatedAt: new Date().toISOString(),
      });
    },
    [commit],
  );

  const exportConversation = useCallback(
    (conversation: Conversation, format: "json" | "markdown") => {
      const safeTitle = conversation.title.replace(/[^\w가-힣-]+/g, "-");
      if (format === "json") {
        downloadText(
          `${safeTitle}.json`,
          JSON.stringify(conversation, null, 2),
          "application/json",
        );
      } else {
        downloadText(
          `${safeTitle}.md`,
          conversationToMarkdown(conversation),
          "text/markdown",
        );
      }
    },
    [],
  );

  const remove = useCallback(
    async (conversation: Conversation) => {
      if (!window.confirm(`Delete "${conversation.title}"?`)) return;
      await deleteConversation(conversation.id);
      setConversations((current) =>
        current.filter((candidate) => candidate.id !== conversation.id),
      );
      if (activeId === conversation.id) startNew();
    },
    [activeId, startNew],
  );

  const createBenchmark = useCallback(
    async (conversation: Conversation) => {
      const prompts = conversation.messages.filter(
        (message) => message.role === "user" && message.content.trim(),
      );
      if (prompts.length === 0) {
        setError("This conversation has no user prompts to benchmark.");
        return false;
      }
      const timestamp = new Date().toISOString();
      await saveSuite({
        id: crypto.randomUUID(),
        name: `${conversation.title} benchmark`,
        description: `Created from the saved conversation "${conversation.title}".`,
        createdAt: timestamp,
        updatedAt: timestamp,
        cases: prompts.map((message, index) => ({
          id: crypto.randomUUID(),
          title: titleFromContent(message.content) || `Prompt ${index + 1}`,
          prompt: message.content,
          category: "general",
        })),
      });
      return true;
    },
    [],
  );

  const clear = useCallback(async () => {
    setMessages([]);
    const conversation = conversations.find(
      (candidate) => candidate.id === activeId,
    );
    if (conversation) {
      await commit({
        ...conversation,
        messages: [],
        updatedAt: new Date().toISOString(),
      });
    }
  }, [activeId, commit, conversations]);

  return {
    conversations,
    visibleConversations: searchConversations(conversations, query),
    activeId,
    setActiveId,
    activeConversation:
      conversations.find((conversation) => conversation.id === activeId) ?? null,
    messages,
    setMessages,
    query,
    setQuery,
    error,
    setError,
    commit,
    startNew,
    select,
    rename,
    toggleFavorite,
    exportConversation,
    remove,
    createBenchmark,
    clear,
    settings,
  };
}
