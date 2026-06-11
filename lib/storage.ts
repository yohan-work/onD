import { CONTEXT_LENGTHS, DEFAULT_SETTINGS } from "@/lib/constants";
import type { ChatSettings } from "@/lib/types";

export const SETTINGS_STORAGE_KEY = "ollama-chat-lab:settings";
const SETTINGS_VERSION = 3;

type StoredSettings = {
  version: number;
  settings: ChatSettings;
};

type V1ChatSettings = Omit<
  ChatSettings,
  "mode" | "compareModels" | "judgeModel"
>;

type V1StoredSettings = {
  version: 1;
  settings: V1ChatSettings;
};

type V2StoredSettings = {
  version: 2;
  settings: Omit<ChatSettings, "judgeModel">;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function loadSettings(): ChatSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }

    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("version" in parsed) ||
      ![1, 2, SETTINGS_VERSION].includes(Number(parsed.version)) ||
      !("settings" in parsed) ||
      typeof parsed.settings !== "object" ||
      parsed.settings === null
    ) {
      return DEFAULT_SETTINGS;
    }

    const settings = parsed.settings as Partial<ChatSettings>;
    const validContextLengths: readonly number[] = CONTEXT_LENGTHS;
    const version = Number(
      (parsed as V1StoredSettings | V2StoredSettings | StoredSettings).version,
    );

    return {
      mode:
        version >= 2 &&
        (settings.mode === "single" ||
          settings.mode === "compare" ||
          settings.mode === "lab")
          ? settings.mode
          : DEFAULT_SETTINGS.mode,
      model:
        typeof settings.model === "string" && settings.model.length > 0
          ? settings.model
          : DEFAULT_SETTINGS.model,
      compareModels:
        version >= 2 && Array.isArray(settings.compareModels)
          ? settings.compareModels.filter(
              (model): model is string => typeof model === "string",
            )
          : DEFAULT_SETTINGS.compareModels,
      judgeModel:
        version >= 3 && typeof settings.judgeModel === "string"
          ? settings.judgeModel
          : DEFAULT_SETTINGS.judgeModel,
      temperature:
        isFiniteNumber(settings.temperature) &&
        settings.temperature >= 0 &&
        settings.temperature <= 2
          ? settings.temperature
          : DEFAULT_SETTINGS.temperature,
      top_p:
        isFiniteNumber(settings.top_p) &&
        settings.top_p >= 0 &&
        settings.top_p <= 1
          ? settings.top_p
          : DEFAULT_SETTINGS.top_p,
      num_ctx:
        isFiniteNumber(settings.num_ctx) &&
        validContextLengths.includes(settings.num_ctx)
          ? settings.num_ctx
          : DEFAULT_SETTINGS.num_ctx,
      systemPrompt:
        typeof settings.systemPrompt === "string"
          ? settings.systemPrompt
          : DEFAULT_SETTINGS.systemPrompt,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ChatSettings) {
  const value: StoredSettings = {
    version: SETTINGS_VERSION,
    settings,
  };

  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value));
}
