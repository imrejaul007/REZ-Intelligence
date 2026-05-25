import express, { Request, Response, NextFunction } import logger from './utils/logger';
import from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// ============================================
// Type Definitions
// ============================================

type ZoneType = 'mall' | 'office' | 'college' | 'airport' | 'high_street';
type AdFormat = 'banner' | 'video' | 'interactive';
type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

interface Location {
  lat: number;
  lng: number;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

interface Demographics {
  ageGroups: Record<string, number>;
  incomeLevels: Record<string, number>;
}

interface BehavioralData {
  avgDwellTime: number;
  peakHours: number[];
  repeatRate: number;
  avgVisitFrequency: number;
  conversionRate: number;
}

interface AudienceProfile {
  totalVisitors: number;
  dailyFootfall: number;
  demographics: Demographics;
  behavioral: BehavioralData;
  segments: Record<string, number>;
  lastUpdated: string;
}

interface AdSlot {
  slotId: string;
  location: string;
  locationDetail: string;
  format: AdFormat;
  dimensions: string;
  impressions: number;
  price: number;
  available: boolean;
  minBookingDuration: number;
  maxBookingDuration: number;
}

interface Pricing {
  baseCPM: number;
  peakMultiplier: number;
  formatMultipliers: Record<AdFormat, number>;
  segmentMultipliers: Record<string, number>;
}

interface Geofence {
  center: Location;
  radius: number;
  polygon?: { lat: number; lng: number }[];
}

interface Zone {
  zoneId: string;
  zoneType: ZoneType;
  name: string;
  geofence: Geofence;
  audience: AudienceProfile;
  availableSlots: AdSlot[];
  pricing: Pricing;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Booking {
  bookingId: string;
  zoneId: string;
  slotId: string;
  advertiserId: string;
  campaignId: string;
  startDate: string;
  endDate: string;
  status: BookingStatus;
  totalAmount: number;
  impressions: number;
  targeting: TargetingCriteria;
  createdAt: string;
  updatedAt: string;
}

interface TargetingCriteria {
  ageGroups?: string[];
  incomeLevels?: string[];
  peakHoursOnly?: boolean;
  segments?: string[];
}

interface FootfallAnalytics {
  zoneId: string;
  period: string;
  hourly: Record<number, number>;
  daily: Record<string, number>;
  weekly: Record<string, number>;
  monthly: Record<string, number>;
  trends: {
    dailyChange: number;
    weeklyChange: number;
    monthlyChange: number;
  };
  predictions: {
    nextWeek: number;
    nextMonth: number;
  };
}

interface AudienceSizeRequest {
  zoneIds: string[];
  demographics?: {
    ageGroups?: string[];
    incomeLevels?: string[];
  };
  behavioral?: {
    peakHoursOnly?: boolean;
    minDwellTime?: number;
  };
  segments?: string[];
}

interface GeofenceRequest {
  lat: number;
  lng: number;
  radius: number;
  zoneType?: ZoneType;
}

interface BookingRequest {
  zoneId: string;
  slotId: string;
  advertiserId: string;
  campaignId: string;
  startDate: string;
  endDate: string;
  targeting?: TargetingCriteria;
}

// ============================================
// In-Memory Data Store
// ============================================

const zones: Map<string, Zone> = new Map();
const bookings: Map<string, Booking> = new Map();

// Initialize sample zones
function initializeSampleData(): void {
  const sampleZones: Zone[] = [
    {
      zoneId: 'mall-001',
      zoneType: 'mall',
      name: 'Phoenix Marketcity Mall',
      geofence: {
        center: { lat: 12.9352, lng: 77.6245, address: 'Phoenix Marketcity', city: 'Bangalore', state: 'Karnataka', pincode: '560048' },
        radius: 500
      },
      audience: {
        totalVisitors: 45000,
        dailyFootfall: 12000,
        demographics: {
          ageGroups: { '18-24': 35, '25-34': 40, '35-44': 15, '45+': 10 },
          incomeLevels: { 'low': 20, 'middle': 45, 'upper-middle': 25, 'high': 10 }
        },
        behavioral: {
          avgDwellTime: 95,
          peakHours: [11, 12, 13, 14, 17, 18, 19],
          repeatRate: 0.68,
          avgVisitFrequency: 2.3,
          conversionRate: 0.12
        },
        segments: { 'shoppers': 0.45, 'foodies': 0.30, 'entertainment-seekers': 0.25 },
        lastUpdated: new Date().toISOString()
      },
      availableSlots: [
        { slotId: 'mall-001-b1', location: 'Entrance', locationDetail: 'Main Entrance - Digital Kiosk', format: 'interactive', dimensions: '55"', impressions: 2500, price: 45000, available: true, minBookingDuration: 7, maxBookingDuration: 30 },
        { slotId: 'mall-001-b2', location: 'Food Court', locationDetail: 'Food Court Entrance', format: 'video', dimensions: '75"', impressions: 1800, price: 35000, available: true, minBookingDuration: 7, maxBookingDuration: 30 },
        { slotId: 'mall-001-b3', location: 'Elevator', locationDetail: 'Lift Area - Floor 2', format: 'banner', dimensions: '43"', impressions: 1200, price: 25000, available: true, minBookingDuration: 3, maxBookingDuration: 30 },
        { slotId: 'mall-001-b4', location: 'Parking', locationDetail: 'Basement Entrance', format: 'banner', dimensions: '32"', impressions: 800, price: 15000, available: true, minBookingDuration: 3, maxBookingDuration: 30 }
      ],
      pricing: {
        baseCPM: 120,
        peakMultiplier: 1.5,
        formatMultipliers: { banner: 1.0, video: 1.8, interactive: 2.5 },
        segmentMultipliers: { 'shoppers': 1.2, 'foodies': 1.1, 'entertainment-seekers': 1.3 }
      },
      isActive: true,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: new Date().toISOString()
    },
    {
      zoneId: 'office-001',
      zoneType: 'office',
      name: 'Manyata Tech Park',
      geofence: {
        center: { lat: 13.0350, lng: 77.6250, address: 'Manyata Tech Park', city: 'Bangalore', state: 'Karnataka', pincode: '560045' },
        radius: 1000
      },
      audience: {
        totalVisitors: 85000,
        dailyFootfall: 35000,
        demographics: {
          ageGroups: { '18-24': 25, '25-34': 50, '35-44': 20, '45+': 5 },
          incomeLevels: { 'low': 5, 'middle': 30, 'upper-middle': 45, 'high': 20 }
        },
        behavioral: {
          avgDwellTime: 60,
          peakHours: [9, 10, 12, 13, 17, 18],
          repeatRate: 0.95,
          avgVisitFrequency: 5,
          conversionRate: 0.08
        },
        segments: { 'tech-professionals': 0.60, 'corporate-executives': 0.25, 'startup-founders': 0.15 },
        lastUpdated: new Date().toISOString()
      },
      availableSlots: [
        { slotId: 'office-001-s1', location: 'Main Gate', locationDetail: 'Entry Point - Digital Display', format: 'video', dimensions: '86"', impressions: 5000, price: 85000, available: true, minBookingDuration: 14, maxBookingDuration: 90 },
        { slotId: 'office-001-s2', location: 'Cafeteria', locationDetail: 'Food Court Digital Wall', format: 'interactive', dimensions: '120"', impressions: 3000, price: 65000, available: true, minBookingDuration: 7, maxBookingDuration: 60 },
        { slotId: 'office-001-s3', location: 'Parking', locationDetail: 'Basement Level 1', format: 'banner', dimensions: '55"', impressions: 1500, price: 30000, available: true, minBookingDuration: 7, maxBookingDuration: 30 }
      ],
      pricing: {
        baseCPM: 180,
        peakMultiplier: 1.8,
        formatMultipliers: { banner: 1.0, video: 2.0, interactive: 2.8 },
        segmentMultipliers: { 'tech-professionals': 1.3, 'corporate-executives': 1.5, 'startup-founders': 1.4 }
      },
      isActive: true,
      createdAt: '2024-02-20T10:00:00Z',
      updatedAt: new Date().toISOString()
    },
    {
      zoneId: 'college-001',
      zoneType: 'college',
      name: 'Christ University',
      geofence: {
        center: { lat: 12.9347, lng: 77.6041, address: 'Christ University', city: 'Bangalore', state: 'Karnataka', pincode: '560029' },
        radius: 300
      },
      audience: {
        totalVisitors: 25000,
        dailyFootfall: 8000,
        demographics: {
          ageGroups: { '18-24': 85, '25-34': 12, '35-44': 2, '45+': 1 },
          incomeLevels: { 'low': 15, 'middle': 50, 'upper-middle': 30, 'high': 5 }
        },
        behavioral: {
          avgDwellTime: 45,
          peakHours: [9, 10, 11, 12, 13, 14, 15],
          repeatRate: 0.90,
          avgVisitFrequency: 4,
          conversionRate: 0.15
        },
        segments: { 'students': 0.75, 'young-professionals': 0.20, 'faculty': 0.05 },
        lastUpdated: new Date().toISOString()
      },
      availableSlots: [
        { slotId: 'college-001-c1', location: 'Main Building', locationDetail: 'Entrance Foyer', format: 'interactive', dimensions: '55"', impressions: 2000, price: 28000, available: true, minBookingDuration: 7, maxBookingDuration: 30 },
        { slotId: 'college-001-c2', location: 'Cafeteria', locationDetail: 'Food Court Display', format: 'video', dimensions: '65"', impressions: 1500, price: 22000, available: true, minBookingDuration: 7, maxBookingDuration: 30 }
      ],
      pricing: {
        baseCPM: 80,
        peakMultiplier: 1.3,
        formatMultipliers: { banner: 1.0, video: 1.5, interactive: 2.0 },
        segmentMultipliers: { 'students': 1.1, 'young-professionals': 1.2, 'faculty': 0.9 }
      },
      isActive: true,
      createdAt: '2024-03-10T10:00:00Z',
      updatedAt: new Date().toISOString()
    },
    {
      zoneId: 'airport-001',
      zoneType: 'airport',
      name: 'Kempegowda International Airport',
      geofence: {
        center: { lat: 13.1979, lng: 77.7063, address: 'KIADB Airport', city: 'Bangalore', state: 'Karnataka', pincode: '560300' },
        radius: 2000
      },
      audience: {
        totalVisitors: 120000,
        dailyFootfall: 45000,
        demographics: {
          ageGroups: { '18-24': 20, '25-34': 40, '35-44': 25, '45+': 15 },
          incomeLevels: { 'low': 5, 'middle': 25, 'upper-middle': 40, 'high': 30 }
        },
        behavioral: {
          avgDwellTime: 120,
          peakHours: [6, 7, 8, 9, 18, 19, 20, 21],
          repeatRate: 0.15,
          avgVisitFrequency: 0.5,
          conversionRate: 0.05
        },
        segments: { 'frequent-flyers': 0.35, 'business-travelers': 0.40, 'tourists': 0.25 },
        lastUpdated: new Date().toISOString()
      },
      availableSlots: [
        { slotId: 'airport-001-a1', location: 'Terminal 1', locationDetail: 'Arrivals Hall', format: 'video', dimensions: '120"', impressions: 8000, price: 150000, available: true, minBookingDuration: 14, maxBookingDuration: 90 },
        { slotId: 'airport-001-a2', location: 'Terminal 2', locationDetail: 'Security Hold Area', format: 'interactive', dimensions: '86"', impressions: 5000, price: 120000, available: true, minBookingDuration: 14, maxBookingDuration: 90 },
        { slotId: 'airport-001-a3', location: 'Gates', locationDetail: 'Gate L3 - Digital Board', format: 'banner', dimensions: '55"', impressions: 3000, price: 65000, available: true, minBookingDuration: 7, maxBookingDuration: 60 }
      ],
      pricing: {
        baseCPM: 250,
        peakMultiplier: 2.0,
        formatMultipliers: { banner: 1.0, video: 2.5, interactive: 3.2 },
        segmentMultipliers: { 'frequent-flyers': 1.5, 'business-travelers': 1.8, 'tourists': 1.2 }
      },
      isActive: true,
      createdAt: '2024-01-05T10:00:00Z',
      updatedAt: new Date().toISOString()
    },
    {
      zoneId: 'highstreet-001',
      zoneType: 'high_street',
      name: 'MG Road High Street',
      geofence: {
        center: { lat: 12.9758, lng: 77.6058, address: 'Mahatma Gandhi Road', city: 'Bangalore', state: 'Karnataka', pincode: '560001' },
        radius: 800
      },
      audience: {
        totalVisitors: 60000,
        dailyFootfall: 18000,
        demographics: {
          ageGroups: { '18-24': 30, '25-34': 40, '35-44': 20, '45+': 10 },
          incomeLevels: { 'low': 10, 'middle': 35, 'upper-middle': 40, 'high': 15 }
        },
        behavioral: {
          avgDwellTime: 75,
          peakHours: [10, 11, 12, 17, 18, 19, 20],
          repeatRate: 0.55,
          avgVisitFrequency: 2.0,
          conversionRate: 0.10
        },
        segments: { 'shoppers': 0.40, 'foodies': 0.35, 'entertainment-seekers': 0.25 },
        lastUpdated: new Date().toISOString()
      },
      availableSlots: [
        { slotId: 'highstreet-001-h1', location: 'MG Road Square', locationDetail: 'Central Plaza LED', format: 'video', dimensions: '200"', impressions: 6000, price: 95000, available: true, minBookingDuration: 14, maxBookingDuration: 60 },
        { slotId: 'highstreet-001-h2', location: 'Brigade Road Junction', locationDetail: 'Corner Display', format: 'interactive', dimensions: '75"', impressions: 2500, price: 48000, available: true, minBookingDuration: 7, maxBookingDuration: 30 },
        { slotId: 'highstreet-001-h3', location: 'Metro Station', locationDetail: 'Exit Display', format: 'banner', dimensions: '43"', impressions: 1800, price: 32000, available: true, minBookingDuration: 7, maxBookingDuration: 30 }
      ],
      pricing: {
        baseCPM: 150,
        peakMultiplier: 1.6,
        formatMultipliers: { banner: 1.0, video: 1.9, interactive: 2.4 },
        segmentMultipliers: { 'shoppers': 1.2, 'foodies': 1.1, 'entertainment-seekers': 1.3 }
      },
      isActive: true,
      createdAt: '2024-02-01T10:00:00Z',
      updatedAt: new Date().toISOString()
    }
  ];

  sampleZones.forEach(zone => zones.set(zone.zoneId, zone));
}

// ============================================
// Validation Schemas
// ============================================

const geofenceRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  radius: z.number().min(50).max(5000).optional().default(500),
  zoneType: z.enum(['mall', 'office', 'college', 'airport', 'high_street']).optional()
});

