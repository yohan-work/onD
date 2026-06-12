import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/ChatInput";
import { MessageBubble } from "@/components/MessageBubble";
import type {
  ContextPlan,
  StoredMessage,
  TextAttachment,
} from "@/lib/types";

type ChatWindowProps = {
  messages: StoredMessage[];
  input: string;
  selectedModel: string;
  isLoading: boolean;
  error: string | null;
  attachments: TextAttachment[];
  attachmentError: string | null;
  contextPlan: ContextPlan;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  onRetry: (messageId: string) => void;
  onContinue: (messageId: string) => void;
  onBranch: (messageId: string) => void;
  onAttachmentsChange: (attachments: TextAttachment[]) => void;
  onAttachmentError: (message: string | null) => void;
};

export function ChatWindow({
  messages,
  input,
  selectedModel,
  isLoading,
  error,
  attachments,
  attachmentError,
  contextPlan,
  onInputChange,
  onSubmit,
  onStop,
  onRetry,
  onContinue,
  onBranch,
  onAttachmentsChange,
  onAttachmentError,
}: ChatWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const shouldFollowStreamRef = useRef(true);
  const previousMessageCountRef = useRef(0);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      return;
    }

    const hasNewMessage =
      messages.length > previousMessageCountRef.current;
    previousMessageCountRef.current = messages.length;

    if (hasNewMessage) {
      shouldFollowStreamRef.current = true;
    }

    if (shouldFollowStreamRef.current) {
      scrollArea.scrollTo({
        top: scrollArea.scrollHeight,
        behavior: hasNewMessage ? "smooth" : "auto",
      });
    }
  }, [messages]);

  return (
    <main className="flex min-h-[680px] min-w-0 flex-1 flex-col bg-[var(--panel)] md:min-h-0">
      <div
        ref={scrollAreaRef}
        className="min-h-0 flex-1 overflow-y-auto"
        aria-live="polite"
        onScroll={(event) => {
          const scrollArea = event.currentTarget;
          const distanceFromBottom =
            scrollArea.scrollHeight -
            scrollArea.scrollTop -
            scrollArea.clientHeight;
          shouldFollowStreamRef.current = distanceFromBottom < 120;
        }}
      >
        <div className="mx-auto flex min-h-full max-w-[860px] flex-col px-5 py-8 sm:px-8 sm:py-12">
          {messages.length === 0 ? (
            <div className="my-auto py-14 text-center">
              <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] shadow-sm">
                <span className="font-mono text-sm font-semibold text-[var(--accent)]">
                  LAB
                </span>
              </div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Local inference workspace
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl">
                Test the model.
                <br />
                Keep the data local.
              </h2>
              <p className="mx-auto mt-5 max-w-md text-sm leading-6 text-[var(--ink-secondary)]">
                Select an installed Ollama model, tune the generation controls,
                and start a streaming conversation.
              </p>
              <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 py-2 font-mono text-xs text-[var(--ink-secondary)] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" />
                {selectedModel || "Waiting for a local model"}
              </div>
            </div>
          ) : (
            <div className="space-y-7">
              {messages.map((message, index) => (
                <MessageBubble
                  key={`${message.role}-${index}`}
                  message={message}
                  isStreaming={isLoading && index === messages.length - 1}
                  onCopy={() => void navigator.clipboard.writeText(message.content)}
                  onRetry={
                    message.role === "assistant" && !isLoading
                      ? () => onRetry(message.id)
                      : undefined
                  }
                  onContinue={
                    message.role === "assistant" && !isLoading
                      ? () => onContinue(message.id)
                      : undefined
                  }
                  onBranch={
                    message.role === "user" && !isLoading
                      ? () => onBranch(message.id)
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          {error ? (
            <div
              role="alert"
              className="mt-7 rounded-xl border border-[var(--error)]/20 bg-[var(--error-soft)] px-4 py-3 text-sm leading-5 text-[var(--error)]"
            >
              {error}
            </div>
          ) : null}
        </div>
      </div>

      <ChatInput
        value={input}
        placeholder={
          selectedModel
            ? `Message ${selectedModel}...`
            : "Select a model to start..."
        }
        disabled={isLoading || !selectedModel}
        isGenerating={isLoading}
        attachments={attachments}
        attachmentError={attachmentError}
        contextPlan={contextPlan}
        onChange={onInputChange}
        onSubmit={onSubmit}
        onStop={onStop}
        onAttachmentsChange={onAttachmentsChange}
        onAttachmentError={onAttachmentError}
      />
    </main>
  );
}
