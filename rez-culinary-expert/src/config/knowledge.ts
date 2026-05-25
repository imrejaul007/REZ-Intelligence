/**
 * Culinary Knowledge Base
 * Comprehensive food knowledge including cuisines, ingredients, allergens, and dietary tags
 */

// ============================================================================
// CUISINES
// ============================================================================

export const CUISINES = {
  ITALIAN: {
    name: 'Italian',
    aliases: ['italian', 'pasta', 'pizza', 'mediterranean'],
    keyIngredients: ['tomatoes', 'basil', 'olive oil', 'garlic', 'parmesan', 'pasta', 'risotto', 'prosciutto', 'mozzarella'],
    signatureDishes: ['Margherita pizza', 'Carbonara', 'Risotto alla Milanese', 'Osso Buco', 'Tiramisu'],
    cookingStyles: ['al dente', 'wood-fired', 'braised', 'fresh pasta', 'slow-cooked sauces'],
    commonAllergens: ['gluten', 'dairy'],
  },
  JAPANESE: {
    name: 'Japanese',
    aliases: ['japanese', 'sushi', 'ramen', 'tempura', 'teriyaki', 'japan'],
    keyIngredients: ['rice', 'soy sauce', 'miso', 'wasabi', 'nori', 'dashi', 'ramen', 'udon', 'soba'],
    signatureDishes: ['Sushi', 'Ramen', 'Tempura', 'Teriyaki', 'Katsu', 'Miso soup'],
    cookingStyles: ['raw', 'grilled', 'tempura-fried', 'simmered', 'steamed'],
    commonAllergens: ['shellfish', 'soy', 'gluten', 'fish'],
  },
  MEXICAN: {
    name: 'Mexican',
    aliases: ['mexican', 'tacos', 'burritos', 'enchiladas', 'mexico'],
    keyIngredients: ['corn', 'beans', 'chili', 'cilantro', 'lime', 'avocado', 'tortillas', 'cheese'],
    signatureDishes: ['Tacos al Pastor', 'Enchiladas', 'Guacamole', 'Mole', 'Pozole'],
    cookingStyles: ['grilled', 'smoky', 'spiced', 'fresh', 'slow-roasted'],
    commonAllergens: ['gluten', 'dairy'],
  },
  INDIAN: {
    name: 'Indian',
    aliases: ['indian', 'curry', 'tandoori', 'india', 'pakistani'],
    keyIngredients: ['curry', 'garam masala', 'turmeric', 'cumin', 'cardamom', 'basmati', ' ghee', 'dal'],
    signatureDishes: ['Butter Chicken', 'Biryani', 'Samosa', 'Palak Paneer', 'Tandoori Chicken'],
    cookingStyles: ['tandoor-cooked', 'curried', 'spiced', 'braised', 'tempered'],
    commonAllergens: ['dairy', 'gluten', 'tree nuts'],
  },
  FRENCH: {
    name: 'French',
    aliases: ['french', 'bistro', 'parisian', 'france'],
    keyIngredients: ['butter', 'wine', 'cream', 'herbs de provence', 'baguette', 'cheese', 'shallots'],
    signatureDishes: ['Coq au Vin', 'Bouillabaisse', 'Ratatouille', 'Croissant', 'Crème Brûlée'],
    cookingStyles: ['sautéed', 'braised', 'roasted', 'reduction sauces', 'pastry'],
    commonAllergens: ['dairy', 'gluten', 'tree nuts', 'eggs'],
  },
  THAI: {
    name: 'Thai',
    aliases: ['thai', 'thailand', 'siam'],
    keyIngredients: ['lemongrass', 'coconut milk', 'fish sauce', 'thai basil', 'galangal', 'pad thai', 'curry paste'],
    signatureDishes: ['Pad Thai', 'Green Curry', 'Tom Yum', 'Mango Sticky Rice', 'Som Tam'],
    cookingStyles: ['stir-fried', 'curried', 'fresh', 'grilled', 'soup-based'],
    commonAllergens: ['shellfish', 'fish', 'peanuts', 'soy'],
  },
  CHINESE: {
    name: 'Chinese',
    aliases: ['chinese', 'szechuan', 'cantonese', 'china', 'dim sum'],
    keyIngredients: ['soy sauce', 'ginger', 'scallions', 'five spice', 'rice', 'dim sum', 'dumplings'],
    signatureDishes: ['Kung Pao Chicken', 'Dim Sum', 'Peking Duck', 'Mapo Tofu', 'Chow Mein'],
    cookingStyles: ['stir-fried', 'steamed', 'braised', 'roasted', 'deep-fried'],
    commonAllergens: ['soy', 'gluten', 'shellfish'],
  },
  MEDITERRANEAN: {
    name: 'Mediterranean',
    aliases: ['mediterranean', 'greek', 'middle eastern', 'turkish', 'lebanese'],
    keyIngredients: ['olive oil', 'garlic', 'lemon', 'herbs', 'hummus', 'falafel', 'pita', 'feta'],
    signatureDishes: ['Hummus', 'Falafel', 'Greek Salad', 'Shawarma', 'Moussaka'],
    cookingStyles: ['grilled', 'fresh', 'marinated', 'roasted', 'mezze-style'],
    commonAllergers: ['gluten', 'dairy', 'tree nuts'],
  },
  AMERICAN: {
    name: 'American',
    aliases: ['american', 'usa', 'burger', 'bbq', 'southern'],
    keyIngredients: ['beef', 'bacon', 'cheese', 'bbq sauce', 'corn', 'potatoes', 'mac and cheese'],
    signatureDishes: ['Burgers', 'BBQ Ribs', 'Mac and Cheese', 'Hot Dogs', 'Apple Pie'],
    cookingStyles: ['grilled', 'smoked', 'fried', 'slow-cooked', 'baked'],
    commonAllergens: ['gluten', 'dairy', 'eggs'],
  },
  KOREAN: {
    name: 'Korean',
    aliases: ['korean', 'korea', 'bulgogi', 'kimchi', 'bibimbap'],
    keyIngredients: ['gochujang', 'kimchi', 'sesame', 'soy', 'bulgogi', 'rice', 'banchan'],
    signatureDishes: ['Bibimbap', 'Kimchi', 'Bulgogi', 'Japchae', 'Korean Fried Chicken'],
    cookingStyles: ['grilled', 'fermented', 'bibimbap-style', 'slow-cooked', 'spicy'],
    commonAllergens: ['soy', 'gluten', 'eggs', 'fish'],
  },
  VIETNAMESE: {
    name: 'Vietnamese',
    aliases: ['vietnamese', 'vietnam', 'pho', 'bahn mi'],
    keyIngredients: ['fish sauce', 'rice noodles', 'fresh herbs', 'lime', 'pho', 'bahn mi', 'vermicelli'],
    signatureDishes: ['Pho', 'Banh Mi', 'Spring Rolls', 'Bun Cha', 'Vietnamese Coffee'],
    cookingStyles: ['fresh', 'grilled', 'pho-based', 'light', 'herb-heavy'],
    commonAllergens: ['fish', 'soy', 'gluten', 'shellfish'],
  },
} as const;

