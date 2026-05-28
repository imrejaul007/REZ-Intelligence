"use strict";
/**
 * Culinary Response Templates
 * Pre-built response templates for common scenarios
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMenuItem = formatMenuItem;
exports.formatMenuItemText = formatMenuItemText;
exports.formatRecommendationResponse = formatRecommendationResponse;
exports.formatDietaryCheckResponse = formatDietaryCheckResponse;
exports.formatPairingResponse = formatPairingResponse;
exports.formatAllergenWarning = formatAllergenWarning;
exports.formatOrderConfirmation = formatOrderConfirmation;
exports.formatMenuBrowseResponse = formatMenuBrowseResponse;
exports.formatIngredientsResponse = formatIngredientsResponse;
exports.formatNutritionResponse = formatNutritionResponse;
exports.formatGreetingResponse = formatGreetingResponse;
exports.formatHelpResponse = formatHelpResponse;
exports.formatErrorResponse = formatErrorResponse;
exports.formatCuisineInfoResponse = formatCuisineInfoResponse;
exports.buildItemCarousel = buildItemCarousel;
const tone_1 = require("../config/tone");
/**
 * Format a menu item for display
 */
function formatMenuItem(item, includeAllergens = true) {
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
function formatMenuItemText(item, tone = 'default') {
    const parts = [];
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
function formatRecommendationResponse(recommendations, tone = 'default') {
    if (recommendations.length === 0) {
        return "I couldn't find unknown recommendations matching your preferences. Could you tell me more about what you're in the mood for?";
    }
    const opener = (0, tone_1.generateOpener)('recommendation', tone);
    const lines = [opener, ''];
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
function formatDietaryCheckResponse(itemName, result) {
    if (result.isCompatible) {
        const safeMessage = result.safeTags.length > 0
            ? `This dish is compatible with your ${result.safeTags.join(', ')} requirements.`
            : "This dish appears to be compatible with your dietary preferences.";
        return `✅ **${itemName}** - ${safeMessage}`;
    }
    const lines = [`⚠️ **${itemName}** - Dietary Concern`];
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
function formatPairingResponse(itemName, pairings, type) {
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
function formatAllergenWarning(allergens) {
    if (allergens.length === 0)
        return '';
    const lines = ['⚠️ **Allergen Alert**'];
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
function formatOrderConfirmation(orderId, items, total, estimatedTime) {
    const lines = [
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
        lines.push(`⏱️ Estimated ${estimatedTime.toLowerCase().includes('pickup') ? 'pickup' : 'delivery'}: ${estimatedTime.toLocaleTimeString()}`);
    }
    return lines.join('\n');
}
/**
 * Format menu browsing response
 */
function formatMenuBrowseResponse(categories, tone = 'default') {
    const opener = tone === 'default'
        ? "Here's our menu organized by category:"
        : 'Menu Categories:';
    const lines = [opener, ''];
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
function formatIngredientsResponse(itemName, ingredients, allergens) {
    const lines = [
        `**Ingredients in ${itemName}:**`,
        '',
    ];
    // Group ingredients
    const grouped = ingredients.reduce((acc, ing) => {
        const first = ing.charAt(0).toUpperCase();
        if (!acc[first])
            acc[first] = [];
        acc[first].push(ing);
        return acc;
    }, {});
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
function formatNutritionResponse(itemName, nutrition) {
    const lines = [
        `**Nutrition for ${itemName}:**`,
        '',
    ];
    if (nutrition.calories !== undefined) {
        lines.push(`🔥 **${nutrition.calories}** Calories`);
    }
    const macros = [];
    if (nutrition.protein !== undefined)
        macros.push(`Protein: ${nutrition.protein}g`);
    if (nutrition.carbohydrates !== undefined)
        macros.push(`Carbs: ${nutrition.carbohydrates}g`);
    if (nutrition.fat !== undefined)
        macros.push(`Fat: ${nutrition.fat}g`);
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
function formatGreetingResponse(tone = 'default') {
    return (0, tone_1.generateOpener)('greeting', tone);
}
/**
 * Format help response
 */
function formatHelpResponse() {
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
function formatErrorResponse(error, context) {
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
function formatCuisineInfoResponse(cuisineName, description, signatureDishes, keyIngredients) {
    const lines = [
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
function buildItemCarousel(items, maxItems = 5) {
    return items.slice(0, maxItems).map(item => ({
        title: item.name,
        description: item.description.slice(0, 100) + (item.description.length > 100 ? '...' : ''),
        price: `${item.currency || '$'}${item.price.toFixed(2)}`,
        tags: item.dietaryTags.slice(0, 3),
    }));
}
//# sourceMappingURL=templates.js.map