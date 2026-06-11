import type { ChatSettings } from "@/lib/types";

export const DEFAULT_MODEL = "gemma4:e4b";

export const DEFAULT_SETTINGS: ChatSettings = {
  mode: "single",
  model: DEFAULT_MODEL,
  compareModels: [],
  judgeModel: "",
  temperature: 0.7,
  top_p: 0.9,
  num_ctx: 4096,
  systemPrompt: "",
};

export const CONTEXT_LENGTHS = [2048, 4096, 8192] as const;
