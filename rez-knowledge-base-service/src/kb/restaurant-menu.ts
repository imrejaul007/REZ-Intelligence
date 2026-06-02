/**
 * Restaurant Menu Knowledge Base
 * Handles all restaurant menu related intents, entities, and responses
 * Includes dietary information, allergens, cuisine types, and food pairings
 */

export interface DietaryInfo {
  id: string;
  name: string;
  keywords: string[];
  avoid: string[];
  icon: string;
  description?: string;
}

export interface AllergenInfo {
  id: string;
  name: string;
  keywords: string[];
  icon: string;
  severity: 'common' | 'moderate' | 'rare';
  hiddenIn?: string[];
}

export interface CuisineType {
  id: string;
  name: string;
  keywords: string[];
  signatureDishes: string[];
  commonIngredients: string[];
}

export interface FoodPairing {
  dishType: string;
  keywords: string[];
  winePairing?: string[];
  beerPairing?: string[];
  cocktailPairing?: string[];
  nonAlcoholicPairing?: string[];
  avoid?: string[];
}

export interface CommonQuestion {
  id: string;
  keywords: string[];
  response: string;
  followUp?: string[];
}

export interface SpiceLevel {
  level: number;
  name: string;
  keywords: string[];
  description: string;
  icon: string;
}

export interface RestaurantMenuKB {
  dietary: {
    info: DietaryInfo[];
    responses: {
      vegetarianNote: string;
      veganNote: string;
      glutenFreeNote: string;
      ketoNote: string;
      jainNote: string;
      halalNote: string;
      customRequest: string;
    };
  };

  allergens: {
    info: AllergenInfo[];
    responses: {
      crossContamination: string;
      allergenFreeRequest: string;
      severityLevels: string;
    };
  };

  cuisineTypes: {
    types: CuisineType[];
    responses: {
      cuisineDescription: string;
      fusionOption: string;
      regionalVariations: string;
    };
  };

  pairings: {
    wine: { [dishType: string]: string };
    beer: { [dishType: string]: string };
    cocktail: { [dishType: string]: string };
    nonAlcoholic: { [dishType: string]: string };
    food: { [dishType: string]: string };
  };

  spiceLevels: SpiceLevel[];

  commonQuestions: CommonQuestion[];

  intents: {
    greetings: string[];
    ordering: string[];
    dietary: string[];
    complaints: string[];
    modifications: string[];
    inquiries: string[];
    payment: string[];
    reservation: string[];
  };

  responses: {
    greeting: string;
    menuInquiry: string;
    dietaryHelp: string;
    orderConfirmation: string;
    notUnderstood: string;
    specialRequests: string;
  };

  contextSlots: {
    itemRequested: boolean;
    quantity: boolean;
    modifications: boolean;
    dietaryRestrictions: boolean;
    allergies: boolean;
    spiceLevel: boolean;
    preferredTime: boolean;
    diningOption: boolean;
  };
}

