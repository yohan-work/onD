# Ollama Chat Lab

Ollama Chat Lab is a local web UI for testing Ollama models such as
`gemma4:e4b`. It provides a focused ChatGPT-style conversation flow while
keeping model inference on the local machine.

### 26.06.11(for model testing)
<img width="1794" height="921" alt="multiAgent" src="https://github.com/user-attachments/assets/e0ff31cb-ec33-46ad-a0e1-65eb83f86300" />


## Features

- Load and select locally installed Ollama models
- Switch between single-model chat and multi-model comparison
- Send one prompt to 2-4 models in parallel
- Compare independent streaming responses and response times
- Build reusable benchmark suites and run models sequentially
- Capture prompt/output tokens, first-token latency, and tokens/sec
- Review responses blind with task-specific scoring rubrics
- Use a dedicated local Ollama model as an optional Judge
- Store experiments locally in IndexedDB with JSON import/export
- Compare quality, blind win rate, speed, and error rate
- Stream chat responses in real time
- Stop, regenerate, or continue streaming responses
- Save, search, rename, favorite, delete, and restore conversations locally
- Edit a previous user message into a branched conversation
- Render Markdown, tables, links, and copyable code blocks
- Attach up to four local text or Markdown files per message
- Estimate system, history, input, and attachment context usage before sending
- Reserve 25% of the selected context for output and trim oldest turns safely
- Compare estimated prompt tokens with Ollama's actual prompt token count
- Export conversations as JSON or Markdown
- Turn saved conversation prompts into a benchmark suite
- Configure temperature, top-p, and context length
- Add an optional system prompt
- Clear the current conversation without resetting settings
- Persist model settings in `localStorage`
- Show Ollama connection, installed/loaded model details, and response duration
- Responsive desktop and mobile layouts

## Prerequisites

Install Ollama, start the local server, and download at least one model:

```bash
ollama serve
ollama pull gemma4:e4b
ollama list
```

By default, Ollama Chat Lab connects to `http://localhost:11434`.

## Getting Started

Install dependencies and start the Next.js development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), select a model, and enter
a message. Press Enter to send or Shift+Enter to insert a new line.

## Compare Mode

Select `Compare` in the header, then choose 2 to 4 installed models from the
sidebar. A prompt is sent to every selected model at the same time and each
response streams into its own card.

All models use the same temperature, top-p, context length, and system prompt
so their output can be compared under consistent conditions. On later turns,
each model receives the user conversation plus only its own completed previous
responses. A failed model can be retried without rerunning successful models.

## Evaluation Lab

Select `Lab` in the header to open the local benchmark workspace.

### Quick start

1. Click `성능 평가` in the header.
2. Keep the prepared starter test suite selected.
3. Confirm that at least two target models are checked. The app automatically
   selects two available models on first use.
4. Click `모델 성능 평가 시작`.
5. When each response is ready, score every item from 1 to 5 and choose the
   best response.
6. Click `평가 완료하고 모델명 확인`.
7. Open `3. 결과 보기` to compare quality and speed.

The Judge model, custom test suites, runtime details, and JSON backup are
optional advanced features hidden behind expandable controls.

Models execute sequentially to reduce VRAM contention
   and keep performance measurements comparable.

Benchmark suites, model runs, evaluations, and metrics are stored in browser
IndexedDB. Saved conversations and their text attachments use the same local
database. Settings remain in `localStorage`. The Lab can export and import a
complete JSON backup.

## Saved Conversations

Single-model chats are saved automatically in the browser. Use the sidebar to
search message content, rename or favorite a conversation, export it, or create
a benchmark suite from its user prompts. Choosing **Edit & branch** on a user
message creates an independent conversation without changing the source.

Text attachments are read entirely in the browser and included in the model
context. The app accepts `.txt`, `.md`, and `.markdown` files up to 256 KB each.
Files are never uploaded to an external service.

## Context Management

Single-model chat uses 75% of the selected context length for input and reserves
25% for the response. The system prompt, current message, and current
attachments are always preserved. When history does not fit, the oldest
user/assistant turns are omitted from the Ollama request while the full saved
conversation remains unchanged.

Token counts are local estimates. After generation, the response metadata shows
Ollama's actual `prompt_eval_count` when available.

## Architecture

- `hooks/use-ollama-models.ts`: model discovery and connection state
- `hooks/use-conversations.ts`: IndexedDB conversation lifecycle
- `hooks/use-single-chat.ts`: context planning and single-model generation
- `hooks/use-compare-chat.ts`: independent parallel comparison
- `lib/benchmark-runner.ts`: sequential benchmark state transitions
- `lib/context-planner.ts`: token estimation and turn-level trimming

The current task rubrics cover general answers, summarization, code,
translation, factual Q&A, and strict instruction following.

## Environment Variables

Copy the example environment file if the Ollama server uses a different host
or port:

```bash
cp .env.example .env.local
```

```env
OLLAMA_BASE_URL=http://localhost:11434
```

`OLLAMA_BASE_URL` is only read by the Next.js server. The browser communicates
with the local Next.js API routes rather than calling Ollama directly.

## Available Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
npm run start
```

## API Routes

### `GET /api/models`

Proxies Ollama's `/api/tags` endpoint and returns:

```json
{
  "models": [
    {
      "name": "gemma4:e4b",
      "modified_at": "2026-06-11T00:00:00Z",
      "size": 0
    }
  ]
}
```

### `POST /api/chat`

Accepts the selected model, conversation history, and generation options. The
response is streamed as Ollama NDJSON.

```json
{
  "model": "gemma4:e4b",
  "messages": [{ "role": "user", "content": "Hello" }],
  "options": {
    "temperature": 0.7,
    "top_p": 0.9,
    "num_ctx": 4096
  }
}
```

The proxy also accepts Ollama `format` JSON schemas for structured local Judge
output. The final stream chunk is preserved so the client can calculate model
performance metrics.

### `GET /api/runtime`

Proxies Ollama's `/api/ps` endpoint and returns currently loaded models,
available VRAM information, quantization level, and active context length.

## Troubleshooting

### Ollama is not running

Start the local service:

```bash
ollama serve
```

### No models are available

Download the default model or another supported Ollama model:

```bash
ollama pull gemma4:e4b
```

### A model rejects an option

Context limits vary by model. Select a lower context length or adjust the
generation controls, then retry the request.

## Current Scope

This release supports independent parallel comparison and sequential benchmark
evaluation. All inference and Judge evaluation use locally installed Ollama
models. It intentionally excludes cloud models, model-to-model debate, a final
synthesizer model, accounts, server databases, RAG, file uploads, multimodal
input, and long-term memory.

## Roadmap

- Model debate and final synthesis workflows
- Prompt template management and variables
- Historical trend comparison across repeated benchmark runs
- Context budgeting and conversation compaction
- Link summarization and archiving
- Obsidian vault integration
