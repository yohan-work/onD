import { afterEach, describe, expect, it, vi } from "vitest";

import { streamChat } from "@/lib/chat-stream";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamChat", () => {
  it("parses split NDJSON and captures final metrics", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('{"message":{"content":"Hel'));
        controller.enqueue(
          encoder.encode(
            'lo"}}\ninvalid\n{"message":{"content":" world"}}\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            '{"done":true,"prompt_eval_count":12,"eval_count":20,"eval_duration":2000000000,"done_reason":"stop"}\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(body, { status: 200 })),
    );
    const chunks: string[] = [];

    const result = await streamChat({
      model: "test",
      messages: [{ role: "user", content: "hello" }],
      settings: { temperature: 0, top_p: 1, num_ctx: 2048 },
      onContent: (content) => chunks.push(content),
    });

    expect(chunks.join("")).toBe("Hello world");
    expect(result.metrics.promptEvalCount).toBe(12);
    expect(result.metrics.tokensPerSecond).toBe(10);
  });

  it("surfaces API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({ message: "model unavailable" }, { status: 503 }),
      ),
    );

    await expect(
      streamChat({
        model: "missing",
        messages: [],
        settings: { temperature: 0, top_p: 1, num_ctx: 2048 },
        onContent: () => undefined,
      }),
    ).rejects.toThrow("model unavailable");
  });
});