// ====== DIETARY INFORMATION ======
const dietaryInfo: DietaryInfo[] = [
  {
    id: 'vegetarian',
    name: 'Vegetarian',
    keywords: ['vegetarian', 'veg', 'no meat', 'no chicken', 'no fish', 'no seafood', 'plant based', 'herbi', 'no egg'],
    avoid: ['meat', 'chicken', 'fish', 'seafood', 'prawn', 'shrimp', 'mutton', 'beef', 'pork', 'lamb'],
    icon: '🥬',
    description: 'No meat, fish, or poultry. May include eggs and dairy.'
  },
  {
    id: 'vegan',
    name: 'Vegan',
    keywords: ['vegan', 'plant based', 'no animal', 'dairy free', 'egg free', 'no eggs', 'no dairy', 'pure veg'],
    avoid: ['meat', 'dairy', 'egg', 'honey', 'gelatin', 'lard', 'ghee', 'butter', 'cream', 'cheese', 'milk', 'yogurt', 'whey'],
    icon: '🌱',
    description: 'No animal products including meat, dairy, eggs, and honey.'
  },
  {
    id: 'gluten_free',
    name: 'Gluten-Free',
    keywords: ['gluten free', 'gf', 'celiac', 'no gluten', 'wheat free', 'gluten-free'],
    avoid: ['wheat', 'barley', 'rye', 'bread', 'pasta', 'noodles', 'couscous', 'semolina', 'spelled', 'triticale'],
    icon: '🌾',
    description: 'Avoids gluten-containing grains. Suitable for celiac disease.'
  },
  {
    id: 'keto',
    name: 'Keto',
    keywords: ['keto', 'ketogenic', 'low carb', 'lowcarb', 'atkins'],
    avoid: ['bread', 'rice', 'pasta', 'sugar', 'potato', 'corn', 'beans', 'fruits high in sugar'],
    icon: '🥑',
    description: 'High fat, low carb diet. Emphasizes meat, fish, eggs, cheese, and low-carb vegetables.'
  },
  {
    id: 'jain',
    name: 'Jain',
    keywords: ['jain', 'jain food', 'no onion', 'no garlic', 'sattvic'],
    avoid: ['onion', 'garlic', 'potato', 'eggplant', 'carrot', 'radish', ' mushrooms', 'beans', 'lentils', 'meat', 'eggs'],
    icon: '🕉️',
    description: 'No root vegetables, onions, garlic, eggs. Strict vegetarianism.'
  },
  {
    id: 'halal',
    name: 'Halal',
    keywords: ['halal', 'halal food', 'islamic', 'muslim'],
    avoid: ['pork', 'alcohol', 'blood', 'carrion', 'unslaughtered animals', 'gelatin from non-halal sources'],
    icon: '☪️',
    description: 'Food prepared according to Islamic law. No pork or alcohol-based ingredients.'
  },
  {
    id: 'kosher',
    name: 'Kosher',
    keywords: ['kosher', 'kosher food', 'jewish'],
    avoid: ['pork', 'shellfish', 'mixing dairy and meat', 'unslaughtered animals'],
    icon: '✡️',
    description: 'Prepared according to Jewish dietary laws.'
  },
  {
    id: 'nut_free',
    name: 'Nut-Free',
    keywords: ['nut free', 'nut-free', 'no nuts', 'peanut allergy', 'tree nut allergy'],
    avoid: ['peanut', 'almond', 'cashew', 'walnut', 'pistachio', 'hazelnut', 'brazil nut', 'macadamia', 'pecan'],
    icon: '🚫',
    description: 'Avoids all tree nuts and peanuts.'
  },
  {
    id: 'low_sodium',
    name: 'Low Sodium',
    keywords: ['low sodium', 'low salt', 'reduced sodium', 'no added salt'],
    avoid: ['soy sauce', ' MSG', 'pickles', 'cured meats', 'excess salt'],
    icon: '🧂',
    description: 'Reduced salt content. Suitable for those monitoring sodium intake.'
  },
  {
    id: 'diabetic',
    name: 'Diabetic-Friendly',
    keywords: ['diabetic', 'diabetes', 'sugar free', 'sugar-free', 'low sugar', 'low glycemic'],
    avoid: ['sugar', 'sweet', 'candy', 'desserts with sugar', 'white bread', 'white rice'],
    icon: '📊',
    description: 'Low glycemic index foods with controlled sugar content.'
  }
];

