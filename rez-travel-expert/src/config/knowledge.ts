export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string;
  type: string[];
  description: string;
  highlights: string[];
  bestTimeToVisit: string;
  avgTemperature: string;
  currency: string;
  language: string;
  timezone: string;
  avgFlightDuration: string;
  budgetLevel: 'budget' | 'moderate' | 'luxury';
}

export interface AccommodationType {
  id: string;
  name: string;
  description: string;
  amenities: string[];
  priceRange: string;
}

export interface TransportMode {
  id: string;
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  avgCostRange: string;
  bookingTips: string[];
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'maldives',
    name: 'Maldives',
    country: 'Maldives',
    region: 'Indian Ocean',
    type: ['beach', 'luxury', 'honeymoon', 'diving'],
    description: 'A tropical paradise of 1,200 islands with crystal-clear waters, overwater villas, and world-class diving.',
    highlights: ['Overwater bungalows', 'Whale shark snorkeling', 'Sunset dolphin cruises', 'Private sandbank dining'],
    bestTimeToVisit: 'November to April',
    avgTemperature: '28-30°C (82-86°F)',
    currency: 'Maldivian Rufiyaa (MVR)',
    language: 'Dhivehi, English',
    timezone: 'UTC+5',
    avgFlightDuration: '10-14 hours from US/Europe',
    budgetLevel: 'luxury'
  },
  {
    id: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    region: 'Southeast Asia',
    type: ['beach', 'culture', 'adventure', 'spirituality'],
    description: 'The Island of the Gods blends ancient temples, lush rice terraces, vibrant arts, and stunning beaches.',
    highlights: ['Tegallalang Rice Terraces', 'Uluwatu Temple sunset', 'Mount Batur sunrise trek', 'Ubud monkey forest'],
    bestTimeToVisit: 'April to October',
    avgTemperature: '26-28°C (79-82°F)',
    currency: 'Indonesian Rupiah (IDR)',
    language: 'Balinese, Indonesian, English',
    timezone: 'UTC+8',
    avgFlightDuration: '16-20 hours from US',
    budgetLevel: 'moderate'
  },
  {
    id: 'swiss-alps',
    name: 'Swiss Alps',
    country: 'Switzerland',
    region: 'Europe',
    type: ['mountain', 'skiing', 'hiking', 'scenic'],
    description: 'Majestic peaks, pristine lakes, charming villages, and world-class skiing in the heart of Europe.',
    highlights: ['Jungfrau region', 'Matterhorn views', 'Glacier Express train', 'Lakeside towns'],
    bestTimeToVisit: 'December-March (ski), June-September (hike)',
    avgTemperature: '5-20°C (41-68°F)',
    currency: 'Swiss Franc (CHF)',
    language: 'German, French, Italian, English',
    timezone: 'UTC+1',
    avgFlightDuration: '8-12 hours from US',
    budgetLevel: 'luxury'
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    region: 'East Asia',
    type: ['city', 'culture', 'food', 'technology'],
    description: 'A fascinating blend of ultramodern and traditional, from neon-lit skyscrapers to historic temples.',
    highlights: ['Senso-ji Temple', 'Shibuya Crossing', 'Tsukiji outer market', 'Meiji Shrine'],
    bestTimeToVisit: 'March-May (cherry blossom), September-November',
    avgTemperature: '15-25°C (59-77°F)',
    currency: 'Japanese Yen (JPY)',
    language: 'Japanese, English',
    timezone: 'UTC+9',
    avgFlightDuration: '13-14 hours from US West Coast',
    budgetLevel: 'moderate'
  },
  {
    id: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    region: 'Mediterranean',
    type: ['beach', 'romantic', 'culture', 'sunset'],
    description: 'Iconic white-washed buildings with blue domes overlooking the caldera, known for breathtaking sunsets.',
    highlights: ['Oia sunset views', 'Red Beach', 'Ancient Akrotiri', 'Wine tasting at local vineyards'],
    bestTimeToVisit: 'April to June, September to October',
    avgTemperature: '20-30°C (68-86°F)',
    currency: 'Euro (EUR)',
    language: 'Greek, English',
    timezone: 'UTC+2',
    avgFlightDuration: '12-14 hours from US',
    budgetLevel: 'luxury'
  },
  {
    id: 'machu-picchu',
    name: 'Machu Picchu',
    country: 'Peru',
    region: 'South America',
    type: ['adventure', 'history', 'hiking', 'culture'],
    description: 'The legendary Lost City of the Incas, a mystical mountain citadel surrounded by peaks and clouds.',
    highlights: ['Sun Gate trek', 'Inca Bridge walk', 'Temple of the Sun', 'Huayna Picchu climb'],
    bestTimeToVisit: 'April to October (dry season)',
    avgTemperature: '15-22°C (59-72°F)',
    currency: 'Peruvian Sol (PEN)',
    language: 'Spanish, Quechua, English',
    timezone: 'UTC-5',
    avgFlightDuration: '8-10 hours from US',
    budgetLevel: 'moderate'
  },
  {
    id: 'dubai',
    name: 'Dubai',
    country: 'UAE',
    region: 'Middle East',
    type: ['city', 'luxury', 'shopping', 'desert'],
    description: 'A futuristic oasis in the desert, home to record-breaking architecture, luxury shopping, and desert adventures.',
    highlights: ['Burj Khalifa', 'Dubai Mall', 'Desert safari', 'Palm Jumeirah'],
    bestTimeToVisit: 'November to March',
    avgTemperature: '20-30°C (68-86°F)',
    currency: 'UAE Dirham (AED)',
    language: 'Arabic, English',
    timezone: 'UTC+4',
    avgFlightDuration: '14-16 hours from US',
    budgetLevel: 'luxury'
  },
  {
    id: 'patagonia',
    name: 'Patagonia',
    country: 'Argentina/Chile',
    region: 'South America',
    type: ['adventure', 'nature', 'hiking', 'scenic'],
    description: 'The end of the world - dramatic glaciers, towering peaks, and pristine wilderness at the southern tip of South America.',
    highlights: ['Torres del Paine', 'Perito Moreno Glacier', 'Fitz Roy trek', 'Whale watching'],
    bestTimeToVisit: 'October to March (summer)',
    avgTemperature: '10-20°C (50-68°F)',
    currency: 'Argentine Peso / Chilean Peso',
    language: 'Spanish, English',
    timezone: 'UTC-3 to UTC-5',
    avgFlightDuration: '12-16 hours from US',
    budgetLevel: 'moderate'
  }
];

