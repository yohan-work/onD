export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type MessageStatus = "complete" | "streaming" | "stopped" | "error";

export type TextAttachment = {
  id: string;
  name: string;
  type: "text/plain" | "text/markdown";
  size: number;
  content: string;
};

export type StoredMessage = ChatMessage & {
  id: string;
  createdAt: string;
  status: MessageStatus;
  metrics?: GenerationMetrics | null;
  attachments?: TextAttachment[];
};

export type ConversationBranch = {
  sourceConversationId: string;
  sourceMessageId: string;
};

export type Conversation = {
  id: string;
  title: string;
  mode: "single";
  model: string;
  settings: Pick<
    ChatSettings,
    "temperature" | "top_p" | "num_ctx" | "systemPrompt"
  >;
  messages: StoredMessage[];
  favorite: boolean;
  branch: ConversationBranch | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatMode = "single" | "compare" | "lab";

export type ModelInfo = {
  name: string;
  modified_at?: string;
  size?: number;
  loaded?: boolean;
  sizeVram?: number;
  parameterSize?: string;
  quantizationLevel?: string;
  contextLength?: number;
};

export type ChatSettings = {
  mode: ChatMode;
  model: string;
  compareModels: string[];
  judgeModel: string;
  temperature: number;
  top_p: number;
  num_ctx: number;
  systemPrompt: string;
};

export type ModelResponseStatus =
  | "queued"
  | "streaming"
  | "completed"
  | "error";

export type ModelResponse = {
  model: string;
  content: string;
  status: ModelResponseStatus;
  responseTime: number | null;
  error: string | null;
  metrics?: GenerationMetrics | null;
};

export type CompareTurn = {
  id: string;
  prompt: string;
  responses: ModelResponse[];
};

export type ConnectionStatus = "checking" | "connected" | "disconnected";

export type ModelListResponse = {
  models: ModelInfo[];
};

export type ChatRequest = {
  model: string;
  messages: ChatMessage[];
  options?: {
    temperature?: number;
    top_p?: number;
    num_ctx?: number;
  };
  format?: "json" | Record<string, unknown>;
  stream?: boolean;
};

export type GenerationMetrics = {
  totalDuration: number | null;
  loadDuration: number | null;
  promptEvalCount: number | null;
  promptEvalDuration: number | null;
  evalCount: number | null;
  evalDuration: number | null;
  tokensPerSecond: number | null;
  firstTokenTime: number | null;
  doneReason: string | null;
};

export type RuntimeModel = {
  name: string;
  parameterSize?: string;
  quantizationLevel?: string;
  sizeVram?: number;
  contextLength?: number;
  expiresAt?: string;
};

export type TaskCategory =
  | "general"
  | "summary"
  | "code"
  | "translation"
  | "qa"
  | "instruction";

export type RubricCriterion = {
  id: string;
  label: string;
  weight: number;
};

export type BenchmarkCase = {
  id: string;
  title: string;
  prompt: string;
  category: TaskCategory;
};

export type BenchmarkSuite = {
  id: string;
  name: string;
  description: string;
  cases: BenchmarkCase[];
  createdAt: string;
  updatedAt: string;
};

export type HumanEvaluation = {
  winnerRunId: string | null;
  scores: Record<string, Record<string, number>>;
  note: string;
  completedAt: string | null;
};

export type JudgeEvaluation = {
  winnerModel: string;
  scores: Record<string, Record<string, number>>;
  rationale: string;
  confidence: number;
  judgeModel: string;
  completedAt: string;
};

export type BenchmarkRun = {
  id: string;
  caseId: string;
  model: string;
  content: string;
  status: "pending" | "running" | "completed" | "error";
  error: string | null;
  metrics: GenerationMetrics | null;
};

export type ExperimentCaseResult = {
  caseId: string;
  prompt: string;
  category: TaskCategory;
  runs: BenchmarkRun[];
  blindOrder: string[];
  humanEvaluation: HumanEvaluation | null;
  judgeEvaluation: JudgeEvaluation | null;
};

export type Experiment = {
  id: string;
  name: string;
  suiteId: string;
  suiteName: string;
  models: string[];
  judgeModel: string;
  settings: Pick<
    ChatSettings,
    "temperature" | "top_p" | "num_ctx" | "systemPrompt"
  >;
  status: "draft" | "running" | "paused" | "completed" | "cancelled";
  currentRun: number;
  totalRuns: number;
  results: ExperimentCaseResult[];
  createdAt: string;
  updatedAt: string;
};