const bookingRequestSchema = z.object({
  zoneId: z.string().min(1),
  slotId: z.string().min(1),
  advertiserId: z.string().min(1),
  campaignId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  targeting: z.object({
    ageGroups: z.array(z.string()).optional(),
    incomeLevels: z.array(z.string()).optional(),
    peakHoursOnly: z.boolean().optional(),
    segments: z.array(z.string()).optional()
  }).optional()
});

const audienceSizeRequestSchema = z.object({
  zoneIds: z.array(z.string()).min(1),
  demographics: z.object({
    ageGroups: z.array(z.string()).optional(),
    incomeLevels: z.array(z.string()).optional()
  }).optional(),
  behavioral: z.object({
    peakHoursOnly: z.boolean().optional(),
    minDwellTime: z.number().optional()
  }).optional(),
  segments: z.array(z.string()).optional()
});

// ============================================
// Utility Functions
// ============================================

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lng2 - lng1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function isWithinGeofence(point: { lat: number; lng: number }, geofence: Geofence): boolean {
  const distance = calculateDistance(
    point.lat,
    point.lng,
    geofence.center.lat,
    geofence.center.lng
  );
  return distance <= geofence.radius;
}

function generateFootfallAnalytics(zone: Zone): FootfallAnalytics {
  const hourly: Record<number, number> = {};
  const now = new Date();
  const dayOfWeek = now.getDay();

  for (let hour = 0; hour < 24; hour++) {
    let baseHourlyFootfall = zone.audience.dailyFootfall / 24;

    if (zone.audience.behavioral.peakHours.includes(hour)) {
      baseHourlyFootfall *= 1.8;
    } else if (hour >= 0 && hour <= 5) {
      baseHourlyFootfall *= 0.1;
    } else if (hour >= 6 && hour <= 8) {
      baseHourlyFootfall *= 0.7;
    } else if (hour >= 20 && hour <= 23) {
      baseHourlyFootfall *= 0.5;
    }

    hourly[hour] = Math.round(baseHourlyFootfall);
  }

  const daily: Record<string, number> = {};
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  days.forEach((day, index) => {
    let dailyFootfall = zone.audience.dailyFootfall;
    if (index === 0 || index === 6) {
      dailyFootfall *= 0.8;
    } else if (index === dayOfWeek) {
      dailyFootfall *= 1.1;
    }
    daily[day] = Math.round(dailyFootfall);
  });

  const weekly: Record<string, number> = {};
  for (let week = 1; week <= 4; week++) {
    weekly[`Week ${week}`] = Math.round(zone.audience.dailyFootfall * 7 * (1 + (week - 2) * 0.02));
  }

  const monthly: Record<string, number> = {};
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const currentMonth = new Date().getMonth();
  months.forEach((month, index) => {
    const monthIndex = index;
    let monthlyFootfall = zone.audience.dailyFootfall * 30;
    if (monthIndex === currentMonth) {
      monthlyFootfall *= 1.05;
    }
    monthly[month] = Math.round(monthlyFootfall);
  });

  const dailyChange = (Math.random() - 0.5) * 10;
  const weeklyChange = (Math.random() - 0.3) * 15;
  const monthlyChange = (Math.random() - 0.2) * 20;

  return {
    zoneId: zone.zoneId,
    period: 'current',
    hourly,
    daily,
    weekly,
    monthly,
    trends: {
      dailyChange: Math.round(dailyChange * 10) / 10,
      weeklyChange: Math.round(weeklyChange * 10) / 10,
      monthlyChange: Math.round(monthlyChange * 10) / 10
    },
    predictions: {
      nextWeek: Math.round(zone.audience.dailyFootfall * 7 * 1.02),
      nextMonth: Math.round(zone.audience.dailyFootfall * 30 * 1.05)
    }
  };
}

