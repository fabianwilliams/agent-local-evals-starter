# Observability KQL for `agents-sdk-ts`

> Tip: set **Time range** to *Last 24 hours* first. If you get zero rows, try *Last 7 days*; ingestion can lag \~1–3 minutes.

---

## 0) Quick sanity check

Shows the last items we ingested for this service (requests, tool calls, synthesis).

**Expect:** a few rows with `itemType` = `dependency`/`request`, `name` like `POST /agent/query`, and your custom dims.

```kusto
union requests, dependencies, customEvents
| where timestamp > ago(24h)
| extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
| where ServiceName has_cs "agents-sdk-ts"
| project timestamp, itemType, name, type, cloud_RoleName,
          success, resultCode, customDimensions
| order by timestamp desc
```

---

## 1) Timeline (Request → ToolCall → Response)

One row per step so you can see the order of events within a run.

**Expect:** three rows per run: `1_Request`, `2_ToolCall`, `3_Response`.

```kusto
union requests, dependencies, customEvents
| where timestamp > ago(24h)
| extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
| where ServiceName has_cs "agents-sdk-ts"
| extend OperationType = tostring(customDimensions["operation.type"]),
         OTELTraceId   = tostring(customDimensions["otel.trace_id"]),
         OpenAITraceId = tostring(customDimensions["openai.trace_id"]),
         ToolName      = tostring(customDimensions["tool.name"]),
         AgentQuery    = tostring(customDimensions["agent.query"]),
         AgentResponse = tostring(customDimensions["agent.response"])
| project timestamp,
          Step = case(OperationType == "request","1_Request",
                      OperationType == "tool_call","2_ToolCall",
                      OperationType == "response_synthesis","3_Response","0_Other"),
          name, OperationType, ToolName, AgentQuery, AgentResponse,
          OTELTraceId, OpenAITraceId, duration
| order by timestamp asc
```

---

## 2) Conversation roll-up (group by OTEL trace id)

Collapses each run into one row (query, response, tools used, total time).

**Expect:** one row per run with `Tools` = `["get_local_time"]`.

```kusto
let base =
union requests, dependencies, customEvents
| where timestamp > ago(24h)
| extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
| where ServiceName has_cs "agents-sdk-ts"
| extend OperationType = tostring(customDimensions["operation.type"]),
         OTELTraceId   = tostring(customDimensions["otel.trace_id"]),
         OpenAITraceId = tostring(customDimensions["openai.trace_id"]),
         ToolName      = tostring(customDimensions["tool.name"]),
         AgentQuery    = tostring(customDimensions["agent.query"]),
         AgentResponse = tostring(customDimensions["agent.response"]);
base
| summarize First = min(timestamp), Last = max(timestamp),
            Query     = anyif(AgentQuery,    OperationType == "request"),
            Response  = anyif(AgentResponse, OperationType == "response_synthesis"),
            Tools     = make_set_if(ToolName, OperationType == "tool_call"),
            Steps     = make_set(OperationType),
            TotalMs   = sum(duration)
  by ConversationId = coalesce(OTELTraceId, operation_Id), OpenAITraceId
| order by Last desc
```

---

## 3) Request ↔ Response join (no CTE “queries” keyword)

Pairs the request row with its response row using the same operation id.

**Expect:** two columns `Query` and `Response` for each run.

```kusto
let rq =
  union requests, dependencies, customEvents
  | where timestamp > ago(24h)
  | extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
  | where ServiceName has_cs "agents-sdk-ts"
  | where tostring(customDimensions["operation.type"]) == "request"
  | extend Query = tostring(customDimensions["agent.query"])
  | project OperationId = operation_Id, Query, QueryTime = timestamp;

let rs =
  union requests, dependencies, customEvents
  | where timestamp > ago(24h)
  | extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
  | where ServiceName has_cs "agents-sdk-ts"
  | where tostring(customDimensions["operation.type"]) == "response_synthesis"
  | extend Response = tostring(customDimensions["agent.response"])
  | project OperationId = operation_Id, Response, ResponseTime = timestamp;

rq
| join kind=leftouter rs on OperationId
| project ConversationTime = coalesce(QueryTime, ResponseTime),
          OperationId, Query, Response
| order by ConversationTime desc
```

---

## 4) Tool usage counts

How many times each tool ran.

**Expect:** one row for `get_local_time` with the total count.

```kusto
dependencies
| where timestamp > ago(24h)
| extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
| where ServiceName has_cs "agents-sdk-ts"
| where tostring(customDimensions["operation.type"]) == "tool_call"
| extend ToolName = tostring(customDimensions["tool.name"])
| summarize Calls = count() by ToolName
| order by Calls desc
```

---

## 5) Latency timechart (avg + p95) by dependency name

Visual view of latency for each step.

**Expect:** lines for `POST /agent/query`, `tool.execution`, `agent.synthesis`.

```kusto
dependencies
| where timestamp > ago(24h)
| extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
| where ServiceName has_cs "agents-sdk-ts"
| summarize AvgMs = avg(duration), P95Ms = percentile(duration, 95)
          by Name = name, bin(timestamp, 1m)
| order by timestamp asc
| render timechart
```

---

## 6) “Has OpenAI trace id?” by operation

Checks where `openai.trace_id` was stamped.

**Expect:** `Yes/No` by operation type; after the latest code it should show `Yes` for request/tool\_call/response\_synthesis.

```kusto
union requests, dependencies, customEvents
| where timestamp > ago(24h)
| extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
| where ServiceName has_cs "agents-sdk-ts"
| summarize Count = count() by
    HasOpenAI = iif(isempty(tostring(customDimensions["openai.trace_id"])),"No","Yes"),
    OperationType = tostring(customDimensions["operation.type"])
| order by OperationType asc, HasOpenAI desc
```

---

## 7) Last run details (one row)

Handy when you just executed a single run locally.

```kusto
union requests, dependencies, customEvents
| where timestamp > ago(24h)
| extend ServiceName = coalesce(tostring(customDimensions["service.name"]), cloud_RoleName)
| where ServiceName has_cs "agents-sdk-ts"
| summarize Last = arg_max(timestamp, *)
| project Last, itemType, name, duration,
          OperationType = tostring(customDimensions["operation.type"]),
          OpenAITraceId = tostring(customDimensions["openai.trace_id"]),
          OTELTraceId   = tostring(customDimensions["otel.trace_id"]),
          AgentQuery    = tostring(customDimensions["agent.query"]),
          AgentResponse = tostring(customDimensions["agent.response"])
```

---

## 8) Find by a specific OpenAI trace id

Paste the id you see in your terminal.

```kusto
let target = "trace_xxx"; // <- paste here
union requests, dependencies, customEvents
| where timestamp > ago(7d)
| extend OpenAITraceId = tostring(customDimensions["openai.trace_id"])
| where OpenAITraceId == target
| order by timestamp asc
```

---

### If you see no data

- Wait 2–5 minutes (export + ingestion delay).
- Confirm you’re querying the **same App Insights resource** whose connection string is in `.env`.
- Widen time range.
- In **0) Sanity**, temporarily remove the service filter to see if *anything* is arriving.
- From the terminal logs, the exporter is active, so data should be coming in.

