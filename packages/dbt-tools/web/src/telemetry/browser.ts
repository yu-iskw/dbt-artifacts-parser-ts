import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { getBrowserTelemetryConfig } from "./config";
let initialized = false;

export function initBrowserTelemetry() {
  if (initialized) return;
  initialized = true;

  const config = getBrowserTelemetryConfig();
  if (!config.enabled || !config.otlpHttpEndpoint) return;

  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      "service.name": config.serviceName,
      "service.version": config.serviceVersion,
      "deployment.environment": config.environment,
    }),
  });

  provider.addSpanProcessor(
    new BatchSpanProcessor(
      new OTLPTraceExporter({
        url: config.otlpHttpEndpoint,
      }),
    ),
  );

  provider.register();
}
