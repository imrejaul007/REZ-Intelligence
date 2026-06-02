/**
 * Store/Merchant Knowledge Base
 * Handles all store and merchant related intents, entities, and responses
 * Includes store categories, link types, common queries, and business operations
 */

export interface LinkType {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  icon: string;
}

export interface StoreCategory {
  id: string;
  name: string;
  keywords: string[];
  subcategories?: string[];
  features?: string[];
  commonItems?: string[];
}

export interface CommonQuery {
  id: string;
  category: string;
  keywords: string[];
  response: string;
  action?: {
    type: 'link' | 'action' | 'info';
    value: string;
  };
}

export interface BusinessHours {
  day: string;
  open: string;
  close: string;
  closed?: boolean;
}

export interface StoreService {
  id: string;
  name: string;
  keywords: string[];
  description: string;
  applicableCategories: string[];
}

export interface StoreMerchantKB {
  linkTypes: {
    types: LinkType[];
    responses: {
      linkUsage: string;
      linkValidity: string;
      linkExpired: string;
    };
  };

  storeCategories: {
    categories: StoreCategory[];
    responses: {
      categoryDescription: string;
      featureHighlight: string;
    };
  };

  commonQueries: {
    queries: CommonQuery[];
    responses: {
      hoursInfo: string;
      locationInfo: string;
      parkingInfo: string;
      accessibilityInfo: string;
      contactInfo: string;
      returnPolicy: string;
      warrantyInfo: string;
      loyaltyProgram: string;
    };
  };

  services: {
    available: StoreService[];
    responses: {
      serviceRequest: string;
      bookingProcess: string;
      serviceArea: string;
    };
  };

  intents: {
    greetings: string[];
    businessHours: string[];
    location: string[];
    contact: string[];
    products: string[];
    services: string[];
    payment: string[];
    support: string[];
    complaints: string[];
    feedback: string[];
  };

  responses: {
    greeting: string;
    welcome: string;
    businessHours: string;
    location: string;
    contact: string;
    notUnderstood: string;
    transferToHuman: string;
  };

  contextSlots: {
    storeCategory: boolean;
    productInterest: boolean;
    serviceRequested: boolean;
    locationContext: boolean;
    timeContext: boolean;
  };
}

// ====== LINK TYPES ======
const linkTypes: LinkType[] = [
  {
    id: 'website',
    name: 'Website',
    keywords: ['website', 'web', 'site', 'homepage', 'online', 'visit website', 'more info'],
    description: 'External website link for the merchant/store',
    icon: '🌐'
  },
  {
    id: 'menu',
    name: 'Menu',
    keywords: ['menu', 'food menu', 'price list', 'catalog', 'items', 'products list'],
    description: 'Restaurant or store menu with items and pricing',
    icon: '📋'
  },
  {
    id: 'reservation',
    name: 'Reservation',
    keywords: ['reserve', 'booking', 'appointment', 'schedule', 'book', 'table', 'slot'],
    description: 'Booking or appointment scheduling link',
    icon: '📅'
  },
  {
    id: 'order',
    name: 'Order Now',
    keywords: ['order', 'buy', 'purchase', 'shop', 'add to cart', 'checkout', 'get now'],
    description: 'Direct ordering or purchasing link',
    icon: '🛒'
  },
  {
    id: 'contact',
    name: 'Contact',
    keywords: ['contact', 'call', 'email', 'reach', 'phone', 'message', 'support'],
    description: 'Contact information and communication links',
    icon: '📞'
  },
  {
    id: 'social',
    name: 'Social Media',
    keywords: ['social', 'instagram', 'facebook', 'twitter', 'follow', 'like', 'share'],
    description: 'Social media profiles and pages',
    icon: '📱'
  },
  {
    id: 'gallery',
    name: 'Gallery',
    keywords: ['gallery', 'photos', 'pictures', 'images', 'portfolio', 'showcase'],
    description: 'Photo gallery or portfolio showcase',
    icon: '📷'
  },
  {
    id: 'reviews',
    name: 'Reviews',
    keywords: ['review', 'reviews', 'ratings', 'testimonial', 'feedback', 'rating'],
    description: 'Customer reviews and ratings',
    icon: '⭐'
  },
  {
    id: 'loyalty',
    name: 'Loyalty Program',
    keywords: ['loyalty', 'rewards', 'points', 'membership', 'benefits', 'rewards program'],
    description: 'Loyalty program and rewards information',
    icon: '🎁'
  },
  {
    id: 'offers',
    name: 'Current Offers',
    keywords: ['offer', 'offers', 'deals', 'discount', 'promotion', 'sale', 'special'],
    description: 'Current deals, promotions, and special offers',
    icon: '🏷️'
  },
  {
    id: 'about',
    name: 'About Us',
    keywords: ['about', 'about us', 'our story', 'history', 'who we are', 'company'],
    description: 'About the store/merchant information',
    icon: 'ℹ️'
  },
  {
    id: 'faq',
    name: 'FAQ',
    keywords: ['faq', 'questions', 'help', 'support', 'common questions', 'how to'],
    description: 'Frequently asked questions and help',
    icon: '❓'
  }
];

