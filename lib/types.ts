export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatMode = "single" | "compare";

export type ModelInfo = {
  name: string;
  modified_at?: string;
  size?: number;
};

export type ChatSettings = {
  mode: ChatMode;
  model: string;
  compareModels: string[];
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
};
