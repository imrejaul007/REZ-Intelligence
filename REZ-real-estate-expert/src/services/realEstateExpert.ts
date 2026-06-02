/**
 * Real Estate Expert Service
 * AI-powered property search, investment analysis, and market insights
 */

import { Property, PropertySearchParams, InvestmentAnalysis, MarketTrend } from '../types';

// Mock property database
const mockProperties: Property[] = [
  {
    id: 'prop-001',
    title: '3BHK Modern Apartment in Whitefield',
    type: 'apartment',
    status: 'rent',
    price: 45000,
    pricePerSqft: 28,
    location: { city: 'Bangalore', locality: 'Whitefield', latitude: 12.9698, longitude: 77.7499 },
    specs: { bedrooms: 3, bathrooms: 2, area: 1600, areaUnit: 'sqft', furnished: 'furnished', floor: 5, totalFloors: 12, parking: 1 },
    amenities: ['Gym', 'Pool', 'Club House', '24/7 Security', 'Power Backup', 'Lift'],
    images: ['https://images.unsplash.com/photo-1502672260266-1c1ef2d93688'],
    owner: { name: 'Rahul Sharma', phone: '+919876543210', verified: true },
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-15T14:30:00Z'
  },
  {
    id: 'prop-002',
    title: 'Premium Villa with Garden',
    type: 'villa',
    status: 'sale',
    price: 25000000,
    pricePerSqft: 12500,
    location: { city: 'Bangalore', locality: 'Sarjapur Road', latitude: 12.9141, longitude: 77.7714 },
    specs: { bedrooms: 4, bathrooms: 4, area: 4000, areaUnit: 'sqft', furnished: 'furnished', parking: 3 },
    amenities: ['Private Garden', 'Swimming Pool', 'Servant Quarters', 'Home Theater', 'Smart Home'],
    images: ['https://images.unsplash.com/photo-1613490493576-7fde63acd811'],
    owner: { name: 'Priya Patel', phone: '+919876543211', verified: true },
    createdAt: '2026-04-20T09:00:00Z',
    updatedAt: '2026-05-10T11:00:00Z'
  },
  {
    id: 'prop-003',
    title: 'Commercial Office Space in MG Road',
    type: 'commercial',
    status: 'rent',
    price: 150000,
    pricePerSqft: 75,
    location: { city: 'Bangalore', locality: 'MG Road', latitude: 12.9751, longitude: 77.6060 },
    specs: { area: 2000, areaUnit: 'sqft', furnished: 'furnished', floor: 8, totalFloors: 15 },
    amenities: ['Central AC', 'Conference Rooms', 'Pantry', '24/7 Access', 'Parking'],
    images: ['https://images.unsplash.com/photo-1497366216548-37526070297c'],
    owner: { name: 'TechCorp Spaces', phone: '+919876543212', verified: true },
    createdAt: '2026-05-10T08:00:00Z',
    updatedAt: '2026-05-18T16:00:00Z'
  },
  {
    id: 'prop-004',
    title: '1BHK Budget Apartment',
    type: 'apartment',
    status: 'rent',
    price: 15000,
    pricePerSqft: 15,
    location: { city: 'Pune', locality: 'Hinjewadi', latitude: 18.5913, longitude: 73.7389 },
    specs: { bedrooms: 1, bathrooms: 1, area: 550, areaUnit: 'sqft', furnished: 'semi-furnished', floor: 3, totalFloors: 7, parking: 0 },
    amenities: ['Security', 'Elevator', 'Near IT Park'],
    images: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267'],
    owner: { name: 'Suresh Kumar', phone: '+919876543213', verified: false },
    createdAt: '2026-05-05T12:00:00Z',
    updatedAt: '2026-05-12T09:30:00Z'
  },
  {
    id: 'prop-005',
    title: '5 Bigha Plot in Gurgaon',
    type: 'plot',
    status: 'sale',
    price: 8500000,
    pricePerSqft: 6800,
    location: { city: 'Gurgaon', locality: 'Sector 56', latitude: 28.5665, longitude: 77.3531 },
    specs: { area: 5, areaUnit: 'bigha' },
    amenities: ['Corner Plot', 'Main Road Facing', 'Near Metro'],
    images: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef'],
    owner: { name: 'Amit Singh', phone: '+919876543214', verified: true },
    createdAt: '2026-04-15T14:00:00Z',
    updatedAt: '2026-05-08T10:00:00Z'
  }
];