// ====== ALLERGEN INFORMATION ======
const allergenInfo: AllergenInfo[] = [
  {
    id: 'milk',
    name: 'Milk/Dairy',
    keywords: ['dairy', 'lactose', 'casein', 'whey', 'milk', 'cheese', 'cream', 'butter', 'yogurt', 'ghee'],
    icon: '🥛',
    severity: 'common',
    hiddenIn: ['bread', 'battered foods', 'cereal', 'sauces', 'salad dressings', 'soups', 'processed meats']
  },
  {
    id: 'eggs',
    name: 'Eggs',
    keywords: ['egg', 'eggs', 'mayonnaise', 'meringue', 'aioli', 'custard', 'hollandaise'],
    icon: '🥚',
    severity: 'common',
    hiddenIn: ['bread', 'battered foods', 'pasta', 'mayonnaise', 'sauces', 'battered meats']
  },
  {
    id: 'peanuts',
    name: 'Peanuts',
    keywords: ['peanut', 'groundnut', 'ground nut', 'arachis oil'],
    icon: '🥜',
    severity: 'common',
    hiddenIn: ['curries', 'sauces', 'baked goods', 'sweets', 'ethnic cuisines']
  },
  {
    id: 'tree_nuts',
    name: 'Tree Nuts',
    keywords: ['almond', 'cashew', 'walnut', 'pecan', 'pistachio', 'hazelnut', 'macadamia', 'brazil nut', 'chestnut'],
    icon: '🌰',
    severity: 'common',
    hiddenIn: ['curries', 'sauces', 'baked goods', 'pesto', 'marzipan', 'praline']
  },
  {
    id: 'shellfish',
    name: 'Shellfish',
    keywords: ['shrimp', 'crab', 'lobster', 'prawn', 'scallop', 'clam', 'mussel', 'oyster', 'squid', 'calamari'],
    icon: '🦐',
    severity: 'moderate',
    hiddenIn: ['sauces', 'stocks', 'appetizers', 'fried foods', 'paella']
  },
  {
    id: 'fish',
    name: 'Fish',
    keywords: ['fish', 'salmon', 'tuna', 'cod', 'tilapia', 'anchovy', 'sardine', 'mackerel', 'trout', 'bass'],
    icon: '🐟',
    severity: 'moderate',
    hiddenIn: ['sauces', 'stocks', 'Worcestershire sauce', 'Caesar dressing', 'omega-3 supplements']
  },
  {
    id: 'soy',
    name: 'Soy',
    keywords: ['soy', 'soya', 'tofu', 'edamame', 'tempeh', 'miso', 'tamari', 'soy sauce'],
    icon: '🫘',
    severity: 'moderate',
    hiddenIn: ['sauces', 'oils', 'processed foods', 'baked goods', 'vegetarian products']
  },
  {
    id: 'wheat',
    name: 'Wheat/Gluten',
    keywords: ['wheat', 'gluten', 'flour', 'bread', 'pasta', 'couscous', 'semolina', 'spelled'],
    icon: '🌾',
    severity: 'common',
    hiddenIn: ['sauces', 'soups', 'processed meats', 'soy sauce', 'breaded foods']
  },
  {
    id: 'sesame',
    name: 'Sesame',
    keywords: ['sesame', 'tahini', 'halvah', 'hummus', 'oil', 'seeds'],
    icon: '🌱',
    severity: 'moderate',
    hiddenIn: ['sauces', 'bread', 'hummus', 'tahini', ' ethnic dishes']
  },
  {
    id: 'mustard',
    name: 'Mustard',
    keywords: ['mustard', 'mustard seed', 'mustard powder'],
    icon: '🟡',
    severity: 'rare',
    hiddenIn: ['curries', 'sauces', 'pickles', 'processed meats', 'condiments']
  },
  {
    id: 'celery',
    name: 'Celery',
    keywords: ['celery', 'celeriac', 'celery salt', 'celery seed'],
    icon: '🥬',
    severity: 'rare',
    hiddenIn: ['soups', 'stocks', 'salads', 'seasonings', 'processed meats']
  },
  {
    id: 'mollusks',
    name: 'Mollusks',
    keywords: ['mollusk', 'molluscs', 'snail', 'escargot', 'squid', 'octopus'],
    icon: '🐌',
    severity: 'rare',
    hiddenIn: ['stocks', 'sauces', 'appetizers']
  }
];