// ============================================================================
// DIETARY TAGS
// ============================================================================

export const DIETARY_TAGS = {
  VEGETARIAN: {
    id: 'vegetarian',
    name: 'Vegetarian',
    description: 'No meat, poultry, or fish',
    excludes: ['meat', 'poultry', 'fish', 'seafood', 'meat broth', 'gelatin', 'rennet'],
    aliases: ['veg', 'vegetarian'],
  },
  VEGAN: {
    id: 'vegan',
    name: 'Vegan',
    description: 'No animal products of unknown kind',
    excludes: [
      'meat', 'poultry', 'fish', 'seafood', 'dairy', 'eggs', 'honey',
      'gelatin', 'rennet', 'lard', 'ghee', 'animal fats', 'isenglass'
    ],
    aliases: ['vegan', 'plant-based'],
  },
  GLUTEN_FREE: {
    id: 'gluten-free',
    name: 'Gluten-Free',
    description: 'No gluten-containing ingredients',
    excludes: ['wheat', 'barley', 'rye', 'triticale', 'semolina', 'spelt', 'kamut', 'bulgur', 'couscous'],
    aliases: ['gf', 'gluten free', 'gluten-free', 'coeliac-friendly'],
  },
  DAIRY_FREE: {
    id: 'dairy-free',
    name: 'Dairy-Free',
    description: 'No milk or milk products',
    excludes: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'whey', 'casein', 'lactose', 'ghee'],
    aliases: ['df', 'dairy free', 'lactose-free'],
  },
  NUT_FREE: {
    id: 'nut-free',
    name: 'Nut-Free',
    description: 'No tree nuts or peanuts',
    excludes: ['almonds', 'cashews', 'walnuts', 'pecans', 'pistachios', 'hazelnuts', 'macadamia', 'brazil nuts', 'pine nuts', 'peanuts'],
    aliases: ['nut free', 'nut-free', 'peanut-free'],
  },
  KETO: {
    id: 'keto',
    name: 'Keto-Friendly',
    description: 'Low carb, high fat diet',
    guidelines: { maxCarbs: 20, targetProtein: 'moderate', targetFat: 'high' },
    excludes: ['sugars', 'grains', 'starchy vegetables', 'high-carb fruits'],
    aliases: ['ketogenic', 'keto'],
  },
  PALEO: {
    id: 'paleo',
    name: 'Paleo',
    description: 'Whole foods like our ancestors ate',
    excludes: ['grains', 'legumes', 'dairy', 'processed foods', 'sugar', 'vegetable oils'],
    aliases: ['paleolithic', 'paleo'],
  },
  LOW_CARB: {
    id: 'low-carb',
    name: 'Low-Carb',
    description: 'Reduced carbohydrate intake',
    guidelines: { maxCarbs: 100 },
    excludes: ['bread', 'pasta', 'rice', 'sugary foods'],
    aliases: ['low carb', 'lowcarb'],
  },
  WHOLE30: {
    id: 'whole30',
    name: 'Whole30',
    description: '30-day elimination diet',
    excludes: ['sugar', 'alcohol', 'grains', 'legumes', 'soy', 'dairy', 'carrageenan', 'msg', 'sulfites'],
    aliases: ['whole 30', 'whole30'],
  },
  HALAL: {
    id: 'halal',
    name: 'Halal',
    description: 'Permitted under Islamic law',
    excludes: ['pork', 'alcohol', 'blood', 'carrion', 'non-Halal slaughtered animals'],
    aliases: ['halal', 'islamic'],
  },
  KOSHER: {
    id: 'kosher',
    name: 'Kosher',
    description: 'Prepared according to Jewish dietary laws',
    excludes: ['pork', 'shellfish', 'mixing meat and dairy', 'non-Kosher slaughtered animals'],
    aliases: ['kosher', 'glatt kosher'],
  },
} as const;

