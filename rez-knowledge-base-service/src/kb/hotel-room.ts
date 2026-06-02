/**
 * Hotel/Room Service Knowledge Base
 * Handles all hotel room service related intents, entities, and responses
 */

export interface HousekeepingItem {
  id: string;
  name: string;
  keywords: string[];
  description?: string;
  responseTime?: string;
}

export interface RoomServiceItem {
  id: string;
  name: string;
  category: 'beverages' | 'snacks' | 'meals' | 'breakfast' | 'desserts';
  price?: number;
  keywords: string[];
  dietary?: string[];
  allergens?: string[];
  preparationTime?: string;
}

export interface SpaService {
  id: string;
  name: string;
  duration: string;
  price?: number;
  keywords: string[];
  description?: string;
  requiresBooking?: boolean;
}

export interface ConciergeRequest {
  id: string;
  name: string;
  keywords: string[];
  description?: string;
  requiresEscalation?: boolean;
}

export interface HotelRoomKB {
  categories: {
    housekeeping: {
      items: HousekeepingItem[];
      responses: {
        howToRequest: string;
        commonIssues: string[];
        deliveryTime: string;
        policy: string;
      };
    };
    roomService: {
      items: RoomServiceItem[];
      categories: string[];
      responses: {
        orderingHours: string;
        deliveryTime: string;
        paymentMethods: string[];
        minimumOrder: string;
        dietaryAccommodations: string;
      };
    };
    spa: {
      services: SpaService[];
      responses: {
        bookingRequired: string;
        cancellationPolicy: string;
        whatToExpect: string;
      };
    };
    concierge: {
      requests: ConciergeRequest[];
      responses: {
        generalAssistance: string;
        escalationPolicy: string;
      };
    };
    maintenance: {
      issues: {
        id: string;
        name: string;
        keywords: string[];
        priority: 'low' | 'medium' | 'high' | 'urgent';
        estimatedFixTime?: string;
      }[];
      responses: {
        reportIssue: string;
        commonIssues: string[];
        emergencyContacts: string;
      };
    };
    amenities: {
      items: {
        id: string;
        name: string;
        location: string;
        hours?: string;
        keywords: string[];
      }[];
      responses: {
        wifiInstructions: string;
        gymAccess: string;
        poolAccess: string;
        parkingInfo: string;
      };
    };
    billing: {
      queries: {
        type: string;
        keywords: string[];
        response: string;
      }[];
      responses: {
        checkoutProcess: string;
        paymentOptions: string;
        invoiceRequest: string;
      };
    };
  };

  intents: {
    greetings: string[];
    farewells: string[];
    gratitude: string[];
    complaints: string[];
    requests: string[];
    confirmations: string[];
    cancellations: string[];
  };

  responses: {
    greeting: string;
    farewell: string;
    thankYou: string;
    sorry: string;
    processing: string;
    notUnderstood: string;
    escalationPrompt: string;
  };

  contextSlots: {
    roomNumber: boolean;
    itemRequested: boolean;
    quantity: boolean;
    preferredTime: boolean;
    specialInstructions: boolean;
    guestName: boolean;
  };
}

