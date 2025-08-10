# Agent + Local Model + Evals — Starter Repo

This repo gives you a side‑by‑side harness to compare:
- **A. .NET Semantic Kernel + Ollama (local model)** with OpenTelemetry → Azure Monitor
- **B. OpenAI Agents SDK (TypeScript/Node)** with a simple tool and OTLP tracing
- **C. Evals (Python)** to score both approaches with the same prompts

> Tested on macOS with VS Code. Assumes Ollama is installed and running.

## 📊 System in Action

### OpenAI Dashboard - Agent Workflows
![OpenAI Agent Workflows](images/2025-08-09_12-34-39.png)

*Agent workflows showing successful TimeAgent executions with proper tracing*

### Comprehensive Testing Results  
![Testing Results](images/2025-08-09_12-28-26.png)

*OpenAI Dashboard showing comprehensive test results with tool call traces*

### Azure Application Insights - KQL Query Results

#### Items Ingested Overview
![Items Ingested Chart](images/itemsinjested_chart.png)
![Items Ingested Results](images/itemsinjested_result.png)

*Azure Application Insights showing ingested telemetry data from the agents-sdk-ts service*

#### Conversation Rollup with Trace ID
![Conversation Rollup Chart](images/convorollupwithtraceid_chart.png)  
![Conversation Rollup Results](images/convorollupwithtraceid_result.png)

*KQL query results showing complete conversation flows with OpenAI trace ID correlation*

#### Latency Analysis
![Latency Chart](images/latency_chart.png)
![Latency Results](images/latency_result.png)

*Performance metrics showing request latency across agent operations*

#### OpenAI Trace ID Correlation
![OpenAI Trace ID Chart](images/openaitraceIdfound_chart.png)
![OpenAI Trace ID Results](images/openaitraceIdfound_result.png)

*Verification that OpenAI trace IDs are properly propagated to Azure Application Insights*

#### Latest Message Analysis
![Latest Message Chart](images/appinsights_lastmessagesent_chart.png)
![Latest Message Results](images/appinsights_lastmessagesent_result.png)

*Most recent agent execution with complete query/response details in Azure Application Insights*

> 💡 **Pro Tip**: See our [detailed tracing guide](README-TRACING-GUIDE.md) for complete setup instructions and troubleshooting tips.

---

## Prereqs

- macOS (Apple Silicon is great), VS Code
- **Ollama** running locally (`brew install ollama`), then `ollama serve`
- **.NET 8 SDK** (`dotnet --version`)
- **Node 20+** (`node --version`)
- **Python 3.10+** (`python3 --version`)

Optional (for unified telemetry):
- OpenTelemetry Collector (local) or Azure Monitor connection string

---

## A) .NET: Semantic Kernel + Ollama + OpenTelemetry

```bash
cd sk-ollama
# Make sure your local model exists (pull once)
ollama pull gpt-oss-120b
# or use a tool-capable model like llama3.1:70b or qwen2:72b if desired

# Set Azure Monitor connection (or use your existing Collector/OTLP path)
export AZURE_MONITOR_CONNECTION_STRING="InstrumentationKey=...;IngestionEndpoint=..."
dotnet run
```
You should see console output from the chat. In Azure Monitor (or your OTel backend), search for service name **SkOllamaAgent**.

> If your `gpt-oss-120b` build doesn't support function/tool calling natively, the sample still runs; SK will fall back to normal chat. You can also swap the modelId to one that supports tools in Ollama.

---

## B) OpenAI Agents SDK (Node/TypeScript) + OTLP traces

1) Use **OpenAI hosted** model first (easiest):
```bash
cd agents-sdk-ts
cp .env.example .env
# put OPENAI_API_KEY in .env
npm install
npx ts-node index.ts
```

2) **(Optional)** To point the SDK at your **local Ollama** via an OpenAI-compatible proxy, run LiteLLM:
```bash
# in another terminal
pip install litellm
litellm --model ollama/gpt-oss-120b --base-url http://localhost:11434 --port 4000
# then:
export OPENAI_BASE_URL="http://localhost:4000/v1"
npx ts-node index.ts
```
You’ll see a tool call to `get_local_time` and the final answer.

Telemetry: this sample exports OTLP traces to `http://localhost:4318/v1/traces` by default. Change the endpoint via env `OTEL_EXPORTER_OTLP_ENDPOINT` if needed.

---

## C) Evals (Python)

```bash
cd evals
python3 -m venv .venv && source .venv/bin/activate
pip install git+https://github.com/openai/evals.git
# OpenAI hosted model:
export OPENAI_API_KEY=sk-...
oaieval simple_eval data/simple_time_eval.jsonl -m gpt-4o-mini

# Or against your local proxy (LiteLLM):
export OPENAI_API_BASE=http://localhost:4000/v1
oaieval simple_eval data/simple_time_eval.jsonl -m gpt-oss-120b
```
Results print to console. You can wrap these calls in your own runner that emits OTel spans if you want end‑to‑end traces of eval jobs.

---

## Structure

```
/sk-ollama       # .NET console app (Semantic Kernel + Ollama + Azure Monitor exporter)
/agents-sdk-ts   # Node/TS agent (OpenAI Agents SDK + OTLP tracing)
/evals           # Python evals and simple JSONL dataset
```

---

## Notes
- Swap `modelId` in `/sk-ollama/Program.cs` if you prefer a tool‑capable model on Ollama.
- For Azure Monitor, use `AZURE_MONITOR_CONNECTION_STRING` or `APPINSIGHTS_CONNECTION_STRING`.
- For OTLP, set `OTEL_EXPORTER_OTLP_ENDPOINT` (e.g., your local Collector or vendor endpoint).
- You can extend tools in both projects to hit your real systems or MCP servers.
