import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import { config } from "dotenv";
import "./otel.js"; // Import OTEL configuration

config(); // Load environment variables

// Test tool that returns current time in ISO-8601 format
const getLocalTimeTool = tool({
  name: "get_local_time",
  description: "Get the current local time in ISO-8601 format",
  parameters: z.object({}), // No parameters needed
  async execute(): Promise<string> {
    return new Date().toISOString();
  }
});

// Test agent with descriptive name for tracing
const testAgent = new Agent({
  name: "TestAgent-OpenAIFunctionality",
  model: "gpt-4o-mini",
  instructions: `You are a helpful time assistant. When asked for the time, use the get_local_time tool to get the current time in ISO-8601 format and respond with the timestamp.`,
  tools: [getLocalTimeTool]
});

async function testOpenAIFunctionality(): Promise<void> {
  console.log("🧪 Testing OpenAI Agents SDK functionality...");
  console.log("=" .repeat(50));
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }

    const testQuery = "What's the current time? Please respond with an ISO-8601 timestamp.";
    console.log(`📝 Query: ${testQuery}`);
    
    const startTime = Date.now();
    const result = await run(testAgent, testQuery);
    const endTime = Date.now();
    
    // Extract the final response - handle different message types
    const finalMessage = result.output.find(item => 
      item.type === 'message' && item.role === 'assistant'
    );
    
    if (!finalMessage) {
      throw new Error("No response received from agent");
    }
    
    // Handle the content safely with type checking
    let responseText = "Response received but content not accessible";
    if ('content' in finalMessage && finalMessage.content && Array.isArray(finalMessage.content)) {
      const textContent = finalMessage.content.find((c: any) => c.type === 'text');
      if (textContent && 'text' in textContent) {
        responseText = textContent.text;
      }
    }
    
    console.log(`✅ Agent Response: ${responseText}`);
    console.log(`⏱️ Response Time: ${endTime - startTime}ms`);
    
    if ('_trace' in result.state && result.state._trace && 'traceId' in result.state._trace) {
      console.log(`🆔 Trace ID: ${(result.state._trace as any).traceId}`);
    }
    
    // Check if tool was called (use the correct type)
    const toolCalls = result.output.filter(item => 
      item.type === 'hosted_tool_call' || item.type === 'function_call'
    );
    if (toolCalls.length > 0) {
      console.log(`🔧 Tool Calls: ${toolCalls.length}`);
      toolCalls.forEach((call, index) => {
        const toolName = 'name' in call ? call.name : 'unknown';
        console.log(`   ${index + 1}. ${toolName}()`);
      });
    }
    
    console.log("=" .repeat(50));
    console.log("✅ OpenAI Agents SDK functionality test PASSED");
    
    // Test Azure Application Insights export
    if (process.env.AZURE_MONITOR_CONNECTION_STRING) {
      console.log("📊 Azure Application Insights tracing enabled");
      console.log("   Check your Azure portal for traces in 2-5 minutes");
    } else {
      console.log("⚠️ Azure Application Insights not configured");
    }
    
  } catch (error) {
    console.error("❌ OpenAI Agents SDK test FAILED:");
    console.error(error);
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testOpenAIFunctionality()
    .then(() => {
      console.log("🎉 Test completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("💥 Test failed:", error);
      process.exit(1);
    });
}