export type ChatRole = "system" | "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ModelInfo = {
  name: string;
  modified_at?: string;
  size?: number;
};

export type ChatSettings = {
  model: string;
  temperature: number;
  top_p: number;
  num_ctx: number;
  systemPrompt: string;
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