export const ACCOMMODATION_TYPES: AccommodationType[] = [
  {
    id: 'hostel',
    name: 'Hostels',
    description: 'Budget-friendly dorms and private rooms, great for meeting fellow travelers',
    amenities: ['Shared rooms', 'Common areas', 'Kitchen access', 'Free WiFi', 'Lockers'],
    priceRange: '$10-50/night'
  },
  {
    id: 'boutique-hotel',
    name: 'Boutique Hotels',
    description: 'Unique, stylish properties with personalized service and local character',
    amenities: ['Unique decor', 'Restaurant/bar', 'Concierge', 'Spa services', 'Premium bedding'],
    priceRange: '$100-300/night'
  },
  {
    id: 'resort',
    name: 'Resorts',
    description: 'All-inclusive or half-board properties with extensive on-site amenities',
    amenities: ['Multiple restaurants', 'Pools', 'Beach access', 'Entertainment', 'Water sports'],
    priceRange: '$200-1000+/night'
  },
  {
    id: 'vacation-rental',
    name: 'Vacation Rentals',
    description: 'Apartments, houses, or condos for a home-away-from-home experience',
    amenities: ['Full kitchen', 'Living space', 'Laundry', 'Local neighborhood', 'Privacy'],
    priceRange: '$50-500+/night'
  },
  {
    id: 'luxury-villa',
    name: 'Luxury Villas',
    description: 'Private villas with premium amenities, often including concierge and staff',
    amenities: ['Private pool', 'Chef service', 'Butler', 'Gym/spa', 'Exclusive location'],
    priceRange: '$500-5000+/night'
  }
];

