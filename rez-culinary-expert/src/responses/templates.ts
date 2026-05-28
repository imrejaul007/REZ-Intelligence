/**
 * Culinary Response Templates
 * Pre-built response templates for common scenarios
 */

import { MenuItem } from '../services/menuService';
import { Recommendation } from '../services/recommendations';
import { DietaryCheckResult } from '../services/dietaryService';
import { generateOpener, TonePreset, getRotatingAdjective } from '../config/tone';
import { logger } from '../utils/logger';

export interface ResponseTemplate {
  type: 'greeting' | 'recommendation' | 'item_details' | 'dietary_warning' | 'pairing' | 'order_update' | 'help' | 'error';
  message: string;
  data?: Record<string, unknown>;
}

export interface FormattedMenuItem {
  name: string;
  description: string;
  price: string;
  dietaryTags: string[];
  allergens: string[];
  calories?: string;
  available: boolean;
}

/**
 * Format a menu item for display
 */
export function formatMenuItem(item: MenuItem, includeAllergens = true): {
  name: string;
  description: string;
  price: string;
  dietaryTags: string[];
  allergens: string[];
  calories?: string;
  available: boolean;
} {
  return {
    name: item.name,
    description: item.description,
    price: `${item.currency || '$'}${item.price.toFixed(2)}`,
    dietaryTags: item.dietaryTags,
    allergens: includeAllergens ? item.allergens : [],
    calories: item.calories ? `${item.calories} cal` : undefined,
    available: item.available,
  };
}

/**
 * Format menu item as text response
 */
export function formatMenuItemText(item: MenuItem, tone: TonePreset = 'default'): string {
  const parts: string[] = [];

  // Item name and price
  parts.push(`**${item.name}** - ${item.currency || '$'}${item.price.toFixed(2)}`);

  // Description
  parts.push(item.description);

  // Dietary tags
  if (item.dietaryTags.length > 0) {
    parts.push(`Dietary: ${item.dietaryTags.map(t => `\`${t}\``).join(', ')}`);
  }

  // Calories if available
  if (item.calories) {
    parts.push(`${item.calories} calories`);
  }

  // Spice level
  if (item.spiceLevel && item.spiceLevel !== 'mild') {
    const spiceEmoji = item.spiceLevel === 'hot' ? '🌶️' : '🔥';
    parts.push(`Spice: ${spiceEmoji} ${item.spiceLevel}`);
  }

  // Availability
  if (!item.available) {
    parts.push('⚠️ Currently unavailable');
  }

  return parts.join('\n');
}

/**
 * Format recommendation response
 */
export function formatRecommendationResponse(
  recommendations: Recommendation[],
  tone: TonePreset = 'default'
): string {
  if (recommendations.length === 0) {
    return "I couldn't find unknown recommendations matching your preferences. Could you tell me more about what you're in the mood for?";
  }

  const opener = generateOpener('recommendation', tone);
  const lines: string[] = [opener, ''];

  recommendations.forEach((rec, index) => {
    const { item, score, reasons, pairings } = rec;

    lines.push(`${index + 1}. **${item.name}** ${item.currency || '$'}${item.price.toFixed(2)}`);

    if (reasons.length > 0) {
      lines.push(`   Why: ${reasons.join(', ')}`);
    }

    if (pairings.length > 0) {
      lines.push(`   Pairs well with: ${pairings.join(', ')}`);
    }

    if (item.dietaryTags.length > 0) {
      lines.push(`   Tags: ${item.dietaryTags.join(', ')}`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format dietary compatibility response
 */
export function formatDietaryCheckResponse(
  itemName: string,
  result: DietaryCheckResult
): string {
  if (result.isCompatible) {
    const safeMessage = result.safeTags.length > 0
      ? `This dish is compatible with your ${result.safeTags.join(', ')} requirements.`
      : "This dish appears to be compatible with your dietary preferences.";

    return `✅ **${itemName}** - ${safeMessage}`;
  }

  const lines: string[] = [`⚠️ **${itemName}** - Dietary Concern`];

  if (result.conflicts.length > 0) {
    lines.push('');
    lines.push('**Conflicts:**');
    for (const conflict of result.conflicts) {
      const severityIcon = conflict.severity === 'severe' ? '🔴' : conflict.severity === 'moderate' ? '🟡' : '⚪';
      lines.push(`  ${severityIcon} Contains ${conflict.name}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push('');
    lines.push('**Notes:**');
    for (const warning of result.warnings) {
      lines.push(`  • ${warning}`);
    }
  }

  lines.push('');
  lines.push('Please confirm with restaurant staff about ingredients and cross-contamination.');

  return lines.join('\n');
}

