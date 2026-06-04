/**
 * OpenTelemetry bootstrap. Kept dependency-light: when OTEL_EXPORTER_OTLP_ENDPOINT
 * is set, this loads the OTel Node SDK (added as an optional dependency) and starts
 * auto-instrumentation for HTTP/Express/Prisma/ioredis, exporting via OTLP.
 *
 * To enable, install the SDK packages:
 *   pnpm --filter @tahaddi/server add @opentelemetry/sdk-node \
 *     @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http
 * The dynamic import below is guarded so the server runs fine without them.
 */
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

export async function initOtel(): Promise<void> {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    logger.debug('OpenTelemetry disabled (no OTLP endpoint)');
    return;
  }
  try {
    // Lazy, optional imports — resolved at runtime only when the SDK packages are
    // installed. Module names are held in variables so the bundler keeps them as
    // dynamic (unresolved-at-build) imports, and typed as `any` so typecheck
    // passes without the packages present.
    const dynImport = (m: string): Promise<Record<string, unknown>> =>
      import(/* @vite-ignore */ m) as Promise<Record<string, unknown>>;
    const { NodeSDK } = await dynImport('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = await dynImport('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = await dynImport('@opentelemetry/exporter-trace-otlp-http');

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const Sdk = NodeSDK as any;
    const sdk = new Sdk({
      serviceName: env.OTEL_SERVICE_NAME,
      traceExporter: new (OTLPTraceExporter as any)({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT }),
      instrumentations: (getNodeAutoInstrumentations as any)(),
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
    sdk.start();
    logger.info('OpenTelemetry started');
  } catch (err) {
    logger.warn({ err }, 'OpenTelemetry SDK not installed — skipping (set up per telemetry/otel.ts)');
  }
}