// ====== STORE CATEGORIES ======
const storeCategories: StoreCategory[] = [
  // Food & Beverage
  {
    id: 'restaurant',
    name: 'Restaurant',
    keywords: ['restaurant', 'dining', 'food', 'eat', 'meal', 'dinner', 'lunch', 'breakfast', 'cafe'],
    subcategories: ['fine dining', 'casual dining', 'fast food', 'cafe', 'food court', 'bar & grill'],
    features: ['dine-in', 'takeaway', 'delivery', 'catering', 'private dining', 'buffet'],
    commonItems: ['menu', 'reservations', 'specials', 'events']
  },
  {
    id: 'grocery',
    name: 'Grocery Store',
    keywords: ['grocery', 'groceries', 'supermarket', 'market', 'food items', 'essentials'],
    subcategories: ['supermarket', 'organic store', 'convenience store', 'specialty food'],
    features: ['home delivery', 'pickup', 'weekly specials', 'loyalty program'],
    commonItems: ['fresh produce', 'dairy', 'bakery', 'frozen foods', 'household items']
  },
  {
    id: 'pharmacy',
    name: 'Pharmacy',
    keywords: ['pharmacy', 'medicine', 'medications', 'drugstore', 'health', 'wellness', 'prescription'],
    subcategories: ['retail pharmacy', 'hospital pharmacy', 'compounding pharmacy', 'online pharmacy'],
    features: ['prescription fulfillment', 'health consultations', 'home delivery', 'vaccinations'],
    commonItems: ['medicines', 'OTC products', 'health supplements', 'personal care', 'first aid']
  },
  {
    id: 'electronics',
    name: 'Electronics Store',
    keywords: ['electronics', 'tech', 'gadget', 'phone', 'laptop', 'computer', 'TV', 'appliances'],
    subcategories: ['consumer electronics', 'computer store', 'mobile shop', 'appliances'],
    features: ['installation', 'warranty', 'trade-in', 'financing', 'tech support'],
    commonItems: ['smartphones', 'laptops', 'TVs', 'headphones', 'accessories', 'smart home devices']
  },
  {
    id: 'fashion',
    name: 'Fashion & Apparel',
    keywords: ['fashion', 'clothing', 'apparel', 'clothes', 'dress', 'shoes', 'accessories', 'fashion'],
    subcategories: ['men fashion', 'women fashion', 'kids fashion', 'sportswear', 'ethnic wear', 'luxury'],
    features: ['alteration', 'styling consultation', 'loyalty program', 'gift wrapping'],
    commonItems: ['shirts', 'pants', 'dresses', 'footwear', 'accessories', 'jewelry']
  },
  {
    id: 'beauty',
    name: 'Beauty & Cosmetics',
    keywords: ['beauty', 'cosmetics', 'makeup', 'skincare', 'haircare', 'beauty products', 'salon'],
    subcategories: ['makeup', 'skincare', 'haircare', 'fragrances', 'beauty tools'],
    features: ['makeup consultation', 'skin analysis', 'loyalty program', 'samples'],
    commonItems: ['lipstick', 'foundation', 'moisturizer', 'shampoo', 'perfume', 'makeup tools']
  },
  {
    id: 'home',
    name: 'Home & Furniture',
    keywords: ['home', 'furniture', 'decor', 'furnishing', 'interior', 'living room', 'bedroom'],
    subcategories: ['furniture', 'home decor', 'kitchenware', 'bedding', 'outdoor furniture'],
    features: ['delivery', 'installation', 'design consultation', 'customization'],
    commonItems: ['sofas', 'beds', 'tables', 'chairs', 'lighting', 'rugs', 'curtains']
  },
  {
    id: 'sports',
    name: 'Sports & Fitness',
    keywords: ['sports', 'fitness', 'gym', 'exercise', 'outdoor', 'camping', 'athletic'],
    subcategories: ['sports equipment', 'fitness gear', 'outdoor gear', 'sportswear'],
    features: ['gear fitting', 'sports analysis', 'loyalty program'],
    commonItems: ['sports shoes', 'equipment', 'activewear', 'supplements', 'outdoor gear']
  },
  {
    id: 'toys',
    name: 'Toys & Games',
    keywords: ['toys', 'games', 'play', 'kids', 'children', 'toyshop', 'hobby'],
    subcategories: ['action figures', 'board games', 'educational toys', 'outdoor toys', 'video games'],
    features: ['gift wrapping', 'birthday packages', 'loyalty program'],
    commonItems: ['action figures', 'dolls', 'board games', 'puzzles', 'video games', 'art supplies']
  },
  {
    id: 'books',
    name: 'Books & Stationery',
    keywords: ['books', 'stationery', 'novels', 'textbooks', 'office supplies', 'paper'],
    subcategories: ['fiction', 'non-fiction', 'textbooks', 'children books', 'stationery'],
    features: ['book ordering', 'loyalty program', 'author events'],
    commonItems: ['books', 'notebooks', 'pens', 'art supplies', 'gift cards']
  },
  {
    id: 'jewelry',
    name: 'Jewelry & Watches',
    keywords: ['jewelry', 'jewellery', 'watches', 'gold', 'silver', 'diamond', 'rings', 'necklace'],
    subcategories: ['gold jewelry', 'diamond jewelry', 'silver jewelry', 'fashion jewelry', 'watches'],
    features: ['customization', 'engraving', 'repair', 'appraisal', 'insurance'],
    commonItems: ['rings', 'necklaces', 'bracelets', 'earrings', 'watches']
  },
  {
    id: 'services',
    name: 'Local Services',
    keywords: ['service', 'services', 'repair', 'cleaning', 'maintenance', 'professional'],
    subcategories: ['repair', 'cleaning', 'maintenance', 'consulting', 'professional services'],
    features: ['home service', 'appointments', 'quotes', 'warranty'],
    commonItems: ['AC repair', 'plumbing', 'electrical', 'cleaning', 'pest control', 'beauty services']
  }
];