// ====== HOUSEKEEPING ITEMS ======
const housekeepingItems: HousekeepingItem[] = [
  {
    id: 'towels',
    name: 'Extra Towels',
    keywords: ['towel', 'towels', 'bath towel', 'hand towel', 'face towel', 'bath mat'],
    description: 'Fresh bath or hand towels',
    responseTime: '15-20 minutes'
  },
  {
    id: 'sheets',
    name: 'Fresh Sheets',
    keywords: ['bed', 'linen', 'sheet', 'sheets', 'bedding', 'bed sheet', 'pillowcase'],
    description: 'Clean bed linens and pillowcases',
    responseTime: '20-30 minutes'
  },
  {
    id: 'pillows',
    name: 'Extra Pillows',
    keywords: ['pillow', 'pillows', 'soft pillow', 'firm pillow', 'extra pillow', 'feather pillow', 'foam pillow'],
    description: 'Additional pillows of various firmness levels',
    responseTime: '10-15 minutes'
  },
  {
    id: 'blankets',
    name: 'Extra Blankets',
    keywords: ['blanket', 'blankets', 'quilt', 'comforter', 'duvet', 'throw blanket', 'extra blanket'],
    description: 'Additional blankets or quilts',
    responseTime: '15-20 minutes'
  },
  {
    id: 'toiletries',
    name: 'Toiletries',
    keywords: ['toiletries', 'shampoo', 'conditioner', 'soap', 'body wash', 'lotion', 'toothbrush', 'razor', 'shaving cream', 'comb', 'brush'],
    description: 'Bathroom essentials and personal care items',
    responseTime: '10-15 minutes'
  },
  {
    id: 'slippers',
    name: 'Slippers',
    keywords: ['slippers', 'slipper', 'flip flops', 'bathroom slippers'],
    description: 'Disposable or hotel slippers',
    responseTime: '5-10 minutes'
  },
  {
    id: 'robe',
    name: 'Bathrobe',
    keywords: ['robe', 'bathrobe', 'dressing gown', 'hotel robe'],
    description: 'Bathrobe for in-room use',
    responseTime: '10-15 minutes'
  },
  {
    id: 'iron',
    name: 'Iron & Ironing Board',
    keywords: ['iron', 'ironing', 'iron board', 'steam', 'steamer', 'press'],
    description: 'Iron and ironing board for garment care',
    responseTime: '15-20 minutes'
  },
  {
    id: 'hangers',
    name: 'Extra Hangers',
    keywords: ['hanger', 'hangers', 'clothes hanger', 'coat hanger', 'extra hangers'],
    description: 'Additional clothes hangers',
    responseTime: '5-10 minutes'
  },
  {
    id: 'safebox',
    name: 'Safe Box Assistance',
    keywords: ['safe', 'safety box', 'locker', 'secure storage', 'safebox'],
    description: 'Help with in-room safe or secure storage',
    responseTime: '10-15 minutes'
  },
  {
    id: 'electrical',
    name: 'Electrical Adapters',
    keywords: ['adapter', 'charger', 'charging', 'power adapter', 'usb', 'plug', 'socket'],
    description: 'Power adapters and charging cables',
    responseTime: '10-15 minutes'
  },
  {
    id: 'sewing',
    name: 'Sewing Kit',
    keywords: ['sewing', 'needle', 'thread', 'button', 'mend'],
    description: 'Basic sewing kit for minor repairs',
    responseTime: '5-10 minutes'
  },
  {
    id: 'tissues',
    name: 'Tissues',
    keywords: ['tissue', 'tissues', 'napkin', 'paper'],
    description: 'Facial tissues or paper napkins',
    responseTime: '5-10 minutes'
  },
  {
    id: 'trash',
    name: 'Trash Collection',
    keywords: ['trash', 'bin', 'garbage', 'waste', 'rubbish'],
    description: 'Room trash collection service',
    responseTime: '15-30 minutes'
  },
  {
    id: 'turndown',
    name: 'Turndown Service',
    keywords: ['turndown', 'evening service', 'bed preparation', 'night service'],
    description: 'Evening room preparation with bed turned down',
    responseTime: 'Scheduled service'
  },
  {
    id: 'deep_clean',
    name: 'Deep Cleaning',
    keywords: ['clean', 'deep clean', 'thorough cleaning', 'sanitize', 'sanitization'],
    description: 'Thorough room cleaning and sanitization',
    responseTime: '1-2 hours'
  }
];

