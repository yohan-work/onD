import { streamChat } from "@/lib/chat-stream";
import { updateRun } from "@/lib/benchmark-engine";
import type { Experiment } from "@/lib/types";

type StreamChat = typeof streamChat;

type RunBenchmarkOptions = {
  commit: (experiment: Experiment) => Promise<void>;
  onStream: (experiment: Experiment) => void;
  onController: (controller: AbortController | null) => void;
  shouldPause: () => boolean;
  shouldCancel: () => boolean;
  stream?: StreamChat;
};

export async function runBenchmarkExperiment(
  initialExperiment: Experiment,
  {
    commit,
    onStream,
    onController,
    shouldPause,
    shouldCancel,
    stream = streamChat,
  }: RunBenchmarkOptions,
) {
  let working: Experiment = {
    ...initialExperiment,
    status: "running",
    updatedAt: new Date().toISOString(),
  };
  await commit(working);

  for (const model of working.models) {
    for (const result of working.results) {
      const run = result.runs.find((candidate) => candidate.model === model);
      if (!run || run.status === "completed") continue;

      if (shouldPause()) {
        working = { ...working, status: "paused" };
        await commit(working);
        return working;
      }
      if (shouldCancel()) {
        working = { ...working, status: "cancelled" };
        await commit(working);
        return working;
      }

      working = updateRun(working, run.id, (current) => ({
        ...current,
        content: "",
        status: "running",
        error: null,
        metrics: null,
      }));
      await commit(working);

      let content = "";
      const controller = new AbortController();
      onController(controller);
      try {
        const streamResult = await stream({
          model,
          messages: [
            ...(working.settings.systemPrompt.trim()
              ? [{
                  role: "system" as const,
                  content: working.settings.systemPrompt.trim(),
                }]
              : []),
            { role: "user", content: result.prompt },
          ],
          settings: working.settings,
          signal: controller.signal,
          onContent: (chunk) => {
            content += chunk;
            working = updateRun(working, run.id, (current) => ({
              ...current,
              content,
            }));
            onStream(working);
          },
        });
        working = updateRun(working, run.id, (current) => ({
          ...current,
          content,
          status: "completed",
          metrics: streamResult.metrics,
        }));
      } catch (error) {
        working = updateRun(working, run.id, (current) => ({
          ...current,
          content,
          status: shouldCancel() ? "pending" : "error",
          error: shouldCancel()
            ? null
            : error instanceof Error
              ? error.message
              : "Model execution failed.",
        }));
      } finally {
        onController(null);
      }

      working = {
        ...working,
        currentRun: working.currentRun + 1,
      };
      await commit(working);
    }
  }

  working = {
    ...working,
    status: shouldCancel() ? "cancelled" : "completed",
    updatedAt: new Date().toISOString(),
  };
  await commit(working);
  return working;
}
