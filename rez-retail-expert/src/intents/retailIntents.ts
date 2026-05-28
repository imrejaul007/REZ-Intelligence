import { SortOption } from '../services/retailExpert';

export interface RetailIntent {
  id: string;
  name: string;
  patterns: string[];
  requiredEntities: string[];
  optionalEntities: string[];
  priority: number;
}

export const RETAIL_INTENTS: RetailIntent[] = [
  {
    id: 'product_search',
    name: 'Search Products',
    patterns: [
      'find me {product}',
      'search for {product}',
      'looking for {product}',
      'do you have {product}',
      'i want to buy {product}',
      'show me {product}',
      'find {product}',
      'search {product}'
    ],
    requiredEntities: ['product'],
    optionalEntities: ['category', 'brand', 'price', 'color'],
    priority: 10
  },
  {
    id: 'category_browse',
    name: 'Browse Category',
    patterns: [
      'browse {category}',
      'show me {category}',
      'shop {category}',
      'what do you have in {category}',
      'i\'m interested in {category}'
    ],
    requiredEntities: ['category'],
    optionalEntities: ['budget', 'sort'],
    priority: 9
  },
  {
    id: 'product_details',
    name: 'Get Product Details',
    patterns: [
      'tell me about {product}',
      '{product} details',
      'specs for {product}',
      '{product} description',
      'more info on {product}',
      'what are the specs'
    ],
    requiredEntities: ['product'],
    optionalEntities: [],
    priority: 8
  },
  {
    id: 'sizing_help',
    name: 'Sizing Help',
    patterns: [
      'what size should i get',
      'size guide',
      'size chart',
      'do you run small',
      'true to size',
      'how does it fit',
      'find my size',
      'size recommendations'
    ],
    requiredEntities: [],
    optionalEntities: ['category', 'product'],
    priority: 7
  },
  {
    id: 'product_comparison',
    name: 'Compare Products',
    patterns: [
      'compare {product1} and {product2}',
      '{product1} vs {product2}',
      'difference between {product1} and {product2}',
      'which is better {product1} or {product2}',
      'compare these items'
    ],
    requiredEntities: ['product'],
    optionalEntities: [],
    priority: 7
  },
  {
    id: 'check_availability',
    name: 'Check Availability',
    patterns: [
      'is {product} in stock',
      'available sizes',
      '{product} availability',
      'in stock',
      'when will {product} be back',
      'stock status'
    ],
    requiredEntities: ['product'],
    optionalEntities: ['size', 'color'],
    priority: 6
  },
  {
    id: 'add_to_wishlist',
    name: 'Add to Wishlist',
    patterns: [
      'add to wishlist',
      'save for later',
      'add {product} to my list',
      'bookmark {product}',
      'put this aside'
    ],
    requiredEntities: ['product'],
    optionalEntities: [],
    priority: 6
  },
  {
    id: 'check_wishlist',
    name: 'View Wishlist',
    patterns: [
      'show my wishlist',
      'view wishlist',
      'what\'s on my list',
      'saved items',
      'my saved products'
    ],
    requiredEntities: [],
    optionalEntities: [],
    priority: 5
  },
  {
    id: 'recommendations',
    name: 'Get Recommendations',
    patterns: [
      'recommend something',
      'suggest a product',
      'what would you recommend',
      'you might also like',
      'similar items',
      'complete the look'
    ],
    requiredEntities: [],
    optionalEntities: ['category', 'budget'],
    priority: 5
  },
  {
    id: 'check_price',
    name: 'Check Price',
    patterns: [
      'how much is {product}',
      'what\'s the price',
      '{product} cost',
      'price check',
      'is this on sale'
    ],
    requiredEntities: ['product'],
    optionalEntities: [],
    priority: 6
  },
  {
    id: 'check_reviews',
    name: 'Check Reviews',
    patterns: [
      'what are the reviews',
      'customer reviews',
      'how is {product} rated',
      '{product} ratings',
      'is this unknown good'
    ],
    requiredEntities: ['product'],
    optionalEntities: [],
    priority: 4
  },
  {
    id: 'browse_by_brand',
    name: 'Browse by Brand',
    patterns: [
      'show me {brand} products',
      '{brand} collection',
      'do you carry {brand}',
      'is {brand} available'
    ],
    requiredEntities: ['brand'],
    optionalEntities: ['category'],
    priority: 5
  },
  {
    id: 'check_return_policy',
    name: 'Return Policy',
    patterns: [
      'what is your return policy',
      'can i return this',
      'how do returns work',
      'return window'
    ],
    requiredEntities: [],
    optionalEntities: ['product'],
    priority: 3
  }
];

