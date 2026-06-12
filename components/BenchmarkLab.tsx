"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  deleteExperiment,
  deleteSuite,
  exportBenchmarkData,
  importBenchmarkData,
  listExperiments,
  listSuites,
  saveExperiment,
  saveSuite,
  type BenchmarkExport,
} from "@/lib/benchmark-db";
import { createStarterSuite } from "@/lib/benchmark-defaults";
import {
  createExperiment,
  modelStats,
  parseStructuredJson,
} from "@/lib/benchmark-engine";
import { runBenchmarkExperiment } from "@/lib/benchmark-runner";
import { streamChat } from "@/lib/chat-stream";
import {
  CATEGORY_LABELS,
  RUBRICS,
} from "@/lib/rubrics";
import type {
  BenchmarkCase,
  BenchmarkSuite,
  ChatSettings,
  Experiment,
  ExperimentCaseResult,
  HumanEvaluation,
  JudgeEvaluation,
  ModelInfo,
  RuntimeModel,
  TaskCategory,
} from "@/lib/types";

type LabTab = "setup" | "review" | "results";

type BenchmarkLabProps = {
  models: ModelInfo[];
  settings: ChatSettings;
  judgeModel: string;
  onJudgeModelChange: (model: string) => void;
};

const TASK_CATEGORIES = Object.keys(
  CATEGORY_LABELS,
) as TaskCategory[];

function formatDuration(milliseconds: number | null) {
  return milliseconds === null ? "--" : `${(milliseconds / 1000).toFixed(2)}s`;
}

