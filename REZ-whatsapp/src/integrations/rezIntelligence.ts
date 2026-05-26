/**
 * REZ Intelligence Integration
 * Fixed: Added axios with timeouts, proper error handling, and typed responses
 */

import axios, { AxiosError } from 'axios';
import type { ServiceResponse } from './rabtulPlatform.js';

const INTENT_URL = process.env.INTENT_SERVICE_URL || 'http://localhost:4018';
const PREDICT_URL = process.env.PREDICTIVE_ENGINE_URL || 'http://localhost:4123';
const SEGMENTS_URL = process.env.REALTIME_SEGMENTS_URL || 'http://localhost:4126';
const SIGNAL_URL = process.env.SIGNAL_AGGREGATOR_URL || 'http://localhost:4121';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

const REQUEST_TIMEOUT_MS = 5000; // 5 second timeout

/**
 * Axios request wrapper with timeout and proper error handling
 */
async function request<T>(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    body?: unknown;
    timeout?: number;
  } = {}
): Promise<ServiceResponse<T>> {
  const timeout = options.timeout || REQUEST_TIMEOUT_MS;

  try {
    const response = await axios.post<T>(url, options.body, {
      timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': INTERNAL_TOKEN,
      },
      validateStatus: (status) => status < 500, // Don't throw for 4xx errors
    });

    // Check for API-level errors
    if (response.status >= 400) {
      const errorData = response.data as Record<string, unknown> | null;
      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: `Request failed with status ${response.status}`,
          details: errorData || response.statusText,
        },
      };
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (err) {
    const error = err as AxiosError;

    // Timeout error
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return {
        success: false,
        error: {
          code: 'TIMEOUT',
          message: `Request to ${url} timed out after ${timeout}ms`,
        },
      };
    }

    // Connection error
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: {
          code: 'CONNECTION_ERROR',
          message: `Cannot connect to ${url}`,
        },
      };
    }

    // Other axios errors
    if (error.response) {
      // Server responded with error status
      const errorData = error.response.data as Record<string, unknown> | null;
      return {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: `Server error: ${error.response.status}`,
          details: errorData,
        },
      };
    }

    // Network/request error
    return {
      success: false,
      error: {
        code: 'REQUEST_FAILED',
        message: error.message || 'Request failed',
      },
    };
  }
}

// Response type definitions
export interface IntentPredictResponse {
  intent: string;
  confidence: number;
  entities?: Record<string, unknown>;
}

export interface ChurnPredictResponse {
  churnProbability: number;
  riskLevel: 'low' | 'medium' | 'high';
  factors?: string[];
}

export interface LtvPredictResponse {
  predictedLtv: number;
  confidence: number;
  timeframe: string;
}

export interface SegmentsResponse {
  segments: string[];
  primarySegment: string;
  updatedAt: string;
}

export interface SignalRecordResponse {
  signalId: string;
  recorded: boolean;
}

export const intent = {
  predict: async (
    userId: string
  ): Promise<ServiceResponse<IntentPredictResponse>> => {
    return request<IntentPredictResponse>(`${INTENT_URL}/api/intent/predict`, {
      method: 'POST',
      body: { user_id: userId },
    });
  },
};

export const predict = {
  churn: async (
    userId: string
  ): Promise<ServiceResponse<ChurnPredictResponse>> => {
    return request<ChurnPredictResponse>(`${PREDICT_URL}/api/predict/churn`, {
      method: 'POST',
      body: { user_id: userId },
    });
  },
  ltv: async (
    userId: string
  ): Promise<ServiceResponse<LtvPredictResponse>> => {
    return request<LtvPredictResponse>(`${PREDICT_URL}/api/predict/ltv`, {
      method: 'POST',
      body: { user_id: userId },
    });
  },
};

export const segments = {
  get: async (
    userId: string
  ): Promise<ServiceResponse<SegmentsResponse>> => {
    return request<SegmentsResponse>(`${SEGMENTS_URL}/api/segments/${userId}`);
  },
};

export const signals = {
  record: async (
    signal: unknown
  ): Promise<ServiceResponse<SignalRecordResponse>> => {
    return request<SignalRecordResponse>(`${SIGNAL_URL}/api/signals`, {
      method: 'POST',
      body: signal,
    });
  },
};

export default { intent, predict, segments, signals };
