import "dotenv/config";
// Remove custom OTEL config - let Agents SDK handle tracing
import { Agent, run, withTrace, createAgentSpan } from "@openai/agents";

// Create an agent with time tool
const timeAgent = new Agent({
  name: "TimeAgent",
  model: "gpt-4o-mini",
  instructions: "You are a helpful time assistant. Use the get_local_time tool to provide accurate current time information. Always format the time in ISO-8601 format when requested.",
  tools: [
    {
      name: "get_local_time",
      description: "Get the current local time in ISO-8601 format",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      },
      function: () => {
        return new Date().toISOString();
      }
    }
  ]
});

async function runTimeQuery() {
  console.log("🤖 Starting Agents SDK Time Query...\n");

  // Run with trace metadata for OpenAI dashboard visibility
  const groupId = "agent-local-evals-starter";
  
  try {
    const result = await withTrace({
      workflowName: "TimeQueryWorkflow",
      groupId: groupId,
      metadata: {
        agent_type: "TimeAgent",
        sdk: "openai-agents-js",
        version: "1.0.0",
        environment: "development",
        test_type: "time_query"
      }
    }, async () => {
      return await run(
        timeAgent,
        "What's the time right now? Please respond with an ISO-8601 timestamp."
      );
    });

    console.log("✅ Agent Response:", result.output || result);
    console.log("📊 This trace should appear in OpenAI Dashboard under group:", groupId);

  } catch (error) {
    console.error("❌ Error running agent:", error);
  }
}

async function runComprehensiveTest() {
  console.log("\n🧪 Running Comprehensive Agents SDK Test...\n");

  const testCases = [
    "What's the current time in ISO-8601 format?",
    "Give me the current time right now",
    "What time is it?",
    "I need the current timestamp"
  ];

  for (const [index, query] of testCases.entries()) {
    console.log(`📝 Test ${index + 1}/4: ${query}`);
    
    try {
      const result = await withTrace({
        workflowName: "ComprehensiveTimeTest",
        groupId: "agent-local-evals-starter-batch",
        metadata: {
          test_number: index + 1,
          query: query,
          agent_type: "TimeAgent",
          batch_test: true
        }
      }, async () => {
        return await run(timeAgent, query);
      });

      const output = result.output || result;
      console.log(`   ✅ Response: ${output?.substring(0, 100)}${output && output.length > 100 ? '...' : ''}`);
      console.log(`   📊 Traced in OpenAI Dashboard\n`);

    } catch (error) {
      console.log(`   ❌ Error: ${error}\n`);
    }

    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

async function main() {
  console.log("🚀 OpenAI Agents SDK with Proper Tracing");
  console.log("========================================");

  // Run single query test
  await runTimeQuery();

  // Run comprehensive batch test
  await runComprehensiveTest();

  console.log("\n🎯 Check your OpenAI Dashboard:");
  console.log("   📊 Logs: https://platform.openai.com/organization/logs");
  console.log("   📈 Traces: Look for workflows 'TimeQueryWorkflow' and 'ComprehensiveTimeTest'");
  console.log("   🏷️  Groups: 'agent-local-evals-starter' and 'agent-local-evals-starter-batch'");

  console.log("\n✅ All tests completed!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { timeAgent, runTimeQuery, runComprehensiveTest };