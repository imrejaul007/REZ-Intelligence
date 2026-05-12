/**
 * Custom Metrics for REZ Intelligence
 */
const { metrics } = require('@opentelemetry/api');
const os = require('os');

// Create meter
const meter = metrics.getMeter('rez-intelligence');

// Pre-defined metrics
const serviceMetrics = {
  // Request metrics
  httpRequestsTotal: meter.createCounter('http_requests_total', {
    description: 'Total HTTP requests',
    unit: '1'
  }),

  httpRequestDuration: meter.createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms'
  }),

  // Business metrics
  eventsProcessed: meter.createCounter('events_processed_total', {
    description: 'Total events processed',
    unit: '1'
  }),

  recommendationsServed: meter.createCounter('recommendations_served_total', {
    description: 'Total recommendations served',
    unit: '1'
  }),

  conversionsTracked: meter.createCounter('conversions_tracked_total', {
    description: 'Total conversions tracked',
    unit: '1'
  }),

  // ML metrics
  predictionsMade: meter.createCounter('predictions_made_total', {
    description: 'Total ML predictions made',
    unit: '1'
  }),

  predictionConfidence: meter.createHistogram('prediction_confidence', {
    description: 'ML prediction confidence scores',
    unit: '1'
  }),

  // Queue metrics
  queueSize: meter.createObservableGauge('queue_size', {
    description: 'Current queue size',
    unit: '1'
  }),

  processingTime: meter.createHistogram('processing_time_ms', {
    description: 'Event processing time',
    unit: 'ms'
  }),

  // Resource metrics
  activeConnections: meter.createUpDownCounter('active_connections', {
    description: 'Number of active connections',
    unit: '1'
  })
};

// Record callback for observable gauges
serviceMetrics.queueSize.addCallback((observableResult) => {
  // This would hook into actual queue
  observableResult.observe(0);
});

// Helper functions
const trackRequest = (method, path, statusCode, duration) => {
  serviceMetrics.httpRequestsTotal.add(1, {
    method,
    path,
    status_code: statusCode.toString()
  });

  serviceMetrics.httpRequestDuration.record(duration, {
    method,
    path
  });
};

const trackEvent = (eventType) => {
  serviceMetrics.eventsProcessed.add(1, {
    event_type: eventType
  });
};

const trackRecommendation = (type, served) => {
  serviceMetrics.recommendationsServed.add(served, {
    recommendation_type: type
  });
};

const trackConversion = (source) => {
  serviceMetrics.conversionsTracked.add(1, {
    source
  });
};

const trackPrediction = (modelType, confidence) => {
  serviceMetrics.predictionsMade.add(1, {
    model_type: modelType
  });

  serviceMetrics.predictionConfidence.record(confidence, {
    model_type: modelType
  });
};

module.exports = {
  serviceMetrics,
  trackRequest,
  trackEvent,
  trackRecommendation,
  trackConversion,
  trackPrediction
};
