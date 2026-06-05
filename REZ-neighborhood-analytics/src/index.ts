/**
 * REZ Neighborhood Analytics Service
 * Hyperlocal intelligence - neighborhood analytics, footfall prediction, and demand forecasting
 */

import express, { Request, Response } from 'express';
import mongoose from 'mongoose';

// ============== SCHEMAS ==============

const neighborhoodSchema = new mongoose.Schema({
  neighborhoodId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  city: String,
  state: String,
  pincode: String,
  coordinates: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: [Number] // [lng, lat]
  },
  boundaries: {
    type: { type: String, enum: ['Polygon'], default: 'Polygon' },
    coordinates: [[[Number]]]
  },
  demographics: {
    population: Number,
    households: Number,
    avgIncome: Number,
    ageDistribution: {
      '18-24': Number,
      '25-34': Number,
      '35-44': Number,
      '45-54': Number,
      '55+': Number
    },
    employmentRate: Number
  },
  infrastructure: {
    metroStations: Number,
    busStops: Number,
    schools: Number,
    offices: Number,
    residentialBuildings: Number,
    shoppingCenters: Number
  },
  footfallScore: Number,
  commercialScore: Number,
  competitionDensity: Number
});

const locationSnapshotSchema = new mongoose.Schema({
  neighborhoodId: { type: String, required: true, index: true },
  merchantId: String,
  date: { type: Date, required: true, index: true },
  footfall: {
    total: Number,
    peak: Number,
    offPeak: Number,
    avgDwellTime: Number
  },
  demographics: {
    ageGroups: { type: Map, of: Number },
    gender: { male: Number, female: Number, other: Number }
  },
  trafficPatterns: {
    morning: Number,
    afternoon: Number,
    evening: Number,
    night: Number
  },
  events: [{
    name: String,
    type: String,
    date: Date,
    expectedAttendance: Number,
    actualAttendance: Number
  }],
  weather: {
    condition: String,
    temperature: Number,
    humidity: Number
  }
});

