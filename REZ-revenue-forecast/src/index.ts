/**
 * REZ Revenue Forecast Service
 * AI-powered revenue prediction engine for merchants
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// ============== SCHEMAS ==============

const forecastSchema = new mongoose.Schema({
  forecastId: { type: String, required: true, unique: true, index: true },
  merchantId: { type: String, required: true, index: true },
  type: { type: String, enum: ['daily', 'weekly', 'monthly', 'seasonal', 'campaign'], required: true },
  period: {
    start: Date,
    end: Date
  },
  predictions: [{
    date: Date,
    predicted: Number,
    confidence: Number,
    lower: Number,
    upper: Number
  }],
  actual: Number,
  accuracy: Number,
  model: { type: String, default: 'ensemble' },
  features: [String],
  createdAt: { type: Date, default: Date.now }
});

const revenueSnapshotSchema = new mongoose.Schema({
  merchantId: { type: String, required: true, index: true },
  date: { type: Date, required: true, index: true },
  revenue: { type: Number, required: true },
  orders: { type: Number, default: 0 },
  avgOrderValue: Number,
  customers: { type: Number, default: 0 },
  newCustomers: { type: Number, default: 0 },
  returningCustomers: { type: Number, default: 0 },
  dayOfWeek: Number,
  isWeekend: Boolean,
  isHoliday: Boolean,
  holidayName: String,
  weather: String,
  temperature: Number,
  events: [String],
  campaigns: [{
    campaignId: String,
    campaignName: String,
    spend: Number,
    type: String
  }]
});

const Forecast = mongoose.model('Forecast', forecastSchema);
const RevenueSnapshot = mongoose.model('RevenueSnapshot', revenueSnapshotSchema);

// ============== SERVICE ==============

class RevenueForecastService {
  private app: express.Application;

  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(express.json());
  }

  private setupRoutes() {
    // Health
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'healthy', service: 'revenue-forecast' });
    });

    // ========== DATA INGESTION ==========

    // Record revenue snapshot
    this.app.post('/api/revenue', async (req: Request, res: Response) => {
      try {
        const data = req.body;
        data.avgOrderValue = data.revenue / (data.orders || 1);

        const snapshot = new RevenueSnapshot(data);
        await snapshot.save();
        res.json(snapshot);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record revenue' });
      }
    });

    // Batch import revenue data
    this.app.post('/api/revenue/batch', async (req: Request, res: Response) => {
      try {
        const dataPoints = req.body.data;
        const snapshots = await RevenueSnapshot.insertMany(
          dataPoints.map((d: any) => ({
            ...d,
            avgOrderValue: d.revenue / (d.orders || 1)
          }))
        );
        res.json({ imported: snapshots.length });
      } catch (error) {
        res.status(500).json({ error: 'Failed to batch import' });
      }
    });

    // ========== FORECASTING ==========

    // Generate forecast
    this.app.post('/api/forecast', async (req: Request, res: Response) => {
      try {
        const { merchantId, type, startDate, endDate, campaigns } = req.body;

        // Get historical data
        const historical = await RevenueSnapshot.find({
          merchantId,
          date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        }).sort({ date: 1 }).lean();

        if (historical.length < 7) {
          return res.status(400).json({ error: 'Not enough historical data' });
        }

        // Generate predictions
        const predictions = this.generatePredictions(historical, startDate, endDate, campaigns);

        // Calculate confidence based on data quality
        const confidence = Math.min(95, 50 + (historical.length / 2));

        const forecast = new Forecast({
          forecastId: `fc_${Date.now()}`,
          merchantId,
          type,
          period: { start: new Date(startDate), end: new Date(endDate) },
          predictions,
          model: 'ensemble',
          features: ['historical_trend', 'day_of_week', 'seasonality', 'campaign_impact']
        });
        await forecast.save();

        res.json(forecast);
      } catch (error) {
        console.error('Forecast error:', error);
        res.status(500).json({ error: 'Failed to generate forecast' });
      }
    });

    // Get today's prediction
    this.app.get('/api/forecast/:merchantId/today', async (req: Request, res: Response) => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const historical = await RevenueSnapshot.find({
          merchantId: req.params.merchantId,
          date: { $gte: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) }
        }).sort({ date: 1 }).lean();

        // Get same day of week historical average
        const dayOfWeek = today.getDay();
        const sameDayHistorical = historical.filter(d => new Date(d.date).getDay() === dayOfWeek);

        let prediction = 0;
        let confidence = 50;

        if (sameDayHistorical.length > 0) {
          prediction = sameDayHistorical.reduce((sum, d) => sum + d.revenue, 0) / sameDayHistorical.length;
          confidence = Math.min(90, 40 + sameDayHistorical.length * 5);
        } else if (historical.length > 0) {
          prediction = historical.reduce((sum, d) => sum + d.revenue, 0) / historical.length;
        }

        // Apply growth trend
        if (historical.length >= 14) {
          const recentAvg = historical.slice(-7).reduce((sum, d) => sum + d.revenue, 0) / 7;
          const olderAvg = historical.slice(-14, -7).reduce((sum, d) => sum + d.revenue, 0) / 7;
          const trend = recentAvg / olderAvg;
          prediction *= trend;
        }

        res.json({
          merchantId: req.params.merchantId,
          date: today,
          predicted: Math.round(prediction),
          confidence,
          lower: Math.round(prediction * 0.85),
          upper: Math.round(prediction * 1.15)
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get prediction' });
      }
    });

    // Get weekly forecast
    this.app.get('/api/forecast/:merchantId/week', async (req: Request, res: Response) => {
      try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - startDate.getDay());
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 6);

        const historical = await RevenueSnapshot.find({
          merchantId: req.params.merchantId,
          date: { $gte: new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000) }
        }).sort({ date: 1 }).lean();

        const predictions = [];
        for (let i = 0; i < 7; i++) {
          const date = new Date(startDate);
          date.setDate(date.getDate() + i);

          const dayHistorical = historical.filter(d =>
            new Date(d.date).getDay() === date.getDay()
          );

          let predicted = dayHistorical.length > 0
            ? dayHistorical.reduce((sum, d) => sum + d.revenue, 0) / dayHistorical.length
            : historical.reduce((sum, d) => sum + d.revenue, 0) / (historical.length || 1);

          // Weekend boost
          if (date.getDay() === 0 || date.getDay() === 6) {
            predicted *= 1.3;
          }

          predictions.push({
            date,
            predicted: Math.round(predicted),
            confidence: Math.min(85, 40 + dayHistorical.length * 5),
            lower: Math.round(predicted * 0.85),
            upper: Math.round(predicted * 1.15)
          });
        }

        res.json({
          merchantId: req.params.merchantId,
          period: { start: startDate, end: endDate },
          predictions,
          totalPredicted: predictions.reduce((sum, p) => sum + p.predicted, 0)
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get weekly forecast' });
      }
    });

    // Get monthly forecast
    this.app.get('/api/forecast/:merchantId/month', async (req: Request, res: Response) => {
      try {
        const startDate = new Date();
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 1);
        endDate.setDate(0);

        const historical = await RevenueSnapshot.find({
          merchantId: req.params.merchantId,
          date: { $gte: new Date(startDate.getTime() - 90 * 24 * 60 * 60 * 1000) }
        }).sort({ date: 1 }).lean();

        // Calculate daily average
        const dailyAvg = historical.length > 0
          ? historical.reduce((sum, d) => sum + d.revenue, 0) / historical.length
          : 0;

        const daysInMonth = endDate.getDate();
        const totalPredicted = dailyAvg * daysInMonth;

        // Weekly breakdown
        const weeklyPredictions = [];
        for (let week = 0; week < 4; week++) {
          const weekStart = new Date(startDate);
          weekStart.setDate(weekStart.getDate() + week * 7);

          weeklyPredictions.push({
            week: week + 1,
            predicted: Math.round(dailyAvg * 7),
            confidence: Math.min(80, 40 + historical.length / 3)
          });
        }

        res.json({
          merchantId: req.params.merchantId,
          period: { start: startDate, end: endDate },
          dailyAverage: Math.round(dailyAvg),
          monthlyPredicted: Math.round(totalPredicted),
          weeklyBreakdown: weeklyPredictions,
          confidence: Math.min(85, 50 + historical.length / 4)
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get monthly forecast' });
      }
    });

    // ========== CAMPAIGN IMPACT ==========

    // Predict campaign impact
    this.app.post('/api/forecast/campaign-impact', async (req: Request, res: Response) => {
      try {
        const { merchantId, campaignType, budget, duration, offerType } = req.body;

        // Historical response rates by campaign type
        const responseRates: Record<string, number> = {
          'cashback': 0.15,
          'discount': 0.12,
          'loyalty': 0.10,
          'referral': 0.08,
          'combo': 0.09
        };

        const rate = responseRates[campaignType] || 0.10;
        const expectedConversions = Math.floor(budget / 100) * rate;
        const expectedRevenue = expectedConversions * (budget * 0.3); // Assuming 30% margin

        // Confidence based on historical data
        const historical = await RevenueSnapshot.find({
          merchantId,
          date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
        }).lean();

        const confidence = Math.min(85, 40 + historical.length * 2);

        res.json({
          campaignType,
          budget,
          duration,
          expectedConversions,
          expectedRevenue: Math.round(expectedRevenue),
          expectedLift: Math.round((expectedRevenue / (historical.reduce((s, d) => s + d.revenue, 0) / (historical.length || 1) * duration)) * 100),
          confidence,
          recommendation: this.getCampaignRecommendation(campaignType, expectedRevenue)
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to predict campaign impact' });
      }
    });

    // ========== HISTORICAL DATA ==========

    // Get revenue history
    this.app.get('/api/revenue/:merchantId', async (req: Request, res: Response) => {
      try {
        const { startDate, endDate, granularity } = req.query;
        const query: any = { merchantId: req.params.merchantId };

        if (startDate || endDate) {
          query.date = {};
          if (startDate) query.date.$gte = new Date(startDate as string);
          if (endDate) query.date.$lte = new Date(endDate as string);
        }

        const data = await RevenueSnapshot.find(query)
          .sort({ date: -1 })
          .lean();

        res.json(data);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch revenue' });
      }
    });

    // Get revenue stats
    this.app.get('/api/revenue/:merchantId/stats', async (req: Request, res: Response) => {
      try {
        const { days } = req.query;
        const startDate = new Date(Date.now() - (Number(days) || 30) * 24 * 60 * 60 * 1000);

        const data = await RevenueSnapshot.aggregate([
          { $match: { merchantId: req.params.merchantId, date: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$revenue' },
              avgDailyRevenue: { $avg: '$revenue' },
              totalOrders: { $sum: '$orders' },
              avgOrderValue: { $avg: '$avgOrderValue' },
              totalCustomers: { $sum: '$customers' },
              newCustomers: { $sum: '$newCustomers' },
              returningCustomers: { $sum: '$returningCustomers' },
              bestDay: { $max: '$revenue' },
              worstDay: { $min: '$revenue' }
            }
          }
        ]);

        res.json(data[0] || {});
      } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    // ========== ALERTS ==========

    // Get forecast alerts
    this.app.get('/api/alerts/:merchantId', async (req: Request, res: Response) => {
      try {
        const alerts = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const historical = await RevenueSnapshot.find({
          merchantId: req.params.merchantId,
          date: { $gte: new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000) }
        }).sort({ date: 1 }).lean();

        if (historical.length >= 7) {
          // Check for declining trend
          const recent = historical.slice(-7);
          const previous = historical.slice(-14, -7);

          const recentAvg = recent.reduce((s, d) => s + d.revenue, 0) / 7;
          const previousAvg = previous.reduce((s, d) => s + d.revenue, 0) / 7;

          if (recentAvg < previousAvg * 0.8) {
            alerts.push({
              type: 'declining_trend',
              severity: 'high',
              message: `Revenue declining ${Math.round((1 - recentAvg / previousAvg) * 100)}% week-over-week`,
              action: 'Consider launching acquisition campaign'
            });
          }

          // Check for weekend performance
          const weekendData = recent.filter((d: any) => d.isWeekend);
          const weekdayData = recent.filter((d: any) => !d.isWeekend);

          if (weekendData.length > 0 && weekdayData.length > 0) {
            const weekendAvg = weekendData.reduce((s: number, d: any) => s + d.revenue, 0) / weekendData.length;
            const weekdayAvg = weekdayData.reduce((s: number, d: any) => s + d.revenue, 0) / weekdayData.length;

            if (weekendAvg < weekdayAvg) {
              alerts.push({
                type: 'weekend_underperformance',
                severity: 'medium',
                message: `Weekend revenue is ${Math.round((1 - weekendAvg / weekdayAvg) * 100)}% lower than weekdays`,
                action: 'Launch weekend promotion campaign'
              });
            }
          }
        }

        res.json(alerts);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get alerts' });
      }
    });
  }

  private generatePredictions(historical: any[], startDate: string, endDate: string, campaigns?: any[]) {
    const predictions = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Calculate baseline from historical
    const baseline = historical.reduce((sum, d) => sum + d.revenue, 0) / historical.length;

    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dayOfWeek = date.getDay();
      const dayHistorical = historical.filter((d: any) =>
        new Date(d.date).getDay() === dayOfWeek
      );

      let predicted = dayHistorical.length > 0
        ? dayHistorical.reduce((sum, d) => sum + d.revenue, 0) / dayHistorical.length
        : baseline;

      // Weekend boost
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        predicted *= 1.25;
      }

      // Campaign boost (simplified)
      if (campaigns && campaigns.length > 0) {
        const campaignBoost = campaigns.reduce((sum, c: any) => sum + (c.spend / 1000), 0);
        predicted *= (1 + campaignBoost * 0.1);
      }

      predictions.push({
        date: new Date(date),
        predicted: Math.round(predicted),
        confidence: Math.min(85, 50 + dayHistorical.length * 3),
        lower: Math.round(predicted * 0.85),
        upper: Math.round(predicted * 1.15)
      });
    }

    return predictions;
  }

  private getCampaignRecommendation(campaignType: string, expectedRevenue: number) {
    if (expectedRevenue > 50000) {
      return 'High potential ROI - recommend launching with full budget';
    } else if (expectedRevenue > 20000) {
      return 'Moderate ROI - test with 50% budget first';
    } else {
      return 'Low ROI expected - consider different campaign type or targeting';
    }
  }

  async start(port: number = 4213): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_revenue_forecast'
      );
      console.log('[RevenueForecast] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[RevenueForecast] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[RevenueForecast] Failed to start:', error);
      throw error;
    }
  }
}

const service = new RevenueForecastService();
service.start(4213);

export default service;
