/**
 * Culinary Knowledge Base
 * Comprehensive food knowledge including cuisines, ingredients, allergens, and dietary tags
 */
export declare const CUISINES: {
    readonly ITALIAN: {
        readonly name: "Italian";
        readonly aliases: readonly ["italian", "pasta", "pizza", "mediterranean"];
        readonly keyIngredients: readonly ["tomatoes", "basil", "olive oil", "garlic", "parmesan", "pasta", "risotto", "prosciutto", "mozzarella"];
        readonly signatureDishes: readonly ["Margherita pizza", "Carbonara", "Risotto alla Milanese", "Osso Buco", "Tiramisu"];
        readonly cookingStyles: readonly ["al dente", "wood-fired", "braised", "fresh pasta", "slow-cooked sauces"];
        readonly commonAllergens: readonly ["gluten", "dairy"];
    };
    readonly JAPANESE: {
        readonly name: "Japanese";
        readonly aliases: readonly ["japanese", "sushi", "ramen", "tempura", "teriyaki", "japan"];
        readonly keyIngredients: readonly ["rice", "soy sauce", "miso", "wasabi", "nori", "dashi", "ramen", "udon", "soba"];
        readonly signatureDishes: readonly ["Sushi", "Ramen", "Tempura", "Teriyaki", "Katsu", "Miso soup"];
        readonly cookingStyles: readonly ["raw", "grilled", "tempura-fried", "simmered", "steamed"];
        readonly commonAllergens: readonly ["shellfish", "soy", "gluten", "fish"];
    };
    readonly MEXICAN: {
        readonly name: "Mexican";
        readonly aliases: readonly ["mexican", "tacos", "burritos", "enchiladas", "mexico"];
        readonly keyIngredients: readonly ["corn", "beans", "chili", "cilantro", "lime", "avocado", "tortillas", "cheese"];
        readonly signatureDishes: readonly ["Tacos al Pastor", "Enchiladas", "Guacamole", "Mole", "Pozole"];
        readonly cookingStyles: readonly ["grilled", "smoky", "spiced", "fresh", "slow-roasted"];
        readonly commonAllergens: readonly ["gluten", "dairy"];
    };
    readonly INDIAN: {
        readonly name: "Indian";
        readonly aliases: readonly ["indian", "curry", "tandoori", "india", "pakistani"];
        readonly keyIngredients: readonly ["curry", "garam masala", "turmeric", "cumin", "cardamom", "basmati", " ghee", "dal"];
        readonly signatureDishes: readonly ["Butter Chicken", "Biryani", "Samosa", "Palak Paneer", "Tandoori Chicken"];
        readonly cookingStyles: readonly ["tandoor-cooked", "curried", "spiced", "braised", "tempered"];
        readonly commonAllergens: readonly ["dairy", "gluten", "tree nuts"];
    };
    readonly FRENCH: {
        readonly name: "French";
        readonly aliases: readonly ["french", "bistro", "parisian", "france"];
        readonly keyIngredients: readonly ["butter", "wine", "cream", "herbs de provence", "baguette", "cheese", "shallots"];
        readonly signatureDishes: readonly ["Coq au Vin", "Bouillabaisse", "Ratatouille", "Croissant", "Crème Brûlée"];
        readonly cookingStyles: readonly ["sautéed", "braised", "roasted", "reduction sauces", "pastry"];
        readonly commonAllergens: readonly ["dairy", "gluten", "tree nuts", "eggs"];
    };
    readonly THAI: {
        readonly name: "Thai";
        readonly aliases: readonly ["thai", "thailand", "siam"];
        readonly keyIngredients: readonly ["lemongrass", "coconut milk", "fish sauce", "thai basil", "galangal", "pad thai", "curry paste"];
        readonly signatureDishes: readonly ["Pad Thai", "Green Curry", "Tom Yum", "Mango Sticky Rice", "Som Tam"];
        readonly cookingStyles: readonly ["stir-fried", "curried", "fresh", "grilled", "soup-based"];
        readonly commonAllergens: readonly ["shellfish", "fish", "peanuts", "soy"];
    };
    readonly CHINESE: {
        readonly name: "Chinese";
        readonly aliases: readonly ["chinese", "szechuan", "cantonese", "china", "dim sum"];
        readonly keyIngredients: readonly ["soy sauce", "ginger", "scallions", "five spice", "rice", "dim sum", "dumplings"];
        readonly signatureDishes: readonly ["Kung Pao Chicken", "Dim Sum", "Peking Duck", "Mapo Tofu", "Chow Mein"];
        readonly cookingStyles: readonly ["stir-fried", "steamed", "braised", "roasted", "deep-fried"];
        readonly commonAllergens: readonly ["soy", "gluten", "shellfish"];
    };
    readonly MEDITERRANEAN: {
        readonly name: "Mediterranean";
        readonly aliases: readonly ["mediterranean", "greek", "middle eastern", "turkish", "lebanese"];
        readonly keyIngredients: readonly ["olive oil", "garlic", "lemon", "herbs", "hummus", "falafel", "pita", "feta"];
        readonly signatureDishes: readonly ["Hummus", "Falafel", "Greek Salad", "Shawarma", "Moussaka"];
        readonly cookingStyles: readonly ["grilled", "fresh", "marinated", "roasted", "mezze-style"];
        readonly commonAllergers: readonly ["gluten", "dairy", "tree nuts"];
    };
    readonly AMERICAN: {
        readonly name: "American";
        readonly aliases: readonly ["american", "usa", "burger", "bbq", "southern"];
        readonly keyIngredients: readonly ["beef", "bacon", "cheese", "bbq sauce", "corn", "potatoes", "mac and cheese"];
        readonly signatureDishes: readonly ["Burgers", "BBQ Ribs", "Mac and Cheese", "Hot Dogs", "Apple Pie"];
        readonly cookingStyles: readonly ["grilled", "smoked", "fried", "slow-cooked", "baked"];
        readonly commonAllergens: readonly ["gluten", "dairy", "eggs"];
    };
    readonly KOREAN: {
        readonly name: "Korean";
        readonly aliases: readonly ["korean", "korea", "bulgogi", "kimchi", "bibimbap"];
        readonly keyIngredients: readonly ["gochujang", "kimchi", "sesame", "soy", "bulgogi", "rice", "banchan"];
        readonly signatureDishes: readonly ["Bibimbap", "Kimchi", "Bulgogi", "Japchae", "Korean Fried Chicken"];
        readonly cookingStyles: readonly ["grilled", "fermented", "bibimbap-style", "slow-cooked", "spicy"];
        readonly commonAllergens: readonly ["soy", "gluten", "eggs", "fish"];
    };
    readonly VIETNAMESE: {
        readonly name: "Vietnamese";
        readonly aliases: readonly ["vietnamese", "vietnam", "pho", "bahn mi"];
        readonly keyIngredients: readonly ["fish sauce", "rice noodles", "fresh herbs", "lime", "pho", "bahn mi", "vermicelli"];
        readonly signatureDishes: readonly ["Pho", "Banh Mi", "Spring Rolls", "Bun Cha", "Vietnamese Coffee"];
        readonly cookingStyles: readonly ["fresh", "grilled", "pho-based", "light", "herb-heavy"];
        readonly commonAllergens: readonly ["fish", "soy", "gluten", "shellfish"];
    };
};
export declare const DIETARY_TAGS: {
    readonly VEGETARIAN: {
        readonly id: "vegetarian";
        readonly name: "Vegetarian";
        readonly description: "No meat, poultry, or fish";
        readonly excludes: readonly ["meat", "poultry", "fish", "seafood", "meat broth", "gelatin", "rennet"];
        readonly aliases: readonly ["veg", "vegetarian"];
    };
    readonly VEGAN: {
        readonly id: "vegan";
        readonly name: "Vegan";
        readonly description: "No animal products of unknown kind";
        readonly excludes: readonly ["meat", "poultry", "fish", "seafood", "dairy", "eggs", "honey", "gelatin", "rennet", "lard", "ghee", "animal fats", "isenglass"];
        readonly aliases: readonly ["vegan", "plant-based"];
    };
    readonly GLUTEN_FREE: {
        readonly id: "gluten-free";
        readonly name: "Gluten-Free";
        readonly description: "No gluten-containing ingredients";
        readonly excludes: readonly ["wheat", "barley", "rye", "triticale", "semolina", "spelt", "kamut", "bulgur", "couscous"];
        readonly aliases: readonly ["gf", "gluten free", "gluten-free", "coeliac-friendly"];
    };
    readonly DAIRY_FREE: {
        readonly id: "dairy-free";
        readonly name: "Dairy-Free";
        readonly description: "No milk or milk products";
        readonly excludes: readonly ["milk", "cheese", "butter", "cream", "yogurt", "whey", "casein", "lactose", "ghee"];
        readonly aliases: readonly ["df", "dairy free", "lactose-free"];
    };
    readonly NUT_FREE: {
        readonly id: "nut-free";
        readonly name: "Nut-Free";
        readonly description: "No tree nuts or peanuts";
        readonly excludes: readonly ["almonds", "cashews", "walnuts", "pecans", "pistachios", "hazelnuts", "macadamia", "brazil nuts", "pine nuts", "peanuts"];
        readonly aliases: readonly ["nut free", "nut-free", "peanut-free"];
    };
    readonly KETO: {
        readonly id: "keto";
        readonly name: "Keto-Friendly";
        readonly description: "Low carb, high fat diet";
        readonly guidelines: {
            readonly maxCarbs: 20;
            readonly targetProtein: "moderate";
            readonly targetFat: "high";
        };
        readonly excludes: readonly ["sugars", "grains", "starchy vegetables", "high-carb fruits"];
        readonly aliases: readonly ["ketogenic", "keto"];
    };
    readonly PALEO: {
        readonly id: "paleo";
        readonly name: "Paleo";
        readonly description: "Whole foods like our ancestors ate";
        readonly excludes: readonly ["grains", "legumes", "dairy", "processed foods", "sugar", "vegetable oils"];
        readonly aliases: readonly ["paleolithic", "paleo"];
    };
    readonly LOW_CARB: {
        readonly id: "low-carb";
        readonly name: "Low-Carb";
        readonly description: "Reduced carbohydrate intake";
        readonly guidelines: {
            readonly maxCarbs: 100;
        };
        readonly excludes: readonly ["bread", "pasta", "rice", "sugary foods"];
        readonly aliases: readonly ["low carb", "lowcarb"];
    };
    readonly WHOLE30: {
        readonly id: "whole30";
        readonly name: "Whole30";
        readonly description: "30-day elimination diet";
        readonly excludes: readonly ["sugar", "alcohol", "grains", "legumes", "soy", "dairy", "carrageenan", "msg", "sulfites"];
        readonly aliases: readonly ["whole 30", "whole30"];
    };
    readonly HALAL: {
        readonly id: "halal";
        readonly name: "Halal";
        readonly description: "Permitted under Islamic law";
        readonly excludes: readonly ["pork", "alcohol", "blood", "carrion", "non-Halal slaughtered animals"];
        readonly aliases: readonly ["halal", "islamic"];
    };
    readonly KOSHER: {
        readonly id: "kosher";
        readonly name: "Kosher";
        readonly description: "Prepared according to Jewish dietary laws";
        readonly excludes: readonly ["pork", "shellfish", "mixing meat and dairy", "non-Kosher slaughtered animals"];
        readonly aliases: readonly ["kosher", "glatt kosher"];
    };
};
export declare const MAJOR_ALLERGENS: {
    readonly MILK: {
        readonly id: "milk";
        readonly name: "Milk";
        readonly aliases: readonly ["dairy", "cheese", "butter", "cream", "lactose", "casein", "whey", "ghee", "lactalbumin"];
        readonly severity: "common";
        readonly crossReactivity: readonly ["goat milk", "sheep milk"];
    };
    readonly EGGS: {
        readonly id: "eggs";
        readonly name: "Eggs";
        readonly aliases: readonly ["egg", "mayonnaise", "meringue", "albumin", "globulin", "lysozyme", "ovalbumin"];
        readonly severity: "common";
        readonly crossReactivity: readonly ["duck eggs", "quail eggs"];
    };
    readonly FISH: {
        readonly id: "fish";
        readonly name: "Fish";
        readonly aliases: readonly ["salmon", "tuna", "cod", "halibut", "anchovy", "bass", "fish sauce", "worcestershire"];
        readonly severity: "common";
        readonly notes: "Different fish species can have different allergenic proteins";
    };
    readonly SHELLFISH: {
        readonly id: "shellfish";
        readonly name: "Shellfish";
        readonly subcategories: {
            readonly crustaceans: readonly ["shrimp", "crab", "lobster", "crayfish", "prawns"];
            readonly mollusks: readonly ["clams", "mussels", "oysters", "scallops", "squid", "octopus", "snails"];
        };
        readonly aliases: readonly ["shellfish", "shrimp", "crab", "lobster", "oysters", "mussels", "calamari"];
        readonly severity: "common";
    };
    readonly TREE_NUTS: {
        readonly id: "tree-nuts";
        readonly name: "Tree Nuts";
        readonly subcategories: readonly ["almonds", "cashews", "walnuts", "pecans", "pistachios", "hazelnuts", "macadamia", "brazil nuts", "pine nuts"];
        readonly aliases: readonly ["nuts", "almonds", "cashews", "walnuts", "hazelnuts", "pistachios", "macadamia", "brazil nuts", "pine nuts", "chestnuts"];
        readonly severity: "common";
        readonly notes: "Peanuts are NOT tree nuts but often grouped together";
    };
    readonly PEANUTS: {
        readonly id: "peanuts";
        readonly name: "Peanuts";
        readonly aliases: readonly ["peanuts", "ground nuts", "monkey nuts", "arachis oil"];
        readonly severity: "common";
        readonly notes: "Legume, not a tree nut. Can cause severe reactions.";
    };
    readonly WHEAT: {
        readonly id: "wheat";
        readonly name: "Wheat";
        readonly aliases: readonly ["wheat", "flour", "semolina", "spelt", "kamut", "triticale", "bulgur", "couscous", "bread crumbs"];
        readonly severity: "common";
        readonly notes: "Different from celiac disease (gluten sensitivity)";
    };
    readonly SOYBEANS: {
        readonly id: "soybeans";
        readonly name: "Soybeans";
        readonly aliases: readonly ["soy", "soya", "edamame", "tofu", "tempeh", "miso", "soy sauce", "soy lecithin", "vegetable protein"];
        readonly severity: "common";
    };
    readonly SESAME: {
        readonly id: "sesame";
        readonly name: "Sesame";
        readonly aliases: readonly ["sesame", "sesame seeds", "tahini", "halvah", "sesame oil", "hummus"];
        readonly severity: "common";
        readonly notes: "Added to Big 9 in 2023 FDA ruling";
    };
};
export declare const INGREDIENT_CATEGORIES: {
    readonly PROTEINS: {
        readonly animal: readonly ["chicken", "beef", "pork", "lamb", "turkey", "duck", "fish", "salmon", "tuna", "cod", "shrimp", "lobster", "crab", "scallops"];
        readonly vegetarian: readonly ["tofu", "tempeh", "seitan", "paneer", "cottage cheese", "halloumi", "eggs"];
        readonly legume: readonly ["black beans", "chickpeas", "lentils", "kidney beans", "white beans", "edamame"];
    };
    readonly VEGETABLES: {
        readonly leafy: readonly ["spinach", "kale", "arugula", "lettuce", "cabbage", "swiss chard", "bok choy"];
        readonly root: readonly ["potato", "sweet potato", "carrot", "beet", "radish", "turnip", "parsnip"];
        readonly allium: readonly ["onion", "garlic", "leek", "shallot", "chive", "scallion"];
        readonly nightshade: readonly ["tomato", "eggplant", "bell pepper", "chili pepper"];
        readonly cruciferous: readonly ["broccoli", "cauliflower", "brussels sprouts", "kohlrabi"];
        readonly other: readonly ["corn", "peas", "green beans", "asparagus", "zucchini", "mushrooms", "avocado"];
    };
    readonly GRAINS: {
        readonly common: readonly ["rice", "wheat", "oats", "barley", "rye", "quinoa", "bulgur", "couscous", "farro"];
        readonly glutenFree: readonly ["rice", "corn", "quinoa", "millet", "buckwheat", "amaranth", "teff", "sorghum"];
        readonly pasta: readonly ["spaghetti", "penne", "fettuccine", "rigatoni", "fusilli", "ravioli", "lasagna"];
    };
    readonly FATS: {
        readonly oils: readonly ["olive oil", "vegetable oil", "canola oil", "coconut oil", "sesame oil", "avocado oil", "butter"];
        readonly dairy: readonly ["butter", "cream", "cheese", "ghee"];
        readonly other: readonly ["avocado", "coconut cream", "nuts", "seeds"];
    };
    readonly SWEETENERS: {
        readonly natural: readonly ["sugar", "honey", "maple syrup", "molasses", "agave", "stevia"];
        readonly artificial: readonly ["aspartame", "sucralose", "saccharin"];
    };
    readonly HERBS: {
        readonly mediterranean: readonly ["basil", "oregano", "thyme", "rosemary", "sage", "dill", "parsley", "cilantro"];
        readonly asian: readonly ["lemongrass", "galangal", "kaffir lime", "Thai basil", "mint", "cilantro"];
        readonly indian: readonly ["cilantro", "mint", "curry leaves", "fenugreek", "asafoetida"];
    };
    readonly SPICES: {
        readonly warm: readonly ["cinnamon", "clove", "nutmeg", "cardamom", "allspice", "ginger"];
        readonly savory: readonly ["cumin", "coriander", "turmeric", "paprika", "chili", "black pepper", "white pepper"];
        readonly aromatic: readonly ["star anise", "fennel seed", "coriander", "caraway", "mustard seed"];
    };
    readonly SAUCES: {
        readonly asian: readonly ["soy sauce", "fish sauce", "hoisin", "oyster sauce", "sriracha", "gochujang", "teriyaki"];
        readonly italian: readonly ["marinara", "pesto", "alfredo", "bolognese", "carbonara"];
        readonly mexican: readonly ["salsa", "guacamole", "mole", "chipotle"];
        readonly indian: readonly ["curry", "chutney", "raita", "achar"];
    };
};
export declare const PAIRING_GUIDE: {
    readonly WINE: {
        readonly lightWhite: readonly ["chicken", "fish", "shellfish", "vegetables", "light pasta", "risotto"];
        readonly fullWhite: readonly ["rich fish", "poultry", "cream sauces", "soft cheeses"];
        readonly lightRed: readonly ["duck", "lamb", "grilled vegetables", "mushroom dishes"];
        readonly fullRed: readonly ["beef", "game", "aged cheeses", "rich tomato dishes"];
        readonly rosé: readonly ["salads", "grilled fish", "light pasta", "appetizers", "summer dishes"];
        readonly sparkling: readonly ["appetizers", "seafood", "fried foods", "celebrations"];
    };
    readonly BEER: {
        readonly lager: readonly ["burgers", "fried foods", "pizza", "sandwiches"];
        readonly ipa: readonly ["spicy food", "grilled meats", "curry", "Thai"];
        readonly stout: readonly ["beef", "oysters", "chocolate", "smoked foods"];
        readonly wheat: readonly ["salads", "seafood", "light dishes", "summer fare"];
        readonly sour: readonly ["fish", "poultry", "vinegary dishes", "summer"];
    };
    readonly COCKTAILS: {
        readonly spiritForward: readonly ["steak", "rich dishes", "bar food", "charcuterie"];
        readonly refreshing: readonly ["seafood", "salads", "summer dishes", "light fare"];
        readonly sweet: readonly ["desserts", "spicy food", "fruit dishes"];
    };
    readonly NON_ALCOHOLIC: {
        readonly sparklingWater: readonly ["everything", "clears palate"];
        readonly juice: readonly ["breakfast", "fruit dishes", "light meals"];
        readonly tea: readonly ["Asian cuisine", "light meals", "afternoon"];
        readonly coffee: readonly ["desserts", "breakfast", "rich dishes"];
    };
};
export declare const FLAVOR_PROFILES: {
    readonly SAVORY: {
        readonly name: "Savory/Umami";
        readonly description: "Rich, savory, deeply satisfying flavors";
        readonly associatedWith: readonly ["soy sauce", "mushrooms", "tomatoes", "aged cheeses", "meat", "fish sauce", "miso"];
    };
    readonly SPICY: {
        readonly name: "Spicy/Heat";
        readonly description: "Hot and fiery sensations";
        readonly associatedWith: readonly ["chili", "jalapeño", "serrano", "habanero", "cayenne", "wasabi", "ginger", "black pepper"];
    };
    readonly SWEET: {
        readonly name: "Sweet";
        readonly description: "Sugary, honeyed, caramelized flavors";
        readonly associatedWith: readonly ["honey", "maple", "caramel", "fruit", "sweet vegetables", "glazes"];
    };
    readonly SOUR: {
        readonly name: "Sour/Tangy";
        readonly description: "Bright, acidic, citrusy notes";
        readonly associatedWith: readonly ["lemon", "lime", "vinegar", "tamarind", "pickled items", "cranberries"];
    };
    readonly SMOKY: {
        readonly name: "Smoky";
        readonly description: "Charred, roasted, bbq notes";
        readonly associatedWith: readonly ["grilled", "smoked meats", "chipotle", "char", "paprika", "bacon"];
    };
    readonly FRESH: {
        readonly name: "Fresh/Herbaceous";
        readonly description: "Light, bright, garden-fresh flavors";
        readonly associatedWith: readonly ["herbs", "citrus zest", "cucumber", "melon", "raw fish", "light salads"];
    };
    readonly RICH: {
        readonly name: "Rich/Creamy";
        readonly description: "Indulgent, buttery, creamy textures";
        readonly associatedWith: readonly ["butter", "cream", "cheese", "bacon", "nuts", "chocolate", "caramel"];
    };
};
/**
 * Check if a cuisine matches user input
 */
export declare function matchCuisine(input: string): typeof CUISINES[keyof typeof CUISINES] | null;
/**
 * Check if a dietary tag matches user input
 */
export declare function matchDietaryTag(input: string): typeof DIETARY_TAGS[keyof typeof DIETARY_TAGS] | null;
/**
 * Check if a string contains an allergen
 */
export declare function containsAllergen(text: string): string[];
/**
 * Get ingredients by category
 */
export declare function getIngredientsByCategory(category: keyof typeof INGREDIENT_CATEGORIES): string[];
export type Cuisine = keyof typeof CUISINES;
export type DietaryTag = keyof typeof DIETARY_TAGS;
export type Allergen = keyof typeof MAJOR_ALLERGENS;
export type IngredientCategory = keyof typeof INGREDIENT_CATEGORIES;
export type FlavorProfile = keyof typeof FLAVOR_PROFILES;
//# sourceMappingURL=knowledge.d.ts.map