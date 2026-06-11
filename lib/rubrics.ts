import type {
  RubricCriterion,
  TaskCategory,
} from "@/lib/types";

export const CATEGORY_LABELS: Record<TaskCategory, string> = {
  general: "General",
  summary: "Summary",
  code: "Code",
  translation: "Translation",
  qa: "Q&A",
  instruction: "Instruction",
};

export const RUBRICS: Record<TaskCategory, RubricCriterion[]> = {
  general: [
    { id: "accuracy", label: "Accuracy", weight: 0.35 },
    { id: "relevance", label: "Relevance", weight: 0.25 },
    { id: "clarity", label: "Clarity", weight: 0.2 },
    { id: "completeness", label: "Completeness", weight: 0.2 },
  ],
  summary: [
    { id: "coverage", label: "Key point coverage", weight: 0.3 },
    { id: "faithfulness", label: "Faithfulness", weight: 0.35 },
    { id: "compression", label: "Compression", weight: 0.2 },
    { id: "clarity", label: "Clarity", weight: 0.15 },
  ],
  code: [
    { id: "correctness", label: "Correctness", weight: 0.35 },
    { id: "runnability", label: "Runnability", weight: 0.25 },
    { id: "robustness", label: "Robustness", weight: 0.2 },
    { id: "explanation", label: "Explanation", weight: 0.2 },
  ],
  translation: [
    { id: "meaning", label: "Meaning preserved", weight: 0.4 },
    { id: "naturalness", label: "Naturalness", weight: 0.3 },
    { id: "terminology", label: "Terminology", weight: 0.2 },
    { id: "style", label: "Style", weight: 0.1 },
  ],
  qa: [
    { id: "factuality", label: "Factuality", weight: 0.4 },
    { id: "directness", label: "Directness", weight: 0.2 },
    { id: "reasoning", label: "Reasoning", weight: 0.25 },
    { id: "clarity", label: "Clarity", weight: 0.15 },
  ],
  instruction: [
    { id: "compliance", label: "Instruction compliance", weight: 0.4 },
    { id: "format", label: "Format accuracy", weight: 0.25 },
    { id: "accuracy", label: "Accuracy", weight: 0.2 },
    { id: "conciseness", label: "Conciseness", weight: 0.15 },
  ],
};

export function weightedScore(
  category: TaskCategory,
  scores: Record<string, number> | undefined,
) {
  if (!scores) {
    return null;
  }

  const rubric = RUBRICS[category];
  const scored = rubric.filter(
    (criterion) => typeof scores[criterion.id] === "number",
  );
  if (scored.length !== rubric.length) {
    return null;
  }

  return scored.reduce(
    (total, criterion) =>
      total + scores[criterion.id] * criterion.weight,
    0,
  );
}