export const TRANSPORT_MODES: TransportMode[] = [
  {
    id: 'flight',
    name: 'Flights',
    description: 'The fastest way to cover long distances, with various cabin classes',
    pros: ['Fastest option', 'Extensive network', 'Comfort options', 'Price variety'],
    cons: ['Can be expensive', 'Airport hassles', 'Environmental impact', 'Limited flexibility'],
    avgCostRange: '$100-2000+ depending on distance and class',
    bookingTips: ['Book 6-8 weeks ahead', 'Use price alerts', 'Consider connecting flights', 'Check budget carriers']
  },
  {
    id: 'train',
    name: 'Train Travel',
    description: 'Scenic and comfortable rail journeys, especially popular in Europe and Asia',
    pros: ['Scenic views', 'No security lines', 'City center to city center', 'Eco-friendly'],
    cons: ['Limited routes', 'Can be slower', 'Booking complexity', 'May require reservations'],
    avgCostRange: '$30-500+ depending on route and rail pass',
    bookingTips: ['Consider rail passes', 'Book sleeper cabins early', 'Look for regional deals', 'Check seat reservations']
  },
  {
    id: 'rental-car',
    name: 'Rental Cars',
    description: 'Freedom to explore at your own pace, ideal for road trips and remote areas',
    pros: ['Complete flexibility', 'Door-to-door', 'Ideal for remote areas', 'Cost-effective for groups'],
    cons: ['Parking challenges', 'Fuel costs', 'Insurance required', 'Traffic stress'],
    avgCostRange: '$30-150/day plus insurance and fuel',
    bookingTips: ['Book early for best rates', 'Compare insurers', 'Check mileage limits', 'Verify pickup/return times']
  },
  {
    id: 'bus',
    name: 'Bus Travel',
    description: 'Economical option for shorter distances and budget travel',
    pros: ['Very affordable', 'Extensive routes', 'No booking needed', 'Scenic routes'],
    cons: ['Time-consuming', 'Variable comfort', 'Weather dependent', 'Limited space'],
    avgCostRange: '$5-100 depending on distance',
    bookingTips: ['Look for overnight buses', 'Check bus stations location', 'Bring entertainment', 'Consider bus passes']
  },
  {
    id: 'ferry',
    name: 'Ferries',
    description: 'Essential for islands and coastal travel, ranging from quick hops to luxury cruises',
    pros: ['Access islands', 'Scenic journeys', 'Carry vehicles', 'Unique experience'],
    cons: ['Weather dependent', 'Can be pricey', 'Limited schedules', 'May cause seasickness'],
    avgCostRange: '$20-500+ depending on route and vessel',
    bookingTips: ['Book car ferries early', 'Check weather forecasts', 'Consider cabin vs deck', 'Arrive early']
  }
];

export const SEASONAL_TIPS: Record<string, { label: string; tips: string[] }> = {
  peak: {
    label: 'Peak Season',
    tips: [
      'Book accommodations 3-6 months in advance',
      'Expect higher prices and crowds',
      'Best for stable weather destinations',
      'More flight and tour options available'
    ]
  },
  shoulder: {
    label: 'Shoulder Season',
    tips: [
      'Great value with lower prices',
      'Fewer crowds at major attractions',
      'Weather can be variable but manageable',
      'Perfect for photography enthusiasts'
    ]
  },
  off: {
    label: 'Off Season',
    tips: [
      'Significant cost savings',
      'Authentic local experiences',
      'Some attractions may have limited hours',
      'Check weather patterns carefully'
    ]
  }
};

export const TRAVEL_GUIDES: Record<string, { overview: string; highlights: string[]; tips: string[] }> = {
  packing: {
    overview: 'Packing smart can make or break your trip. Less is more - pack light and do laundry if needed.',
    highlights: ['Roll clothes to save space', 'Use packing cubes', 'Bring universal adapter', 'Keep essentials in carry-on'],
    tips: [
      'Check weather forecast before packing',
      'Research dress codes for cultural sites',
      'Leave room for souvenirs',
      'Bring a reusable water bottle'
    ]
  },
  safety: {
    overview: 'Stay safe while traveling by staying aware and prepared.',
    highlights: ['Keep copies of important documents', 'Be aware of common scams', 'Stay connected with family', 'Know local emergency numbers'],
    tips: [
      'Register with your embassy for international travel',
      'Use hotel safes for valuables',
      'Keep digital copies in cloud storage',
      'Trust your instincts'
    ]
  },
  budget: {
    overview: 'Travel costs vary wildly - set a realistic budget and track spending.',
    highlights: ['Book flights early', 'Eat where locals eat', 'Use public transport', 'Look for free attractions'],
    tips: [
      'Build in 20% buffer for unexpected costs',
      'Consider travel insurance as investment',
      'Use credit cards with no foreign fees',
      'Track exchange rates before departure'
    ]
  }
};
