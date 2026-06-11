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
- Stream chat responses in real time
- Preserve conversation history within the current session
- Configure temperature, top-p, and context length
- Add an optional system prompt
- Clear the current conversation without resetting settings
- Persist model settings in `localStorage`
- Show Ollama connection state and response duration
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

This release supports independent parallel model responses. It intentionally
excludes model-to-model debate, a final synthesizer model, accounts, databases,
cloud deployment, RAG, file uploads, multimodal input, long-term memory, and
Markdown rendering.

## Roadmap

- Model debate and final synthesis workflows
- Prompt template management
- Saved and searchable chat sessions
- Markdown rendering and code highlighting
- Response ratings and model scorecards
- Text and Markdown file summarization
- Link summarization and archiving
- Markdown export and Obsidian integration
