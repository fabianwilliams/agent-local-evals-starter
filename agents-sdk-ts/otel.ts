import 'dotenv/config';
import { trace, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  BatchSpanProcessor,
  type SpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const conn = (process.env.AZURE_MONITOR_CONNECTION_STRING ?? '').trim();

let provider: NodeTracerProvider | null = null;
let azureExporter: AzureMonitorTraceExporter | null = null;
let tracer: Tracer = trace.getTracer('agents-sdk-ts');
let azureEnabled = false;

if (conn) {
  try {
    azureExporter = new AzureMonitorTraceExporter({ connectionString: conn });

    provider = new NodeTracerProvider({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: 'agents-sdk-ts',
        [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
      }),
    });

    // --- Smooth over OTEL type drift without using `any` ---
    // Cast the Azure exporter through `unknown` into the local SpanExporter type
    const exporter = azureExporter as unknown as SpanExporter;
    const processor = new BatchSpanProcessor(exporter);

    // `addSpanProcessor` expects its own SpanProcessor identity; use a structural cast
    (provider as unknown as { addSpanProcessor(p: unknown): void }).addSpanProcessor(processor);
    // -------------------------------------------------------

    provider.register();

    tracer = trace.getTracer('agents-sdk-ts', '1.0.0');
    azureEnabled = true;
    console.log('✅ Azure Application Insights enabled');
  } catch (err) {
    console.error('❌ Failed to initialize Azure Application Insights:', err);
    console.warn('⚠️ Continuing without Azure tracing.');
  }
} else {
  console.warn('⚠️ Azure Application Insights disabled (AZURE_MONITOR_CONNECTION_STRING not set)');
}

export { tracer, azureExporter, provider, azureEnabled };
