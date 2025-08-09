import "dotenv/config";
import { Agent, run, tool, withTrace } from "@openai/agents";
import { z } from "zod";

// Create the get_local_time tool using correct Agents SDK format
const getLocalTimeTool = tool({
  name: "get_local_time",
  description: "Get the current local time in ISO-8601 format",
  parameters: z.object({
    // No parameters needed for getting current time
  }),
  async execute(input) {
    return new Date().toISOString();
  }
});

// Create a simple agent with time tool - following the exact docs pattern
const timeAgent = new Agent({
  name: "TimeAgent",
  model: "gpt-4o-mini",
  instructions: "You are a helpful time assistant. Use the get_local_time tool to provide accurate current time information in ISO-8601 format.",
  tools: [getLocalTimeTool]
});

async function simpleTest() {
  console.log("🤖 Simple Agents SDK Test");
  console.log("=========================");
  
  try {
    console.log("📝 Query: What's the time right now? Please respond with an ISO-8601 timestamp.");
    
    // Use withTrace to override the workflow name (like James Briggs showed)
    const result = await withTrace({
      workflowName: "TimeAgent Single Query",
      groupId: "agent-local-evals-starter",
      metadata: {
        test_type: "single_query",
        agent_name: "TimeAgent",
        query_type: "iso_timestamp"
      }
    }, async () => {
      return await run(
        timeAgent,
        "What's the time right now? Please respond with an ISO-8601 timestamp."
      );
    });
    
    // Extract the final message from the agent
    const finalMessage = result.output.find(item => item.type === 'message' && item.role === 'assistant');
    const responseText = finalMessage?.content?.[0]?.text || 'No response text found';
    
    console.log("✅ Agent Response:", responseText);
    console.log("🆔 Trace ID:", result.state._trace?.traceId || 'Not available');
    
    // Show tool call information
    const toolCall = result.output.find(item => item.type === 'function_call_result');
    if (toolCall) {
      console.log("🔧 Tool used:", toolCall.name, "→", toolCall.output?.text);
    }
    console.log("\n📊 This should appear in OpenAI Dashboard:");
    console.log("   🔗 https://platform.openai.com/organization/logs");
    console.log("   📈 Look for trace ID:", result.traceId);
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function batchTest() {
  console.log("\n\n🔄 Batch Test (Multiple Queries)");
  console.log("=================================");
  
  const queries = [
    "What's the current time in ISO-8601 format?",
    "Give me the current timestamp",
    "What time is it right now?",
    "I need the current time"
  ];
  
  for (const [i, query] of queries.entries()) {
    console.log(`\n📝 Test ${i + 1}/4: ${query}`);
    
    try {
      // Use custom workflow names for each query type
      const result = await withTrace({
        workflowName: `TimeAgent Batch Test ${i + 1}`,
        groupId: "agent-local-evals-starter-batch",
        metadata: {
          test_number: i + 1,
          test_type: "batch_query",
          agent_name: "TimeAgent",
          query: query,
          query_category: query.toLowerCase().includes('iso') ? 'iso_specific' : 'general_time'
        }
      }, async () => {
        return await run(timeAgent, query);
      });
      
      // Extract the final response text
      const finalMessage = result.output.find(item => item.type === 'message' && item.role === 'assistant');
      const responseText = finalMessage?.content?.[0]?.text || 'No response found';
      
      console.log(`   ✅ Response: ${responseText}`);
      console.log(`   🆔 Trace ID: ${result.state._trace?.traceId || 'Not available'}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

async function main() {
  await simpleTest();
  await batchTest();
  
  console.log("\n🎯 Summary:");
  console.log("- All requests should appear in OpenAI Dashboard logs");
  console.log("- Look for custom workflow names like 'TimeAgent Single Query' and 'TimeAgent Batch Test X'");
  console.log("- Tool calls to 'get_local_time' should be visible");
  console.log("- Group filters: 'agent-local-evals-starter' and 'agent-local-evals-starter-batch'");
  console.log("- Agents SDK automatically traces all interactions with custom metadata!");
}

main().catch(console.error);