const demandSignalSchema = new mongoose.Schema({
  signalId: { type: String, required: true, unique: true },
  neighborhoodId: { type: String, required: true, index: true },
  merchantId: String,
  type: {
    type: String,
    enum: ['event', 'weather', 'traffic', 'seasonal', 'competitor', 'demographic'],
    required: true
  },
  subtype: String,
  name: String,
  description: String,
  impact: {
    direction: { type: String, enum: ['positive', 'negative', 'neutral'] },
    magnitude: { type: String, enum: ['low', 'medium', 'high', 'critical'] },
    expectedChange: Number, // percentage
    confidence: Number
  },
  timing: {
    start: Date,
    end: Date,
    recurring: Boolean
  },
  source: String,
  status: { type: String, enum: ['active', 'resolved', 'expired'], default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const footfallForecastSchema = new mongoose.Schema({
  forecastId: { type: String, required: true, unique: true },
  neighborhoodId: { type: String, required: true, index: true },
  merchantId: String,
  date: { type: Date, required: true },
  predicted: {
    footfall: Number,
    confidence: Number,
    upper: Number,
    lower: Number
  },
  factors: [{
    type: String,
    contribution: Number,
    description: String
  }],
  createdAt: { type: Date, default: Date.now }
});

// Models
const Neighborhood = mongoose.model('Neighborhood', neighborhoodSchema);
const LocationSnapshot = mongoose.model('LocationSnapshot', locationSnapshotSchema);
const DemandSignal = mongoose.model('DemandSignal', demandSignalSchema);
const FootfallForecast = mongoose.model('FootfallForecast', footfallForecastSchema);

// ============== SERVICE ==============

class NeighborhoodAnalyticsService {
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
      res.json({ status: 'healthy', service: 'neighborhood-analytics' });
    });

    // ========== NEIGHBORHOODS ==========

    // Register neighborhood
    this.app.post('/api/neighborhoods', async (req: Request, res: Response) => {
      try {
        const neighborhood = new Neighborhood(req.body);
        await neighborhood.save();
        res.json(neighborhood);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create neighborhood' });
      }
    });

    // Get neighborhood by coordinates
    this.app.get('/api/neighborhoods/nearby', async (req: Request, res: Response) => {
      try {
        const { lat, lng, radius } = req.query;

        const neighborhoods = await Neighborhood.find({
          'coordinates.coordinates': {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [Number(lng), Number(lat)]
              },
              $maxDistance: Number(radius) || 5000 // meters
            }
          }
        }).limit(10).lean();

        res.json(neighborhoods);
      } catch (error) {
        res.status(500).json({ error: 'Failed to find neighborhoods' });
      }
    });

    // Get neighborhood details
    this.app.get('/api/neighborhoods/:neighborhoodId', async (req: Request, res: Response) => {
      try {
        const neighborhood = await Neighborhood.findOne({ neighborhoodId: req.params.neighborhoodId });
        res.json(neighborhood);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch neighborhood' });
      }
    });

    // Update neighborhood data
    this.app.patch('/api/neighborhoods/:neighborhoodId', async (req: Request, res: Response) => {
      try {
        const neighborhood = await Neighborhood.findOneAndUpdate(
          { neighborhoodId: req.params.neighborhoodId },
          req.body,
          { new: true }
        );
        res.json(neighborhood);
      } catch (error) {
        res.status(500).json({ error: 'Failed to update neighborhood' });
      }
    });

    // ========== LOCATION SNAPSHOTS ==========

    // Record location data
    this.app.post('/api/snapshots', async (req: Request, res: Response) => {
      try {
        const snapshot = new LocationSnapshot(req.body);
        await snapshot.save();
        res.json(snapshot);
      } catch (error) {
        res.status(500).json({ error: 'Failed to record snapshot' });
      }
    });

    // Get historical data
    this.app.get('/api/snapshots/:neighborhoodId', async (req: Request, res: Response) => {
      try {
        const { startDate, endDate } = req.query;
        const query: any = { neighborhoodId: req.params.neighborhoodId };

        if (startDate || endDate) {
          query.date = {};
          if (startDate) query.date.$gte = new Date(startDate as string);
          if (endDate) query.date.$lte = new Date(endDate as string);
        }

        const snapshots = await LocationSnapshot.find(query)
          .sort({ date: -1 })
          .limit(100)
          .lean();

        res.json(snapshots);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch snapshots' });
      }
    });

    // ========== DEMAND SIGNALS ==========

    // Create demand signal
    this.app.post('/api/signals', async (req: Request, res: Response) => {
      try {
        const signal = new DemandSignal({
          ...req.body,
          signalId: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        });
        await signal.save();
        res.json(signal);
      } catch (error) {
        res.status(500).json({ error: 'Failed to create signal' });
      }
    });

    // Get active signals for neighborhood
    this.app.get('/api/signals/:neighborhoodId/active', async (req: Request, res: Response) => {
      try {
        const signals = await DemandSignal.find({
          neighborhoodId: req.params.neighborhoodId,
          status: 'active',
          $or: [
            { 'timing.end': { $gte: new Date() } },
            { 'timing.end': null }
          ]
        }).lean();

        res.json(signals);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch signals' });
      }
    });

    // Get all signals
    this.app.get('/api/signals/:neighborhoodId', async (req: Request, res: Response) => {
      try {
        const { type, days } = req.query;
        const query: any = { neighborhoodId: req.params.neighborhoodId };

        if (type) query.type = type;
        if (days) {
          const startDate = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
          query.createdAt = { $gte: startDate };
        }

        const signals = await DemandSignal.find(query)
          .sort({ createdAt: -1 })
          .lean();

        res.json(signals);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch signals' });
      }
    });

    // Mark signal as resolved
    this.app.patch('/api/signals/:signalId/resolve', async (req: Request, res: Response) => {
      try {
        const signal = await DemandSignal.findOneAndUpdate(
          { signalId: req.params.signalId },
          { status: 'resolved' },
          { new: true }
        );
        res.json(signal);
      } catch (error) {
        res.status(500).json({ error: 'Failed to resolve signal' });
      }
    });

    // ========== FOOTFALL FORECAST ==========

    // Generate footfall forecast
    this.app.post('/api/forecast/footfall', async (req: Request, res: Response) => {
      try {
        const { neighborhoodId, merchantId, date } = req.body;

        // Get historical data
        const historical = await LocationSnapshot.find({
          neighborhoodId,
          date: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        }).lean();

        // Get active signals
        const signals = await DemandSignal.find({
          neighborhoodId,
          status: 'active'
        }).lean();

        // Calculate baseline
        const baseline = historical.length > 0
          ? historical.reduce((sum, s) => sum + (s.footfall?.total || 0), 0) / historical.length
          : 100;

        // Apply signal adjustments
        let adjustment = 1;
        const factors = [];

        for (const signal of signals) {
          if (signal.timing.start && new Date(signal.timing.start) <= new Date(date) &&
            (!signal.timing.end || new Date(signal.timing.end) >= new Date(date))) {
            const magnitudeMap = { low: 0.05, medium: 0.15, high: 0.30, critical: 0.50 };
            const mag = magnitudeMap[signal.impact.magnitude] || 0.1;
            const impact = signal.impact.direction === 'positive' ? mag : -mag;
            adjustment *= (1 + impact);
            factors.push({
              type: signal.type,
              contribution: impact * 100,
              description: signal.name
            });
          }
        }

        // Day of week adjustment
        const dayOfWeek = new Date(date).getDay();
        const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 1.3 : 1;

        const predicted = Math.round(baseline * adjustment * weekendFactor);
        const confidence = Math.min(90, 50 + historical.length * 0.5);

        const forecast = new FootfallForecast({
          forecastId: `fc_${Date.now()}`,
          neighborhoodId,
          merchantId,
          date: new Date(date),
          predicted: {
            footfall: predicted,
            confidence,
            upper: Math.round(predicted * 1.2),
            lower: Math.round(predicted * 0.8)
          },
          factors
        });
        await forecast.save();

        res.json(forecast);
      } catch (error) {
        console.error('Forecast error:', error);
        res.status(500).json({ error: 'Failed to generate forecast' });
      }
    });

    // Get footfall forecast
    this.app.get('/api/forecast/:neighborhoodId', async (req: Request, res: Response) => {
      try {
        const { days } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 1);

        const forecasts = await FootfallForecast.find({
          neighborhoodId: req.params.neighborhoodId,
          date: { $gte: startDate }
        }).sort({ date: -1 }).lean();

        res.json(forecasts);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch forecasts' });
      }
    });

    // ========== ANALYTICS ==========

    // Get neighborhood insights
    this.app.get('/api/insights/:neighborhoodId', async (req: Request, res: Response) => {
      try {
        const neighborhood = await Neighborhood.findOne({ neighborhoodId: req.params.neighborhoodId });
        const signals = await DemandSignal.find({
          neighborhoodId: req.params.neighborhoodId,
          status: 'active'
        }).lean();

        // Calculate demand score
        let demandScore = 50;
        if (neighborhood?.footfallScore) demandScore += neighborhood.footfallScore * 0.3;
        if (neighborhood?.commercialScore) demandScore += neighborhood.commercialScore * 0.3;

        // Factor in signals
        for (const signal of signals) {
          if (signal.impact.direction === 'positive') demandScore += 5;
          else if (signal.impact.direction === 'negative') demandScore -= 5;
        }

        // Get upcoming events
        const upcomingEvents = signals.filter(s =>
          s.type === 'event' && s.timing.start && new Date(s.timing.start) > new Date()
        );

        res.json({
          neighborhood: neighborhood?.name,
          demandScore: Math.min(100, Math.max(0, demandScore)),
          footfallScore: neighborhood?.footfallScore || 0,
          commercialScore: neighborhood?.commercialScore || 0,
          competitionDensity: neighborhood?.competitionDensity || 0,
          activeSignals: signals.length,
          upcomingEvents,
          recommendations: this.generateRecommendations(neighborhood, signals)
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get insights' });
      }
    });

    // Get demand summary
    this.app.get('/api/demand/:neighborhoodId/summary', async (req: Request, res: Response) => {
      try {
        const signals = await DemandSignal.find({
          neighborhoodId: req.params.neighborhoodId,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).lean();

        const summary = {
          totalSignals: signals.length,
          byType: {
            event: signals.filter(s => s.type === 'event').length,
            weather: signals.filter(s => s.type === 'weather').length,
            traffic: signals.filter(s => s.type === 'traffic').length,
            seasonal: signals.filter(s => s.type === 'seasonal').length,
            competitor: signals.filter(s => s.type === 'competitor').length,
            demographic: signals.filter(s => s.type === 'demographic').length
          },
          positiveImpact: signals.filter(s => s.impact.direction === 'positive').length,
          negativeImpact: signals.filter(s => s.impact.direction === 'negative').length,
          highImpact: signals.filter(s => s.impact.magnitude === 'high' || s.impact.magnitude === 'critical').length
        };

        res.json(summary);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get demand summary' });
      }
    });
  }

  private generateRecommendations(neighborhood: any, signals: any[]) {
    const recommendations = [];

    // Based on demographics
    if (neighborhood?.demographics?.avgIncome > 150000) {
      recommendations.push({
        type: 'pricing',
        priority: 'medium',
        text: 'High-income area - Consider premium positioning'
      });
    }

    // Based on age distribution
    if (neighborhood?.demographics?.ageDistribution?.['18-24'] > 30) {
      recommendations.push({
        type: 'marketing',
        priority: 'high',
        text: 'Young demographic - Emphasize social media and trends'
      });
    }

    // Based on infrastructure
    if (neighborhood?.infrastructure?.metroStations > 2) {
      recommendations.push({
        type: 'location',
        priority: 'high',
        text: 'High foot traffic area - Maximize visibility'
      });
    }

    // Based on signals
    const eventSignals = signals.filter(s => s.type === 'event' && s.impact.direction === 'positive');
    if (eventSignals.length > 0) {
      recommendations.push({
        type: 'timing',
        priority: 'high',
        text: `${eventSignals.length} upcoming events - Launch targeted campaigns`
      });
    }

    // Based on competition
    if (neighborhood?.competitionDensity > 0.7) {
      recommendations.push({
        type: 'differentiation',
        priority: 'high',
        text: 'High competition - Focus on unique value proposition'
      });
    }

    return recommendations;
  }

  async start(port: number = 4214): Promise<void> {
    try {
      await mongoose.connect(
        process.env.MONGODB_URI || 'mongodb://localhost:27017/rez_neighborhood_analytics'
      );
      console.log('[NeighborhoodAnalytics] Connected to MongoDB');

      this.app.listen(port, () => {
        console.log(`[NeighborhoodAnalytics] Service running on port ${port}`);
      });
    } catch (error) {
      console.error('[NeighborhoodAnalytics] Failed to start:', error);
      throw error;
    }
  }
}

const service = new NeighborhoodAnalyticsService();
service.start(4214);

export default service;