// ====== ROOM SERVICE ITEMS ======
const roomServiceItems: RoomServiceItem[] = [
  // Beverages
  { id: 'coffee', name: 'Coffee', category: 'beverages', price: 150, keywords: ['coffee', 'espresso', 'cappuccino', 'latte', 'americano', 'milk'], preparationTime: '5-10 min' },
  { id: 'tea', name: 'Tea', category: 'beverages', price: 100, keywords: ['tea', 'chai', 'green tea', 'black tea', 'herbal tea', 'masala chai'], preparationTime: '5-8 min' },
  { id: 'juice', name: 'Fresh Juice', category: 'beverages', price: 200, keywords: ['juice', 'orange juice', 'mango juice', 'fresh juice', 'cold press'], dietary: ['vegan'], preparationTime: '10 min' },
  { id: 'water', name: 'Mineral Water', category: 'beverages', price: 50, keywords: ['water', 'bottled water', 'mineral water', 'sparkling water'], preparationTime: '2-5 min' },
  { id: 'smoothie', name: 'Smoothie', category: 'beverages', price: 250, keywords: ['smoothie', 'milkshake', 'protein shake'], dietary: ['vegetarian'], allergens: ['milk'], preparationTime: '10 min' },
  { id: 'soda', name: 'Soft Drinks', category: 'beverages', price: 80, keywords: ['soda', 'coke', 'pepsi', 'cola', 'sprite', 'fanta', 'soft drink'], preparationTime: '2-5 min' },

  // Snacks
  { id: 'sandwich', name: 'Sandwich', category: 'snacks', price: 250, keywords: ['sandwich', 'grilled sandwich', 'club sandwich', 'toast'], allergens: ['wheat', 'milk'], preparationTime: '15 min' },
  { id: 'chips', name: 'Chips & Dips', category: 'snacks', price: 180, keywords: ['chips', 'crisps', 'nachos', 'dip', 'salsa'], allergens: ['dairy'], preparationTime: '5 min' },
  { id: 'fruits', name: 'Fresh Fruits', category: 'snacks', price: 200, keywords: ['fruit', 'fruits', 'fresh fruit', 'fruit bowl', 'seasonal fruits'], dietary: ['vegan', 'gluten-free'], preparationTime: '10 min' },
  { id: 'nuts', name: 'Mixed Nuts', category: 'snacks', price: 220, keywords: ['nuts', 'almonds', 'cashews', 'mixed nuts', 'trail mix'], allergens: ['tree_nuts'], preparationTime: '3 min' },
  { id: 'cookies', name: 'Cookies', category: 'snacks', price: 180, keywords: ['cookies', 'biscuits', 'chocolate chip', 'cookies'], allergens: ['wheat', 'milk', 'eggs'], preparationTime: '5 min' },
  { id: 'cheese_board', name: 'Cheese Board', category: 'snacks', price: 350, keywords: ['cheese', 'cheese board', 'cheese platter', 'crackers and cheese'], allergens: ['milk', 'wheat'], preparationTime: '10 min' },

  // Meals
  { id: 'pasta', name: 'Pasta', category: 'meals', price: 450, keywords: ['pasta', 'spaghetti', 'penne', 'alfredo', 'marinara', 'carbonara'], allergens: ['wheat', 'milk', 'eggs'], preparationTime: '20-25 min' },
  { id: 'burger', name: 'Burger', category: 'meals', price: 400, keywords: ['burger', 'hamburger', 'cheeseburger', 'veggie burger'], allergens: ['wheat'], preparationTime: '20 min' },
  { id: 'salad', name: 'Salad', category: 'meals', price: 350, keywords: ['salad', 'caesar salad', 'garden salad', 'green salad', 'mixed salad'], dietary: ['vegan', 'vegetarian', 'gluten-free'], allergens: [], preparationTime: '15 min' },
  { id: 'soup', name: 'Soup', category: 'meals', price: 280, keywords: ['soup', 'tomato soup', 'chicken soup', 'vegetable soup', 'soup of the day'], dietary: ['vegetarian'], allergens: ['milk', 'wheat'], preparationTime: '10-15 min' },
  { id: 'pizza', name: 'Pizza', category: 'meals', price: 500, keywords: ['pizza', 'margherita', 'pepperoni', 'vegetarian pizza'], allergens: ['wheat', 'milk'], preparationTime: '25-30 min' },
  { id: 'biryani', name: 'Biryani', category: 'meals', price: 550, keywords: ['biryani', 'chicken biryani', 'mutton biryani', 'veg biryani', 'hyderabadi biryani'], allergens: [], preparationTime: '25-30 min' },
  { id: 'curry', name: 'Curry', category: 'meals', price: 400, keywords: ['curry', 'butter chicken', 'paneer curry', 'dal curry', 'chicken curry'], allergens: ['milk'], preparationTime: '20-25 min' },
  { id: 'grilled_chicken', name: 'Grilled Chicken', category: 'meals', price: 550, keywords: ['chicken', 'grilled chicken', 'tandoori chicken', 'barbecue chicken'], allergens: [], preparationTime: '25 min' },
  { id: 'fish', name: 'Grilled Fish', category: 'meals', price: 650, keywords: ['fish', 'grilled fish', 'pomfret', 'salmon', 'fish steak'], allergens: ['fish'], dietary: ['gluten-free'], preparationTime: '25-30 min' },

  // Breakfast
  { id: 'continental', name: 'Continental Breakfast', category: 'breakfast', price: 450, keywords: ['continental breakfast', 'bread toast eggs', 'cereal breakfast'], allergens: ['wheat', 'milk', 'eggs'], preparationTime: '15-20 min' },
  { id: 'indian_breakfast', name: 'Indian Breakfast', category: 'breakfast', price: 400, keywords: ['idli', 'dosa', 'uttapam', 'upma', 'poha', 'paratha', 'indian breakfast'], allergens: ['wheat'], preparationTime: '20 min' },
  { id: 'eggs', name: 'Eggs to Order', category: 'breakfast', price: 300, keywords: ['eggs', 'omelette', 'scrambled eggs', 'boiled eggs', 'poached eggs', 'fried eggs', 'eggs benedict'], allergens: ['eggs'], preparationTime: '10-15 min' },
  { id: 'pancakes', name: 'Pancakes/Waffles', category: 'breakfast', price: 350, keywords: ['pancakes', 'waffles', 'crepes', 'flapjacks'], allergens: ['wheat', 'milk', 'eggs'], preparationTime: '15 min' },
  { id: 'oatmeal', name: 'Oatmeal/Porridge', category: 'breakfast', price: 250, keywords: ['oatmeal', 'porridge', 'oats', 'cornflakes', 'muesli'], allergens: ['wheat'], dietary: ['vegetarian'], preparationTime: '10 min' },

  // Desserts
  { id: 'ice_cream', name: 'Ice Cream', category: 'desserts', price: 200, keywords: ['ice cream', 'gelato', 'sundae', 'icecream'], allergens: ['milk'], dietary: ['vegetarian'], preparationTime: '5 min' },
  { id: 'cake', name: 'Cake/Slice', category: 'desserts', price: 250, keywords: ['cake', 'chocolate cake', 'cheesecake', 'brownie', 'slice of cake'], allergens: ['wheat', 'milk', 'eggs'], preparationTime: '5 min' },
  { id: 'pastry', name: 'Pastries', category: 'desserts', price: 180, keywords: ['pastry', 'croissant', 'muffin', 'danish', 'baked goods'], allergens: ['wheat', 'milk', 'eggs'], preparationTime: '5 min' },
  { id: 'fruit_plate', name: 'Fresh Fruit Plate', category: 'desserts', price: 200, keywords: ['fruit', 'fresh fruit', 'seasonal fruit', 'fruit salad'], dietary: ['vegan', 'gluten-free'], preparationTime: '10 min' }
];