// Mock market trends
const mockMarketTrends: MarketTrend[] = [
  { city: 'Bangalore', locality: 'Whitefield', avgPricePerSqft: 7500, priceChange: 8.5, avgRentalYield: 4.2, totalListings: 1250, trend: 'rising', lastUpdated: '2026-06-01' },
  { city: 'Bangalore', locality: 'Sarjapur Road', avgPricePerSqft: 6800, priceChange: 6.2, avgRentalYield: 4.0, totalListings: 980, trend: 'rising', lastUpdated: '2026-06-01' },
  { city: 'Bangalore', locality: 'MG Road', avgPricePerSqft: 15000, priceChange: 3.1, avgRentalYield: 5.5, totalListings: 340, trend: 'stable', lastUpdated: '2026-06-01' },
  { city: 'Pune', locality: 'Hinjewadi', avgPricePerSqft: 5200, priceChange: 5.8, avgRentalYield: 3.8, totalListings: 890, trend: 'rising', lastUpdated: '2026-06-01' },
  { city: 'Gurgaon', locality: 'Sector 56', avgPricePerSqft: 8500, priceChange: 4.2, avgRentalYield: 4.5, totalListings: 560, trend: 'stable', lastUpdated: '2026-06-01' }
];

export class RealEstateExpertService {
  /**
   * Search properties based on filters
   */
  async searchProperties(params: PropertySearchParams): Promise<{ properties: Property[]; total: number }> {
    let results = [...mockProperties];

    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.location.locality.toLowerCase().includes(q) ||
        p.location.city.toLowerCase().includes(q)
      );
    }

    if (params.type) results = results.filter(p => p.type === params.type);
    if (params.status) results = results.filter(p => p.status === params.status);
    if (params.city) results = results.filter(p => p.location.city.toLowerCase() === params.city?.toLowerCase());
    if (params.locality) results = results.filter(p => p.location.locality.toLowerCase().includes(params.locality!.toLowerCase()));
    if (params.minPrice) results = results.filter(p => p.price >= params.minPrice!);
    if (params.maxPrice) results = results.filter(p => p.price <= params.maxPrice!);
    if (params.minBedrooms) results = results.filter(p => (p.specs.bedrooms || 0) >= params.minBedrooms!);
    if (params.maxBedrooms) results = results.filter(p => (p.specs.bedrooms || 0) <= params.maxBedrooms!);
    if (params.furnished) results = results.filter(p => p.specs.furnished === params.furnished);

    const total = results.length;
    const page = params.page || 1;
    const limit = params.limit || 10;
    const offset = (page - 1) * limit;

    return { properties: results.slice(offset, offset + limit), total };
  }

  /**
   * Get property by ID
   */
  async getPropertyById(id: string): Promise<Property | null> {
    return mockProperties.find(p => p.id === id) || null;
  }

  /**
   * Analyze investment potential
   */
  async analyzeInvestment(propertyId: string): Promise<InvestmentAnalysis | null> {
    const property = await this.getPropertyById(propertyId);
    if (!property) return null;

    const purchasePrice = property.status === 'sale' ? property.price : property.price * 120; // Rent vs buy calculation
    const monthlyRental = property.status === 'sale' ? property.price * 0.004 : property.price;
    const rentalYield = (monthlyRental * 12 / purchasePrice) * 100;
    const capitalAppreciation = 6 + Math.random() * 4; // 6-10% annual appreciation

    return {
      propertyId,
      property,
      purchasePrice,
      rentalYield: Math.round(rentalYield * 100) / 100,
      capitalAppreciation: Math.round(capitalAppreciation * 100) / 100,
      totalInvestment: purchasePrice * 1.1, // Including registration etc
      monthlyRental,
      annualReturn: Math.round((rentalYield + capitalAppreciation) * 100) / 100,
      breakEvenYears: Math.round(purchasePrice / (monthlyRental * 12) * 10) / 10,
      riskScore: rentalYield > 5 ? 'low' : rentalYield > 3 ? 'medium' : 'high',
      recommendation: rentalYield > 5 ? 'buy' : rentalYield > 3 ? 'hold' : 'avoid',
      comparableRentals: mockProperties.filter(p => p.type === property.type && p.status === 'rent').slice(0, 3),
      marketTrend: 'rising'
    };
  }

  /**
   * Get market trends
   */
  async getMarketTrends(city?: string, locality?: string): Promise<MarketTrend[]> {
    let trends = [...mockMarketTrends];
    if (city) trends = trends.filter(t => t.city.toLowerCase() === city.toLowerCase());
    if (locality) trends = trends.filter(t => t.locality.toLowerCase().includes(locality.toLowerCase()));
    return trends;
  }

  /**
   * Generate AI chat response
   */
  async chat(message: string, context?: { preferences?: Partial<PropertySearchParams>; history?: string[] }): Promise<string> {
    const lowerMsg = message.toLowerCase();

    // Simple pattern matching for responses
    if (lowerMsg.includes('rent') && lowerMsg.includes('bangalore')) {
      const results = await this.searchProperties({ city: 'Bangalore', status: 'rent' });
      return `I found ${results.total} rental properties in Bangalore. The average rent ranges from ₹15,000 for 1BHK to ₹45,000 for 3BHK apartments. Would you like me to show you some specific options?`;
    }

    if (lowerMsg.includes('buy') || lowerMsg.includes('purchase')) {
      return `For purchasing property, I'd recommend looking at areas with high rental yield (4%+). Currently, Whitefield and Sarjapur Road in Bangalore show strong appreciation potential (8-10% annually). Would you like an investment analysis for any specific property?`;
    }

    if (lowerMsg.includes('invest')) {
      const trends = await this.getMarketTrends();
      const avgYield = trends.reduce((sum, t) => sum + t.avgRentalYield, 0) / trends.length;
      return `Based on current market data, the average rental yield across major cities is ${avgYield.toFixed(1)}%. Properties with yields above 5% are considered good investments. I can analyze specific properties for you.`;
    }

    if (lowerMsg.includes('price') || lowerMsg.includes('cost')) {
      return `Property prices vary significantly by location. In Bangalore: Whitefield (~₹7,500/sqft), Sarjapur Road (~₹6,800/sqft), MG Road (~₹15,000/sqft). Prices have been rising 4-8% annually.`;
    }

    if (lowerMsg.includes('loan') || lowerMsg.includes('home loan') || lowerMsg.includes('mortgage')) {
      return `For home loans, current rates range from 8.5% to 9.5% depending on your credit profile. Recommended approach: 1) Check CIBIL score (750+ for best rates), 2) Compare lenders, 3) Consider balance transfer options. Need help with affordability calculation?`;
    }

    return `I'm your real estate AI assistant. I can help with property search, investment analysis, market trends, and more. Try asking about:\n- "Show me rentals in Bangalore"\n- "Analyze investment in Whitefield"\n- "Current market trends"\n- "Home loan guidance"`;
  }

  /**
   * Get recommendations based on preferences
   */
  async getRecommendations(preferences: PropertySearchParams, limit: number = 5): Promise<Property[]> {
    const { properties } = await this.searchProperties({ ...preferences, limit });
    return properties.slice(0, limit);
  }
}

export const realEstateExpertService = new RealEstateExpertService();