// ============================================================================
// MAJOR ALLERGENS (FDA Big 9)
// ============================================================================

export const MAJOR_ALLERGENS = {
  MILK: {
    id: 'milk',
    name: 'Milk',
    aliases: ['dairy', 'cheese', 'butter', 'cream', 'lactose', 'casein', 'whey', 'ghee', 'lactalbumin'],
    severity: 'common',
    crossReactivity: ['goat milk', 'sheep milk'],
  },
  EGGS: {
    id: 'eggs',
    name: 'Eggs',
    aliases: ['egg', 'mayonnaise', 'meringue', 'albumin', 'globulin', 'lysozyme', 'ovalbumin'],
    severity: 'common',
    crossReactivity: ['duck eggs', 'quail eggs'],
  },
  FISH: {
    id: 'fish',
    name: 'Fish',
    aliases: ['salmon', 'tuna', 'cod', 'halibut', 'anchovy', 'bass', 'fish sauce', 'worcestershire'],
    severity: 'common',
    notes: 'Different fish species can have different allergenic proteins',
  },
  SHELLFISH: {
    id: 'shellfish',
    name: 'Shellfish',
    subcategories: {
      crustaceans: ['shrimp', 'crab', 'lobster', 'crayfish', 'prawns'],
      mollusks: ['clams', 'mussels', 'oysters', 'scallops', 'squid', 'octopus', 'snails'],
    },
    aliases: ['shellfish', 'shrimp', 'crab', 'lobster', 'oysters', 'mussels', 'calamari'],
    severity: 'common',
  },
  TREE_NUTS: {
    id: 'tree-nuts',
    name: 'Tree Nuts',
    subcategories: ['almonds', 'cashews', 'walnuts', 'pecans', 'pistachios', 'hazelnuts', 'macadamia', 'brazil nuts', 'pine nuts'],
    aliases: ['nuts', 'almonds', 'cashews', 'walnuts', 'hazelnuts', 'pistachios', 'macadamia', 'brazil nuts', 'pine nuts', 'chestnuts'],
    severity: 'common',
    notes: 'Peanuts are NOT tree nuts but often grouped together',
  },
  PEANUTS: {
    id: 'peanuts',
    name: 'Peanuts',
    aliases: ['peanuts', 'ground nuts', 'monkey nuts', 'arachis oil'],
    severity: 'common',
    notes: 'Legume, not a tree nut. Can cause severe reactions.',
  },
  WHEAT: {
    id: 'wheat',
    name: 'Wheat',
    aliases: ['wheat', 'flour', 'semolina', 'spelt', 'kamut', 'triticale', 'bulgur', 'couscous', 'bread crumbs'],
    severity: 'common',
    notes: 'Different from celiac disease (gluten sensitivity)',
  },
  SOYBEANS: {
    id: 'soybeans',
    name: 'Soybeans',
    aliases: ['soy', 'soya', 'edamame', 'tofu', 'tempeh', 'miso', 'soy sauce', 'soy lecithin', 'vegetable protein'],
    severity: 'common',
  },
  SESAME: {
    id: 'sesame',
    name: 'Sesame',
    aliases: ['sesame', 'sesame seeds', 'tahini', 'halvah', 'sesame oil', 'hummus'],
    severity: 'common',
    notes: 'Added to Big 9 in 2023 FDA ruling',
  },
} as const;

