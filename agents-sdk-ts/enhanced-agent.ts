import "dotenv/config";
import { Agent, run, tool } from "@openai/agents";
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

// Create agents with different names to distinguish workflows
const singleQueryAgent = new Agent({
  name: "TimeAgent-SingleQuery",
  model: "gpt-4o-mini",
  instructions: "You are a helpful time assistant for single query requests. Use the get_local_time tool to provide accurate current time information in ISO-8601 format. Always format responses clearly and mention the ISO-8601 format.",
  tools: [getLocalTimeTool]
});

const batchQueryAgent = new Agent({
  name: "TimeAgent-BatchTest",
  model: "gpt-4o-mini", 
  instructions: "You are a helpful time assistant for batch testing. Use the get_local_time tool to provide accurate current time information in ISO-8601 format. Keep responses concise for batch testing.",
  tools: [getLocalTimeTool]
});

async function enhancedSingleTest() {
  console.log("🤖 Enhanced Agents SDK Test with Custom Agent Names");
  console.log("================================================");
  
  try {
    console.log("📝 Query: What's the time right now? Please respond with an ISO-8601 timestamp.");
    
    // Use the dedicated single query agent
    const result = await run(
      singleQueryAgent,
      "What's the time right now? Please respond with an ISO-8601 timestamp."
    );
    
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
    
    console.log("\n📊 This should appear in OpenAI Dashboard as:");
    console.log("   🏷️  Agent: TimeAgent-SingleQuery");
    console.log("   📈 Look for workflow with this agent name");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

async function enhancedBatchTest() {
  console.log("\n\n🔄 Enhanced Batch Test (Custom Agent Names)");
  console.log("==========================================");
  
  const queries = [
    "What's the current time in ISO-8601 format?",
    "Give me the current timestamp",
    "What time is it right now?",
    "I need the current time"
  ];
  
  for (const [i, query] of queries.entries()) {
    console.log(`\n📝 Test ${i + 1}/4: ${query}`);
    
    try {
      // Use the dedicated batch test agent
      const result = await run(batchQueryAgent, query);
      
      // Extract the final response text
      const finalMessage = result.output.find(item => item.type === 'message' && item.role === 'assistant');
      const responseText = finalMessage?.content?.[0]?.text || 'No response found';
      
      console.log(`   ✅ Response: ${responseText}`);
      console.log(`   🆔 Trace ID: ${result.state._trace?.traceId || 'Not available'}`);
      
      // Show tool call info
      const toolCall = result.output.find(item => item.type === 'function_call_result');
      if (toolCall) {
        console.log(`   🔧 Tool: ${toolCall.name} → ${toolCall.output?.text}`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Create a comprehensive test function
async function comprehensiveTest() {
  console.log("\n\n🧪 Comprehensive Test Suite");
  console.log("===========================");
  
  const testCases = [
    {
      agent: new Agent({
        name: "TimeAgent-ISOSpecific",
        model: "gpt-4o-mini",
        instructions: "You are specialized in ISO-8601 timestamp requests. Always mention the ISO-8601 format in your response and use the get_local_time tool.",
        tools: [getLocalTimeTool]
      }),
      query: "I need the current time in ISO-8601 format please",
      category: "ISO-specific"
    },
    {
      agent: new Agent({
        name: "TimeAgent-GeneralTime",
        model: "gpt-4o-mini", 
        instructions: "You provide general time information. Use the get_local_time tool and format responses naturally.",
        tools: [getLocalTimeTool]
      }),
      query: "What's the current time?",
      category: "General time"
    },
    {
      agent: new Agent({
        name: "TimeAgent-UrgentRequest",
        model: "gpt-4o-mini",
        instructions: "You handle urgent time requests. Be quick and precise with the get_local_time tool.",
        tools: [getLocalTimeTool]
      }),
      query: "I urgently need to know what time it is right now!",
      category: "Urgent"
    }
  ];
  
  for (const [i, testCase] of testCases.entries()) {
    console.log(`\n🎯 Test ${i + 1}/3 [${testCase.category}]: ${testCase.query}`);
    
    try {
      const result = await run(testCase.agent, testCase.query);
      
      const finalMessage = result.output.find(item => item.type === 'message' && item.role === 'assistant');
      const responseText = finalMessage?.content?.[0]?.text || 'No response found';
      
      console.log(`   ✅ Agent: ${testCase.agent.name}`);
      console.log(`   📝 Response: ${responseText.substring(0, 80)}${responseText.length > 80 ? '...' : ''}`);
      console.log(`   🆔 Trace: ${result.state._trace?.traceId || 'N/A'}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 300));
  }
}

async function main() {
  await enhancedSingleTest();
  await enhancedBatchTest();
  await comprehensiveTest();
  
  console.log("\n🎯 Enhanced Summary:");
  console.log("==================");
  console.log("✅ Multiple distinct agent names created:");
  console.log("   • TimeAgent-SingleQuery");
  console.log("   • TimeAgent-BatchTest"); 
  console.log("   • TimeAgent-ISOSpecific");
  console.log("   • TimeAgent-GeneralTime");
  console.log("   • TimeAgent-UrgentRequest");
  console.log("");
  console.log("📊 In OpenAI Dashboard, look for:");
  console.log("   🔍 Filter by agent names to see different workflow types");
  console.log("   📈 Each agent creates separate workflow entries");
  console.log("   🔧 Tool calls to 'get_local_time' in all workflows");
  console.log("   🆔 Unique trace IDs for each execution");
  console.log("");
  console.log("🎉 This approach creates distinct workflows without withTrace!");
}

main().catch(console.error);