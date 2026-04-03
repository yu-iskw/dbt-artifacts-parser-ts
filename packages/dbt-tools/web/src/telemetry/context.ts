import { context, propagation } from "@opentelemetry/api";

interface TraceCarrier {
  traceparent?: string;
  tracestate?: string;
}

const CARRIER_KEY = "dbt-tools-telemetry-context";

export function getActiveTraceCarrier(): TraceCarrier | null {
  const carrier: TraceCarrier = {};
  propagation.inject(context.active(), carrier);
  if (!carrier.traceparent && !carrier.tracestate) return null;
  return carrier;
}

export function withExtractedCarrier<T>(
  carrier: TraceCarrier | undefined,
  run: () => T,
): T {
  if (!carrier) return run();
  const extracted = propagation.extract(context.active(), carrier);
  return context.with(extracted, run);
}

export function toSpanAttributes(
  carrier: TraceCarrier | undefined,
): Record<string, string> {
  if (!carrier?.traceparent) return {};
  return { [`${CARRIER_KEY}.traceparent`]: carrier.traceparent };
}