// ============================================================================
// COMMON INGREDIENTS BY CATEGORY
// ============================================================================

export const INGREDIENT_CATEGORIES = {
  PROTEINS: {
    animal: ['chicken', 'beef', 'pork', 'lamb', 'turkey', 'duck', 'fish', 'salmon', 'tuna', 'cod', 'shrimp', 'lobster', 'crab', 'scallops'],
    vegetarian: ['tofu', 'tempeh', 'seitan', 'paneer', 'cottage cheese', 'halloumi', 'eggs'],
    legume: ['black beans', 'chickpeas', 'lentils', 'kidney beans', 'white beans', 'edamame'],
  },
  VEGETABLES: {
    leafy: ['spinach', 'kale', 'arugula', 'lettuce', 'cabbage', 'swiss chard', 'bok choy'],
    root: ['potato', 'sweet potato', 'carrot', 'beet', 'radish', 'turnip', 'parsnip'],
    allium: ['onion', 'garlic', 'leek', 'shallot', 'chive', 'scallion'],
    nightshade: ['tomato', 'eggplant', 'bell pepper', 'chili pepper'],
    cruciferous: ['broccoli', 'cauliflower', 'brussels sprouts', 'kohlrabi'],
    other: ['corn', 'peas', 'green beans', 'asparagus', 'zucchini', 'mushrooms', 'avocado'],
  },
  GRAINS: {
    common: ['rice', 'wheat', 'oats', 'barley', 'rye', 'quinoa', 'bulgur', 'couscous', 'farro'],
    glutenFree: ['rice', 'corn', 'quinoa', 'millet', 'buckwheat', 'amaranth', 'teff', 'sorghum'],
    pasta: ['spaghetti', 'penne', 'fettuccine', 'rigatoni', 'fusilli', 'ravioli', 'lasagna'],
  },
  FATS: {
    oils: ['olive oil', 'vegetable oil', 'canola oil', 'coconut oil', 'sesame oil', 'avocado oil', 'butter'],
    dairy: ['butter', 'cream', 'cheese', 'ghee'],
    other: ['avocado', 'coconut cream', 'nuts', 'seeds'],
  },
  SWEETENERS: {
    natural: ['sugar', 'honey', 'maple syrup', 'molasses', 'agave', 'stevia'],
    artificial: ['aspartame', 'sucralose', 'saccharin'],
  },
  HERBS: {
    mediterranean: ['basil', 'oregano', 'thyme', 'rosemary', 'sage', 'dill', 'parsley', 'cilantro'],
    asian: ['lemongrass', 'galangal', 'kaffir lime', 'Thai basil', 'mint', 'cilantro'],
    indian: ['cilantro', 'mint', 'curry leaves', 'fenugreek', 'asafoetida'],
  },
  SPICES: {
    warm: ['cinnamon', 'clove', 'nutmeg', 'cardamom', 'allspice', 'ginger'],
    savory: ['cumin', 'coriander', 'turmeric', 'paprika', 'chili', 'black pepper', 'white pepper'],
    aromatic: ['star anise', 'fennel seed', 'coriander', 'caraway', 'mustard seed'],
  },
  SAUCES: {
    asian: ['soy sauce', 'fish sauce', 'hoisin', 'oyster sauce', 'sriracha', 'gochujang', 'teriyaki'],
    italian: ['marinara', 'pesto', 'alfredo', 'bolognese', 'carbonara'],
    mexican: ['salsa', 'guacamole', 'mole', 'chipotle'],
    indian: ['curry', 'chutney', 'raita', 'achar'],
  },
} as const;

