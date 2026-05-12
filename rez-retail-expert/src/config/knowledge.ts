export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  description: string;
  price: number;
  originalPrice?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  colors: ProductColor[];
  sizes?: ProductSize[];
  materials?: string[];
  dimensions?: Record<string, string>;
  features: string[];
  careInstructions?: string[];
  images: string[];
  inStock: boolean;
  stockCount?: number;
  tags: string[];
}

export interface ProductColor {
  name: string;
  hex: string;
  inStock: boolean;
}

export interface ProductSize {
  name: string;
  inStock: boolean;
  stockCount?: number;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  subcategories: string[];
  popularBrands: string[];
  priceRange: { min: number; max: number };
}

export const CATEGORIES: Category[] = [
  {
    id: 'womens-clothing',
    name: "Women's Clothing",
    description: 'Dresses, tops, bottoms, outerwear, and more for women',
    subcategories: ['Dresses', 'Tops', 'Pants', 'Jeans', 'Skirts', 'Jackets', 'Coats', 'Activewear', 'Sleepwear'],
    popularBrands: ['Nike', 'Adidas', 'Zara', 'H&M', 'Nordstrom', 'Reformation'],
    priceRange: { min: 15, max: 500 }
  },
  {
    id: 'mens-clothing',
    name: "Men's Clothing",
    description: 'Shirts, pants, suits, outerwear, and more for men',
    subcategories: ['T-Shirts', 'Shirts', 'Pants', 'Jeans', 'Shorts', 'Jackets', 'Suits', 'Activewear', 'Sleepwear'],
    popularBrands: ['Ralph Lauren', 'Tommy Hilfiger', 'Levi\'s', 'Gap', 'Hugo Boss', 'Uniqlo'],
    priceRange: { min: 20, max: 600 }
  },
  {
    id: 'shoes',
    name: 'Shoes',
    description: 'Athletic, casual, dress, and outdoor footwear for all occasions',
    subcategories: ['Sneakers', 'Running', 'Boots', 'Sandals', 'Dress Shoes', 'Loafers', 'Heels', 'Flat Shoes'],
    popularBrands: ['Nike', 'Adidas', 'New Balance', 'Cole Haan', 'Clarks', 'UGG'],
    priceRange: { min: 30, max: 400 }
  },
  {
    id: 'accessories',
    name: 'Accessories',
    description: 'Bags, jewelry, watches, belts, and more',
    subcategories: ['Bags', 'Wallets', 'Watches', 'Jewelry', 'Sunglasses', 'Belts', 'Hats', 'Scarves'],
    popularBrands: ['Michael Kors', 'Coach', 'Fossil', 'Ray-Ban', 'Calvin Klein'],
    priceRange: { min: 15, max: 300 }
  },
  {
    id: 'electronics',
    name: 'Electronics',
    description: 'Gadgets, audio, computing, and smart home devices',
    subcategories: ['Smartphones', 'Tablets', 'Laptops', 'Headphones', 'Speakers', 'Smartwatches', 'Cameras', 'Gaming'],
    popularBrands: ['Apple', 'Samsung', 'Sony', 'Bose', 'Dell', 'HP', 'Nintendo'],
    priceRange: { min: 20, max: 2000 }
  },
  {
    id: 'home',
    name: 'Home & Living',
    description: 'Furniture, decor, kitchen, and bedding',
    subcategories: ['Furniture', 'Bedding', 'Kitchen', 'Bath', 'Decor', 'Storage', 'Lighting', 'Rugs'],
    popularBrands: ['IKEA', 'West Elm', 'Pottery Barn', 'Crate & Barrel', 'Wayfair'],
    priceRange: { min: 10, max: 2000 }
  },
  {
    id: 'beauty',
    name: 'Beauty & Personal Care',
    description: 'Skincare, makeup, haircare, and fragrances',
    subcategories: ['Skincare', 'Makeup', 'Haircare', 'Fragrances', 'Bath & Body', 'Grooming', 'Nails'],
    popularBrands: ['Sephora', 'Ulta', 'MAC', 'Estee Lauder', 'L\'Oreal', 'OPI'],
    priceRange: { min: 5, max: 300 }
  },
  {
    id: 'sports',
    name: 'Sports & Outdoors',
    description: 'Athletic apparel, equipment, and outdoor gear',
    subcategories: ['Athletic Apparel', 'Sneakers', 'Equipment', 'Camping', 'Hiking', 'Cycling', 'Fitness'],
    popularBrands: ['Nike', 'Adidas', 'Under Armour', 'Patagonia', 'The North Face', 'REI'],
    priceRange: { min: 20, max: 800 }
  }
];

