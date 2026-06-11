import { NextResponse } from "next/server";

import {
  getOllamaBaseUrl,
  ollamaConnectionErrorMessage,
} from "@/lib/ollama";
import type { RuntimeModel } from "@/lib/types";

export const dynamic = "force-dynamic";

type RuntimePayload = {
  models?: Array<{
    name?: unknown;
    size_vram?: unknown;
    context_length?: unknown;
    expires_at?: unknown;
    details?: {
      parameter_size?: unknown;
      quantization_level?: unknown;
    };
  }>;
};

export async function GET() {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/ps`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { message: "Could not load Ollama runtime information." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as RuntimePayload;
    const models: RuntimeModel[] = Array.isArray(payload.models)
      ? payload.models.flatMap((model) => {
          if (typeof model.name !== "string") {
            return [];
          }

          return [
            {
              name: model.name,
              ...(typeof model.size_vram === "number"
                ? { sizeVram: model.size_vram }
                : {}),
              ...(typeof model.context_length === "number"
                ? { contextLength: model.context_length }
                : {}),
              ...(typeof model.expires_at === "string"
                ? { expiresAt: model.expires_at }
                : {}),
              ...(typeof model.details?.parameter_size === "string"
                ? { parameterSize: model.details.parameter_size }
                : {}),
              ...(typeof model.details?.quantization_level === "string"
                ? { quantizationLevel: model.details.quantization_level }
                : {}),
            },
          ];
        })
      : [];

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Failed to load Ollama runtime information:", error);
    return NextResponse.json(
      { message: ollamaConnectionErrorMessage() },
      { status: 503 },
    );
  }
}
