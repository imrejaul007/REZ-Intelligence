import { logger } from './logger.js';

/**
 * REZ-unified-attribution → Commerce Graph Sync
 *
 * Syncs attribution data to the unified commerce graph
 */

import axios from 'axios';

const COMMERCE_GRAPH_URL = process.env.COMMERCE_GRAPH_URL || 'http://localhost:4170';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || '';

// ============================================
// TYPES
// ============================================

interface AttributionTransaction {
  userId: string;
  merchantId: string;
  transactionId: string;
  type: 'visit' | 'purchase' | 'redemption';
  amount: number;
  category?: string;
  attributionChannel?: string;
  campaignId?: string;
  touchpointIds?: string[];
  timestamp: Date;
}

interface ConversionEvent {
  userId: string;
  merchantId: string;
  orderId: string;
  revenue: number;
  channels: Record<string, number>;
  attributedRevenue: Record<string, number>;
}

// ============================================
// COMMERCE GRAPH SYNC
// ============================================

class AttributionCommerceSync {
  /**
   * Sync attribution transaction to Commerce Graph
   */
  async syncTransaction(transaction: AttributionTransaction): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/transactions`,
        {
          customerId: transaction.userId,
          merchantId: transaction.merchantId,
          transactionId: transaction.transactionId,
          type: transaction.type,
          amount: transaction.amount,
          category: transaction.category,
          campaignId: transaction.campaignId,
          attributionChannel: transaction.attributionChannel,
          touchpointIds: transaction.touchpointIds,
          timestamp: transaction.timestamp
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[AttributionSync] Transaction synced: ${transaction.transactionId}`);
    } catch (error) {
      logger.error(`[AttributionSync] Failed to sync transaction: ${error.message}`);
    }
  }

  /**
   * Sync conversion event
   */
  async syncConversion(conversion: ConversionEvent): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/conversions`,
        {
          customerId: conversion.userId,
          merchantId: conversion.merchantId,
          orderId: conversion.orderId,
          revenue: conversion.revenue,
          channels: conversion.channels,
          attributedRevenue: conversion.attributedRevenue,
          timestamp: new Date()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[AttributionSync] Conversion synced: ${conversion.orderId}`);
    } catch (error) {
      logger.error(`[AttributionSync] Failed to sync conversion: ${error.message}`);
    }
  }

  /**
   * Sync DOOH attribution
   */
  async syncDOOHAttribution(data: {
    customerId: string;
    merchantId: string;
    screenId: string;
    impressionId: string;
    visitId?: string;
    revenue?: number;
  }): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/attribution/dooh`,
        {
          customerId: data.customerId,
          merchantId: data.merchantId,
          screenId: data.screenId,
          impressionId: data.impressionId,
          visitId: data.visitId,
          revenue: data.revenue,
          timestamp: new Date()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[AttributionSync] DOOH attribution synced`);
    } catch (error) {
      logger.error(`[AttributionSync] Failed to sync DOOH attribution: ${error.message}`);
    }
  }

  /**
   * Sync QR scan attribution
   */
  async syncQRAttribution(data: {
    customerId: string;
    merchantId: string;
    qrId: string;
    scanId: string;
    visitId?: string;
    revenue?: number;
  }): Promise<void> {
    try {
      await axios.post(
        `${COMMERCE_GRAPH_URL}/api/attribution/qr`,
        {
          customerId: data.customerId,
          merchantId: data.merchantId,
          qrId: data.qrId,
          scanId: data.scanId,
          visitId: data.visitId,
          revenue: data.revenue,
          timestamp: new Date()
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      logger.info(`[AttributionSync] QR attribution synced`);
    } catch (error) {
      logger.error(`[AttributionSync] Failed to sync QR attribution: ${error.message}`);
    }
  }

  /**
   * Get attribution report for customer
   */
  async getCustomerAttribution(userId: string, dateRange?: {
    start: Date;
    end: Date;
  }): Promise<unknown> {
    try {
      const params = new URLSearchParams();
      if (dateRange) {
        params.append('startDate', dateRange.start.toISOString());
        params.append('endDate', dateRange.end.toISOString());
      }

      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/attribution/customer/${userId}?${params}`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data;
    } catch (error) {
      logger.error(`[AttributionSync] Failed to get attribution: ${error.message}`);
      return null;
    }
  }

  /**
   * Get channel attribution breakdown
   */
  async getChannelAttribution(userId: string): Promise<Record<string, number>> {
    try {
      const response = await axios.get(
        `${COMMERCE_GRAPH_URL}/api/attribution/channels/${userId}`,
        {
          headers: {
            'X-Internal-Token': INTERNAL_TOKEN
          }
        }
      );
      return response.data.data?.channels || {};
    } catch (error) {
      logger.error(`[AttributionSync] Failed to get channel attribution: ${error.message}`);
      return {};
    }
  }
}

export const attributionCommerceSync = new AttributionCommerceSync();