// ====== SPA SERVICES ======
const spaServices: SpaService[] = [
  { id: 'massage_60', name: '60-Minute Massage', duration: '60 min', price: 2500, keywords: ['massage', 'relaxation massage', 'swedish massage', 'full body massage'] },
  { id: 'massage_90', name: '90-Minute Massage', duration: '90 min', price: 3500, keywords: ['deep tissue massage', 'hot stone massage', 'aromatherapy massage', 'deep massage'] },
  { id: 'facial', name: 'Facial Treatment', duration: '60 min', price: 2000, keywords: ['facial', 'face treatment', 'skin care', 'glow facial', 'clean up'] },
  { id: 'manicure', name: 'Manicure', duration: '45 min', price: 800, keywords: ['manicure', 'nail polish', 'nail art', 'hand treatment'] },
  { id: 'pedicure', name: 'Pedicure', duration: '60 min', price: 1000, keywords: ['pedicure', 'foot treatment', 'nail polish', 'foot care'] },
  { id: 'body_wrap', name: 'Body Wrap', duration: '75 min', price: 3000, keywords: ['body wrap', 'detox wrap', 'body scrub', 'body treatment'] },
  { id: 'couple_massage', name: 'Couples Massage', duration: '60 min', price: 4500, keywords: ['couple massage', 'couples massage', 'romantic massage', 'dual massage'] },
  { id: 'aromatherapy', name: 'Aromatherapy Session', duration: '45 min', price: 1800, keywords: ['aromatherapy', 'essential oils', 'oil massage', 'relaxation'] }
];