// ====== CUISINE TYPES ======
const cuisineTypes: CuisineType[] = [
  {
    id: 'indian',
    name: 'Indian',
    keywords: ['indian', 'north indian', 'south indian', 'curry', 'masala'],
    signatureDishes: ['biryani', 'butter chicken', 'palak paneer', 'dosa', 'idli', 'dal makhani', 'naan', 'samosa', 'tandoori', 'paneer'],
    commonIngredients: ['turmeric', 'cumin', 'coriander', 'ginger', 'garlic', 'chili', 'ghee', 'yogurt', 'cream', 'spices']
  },
  {
    id: 'chinese',
    name: 'Chinese',
    keywords: ['chinese', 'szechuan', 'cantonese', 'hunan'],
    signatureDishes: ['dim sum', 'kung pao chicken', 'sweet and sour', 'chow mein', 'fried rice', 'spring rolls', 'wonton', 'dumplings', 'hot pot'],
    commonIngredients: ['soy sauce', 'ginger', 'garlic', 'scallion', 'rice', 'noodles', 'sesame oil']
  },
  {
    id: 'italian',
    name: 'Italian',
    keywords: ['italian', 'pizza', 'pasta', 'mediterranean'],
    signatureDishes: ['pizza', 'pasta', 'risotto', 'gelato', 'tiramisu', 'lasagna', 'bruschetta', 'minestrone'],
    commonIngredients: ['tomato', 'olive oil', 'basil', 'oregano', 'garlic', 'parmesan', 'mozzarella', 'pasta', 'wine']
  },
  {
    id: 'mexican',
    name: 'Mexican',
    keywords: ['mexican', 'tex-mex', 'taco', 'burrito'],
    signatureDishes: ['tacos', 'burritos', 'quesadilla', 'enchiladas', 'nachos', 'guacamole', 'salsa', 'guacamole', 'churros'],
    commonIngredients: ['tortilla', 'beans', 'rice', 'chili', 'avocado', 'lime', 'cilantro', 'cheese', 'sour cream']
  },
  {
    id: 'thai',
    name: 'Thai',
    keywords: ['thai', 'thailand', 'pad thai'],
    signatureDishes: ['pad thai', 'tom yum', 'green curry', 'massaman curry', 'som tam', 'pad see ew', 'mango sticky rice'],
    commonIngredients: ['lemongrass', 'galangal', 'coconut milk', 'fish sauce', 'lime', 'thai basil', 'chili', 'tamarind']
  },
  {
    id: 'japanese',
    name: 'Japanese',
    keywords: ['japanese', 'sushi', 'sashimi', 'japan'],
    signatureDishes: ['sushi', 'sashimi', 'ramen', 'udon', 'tempura', 'teriyaki', 'miso soup', 'gyoza', 'tonkatsu'],
    commonIngredients: ['rice', 'soy sauce', 'miso', 'dashi', 'nori', 'wasabi', 'ginger', 'sesame']
  },
  {
    id: 'american',
    name: 'American',
    keywords: ['american', 'usa', 'burger', 'bbq', 'grill'],
    signatureDishes: ['burger', 'steak', 'bbq ribs', 'fried chicken', 'hot dog', 'mac and cheese', ' Reuben', 'buffalo wings'],
    commonIngredients: ['beef', 'bacon', 'cheese', 'potato', 'corn', 'bbq sauce', 'mayonnaise', 'pickles']
  },
  {
    id: 'mediterranean',
    name: 'Mediterranean',
    keywords: ['mediterranean', 'greek', 'middle eastern', 'lebanese'],
    signatureDishes: ['hummus', 'falafel', 'shawarma', 'gyro', 'tzatziki', 'tabbouleh', 'falafel', 'kofta', 'dolma'],
    commonIngredients: ['olive oil', 'chickpeas', 'lamb', 'yogurt', 'garlic', 'lemon', 'herbs', 'pita']
  },
  {
    id: 'french',
    name: 'French',
    keywords: ['french', 'france', 'bistro'],
    signatureDishes: ['croissant', 'coq au vin', 'beef bourguignon', 'ratatouille', 'soupe a loignon', 'crepe', 'quiche', 'souffle'],
    commonIngredients: ['butter', 'cream', 'wine', 'herbs de provence', 'baguette', 'cheese', 'shallots']
  },
  {
    id: 'korean',
    name: 'Korean',
    keywords: ['korean', 'korea', 'korean bbq', 'bulgogi'],
    signatureDishes: ['bibimbap', 'bulgogi', 'kimchi', 'ramyeon', 'tteokbokki', 'korean bbq', 'japchae', 'banchan'],
    commonIngredients: ['gochujang', 'soy sauce', 'sesame oil', 'garlic', 'ginger', 'kimchi', 'rice', 'noodles']
  }
];