// ====== COMMON QUERIES ======
const commonQueries: CommonQuery[] = [
  {
    id: 'hours',
    category: 'business_hours',
    keywords: ['hours', 'open', 'close', 'timing', 'when open', 'when close', 'schedule', 'today', 'now'],
    response: 'Our store hours are [insert hours]. We are currently [open/closed]. Would you like more details about specific departments?',
    action: { type: 'info', value: 'store_hours' }
  },
  {
    id: 'location',
    category: 'location',
    keywords: ['location', 'address', 'where', 'find', 'directions', 'map', 'near', 'far'],
    response: 'We are located at [insert address]. You can find us [additional location info]. Would you like directions or our location on maps?',
    action: { type: 'link', value: 'maps_link' }
  },
  {
    id: 'parking',
    category: 'location',
    keywords: ['parking', 'park', 'car', 'vehicle', 'valet', 'carpark'],
    response: '[Parking information] We offer [parking type] for our customers. [Any parking fees or validation info]',
    action: { type: 'info', value: 'parking_info' }
  },
  {
    id: 'accessibility',
    category: 'accessibility',
    keywords: ['wheelchair', 'disabled', 'accessibility', 'accessible', 'handicap', 'elevator', 'ramp'],
    response: 'Yes, our store is fully wheelchair accessible with [elevators/ramps] to all floors. We also have [additional accessibility features]. Our staff is happy to assist you.',
    action: { type: 'info', value: 'accessibility_info' }
  },
  {
    id: 'contact',
    category: 'contact',
    keywords: ['contact', 'call', 'phone', 'email', 'reach', 'speak', 'talk', 'customer service'],
    response: 'You can reach us by phone at [phone number], email at [email], or visit our [contact page]. Our customer service team is available [hours].',
    action: { type: 'link', value: 'contact_link' }
  },
  {
    id: 'returns',
    category: 'returns',
    keywords: ['return', 'exchange', 'refund', 'money back', 'policy', 'defective'],
    response: 'Our return policy allows returns within [number] days of purchase with original receipt. [Special conditions for certain items]. Would you like to know more about our return process?',
    action: { type: 'info', value: 'return_policy' }
  },
  {
    id: 'warranty',
    category: 'warranty',
    keywords: ['warranty', 'guarantee', 'repair', 'support', 'defective', 'broken'],
    response: '[Product] comes with [warranty period] warranty covering manufacturing defects. For warranty claims, please visit our [service center/contact us].',
    action: { type: 'info', value: 'warranty_info' }
  },
  {
    id: 'loyalty',
    category: 'loyalty',
    keywords: ['loyalty', 'rewards', 'points', 'membership', 'card', 'join', 'sign up', 'benefits'],
    response: 'Join our loyalty program to earn points on every purchase! Members enjoy [benefits]. Sign up [link/process]. It is free to join!',
    action: { type: 'link', value: 'loyalty_signup' }
  },
  {
    id: 'price',
    category: 'products',
    keywords: ['price', 'cost', 'how much', 'discount', 'offer', 'deal', 'sale', 'cheap'],
    response: 'The price for [product] is [price]. [Current offers/discounts]. Would you like to know about any ongoing promotions?',
    action: { type: 'info', value: 'product_pricing' }
  },
  {
    id: 'availability',
    category: 'products',
    keywords: ['available', 'in stock', 'stock', 'order', 'when', 'waiting', 'backorder'],
    response: '[Product] is [in stock/out of stock/currently unavailable]. [Alternative info or expected date]. Would you like us to notify you when it is back?',
    action: { type: 'action', value: 'stock_check' }
  },
  {
    id: 'delivery',
    category: 'delivery',
    keywords: ['delivery', 'shipping', 'deliver', 'home delivery', 'courier', 'when arrive'],
    response: 'We offer [delivery options]! [Delivery timeframes and costs]. For orders over [amount], delivery is [free/cost].',
    action: { type: 'info', value: 'delivery_info' }
  },
  {
    id: 'payment',
    category: 'payment',
    keywords: ['payment', 'pay', 'cash', 'card', 'upi', 'netbanking', 'EMI', 'installment', 'finance'],
    response: 'We accept [payment methods]. [EMI/financing options if applicable]. Would you like more details about our payment options?',
    action: { type: 'info', value: 'payment_options' }
  },
  {
    id: 'appointment',
    category: 'services',
    keywords: ['appointment', 'book', 'schedule', 'slot', 'booking', 'reserve'],
    response: 'You can book an appointment [through our website/by calling us/at the store]. [Appointment availability]. What type of service are you looking for?',
    action: { type: 'link', value: 'booking_link' }
  },
  {
    id: 'support',
    category: 'support',
    keywords: ['help', 'support', 'issue', 'problem', 'question', 'assist', 'assistance'],
    response: 'I am here to help! Could you please provide more details about what you need assistance with? [Options: product info, order status, returns, technical support]',
    action: { type: 'action', value: 'support_menu' }
  },
  {
    id: 'bulk_order',
    category: 'business',
    keywords: ['bulk', 'wholesale', 'business', 'corporate', 'volume', 'bulk order', 'B2B'],
    response: 'We offer special pricing for bulk and corporate orders. Please [contact our business team/visit our B2B portal] for custom quotes and dedicated support.',
    action: { type: 'link', value: 'b2b_contact' }
  }
];