function calculateBookingPrice(zone: Zone, slot: AdSlot, startDate: string, endDate: string, targeting?: TargetingCriteria): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

  let price = slot.price * days;

  const startHour = start.getHours();
  if (zone.audience.behavioral.peakHours.includes(startHour)) {
    price *= zone.pricing.peakMultiplier;
  }

  price *= zone.pricing.formatMultipliers[slot.format];

  if (targeting?.segments) {
    const avgSegmentMultiplier = targeting.segments.reduce((sum, seg) => {
      return sum + (zone.pricing.segmentMultipliers[seg] || 1.0);
    }, 0) / targeting.segments.length;
    price *= avgSegmentMultiplier;
  }

  return Math.round(price * 100) / 100;
}

// ============================================
// Express Application Setup
// ============================================

const app = express();
const PORT = process.env.PORT || 4059;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize sample data
initializeSampleData();

// ============================================
// Request Logger Middleware
// ============================================

app.use((req: Request, _res: Response, next: NextFunction) => {
  logger.info(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// API Endpoints
// ============================================

/**
 * POST /target/geofence
 * Get targeting information for a geofence location
 */
app.post('/target/geofence', (req: Request, res: Response) => {
  try {
    const validation = geofenceRequestSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { lat, lng, radius, zoneType } = validation.data;

    const matchingZones: Zone[] = [];
    zones.forEach((zone) => {
      if (!zone.isActive) return;
      if (zoneType && zone.zoneType !== zoneType) return;
      if (isWithinGeofence({ lat, lng }, zone.geofence)) {
        matchingZones.push(zone);
      }
    });

    if (matchingZones.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No zones found within the specified geofence',
        query: { lat, lng, radius, zoneType }
      });
    }

    const targetingData = matchingZones.map(zone => ({
      zoneId: zone.zoneId,
      zoneType: zone.zoneType,
      name: zone.name,
      audience: zone.audience,
      availableSlots: zone.availableSlots.filter(slot => slot.available),
      pricing: zone.pricing,
      distance: calculateDistance(lat, lng, zone.geofence.center.lat, zone.geofence.center.lng)
    }));

    res.json({
      success: true,
      data: {
        queryLocation: { lat, lng, radius },
        matchedZones: targetingData,
        totalZones: targetingData.length,
        estimatedAudience: targetingData.reduce((sum, z) => sum + z.audience.dailyFootfall, 0)
      }
    });
  } catch (error) {
    console.error('Error in /target/geofence:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /zones
 * List all available zones
 */
app.get('/zones', (req: Request, res: Response) => {
  try {
    const { type, city, active } = req.query;

    let filteredZones = Array.from(zones.values());

    if (type) {
      filteredZones = filteredZones.filter(z => z.zoneType === type);
    }

    if (city) {
      filteredZones = filteredZones.filter(z =>
        z.geofence.center.city.toLowerCase() === String(city).toLowerCase()
      );
    }

    if (active !== undefined) {
      const isActive = active === 'true';
      filteredZones = filteredZones.filter(z => z.isActive === isActive);
    }

    const zoneSummaries = filteredZones.map(zone => ({
      zoneId: zone.zoneId,
      zoneType: zone.zoneType,
      name: zone.name,
      location: {
        city: zone.geofence.center.city,
        address: zone.geofence.center.address
      },
      dailyFootfall: zone.audience.dailyFootfall,
      totalSlots: zone.availableSlots.length,
      availableSlots: zone.availableSlots.filter(s => s.available).length,
      isActive: zone.isActive
    }));

    res.json({
      success: true,
      data: {
        zones: zoneSummaries,
        total: zoneSummaries.length,
        filters: { type, city, active }
      }
    });
  } catch (error) {
    console.error('Error in /zones:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /zones/:zoneId
 * Get detailed zone information
 */
app.get('/zones/:zoneId', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const zone = zones.get(zoneId);

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found',
        zoneId
      });
    }

    res.json({
      success: true,
      data: zone
    });
  } catch (error) {
    console.error('Error in /zones/:zoneId:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

interface AudienceSummary {
  totalVisitors: number;
  dailyFootfall: number;
  segments: Record<string, number>;
  lastUpdated: string;
}

interface AudienceResponse {
  zoneId: string;
  zoneName: string;
  zoneType: string;
  audience: AudienceProfile | AudienceSummary | Record<string, unknown>;
  segmentDetails?: Array<{ name: string; percentage: number; estimatedCount: number }>;
  availableInsights: string[];
}

/**
 * GET /zones/:zoneId/audience
 * Get audience profile for a specific zone
 */
app.get('/zones/:zoneId/audience', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const zone = zones.get(zoneId);

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found',
        zoneId
      });
    }

    const { demographics, behavioral, segments } = req.query;
    let response: AudienceResponse = {
      zoneId,
      zoneName: zone.name,
      zoneType: zone.zoneType,
      audience: zone.audience,
      availableInsights: ['demographics', 'behavioral', 'segments']
    };

    if (demographics === 'summary') {
      response.audience = {
        totalVisitors: zone.audience.totalVisitors,
        dailyFootfall: zone.audience.dailyFootfall,
        segments: zone.audience.segments,
        lastUpdated: zone.audience.lastUpdated
      };
    }

    if (behavioral === 'summary') {
      const summaryAudience = response.audience as AudienceProfile;
      summaryAudience.behavioral = {
        avgDwellTime: summaryAudience.behavioral.avgDwellTime,
        peakHours: summaryAudience.behavioral.peakHours,
        repeatRate: summaryAudience.behavioral.repeatRate,
        avgVisitFrequency: summaryAudience.behavioral.avgVisitFrequency,
        conversionRate: summaryAudience.behavioral.conversionRate
      };
    }

    if (segments === 'true') {
      const audienceData = response.audience as AudienceProfile;
      response.segmentDetails = Object.entries(audienceData.segments).map(([name, percentage]) => ({
        name,
        percentage,
        estimatedCount: Math.round(audienceData.totalVisitors * percentage)
      }));
    }

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error in /zones/:zoneId/audience:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

type FootfallAnalyticsResponse =
  | FootfallAnalytics
  | { zoneId: string; period: 'hourly'; hourly: Record<number, number> }
  | { zoneId: string; period: 'daily'; daily: Record<string, number> }
  | { zoneId: string; period: 'weekly'; weekly: Record<string, number> }
  | { zoneId: string; period: 'monthly'; monthly: Record<string, number> }
  | { zoneId: string; period: 'trends'; trends: FootfallAnalytics['trends']; predictions: FootfallAnalytics['predictions'] };

/**
 * GET /zones/:zoneId/footfall
 * Get footfall analytics for a specific zone
 */
app.get('/zones/:zoneId/footfall', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const { period } = req.query;
    const zone = zones.get(zoneId);

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found',
        zoneId
      });
    }

    const analytics = generateFootfallAnalytics(zone);

    let filteredAnalytics: FootfallAnalyticsResponse = analytics;
    if (period) {
      switch (period) {
        case 'hourly':
          filteredAnalytics = { zoneId, period: 'hourly', hourly: analytics.hourly };
          break;
        case 'daily':
          filteredAnalytics = { zoneId, period: 'daily', daily: analytics.daily };
          break;
        case 'weekly':
          filteredAnalytics = { zoneId, period: 'weekly', weekly: analytics.weekly };
          break;
        case 'monthly':
          filteredAnalytics = { zoneId, period: 'monthly', monthly: analytics.monthly };
          break;
        case 'trends':
          filteredAnalytics = { zoneId, period: 'trends', trends: analytics.trends, predictions: analytics.predictions };
          break;
        default:
          filteredAnalytics = analytics;
      }
    }

    res.json({
      success: true,
      data: filteredAnalytics,
      zone: {
        zoneId: zone.zoneId,
        name: zone.name,
        currentFootfall: zone.audience.dailyFootfall
      }
    });
  } catch (error) {
    console.error('Error in /zones/:zoneId/footfall:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /zones/:zoneId/slots
 * Get available ad slots for a specific zone
 */
app.get('/zones/:zoneId/slots', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const { format, minPrice, maxPrice, available } = req.query;
    const zone = zones.get(zoneId);

    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found',
        zoneId
      });
    }

    let slots = [...zone.availableSlots];

    if (format) {
      slots = slots.filter(s => s.format === format);
    }

    if (minPrice) {
      slots = slots.filter(s => s.price >= Number(minPrice));
    }

    if (maxPrice) {
      slots = slots.filter(s => s.price <= Number(maxPrice));
    }

    if (available !== undefined) {
      const isAvailable = available === 'true';
      slots = slots.filter(s => s.available === isAvailable);
    }

    const slotDetails = slots.map(slot => ({
      ...slot,
      zoneName: zone.name,
      zoneType: zone.zoneType,
      pricePerDay: slot.price,
      estimatedImpressions: slot.impressions
    }));

    res.json({
      success: true,
      data: {
        zoneId,
        zoneName: zone.name,
        slots: slotDetails,
        totalSlots: slotDetails.length,
        availableSlots: slotDetails.filter(s => s.available).length,
        pricing: zone.pricing,
        filters: { format, minPrice, maxPrice, available }
      }
    });
  } catch (error) {
    console.error('Error in /zones/:zoneId/slots:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /zones/:zoneId/booking
 * Book an ad slot in a specific zone
 */
app.post('/zones/:zoneId/booking', (req: Request, res: Response) => {
  try {
    const { zoneId } = req.params;
    const validation = bookingRequestSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid booking request',
        details: validation.error.errors
      });
    }

    const zone = zones.get(zoneId);
    if (!zone) {
      return res.status(404).json({
        success: false,
        error: 'Zone not found',
        zoneId
      });
    }

    const { slotId, advertiserId, campaignId, startDate, endDate, targeting } = validation.data;

    const slot = zone.availableSlots.find(s => s.slotId === slotId);
    if (!slot) {
      return res.status(404).json({
        success: false,
        error: 'Slot not found',
        slotId
      });
    }

    if (!slot.available) {
      return res.status(409).json({
        success: false,
        error: 'Slot is not available for booking',
        slotId
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start > end) {
      return res.status(400).json({
        success: false,
        error: 'Start date must be before end date'
      });
    }

    const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    if (duration < slot.minBookingDuration) {
      return res.status(400).json({
        success: false,
        error: `Minimum booking duration is ${slot.minBookingDuration} days`,
        requestedDuration: duration
      });
    }

    if (duration > slot.maxBookingDuration) {
      return res.status(400).json({
        success: false,
        error: `Maximum booking duration is ${slot.maxBookingDuration} days`,
        requestedDuration: duration
      });
    }

    const totalAmount = calculateBookingPrice(zone, slot, startDate, endDate, targeting);
    const impressions = slot.impressions * duration;

    const booking: Booking = {
      bookingId: uuidv4(),
      zoneId,
      slotId,
      advertiserId,
      campaignId,
      startDate,
      endDate,
      status: 'pending',
      totalAmount,
      impressions,
      targeting: targeting || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    bookings.set(booking.bookingId, booking);

    slot.available = false;
    zone.updatedAt = new Date().toISOString();

    res.status(201).json({
      success: true,
      data: {
        booking,
        zone: {
          zoneId: zone.zoneId,
          name: zone.name
        },
        slot: {
          slotId: slot.slotId,
          location: slot.location,
          format: slot.format
        },
        pricing: {
          basePrice: slot.price,
          duration,
          totalAmount,
          impressions
        }
      }
    });
  } catch (error) {
    console.error('Error in /zones/:zoneId/booking:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /target/audience-size
 * Estimate audience size based on targeting criteria
 */
app.get('/target/audience-size', (req: Request, res: Response) => {
  try {
    const { zoneIds, demographics, behavioral, segments } = req.query;

    let requestData: AudienceSizeRequest;

    if (typeof zoneIds === 'string') {
      requestData = {
        zoneIds: zoneIds.split(','),
        demographics: demographics ? JSON.parse(demographics as string) : undefined,
        behavioral: behavioral ? JSON.parse(behavioral as string) : undefined,
        segments: segments ? (segments as string).split(',') : undefined
      };
    } else {
      requestData = {
        zoneIds: [],
        demographics: undefined,
        behavioral: undefined,
        segments: []
      };
    }

    const validation = audienceSizeRequestSchema.safeParse(requestData);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.errors
      });
    }

    const { zoneIds: validZoneIds, demographics: validDemographics, behavioral: validBehavioral, segments: validSegments } = validation.data;

    let totalAudience = 0;
    let zoneBreakdown: Array<{
      zoneId: string;
      zoneName: string;
      zoneType: string;
      rawAudience: number;
      filteredAudience: number;
      matchScore: number;
    }> = [];

    validZoneIds.forEach(zoneId => {
      const zone = zones.get(zoneId);
      if (!zone) return;

      let matchScore = 1.0;
      let filteredAudience = zone.audience.dailyFootfall;

      if (validDemographics?.ageGroups) {
        const ageMatch = validDemographics.ageGroups.reduce((sum, ag) => {
          return sum + (zone.audience.demographics.ageGroups[ag] || 0);
        }, 0) / validDemographics.ageGroups.length;
        matchScore *= ageMatch / 100;
      }

      if (validDemographics?.incomeLevels) {
        const incomeMatch = validDemographics.incomeLevels.reduce((sum, il) => {
          return sum + (zone.audience.demographics.incomeLevels[il] || 0);
        }, 0) / validDemographics.incomeLevels.length;
        matchScore *= incomeMatch / 100;
      }

      if (validBehavioral?.peakHoursOnly) {
        matchScore *= 0.6;
      }

      if (validBehavioral?.minDwellTime) {
        if (zone.audience.behavioral.avgDwellTime < validBehavioral.minDwellTime) {
          matchScore *= zone.audience.behavioral.avgDwellTime / validBehavioral.minDwellTime;
        }
      }

      if (validSegments && validSegments.length > 0) {
        const segmentMatch = validSegments.reduce((sum, seg) => {
          return sum + (zone.audience.segments[seg] || 0);
        }, 0) / validSegments.length;
        matchScore *= segmentMatch;
      }

      const finalAudience = Math.round(filteredAudience * matchScore);
      totalAudience += finalAudience;

      zoneBreakdown.push({
        zoneId: zone.zoneId,
        zoneName: zone.name,
        zoneType: zone.zoneType,
        rawAudience: zone.audience.dailyFootfall,
        filteredAudience: finalAudience,
        matchScore: Math.round(matchScore * 100) / 100
      });
    });

    res.json({
      success: true,
      data: {
        totalAudience,
        estimatedReach: {
          daily: totalAudience,
          weekly: Math.round(totalAudience * 7 * 0.85),
          monthly: Math.round(totalAudience * 30 * 0.75)
        },
        zoneBreakdown,
        targetingApplied: {
          zones: validZoneIds.length,
          demographics: validDemographics || null,
          behavioral: validBehavioral || null,
          segments: validSegments || []
        }
      }
    });
  } catch (error) {
    console.error('Error in /target/audience-size:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /bookings
 * List all bookings (with optional filters)
 */
app.get('/bookings', (req: Request, res: Response) => {
  try {
    const { status, advertiserId, zoneId, limit = 100, offset = 0 } = req.query;

    let filteredBookings = Array.from(bookings.values());

    if (status) {
      filteredBookings = filteredBookings.filter(b => b.status === status);
    }

    if (advertiserId) {
      filteredBookings = filteredBookings.filter(b => b.advertiserId === advertiserId);
    }

    if (zoneId) {
      filteredBookings = filteredBookings.filter(b => b.zoneId === zoneId);
    }

    const total = filteredBookings.length;
    const paginatedBookings = filteredBookings
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(Number(offset), Number(offset) + Number(limit));

    res.json({
      success: true,
      data: {
        bookings: paginatedBookings,
        pagination: {
          total,
          limit: Number(limit),
          offset: Number(offset),
          hasMore: Number(offset) + Number(limit) < total
        }
      }
    });
  } catch (error) {
    console.error('Error in /bookings:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /bookings/:bookingId
 * Get specific booking details
 */
app.get('/bookings/:bookingId', (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const booking = bookings.get(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        bookingId
      });
    }

    const zone = zones.get(booking.zoneId);
    const slot = zone?.availableSlots.find(s => s.slotId === booking.slotId);

    res.json({
      success: true,
      data: {
        booking,
        zone: zone ? { zoneId: zone.zoneId, name: zone.name, zoneType: zone.zoneType } : null,
        slot: slot ? { slotId: slot.slotId, location: slot.location, format: slot.format } : null
      }
    });
  } catch (error) {
    console.error('Error in /bookings/:bookingId:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PATCH /bookings/:bookingId
 * Update booking status
 */
app.patch('/bookings/:bookingId', (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    const booking = bookings.get(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
        bookingId
      });
    }

    const validStatuses: BookingStatus[] = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status',
        validStatuses
      });
    }

    const previousStatus = booking.status;
    booking.status = status;
    booking.updatedAt = new Date().toISOString();

    if (status === 'cancelled') {
      const zone = zones.get(booking.zoneId);
      const slot = zone?.availableSlots.find(s => s.slotId === booking.slotId);
      if (slot) {
        slot.available = true;
      }
    }

    res.json({
      success: true,
      data: {
        booking,
        previousStatus,
        newStatus: status
      }
    });
  } catch (error) {
    console.error('Error in /bookings/:bookingId:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /stats
 * Get platform statistics
 */
app.get('/stats', (_req: Request, res: Response) => {
  try {
    const zoneStats = Array.from(zones.values()).reduce((acc, zone) => {
      const type = zone.zoneType;
      if (!acc[type]) {
        acc[type] = { count: 0, totalFootfall: 0, totalSlots: 0, availableSlots: 0 };
      }
      acc[type].count++;
      acc[type].totalFootfall += zone.audience.dailyFootfall;
      acc[type].totalSlots += zone.availableSlots.length;
      acc[type].availableSlots += zone.availableSlots.filter(s => s.available).length;
      return acc;
    }, {} as Record<string, { count: number; totalFootfall: number; totalSlots: number; availableSlots: number }>);

    const bookingStats = Array.from(bookings.values()).reduce((acc, booking) => {
      if (!acc[booking.status]) {
        acc[booking.status] = { count: 0, totalValue: 0 };
      }
      acc[booking.status].count++;
      acc[booking.status].totalValue += booking.totalAmount;
      return acc;
    }, {} as Record<string, { count: number; totalValue: number }>);

    const totalZones = zones.size;
    const totalActiveZones = Array.from(zones.values()).filter(z => z.isActive).length;
    const totalAudience = Array.from(zones.values()).reduce((sum, z) => sum + z.audience.dailyFootfall, 0);
    const totalBookings = bookings.size;
    const totalRevenue = Array.from(bookings.values()).reduce((sum, b) => sum + b.totalAmount, 0);

    res.json({
      success: true,
      data: {
        overview: {
          totalZones,
          activeZones: totalActiveZones,
          totalAudience: {
            daily: totalAudience,
            monthly: Math.round(totalAudience * 30 * 0.8)
          },
          totalBookings,
          totalRevenue
        },
        byZoneType: zoneStats,
        byBookingStatus: bookingStats
      }
    });
  } catch (error) {
    console.error('Error in /stats:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'rez-hyperlocal-targeting',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * 404 Handler
 */
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'POST /target/geofence',
      'GET /zones',
      'GET /zones/:zoneId',
      'GET /zones/:zoneId/audience',
      'GET /zones/:zoneId/footfall',
      'GET /zones/:zoneId/slots',
      'POST /zones/:zoneId/booking',
      'GET /target/audience-size',
      'GET /bookings',
      'GET /bookings/:bookingId',
      'PATCH /bookings/:bookingId',
      'GET /stats',
      'GET /health'
    ]
  });
});

/**
 * Error Handler
 */
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  logger.info(`
╔════════════════════════════════════════════════════════════════╗
║     REZ Hyperlocal Targeting Service                           ║
║     Geofence-based ad targeting for physical locations         ║
╠════════════════════════════════════════════════════════════════╣
║  Port: ${PORT}                                                    ║
║  Environment: ${process.env.NODE_ENV || 'development'}                                ║
╠════════════════════════════════════════════════════════════════╣
║  Endpoints:                                                   ║
║  POST /target/geofence     - Get targeting for geofence        ║
║  GET  /zones               - List all zones                   ║
║  GET  /zones/:zoneId       - Zone details                     ║
║  GET  /zones/:zoneId/audience - Audience profile              ║
║  GET  /zones/:zoneId/footfall - Footfall analytics             ║
║  GET  /zones/:zoneId/slots  - Available ad slots               ║
║  POST /zones/:zoneId/booking - Book ad slot                    ║
║  GET  /target/audience-size - Estimate audience size           ║
║  GET  /bookings            - List all bookings                  ║
║  GET  /bookings/:id        - Booking details                   ║
║  PATCH /bookings/:id       - Update booking status             ║
║  GET  /stats               - Platform statistics               ║
║  GET  /health              - Health check                       ║
╚════════════════════════════════════════════════════════════════╝
  `);
});

export default app;
