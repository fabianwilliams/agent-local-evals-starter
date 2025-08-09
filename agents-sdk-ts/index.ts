import 'dotenv/config';
import { tracer as azureTracer, azureEnabled } from './otel.js';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';

// One clear status line based on otel.ts init
console.log(
  azureEnabled
    ? '📈 Azure Application Insights integration active'
    : '⚠️ Azure Application Insights not configured'
);

// Define the time tool using the Agents SDK format
const getLocalTimeTool = tool({
  name: 'get_local_time',
  description: 'Get the current local time in ISO-8601 format',
  parameters: z.object({}),
  async execute(): Promise<string> {
    return new Date().toISOString();
  },
});

// Create the agent with proper name for tracing
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

  // Create Azure Application Insights span as REQUEST (not dependency)
  const span = azureEnabled ? azureTracer.startSpan('agent.execution') : null;
  if (span) {
    span.setAttributes({
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
    if (span) {
      span.setAttributes({ 'agent.query': query, 'query.timestamp': new Date().toISOString() });
    }

    const startTime = Date.now();
    const result = await run(timeAgent, query);
    const endTime = Date.now();

    // Extract the response safely
    let responseText = 'Response received (content format not accessible)';
    const finalMessage = result.output.find(
      (item: any) => item.type === 'message' && item.role === 'assistant'
    );
    if (finalMessage && Array.isArray((finalMessage as any).content)) {
      const textContent = (finalMessage as any).content.find(
        (c: any) => c.type === 'text' || c.type === 'output_text'
      );
      if (textContent?.text) {
        responseText = textContent.text;
        console.log(`✅ Response: ${responseText}`);
      }
    } else {
      console.log('✅ Response received (content format not accessible)');
    }
    console.log(`⏱️ Response Time: ${endTime - startTime}ms`);

    // Tool call spans (best-effort)
    if (azureEnabled) {
      const toolCalls = result.output.filter(
        (item: any) => item.type === 'hosted_tool_call' || item.type === 'function_call'
      );
      toolCalls.forEach((toolCall: any, index: number) => {
        const toolSpan = azureTracer.startSpan('tool.execution');
        toolSpan.setAttributes({
          'tool.name': toolCall?.name ?? 'unknown',
          'tool.index': index,
          'operation.type': 'tool_call',
          'service.name': 'agents-sdk-ts',
        });
        if (toolCall?.output) {
          toolSpan.setAttributes({ 'tool.result': String(toolCall.output), 'tool.success': true });
        }
        toolSpan.end();
        console.log(`🔧 Tool Call ${index + 1}: ${toolCall?.name ?? 'unknown'}() logged to Azure`);
      });

      const synthesisSpan = azureTracer.startSpan('agent.synthesis');
      synthesisSpan.setAttributes({
        'operation.type': 'response_synthesis',
        'agent.response': responseText,
        'agent.response_length': responseText.length,
        'service.name': 'agents-sdk-ts',
      });
      synthesisSpan.end();
      console.log(`📝 Response synthesis logged: "${responseText.substring(0, 100)}..."`);
    }

    // Print OpenAI trace id if present
    const traceId = (result.state as any)?._trace?.traceId;
    if (traceId) {
      console.log(`🆔 Trace ID: ${traceId}`);
      console.log('📊 Check OpenAI Dashboard: https://platform.openai.com/organization/logs');
    }

    if (span) {
      span.setAttributes({
        'response.time_ms': endTime - startTime,
        'agent.success': true,
        'agent.response': responseText,
        'agent.response_length': responseText.length,
        'openai.trace_id': traceId ?? 'unknown',
      });
      span.end();
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
    if (span) {
      span.recordException(error as Error);
      span.setAttributes({ 'agent.success': false });
      span.end();
    }
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