// ====== CONCIERGE REQUESTS ======
const conciergeRequests: ConciergeRequest[] = [
  { id: 'restaurant_reservation', name: 'Restaurant Reservation', keywords: ['restaurant', 'reservation', 'dinner', 'lunch', 'book table', 'reserve'] },
  { id: 'taxi_booking', name: 'Taxi/Ride Booking', keywords: ['taxi', 'cab', 'ride', 'transport', 'airport', 'pickup', 'drop'] },
  { id: 'tour_booking', name: 'Tour/Excursion Booking', keywords: ['tour', 'excursion', 'sightseeing', 'trip', 'day trip', 'activity'] },
  { id: 'theater_tickets', name: 'Event/Theater Tickets', keywords: ['ticket', 'tickets', 'show', 'theater', 'concert', 'movie', 'event'] },
  { id: 'florist', name: 'Flower Delivery', keywords: ['flower', 'flowers', 'bouquet', 'rose', 'gift'] },
  { id: 'gift_shopping', name: 'Gift Shopping Assistance', keywords: ['gift', 'present', 'shopping', 'souvenir', 'shopping assistance'] },
  { id: 'currency_exchange', name: 'Currency Exchange', keywords: ['currency', 'exchange', 'money', 'forex', 'convert'] },
  { id: 'pharmacy', name: 'Pharmacy Assistance', keywords: ['pharmacy', 'medicine', 'prescription', 'drugstore', 'medical'] },
  { id: 'hospital', name: 'Hospital/Clinic Referral', keywords: ['hospital', 'clinic', 'doctor', 'medical', 'emergency', 'health'] },
  { id: 'business_services', name: 'Business Center Services', keywords: ['printer', 'print', 'fax', 'copier', 'business center', 'office'] },
  { id: 'language_interpreter', name: 'Language/Interpreter Services', keywords: ['translator', 'interpreter', 'language', 'translation'] },
  { id: 'lost_items', name: 'Lost Items Assistance', keywords: ['lost', 'missing', 'found', 'lost and found'] }
];

// ====== MAINTENANCE ISSUES ======
const maintenanceIssues = [
  { id: 'ac_not_working', name: 'AC not working', keywords: ['ac', 'air conditioning', 'aircon', 'cooling', 'temperature', 'hot room', 'not cool'], priority: 'high' as const, estimatedFixTime: '30-60 min' },
  { id: 'ac_leaking', name: 'AC leaking water', keywords: ['leak', 'leaking', 'water', 'dripping', 'ac leak', 'drip'], priority: 'medium' as const, estimatedFixTime: '45-90 min' },
  { id: 'power_outlet', name: 'Power outlet not working', keywords: ['power', 'outlet', 'socket', 'plug', 'electricity', 'charging', 'no power'], priority: 'medium' as const, estimatedFixTime: '30-45 min' },
  { id: 'tv_not_working', name: 'TV not working', keywords: ['tv', 'television', 'remote', 'channel', 'screen', 'not working'], priority: 'low' as const, estimatedFixTime: '30 min' },
  { id: 'wifi_issue', name: 'WiFi connectivity issue', keywords: ['wifi', 'wi-fi', 'internet', 'connection', 'network', 'online'], priority: 'medium' as const, estimatedFixTime: '15-30 min' },
  { id: 'door_lock', name: 'Door lock issue', keywords: ['door', 'lock', 'key card', 'keycard', 'entry', 'access', 'trouble entering'], priority: 'urgent' as const, estimatedFixTime: '15 min' },
  { id: 'tap_leaking', name: 'Tap leaking', keywords: ['tap', 'faucet', 'leak', 'dripping', 'water', 'bathroom', 'sink'], priority: 'medium' as const, estimatedFixTime: '45 min' },
  { id: 'toilet_issue', name: 'Toilet not working', keywords: ['toilet', 'flush', 'bathroom', 'restroom', 'not flushing', 'blocked'], priority: 'high' as const, estimatedFixTime: '30-60 min' },
  { id: 'light_bulb', name: 'Light bulb burnt out', keywords: ['light', 'bulb', 'lamp', 'dark', 'not bright', 'burnt'], priority: 'low' as const, estimatedFixTime: '15 min' },
  { id: 'mosquito', name: 'Mosquito issue', keywords: ['mosquito', 'mosquitoes', 'bugs', 'insect', 'bite', 'net'], priority: 'low' as const, estimatedFixTime: '30 min' },
  { id: 'water_heater', name: 'Water heater not working', keywords: ['hot water', 'geyser', 'heater', 'shower', 'bath', 'not hot'], priority: 'high' as const, estimatedFixTime: '60 min' },
  { id: 'mini_bar', name: 'Mini bar not cooling', keywords: ['mini bar', 'minibar', 'fridge', 'refrigerator', 'cold', 'beverages'], priority: 'low' as const, estimatedFixTime: '45 min' }
];

