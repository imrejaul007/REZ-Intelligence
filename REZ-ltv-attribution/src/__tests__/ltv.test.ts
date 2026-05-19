/**
 * LTV Attribution Tests
 */

import { LTVAttributionEngine } from '../services/ltvAttribution';

describe('LTVAttributionEngine', () => {
  let engine: LTVAttributionEngine;

  beforeEach(() => {
    engine = new LTVAttributionEngine();
  });

  describe('calculateCustomerLTV', () => {
    it('should handle customer with no touchpoints', () => {
      const customer = {
        id: 'cust_1',
        merchantId: 'merch_1',
        totalOrders: 5,
        totalSpend: 5000,
        averageOrderValue: 1000,
        touchpoints: [],
      };

      const result = engine.calculateCustomerLTV(customer, 'linear');

      expect(result.customerId).toBe('cust_1');
      expect(result.totalLTV).toBe(5000);
      expect(result.touchpointCount).toBe(0);
      expect(result.channelContribution).toEqual({});
    });

    it('should do first-touch attribution', () => {
      const customer = {
        id: 'cust_1',
        merchantId: 'merch_1',
        totalOrders: 3,
        totalSpend: 3000,
        averageOrderValue: 1000,
        touchpoints: [
          { id: 'tp_1', customerId: 'cust_1', channel: 'Meta', campaignId: 'camp_1', timestamp: new Date('2024-01-01') },
          { id: 'tp_2', customerId: 'cust_1', channel: 'Google', campaignId: 'camp_2', timestamp: new Date('2024-01-02') },
          { id: 'tp_3', customerId: 'cust_1', channel: 'Direct', timestamp: new Date('2024-01-03') },
        ],
      };

      const result = engine.calculateCustomerLTV(customer, 'first_touch');

      expect(result.firstTouchChannel).toBe('Meta');
      expect(result.channelContribution['Meta']).toBe(3000);
      expect(result.channelContribution['Google']).toBeUndefined();
    });

    it('should do last-touch attribution', () => {
      const customer = {
        id: 'cust_1',
        merchantId: 'merch_1',
        totalOrders: 3,
        totalSpend: 3000,
        averageOrderValue: 1000,
        touchpoints: [
          { id: 'tp_1', customerId: 'cust_1', channel: 'Meta', timestamp: new Date('2024-01-01') },
          { id: 'tp_2', customerId: 'cust_1', channel: 'Google', timestamp: new Date('2024-01-02') },
          { id: 'tp_3', customerId: 'cust_1', channel: 'Direct', timestamp: new Date('2024-01-03') },
        ],
      };

      const result = engine.calculateCustomerLTV(customer, 'last_touch');

      expect(result.lastTouchChannel).toBe('Direct');
      expect(result.channelContribution['Direct']).toBe(3000);
    });

    it('should do linear attribution across touchpoints', () => {
      const customer = {
        id: 'cust_1',
        merchantId: 'merch_1',
        totalOrders: 4,
        totalSpend: 4000,
        averageOrderValue: 1000,
        touchpoints: [
          { id: 'tp_1', customerId: 'cust_1', channel: 'Meta', timestamp: new Date('2024-01-01') },
          { id: 'tp_2', customerId: 'cust_1', channel: 'Meta', timestamp: new Date('2024-01-02') },
          { id: 'tp_3', customerId: 'cust_1', channel: 'Google', timestamp: new Date('2024-01-03') },
          { id: 'tp_4', customerId: 'cust_1', channel: 'Google', timestamp: new Date('2024-01-04') },
        ],
      };

      const result = engine.calculateCustomerLTV(customer, 'linear');

      // 4 touchpoints, each gets 1000
      // Meta: 2 touchpoints = 2000
      // Google: 2 touchpoints = 2000
      expect(result.channelContribution['Meta']).toBe(2000);
      expect(result.channelContribution['Google']).toBe(2000);
    });
  });

  describe('generateChannelReport', () => {
    it('should aggregate channel data', () => {
      const customers = [
        {
          id: 'cust_1',
          merchantId: 'merch_1',
          totalOrders: 2,
          totalSpend: 2000,
          averageOrderValue: 1000,
          touchpoints: [
            { id: 'tp_1', customerId: 'cust_1', channel: 'Meta', timestamp: new Date() },
            { id: 'tp_2', customerId: 'cust_1', channel: 'Google', timestamp: new Date() },
          ],
        },
        {
          id: 'cust_2',
          merchantId: 'merch_1',
          totalOrders: 3,
          totalSpend: 3000,
          averageOrderValue: 1000,
          touchpoints: [
            { id: 'tp_3', customerId: 'cust_2', channel: 'Meta', timestamp: new Date() },
            { id: 'tp_4', customerId: 'cust_2', channel: 'TikTok', timestamp: new Date() },
          ],
        },
      ];

      const report = engine.generateChannelReport(customers);

      expect(report.length).toBeGreaterThan(0);

      const meta = report.find(r => r.channel === 'Meta');
      expect(meta).toBeDefined();
      expect(meta?.totalLTV).toBe(2000); // cust_1's LTV
      expect(meta?.customerCount).toBe(2); // Both customers touched Meta
    });
  });

  describe('calculateChannelEfficiency', () => {
    it('should calculate LTV per touchpoint', () => {
      const customers = [
        {
          id: 'cust_1',
          merchantId: 'merch_1',
          totalOrders: 2,
          totalSpend: 2000,
          averageOrderValue: 1000,
          touchpoints: [
            { id: 'tp_1', customerId: 'cust_1', channel: 'Meta', timestamp: new Date() },
            { id: 'tp_2', customerId: 'cust_1', channel: 'Meta', timestamp: new Date() },
          ],
        },
      ];

      const efficiency = engine.calculateChannelEfficiency(customers);

      expect(efficiency['Meta']).toBe(1000); // 2000 / 2 touchpoints
    });
  });
});