export interface EntityExtraction {
  product?: string;
  category?: string;
  brand?: string;
  priceMin?: number;
  priceMax?: number;
  size?: string;
  color?: string;
  sort?: SortOption;
  budget?: boolean;
}

export function extractEntities(message: string): EntityExtraction {
  const entities: EntityExtraction = {};

  const categoryPatterns: Record<string, string> = {
    'women': 'womens-clothing',
    'women\'s': 'womens-clothing',
    'mens': 'mens-clothing',
    'men\'s': 'mens-clothing',
    'shoes': 'shoes',
    'footwear': 'shoes',
    'accessories': 'accessories',
    'bags': 'accessories',
    'electronics': 'electronics',
    'tech': 'electronics',
    'home': 'home',
    'living': 'home',
    'beauty': 'beauty',
    'makeup': 'beauty',
    'skincare': 'beauty',
    'sports': 'sports',
    'athletic': 'sports',
    'kids': 'kids',
    'baby': 'kids'
  };

  for (const [keyword, category] of Object.entries(categoryPatterns)) {
    if (message.toLowerCase().includes(keyword)) {
      entities.category = category;
      break;
    }
  }

  const brandPatterns = [
    'Levi\'s', 'Levis', 'Nike', 'Adidas', 'Zara', 'H&M',
    'Everlane', 'Madewell', 'Ralph Lauren', 'Tommy Hilfiger',
    'Common Projects', 'Sony', 'Bose', 'Apple', 'Samsung'
  ];

  for (const brand of brandPatterns) {
    if (message.toLowerCase().includes(brand.toLowerCase())) {
      entities.brand = brand;
      break;
    }
  }

  const priceRangeMatch = message.match(/\$?\s*(\d{2,4})\s*(?:-|to)\s*\$?\s*(\d{2,4})/);
  if (priceRangeMatch) {
    entities.priceMin = parseInt(priceRangeMatch[1]);
    entities.priceMax = parseInt(priceRangeMatch[2]);
  }

  const singlePriceMatch = message.match(/\$?\s*(\d{2,4})/);
  if (singlePriceMatch && !priceRangeMatch) {
    entities.priceMin = parseInt(singlePriceMatch[1]);
    entities.priceMax = parseInt(singlePriceMatch[1]);
  }

  const sizeMatch = message.match(/\b(XS|S|M|L|XL|XXL|\d{1,2})\b/i);
  if (sizeMatch) {
    entities.size = sizeMatch[1].toUpperCase();
  }

  const colorKeywords = [
    'black', 'white', 'navy', 'blue', 'red', 'green', 'pink',
    'gray', 'grey', 'brown', 'beige', 'cream', 'purple', 'orange',
    'yellow', 'gold', 'silver'
  ];

  for (const color of colorKeywords) {
    if (message.toLowerCase().includes(color)) {
      entities.color = color;
      break;
    }
  }

  if (message.toLowerCase().includes('under') || message.toLowerCase().includes('budget')) {
    entities.budget = true;
  }

  if (message.toLowerCase().includes('top rated') || message.toLowerCase().includes('best rated')) {
    entities.sort = SortOption.RATING;
  } else if (message.toLowerCase().includes('cheapest') || message.toLowerCase().includes('low to high')) {
    entities.sort = SortOption.PRICE_LOW_TO_HIGH;
  } else if (message.toLowerCase().includes('highest price') || message.toLowerCase().includes('high to low')) {
    entities.sort = SortOption.PRICE_HIGH_TO_LOW;
  }

  return entities;
}

export function matchIntent(message: string): RetailIntent | null {
  const lowerMessage = message.toLowerCase();

  let bestMatch: RetailIntent | null = null;
  let highestScore = 0;

  for (const intent of RETAIL_INTENTS) {
    let matchCount = 0;

    for (const pattern of intent.patterns) {
      const patternLower = pattern.toLowerCase();

      if (patternLower.includes('{product}') || patternLower.includes('{category}') || patternLower.includes('{brand}')) {
        const regexPattern = patternLower.replace(/\{[^}]+\}/g, '[^\\s]+');
        const regex = new RegExp(regexPattern, 'i');
        if (regex.test(lowerMessage)) {
          matchCount += 2;
        }
      } else {
        const words = patternLower.split(' ');
        const matchingWords = words.filter(word => lowerMessage.includes(word));
        matchCount += matchingWords.length / words.length;
      }
    }

    const score = (matchCount / intent.patterns.length) * intent.priority;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = intent;
    }
  }

  return highestScore >= 0.3 ? bestMatch : null;
}
