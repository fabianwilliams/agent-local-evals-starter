import 'dotenv/config';

import { trace, Tracer } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter';

const conn = (process.env.AZURE_MONITOR_CONNECTION_STRING ?? '').trim();

let provider: NodeTracerProvider | null = null;
let azureExporter: AzureMonitorTraceExporter | null = null;
let tracer: Tracer = trace.getTracer('agents-sdk-ts');
let azureEnabled = false;

if (conn) {
  try {
    azureExporter = new AzureMonitorTraceExporter({ connectionString: conn });

    provider = new NodeTracerProvider();

    // Use a single exporter instance; smooth over TS type drift
    const exporter = azureExporter as unknown as SpanExporter;

    // 🔧 TS-unblock: avoid cross-package Span type mismatch
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const processor: any = new BatchSpanProcessor(exporter, {
      maxQueueSize: 1024,
      maxExportBatchSize: 256,
      scheduledDelayMillis: 1000,
      exportTimeoutMillis: 10000,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (provider as any).addSpanProcessor(processor);
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