// ====== SPICE LEVELS ======
const spiceLevels: SpiceLevel[] = [
  { level: 0, name: 'No Spice', keywords: ['no spice', 'mild', 'no chili', 'no pepper', 'kid friendly'], description: 'No heat added. Suitable for children or those who prefer no spice.', icon: '🌶️' },
  { level: 1, name: 'Mild', keywords: ['mild', 'low spice', 'slight heat', 'little spice', 'less chili'], description: 'Subtle warmth with minimal heat.', icon: '🫑' },
  { level: 2, name: 'Medium', keywords: ['medium', 'regular', 'normal spice', 'standard'], description: 'Noticeable warmth without being overwhelming.', icon: '🌶️' },
  { level: 3, name: 'Hot', keywords: ['hot', 'spicy', 'extra spice', 'high heat', 'more chili'], description: 'Strong heat that builds gradually.', icon: '🔥' },
  { level: 4, name: 'Very Hot', keywords: ['very hot', 'very spicy', 'extra hot', 'maximum spice'], description: 'Intense heat for spice lovers.', icon: '💥' },
  { level: 5, name: 'Extremely Hot', keywords: ['extremely hot', 'extra extremely', 'challenge', 'death', 'extreme'], description: 'Maximum heat. Not for the faint-hearted!', icon: '☠️' }
];

// ====== FOOD PAIRINGS ======
const pairings = {
  wine: {
    'biryani': 'Chardonnay or Shiraz - The aromatic rice dish pairs well with both white and bold red wines.',
    'pasta_white_sauce': 'Pinot Grigio or Chardonnay - The acidity cuts through the cream.',
    'pasta_red_sauce': 'Chianti or Sangiovese - Tomato-based sauces love acidic reds.',
    'pizza': 'Chianti or Pinot Noir - Classic Italian wine pairs perfectly.',
    'salad': 'Sauvignon Blanc - Crisp and refreshing with fresh greens.',
    'grilled_meat': 'Cabernet Sauvignon or Malbec - Bold reds complement charred flavors.',
    'seafood': 'Pinot Grigio or Sauvignon Blanc - Light wines enhance delicate fish.',
    'curry': 'Riesling or Gewurztraminer - Off-dry wines balance spicy dishes.',
    'chinese': 'Pinot Gris or Riesling - Complements umami and ginger flavors.',
    'dessert': 'Port or Moscato - Sweet wines match sweet dishes.',
    'cheese': 'Merlot or Tempranillo - Medium-bodied reds work with most cheeses.'
  },
  beer: {
    'spicy_food': 'IPA or Wheat beer - Hop bitterness and effervescence cool the heat.',
    'grilled_meat': 'Amber Ale or Lager - Malty sweetness balances charred flavors.',
    'fried_food': 'Pilsner or Lager - Crisp and refreshing, cuts through grease.',
    'salad': 'Pale Ale or Wheat beer - Light beers do not overwhelm fresh flavors.',
    'indian_food': 'IPA or Golden Ale - Bold flavors stand up to spice.',
    'pizza': 'Pale Ale or Italian Lager - Easy-drinking and complementary.',
    'seafood': 'Pilsner or Wheat beer - Light and citrusy with shellfish.'
  },
  cocktail: {
    'grilled_meat': 'Whiskey Sour or Old Fashioned - Bold spirits match rich proteins.',
    'spicy_food': 'Margarita or Mai Tai - Citrus and rum cool the palate.',
    'seafood': 'Mojito or Gin & Tonic - Herbaceous notes complement fish.',
    'asian_cuisine': 'Sake or lychee martini - Subtle sweetness with umami.',
    'summer_dishes': 'Mojito or Aperol Spritz - Refreshing and light.'
  },
  nonAlcoholic: {
    'spicy_food': 'Lassi or Buttermilk - Dairy cools the heat. Mango lassi is a classic.',
    'grilled_meat': 'Iced tea or Lemonade - Refreshing alternatives.',
    'indian_food': 'Mango lassi, nimbu pani, or rose sharbat.',
    'chinese_food': 'Jasmine tea or chrysanthemum tea.',
    'breakfast': 'Fresh juice, coffee, or chai.',
    'dessert': 'Coffee, espresso, or masala chai.'
  },
  food: {
    'biryani': 'Raita, mirchi ka salan, or cucumber salad to balance the richness.',
    'curry': 'Naan bread, rice, or papad for scooping and cooling.',
    'pizza': 'Garlic bread, caesar salad, or tiramisu for dessert.',
    'burger': 'French fries, onion rings, or coleslaw.',
    'pasta': 'Garlic bread, caesar salad, or bruschetta.',
    'sushi': 'Miso soup, edamame, or gyoza dumplings.'
  }
};

