import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { trace } from "@opentelemetry/api";
// Simplified OTEL configuration for Agents SDK

const provider = new NodeTracerProvider();

// OTLP Exporter for Docker/Aspire Dashboard
const otlpExporter = new OTLPTraceExporter({
  // honors OTEL_EXPORTER_OTLP_ENDPOINT env var; defaults to http://localhost:4318/v1/traces
});
provider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));

// Azure Monitor Exporter
if (process.env.AZURE_MONITOR_CONNECTION_STRING) {
  const azureExporter = new AzureMonitorTraceExporter({
    connectionString: process.env.AZURE_MONITOR_CONNECTION_STRING,
  });
  provider.addSpanProcessor(new BatchSpanProcessor(azureExporter));
}

provider.register();

console.log("OpenTelemetry initialized with exporters:");
console.log("- OTLP endpoint:", process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://localhost:4318/v1/traces");
console.log("- Azure Monitor:", process.env.AZURE_MONITOR_CONNECTION_STRING ? "enabled" : "disabled");

// Add span listeners for debugging
provider.getActiveSpanProcessor().forceFlush = ((originalForceFlush) => {
  return function(timeoutMillis) {
    console.log("🔄 Flushing spans to exporters...");
    return originalForceFlush.call(this, timeoutMillis);
  };
})(provider.getActiveSpanProcessor().forceFlush.bind(provider.getActiveSpanProcessor()));

// Force flush on process exit
process.on('exit', () => {
  provider.forceFlush().then(() => {
    console.log("✅ All spans flushed on exit");
  }).catch(err => {
    console.error("❌ Error flushing spans:", err);
  });
});

export const tracer = trace.getTracer("agents-sdk-ts");
