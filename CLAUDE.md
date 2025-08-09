# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository demonstrates a comparative evaluation framework for agent implementations using local models and evaluation systems. It provides three integrated components:

1. **C# .NET (sk-ollama/)**: Semantic Kernel agent with Ollama backend and Azure Monitor telemetry
2. **TypeScript (agents-sdk-ts/)**: OpenAI Agents SDK with OTLP tracing
3. **Python (evals/)**: OpenAI evals framework for comparing both implementations

## Prerequisites

- Ollama running locally (`ollama serve`) with models pulled (e.g., `gpt-oss:120b`)
- .NET 8 SDK
- Node 20+
- Python 3.10+

## Development Commands

### .NET (sk-ollama/)
```bash
cd sk-ollama
# Run the console application
dotnet run

# Build the project
dotnet build

# Restore dependencies
dotnet restore
```

### TypeScript (agents-sdk-ts/)
```bash
cd agents-sdk-ts
# Install dependencies
npm install

# Run the agent
npx ts-node index.ts
# or
npm start
```

### Python Evals (evals/)
```bash
cd evals
# Set up virtual environment
python3 -m venv .venv && source .venv/bin/activate

# Install evals framework
pip install git+https://github.com/openai/evals.git

# Run evaluation against OpenAI hosted models
oaieval simple_eval data/simple_time_eval.jsonl -m gpt-4o-mini

# Run evaluation against local models (via LiteLLM proxy)
oaieval simple_eval data/simple_time_eval.jsonl -m gpt-oss:120b
```

## Architecture

### C# Implementation (sk-ollama/Program.cs:1-75)
- Uses Microsoft Semantic Kernel with Ollama connector
- Implements tool calling via `[KernelFunction]` attributes on methods
- Exports OpenTelemetry traces to Azure Monitor
- Service name: "SkOllamaAgent"

### TypeScript Implementation (agents-sdk-ts/index.ts:1-66)
- Uses OpenAI SDK with tool definitions
- Manual tool execution and response handling
- OTLP trace export via agents-sdk-ts/otel.ts:1-14
- Configurable base URL for local model proxies

### Common Tool Pattern
Both implementations provide a `get_local_time`/`Now()` function that returns ISO-8601 timestamps, enabling direct comparison in evaluations.

## Environment Configuration

### .NET Telemetry
Set either environment variable:
- `AZURE_MONITOR_CONNECTION_STRING`
- `APPINSIGHTS_CONNECTION_STRING`

### TypeScript Configuration
- `OPENAI_API_KEY`: Required for OpenAI hosted models
- `OPENAI_BASE_URL`: Optional for local model proxies (e.g., `http://localhost:4000/v1`)
- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP endpoint (defaults to `http://localhost:4318/v1/traces`)

### Local Model Proxy (Optional)
```bash
# Run LiteLLM proxy for Ollama compatibility
pip install litellm
litellm --model ollama/gpt-oss:120b --base-url http://localhost:11434 --port 4000
```

## Model Configuration

- Default .NET model: `"gpt-oss:120b"` (configurable in sk-ollama/Program.cs:40)
- Default TypeScript model: `"gpt-4o-mini"` (configurable in agents-sdk-ts/index.ts:29)
- Eval data: Simple time query in evals/data/simple_time_eval.jsonl:1

## Getting Started

1. Ensure Ollama is running: `ollama serve`
2. Verify your model is available: `ollama list` (should show gpt-oss:120b)
3. Test .NET component: `cd sk-ollama && dotnet run`
4. Test TypeScript component: `cd agents-sdk-ts && npm install && npx ts-node index.ts`
5. Run evals to compare both implementations