function formatBytes(bytes: number | undefined) {
  if (bytes === undefined) {
    return "--";
  }
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function BenchmarkLab({
  models,
  settings,
  judgeModel,
  onJudgeModelChange,
}: BenchmarkLabProps) {
  const [tab, setTab] = useState<LabTab>("setup");
  const [suites, setSuites] = useState<BenchmarkSuite[]>([]);
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [selectedSuiteId, setSelectedSuiteId] = useState("");
  const [selectedExperimentId, setSelectedExperimentId] = useState("");
  const [targetModels, setTargetModels] = useState<string[]>([]);
  const [reviewCaseIndex, setReviewCaseIndex] = useState(0);
  const [runtimeModels, setRuntimeModels] = useState<RuntimeModel[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isJudging, setIsJudging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showSuiteEditor, setShowSuiteEditor] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const experimentsRef = useRef<Experiment[]>([]);
  const pauseRequestedRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const selectedSuite =
    suites.find((suite) => suite.id === selectedSuiteId) ?? null;
  const selectedExperiment =
    experiments.find(
      (experiment) => experiment.id === selectedExperimentId,
    ) ?? null;
  const selectedReviewResult =
    selectedExperiment?.results[reviewCaseIndex] ?? null;

  const refreshData = useCallback(async () => {
    const [storedSuites, storedExperiments] = await Promise.all([
      listSuites(),
      listExperiments(),
    ]);
    const orderedExperiments = storedExperiments.toSorted((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    if (storedSuites.length === 0) {
      const starter = createStarterSuite();
      await saveSuite(starter);
      setSuites([starter]);
      setSelectedSuiteId(starter.id);
    } else {
      setSuites(storedSuites);
      setSelectedSuiteId((current) => current || storedSuites[0].id);
    }

    setExperiments(orderedExperiments);
    experimentsRef.current = orderedExperiments;
    setSelectedExperimentId(
      (current) => current || orderedExperiments[0]?.id || "",
    );
  }, []);

  useEffect(() => {
    let active = true;
    async function initialize() {
      await refreshData();
      try {
        const response = await fetch("/api/runtime", { cache: "no-store" });
        const payload = (await response.json()) as {
          models?: RuntimeModel[];
        };
        if (active && response.ok && Array.isArray(payload.models)) {
          setRuntimeModels(payload.models);
        }
      } catch {
        // Runtime details are supplementary and do not block benchmarks.
      }
    }
    void initialize();
    return () => {
      active = false;
    };
  }, [refreshData]);

  useEffect(() => {
    let active = true;
    async function synchronizeTargetModels() {
      await Promise.resolve();
      if (!active) return;
      setTargetModels((current) => {
        const available = models
          .map((model) => model.name)
          .filter((model) => model !== judgeModel);
        const valid = current.filter(
        (model) =>
          model !== judgeModel &&
          models.some((available) => available.name === model),
        );

        if (valid.length >= 2) {
          return valid;
        }

        const preferred = settings.compareModels.filter((model) =>
          available.includes(model),
        );
        return [...new Set([...valid, ...preferred, ...available])].slice(
          0,
          Math.min(2, available.length),
        );
      });
    }
    void synchronizeTargetModels();
    return () => {
      active = false;
    };
  }, [judgeModel, models, settings.compareModels]);

  const commitExperiment = useCallback(async (experiment: Experiment) => {
    const next = experimentsRef.current
        .map((candidate) =>
          candidate.id === experiment.id ? experiment : candidate,
        )
        .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
    experimentsRef.current = next;
    setExperiments(next);
    await saveExperiment(experiment);
  }, []);

  const runExperiment = useCallback(
    async (initialExperiment: Experiment) => {
      pauseRequestedRef.current = false;
      cancelRequestedRef.current = false;
      setIsRunning(true);
      setMessage(null);
      const outcome = await runBenchmarkExperiment(initialExperiment, {
        commit: commitExperiment,
        onStream: (streamed) => {
          setExperiments((current) => {
            const next = current.map((experiment) =>
              experiment.id === streamed.id ? streamed : experiment,
            );
            experimentsRef.current = next;
            return next;
          });
        },
        onController: (controller) => {
          abortControllerRef.current = controller;
        },
        shouldPause: () => pauseRequestedRef.current,
        shouldCancel: () => cancelRequestedRef.current,
      });
      setIsRunning(false);
      setMessage(
        outcome.status === "completed"
          ? "Benchmark completed. Review the blind results."
          : outcome.status === "paused"
            ? "Benchmark paused."
            : "Benchmark cancelled.",
      );
      if (outcome.status === "completed") {
        setTab("review");
      }
    },
    [commitExperiment],
  );

  const startBenchmark = useCallback(async () => {
    if (!selectedSuite || targetModels.length < 2) {
      setMessage("Select a test suite and at least two target models.");
      return;
    }

    const experiment = createExperiment(
      selectedSuite,
      targetModels,
      judgeModel,
      settings,
    );
    setExperiments((current) => [experiment, ...current]);
    experimentsRef.current = [experiment, ...experimentsRef.current];
    setSelectedExperimentId(experiment.id);
    setReviewCaseIndex(0);
    setTab("review");
    await saveExperiment(experiment);
    await runExperiment(experiment);
  }, [
    judgeModel,
    runExperiment,
    selectedSuite,
    settings,
    targetModels,
  ]);

  const retryOrResume = useCallback(async () => {
    if (!selectedExperiment) {
      return;
    }
    const reset = {
      ...selectedExperiment,
      status: "draft" as const,
      currentRun: selectedExperiment.results.reduce(
        (total, result) =>
          total +
          result.runs.filter((run) => run.status === "completed").length,
        0,
      ),
      results: selectedExperiment.results.map((result) => ({
        ...result,
        runs: result.runs.map((run) =>
          run.status === "error"
            ? { ...run, status: "pending" as const, error: null }
            : run,
        ),
      })),
    };
    await runExperiment(reset);
  }, [runExperiment, selectedExperiment]);

  const updateSuite = useCallback(
    (updater: (suite: BenchmarkSuite) => BenchmarkSuite) => {
      setSuites((current) =>
        current.map((suite) =>
          suite.id === selectedSuiteId ? updater(suite) : suite,
        ),
      );
    },
    [selectedSuiteId],
  );

  const persistSelectedSuite = useCallback(async () => {
    const suite = suites.find((candidate) => candidate.id === selectedSuiteId);
    if (!suite) {
      return;
    }
    const updated = { ...suite, updatedAt: new Date().toISOString() };
    await saveSuite(updated);
    setSuites((current) =>
      current.map((candidate) =>
        candidate.id === updated.id ? updated : candidate,
      ),
    );
    setMessage("Test suite saved.");
  }, [selectedSuiteId, suites]);

  const createSuite = useCallback(async () => {
    const timestamp = new Date().toISOString();
    const suite: BenchmarkSuite = {
      id: crypto.randomUUID(),
      name: "Untitled benchmark suite",
      description: "",
      createdAt: timestamp,
      updatedAt: timestamp,
      cases: [],
    };
    await saveSuite(suite);
    setSuites((current) => [...current, suite]);
    setSelectedSuiteId(suite.id);
  }, []);

  const removeSelectedSuite = useCallback(async () => {
    if (!selectedSuite || suites.length <= 1) {
      return;
    }
    await deleteSuite(selectedSuite.id);
    const next = suites.filter((suite) => suite.id !== selectedSuite.id);
    setSuites(next);
    setSelectedSuiteId(next[0]?.id ?? "");
  }, [selectedSuite, suites]);

  const updateHumanEvaluation = useCallback(
    async (
      resultIndex: number,
      updater: (evaluation: HumanEvaluation) => HumanEvaluation,
    ) => {
      const currentExperiment = experimentsRef.current.find(
        (experiment) => experiment.id === selectedExperimentId,
      );
      if (!currentExperiment) {
        return;
      }

      const updated: Experiment = {
        ...currentExperiment,
        updatedAt: new Date().toISOString(),
        results: currentExperiment.results.map((result, index) => {
          if (index !== resultIndex) {
            return result;
          }
          return {
            ...result,
            humanEvaluation: updater(
              result.humanEvaluation ?? {
                winnerRunId: null,
                scores: {},
                note: "",
                completedAt: null,
              },
            ),
          };
        }),
      };
      await commitExperiment(updated);
    },
    [commitExperiment, selectedExperimentId],
  );

  const judgeResult = useCallback(
    async (resultIndex: number) => {
      const experiment = experimentsRef.current.find(
        (candidate) => candidate.id === selectedExperimentId,
      );
      const result = experiment?.results[resultIndex];
      if (!experiment || !result || !judgeModel) {
        setMessage("Select a dedicated Judge model first.");
        return;
      }
      if (experiment.models.includes(judgeModel)) {
        setMessage("The Judge model must be excluded from target models.");
        return;
      }

      const completedRuns = result.runs.filter(
        (run) => run.status === "completed",
      );
      if (completedRuns.length < 2) {
        setMessage("At least two completed responses are required.");
        return;
      }

      setIsJudging(true);
      setMessage(null);
      const rubric = RUBRICS[result.category];
      const schema = {
        type: "object",
        properties: {
          winner_index: { type: "integer" },
          confidence: { type: "number" },
          rationale: { type: "string" },
          evaluations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                index: { type: "integer" },
                scores: {
                  type: "object",
                  properties: Object.fromEntries(
                    rubric.map((criterion) => [
                      criterion.id,
                      { type: "number" },
                    ]),
                  ),
                  required: rubric.map((criterion) => criterion.id),
                },
              },
              required: ["index", "scores"],
            },
          },
        },
        required: [
          "winner_index",
          "confidence",
          "rationale",
          "evaluations",
        ],
      };
      const answers = completedRuns
        .map(
          (run, index) =>
            `RESPONSE ${index}\n${run.content}`,
        )
        .join("\n\n");
      let output = "";

      try {
        await streamChat({
          model: judgeModel,
          messages: [
            {
              role: "system",
              content:
                "You are an impartial evaluator. Score each response from 1 to 5 using every rubric criterion. Return only valid JSON matching the schema.",
            },
            {
              role: "user",
              content: `PROMPT\n${result.prompt}\n\nRUBRIC\n${rubric
                .map(
                  (criterion) =>
                    `${criterion.id}: ${criterion.label} (${criterion.weight})`,
                )
                .join("\n")}\n\n${answers}`,
            },
          ],
          settings: {
            temperature: 0,
            top_p: 0.9,
            num_ctx: experiment.settings.num_ctx,
          },
          format: schema,
          onContent: (content) => {
            output += content;
          },
        });

        const parsed = parseStructuredJson<{
          winner_index: number;
          confidence: number;
          rationale: string;
          evaluations: Array<{
            index: number;
            scores: Record<string, number>;
          }>;
        }>(output);
        const winner = completedRuns[parsed.winner_index];
        if (!winner || !Array.isArray(parsed.evaluations)) {
          throw new Error("Judge returned invalid response indexes.");
        }

        const evaluation: JudgeEvaluation = {
          winnerModel: winner.model,
          confidence: Math.min(1, Math.max(0, parsed.confidence)),
          rationale: parsed.rationale,
          judgeModel,
          completedAt: new Date().toISOString(),
          scores: Object.fromEntries(
            parsed.evaluations.flatMap((entry) => {
              const run = completedRuns[entry.index];
              return run
                ? [
                    [
                      run.model,
                      Object.fromEntries(
                        rubric.map((criterion) => [
                          criterion.id,
                          Math.min(
                            5,
                            Math.max(
                              1,
                              Number(entry.scores[criterion.id]) || 1,
                            ),
                          ),
                        ]),
                      ),
                    ],
                  ]
                : [];
            }),
          ),
        };
        const updated: Experiment = {
          ...experiment,
          updatedAt: new Date().toISOString(),
          results: experiment.results.map((candidate, index) =>
            index === resultIndex
              ? { ...candidate, judgeEvaluation: evaluation }
              : candidate,
          ),
        };
        await commitExperiment(updated);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? `Judge failed: ${error.message}`
            : "Judge evaluation failed.",
        );
      } finally {
        setIsJudging(false);
      }
    },
    [
      commitExperiment,
      judgeModel,
      selectedExperimentId,
    ],
  );

  const judgeAll = useCallback(async () => {
    if (!selectedExperiment) {
      return;
    }
    for (
      let index = 0;
      index < selectedExperiment.results.length;
      index += 1
    ) {
      const latest = experimentsRef.current.find(
        (experiment) => experiment.id === selectedExperiment.id,
      );
      if (!latest?.results[index].judgeEvaluation) {
        await judgeResult(index);
      }
    }
  }, [judgeResult, selectedExperiment]);

  const handleExport = useCallback(async () => {
    const data = await exportBenchmarkData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ollama-chat-lab-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(
    async (file: File) => {
      const data = JSON.parse(await file.text()) as BenchmarkExport;
      await importBenchmarkData(data);
      await refreshData();
      setMessage("Benchmark backup imported.");
    },
    [refreshData],
  );

  const stats = useMemo(
    () => (selectedExperiment ? modelStats(selectedExperiment) : []),
    [selectedExperiment],
  );
  const canRun =
    Boolean(selectedSuite?.cases.length) && targetModels.length >= 2;
  const estimatedRuns =
    (selectedSuite?.cases.length ?? 0) * targetModels.length;

  return (
    <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[var(--page)]">
      <div className="mx-auto max-w-[1500px] px-5 py-6 sm:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--accent)]">
              Ollama 로컬 모델 평가
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-[-0.035em]">
              모델 성능 평가
            </h2>
            <p className="mt-1 text-[10px] text-[var(--ink-secondary)]">
              같은 질문으로 여러 모델의 답변 품질과 속도를 비교합니다.
            </p>
          </div>
          <div className="flex rounded-xl border border-[var(--line)] bg-white p-1">
            {(["setup", "review", "results"] as const).map((nextTab) => (
              <button
                key={nextTab}
                type="button"
                onClick={() => setTab(nextTab)}
                className={`rounded-lg px-4 py-2 text-[10px] font-semibold capitalize transition ${
                  tab === nextTab
                    ? "bg-[var(--ink)] text-white"
                    : "text-[var(--ink-secondary)] hover:bg-[var(--panel-muted)]"
                }`}
              >
                {nextTab === "setup"
                  ? "1. 실행 설정"
                  : nextTab === "review"
                    ? "2. 답변 평가"
                    : "3. 결과 보기"}
              </button>
            ))}
          </div>
        </div>

        {message ? (
          <div className="mb-5 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-[10px] text-[var(--ink-secondary)]">
            {message}
          </div>
        ) : null}

        {tab === "setup" ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <GuideStep
                  number="1"
                  title="테스트 선택"
                  description="기본 테스트셋을 그대로 사용해도 됩니다."
                  complete={Boolean(selectedSuite?.cases.length)}
                />
                <GuideStep
                  number="2"
                  title="모델 선택"
                  description="비교할 모델을 2개 이상 고릅니다."
                  complete={targetModels.length >= 2}
                />
                <GuideStep
                  number="3"
                  title="평가 시작"
                  description="모델이 차례로 모든 질문에 답합니다."
                  complete={false}
                />
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
            <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                    STEP 1
                  </p>
                  <h3 className="mt-1 text-[12px] font-semibold">어떤 질문으로 평가할까요?</h3>
                  <p className="text-[10px] text-[var(--ink-muted)]">
                    처음에는 준비된 기본 테스트를 선택하면 됩니다.
                  </p>
                </div>
              </div>

              <select
                value={selectedSuiteId}
                onChange={(event) => setSelectedSuiteId(event.target.value)}
                className="mt-4 h-9 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[10px] outline-none"
              >
                {suites.map((suite) => (
                  <option key={suite.id} value={suite.id}>
                    {suite.name}
                  </option>
                ))}
              </select>

              {selectedSuite ? (
                <div className="mt-4 rounded-xl bg-[var(--panel-muted)]/60 p-4">
                  <p className="text-[10px] font-medium">{selectedSuite.name}</p>
                  <p className="mt-1 text-[10px] leading-5 text-[var(--ink-secondary)]">
                    {selectedSuite.description ||
                      "저장된 질문으로 모델 품질과 속도를 비교합니다."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[10px]">
                      질문 {selectedSuite.cases.length}개
                    </span>
                    {[...new Set(selectedSuite.cases.map((item) => item.category))].map(
                      (category) => (
                        <span
                          key={category}
                          className="rounded-full bg-white px-2.5 py-1 text-[10px]"
                        >
                          {CATEGORY_LABELS[category]}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowSuiteEditor((current) => !current)}
                className="mt-4 text-[10px] font-medium text-[var(--accent)]"
              >
                {showSuiteEditor
                  ? "테스트셋 편집기 닫기"
                  : "질문을 직접 추가하거나 수정하기"}
              </button>

              {selectedSuite && showSuiteEditor ? (
                <div className="mt-4 space-y-4">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={createSuite}
                      className="rounded-lg border border-[var(--line)] px-3 py-2 text-[10px] font-medium"
                    >
                      새 테스트셋
                    </button>
                    <button
                      type="button"
                      disabled={suites.length <= 1}
                      onClick={removeSelectedSuite}
                      className="rounded-lg border border-[var(--line)] px-3 py-2 text-[10px] text-[var(--error)] disabled:opacity-40"
                    >
                      삭제
                    </button>
                  </div>
                  <input
                    value={selectedSuite.name}
                    onChange={(event) =>
                      updateSuite((suite) => ({
                        ...suite,
                        name: event.target.value,
                      }))
                    }
                    className="h-9 w-full rounded-xl border border-[var(--line)] px-3 text-[10px] outline-none focus:border-[var(--accent)]"
                    aria-label="Suite name"
                  />
                  <textarea
                    value={selectedSuite.description}
                    onChange={(event) =>
                      updateSuite((suite) => ({
                        ...suite,
                        description: event.target.value,
                      }))
                    }
                    rows={2}
                    placeholder="Describe the purpose of this benchmark..."
                    className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-[10px] outline-none focus:border-[var(--accent)]"
                  />

                  <div className="space-y-3">
                    {selectedSuite.cases.map((testCase, caseIndex) => (
                      <div
                        key={testCase.id}
                        className="rounded-xl border border-[var(--line)] bg-[var(--panel-muted)]/35 p-3"
                      >
                        <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                          <input
                            value={testCase.title}
                            onChange={(event) =>
                              updateSuite((suite) => ({
                                ...suite,
                                cases: suite.cases.map((candidate) =>
                                  candidate.id === testCase.id
                                    ? {
                                        ...candidate,
                                        title: event.target.value,
                                      }
                                    : candidate,
                                ),
                              }))
                            }
                            className="h-9 rounded-lg border border-[var(--line)] bg-white px-2.5 text-[10px]"
                            aria-label={`Case ${caseIndex + 1} title`}
                          />
                          <select
                            value={testCase.category}
                            onChange={(event) =>
                              updateSuite((suite) => ({
                                ...suite,
                                cases: suite.cases.map((candidate) =>
                                  candidate.id === testCase.id
                                    ? {
                                        ...candidate,
                                        category: event.target
                                          .value as TaskCategory,
                                      }
                                    : candidate,
                                ),
                              }))
                            }
                            className="h-9 rounded-lg border border-[var(--line)] bg-white px-2 text-[10px]"
                          >
                            {TASK_CATEGORIES.map((category) => (
                              <option key={category} value={category}>
                                {CATEGORY_LABELS[category]}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              updateSuite((suite) => ({
                                ...suite,
                                cases: suite.cases.filter(
                                  (candidate) =>
                                    candidate.id !== testCase.id,
                                ),
                              }))
                            }
                            className="h-9 px-2 text-[10px] text-[var(--error)]"
                          >
                            Remove
                          </button>
                        </div>
                        <textarea
                          value={testCase.prompt}
                          onChange={(event) =>
                            updateSuite((suite) => ({
                              ...suite,
                              cases: suite.cases.map((candidate) =>
                                candidate.id === testCase.id
                                  ? {
                                      ...candidate,
                                      prompt: event.target.value,
                                    }
                                  : candidate,
                              ),
                            }))
                          }
                          rows={3}
                          className="mt-2 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[10px] leading-5"
                          aria-label={`Case ${caseIndex + 1} prompt`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const testCase: BenchmarkCase = {
                          id: crypto.randomUUID(),
                          title: "New test case",
                          prompt: "",
                          category: "general",
                        };
                        updateSuite((suite) => ({
                          ...suite,
                          cases: [...suite.cases, testCase],
                        }));
                      }}
                      className="rounded-lg border border-[var(--line)] px-3 py-2 text-[10px] font-medium"
                    >
                      질문 추가
                    </button>
                    <button
                      type="button"
                      onClick={persistSelectedSuite}
                      className="rounded-lg bg-[var(--accent)] px-4 py-2 text-[10px] font-semibold text-white"
                    >
                      테스트셋 저장
                    </button>
                  </div>
                </div>
              ) : null}
            </section>

            <aside className="space-y-5">
              <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">
                  STEP 2
                </p>
                <h3 className="mt-1 text-[12px] font-semibold">비교할 모델을 선택하세요</h3>
                <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                  기본으로 2개가 선택됩니다. 모델은 한 번에 하나씩 실행됩니다.
                </p>

                <fieldset className="mt-5">
                  <legend className="text-[10px] font-medium">
                    평가 대상 모델 ({targetModels.length}개 선택)
                  </legend>
                  <div className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-[var(--line)] p-1.5">
                    {models
                      .filter((model) => model.name !== judgeModel)
                      .map((model) => (
                        <label
                          key={model.name}
                          className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-[10px] hover:bg-[var(--panel-muted)]"
                        >
                          <input
                            type="checkbox"
                            checked={targetModels.includes(model.name)}
                            onChange={(event) =>
                              setTargetModels((current) =>
                                event.target.checked
                                  ? [...current, model.name]
                                  : current.filter(
                                      (name) => name !== model.name,
                                    ),
                              )
                            }
                            className="accent-[var(--accent)]"
                          />
                          <span className="truncate font-mono">
                            {model.name}
                          </span>
                        </label>
                      ))}
                  </div>
                </fieldset>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((current) => !current)}
                  className="mt-4 text-[10px] font-medium text-[var(--accent)]"
                >
                  {showAdvanced ? "고급 설정 닫기" : "Judge와 고급 설정 보기"}
                </button>

                {showAdvanced ? (
                  <div className="mt-4 rounded-xl border border-[var(--line)] p-3">
                    <label className="block text-[10px] font-medium">
                      자동 평가용 Judge 모델 (선택)
                      <select
                        value={judgeModel}
                        onChange={(event) =>
                          onJudgeModelChange(event.target.value)
                        }
                        className="mt-2 h-8 w-full rounded-xl border border-[var(--line)] bg-white px-3 font-mono text-[10px]"
                      >
                        <option value="">사용 안 함</option>
                        {models.map((model) => (
                          <option key={model.name} value={model.name}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-2 text-[10px] leading-4 text-[var(--ink-muted)]">
                      Judge는 답변을 자동 채점하는 별도 모델입니다. 처음에는 선택하지 않아도 됩니다.
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <MetricPill label="Temp" value={settings.temperature} />
                      <MetricPill label="Top P" value={settings.top_p} />
                      <MetricPill label="Context" value={settings.num_ctx} />
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl bg-[var(--panel-muted)] p-4">
                  <p className="text-[10px] font-semibold">실행 요약</p>
                  <p className="mt-1 text-[10px] leading-5 text-[var(--ink-secondary)]">
                    질문 {selectedSuite?.cases.length ?? 0}개 × 모델{" "}
                    {targetModels.length}개 = 총 {estimatedRuns}번 실행
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    isRunning ||
                    !canRun
                  }
                  onClick={startBenchmark}
                  className="mt-5 h-9 w-full rounded-xl bg-[var(--ink)] text-[10px] font-semibold text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {isRunning ? "평가 실행 중..." : "모델 성능 평가 시작"}
                </button>
                {!canRun ? (
                  <p className="mt-2 text-center text-[10px] text-[var(--error)]">
                    질문이 있는 테스트셋과 모델 2개 이상이 필요합니다.
                  </p>
                ) : (
                  <p className="mt-2 text-center text-[10px] text-[var(--ink-muted)]">
                    완료되면 자동으로 답변 평가 화면으로 이동합니다.
                  </p>
                )}
              </section>

              {showAdvanced ? <RuntimePanel models={runtimeModels} /> : null}

              {showAdvanced ? (
                <section className="rounded-2xl border border-[var(--line)] bg-white p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleExport}
                    className="rounded-lg border border-[var(--line)] px-3 py-2 text-[10px]"
                  >
                    Export JSON
                  </button>
                  <label className="cursor-pointer rounded-lg border border-[var(--line)] px-3 py-2 text-[10px]">
                    Import JSON
                    <input
                      type="file"
                      accept="application/json"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) {
                          void handleImport(file);
                        }
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
                </section>
              ) : null}
            </aside>
            </div>
          </div>
        ) : null}

        {tab === "review" ? (
          <ReviewPanel
            experiments={experiments}
            selectedExperiment={selectedExperiment}
            selectedExperimentId={selectedExperimentId}
            selectedResult={selectedReviewResult}
            reviewCaseIndex={reviewCaseIndex}
            isRunning={isRunning}
            isJudging={isJudging}
            onExperimentChange={(id) => {
              setSelectedExperimentId(id);
              setReviewCaseIndex(0);
            }}
            onCaseChange={setReviewCaseIndex}
            onPause={() => {
              pauseRequestedRef.current = true;
              setMessage("Pausing after the current model response...");
            }}
            onCancel={() => {
              cancelRequestedRef.current = true;
              abortControllerRef.current?.abort();
            }}
            onResume={retryOrResume}
            onDelete={async () => {
              if (!selectedExperiment) {
                return;
              }
              await deleteExperiment(selectedExperiment.id);
              await refreshData();
            }}
            onEvaluate={(updater) =>
              updateHumanEvaluation(reviewCaseIndex, updater)
            }
            onJudge={() => judgeResult(reviewCaseIndex)}
            onJudgeAll={judgeAll}
          />
        ) : null}

        {tab === "results" ? (
          <ResultsPanel
            experiments={experiments}
            selectedExperiment={selectedExperiment}
            selectedExperimentId={selectedExperimentId}
            stats={stats}
            onExperimentChange={setSelectedExperimentId}
          />
        ) : null}
      </div>
    </main>
  );
}

function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg bg-[var(--panel-muted)] px-2 py-2">
      <p className="text-[9px] uppercase tracking-[0.1em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-[10px]">{value}</p>
    </div>
  );
}

function GuideStep({
  number,
  title,
  description,
  complete,
}: {
  number: string;
  title: string;
  description: string;
  complete: boolean;
}) {
  return (
    <div className="flex gap-3">
      <div
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold ${
          complete
            ? "bg-[var(--accent)] text-white"
            : "border border-[var(--accent)]/30 bg-white text-[var(--accent)]"
        }`}
      >
        {complete ? "✓" : number}
      </div>
      <div>
        <p className="text-[10px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[10px] leading-5 text-[var(--ink-secondary)]">
          {description}
        </p>
      </div>
    </div>
  );
}

function RuntimePanel({ models }: { models: RuntimeModel[] }) {
  return (
    <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-[12px] font-semibold">Ollama runtime</h3>
        <span className="font-mono text-[10px] text-[var(--ink-muted)]">
          {models.length} LOADED
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {models.length === 0 ? (
          <p className="text-[10px] text-[var(--ink-muted)]">
            No model is currently loaded in memory.
          </p>
        ) : (
          models.map((model) => (
            <div
              key={model.name}
              className="rounded-xl border border-[var(--line)] px-3 py-2"
            >
              <p className="truncate font-mono text-[10px]">{model.name}</p>
              <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
                VRAM {formatBytes(model.sizeVram)} · ctx{" "}
                {model.contextLength?.toLocaleString() ?? "--"} ·{" "}
                {model.quantizationLevel ?? "unknown quant"}
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type ReviewPanelProps = {
  experiments: Experiment[];
  selectedExperiment: Experiment | null;
  selectedExperimentId: string;
  selectedResult: ExperimentCaseResult | null;
  reviewCaseIndex: number;
  isRunning: boolean;
  isJudging: boolean;
  onExperimentChange: (id: string) => void;
  onCaseChange: (index: number) => void;
  onPause: () => void;
  onCancel: () => void;
  onResume: () => void;
  onDelete: () => void;
  onEvaluate: (
    updater: (evaluation: HumanEvaluation) => HumanEvaluation,
  ) => void;
  onJudge: () => void;
  onJudgeAll: () => void;
};

function ReviewPanel({
  experiments,
  selectedExperiment,
  selectedExperimentId,
  selectedResult,
  reviewCaseIndex,
  isRunning,
  isJudging,
  onExperimentChange,
  onCaseChange,
  onPause,
  onCancel,
  onResume,
  onDelete,
  onEvaluate,
  onJudge,
  onJudgeAll,
}: ReviewPanelProps) {
  if (!selectedExperiment || !selectedResult) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-[10px] text-[var(--ink-muted)]">
        먼저 실행 설정에서 모델 성능 평가를 시작하세요.
      </div>
    );
  }

  const progress =
    selectedExperiment.totalRuns > 0
      ? (selectedExperiment.currentRun /
          selectedExperiment.totalRuns) *
        100
      : 0;
  const evaluation = selectedResult.humanEvaluation;
  const isRevealed = Boolean(evaluation?.completedAt);
  const blindRuns = selectedResult.blindOrder.flatMap((runId) => {
    const run = selectedResult.runs.find(
      (candidate) => candidate.id === runId,
    );
    return run ? [run] : [];
  });
  const rubric = RUBRICS[selectedResult.category];
  const reviewIsComplete =
    Boolean(evaluation?.winnerRunId) &&
    blindRuns
      .filter((run) => run.status === "completed")
      .every((run) =>
        rubric.every(
          (criterion) =>
            typeof evaluation?.scores[run.id]?.[criterion.id] ===
            "number",
        ),
      );

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="mb-5 rounded-xl bg-[var(--accent-soft)] p-4">
          <p className="text-[10px] font-semibold text-[var(--accent)]">
            답변 평가 방법
          </p>
          <ol className="mt-2 grid gap-2 text-[10px] leading-5 text-[var(--ink-secondary)] sm:grid-cols-3">
            <li><strong>1.</strong> 각 답변의 항목별 점수를 선택합니다.</li>
            <li><strong>2.</strong> 가장 좋은 답변 하나를 선택합니다.</li>
            <li><strong>3.</strong> 평가 완료를 눌러 모델명을 확인합니다.</li>
          </ol>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <select
              value={selectedExperimentId}
              onChange={(event) => onExperimentChange(event.target.value)}
              className="max-w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[10px] font-semibold"
            >
              {experiments.map((experiment) => (
                <option key={experiment.id} value={experiment.id}>
                  {experiment.name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[10px] text-[var(--ink-muted)]">
              상태: {selectedExperiment.status} · 실행{" "}
              {selectedExperiment.currentRun}/{selectedExperiment.totalRuns}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isRunning ? (
              <>
                <button
                  type="button"
                  onClick={onPause}
                  className="rounded-lg border border-[var(--line)] px-3 py-2 text-[10px]"
                >
                  잠시 멈춤
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-lg border border-[var(--error)]/30 px-3 py-2 text-[10px] text-[var(--error)]"
                >
                  실행 취소
                </button>
              </>
            ) : selectedExperiment.status !== "completed" ? (
              <button
                type="button"
                onClick={onResume}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-[10px] font-semibold text-white"
              >
                이어서 실행 / 실패 재시도
              </button>
            ) : null}
            <button
              type="button"
              disabled={isJudging || selectedExperiment.status !== "completed"}
              onClick={onJudgeAll}
              className="rounded-lg border border-[var(--accent)]/30 px-3 py-2 text-[10px] text-[var(--accent)] disabled:opacity-40"
            >
              Judge로 전체 자동 평가
            </button>
            <button
              type="button"
              disabled={isRunning}
              onClick={onDelete}
              className="rounded-lg px-3 py-2 text-[10px] text-[var(--error)] disabled:opacity-40"
            >
              실험 삭제
            </button>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--panel-muted)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-2">
          {selectedExperiment.results.map((result, index) => (
            <button
              key={result.caseId}
              type="button"
              onClick={() => onCaseChange(index)}
              className={`w-full rounded-xl border p-3 text-left transition ${
                reviewCaseIndex === index
                  ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                  : "border-[var(--line)] bg-white"
              }`}
            >
              <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                CASE {String(index + 1).padStart(2, "0")}
              </span>
              <span className="mt-1 block text-[10px] leading-5">
                {result.prompt.slice(0, 70)}
              </span>
            </button>
          ))}
        </nav>

        <section className="min-w-0">
          <div className="rounded-2xl border border-[var(--line)] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full bg-[var(--panel-muted)] px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]">
                  {CATEGORY_LABELS[selectedResult.category]}
                </span>
                <p className="mt-3 text-[10px] leading-6">
                  {selectedResult.prompt}
                </p>
              </div>
              <button
                type="button"
                disabled={isJudging}
                onClick={onJudge}
                className="shrink-0 rounded-lg border border-[var(--accent)]/30 px-3 py-2 text-[10px] text-[var(--accent)] disabled:opacity-40"
              >
                {isJudging ? "자동 평가 중..." : "Judge 자동 평가 (선택)"}
              </button>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {blindRuns.map((run, index) => {
              const label = String.fromCharCode(65 + index);
              const scores = evaluation?.scores[run.id] ?? {};

              return (
                <article
                  key={run.id}
                  className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm"
                >
                  <header className="flex items-center justify-between border-b border-[var(--line)] bg-[var(--panel-muted)]/60 px-4 py-3">
                    <div>
                      <span className="font-mono text-[10px] font-bold">
                        RESPONSE {label}
                      </span>
                      {isRevealed ? (
                        <span className="ml-2 font-mono text-[10px] text-[var(--accent)]">
                          {run.model}
                        </span>
                      ) : null}
                    </div>
                    <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                      {run.metrics?.tokensPerSecond?.toFixed(1) ?? "--"} tok/s
                    </span>
                  </header>
                  <div className="max-h-96 overflow-y-auto p-4 text-[10px] leading-7 whitespace-pre-wrap">
                    {run.content ||
                      run.error ||
                      (run.status === "running"
                        ? "Generating..."
                        : "No response")}
                  </div>
                  {run.status === "completed" ? (
                    <div className="border-t border-[var(--line)] p-4">
                      <div className="grid grid-cols-2 gap-3">
                        {rubric.map((criterion) => (
                          <label
                            key={criterion.id}
                            className="text-[10px] text-[var(--ink-secondary)]"
                          >
                            {criterion.label}
                            <select
                              value={scores[criterion.id] ?? ""}
                              disabled={isRevealed}
                              onChange={(event) =>
                                onEvaluate((current) => ({
                                  ...current,
                                  scores: {
                                    ...current.scores,
                                    [run.id]: {
                                      ...current.scores[run.id],
                                      [criterion.id]: Number(
                                        event.target.value,
                                      ),
                                    },
                                  },
                                }))
                              }
                              className="mt-1 h-8 w-full rounded-lg border border-[var(--line)] bg-white px-2 text-[10px]"
                            >
                              <option value="">Score</option>
                              {[1, 2, 3, 4, 5].map((score) => (
                                <option key={score} value={score}>
                                  {score}
                                </option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                      <button
                        type="button"
                        disabled={isRevealed}
                        onClick={() =>
                          onEvaluate((current) => ({
                            ...current,
                            winnerRunId: run.id,
                          }))
                        }
                        className={`mt-3 h-9 w-full rounded-lg border text-[10px] font-semibold ${
                          evaluation?.winnerRunId === run.id
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]"
                            : "border-[var(--line)]"
                        }`}
                      >
                        {evaluation?.winnerRunId === run.id
                          ? "최고 답변으로 선택됨"
                          : "이 답변이 가장 좋음"}
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--line)] bg-white p-4">
            <textarea
              value={evaluation?.note ?? ""}
              disabled={isRevealed}
              onChange={(event) =>
                onEvaluate((current) => ({
                  ...current,
                  note: event.target.value,
                }))
              }
              rows={2}
              placeholder="평가 메모 (선택 사항)"
              className="w-full rounded-xl border border-[var(--line)] px-3 py-2 text-[10px]"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[10px] text-[var(--ink-muted)]">
                {isRevealed
                  ? "Review complete. Model identities revealed."
                  : "평가 완료 전까지 모델명은 숨겨집니다."}
              </p>
              {!isRevealed ? (
                <button
                  type="button"
                  disabled={!reviewIsComplete}
                  onClick={() =>
                    onEvaluate((current) => ({
                      ...current,
                      completedAt: new Date().toISOString(),
                    }))
                  }
                  className="rounded-lg bg-[var(--ink)] px-4 py-2 text-[10px] font-semibold text-white disabled:opacity-35"
                >
                  평가 완료하고 모델명 확인
                </button>
              ) : null}
            </div>
          </div>

          {selectedResult.judgeEvaluation ? (
            <div className="mt-4 rounded-2xl border border-[var(--accent)]/20 bg-[var(--accent-soft)] p-4">
              <p className="text-[10px] font-semibold text-[var(--accent)]">
                자동 평가 모델: {selectedResult.judgeEvaluation.judgeModel}
              </p>
              <p className="mt-1 text-[10px]">
                추천 모델: {selectedResult.judgeEvaluation.winnerModel} ·
                신뢰도{" "}
                {selectedResult.judgeEvaluation.confidence.toFixed(2)}
              </p>
              <p className="mt-2 text-[10px] leading-5 text-[var(--ink-secondary)]">
                {selectedResult.judgeEvaluation.rationale}
              </p>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

type ResultsPanelProps = {
  experiments: Experiment[];
  selectedExperiment: Experiment | null;
  selectedExperimentId: string;
  stats: ReturnType<typeof modelStats>;
  onExperimentChange: (id: string) => void;
};

function ResultsPanel({
  experiments,
  selectedExperiment,
  selectedExperimentId,
  stats,
  onExperimentChange,
}: ResultsPanelProps) {
  if (!selectedExperiment) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-10 text-center text-[10px] text-[var(--ink-muted)]">
        No benchmark results yet.
      </div>
    );
  }

  const maxSpeed = Math.max(
    1,
    ...stats.map((stat) => stat.tokensPerSecond ?? 0),
  );

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
        <div>
          <h3 className="text-[12px] font-semibold">Benchmark report</h3>
          <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
            Quality, blind wins, speed, and reliability in one view.
          </p>
        </div>
        <select
          value={selectedExperimentId}
          onChange={(event) => onExperimentChange(event.target.value)}
          className="max-w-full rounded-lg border border-[var(--line)] px-3 py-2 text-[10px]"
        >
          {experiments.map((experiment) => (
            <option key={experiment.id} value={experiment.id}>
              {experiment.name}
            </option>
          ))}
        </select>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Test cases"
          value={selectedExperiment.results.length}
        />
        <SummaryCard
          label="Completed runs"
          value={`${selectedExperiment.currentRun}/${selectedExperiment.totalRuns}`}
        />
        <SummaryCard
          label="Human reviews"
          value={
            selectedExperiment.results.filter(
              (result) => result.humanEvaluation?.completedAt,
            ).length
          }
        />
        <SummaryCard
          label="Judge reviews"
          value={
            selectedExperiment.results.filter(
              (result) => result.judgeEvaluation,
            ).length
          }
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] border-collapse text-left">
            <thead className="bg-[var(--panel-muted)] text-[10px] uppercase tracking-[0.1em] text-[var(--ink-muted)]">
              <tr>
                <th className="px-4 py-3">Model</th>
                <th className="px-4 py-3">Human</th>
                <th className="px-4 py-3">Judge</th>
                <th className="px-4 py-3">Blind wins</th>
                <th className="px-4 py-3">Tokens/sec</th>
                <th className="px-4 py-3">First token</th>
                <th className="px-4 py-3">Error rate</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat) => (
                <tr
                  key={stat.model}
                  className="border-t border-[var(--line)] text-[10px]"
                >
                  <td className="px-4 py-4 font-mono text-[10px]">
                    {stat.model}
                  </td>
                  <td className="px-4 py-4">
                    {stat.humanScore?.toFixed(2) ?? "--"}
                  </td>
                  <td className="px-4 py-4">
                    {stat.judgeScore?.toFixed(2) ?? "--"}
                  </td>
                  <td className="px-4 py-4">
                    {stat.winRate.toFixed(0)}%
                  </td>
                  <td className="px-4 py-4">
                    {stat.tokensPerSecond?.toFixed(1) ?? "--"}
                  </td>
                  <td className="px-4 py-4">
                    {formatDuration(stat.firstTokenTime)}
                  </td>
                  <td className="px-4 py-4">
                    {stat.errorRate.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
        <h3 className="text-[12px] font-semibold">Quality / speed profile</h3>
        <p className="mt-1 text-[10px] text-[var(--ink-muted)]">
          Longer bars are faster. Quality uses human scores first, then Judge
          scores.
        </p>
        <div className="mt-5 space-y-4">
          {stats.map((stat) => {
            const quality = stat.humanScore ?? stat.judgeScore ?? 0;
            const speedWidth =
              ((stat.tokensPerSecond ?? 0) / maxSpeed) * 100;

            return (
              <div
                key={stat.model}
                className="grid gap-2 sm:grid-cols-[220px_minmax(0,1fr)_80px]"
              >
                <span className="truncate font-mono text-[10px]">
                  {stat.model}
                </span>
                <div className="relative h-7 overflow-hidden rounded-lg bg-[var(--panel-muted)]">
                  <div
                    className="h-full bg-[var(--accent)]/75"
                    style={{ width: `${speedWidth}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-[10px] font-medium">
                    {stat.tokensPerSecond?.toFixed(1) ?? "--"} tok/s
                  </span>
                </div>
                <span className="text-right font-mono text-[10px]">
                  Q {quality ? quality.toFixed(2) : "--"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.12em] text-[var(--ink-muted)]">
        {label}
      </p>
      <p className="mt-2 font-mono text-xl font-semibold">{value}</p>
    </div>
  );
}
