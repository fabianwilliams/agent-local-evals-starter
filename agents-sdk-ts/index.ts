import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { config } from "dotenv";
import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { trace, SpanKind } from "@opentelemetry/api";

// Load environment variables  
config();

// Azure Application Insights setup
let azureProvider: NodeTracerProvider | null = null;
let azureTracer: any = null;

if (process.env.AZURE_MONITOR_CONNECTION_STRING) {
  try {
    console.log("🔧 Initializing Azure Application Insights...");
    
    azureProvider = new NodeTracerProvider({
      serviceName: "agents-sdk-ts",
      serviceVersion: "1.0.0",
    });

    const azureExporter = new AzureMonitorTraceExporter({
      connectionString: process.env.AZURE_MONITOR_CONNECTION_STRING,
    });

    azureProvider.addSpanProcessor(new BatchSpanProcessor(azureExporter, {
      maxQueueSize: 1024,
      maxExportBatchSize: 256,
      scheduledDelayMillis: 1000,
      exportTimeoutMillis: 10000,
    }));

    azureProvider.register();
    azureTracer = trace.getTracer("agents-sdk-ts-azure", "1.0.0");
    
    console.log("✅ Azure Application Insights initialized successfully");
    
  } catch (error) {
    console.error("❌ Failed to initialize Azure Application Insights:", error);
  }
} else {
  console.log("⚠️ AZURE_MONITOR_CONNECTION_STRING not set - Azure tracing disabled");
}

// Define the time tool using the Agents SDK format
const getLocalTimeTool = tool({
  name: "get_local_time",
  description: "Get the current local time in ISO-8601 format",
  parameters: z.object({}),
  async execute(): Promise<string> {
    return new Date().toISOString();
  }
});

// Create the agent with proper name for tracing
const timeAgent = new Agent({
  name: "TimeAgent-Main",
  model: "gpt-4o-mini",
  instructions: `You are a helpful time assistant. When asked for the time, use the get_local_time tool to get the current time in ISO-8601 format and respond with the timestamp clearly.`,
  tools: [getLocalTimeTool]
});

async function main(): Promise<void> {
  console.log("🚀 Starting OpenAI Agents SDK with Azure Application Insights integration");
  console.log("=" .repeat(70));
  
  // Create Azure Application Insights span as REQUEST (not dependency)
  let azureSpan = null;
  if (azureTracer) {
    azureSpan = azureTracer.startSpan("agent.execution");
    azureSpan.setAttributes({
      "http.method": "POST", // Makes it show as request
      "http.route": "/agent/query", 
      "http.url": "http://localhost/agent/query",
      "operation.type": "request",
      "agent.name": "TimeAgent-Main",
      "agent.model": "gpt-4o-mini",
      "service.name": "agents-sdk-ts",
      "service.version": "1.0.0"
    });
  }
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    const query = "What's the time right now? Please respond with an ISO-8601 timestamp as well as a human friendly timestamp.";
    console.log(`📝 Query: ${query}`);
    
    if (azureSpan) {
      azureSpan.setAttributes({
        "agent.query": query,
        "query.timestamp": new Date().toISOString()
      });
    }
    
    const startTime = Date.now();
    const result = await run(timeAgent, query);
    const endTime = Date.now();
    
    // Extract the response safely
    let responseText = "Response received (content format not accessible)";
    const finalMessage = result.output.find(item => 
      item.type === 'message' && item.role === 'assistant'
    );
    
    if (finalMessage && 'content' in finalMessage && finalMessage.content && Array.isArray(finalMessage.content)) {
      // Handle both 'text' and 'output_text' content types
      const textContent = finalMessage.content.find((c: any) => 
        c.type === 'text' || c.type === 'output_text'
      );
      if (textContent && 'text' in textContent) {
        responseText = textContent.text;
        console.log(`✅ Response: ${responseText}`);
      }
    } else {
      console.log("✅ Response received (content format not accessible)");
    }
    
    console.log(`⏱️ Response Time: ${endTime - startTime}ms`);
    
    // Create separate spans for tool calls and responses
    if (azureTracer) {
      // 1. Tool Call Span
      const toolCalls = result.output.filter(item => 
        item.type === 'hosted_tool_call' || item.type === 'function_call'
      );
      
      toolCalls.forEach((toolCall, index) => {
        const toolSpan = azureTracer.startSpan("tool.execution");
        toolSpan.setAttributes({
          "tool.name": 'name' in toolCall ? toolCall.name : 'unknown',
          "tool.index": index,
          "operation.type": "tool_call",
          "service.name": "agents-sdk-ts"
        });
        
        // Add tool result if available
        if ('output' in toolCall && toolCall.output) {
          toolSpan.setAttributes({
            "tool.result": toolCall.output,
            "tool.success": true
          });
        }
        
        toolSpan.end();
        console.log(`🔧 Tool Call ${index + 1}: ${toolCall.name || 'unknown'}() logged to Azure`);
      });
      
      // 2. Response Synthesis Span
      const synthesisSpan = azureTracer.startSpan("agent.synthesis");
      synthesisSpan.setAttributes({
        "operation.type": "response_synthesis",
        "agent.response": responseText,
        "agent.response_length": responseText.length,
        "service.name": "agents-sdk-ts",
        "synthesis.tool_calls_count": toolCalls.length
      });
      
      synthesisSpan.end();
      console.log(`📝 Response synthesis logged: "${responseText.substring(0, 100)}..."`);
    }
    
    if ('_trace' in result.state && result.state._trace && 'traceId' in result.state._trace) {
      console.log(`🆔 Trace ID: ${(result.state._trace as any).traceId}`);
      console.log(`📊 Check OpenAI Dashboard: https://platform.openai.com/organization/logs`);
    }
    
    if (azureSpan) {
      azureSpan.setAttributes({
        "response.time_ms": endTime - startTime,
        "agent.success": true,
        "agent.response": responseText,
        "agent.response_length": responseText.length,
        "openai.trace_id": (result.state as any)._trace?.traceId || "unknown"
      });
      azureSpan.end();
    }
    
    console.log("=" .repeat(70));
    console.log("✅ Agent execution completed successfully");
    
    if (process.env.AZURE_MONITOR_CONNECTION_STRING && azureProvider) {
      console.log("📈 Azure Application Insights integration enabled");
      console.log("   Flushing traces to Azure portal...");
      try {
        await azureProvider.forceFlush(5000);
        console.log("   ✅ Traces flushed successfully");
        console.log("   📊 Check Azure portal within 2-5 minutes");
      } catch (error) {
        console.error("   ❌ Error flushing traces:", error);
      }
    } else {
      console.log("⚠️ Azure Application Insights not configured");
    }
    
  } catch (error) {
    if (azureSpan) {
      azureSpan.recordException(error as Error);
      azureSpan.setAttributes({ "agent.success": false });
      azureSpan.end();
    }
    console.error("❌ Error running agent:", error);
    if (azureProvider) {
      await azureProvider.forceFlush(5000);
    }
    process.exit(1);
  }
}

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log("🎉 Application completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Application failed:", error);
      process.exit(1);
    });
}
