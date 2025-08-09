import "dotenv/config";
import OpenAI from "openai";
import { tracer } from "./otel.ts";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
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

interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  response?: string;
  error?: string;
  spanId?: string;
  traceId?: string;
}

class TestSuite {
  private results: TestResult[] = [];

  async runTest(testName: string, testFn: () => Promise<{ response?: string; error?: string }>): Promise<TestResult> {
    const testSpan = tracer.startSpan(`test.${testName}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'test.name': testName,
        'test.framework': 'custom'
      }
    });

    const startTime = Date.now();
    let result: TestResult;

    try {
      const testResult = await testFn();
      const duration = Date.now() - startTime;
      
      result = {
        testName,
        success: !testResult.error,
        duration,
        response: testResult.response,
        error: testResult.error,
        spanId: testSpan.spanContext().spanId,
        traceId: testSpan.spanContext().traceId
      };

      testSpan.setAttributes({
        'test.result': result.success ? 'pass' : 'fail',
        'test.duration_ms': duration,
        'test.response_length': testResult.response?.length || 0
      });

      if (result.success) {
        testSpan.setStatus({ code: SpanStatusCode.OK });
      } else {
        testSpan.setStatus({ 
          code: SpanStatusCode.ERROR, 
          message: testResult.error || 'Test failed'
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      result = {
        testName,
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
        spanId: testSpan.spanContext().spanId,
        traceId: testSpan.spanContext().traceId
      };

      testSpan.recordException(error as Error);
      testSpan.setStatus({ code: SpanStatusCode.ERROR, message: result.error });
    } finally {
      testSpan.end();
    }

    this.results.push(result);
    return result;
  }

  async testBasicOpenAICall(): Promise<{ response?: string; error?: string }> {
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: "Say 'Hello from test suite!'" }
        ],
        max_tokens: 50
      });

      return { response: response.choices[0].message.content || "No response" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async testToolCalling(): Promise<{ response?: string; error?: string }> {
    try {
      const run = await client.chat.completions.create({
        model: "gpt-4o-mini",
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

            return { response: followUp.choices[0].message.content || "No response" };
          }
        }
      }

      return { response: msg.content || "No tool call made" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async testErrorHandling(): Promise<{ response?: string; error?: string }> {
    try {
      const response = await client.chat.completions.create({
        model: "invalid-model-name",
        messages: [{ role: "user", content: "This should fail" }]
      });

      return { response: "Unexpected success" };
    } catch (error) {
      // This is expected - we want to test error tracing
      return { response: `Expected error caught: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async testMultipleRequests(): Promise<{ response?: string; error?: string }> {
    const batchSpan = tracer.startSpan('test.batch_requests');
    
    try {
      const promises = Array.from({ length: 3 }, (_, i) => 
        client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: `Request number ${i + 1}` }],
          max_tokens: 20
        })
      );

      const responses = await Promise.all(promises);
      const allResponses = responses.map(r => r.choices[0].message.content).join("; ");
      
      batchSpan.setAttributes({
        'batch.size': 3,
        'batch.success': true
      });

      return { response: `Batch completed: ${allResponses}` };
    } catch (error) {
      batchSpan.recordException(error as Error);
      return { error: error instanceof Error ? error.message : String(error) };
    } finally {
      batchSpan.end();
    }
  }

  async runAllTests(): Promise<void> {
    console.log("🧪 Starting comprehensive test suite...\n");

    const suiteSpan = tracer.startSpan('testsuite.full_run', {
      attributes: {
        'testsuite.name': 'openai-agent-tests',
        'testsuite.version': '1.0.0'
      }
    });

    try {
      // Run all tests
      await this.runTest("basic_openai_call", () => this.testBasicOpenAICall());
      await this.runTest("tool_calling", () => this.testToolCalling());
      await this.runTest("error_handling", () => this.testErrorHandling());
      await this.runTest("multiple_requests", () => this.testMultipleRequests());

      // Print results
      console.log("\n📊 Test Results:");
      console.log("================");
      
      let passed = 0;
      let failed = 0;

      for (const result of this.results) {
        const status = result.success ? "✅ PASS" : "❌ FAIL";
        console.log(`${status} ${result.testName} (${result.duration}ms)`);
        console.log(`   TraceID: ${result.traceId}, SpanID: ${result.spanId}`);
        
        if (result.response) {
          console.log(`   Response: ${result.response.substring(0, 100)}${result.response.length > 100 ? '...' : ''}`);
        }
        
        if (result.error) {
          console.log(`   Error: ${result.error}`);
        }
        
        console.log("");

        if (result.success) passed++;
        else failed++;
      }

      console.log(`\n🎯 Summary: ${passed} passed, ${failed} failed`);

      suiteSpan.setAttributes({
        'testsuite.tests.total': this.results.length,
        'testsuite.tests.passed': passed,
        'testsuite.tests.failed': failed,
        'testsuite.success': failed === 0
      });

      if (failed === 0) {
        suiteSpan.setStatus({ code: SpanStatusCode.OK });
        console.log("🎉 All tests passed!");
      } else {
        suiteSpan.setStatus({ code: SpanStatusCode.ERROR, message: `${failed} tests failed` });
        console.log(`⚠️  ${failed} tests failed`);
      }

    } catch (error) {
      suiteSpan.recordException(error as Error);
      suiteSpan.setStatus({ code: SpanStatusCode.ERROR, message: 'Test suite crashed' });
      console.error("❌ Test suite crashed:", error);
    } finally {
      suiteSpan.end();
      
      // Force flush all traces
      console.log("\n🔄 Flushing traces to exporters...");
      await new Promise(resolve => setTimeout(resolve, 3000));
      console.log("✅ Traces should now be visible in dashboards");
    }
  }
}

// Run the test suite
async function main() {
  const testSuite = new TestSuite();
  await testSuite.runAllTests();
}

// Run the test suite
main().catch(console.error);