// ============================================================================
// FOOD PAIRINGS
// ============================================================================

export const PAIRING_GUIDE = {
  WINE: {
    lightWhite: ['chicken', 'fish', 'shellfish', 'vegetables', 'light pasta', 'risotto'],
    fullWhite: ['rich fish', 'poultry', 'cream sauces', 'soft cheeses'],
    lightRed: ['duck', 'lamb', 'grilled vegetables', 'mushroom dishes'],
    fullRed: ['beef', 'game', 'aged cheeses', 'rich tomato dishes'],
    rosé: ['salads', 'grilled fish', 'light pasta', 'appetizers', 'summer dishes'],
    sparkling: ['appetizers', 'seafood', 'fried foods', 'celebrations'],
  },
  BEER: {
    lager: ['burgers', 'fried foods', 'pizza', 'sandwiches'],
    ipa: ['spicy food', 'grilled meats', 'curry', 'Thai'],
    stout: ['beef', 'oysters', 'chocolate', 'smoked foods'],
    wheat: ['salads', 'seafood', 'light dishes', 'summer fare'],
    sour: ['fish', 'poultry', 'vinegary dishes', 'summer'],
  },
  COCKTAILS: {
    spiritForward: ['steak', 'rich dishes', 'bar food', 'charcuterie'],
    refreshing: ['seafood', 'salads', 'summer dishes', 'light fare'],
    sweet: ['desserts', 'spicy food', 'fruit dishes'],
  },
  NON_ALCOHOLIC: {
    sparklingWater: ['everything', 'clears palate'],
    juice: ['breakfast', 'fruit dishes', 'light meals'],
    tea: ['Asian cuisine', 'light meals', 'afternoon'],
    coffee: ['desserts', 'breakfast', 'rich dishes'],
  },
} as const;

