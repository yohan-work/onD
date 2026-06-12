"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import {
  createStoredMessage,
  titleFromContent,
} from "@/lib/chat-utils";
import {
  contextUsageSnapshot,
  planContext,
} from "@/lib/context-planner";
import { streamChat } from "@/lib/chat-stream";
import type {
  ChatMessage,
  ChatSettings,
  ContextPlan,
  Conversation,
  ConnectionStatus,
  StoredMessage,
  TextAttachment,
} from "@/lib/types";

type ConversationController = {
  conversations: Conversation[];
  activeId: string | null;
  activeConversation: Conversation | null;
  messages: StoredMessage[];
  setMessages: React.Dispatch<React.SetStateAction<StoredMessage[]>>;
  setActiveId: React.Dispatch<React.SetStateAction<string | null>>;
  commit: (conversation: Conversation) => Promise<void>;
};

type UseSingleChatOptions = {
  settings: ChatSettings;
  conversations: ConversationController;
  setConnectionStatus: (status: ConnectionStatus) => void;
};

function splitCurrentMessage(messages: StoredMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") {
      return {
        history: messages.slice(0, index),
        current: messages[index],
      };
    }
  }
  return null;
}

export function useSingleChat({
  settings,
  conversations,
  setConnectionStatus,
}: UseSingleChatOptions) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<TextAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const draftPlan = useMemo(
    () =>
      planContext({
        history: conversations.messages,
        current: {
          role: "user",
          content: input.trim(),
          attachments,
        },
        systemPrompt: settings.systemPrompt,
        numCtx: settings.num_ctx,
      }),
    [
      attachments,
      conversations.messages,
      input,
      settings.num_ctx,
      settings.systemPrompt,
    ],
  );

  const runGeneration = useCallback(
    async (
      displayBaseMessages: StoredMessage[],
      seed: Conversation,
      plan: ContextPlan,
    ) => {
      const assistant = {
        ...createStoredMessage("assistant", "", "streaming"),
        contextUsage: contextUsageSnapshot(plan),
      };
      let workingMessages = [...displayBaseMessages, assistant];
      let workingConversation: Conversation = {
        ...seed,
        model: settings.model,
        settings: {
          temperature: settings.temperature,
          top_p: settings.top_p,
          num_ctx: settings.num_ctx,
          systemPrompt: settings.systemPrompt,
        },
        messages: workingMessages,
        updatedAt: new Date().toISOString(),
      };
      const controller = new AbortController();
      abortRef.current = controller;

      conversations.setActiveId(workingConversation.id);
      conversations.setMessages(workingMessages);
      setError(null);
      setLastResponseTime(null);
      setIsLoading(true);
      await conversations.commit(workingConversation);

      try {
        const { responseTime, metrics } = await streamChat({
          model: settings.model,
          messages: plan.messages,
          settings,
          signal: controller.signal,
          onContent: (nextContent) => {
            workingMessages = workingMessages.map((message) =>
              message.id === assistant.id
                ? { ...message, content: message.content + nextContent }
                : message,
            );
            conversations.setMessages(workingMessages);
          },
        });
        workingMessages = workingMessages.map((message) =>
          message.id === assistant.id
            ? {
                ...message,
                status: "complete",
                metrics,
                contextUsage: message.contextUsage
                  ? {
                      ...message.contextUsage,
                      actualPromptTokens: metrics.promptEvalCount,
                    }
                  : undefined,
              }
            : message,
        );
        setLastResponseTime(responseTime);
        setConnectionStatus("connected");
      } catch (generationError) {
        const wasStopped = controller.signal.aborted;
        workingMessages = workingMessages.map((message) =>
          message.id === assistant.id
            ? { ...message, status: wasStopped ? "stopped" : "error" }
            : message,
        );
        if (!wasStopped) {
          setError(
            generationError instanceof Error
              ? generationError.message
              : "The selected model failed to respond. Please try again.",
          );
        }
      } finally {
        workingConversation = {
          ...workingConversation,
          messages: workingMessages,
          updatedAt: new Date().toISOString(),
        };
        conversations.setMessages(workingMessages);
        await conversations.commit(workingConversation);
        abortRef.current = null;
        setIsLoading(false);
      }
    },
    [conversations, setConnectionStatus, settings],
  );

  const submit = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading || !settings.model) return;
    if (draftPlan.isOverBudget) {
      setAttachmentError(draftPlan.reason);
      return;
    }

    const userMessage = createStoredMessage(
      "user",
      content,
      "complete",
      attachments,
    );
    const displayBase = [...conversations.messages, userMessage];
    const timestamp = new Date().toISOString();
    const seed =
      conversations.activeConversation ?? {
        id: crypto.randomUUID(),
        title: titleFromContent(content),
        mode: "single" as const,
        model: settings.model,
        settings: {
          temperature: settings.temperature,
          top_p: settings.top_p,
          num_ctx: settings.num_ctx,
          systemPrompt: settings.systemPrompt,
        },
        messages: [],
        favorite: false,
        branch: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

    setInput("");
    setAttachments([]);
    setAttachmentError(null);
    await runGeneration(displayBase, seed, draftPlan);
  }, [
    attachments,
    conversations.activeConversation,
    conversations.messages,
    draftPlan,
    input,
    isLoading,
    runGeneration,
    settings,
  ]);

  const retry = useCallback(
    async (messageId: string) => {
      const index = conversations.messages.findIndex(
        (message) => message.id === messageId,
      );
      if (index < 0 || !conversations.activeConversation || isLoading) return;
      const displayBase = conversations.messages.slice(0, index);
      const split = splitCurrentMessage(displayBase);
      if (!split) return;
      const plan = planContext({
        history: split.history,
        current: split.current,
        systemPrompt: settings.systemPrompt,
        numCtx: settings.num_ctx,
      });
      if (plan.isOverBudget) {
        setError(plan.reason);
        return;
      }
      await runGeneration(displayBase, conversations.activeConversation, plan);
    },
    [conversations, isLoading, runGeneration, settings],
  );

  const continueResponse = useCallback(
    async (messageId: string) => {
      const index = conversations.messages.findIndex(
        (message) => message.id === messageId,
      );
      if (index < 0 || !conversations.activeConversation || isLoading) return;
      const displayBase = conversations.messages.slice(0, index + 1);
      const instruction: ChatMessage = {
        role: "user",
        content:
          "Continue the previous response from where it ended. Do not repeat completed content.",
      };
      const plan = planContext({
        history: displayBase,
        current: instruction,
        systemPrompt: settings.systemPrompt,
        numCtx: settings.num_ctx,
      });
      if (plan.isOverBudget) {
        setError(plan.reason);
        return;
      }
      await runGeneration(displayBase, conversations.activeConversation, plan);
    },
    [conversations, isLoading, runGeneration, settings],
  );

  const branch = useCallback(
    async (messageId: string) => {
      const source = conversations.activeConversation;
      const index = conversations.messages.findIndex(
        (message) => message.id === messageId,
      );
      if (!source || index < 0) return;
      const editedContent = window.prompt(
        "Edit the message for the new branch",
        conversations.messages[index].content,
      )?.trim();
      if (!editedContent) return;
      const timestamp = new Date().toISOString();
      const branchMessages = conversations.messages
        .slice(0, index + 1)
        .map((message) =>
          message.id === messageId
            ? { ...message, content: editedContent, createdAt: timestamp }
            : message,
        );
      const nextConversation: Conversation = {
        ...source,
        id: crypto.randomUUID(),
        title: `${source.title} · branch`,
        messages: branchMessages,
        favorite: false,
        branch: {
          sourceConversationId: source.id,
          sourceMessageId: messageId,
        },
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await conversations.commit(nextConversation);
      conversations.setActiveId(nextConversation.id);
      conversations.setMessages(nextConversation.messages);
    },
    [conversations],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return {
    input,
    setInput,
    attachments,
    setAttachments,
    attachmentError,
    setAttachmentError,
    error,
    setError,
    isLoading,
    lastResponseTime,
    draftPlan,
    submit,
    stop,
    retry,
    continueResponse,
    branch,
  };
}
