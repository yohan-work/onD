import { describe, expect, it, vi } from "vitest";

import { createExperiment } from "@/lib/benchmark-engine";
import { runBenchmarkExperiment } from "@/lib/benchmark-runner";
import type { BenchmarkSuite, ChatSettings } from "@/lib/types";

const suite: BenchmarkSuite = {
  id: "suite",
  name: "Suite",
  description: "",
  createdAt: "2026-06-12T00:00:00.000Z",
  updatedAt: "2026-06-12T00:00:00.000Z",
  cases: [{
    id: "case",
    title: "Case",
    prompt: "Hello",
    category: "general",
  }],
};

const settings: ChatSettings = {
  mode: "lab",
  model: "a",
  compareModels: ["a", "b"],
  judgeModel: "",
  temperature: 0,
  top_p: 1,
  num_ctx: 2048,
  systemPrompt: "",
};

describe("runBenchmarkExperiment", () => {
  it("runs models sequentially and completes the experiment", async () => {
    const experiment = createExperiment(suite, ["a", "b"], "", settings);
    const calls: string[] = [];
    const committed = [];
    const result = await runBenchmarkExperiment(experiment, {
      commit: async (next) => {
        committed.push(next);
      },
      onStream: () => undefined,
      onController: () => undefined,
      shouldPause: () => false,
      shouldCancel: () => false,
      stream: vi.fn(async ({ model, onContent }) => {
        calls.push(model);
        onContent(model);
        return {
          responseTime: 1,
          metrics: {
            totalDuration: null,
            loadDuration: null,
            promptEvalCount: 1,
            promptEvalDuration: null,
            evalCount: 1,
            evalDuration: 1,
            tokensPerSecond: 1,
            firstTokenTime: 1,
            doneReason: "stop",
          },
        };
      }),
    });

    expect(calls).toEqual(["a", "b"]);
    expect(result.status).toBe("completed");
    expect(result.currentRun).toBe(2);
    expect(committed.length).toBeGreaterThan(2);
  });

  it("pauses before starting the next pending run", async () => {
    const experiment = createExperiment(suite, ["a", "b"], "", settings);
    const result = await runBenchmarkExperiment(experiment, {
      commit: async () => undefined,
      onStream: () => undefined,
      onController: () => undefined,
      shouldPause: () => true,
      shouldCancel: () => false,
      stream: vi.fn(),
    });

    expect(result.status).toBe("paused");
    expect(result.currentRun).toBe(0);
  });
});
