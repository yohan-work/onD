import { NextRequest, NextResponse } from "next/server";

import {
  getOllamaBaseUrl,
  ollamaConnectionErrorMessage,
  readOllamaError,
} from "@/lib/ollama";
import type { ChatMessage, ChatRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_ROLES = new Set(["system", "user", "assistant"]);

function isChatMessage(value: unknown): value is ChatMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "role" in value &&
    typeof value.role === "string" &&
    VALID_ROLES.has(value.role) &&
    "content" in value &&
    typeof value.content === "string"
  );
}

function isNumberInRange(
  value: unknown,
  minimum: number,
  maximum: number,
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function validateRequest(value: unknown): value is ChatRequest {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const body = value as Partial<ChatRequest>;
  if (
    typeof body.model !== "string" ||
    body.model.trim().length === 0 ||
    !Array.isArray(body.messages) ||
    !body.messages.every(isChatMessage)
  ) {
    return false;
  }

  if (body.options === undefined) {
    return validateExtendedFields(body);
  }

  if (typeof body.options !== "object" || body.options === null) {
    return false;
  }

  const { temperature, top_p: topP, num_ctx: numCtx } = body.options;

  return (
    (temperature === undefined || isNumberInRange(temperature, 0, 2)) &&
    (topP === undefined || isNumberInRange(topP, 0, 1)) &&
    (numCtx === undefined ||
      (Number.isInteger(numCtx) &&
        isNumberInRange(numCtx, 1, 1_048_576))) &&
    validateExtendedFields(body)
  );
}

function validateExtendedFields(body: Partial<ChatRequest>) {
  const validFormat =
    body.format === undefined ||
    body.format === "json" ||
    (typeof body.format === "object" &&
      body.format !== null &&
      !Array.isArray(body.format));

  return (
    validFormat &&
    (body.stream === undefined || typeof body.stream === "boolean")
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "The request body must be valid JSON." },
      { status: 400 },
    );
  }

  if (!validateRequest(body)) {
    return NextResponse.json(
      {
        message:
          "Invalid chat request. Provide a model, messages, and valid model options.",
      },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        model: body.model.trim(),
        stream: body.stream ?? true,
      }),
      signal: request.signal,
    });

    if (!response.ok) {
      const message = await readOllamaError(response);
      console.error("Ollama chat request failed:", response.status, message);
      return NextResponse.json({ message }, { status: response.status });
    }

    if (!response.body) {
      return NextResponse.json(
        { message: "Ollama returned an empty response stream." },
        { status: 502 },
      );
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type":
          body.stream === false
            ? "application/json; charset=utf-8"
            : "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    console.error("Failed to connect to Ollama:", error);
    return NextResponse.json(
      { message: ollamaConnectionErrorMessage() },
      { status: 503 },
    );
  }
}
