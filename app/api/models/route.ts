import { NextResponse } from "next/server";

import {
  getOllamaBaseUrl,
  normalizeModels,
  ollamaConnectionErrorMessage,
} from "@/lib/ollama";
import type { RuntimeModel } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const baseUrl = getOllamaBaseUrl();
    const [response, runtimeResponse] = await Promise.all([
      fetch(`${baseUrl}/api/tags`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }),
      fetch(`${baseUrl}/api/ps`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null),
    ]);

    if (!response.ok) {
      console.error("Ollama models request failed:", response.status);
      return NextResponse.json(
        { message: "Could not load models from Ollama. Please try again." },
        { status: 502 },
      );
    }

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) {
      return NextResponse.json(
        { message: "Ollama returned an invalid model list." },
        { status: 502 },
      );
    }

    let runtimeModels: RuntimeModel[] = [];
    if (runtimeResponse?.ok) {
      const runtimePayload = (await runtimeResponse.json()) as {
        models?: Array<{
          name?: unknown;
          size_vram?: unknown;
          context_length?: unknown;
          details?: {
            parameter_size?: unknown;
            quantization_level?: unknown;
          };
        }>;
      };
      runtimeModels = Array.isArray(runtimePayload.models)
        ? runtimePayload.models.flatMap((model) =>
            typeof model.name === "string"
              ? [{
                  name: model.name,
                  ...(typeof model.size_vram === "number"
                    ? { sizeVram: model.size_vram }
                    : {}),
                  ...(typeof model.context_length === "number"
                    ? { contextLength: model.context_length }
                    : {}),
                  ...(typeof model.details?.parameter_size === "string"
                    ? { parameterSize: model.details.parameter_size }
                    : {}),
                  ...(typeof model.details?.quantization_level === "string"
                    ? { quantizationLevel: model.details.quantization_level }
                    : {}),
                }]
              : [],
          )
        : [];
    }

    const models = normalizeModels(payload).map((model) => {
      const runtime = runtimeModels.find(
        (candidate) => candidate.name === model.name,
      );
      return {
        ...model,
        loaded: Boolean(runtime),
        ...(runtime ?? {}),
      };
    });

    return NextResponse.json({ models });
  } catch (error) {
    console.error("Failed to connect to Ollama:", error);
    return NextResponse.json(
      { message: ollamaConnectionErrorMessage() },
      { status: 503 },
    );
  }
}
