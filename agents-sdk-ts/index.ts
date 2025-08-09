import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { config } from "dotenv";
import "./otel.js";

// Load environment variables
config();

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
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    const query = "What's the time right now? Please respond with an ISO-8601 timestamp.";
    console.log(`📝 Query: ${query}`);
    
    const startTime = Date.now();
    const result = await run(timeAgent, query);
    const endTime = Date.now();
    
    // Extract the response safely
    const finalMessage = result.output.find(item => 
      item.type === 'message' && item.role === 'assistant'
    );
    
    if (finalMessage && 'content' in finalMessage && finalMessage.content && Array.isArray(finalMessage.content)) {
      const textContent = finalMessage.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        console.log(`✅ Response: ${textContent.text}`);
      }
    } else {
      console.log("✅ Response received (content format not accessible)");
    }
    
    console.log(`⏱️ Response Time: ${endTime - startTime}ms`);
    
    if ('_trace' in result.state && result.state._trace && 'traceId' in result.state._trace) {
      console.log(`🆔 Trace ID: ${(result.state._trace as any).traceId}`);
      console.log(`📊 Check OpenAI Dashboard: https://platform.openai.com/organization/logs`);
    }
    
    console.log("=" .repeat(70));
    console.log("✅ Agent execution completed successfully");
    
    if (process.env.AZURE_MONITOR_CONNECTION_STRING) {
      console.log("📈 Azure Application Insights integration enabled");
      console.log("   Traces should appear in Azure portal within 2-5 minutes");
    } else {
      console.log("⚠️ Azure Application Insights not configured");
      console.log("   Set AZURE_MONITOR_CONNECTION_STRING to enable");
    }
    
  } catch (error) {
    console.error("❌ Error running agent:", error);
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
