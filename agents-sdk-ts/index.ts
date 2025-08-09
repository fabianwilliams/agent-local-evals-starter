import "dotenv/config";
import OpenAI from "openai";
import { tracer } from "./otel.ts";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL // optional: LiteLLM proxy in front of Ollama
});

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_local_time",
      description: "Return current local time in ISO-8601",
      parameters: { type: "object", properties: {}, additionalProperties: false }
    }
  }
];

function get_local_time() {
  return new Date().toISOString();
}

async function main() {
  const span = tracer.startSpan("agent.run");
  span.setAttributes({
    "agent.type": "agents-sdk-ts",
    "agent.query": "What's the time right now?",
    "llm.model": "gpt-4o-mini"
  });

  const run = await client.chat.completions.create({
    model: "gpt-4o-mini", // swap to your preferred model or your local proxy model name
    messages: [
      { role: "system", content: "You are a helpful assistant. Use tools if needed." },
      { role: "user", content: "What's the time right now?" }
    ],
    tools,
    tool_choice: "auto"
  });

  const msg = run.choices[0].message;

  if (msg.tool_calls?.length) {
    for (const tc of msg.tool_calls) {
      if (tc.function?.name === "get_local_time") {
        const result = get_local_time();

        const followUp = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a helpful assistant." },
            { role: "user", content: "What's the time right now?" },
            { role: "assistant", tool_calls: [tc], content: "" } as any,
            { role: "tool", tool_call_id: tc.id!, content: result } as any
          ]
        });

        console.log(followUp.choices[0].message.content);
      }
    }
  } else {
    console.log(msg.content);
  }

  span.setAttributes({
    "agent.completed": true,
    "response.length": msg.content?.length || 0
  });
  span.end();
}

main().then(async () => {
  console.log("🔄 Flushing traces...");
  // Force flush traces before exit
  const { trace } = await import("@opentelemetry/api");
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    console.log("📊 Active span found, ending...");
  }
  
  // Wait a moment for async operations to complete
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log("✅ Traces should be exported now");
}).catch(console.error);