// ====== COMMON QUESTIONS ======
const commonQuestions: CommonQuestion[] = [
  {
    id: 'spice_level',
    keywords: ['spicy', 'spice', 'heat', 'chili', 'how hot', 'spice level'],
    response: 'Our dishes range from no spice to extremely spicy. You can customize the spice level from 0 (no spice) to 5 (extremely hot) when ordering. Just let us know your preference!',
    followUp: ['mild', 'medium', 'hot', 'very hot']
  },
  {
    id: 'waiting_time',
    keywords: ['wait', 'waiting', 'time', 'long', 'how long', 'delivery time', 'preparation'],
    response: 'Typical preparation time is 15-25 minutes for main dishes and 5-10 minutes for appetizers. During peak hours, it may take a little longer. We always aim to serve you fresh and fast!',
    followUp: ['rush', 'quick', 'faster']
  },
  {
    id: 'portion_size',
    keywords: ['portion', 'size', 'how much', 'serving', 'big', 'small', 'enough', 'hungry'],
    response: 'Our portions are generous and designed to satisfy. Main courses are suitable for one person with normal appetite. If you are very hungry or sharing, consider adding appetizers or sides.',
    followUp: ['extra', 'more', 'bigger']
  },
  {
    id: 'vegetarian_options',
    keywords: ['vegetarian', 'veg', 'veg food', 'no meat', 'meatless'],
    response: 'We have extensive vegetarian options! Look for items marked with the leaf icon. Our vegetarian specialties include paneer dishes, vegetable curries, pasta, pizzas, and more.',
    followUp: ['recommend', 'best vegetarian']
  },
  {
    id: 'vegan_options',
    keywords: ['vegan', 'plant based', 'no dairy', 'no animal'],
    response: 'We can accommodate vegan requests! Our vegan options include many appetizers, salads, and some main courses. Please let us know your dietary requirements and we will customize your order.',
    followUp: ['what is vegan', 'recommend vegan']
  },
  {
    id: 'gluten_free_options',
    keywords: ['gluten free', 'gf', 'no wheat', 'celiac'],
    response: 'We offer gluten-free options including grilled proteins, salads, rice dishes, and some curries. Please inform us of your allergy so we can ensure no cross-contamination.',
    followUp: ['is this gluten free', 'safe for celiac']
  },
  {
    id: 'customization',
    keywords: ['customize', 'special', 'request', 'modify', 'change', 'without', 'extra'],
    response: 'We are happy to accommodate special requests! You can ask for items without certain ingredients, extra portions, different cooking styles, or any other modifications. Just let us know!',
    followUp: ['no onion', 'extra spicy', 'less oil']
  },
  {
    id: 'allergen_info',
    keywords: ['allergy', 'allergic', 'allergen', 'intolerance', 'sensitive'],
    response: 'Please inform us of any allergies. Our staff is trained to handle allergen concerns and can provide ingredient lists. While we take precautions, please note that cross-contamination is possible in our kitchen.',
    followUp: ['nuts', 'dairy', 'gluten']
  },
  {
    id: 'best_seller',
    keywords: ['best', 'popular', 'recommend', 'signature', 'most ordered', 'famous'],
    response: 'Our most popular dishes include [based on your preference, we will recommend]. Ask our staff for today special recommendations!',
    followUp: ['chicken', 'vegetarian', 'seafood']
  },
  {
    id: 'dining_options',
    keywords: ['dine in', 'takeaway', 'delivery', 'take out', 'home delivery', 'eat here'],
    response: 'We offer dine-in service at our restaurant, takeaway for you to enjoy elsewhere, and home delivery within our delivery radius. Choose your preferred option when ordering!',
    followUp: ['delivery area', 'delivery charge', 'takeaway packaging']
  }
];

