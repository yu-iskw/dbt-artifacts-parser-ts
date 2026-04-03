const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function readBoolean(value: string | undefined, fallback = false): boolean {
  if (!value) return fallback;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export interface BrowserTelemetryConfig {
  enabled: boolean;
  serviceName: string;
  serviceVersion: string;
  environment: string;
  otlpHttpEndpoint: string | null;
}

export function getBrowserTelemetryConfig(
  env: Record<string, string | undefined> = import.meta.env as Record<
    string,
    string | undefined
  >,
): BrowserTelemetryConfig {
  const enabled = readBoolean(env.VITE_OTEL_ENABLED, false);
  const endpoint = env.VITE_OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();

  return {
    enabled,
    serviceName: env.VITE_OTEL_SERVICE_NAME?.trim() || "dbt-tools-web",
    serviceVersion:
      env.VITE_OTEL_SERVICE_VERSION?.trim() ||
      env.npm_package_version?.trim() ||
      "unknown",
    environment: env.VITE_OTEL_ENVIRONMENT?.trim() || "development",
    otlpHttpEndpoint: endpoint ? endpoint : null,
  };
}