// ====== HOTEL AMENITIES ======
const hotelAmenities = [
  { id: 'wifi', name: 'WiFi Internet', location: 'Throughout the hotel', hours: '24/7', keywords: ['wifi', 'wi-fi', 'internet', 'network'] },
  { id: 'gym', name: 'Fitness Center/Gym', location: 'Ground floor, near pool', hours: '6 AM - 10 PM', keywords: ['gym', 'fitness', 'exercise', 'workout', 'equipment'] },
  { id: 'pool', name: 'Swimming Pool', location: 'Rooftop', hours: '7 AM - 8 PM', keywords: ['pool', 'swimming', 'swim'] },
  { id: 'spa', name: 'Spa & Wellness', location: '3rd Floor', hours: '10 AM - 8 PM', keywords: ['spa', 'massage', 'wellness', 'treatment'] },
  { id: 'parking', name: 'Valet Parking', location: 'Hotel entrance', hours: '24/7', keywords: ['parking', 'car', 'valet'] },
  { id: 'restaurant', name: 'Hotel Restaurant', location: 'Ground floor', hours: '7 AM - 11 PM', keywords: ['restaurant', 'dining', 'breakfast', 'dinner'] },
  { id: 'business_center', name: 'Business Center', location: '2nd Floor', hours: '24/7', keywords: ['business', 'printer', 'computer', 'office'] },
  { id: 'concierge', name: 'Concierge Desk', location: 'Lobby', hours: '24/7', keywords: ['concierge', 'help', 'assistance', 'information'] },
  { id: 'laundry', name: 'Laundry Service', location: 'Basement', hours: '8 AM - 8 PM', keywords: ['laundry', 'launder', 'wash', 'dry clean'] },
  { id: 'room_service', name: 'Room Service', location: 'Your room', hours: '24/7', keywords: ['room service', 'food', 'delivery'] }
];

// ====== BILLING QUERIES ======
const billingQueries = [
  { type: 'balance', keywords: ['balance', 'bill', 'charge', 'total', 'amount', 'pay'], response: 'Your current bill balance can be viewed on your room TV or at the front desk. You may also request an itemized statement.' },
  { type: 'payment_methods', keywords: ['payment', 'pay', 'credit card', 'debit card', 'cash', 'upi', 'gpay'], response: 'We accept all major credit cards, debit cards, UPI, net banking, and cash payments.' },
  { type: 'extra_charges', keywords: ['extra', 'additional', 'hidden', 'extra charges', 'fees'], response: 'Extra charges may include room service orders, mini bar usage, phone calls, laundry, or damages. Please check your itemized bill for details.' },
  { type: 'discounts', keywords: ['discount', 'offer', 'promotion', 'deal', 'loyalty', 'member'], response: 'Please inquire about our current offers and loyalty programs at the front desk.' },
  { type: 'invoice', keywords: ['invoice', 'receipt', 'bill copy', 'statement', 'document'], response: 'We can provide a detailed invoice for your stay. Please visit the front desk or request via room service.' },
  { type: 'checkout', keywords: ['checkout', 'check out', 'leaving', 'departure', 'vacate'], response: 'Standard checkout time is 12:00 PM. Late checkout may be available for an additional fee. Please contact the front desk.' }
];