// ====== COMPLETE RESTAURANT MENU KB ======
export const restaurantMenuKB: RestaurantMenuKB = {
  dietary: {
    info: dietaryInfo,
    responses: {
      vegetarianNote: 'Our vegetarian dishes are marked with a leaf icon. These contain no meat, fish, or poultry. Some may contain eggs or dairy - please check the menu or ask your server.',
      veganNote: 'Our vegan options avoid all animal products. Please inform us when ordering so we can ensure no dairy, eggs, honey, or animal-derived ingredients are used.',
      glutenFreeNote: 'We have gluten-free options available. Please inform us of your dietary needs so we can avoid cross-contamination and recommend safe choices.',
      ketoNote: 'Our keto-friendly options include grilled proteins, salads without croutons, and low-carb sides. Avoid bread, rice, pasta, and sugary items.',
      jainNote: 'We can prepare Jain-friendly meals with no root vegetables (onion, garlic, potato), no eggs, and no legumes. Please request this when ordering.',
      halalNote: 'Our halal-certified items are marked with a crescent symbol. All chicken and lamb are halal-sourced. Please inform us of any dietary requirements.',
      customRequest: 'We accommodate most dietary requirements. Please speak with our staff about your specific needs and we will do our best to accommodate you.'
    }
  },

  allergens: {
    info: allergenInfo,
    responses: {
      crossContamination: 'While we take precautions, our kitchen handles common allergens. Cross-contamination is possible. Please inform us of severe allergies so we can take extra care.',
      allergenFreeRequest: 'Please inform us of any allergens before ordering. We can often modify recipes or suggest safe alternatives.',
      severityLevels: 'Common allergens (milk, eggs, wheat, peanuts, tree nuts) may cause severe reactions. Please disclose all allergies and sensitivities.'
    }
  },

  cuisineTypes: {
    types: cuisineTypes,
    responses: {
      cuisineDescription: 'Our menu features authentic [cuisine type] cuisine prepared with traditional recipes and fresh ingredients imported from [region].',
      fusionOption: 'We also offer fusion options that combine [cuisine type] flavors with local tastes for a unique dining experience.',
      regionalVariations: 'We serve regional specialties from various parts of [country]. Ask your server for recommendations based on your preferences.'
    }
  },

  pairings: pairings,

  spiceLevels: spiceLevels,

  commonQuestions: commonQuestions,

  intents: {
    greetings: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'welcome', 'what is good', 'recommend'],
    ordering: ['order', 'want', 'need', 'have', 'get me', 'i would like', 'can i have', 'please', 'serve', 'offer'],
    dietary: ['vegetarian', 'vegan', 'gluten free', 'allergy', 'diet', 'intolerance', 'halal', 'kosher', 'jain', 'religious', 'cannot eat'],
    complaints: ['not fresh', 'cold', 'undercooked', 'overcooked', 'wrong order', 'missing', 'bad', 'disappointed'],
    modifications: ['without', 'no', 'extra', 'more', 'less', 'modify', 'change', 'substitute', 'instead'],
    inquiries: ['what', 'which', 'how', 'is there', 'do you have', 'tell me', 'explain', 'ingredients'],
    payment: ['pay', 'price', 'cost', 'bill', 'cash', 'card', 'upi', 'offer', 'discount', 'deal'],
    reservation: ['reserve', 'booking', 'table', 'reservation', 'seating', 'party', 'celebration']
  },

  responses: {
    greeting: 'Hello! Welcome to our restaurant. I am here to help you navigate our menu, answer questions about dishes, accommodate dietary needs, and take your order. What would you like today?',
    menuInquiry: 'Our menu features a variety of dishes including appetizers, main courses, sides, and desserts. Would you like recommendations or do you have specific preferences?',
    dietaryHelp: 'We accommodate various dietary requirements including vegetarian, vegan, gluten-free, Jain, and halal. Please let us know your dietary needs and we will suggest suitable options.',
    orderConfirmation: 'I have noted your order. Let me confirm: [repeat order]. Is there anything else you would like to add? Any modifications to these items?',
    notUnderstood: 'I am not quite sure I understood that. Could you please rephrase? Are you looking for recommendations, do you have dietary requirements, or would you like to place an order?',
    specialRequests: 'We are happy to accommodate special requests! Whether it is adjusting spice levels, omitting certain ingredients, or preparing something special, just let us know.'
  },

  contextSlots: {
    itemRequested: true,
    quantity: true,
    modifications: true,
    dietaryRestrictions: true,
    allergies: true,
    spiceLevel: true,
    preferredTime: true,
    diningOption: true
  }
};

export default restaurantMenuKB;