export interface SizeGuide {
  category: string;
  measurements: string[];
  sizes: Record<string, Record<string, string>>;
  fitNotes: string;
}

export const SIZE_GUIDES: SizeGuide[] = [
  {
    category: 'womens-tops',
    measurements: ['Bust', 'Waist', 'Shoulder', 'Arm Length'],
    sizes: {
      XS: { Bust: '32-33"', Waist: '24-25"', Shoulder: '14-14.5"', 'Arm Length': '30-30.5"' },
      S: { Bust: '34-36"', Waist: '26-28"', Shoulder: '15-15.5"', 'Arm Length': '31-31.5"' },
      M: { Bust: '38-40"', Waist: '30-32"', Shoulder: '16-16.5"', 'Arm Length': '32-32.5"' },
      L: { Bust: '42-44"', Waist: '34-36"', Shoulder: '17-17.5"', 'Arm Length': '33-33.5"' },
      XL: { Bust: '46-48"', Waist: '38-40"', Shoulder: '18-18.5"', 'Arm Length': '34-34.5"' }
    },
    fitNotes: 'Our tops have a relaxed fit. Order your usual size for a comfortable fit, or size down for a more fitted look.'
  },
  {
    category: 'mens-tops',
    measurements: ['Chest', 'Waist', 'Shoulder', 'Arm Length'],
    sizes: {
      S: { Chest: '36-38"', Waist: '30-32"', Shoulder: '17-17.5"', 'Arm Length': '32-33"' },
      M: { Chest: '39-41"', Waist: '33-35"', Shoulder: '18-18.5"', 'Arm Length': '33-34"' },
      L: { Chest: '42-44"', Waist: '36-38"', Shoulder: '19-19.5"', 'Arm Length': '34-35"' },
      XL: { Chest: '45-47"', Waist: '39-41"', Shoulder: '20-20.5"', 'Arm Length': '35-36"' },
      '2XL': { Chest: '48-50"', Waist: '42-44"', Shoulder: '21-21.5"', 'Arm Length': '36-37"' }
    },
    fitNotes: 'Our mens tops have a classic fit with room through the chest and arms. Check the specific product for slim fit options.'
  },
  {
    category: 'womens-bottoms',
    measurements: ['Waist', 'Hips', 'Inseam'],
    sizes: {
      '0': { Waist: '24-25"', Hips: '34-35"', Inseam: '30-31"' },
      '2': { Waist: '25-26"', Hips: '35-36"', Inseam: '30-31"' },
      '4': { Waist: '26-27"', Hips: '36-37"', Inseam: '30-31"' },
      '6': { Waist: '27-28"', Hips: '37-38"', Inseam: '30-31"' },
      '8': { Waist: '28-29"', Hips: '38-39"', Inseam: '30-31"' },
      '10': { Waist: '29-30"', Hips: '39-40"', Inseam: '30-31"' },
      '12': { Waist: '31-32"', Hips: '41-42"', Inseam: '30-31"' },
      '14': { Waist: '33-34"', Hips: '43-44"', Inseam: '30-31"' }
    },
    fitNotes: 'Our bottoms run true to size. For a high-waisted look, check specific product styles. Inseam is standard unless noted.'
  },
  {
    category: 'mens-bottoms',
    measurements: ['Waist', 'Hips', 'Inseam'],
    sizes: {
      '28': { Waist: '28-29"', Hips: '34-35"', Inseam: '30-31"' },
      '30': { Waist: '30-31"', Hips: '36-37"', Inseam: '30-31"' },
      '32': { Waist: '32-33"', Hips: '38-39"', Inseam: '30-31"' },
      '34': { Waist: '34-35"', Hips: '40-41"', Inseam: '30-31"' },
      '36': { Waist: '36-37"', Hips: '42-43"', Inseam: '30-31"' },
      '38': { Waist: '38-39"', Hips: '44-45"', Inseam: '30-31"' }
    },
    fitNotes: 'Our mens bottoms have a regular fit through the seat and thigh. Check product details for slim or relaxed fit options.'
  },
  {
    category: 'shoes-womens',
    measurements: ['Foot Length', 'Foot Width'],
    sizes: {
      '5': { 'Foot Length': '8.5"', 'Foot Width': '3.5"' },
      '5.5': { 'Foot Length': '8.75"', 'Foot Width': '3.5"' },
      '6': { 'Foot Length': '9"', 'Foot Width': '3.5"' },
      '6.5': { 'Foot Length': '9.25"', 'Foot Width': '3.75"' },
      '7': { 'Foot Length': '9.5"', 'Foot Width': '3.75"' },
      '7.5': { 'Foot Length': '9.75"', 'Foot Width': '4"' },
      '8': { 'Foot Length': '10"', 'Foot Width': '4"' },
      '8.5': { 'Foot Length': '10.25"', 'Foot Width': '4.25"' },
      '9': { 'Foot Length': '10.5"', 'Foot Width': '4.25"' },
      '10': { 'Foot Length': '10.75"', 'Foot Width': '4.5"' }
    },
    fitNotes: 'Most of our womens shoes run true to size. Check specific product reviews for half-size recommendations.'
  },
  {
    category: 'shoes-mens',
    measurements: ['Foot Length', 'Foot Width'],
    sizes: {
      '7': { 'Foot Length': '9.5"', 'Foot Width': '4"' },
      '7.5': { 'Foot Length': '9.75"', 'Foot Width': '4"' },
      '8': { 'Foot Length': '10"', 'Foot Width': '4.25"' },
      '8.5': { 'Foot Length': '10.25"', 'Foot Width': '4.25"' },
      '9': { 'Foot Length': '10.5"', 'Foot Width': '4.5"' },
      '9.5': { 'Foot Length': '10.75"', 'Foot Width': '4.5"' },
      '10': { 'Foot Length': '11"', 'Foot Width': '4.75"' },
      '10.5': { 'Foot Length': '11.25"', 'Foot Width': '4.75"' },
      '11': { 'Foot Length': '11.5"', 'Foot Width': '5"' },
      '12': { 'Foot Length': '12"', 'Foot Width': '5"' }
    },
    fitNotes: 'Our mens shoes generally run true to size. Athletic shoes may run small - consider sizing up half a size.'
  }
];

