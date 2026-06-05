// Automotive industry knowledge base for AI context
export const automotiveKnowledge = {
  industries: ['car dealership', 'used car sales', 'service center', 'spare parts', 'vehicle rental'],
  vehicleTypes: ['sedan', 'suv', 'hatchback', 'mpv', 'pickup', 'luxury', 'sports', 'electric'],
  fuelTypes: ['petrol', 'diesel', 'electric', 'hybrid', 'cng', 'lpg'],
  transmissionTypes: ['manual', 'automatic', 'cvt', 'dct', 'amt'],
  serviceTypes: ['regular', 'repair', 'inspection', 'body_work', 'paint', 'detailing'],
  ownershipTypes: ['1st', '2nd', '3rd', '4th+'],
  insuranceStatuses: ['valid', 'expired', 'pending', 'lapsed'],
  taxStatuses: ['paid', 'pending', 'expired'],
  pucStatuses: ['valid', 'expired', 'pending'],

  // Pricing factors
  priceIncreaseFactors: [
    'Low kilometer reading',
    'First owner',
    'Full service history',
    'Original accessories',
    'Recent model year',
    'Popular color',
    'Automatic transmission',
    'Petrol engine (in metro cities)',
    'Electric vehicle (growing demand)',
  ],

  priceDecreaseFactors: [
    'High kilometer reading',
    'Multiple previous owners',
    'Missing service records',
    'Accident history',
    'Repainted panels',
    'Old model year',
    'Common color',
    'Diesel vehicle (in some cities)',
    'Dented panels',
  ],

  // Service intervals (km)
  serviceIntervals: {
    regular: {
      petrol: { km: 10000, months: 12 },
      diesel: { km: 10000, months: 6 },
      electric: { km: 20000, months: 12 },
      hybrid: { km: 15000, months: 12 },
    },
    oilChange: {
      petrol: { km: 5000, months: 6 },
      diesel: { km: 5000, months: 6 },
      electric: null,
      hybrid: { km: 10000, months: 12 },
    },
    tireRotation: { km: 10000, months: 12 },
    brakeInspection: { km: 20000, months: 24 },
    coolantReplacement: { km: 40000, months: 36 },
  },

  // Common issues by age
  ageBasedIssues: {
    '0-3_years': ['Minor cosmetic issues', 'Software updates', 'Battery replacement'],
    '3-5_years': ['Brake pads', 'Suspension components', 'Battery', 'Clutch wear'],
    '5-7_years': ['Timing belt', 'Water pump', 'Alternator', 'Radiator', 'AC compressor'],
    '7-10_years': ['Engine overhaul', 'Transmission issues', 'Electrical problems', 'Rust'],
    '10+_years': ['Major repairs', 'Frame issues', 'Extensive rust', 'Replacement parts needed'],
  },

  // Market trends (sample)
  marketInsights: {
    appreciationModels: ['SUVs', 'Electric vehicles', 'Luxury sedans', 'Compact SUVs'],
    depreciationPatterns: [
      'First year: 15-20%',
      'First 3 years: 40-50%',
      'First 5 years: 60-70%',
      'After 5 years: gradual 5-10% per year',
    ],
  },
};

export const getServiceRecommendation = (
  kilometerReading: number,
  lastServiceKm: number,
  monthsSinceService: number,
  fuelType: string
): { type: string; urgency: 'low' | 'medium' | 'high' | 'critical'; reason: string } => {
  const kmSinceService = kilometerReading - lastServiceKm;
  const interval = automotiveKnowledge.serviceIntervals.regular[fuelType as keyof typeof automotiveKnowledge.serviceIntervals.regular] || { km: 10000, months: 12 };

  const kmRatio = kmSinceService / interval.km;
  const timeRatio = monthsSinceService / interval.months;
  const maxRatio = Math.max(kmRatio, timeRatio);

  if (maxRatio >= 1.5) {
    return { type: 'critical_service', urgency: 'critical', reason: 'Significantly overdue for service' };
  } else if (maxRatio >= 1.2) {
    return { type: 'regular_service', urgency: 'high', reason: 'Service due soon' };
  } else if (maxRatio >= 0.8) {
    return { type: 'regular_service', urgency: 'medium', reason: 'Service approaching' };
  } else {
    return { type: 'regular_service', urgency: 'low', reason: 'Service not yet due' };
  }
};

export const getPricingFactors = (
  vehicle: {
    year: number;
    kilometerReading: number;
    ownership: string;
    fuelType: string;
    transmission: string;
    condition?: string;
  },
  marketData?: { avgPrice: number; similarCount: number }
): { factors: Array<{ name: string; impact: 'positive' | 'negative' | 'neutral'; weight: number; description: string }>; basePrice: number } => {
  const currentYear = new Date().getFullYear();
  const age = currentYear - vehicle.year;
  const factors: Array<{ name: string; impact: 'positive' | 'negative' | 'neutral'; weight: number; description: string }> = [];

  // Age factor
  const depreciation = age <= 1 ? 0.15 : age <= 3 ? 0.30 : age <= 5 ? 0.50 : age <= 7 ? 0.65 : 0.75;
  factors.push({
    name: 'Age depreciation',
    impact: 'negative',
    weight: depreciation * 100,
    description: `${age} year(s) old - approximately ${(depreciation * 100).toFixed(0)}% depreciation`,
  });

  // Kilometer factor
  const expectedKm = age * 15000;
  const kmDiff = vehicle.kilometerReading - expectedKm;
  if (kmDiff < -20000) {
    factors.push({ name: 'Low kilometer', impact: 'positive', weight: 10, description: 'Below average usage - premium value' });
  } else if (kmDiff > 20000) {
    factors.push({ name: 'High kilometer', impact: 'negative', weight: 10, description: 'Above average usage - reduced value' });
  } else {
    factors.push({ name: 'Normal kilometer', impact: 'neutral', weight: 0, description: 'Average usage for age' });
  }

  // Ownership factor
  const ownershipPremiums: Record<string, number> = { '1st': 15, '2nd': 0, '3rd': -15, '4th+': -25 };
  const ownershipImpact = ownershipPremiums[vehicle.ownership] || 0;
  factors.push({
    name: 'Ownership history',
    impact: ownershipImpact > 0 ? 'positive' : ownershipImpact < 0 ? 'negative' : 'neutral',
    weight: Math.abs(ownershipImpact),
    description: `${vehicle.ownership} owner vehicle`,
  });

  // Fuel type
  if (vehicle.fuelType === 'electric') {
    factors.push({ name: 'Electric vehicle premium', impact: 'positive', weight: 20, description: 'Growing demand for EVs' });
  } else if (vehicle.fuelType === 'petrol') {
    factors.push({ name: 'Petrol preference', impact: 'positive', weight: 5, description: 'Preferred in metro areas' });
  }

  // Transmission
  if (vehicle.transmission === 'automatic') {
    factors.push({ name: 'Automatic premium', impact: 'positive', weight: 8, description: 'High demand for automatic' });
  }

  // Base price from market or calculation
  const basePrice = marketData?.avgPrice || (500000 * Math.pow(0.85, age));

  return { factors, basePrice };
};

export default automotiveKnowledge;