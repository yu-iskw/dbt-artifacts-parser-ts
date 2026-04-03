import { trace } from "@opentelemetry/api";

const TRACER_NAME = "dbt-tools-web";

export function getWebTracer() {
  return trace.getTracer(TRACER_NAME);
}