// ====== STORE SERVICES ======
const storeServices: StoreService[] = [
  {
    id: 'delivery',
    name: 'Home Delivery',
    keywords: ['delivery', 'shipping', 'home delivery', 'courier', 'deliver'],
    description: 'Get your purchases delivered to your doorstep',
    applicableCategories: ['grocery', 'pharmacy', 'electronics', 'fashion', 'home', 'books', 'toys']
  },
  {
    id: 'pickup',
    name: 'Store Pickup',
    keywords: ['pickup', 'collect', 'order online pickup', 'click and collect'],
    description: 'Order online and pick up in-store',
    applicableCategories: ['grocery', 'electronics', 'fashion', 'home', 'books', 'toys']
  },
  {
    id: 'installation',
    name: 'Installation Service',
    keywords: ['installation', 'install', 'setup', 'configure', 'assemble'],
    description: 'Professional installation for electronics and appliances',
    applicableCategories: ['electronics', 'home', 'furniture']
  },
  {
    id: 'repair',
    name: 'Repair Service',
    keywords: ['repair', 'fix', 'service', 'maintenance', 'broken'],
    description: 'Repair services for various products',
    applicableCategories: ['electronics', 'jewelry', 'services', 'home']
  },
  {
    id: 'customization',
    name: 'Customization',
    keywords: ['custom', 'customize', 'personalize', 'engrave', 'tailor'],
    description: 'Customization and personalization services',
    applicableCategories: ['jewelry', 'fashion', 'beauty']
  },
  {
    id: 'consultation',
    name: 'Consultation',
    keywords: ['consultation', 'advice', 'expert', 'recommend', 'suggest'],
    description: 'Expert consultation for purchases',
    applicableCategories: ['electronics', 'beauty', 'jewelry', 'fashion', 'home']
  },
  {
    id: 'loyalty',
    name: 'Loyalty Program',
    keywords: ['loyalty', 'rewards', 'points', 'membership', 'benefits'],
    description: 'Earn rewards on every purchase',
    applicableCategories: ['restaurant', 'grocery', 'pharmacy', 'fashion', 'beauty', 'books']
  },
  {
    id: 'gift_wrapping',
    name: 'Gift Wrapping',
    keywords: ['gift', 'wrap', 'wrapping', 'presentation', 'gifted'],
    description: 'Professional gift wrapping service',
    applicableCategories: ['fashion', 'jewelry', 'beauty', 'books', 'toys']
  },
  {
    id: 'alteration',
    name: 'Alteration Service',
    keywords: ['alteration', 'alter', 'tailor', 'fit', 'adjust', 'hem'],
    description: 'Clothing alteration and fitting services',
    applicableCategories: ['fashion']
  },
  {
    id: 'financing',
    name: 'Financing Options',
    keywords: ['EMI', 'finance', 'financing', 'installment', 'payment plan', 'credit'],
    description: 'Flexible payment and financing options',
    applicableCategories: ['electronics', 'furniture', 'home', 'jewelry']
  }
];