// ====== COMPLETE HOTEL ROOM KB ======
export const hotelRoomKB: HotelRoomKB = {
  categories: {
    housekeeping: {
      items: housekeepingItems,
      responses: {
        howToRequest: 'Simply tell us what you need and we will have it delivered to your room. Most requests are fulfilled within 15-30 minutes.',
        commonIssues: [
          'Towels not replaced',
          'Sheets not clean',
          'Room not cleaned yet today',
          'Need specific cleaning products'
        ],
        deliveryTime: '15-30 minutes for standard housekeeping requests',
        policy: 'Housekeeping is available from 8 AM to 10 PM daily. Requests outside these hours will be fulfilled the next morning.'
      }
    },
    roomService: {
      items: roomServiceItems,
      categories: ['beverages', 'snacks', 'meals', 'breakfast', 'desserts'],
      responses: {
        orderingHours: 'Room service is available 24 hours a day. Full menu available 7 AM - 11 PM. Limited menu available overnight.',
        deliveryTime: 'Most orders are delivered within 20-30 minutes. Complex meals may take up to 45 minutes.',
        paymentMethods: ['Room charge', 'Credit card on delivery', 'Cash', 'UPI payment'],
        minimumOrder: 'No minimum order required for room service',
        dietaryAccommodations: 'We can accommodate vegetarian, vegan, and gluten-free requests. Please mention any allergies or dietary restrictions when ordering.'
      }
    },
    spa: {
      services: spaServices,
      responses: {
        bookingRequired: 'Advance booking is recommended for all spa services. Walk-ins are subject to availability.',
        cancellationPolicy: 'Spa appointments must be cancelled at least 2 hours in advance to avoid a cancellation fee.',
        whatToExpect: 'Please arrive 15 minutes before your appointment. Wear the robe and slippers provided in your room. Inform us of any health conditions or allergies.'
      }
    },
    concierge: {
      requests: conciergeRequests,
      responses: {
        generalAssistance: 'Our concierge team is available 24/7 to assist with any requests, from restaurant reservations to travel arrangements.',
        escalationPolicy: 'For urgent matters outside our capability, we will connect you with the appropriate department or external service.'
      }
    },
    maintenance: {
      issues: maintenanceIssues,
      responses: {
        reportIssue: 'Please report any maintenance issues immediately so we can resolve them. Urgent issues (lock, AC, plumbing) are prioritized.',
        commonIssues: [
          'AC not cooling properly',
          'WiFi connectivity problems',
          'Power outlet not working',
          'Tap or toilet issues'
        ],
        emergencyContacts: 'For room emergencies, dial 0 for immediate assistance. For maintenance non-urgent, dial 2.'
      }
    },
    amenities: {
      items: hotelAmenities,
      responses: {
        wifiInstructions: 'Connect to "HotelGuest" network. Password is your room number. High-speed internet is complimentary for all guests.',
        gymAccess: 'The fitness center is complimentary for all hotel guests. Show your room key card at the entrance.',
        poolAccess: 'The rooftop pool is open from 7 AM to 8 PM. Towels are provided poolside. Children under 12 must be accompanied by an adult.',
        parkingInfo: 'Complimentary valet parking is available. Self-parking is available at the adjacent public parking facility for a daily fee.'
      }
    },
    billing: {
      queries: billingQueries,
      responses: {
        checkoutProcess: 'Checkout time is 12:00 PM. Please return your room key to the front desk. You may settle your bill the night before to avoid delays.',
        paymentOptions: 'We accept all major credit cards, debit cards, UPI, net banking, and cash. Room charges can be billed to your company with prior arrangement.',
        invoiceRequest: 'Request your invoice at checkout or contact the front desk. Itemized bills are available for business travelers.'
      }
    }
  },

  intents: {
    greetings: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'good afternoon', 'greetings', 'howdy', 'welcome'],
    farewells: ['goodbye', 'bye', 'see you', 'take care', 'thanks bye', 'goodnight', 'good night'],
    gratitude: ['thank you', 'thanks', 'thankyou', 'appreciate', 'grateful', 'much appreciated'],
    complaints: ['not clean', 'broken', 'issue', 'problem', 'dirty', 'disgusting', 'unhappy', 'disappointed', 'complaint', 'bad', 'terrible'],
    requests: ['need', 'want', 'please bring', 'can i have', 'could i get', 'i would like', 'request', 'can you', 'would you', 'send', 'deliver'],
    confirmations: ['yes', 'correct', 'right', 'okay', 'ok', 'sure', 'confirm', 'proceed', 'go ahead'],
    cancellations: ['cancel', 'no thanks', 'never mind', 'forget it', 'stop', 'abort', 'dont want']
  },

  responses: {
    greeting: 'Hello! Welcome to room service. I am here to assist you with housekeeping, food orders, spa bookings, and any other requests. How may I help you today?',
    farewell: 'Thank you for choosing us! Have a wonderful stay and please reach out if you need anything else.',
    thankYou: 'You are welcome! Is there anything else I can help you with?',
    sorry: 'I apologize for any inconvenience. Let me help resolve this for you right away.',
    processing: 'I am processing your request. One moment please...',
    notUnderstood: 'I am not quite sure I understood that. Could you please rephrase or provide more details?',
    escalationPrompt: 'I would like to connect you with a human agent who can better assist with this request. Please hold.'
  },

  contextSlots: {
    roomNumber: true,
    itemRequested: true,
    quantity: true,
    preferredTime: true,
    specialInstructions: true,
    guestName: false
  }
};

export default hotelRoomKB;
