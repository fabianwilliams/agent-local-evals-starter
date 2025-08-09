import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { trace } from "@opentelemetry/api";

// Simplified Azure Application Insights configuration
// Focus on getting traces to Azure Application Insights working first

let azureExporter: AzureMonitorTraceExporter | null = null;

if (process.env.AZURE_MONITOR_CONNECTION_STRING) {
  console.log("🔧 Configuring Azure Application Insights exporter...");
  
  try {
    azureExporter = new AzureMonitorTraceExporter({
      connectionString: process.env.AZURE_MONITOR_CONNECTION_STRING,
    });
    
    console.log("✅ Azure Application Insights exporter created successfully");
    console.log("🔗 Connection string configured (first 50 chars):", 
      process.env.AZURE_MONITOR_CONNECTION_STRING.substring(0, 50) + "...");
  } catch (error) {
    console.error("❌ Failed to create Azure Application Insights exporter:", error);
  }
} else {
  console.log("⚠️ AZURE_MONITOR_CONNECTION_STRING not set - Azure Application Insights disabled");
  console.log("   To enable, set your connection string in the .env file");
}

// Simple tracer export for now - let OpenAI Agents SDK handle the main tracing
export const tracer = trace.getTracer("agents-sdk-ts", "1.0.0");

// Export the exporter for potential manual use
export { azureExporter };

console.log("🚀 Azure Application Insights integration ready");