export interface ComparisonCriteria {
  id: string;
  name: string;
  description: string;
  applicableCategories: string[];
}

export const COMPARISON_CRITERIA: ComparisonCriteria[] = [
  {
    id: 'price',
    name: 'Price',
    description: 'Current price and any ongoing discounts or promotions',
    applicableCategories: ['all']
  },
  {
    id: 'quality',
    name: 'Quality',
    description: 'Material quality, construction, and durability',
    applicableCategories: ['all']
  },
  {
    id: 'features',
    name: 'Features',
    description: 'Additional features and functionality',
    applicableCategories: ['all']
  },
  {
    id: 'reviews',
    name: 'Customer Reviews',
    description: 'Overall rating and key feedback from verified purchasers',
    applicableCategories: ['all']
  },
  {
    id: 'value',
    name: 'Value',
    description: 'Price-to-quality ratio and long-term value',
    applicableCategories: ['all']
  }
];

export const POPULAR_SEARCHES: Record<string, string[]> = {
  'womens-clothing': ['summer dress', 'denim jacket', 'cashmere sweater', 'little black dress', 'leather boots'],
  'mens-clothing': ['oxford shirt', 'chinos', 'blazer', 'polo shirt', 'wool coat'],
  'shoes': ['white sneakers', 'ankle boots', 'running shoes', 'loafers', 'sandals'],
  'accessories': ['crossbody bag', 'smartwatch', 'sunglasses', 'leather wallet', 'scarf'],
  'electronics': ['wireless earbuds', 'smart speaker', 'laptop stand', 'portable charger', 'tablet'],
  'home': ['throw blanket', 'coffee maker', 'desk organizer', 'candle set', 'wall art'],
  'beauty': ['face moisturizer', 'hair dryer', 'perfume', 'makeup palette', 'skincare set'],
  'sports': ['running shoes', 'yoga mat', 'fitness tracker', 'water bottle', 'workout leggings']
};

export const CARE_SYMBOLS: Record<string, { symbol: string; meaning: string }> = {
  wash: {
    symbol: 'W',
    meaning: 'Machine washable. Number indicates max water temperature.'
  },
  dryClean: {
    symbol: 'D',
    meaning: 'Dry clean only.'
  },
  tumbleDry: {
    symbol: 'T',
    meaning: 'Tumble dry. Dots indicate heat level.'
  },
  iron: {
    symbol: 'I',
    meaning: 'Iron. Dots indicate max temperature.'
  },
  bleach: {
    symbol: 'B',
    meaning: 'Bleach when needed. Empty triangle = any bleach.'
  }
};
