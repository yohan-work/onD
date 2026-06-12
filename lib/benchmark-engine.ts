import { weightedScore } from "@/lib/rubrics";
import type {
  BenchmarkRun,
  BenchmarkSuite,
  ChatSettings,
  Experiment,
} from "@/lib/types";

export function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [
      result[swapIndex],
      result[index],
    ];
  }
  return result;
}

export function parseStructuredJson<T>(content: string): T {
  const trimmed = content.trim();
  const withoutFence = trimmed.startsWith("```")
    ? trimmed
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim()
    : trimmed;
  return JSON.parse(withoutFence) as T;
}

export function createExperiment(
  suite: BenchmarkSuite,
  models: string[],
  judgeModel: string,
  settings: ChatSettings,
): Experiment {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: `${suite.name} · ${new Date().toLocaleString()}`,
    suiteId: suite.id,
    suiteName: suite.name,
    models,
    judgeModel,
    settings: {
      temperature: settings.temperature,
      top_p: settings.top_p,
      num_ctx: settings.num_ctx,
      systemPrompt: settings.systemPrompt,
    },
    status: "draft",
    currentRun: 0,
    totalRuns: suite.cases.length * models.length,
    createdAt: timestamp,
    updatedAt: timestamp,
    results: suite.cases.map((testCase) => {
      const runs: BenchmarkRun[] = models.map((model) => ({
        id: crypto.randomUUID(),
        caseId: testCase.id,
        model,
        content: "",
        status: "pending",
        error: null,
        metrics: null,
      }));
      return {
        caseId: testCase.id,
        prompt: testCase.prompt,
        category: testCase.category,
        runs,
        blindOrder: shuffle(runs.map((run) => run.id)),
        humanEvaluation: null,
        judgeEvaluation: null,
      };
    }),
  };
}

export function updateRun(
  experiment: Experiment,
  runId: string,
  updater: (run: BenchmarkRun) => BenchmarkRun,
) {
  return {
    ...experiment,
    updatedAt: new Date().toISOString(),
    results: experiment.results.map((result) => ({
      ...result,
      runs: result.runs.map((run) =>
        run.id === runId ? updater(run) : run,
      ),
    })),
  };
}

export function modelStats(experiment: Experiment) {
  return experiment.models.map((model) => {
    const entries = experiment.results.flatMap((result) => {
      const run = result.runs.find((candidate) => candidate.model === model);
      return run ? [{ result, run }] : [];
    });
    const completed = entries.filter(({ run }) => run.status === "completed");
    const humanScores = entries.flatMap(({ result, run }) => {
      const score = weightedScore(
        result.category,
        result.humanEvaluation?.scores[run.id],
      );
      return score === null ? [] : [score];
    });
    const judgeScores = entries.flatMap(({ result }) => {
      const score = weightedScore(
        result.category,
        result.judgeEvaluation?.scores[model],
      );
      return score === null ? [] : [score];
    });
    const average = (values: number[]) =>
      values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null;

    return {
      model,
      humanScore: average(humanScores),
      judgeScore: average(judgeScores),
      winRate: entries.length
        ? (entries.filter(
            ({ result, run }) =>
              result.humanEvaluation?.winnerRunId === run.id,
          ).length /
            entries.length) *
          100
        : 0,
      tokensPerSecond: average(
        completed.flatMap(({ run }) =>
          run.metrics?.tokensPerSecond == null
            ? []
            : [run.metrics.tokensPerSecond],
        ),
      ),
      firstTokenTime: average(
        completed.flatMap(({ run }) =>
          run.metrics?.firstTokenTime == null
            ? []
            : [run.metrics.firstTokenTime],
        ),
      ),
      errorRate: entries.length
        ? (entries.filter(({ run }) => run.status === "error").length /
            entries.length) *
          100
        : 0,
    };
  });
}
