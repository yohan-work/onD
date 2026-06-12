import { describe, expect, it } from "vitest";

import { estimateTokens } from "@/lib/attachments";
import { planContext } from "@/lib/context-planner";
import type { StoredMessage } from "@/lib/types";

function message(
  id: string,
  role: "user" | "assistant",
  content: string,
): StoredMessage {
  return {
    id,
    role,
    content,
    status: "complete",
    createdAt: "2026-06-12T00:00:00.000Z",
  };
}

describe("token estimation", () => {
  it("weights CJK characters more heavily than latin text", () => {
    expect(estimateTokens("가나다라")).toBe(4);
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("한글abcd")).toBe(3);
  });
});

describe("planContext", () => {
  it("reserves 25 percent of the context for output", () => {
    const plan = planContext({
      history: [],
      current: { role: "user", content: "hello" },
      systemPrompt: "",
      numCtx: 4096,
    });

    expect(plan.inputBudget).toBe(3072);
    expect(plan.isOverBudget).toBe(false);
  });

  it("keeps recent complete turns and drops older turns together", () => {
    const history = [
      message("u1", "user", "a".repeat(160)),
      message("a1", "assistant", "b".repeat(160)),
      message("u2", "user", "recent question"),
      message("a2", "assistant", "recent answer"),
    ];
    const plan = planContext({
      history,
      current: { role: "user", content: "next" },
      systemPrompt: "",
      numCtx: 128,
    });

    expect(plan.excludedTurns).toBe(1);
    expect(plan.messages.map((entry) => entry.content)).toEqual([
      "recent question",
      "recent answer",
      "next",
    ]);
  });

  it("always preserves system prompt, current input, and attachments", () => {
    const plan = planContext({
      history: [message("u1", "user", "old"), message("a1", "assistant", "old")],
      current: {
        role: "user",
        content: "summarize",
        attachments: [{
          id: "file",
          name: "notes.md",
          type: "text/markdown",
          size: 5,
          content: "가나다라마",
        }],
      },
      systemPrompt: "Be concise",
      numCtx: 128,
    });

    expect(plan.messages[0]).toEqual({
      role: "system",
      content: "Be concise",
    });
    expect(plan.messages.at(-1)?.content).toContain("<attachment");
    expect(plan.breakdown.attachments).toBeGreaterThan(5);
  });

  it("blocks when fixed input alone exceeds the budget", () => {
    const plan = planContext({
      history: [message("u1", "user", "old")],
      current: { role: "user", content: "가".repeat(100) },
      systemPrompt: "나".repeat(30),
      numCtx: 128,
    });

    expect(plan.isOverBudget).toBe(true);
    expect(plan.excludedTurns).toBe(1);
    expect(plan.reason).toContain("exceed");
  });

  it("keeps stopped assistant content in its turn", () => {
    const stopped = {
      ...message("a1", "assistant", "partial answer"),
      status: "stopped" as const,
    };
    const plan = planContext({
      history: [message("u1", "user", "question"), stopped],
      current: { role: "user", content: "continue" },
      systemPrompt: "",
      numCtx: 512,
    });

    expect(plan.messages.map((entry) => entry.content)).toContain(
      "partial answer",
    );
  });
});
