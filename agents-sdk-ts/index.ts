import 'dotenv/config';
import { tracer as azureTracer, azureEnabled } from './otel.js';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { context, trace as otelTrace, SpanKind } from '@opentelemetry/api';

// ---------- lightweight types & guards (file-scope; keeps eslint happy) ----------
type AssistantContentPart = { type: 'text' | 'output_text' | string; text?: string };
type AssistantMessage = { type: 'message'; role: 'assistant'; content: AssistantContentPart[] };
type ToolCallItem = { type: 'hosted_tool_call' | 'function_call'; name?: string; output?: unknown };
type RunResult = { output?: unknown[]; state?: { _trace?: { traceId?: string } } };

const isAssistantMessage = (x: unknown): x is AssistantMessage => {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o['type'] === 'message' && o['role'] === 'assistant' && Array.isArray(o['content']);
};

const isToolCall = (x: unknown): x is ToolCallItem => {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o['type'] === 'hosted_tool_call' || o['type'] === 'function_call';
};
// ---------------------------------------------------------------------------------

console.log(
  azureEnabled
    ? '📈 Azure Application Insights integration active'
    : '⚠️ Azure Application Insights not configured'
);

// Tool used by the agent
const getLocalTimeTool = tool({
  name: 'get_local_time',
  description: 'Get the current local time in ISO-8601 format',
  parameters: z.object({}),
  async execute(): Promise<string> {
    return new Date().toISOString();
  },
});

// The agent
const timeAgent = new Agent({
  name: 'TimeAgent-Main',
  model: 'gpt-4o-mini',
  instructions:
    'You are a helpful time assistant. When asked for the time, use the get_local_time tool to get the current time in ISO-8601 format and respond with the timestamp clearly.',
  tools: [getLocalTimeTool],
});

async function main(): Promise<void> {
  console.log('🚀 Starting OpenAI Agents SDK with Azure Application Insights integration');
  console.log('='.repeat(70));

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  // Parent span (REQUEST)
  const parent = azureEnabled
    ? azureTracer.startSpan('agent.execution', { kind: SpanKind.SERVER })
    : null;
  const parentCtx = parent ? otelTrace.setSpan(context.active(), parent) : undefined;

  if (parent) {
    parent.setAttributes({
      'otel.trace_id': parent.spanContext().traceId,
      'http.method': 'POST',
      'http.route': '/agent/query',
      'http.url': 'http://localhost/agent/query',
      'operation.type': 'request',
      'agent.name': 'TimeAgent-Main',
      'agent.model': 'gpt-4o-mini',
      'service.name': 'agents-sdk-ts',
      'service.version': '1.0.0',
    });
  }

  try {
    const query =
      "What's the time right now? Please respond with an ISO-8601 timestamp as well as a human friendly timestamp.";
    console.log(`📝 Query: ${query}`);
    parent?.setAttributes({ 'agent.query': query, 'query.timestamp': new Date().toISOString() });

    const startTime = Date.now();

    // Run the agent inside the parent span's context so children are correctly parented
    const raw = await (parent
      ? context.with(parentCtx!, () => run(timeAgent, query))
      : run(timeAgent, query));
    const result = raw as unknown as RunResult;

    const endTime = Date.now();

    // --- Extract the response safely (TS-friendly) ---
    let responseText = 'Response received (content format not accessible)';
    const finalMessage = (result.output ?? []).find(isAssistantMessage);
    if (finalMessage) {
      const part = finalMessage.content.find(
        (c) => c?.type === 'text' || c?.type === 'output_text'
      );
      if (part?.text) {
        responseText = part.text;
        console.log(`✅ Response: ${responseText}`);
      }
    } else {
      console.log('✅ Response received (content format not accessible)');
    }
    console.log(`⏱️ Response Time: ${endTime - startTime}ms`);
    // --- end extract ---

    // OpenAI trace id (if Agents SDK provides it)
    const openaiTraceId = result.state?._trace?.traceId ?? null;
    if (openaiTraceId) {
      console.log(`🆔 Trace ID: ${openaiTraceId}`);
      console.log('📊 Check OpenAI Dashboard: https://platform.openai.com/organization/logs');
    }

    // Tool call spans (children)
    if (azureEnabled) {
      const toolCalls = (result.output ?? []).filter(isToolCall);

      toolCalls.forEach((toolCall, index) => {
        const toolSpan = azureTracer.startSpan(
          'tool.execution',
          { kind: SpanKind.INTERNAL },
          parentCtx
        );
        toolSpan.setAttributes({
          'otel.trace_id': toolSpan.spanContext().traceId,
          ...(openaiTraceId ? { 'openai.trace_id': openaiTraceId } : {}),
          'tool.name': toolCall.name ?? 'unknown',
          'tool.index': index,
          'operation.type': 'tool_call',
          'service.name': 'agents-sdk-ts',
        });
        if (toolCall.output !== undefined) {
          toolSpan.setAttributes({ 'tool.result': String(toolCall.output), 'tool.success': true });
        }
        toolSpan.end();
        console.log(`🔧 Tool Call ${index + 1}: ${toolCall.name ?? 'unknown'}() logged to Azure`);
      });

      // Response synthesis span (child)
      const synthesisSpan = azureTracer.startSpan(
        'agent.synthesis',
        { kind: SpanKind.INTERNAL },
        parentCtx
      );
      synthesisSpan.setAttributes({
        'otel.trace_id': synthesisSpan.spanContext().traceId,
        ...(openaiTraceId ? { 'openai.trace_id': openaiTraceId } : {}),
        'operation.type': 'response_synthesis',
        'agent.response': responseText,
        'agent.response_length': responseText.length,
        'service.name': 'agents-sdk-ts',
      });
      synthesisSpan.end();
      console.log(`📝 Response synthesis logged: "${responseText.substring(0, 100)}..."`);
    }

    // Finish parent
    if (parent) {
      parent.setAttributes({
        'response.time_ms': endTime - startTime,
        'agent.success': true,
        'agent.response': responseText,
        'agent.response_length': responseText.length,
        ...(openaiTraceId ? { 'openai.trace_id': openaiTraceId } : {}),
      });
      parent.end();
    }

    console.log('='.repeat(70));
    console.log('✅ Agent execution completed successfully');

    // Let spans flush
    if (azureEnabled) {
      await new Promise((r) => setTimeout(r, 2000));
      console.log('📤 Traces queued for export (check Azure in ~2–5 min)');
    } else {
      console.log('⚠️ Azure Application Insights not configured');
    }
  } catch (error) {
    parent?.recordException(error as Error);
    parent?.setAttributes({ 'agent.success': false });
    parent?.end();
    console.error('❌ Error running agent:', error);
    process.exit(1);
  }
}

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('🎉 Application completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Application failed:', error);
      process.exit(1);
    });
}