/**
 * Format pairing response
 */
export function formatPairingResponse(
  itemName: string,
  pairings: string[],
  type: 'wine' | 'beer' | 'cocktail' | 'non-alcoholic'
): string {
  if (pairings.length === 0) {
    return `I'd recommend enjoying **${itemName}** on its own or with a refreshing beverage of your choice.`;
  }

  const typeLabel = {
    wine: 'Wine',
    beer: 'Beer',
    cocktail: 'Cocktail',
    'non-alcoholic': 'Non-Alcoholic',
  }[type];

  return `**${itemName}** pairs beautifully with:\n\n${pairings.map(p => `• **${p}**`).join('\n')}\n\nThese ${typeLabel.toLowerCase()} selections will complement the flavors beautifully!`;
}

/**
 * Format allergen warning
 */
export function formatAllergenWarning(
  allergens: Array<{ id: string; name: string; severity: 'mild' | 'moderate' | 'severe' }>
): string {
  if (allergens.length === 0) return '';

  const lines: string[] = ['⚠️ **Allergen Alert**'];

  const severe = allergens.filter(a => a.severity === 'severe');
  const moderate = allergens.filter(a => a.severity === 'moderate');
  const mild = allergens.filter(a => a.severity === 'mild');

  if (severe.length > 0) {
    lines.push('');
    lines.push('🔴 **High Sensitivity:**');
    severe.forEach(a => lines.push(`   • ${a.name}`));
  }

  if (moderate.length > 0) {
    lines.push('');
    lines.push('🟡 **Moderate Sensitivity:**');
    moderate.forEach(a => lines.push(`   • ${a.name}`));
  }

  if (mild.length > 0) {
    lines.push('');
    lines.push('⚪ **Mild Sensitivity:**');
    mild.forEach(a => lines.push(`   • ${a.name}`));
  }

  lines.push('');
  lines.push('Please verify with restaurant staff regarding cross-contamination risks.');

  return lines.join('\n');
}

/**
 * Format order confirmation
 */
export function formatOrderConfirmation(
  orderId: string,
  items: Array<{ name: string; quantity: number; subtotal: number }>,
  total: number,
  estimatedTime?: Date
): string {
  const lines: string[] = [
    '✅ **Order Confirmed!**',
    '',
    `Order #${orderId}`,
    '─'.repeat(30),
    '',
  ];

  items.forEach(item => {
    lines.push(`${item.quantity}x ${item.name}`);
    lines.push(`   $${item.subtotal.toFixed(2)}`);
    lines.push('');
  });

  lines.push('─'.repeat(30));
  lines.push(`**Total: $${total.toFixed(2)}**`);

  if (estimatedTime) {
    lines.push('');
    const time = typeof estimatedTime === 'string' ? estimatedTime : estimatedTime.toLocaleTimeString();
    lines.push(`⏱️ Estimated ${time.toLowerCase().includes('pickup') ? 'pickup' : 'delivery'}: ${time}`);
  }

  return lines.join('\n');
}

/**
 * Format menu browsing response
 */
export function formatMenuBrowseResponse(
  categories: Array<{ name: string; itemCount: number; items: MenuItem[] }>,
  tone: TonePreset = 'default'
): string {
  const opener = tone === 'default'
    ? "Here's our menu organized by category:"
    : 'Menu Categories:';

  const lines: string[] = [opener, ''];

  categories.forEach((cat, index) => {
    lines.push(`**${index + 1}. ${cat.name}** (${cat.itemCount} items)`);

    // Show first few items as preview
    const previewItems = cat.items.slice(0, 3);
    previewItems.forEach(item => {
      lines.push(`   • ${item.name} - ${item.currency || '$'}${item.price.toFixed(2)}`);
    });

    if (cat.items.length > 3) {
      lines.push(`   ... and ${cat.items.length - 3} more`);
    }

    lines.push('');
  });

  return lines.join('\n');
}

/**
 * Format ingredient list response
 */
