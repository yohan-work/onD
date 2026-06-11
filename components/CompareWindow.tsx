import { useEffect, useRef } from "react";

import { ChatInput } from "@/components/ChatInput";
import { CompareResponseCard } from "@/components/CompareResponseCard";
import type { CompareTurn } from "@/lib/types";

type CompareWindowProps = {
  turns: CompareTurn[];
  input: string;
  selectedModelCount: number;
  isLoading: boolean;
  error: string | null;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onRetry: (turnId: string, model: string) => void;
};

export function CompareWindow({
  turns,
  input,
  selectedModelCount,
  isLoading,
  error,
  onInputChange,
  onSubmit,
  onRetry,
}: CompareWindowProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const selectionIsValid =
    selectedModelCount >= 2 && selectedModelCount <= 4;

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) {
      return;
    }

    scrollArea.scrollTo({
      top: scrollArea.scrollHeight,
      behavior: turns.length > 1 ? "smooth" : "auto",
    });
  }, [turns]);

  return (
    <main className="flex min-h-[680px] min-w-0 flex-1 flex-col bg-[var(--panel)] md:min-h-0">
      <div
        ref={scrollAreaRef}
        className="min-h-0 flex-1 overflow-y-auto"
        aria-live="polite"
      >
        <div className="mx-auto flex min-h-full max-w-[1180px] flex-col px-5 py-8 sm:px-8 sm:py-10">
          {turns.length === 0 ? (
            <div className="my-auto py-14 text-center">
              <div className="mx-auto mb-6 flex h-14 w-20 items-center justify-center gap-1.5 rounded-2xl border border-[var(--line)] bg-[var(--panel-muted)] shadow-sm">
                <span className="h-6 w-2 rounded-sm bg-[var(--accent)]/35" />
                <span className="h-8 w-2 rounded-sm bg-[var(--accent)]/65" />
                <span className="h-5 w-2 rounded-sm bg-[var(--accent)]" />
              </div>
              <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--accent)]">
                Parallel model workspace
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--ink)] sm:text-4xl">
                One prompt.
                <br />
                Multiple perspectives.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-sm leading-6 text-[var(--ink-secondary)]">
                Select 2 to 4 local models. Every model receives the same
                prompt and streams an independent response.
              </p>
              <div className="mx-auto mt-7 inline-flex rounded-full border border-[var(--line)] bg-white px-3.5 py-2 font-mono text-xs text-[var(--ink-secondary)] shadow-sm">
                {selectedModelCount} models selected
              </div>
            </div>
          ) : (
            <div className="space-y-10">
              {turns.map((turn) => (
                <section key={turn.id}>
                  <div className="mb-4 flex justify-end">
                    <div className="max-w-[85%] rounded-[18px] rounded-br-md bg-[var(--accent)] px-4 py-3 text-[15px] leading-6 whitespace-pre-wrap text-white shadow-sm sm:max-w-[72%]">
                      {turn.prompt}
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {turn.responses.map((response) => (
                      <CompareResponseCard
                        key={response.model}
                        response={response}
                        retryDisabled={isLoading}
                        onRetry={() => onRetry(turn.id, response.model)}
                      />
                    ))}
                  </div>
                </section>
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
          selectionIsValid
            ? `Message ${selectedModelCount} models...`
            : "Select 2 to 4 models to start..."
        }
        disabled={isLoading || !selectionIsValid}
        onChange={onInputChange}
        onSubmit={onSubmit}
      />
    </main>
  );
}
