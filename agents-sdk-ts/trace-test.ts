import "dotenv/config";
import { trace, SpanStatusCode, SpanKind } from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { BatchSpanProcessor, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";

async function testDirectOTLPConnectivity() {
  console.log("🔍 Testing direct OTLP connectivity...\n");

  // Create a minimal tracer provider for testing
  const provider = new NodeTracerProvider({
    resource: Resource.default().merge(
      new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "trace-connectivity-test",
        [SemanticResourceAttributes.SERVICE_VERSION]: "1.0.0",
      })
    ),
  });

  // Test Aspire Dashboard OTLP endpoint
  console.log("1️⃣ Testing Aspire Dashboard OTLP endpoint...");
  const otlpExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:18889/v1/traces",
    headers: {},
  });

  // Use SimpleSpanProcessor for immediate export (no batching)
  const otlpProcessor = new SimpleSpanProcessor(otlpExporter);
  provider.addSpanProcessor(otlpProcessor);

  // Test Azure Monitor if configured
  let azureProcessor: SimpleSpanProcessor | null = null;
  if (process.env.AZURE_MONITOR_CONNECTION_STRING) {
    console.log("2️⃣ Testing Azure Monitor connectivity...");
    const azureExporter = new AzureMonitorTraceExporter({
      connectionString: process.env.AZURE_MONITOR_CONNECTION_STRING,
    });
    azureProcessor = new SimpleSpanProcessor(azureExporter);
    provider.addSpanProcessor(azureProcessor);
  } else {
    console.log("2️⃣ Azure Monitor connection string not found, skipping...");
  }

  provider.register();
  const tracer = trace.getTracer("trace-connectivity-test");

  try {
    // Create a test span with detailed attributes
    const testSpan = tracer.startSpan("connectivity_test", {
      kind: SpanKind.CLIENT,
      attributes: {
        "test.type": "connectivity",
        "test.timestamp": new Date().toISOString(),
        "test.endpoint.aspire": process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:18889/v1/traces",
        "test.endpoint.azure": process.env.AZURE_MONITOR_CONNECTION_STRING ? "enabled" : "disabled",
        "test.description": "Direct OTLP connectivity test",
      }
    });

    // Add some interesting span data
    testSpan.addEvent("test_started", {
      "event.timestamp": Date.now(),
      "event.description": "Beginning connectivity test"
    });

    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));

    testSpan.addEvent("simulated_work_complete", {
      "work.duration_ms": 100,
      "work.type": "simulation"
    });

    // Create a child span
    const childSpan = tracer.startSpan("child_operation", {
      parent: testSpan,
      attributes: {
        "operation.type": "child_test",
        "operation.id": "child_001"
      }
    });

    childSpan.addEvent("child_processing");
    await new Promise(resolve => setTimeout(resolve, 50));
    childSpan.setStatus({ code: SpanStatusCode.OK });
    childSpan.end();

    testSpan.setStatus({ code: SpanStatusCode.OK });
    testSpan.end();

    console.log("✅ Test spans created successfully");
    console.log(`   Main span: connectivity_test`);
    console.log(`   Child span: child_operation`);
    console.log(`   TraceID: ${testSpan.spanContext().traceId}`);
    console.log(`   SpanID: ${testSpan.spanContext().spanId}`);

    // Force immediate flush
    console.log("\n🔄 Flushing traces to exporters...");
    
    // Flush OTLP exporter
    try {
      await new Promise((resolve, reject) => {
        otlpExporter.export([testSpan as any], (result) => {
          if (result.code === 0) {
            console.log("✅ Successfully exported to Aspire Dashboard OTLP endpoint");
            resolve(result);
          } else {
            console.log(`❌ Failed to export to Aspire Dashboard: ${result.error}`);
            reject(new Error(result.error || "Export failed"));
          }
        });
      });
    } catch (error) {
      console.log(`❌ OTLP export error: ${error}`);
    }

    // Flush Azure exporter if configured
    if (azureProcessor) {
      try {
        await new Promise((resolve, reject) => {
          const azureExporter = (azureProcessor as any)._exporter;
          azureExporter.export([testSpan as any], (result: any) => {
            if (result.code === 0) {
              console.log("✅ Successfully exported to Azure Monitor");
              resolve(result);
            } else {
              console.log(`❌ Failed to export to Azure Monitor: ${result.error}`);
              reject(new Error(result.error || "Azure export failed"));
            }
          });
        });
      } catch (error) {
        console.log(`❌ Azure Monitor export error: ${error}`);
      }
    }

    // Additional wait to ensure all async operations complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log("\n🎯 Trace Test Summary:");
    console.log("====================");
    console.log(`📊 Aspire Dashboard: http://localhost:18888`);
    console.log(`🔗 Trace ID: ${testSpan.spanContext().traceId}`);
    console.log(`📝 Look for span 'connectivity_test' in the traces`);
    if (process.env.AZURE_MONITOR_CONNECTION_STRING) {
      console.log(`☁️  Azure Application Insights: Check your Azure portal`);
    }
    
    console.log("\n✅ Direct connectivity test completed!");
    console.log("   If you don't see traces in dashboards, there may be:");
    console.log("   • Network connectivity issues");
    console.log("   • Authentication problems (Azure)");
    console.log("   • Endpoint configuration errors");

  } catch (error) {
    console.error("❌ Direct connectivity test failed:", error);
  } finally {
    // Ensure cleanup
    await provider.forceFlush();
    await provider.shutdown();
  }
}

// Test HTTP connectivity separately
async function testHTTPConnectivity() {
  console.log("\n🌐 Testing HTTP connectivity to endpoints...");
  
  const endpoints = [
    { name: "Aspire Dashboard", url: "http://localhost:18888" },
    { name: "Aspire OTLP Endpoint", url: "http://localhost:18889/v1/traces", method: "POST" }
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint.url, {
        method: endpoint.method || "GET",
        headers: endpoint.method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body: endpoint.method === "POST" ? JSON.stringify({ test: "connectivity" }) : undefined
      });

      const status = endpoint.method === "POST" && response.status === 400 ? "OK (expected 400)" : 
                    response.status < 500 ? "OK" : "ERROR";
      
      console.log(`   ${status === "OK" || status.includes("OK") ? "✅" : "❌"} ${endpoint.name}: ${status} (${response.status})`);
      
    } catch (error) {
      console.log(`   ❌ ${endpoint.name}: Connection failed - ${error}`);
    }
  }
}

async function main() {
  console.log("🚀 Starting Direct Trace Connectivity Test");
  console.log("==========================================");
  
  await testHTTPConnectivity();
  await testDirectOTLPConnectivity();
}

// Run if this is the main module
main().catch(console.error);