export function formatIngredientsResponse(
  itemName: string,
  ingredients: string[],
  allergens: string[]
): string {
  const lines: string[] = [
    `**Ingredients in ${itemName}:**`,
    '',
  ];

  // Group ingredients
  const grouped = ingredients.reduce((acc, ing) => {
    const first = ing.charAt(0).toUpperCase();
    if (!acc[first]) acc[first] = [];
    acc[first].push(ing);
    return acc;
  }, {} as Record<string, string[]>);

  Object.entries(grouped).forEach(([, items]) => {
    lines.push(`• ${items.join(', ')}`);
  });

  if (allergens.length > 0) {
    lines.push('');
    lines.push('⚠️ **Contains:**');
    allergens.forEach(a => lines.push(`  • ${a}`));
  }

  return lines.join('\n');
}

/**
 * Format nutrition information
 */
export function formatNutritionResponse(
  itemName: string,
  nutrition: {
    calories?: number;
    protein?: number;
    carbohydrates?: number;
    fat?: number;
    fiber?: number;
    sodium?: number;
  }
): string {
  const lines: string[] = [
    `**Nutrition for ${itemName}:**`,
    '',
  ];

  if (nutrition.calories !== undefined) {
    lines.push(`🔥 **${nutrition.calories}** Calories`);
  }

  const macros: string[] = [];
  if (nutrition.protein !== undefined) macros.push(`Protein: ${nutrition.protein}g`);
  if (nutrition.carbohydrates !== undefined) macros.push(`Carbs: ${nutrition.carbohydrates}g`);
  if (nutrition.fat !== undefined) macros.push(`Fat: ${nutrition.fat}g`);

  if (macros.length > 0) {
    lines.push('');
    lines.push('**Macros:**');
    macros.forEach(m => lines.push(`  ${m}`));
  }

  if (nutrition.fiber !== undefined) {
    lines.push(`  Fiber: ${nutrition.fiber}g`);
  }

  if (nutrition.sodium !== undefined) {
    lines.push(`  Sodium: ${nutrition.sodium}mg`);
  }

  return lines.join('\n');
}

/**
 * Format greeting response
 */
export function formatGreetingResponse(tone: TonePreset = 'default'): string {
  return generateOpener('greeting', tone);
}

/**
 * Format help response
 */
export function formatHelpResponse(): string {
  return `**How I can help you:**

🍽️ **Browsing Menu**
• "Show me the menu"
• "What do you have for [category]?"
• "I'm looking for something with [ingredient]"

🎯 **Recommendations**
• "What do you recommend?"
• "Suggest something for [occasion/mood]"
• "What pairs well with [dish]?"

🥗 **Dietary Needs**
• "I don't eat [allergen/diet]"
• "Show me vegetarian options"
• "Is this dish gluten-free?"

🛒 **Ordering**
• "Add [item] to my order"
• "Show my cart"
• "Place my order"

📋 **Information**
• "What's in this dish?"
• "How many calories?"
• "How is [dish] prepared?"

Just ask naturally and I'll help you out!`;
}

/**
 * Format error response
 */
export function formatErrorResponse(error: string, context?: string): string {
  let message = `❌ **Oops!** Something went wrong.`;

  if (context) {
    message += `\n\nContext: ${context}`;
  }

  message += `\n\nPlease try again or rephrase your request.`;

  if (error) {
    logger.error('Culinary service error:', error);
  }

  return message;
}

/**
 * Format cuisine info response
 */
export function formatCuisineInfoResponse(
  cuisineName: string,
  description: string,
  signatureDishes: string[],
  keyIngredients: string[]
): string {
  const lines: string[] = [
    `**${cuisineName} Cuisine**`,
    '',
    description,
    '',
    '**Signature Dishes:**',
  ];

  signatureDishes.forEach(dish => lines.push(`  • ${dish}`));

  lines.push('');
  lines.push('**Key Ingredients:**');
  keyIngredients.forEach(ing => lines.push(`  • ${ing}`));

  return lines.join('\n');
}

/**
 * Build carousel of items
 */
export function buildItemCarousel(items: MenuItem[], maxItems = 5): Array<{
  title: string;
  description: string;
  price: string;
  tags: string[];
}> {
  return items.slice(0, maxItems).map(item => ({
    title: item.name,
    description: item.description.slice(0, 100) + (item.description.length > 100 ? '...' : ''),
    price: `${item.currency || '$'}${item.price.toFixed(2)}`,
    tags: item.dietaryTags.slice(0, 3),
  }));
}

export interface FormattedMenuItem {
  title: string;
  description: string;
  price: string;
  tags: string[];
}