// ============================================================================
// FLAVOR PROFILES
// ============================================================================

export const FLAVOR_PROFILES = {
  SAVORY: {
    name: 'Savory/Umami',
    description: 'Rich, savory, deeply satisfying flavors',
    associatedWith: ['soy sauce', 'mushrooms', 'tomatoes', 'aged cheeses', 'meat', 'fish sauce', 'miso'],
  },
  SPICY: {
    name: 'Spicy/Heat',
    description: 'Hot and fiery sensations',
    associatedWith: ['chili', 'jalapeño', 'serrano', 'habanero', 'cayenne', 'wasabi', 'ginger', 'black pepper'],
  },
  SWEET: {
    name: 'Sweet',
    description: 'Sugary, honeyed, caramelized flavors',
    associatedWith: ['honey', 'maple', 'caramel', 'fruit', 'sweet vegetables', 'glazes'],
  },
  SOUR: {
    name: 'Sour/Tangy',
    description: 'Bright, acidic, citrusy notes',
    associatedWith: ['lemon', 'lime', 'vinegar', 'tamarind', 'pickled items', 'cranberries'],
  },
  SMOKY: {
    name: 'Smoky',
    description: 'Charred, roasted, bbq notes',
    associatedWith: ['grilled', 'smoked meats', 'chipotle', 'char', 'paprika', 'bacon'],
  },
  FRESH: {
    name: 'Fresh/Herbaceous',
    description: 'Light, bright, garden-fresh flavors',
    associatedWith: ['herbs', 'citrus zest', 'cucumber', 'melon', 'raw fish', 'light salads'],
  },
  RICH: {
    name: 'Rich/Creamy',
    description: 'Indulgent, buttery, creamy textures',
    associatedWith: ['butter', 'cream', 'cheese', 'bacon', 'nuts', 'chocolate', 'caramel'],
  },
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a cuisine matches user input
 */
export function matchCuisine(input: string): typeof CUISINES[keyof typeof CUISINES] | null {
  const normalizedInput = input.toLowerCase().trim();

  for (const cuisine of Object.values(CUISINES)) {
    if (cuisine.aliases.some(alias => normalizedInput.includes(alias))) {
      return cuisine;
    }
  }

  return null;
}

/**
 * Check if a dietary tag matches user input
 */
export function matchDietaryTag(input: string): typeof DIETARY_TAGS[keyof typeof DIETARY_TAGS] | null {
  const normalizedInput = input.toLowerCase().trim();

  for (const tag of Object.values(DIETARY_TAGS)) {
    if (tag.aliases.some(alias => normalizedInput.includes(alias))) {
      return tag;
    }
  }

  return null;
}

/**
 * Check if a string contains an allergen
 */
export function containsAllergen(text: string): string[] {
  const normalizedText = text.toLowerCase();
  const found: string[] = [];

  for (const allergen of Object.values(MAJOR_ALLERGENS)) {
    if (allergen.aliases.some(alias => normalizedText.includes(alias))) {
      found.push(allergen.id);
    }
  }

  return found;
}

/**
 * Get ingredients by category
 */
export function getIngredientsByCategory(category: keyof typeof INGREDIENT_CATEGORIES): string[] {
  const cat = INGREDIENT_CATEGORIES[category];
  return Object.values(cat).flat();
}

// Type exports
export type Cuisine = keyof typeof CUISINES;
export type DietaryTag = keyof typeof DIETARY_TAGS;
export type Allergen = keyof typeof MAJOR_ALLERGENS;
export type IngredientCategory = keyof typeof INGREDIENT_CATEGORIES;
export type FlavorProfile = keyof typeof FLAVOR_PROFILES;
