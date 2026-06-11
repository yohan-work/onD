import { NextResponse } from "next/server";

import {
  getOllamaBaseUrl,
  normalizeModels,
  ollamaConnectionErrorMessage,
} from "@/lib/ollama";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

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

    return NextResponse.json({ models: normalizeModels(payload) });
  } catch (error) {
    console.error("Failed to connect to Ollama:", error);
    return NextResponse.json(
      { message: ollamaConnectionErrorMessage() },
      { status: 503 },
    );
  }
}
