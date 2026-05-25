import logger from './utils/logger';

/**
 * OpenTelemetry Tracing Setup for REZ Intelligence
 *
 * Usage:
 *   // At the very top of your entry file (before other imports)
 *   require('./tracing');
 *
 *   // Then your app code
 *   const express = require('express');
 *   const app = express();
 */
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { OTLPMetricExporter } = require('@opentelemetry/exporter-metrics-otlp-http');
const { PeriodicExportingMetricReader } = require('@opentelemetry/sdk-metrics');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');
const { B3Propagator } = require('@opentelemetry/propagator-b3');

// Configuration from environment
const config = {
  serviceName: process.env.OTEL_SERVICE_NAME || 'rez-intelligence',
  serviceVersion: process.env.OTEL_SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',

  // OTLP Exporters (Jaeger, Tempo, etc.)
  otlpEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318',

  // Sampling
  samplingRate: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG) || 1.0,

  // Additional resource attributes
  deploymentEnvironment: process.env.DEPLOYMENT_ENV || 'local'
};

// Create resource with service info
const resource = new Resource({
  [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
  [SemanticResourceAttributes.SERVICE_VERSION]: config.serviceVersion,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
  'deployment.env': config.deploymentEnvironment,
  'host.name': process.env.HOSTNAME || require('os').hostname(),
  'process.pid': process.pid.toString()
});

// Create exporters
const traceExporter = new OTLPTraceExporter({
  url: `${config.otlpEndpoint}/v1/traces`
});

const metricExporter = new OTLPMetricExporter({
  url: `${config.otlpEndpoint}/v1/metrics`
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 60000 // Export every 60 seconds
});

// Create SDK with auto-instrumentation
const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  textMapPropagator: new B3Propagator(),
  instrumentations: [
    getNodeAutoInstrumentations({
      // Customize auto-instrumentations
      '@opentelemetry/instrumentation-http': {
        ignoreIncomingPaths: ['/health', '/ready']
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true
      },
      '@opentelemetry/instrumentation-mongodb': {
        enhancedDatabaseReporting: true
      }
    })
  ]
});

// Start SDK
function startTracing() {
  try {
    sdk.start();
    logger.info('OpenTelemetry tracing started');
    logger.info(`  Service: ${config.serviceName}`);
    logger.info(`  Endpoint: ${config.otlpEndpoint}`);

    // Graceful shutdown
    process.on('SIGTERM', () => {
      sdk.shutdown()
        .then(() => logger.info('Tracing terminated'))
        .catch((error) => console.error('Error terminating tracing', error))
        .finally(() => process.exit(0));
    });

    process.on('SIGINT', () => {
      sdk.shutdown()
        .then(() => logger.info('Tracing terminated'))
        .catch((error) => console.error('Error terminating tracing', error))
        .finally(() => process.exit(0));
    });
  } catch (error) {
    console.error('Error starting OpenTelemetry:', error);
  }
}

// Export for manual use
module.exports = {
  sdk,
  startTracing,
  config,

  // Create custom spans
  createSpan: (name, fn) => {
    const { trace } = require('@opentelemetry/api');
    const tracer = trace.getTracer(config.serviceName);
    return tracer.startActiveSpan(name, fn);
  },

  // Add attributes to current span
  addSpanAttributes: (attributes) => {
    const { trace } = require('@opentelemetry/api');
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.setAttributes(attributes);
    }
  },

  // Record exception
  recordException: (error) => {
    const { trace } = require('@opentelemetry/api');
    const activeSpan = trace.getActiveSpan();
    if (activeSpan) {
      activeSpan.recordException(error);
    }
  }
};

// Auto-start if this is the entry point
if (require.main === module) {
  startTracing();
}