// ====== COMPLETE STORE MERCHANT KB ======
export const storeMerchantKB: StoreMerchantKB = {
  linkTypes: {
    types: linkTypes,
    responses: {
      linkUsage: 'This link provides direct access to [link type]. Tap to open the [link type] in your browser or app.',
      linkValidity: 'This link is valid for [duration]. Please use it before it expires.',
      linkExpired: 'This link has expired. Please request a new link or visit the store directly.'
    }
  },

  storeCategories: {
    categories: storeCategories,
    responses: {
      categoryDescription: 'This store offers [category description]. Browse our [products/services] to find what you need.',
      featureHighlight: 'Featured services at this store include: [features list].'
    }
  },

  commonQueries: {
    queries: commonQueries,
    responses: {
      hoursInfo: 'Store hours vary by location. Please check the specific store page or contact them directly for accurate timings.',
      locationInfo: 'Store locations and directions are available on the store profile. Use the map link to get directions.',
      parkingInfo: 'Parking availability varies by location. Check the store profile for parking information.',
      accessibilityInfo: 'We strive to make our stores accessible to all customers. Contact the store for specific accessibility features.',
      contactInfo: 'Store contact information is available on their profile. You can call, email, or visit their website.',
      returnPolicy: 'Return policies vary by store and product category. Please check with the specific store for their return policy.',
      warrantyInfo: 'Warranty terms vary by product and store. Check product documentation or contact the store for warranty details.',
      loyaltyProgram: 'Many stores offer loyalty programs. Check the store profile or ask about joining their rewards program.'
    }
  },

  services: {
    available: storeServices,
    responses: {
      serviceRequest: 'This store offers [service name]. Would you like to schedule or learn more about this service?',
      bookingProcess: 'To book [service], you can [booking process]. The service typically takes [duration].',
      serviceArea: 'This service is available [service area details].'
    }
  },

  intents: {
    greetings: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'welcome', 'help me'],
    businessHours: ['hours', 'open', 'close', 'timing', 'when', 'schedule', 'today', 'now', 'available'],
    location: ['where', 'location', 'address', 'directions', 'find', 'map', 'near me', 'nearby'],
    contact: ['contact', 'call', 'phone', 'email', 'reach', 'speak', 'talk', 'message'],
    products: ['product', 'item', 'buy', 'price', 'stock', 'available', 'want', 'looking for', 'search'],
    services: ['service', 'help', 'support', 'repair', 'installation', 'delivery', 'customization'],
    payment: ['pay', 'payment', 'card', 'cash', 'upi', 'EMI', 'installment', 'discount', 'offer'],
    support: ['help', 'support', 'issue', 'problem', 'question', 'refund', 'return', 'complaint'],
    complaints: ['complaint', 'bad', 'terrible', 'disappointed', 'angry', 'unhappy', 'frustrated', 'not happy'],
    feedback: ['feedback', 'suggestion', 'improve', 'review', 'rating', 'experience', 'great', 'amazing']
  },

  responses: {
    greeting: 'Hello! Welcome to [Store Name]. I am here to help you with product information, store details, services, and any questions you may have. How may I assist you today?',
    welcome: 'Thank you for visiting! What brings you in today? I can help you find products, check availability, learn about services, or answer any questions.',
    businessHours: 'Our regular business hours are [hours]. Please note that hours may vary on holidays. Would you like more specific information?',
    location: 'We are located at [address]. You can find us on Google Maps or any navigation app. Would you like directions?',
    contact: 'You can reach us at [phone] or [email]. Our team is available during business hours to assist you.',
    notUnderstood: 'I am not quite sure I understood that. Could you please rephrase? Are you looking for store information, products, or services?',
    transferToHuman: 'I would like to connect you with one of our team members who can better assist you. Please hold for a moment.'
  },

  contextSlots: {
    storeCategory: true,
    productInterest: true,
    serviceRequested: true,
    locationContext: true,
    timeContext: true
  }
};

export default storeMerchantKB;
