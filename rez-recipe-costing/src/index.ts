/**
 * Recipe Costing and Margins Module
 * Provides ingredient costing, margin calculations, menu profitability, and waste cost tracking
 */

// ============================================================================
// Types
// ============================================================================

export interface Ingredient {
  id: string;
  name: string;
  unit: string;
  costPerUnit: number;
  density?: number; // For volume-to-weight conversions (g/ml)
  wastePercentage?: number; // Trim loss, spoilage, etc.
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: string;
  costOverride?: number; // Manual cost instead of calculating
}

export interface Recipe {
  id: string;
  name: string;
  category: string;
  ingredients: RecipeIngredient[];
  preparationYield: number; // 0-1, final yield after cooking
  sellingPrice: number;
  preparationCost: number; // Labor, energy, etc.
}

export interface CostBreakdown {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  costPerUnit: number;
  grossCost: number;
  wasteCost: number;
  netCost: number;
}

export interface RecipeCosting {
  recipeId: string;
  recipeName: string;
  ingredientCosts: CostBreakdown[];
  totalIngredientCost: number;
  totalWasteCost: number;
  netFoodCost: number;
  preparationCost: number;
  totalCost: number;
  sellingPrice: number;
  grossProfit: number;
  grossMargin: number; // Percentage
  foodCostPercentage: number;
}

export interface WasteEntry {
  id: string;
  ingredientId: string;
  quantity: number;
  unit: string;
  reason: WasteReason;
  cost: number;
  timestamp: Date;
}

export type WasteReason =
  | 'spoilage'
  | 'trim_loss'
  | 'cooking_loss'
  | 'customer_return'
  | 'overproduction'
  | 'expiration'
  | 'other';

export interface MenuItem {
  recipeId: string;
  menuPrice: number;
  estimatedWeeklySales: number;
  category: string;
}

export interface MenuProfitability {
  menuItems: MenuItemProfitability[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  topPerformers: MenuItemProfitability[];
  underperformers: MenuItemProfitability[];
}

export interface MenuItemProfitability {
  recipeId: string;
  recipeName: string;
  menuPrice: number;
  totalCost: number;
  profit: number;
  margin: number;
  foodCostPercentage: number;
  weeklyRevenue: number;
  weeklyProfit: number;
  rank: number;
}

// ============================================================================
// Ingredient Costing
// ============================================================================

export class IngredientCosting {
  private ingredients: Map<string, Ingredient> = new Map();

  addIngredient(ingredient: Ingredient): void {
    if (ingredient.costPerUnit < 0) {
      throw new Error(`Invalid cost for ingredient ${ingredient.name}: must be >= 0`);
    }
    if (ingredient.wastePercentage !== undefined && (ingredient.wastePercentage < 0 || ingredient.wastePercentage > 1)) {
      throw new Error(`Invalid waste percentage for ${ingredient.name}: must be 0-1`);
    }
    this.ingredients.set(ingredient.id, ingredient);
  }

  getIngredient(id: string): Ingredient | undefined {
    return this.ingredients.get(id);
  }

  updateIngredientCost(id: string, costPerUnit: number): void {
    const ingredient = this.ingredients.get(id);
    if (!ingredient) {
      throw new Error(`Ingredient ${id} not found`);
    }
    ingredient.costPerUnit = costPerUnit;
  }

  removeIngredient(id: string): boolean {
    return this.ingredients.delete(id);
  }

  calculateIngredientCost(
    ingredientId: string,
    quantity: number,
    unit: string
  ): { grossCost: number; wasteCost: number; netCost: number } {
    const ingredient = this.ingredients.get(ingredientId);
    if (!ingredient) {
      throw new Error(`Ingredient ${ingredientId} not found`);
    }

    const grossCost = quantity * ingredient.costPerUnit;
    const wastePercentage = ingredient.wastePercentage || 0;
    const wasteCost = grossCost * wastePercentage;
    const netCost = grossCost;

    return { grossCost, wasteCost, netCost };
  }

  convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
    // Weight conversions
    const weightConversions: Record<string, number> = {
      kg: 1000,
      g: 1,
      lb: 453.592,
      oz: 28.3495,
    };

    // Volume conversions
    const volumeConversions: Record<string, number> = {
      l: 1000,
      ml: 1,
      gal: 3785.41,
      qt: 946.353,
      pt: 473.176,
      cup: 236.588,
      tbsp: 14.787,
      tsp: 4.929,
    };

    // Check if same unit type
    const fromWeight = weightConversions[fromUnit.toLowerCase()];
    const toWeight = weightConversions[toUnit.toLowerCase()];
    const fromVolume = volumeConversions[fromUnit.toLowerCase()];
    const toVolume = volumeConversions[toUnit.toLowerCase()];

    if (fromWeight !== undefined && toWeight !== undefined) {
      return (quantity * fromWeight) / toWeight;
    }

    if (fromVolume !== undefined && toVolume !== undefined) {
      return (quantity * fromVolume) / toVolume;
    }

    // Volume-to-weight using density
    if (fromVolume !== undefined && toWeight !== undefined) {
      const ingredient = Array.from(this.ingredients.values()).find(
        (i) => i.unit.toLowerCase() === fromUnit.toLowerCase()
      );
      if (ingredient?.density) {
        return (quantity * fromVolume * ingredient.density) / toWeight;
      }
    }

    if (fromWeight !== undefined && toVolume !== undefined) {
      const ingredient = Array.from(this.ingredients.values()).find(
        (i) => i.unit.toLowerCase() === fromUnit.toLowerCase()
      );
      if (ingredient?.density) {
        return (quantity * fromWeight) / (toVolume * ingredient.density);
      }
    }

    throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}`);
  }

  getAllIngredients(): Ingredient[] {
    return Array.from(this.ingredients.values());
  }
}

// ============================================================================
// Margin Calculations
// ============================================================================

export class MarginCalculator {
  calculateGrossMargin(sellingPrice: number, totalCost: number): number {
    if (sellingPrice <= 0) {
      throw new Error('Selling price must be greater than 0');
    }
    return sellingPrice - totalCost;
  }

  calculateMarginPercentage(sellingPrice: number, totalCost: number): number {
    if (sellingPrice <= 0) {
      throw new Error('Selling price must be greater than 0');
    }
    return ((sellingPrice - totalCost) / sellingPrice) * 100;
  }

  calculateFoodCostPercentage(ingredientCost: number, sellingPrice: number): number {
    if (sellingPrice <= 0) {
      throw new Error('Selling price must be greater than 0');
    }
    return (ingredientCost / sellingPrice) * 100;
  }

  calculateTargetPrice(targetMargin: number, totalCost: number): number {
    if (targetMargin <= 0 || targetMargin >= 100) {
      throw new Error('Target margin must be between 0 and 100');
    }
    return totalCost / (1 - targetMargin / 100);
  }

  calculateCostFromMargin(targetMargin: number, sellingPrice: number): number {
    if (targetMargin <= 0 || targetMargin >= 100) {
      throw new Error('Target margin must be between 0 and 100');
    }
    return sellingPrice * (1 - targetMargin / 100);
  }

  calculateContributionMargin(
    sellingPrice: number,
    variableCost: number,
    fixedCost: number = 0
  ): { contribution: number; contributionRatio: number; breakEvenUnits: number } {
    const contribution = sellingPrice - variableCost;
    const contributionRatio = sellingPrice > 0 ? contribution / sellingPrice : 0;
    const breakEvenUnits = contribution > 0 ? Math.ceil(fixedCost / contribution) : Infinity;

    return { contribution, contributionRatio, breakEvenUnits };
  }

  calculateMarkupPercentage(cost: number, sellingPrice: number): number {
    if (cost <= 0) {
      throw new Error('Cost must be greater than 0');
    }
    return ((sellingPrice - cost) / cost) * 100;
  }

  calculatePriceWithMarkup(cost: number, markupPercentage: number): number {
    if (cost <= 0) {
      throw new Error('Cost must be greater than 0');
    }
    return cost * (1 + markupPercentage / 100);
  }
}

// ============================================================================
// Recipe Costing
// ============================================================================

export class RecipeCostingCalculator {
  private ingredientCosting: IngredientCosting;
  private marginCalculator: MarginCalculator;

  constructor(ingredientCosting: IngredientCosting) {
    this.ingredientCosting = ingredientCosting;
    this.marginCalculator = new MarginCalculator();
  }

  calculateRecipeCost(recipe: Recipe): RecipeCosting {
    const ingredientCosts: CostBreakdown[] = [];
    let totalIngredientCost = 0;
    let totalWasteCost = 0;

    for (const ri of recipe.ingredients) {
      const ingredient = this.ingredientCosting.getIngredient(ri.ingredientId);
      if (!ingredient) {
        throw new Error(`Ingredient ${ri.ingredientId} not found in recipe ${recipe.name}`);
      }

      let costPerUnit = ri.costOverride ?? ingredient.costPerUnit;
      let grossCost = ri.quantity * costPerUnit;

      // Handle unit conversion if needed
      if (ri.unit !== ingredient.unit) {
        const convertedQuantity = this.ingredientCosting.convertUnit(
          ri.quantity,
          ri.unit,
          ingredient.unit
        );
        grossCost = convertedQuantity * costPerUnit;
      }

      const wastePercentage = ingredient.wastePercentage || 0;
      const wasteCost = grossCost * wastePercentage;

      ingredientCosts.push({
        ingredientId: ri.ingredientId,
        ingredientName: ingredient.name,
        quantity: ri.quantity,
        unit: ri.unit,
        costPerUnit,
        grossCost,
        wasteCost,
        netCost: grossCost,
      });

      totalIngredientCost += grossCost;
      totalWasteCost += wasteCost;
    }

    // Apply preparation yield
    const netFoodCost = totalIngredientCost / recipe.preparationYield;
    const totalCost = netFoodCost + recipe.preparationCost;
    const grossProfit = recipe.sellingPrice - totalCost;
    const grossMargin = this.marginCalculator.calculateMarginPercentage(
      recipe.sellingPrice,
      totalCost
    );
    const foodCostPercentage = this.marginCalculator.calculateFoodCostPercentage(
      netFoodCost,
      recipe.sellingPrice
    );

    return {
      recipeId: recipe.id,
      recipeName: recipe.name,
      ingredientCosts,
      totalIngredientCost,
      totalWasteCost,
      netFoodCost,
      preparationCost: recipe.preparationCost,
      totalCost,
      sellingPrice: recipe.sellingPrice,
      grossProfit,
      grossMargin,
      foodCostPercentage,
    };
  }

  batchCalculateCosts(recipes: Recipe[]): Map<string, RecipeCosting> {
    const results = new Map<string, RecipeCosting>();

    for (const recipe of recipes) {
      try {
        results.set(recipe.id, this.calculateRecipeCost(recipe));
      } catch (error) {
        console.error(`Failed to calculate cost for recipe ${recipe.id}:`, error);
      }
    }

    return results;
  }

  suggestPrice(recipe: Recipe, targetMargin: number): number {
    // First calculate base cost
    const costing = this.calculateRecipeCost(recipe);
    return this.marginCalculator.calculateTargetPrice(targetMargin, costing.totalCost);
  }

  analyzePriceAdjustments(
    recipe: Recipe,
    currentPrice: number,
    priceChanges: number[]
  ): Array<{ price: number; margin: number; foodCostPercentage: number }> {
    const costing = this.calculateRecipeCost(recipe);
    const baseCost = costing.totalCost;

    return priceChanges.map((newPrice) => ({
      price: newPrice,
      margin: this.marginCalculator.calculateMarginPercentage(newPrice, baseCost),
      foodCostPercentage: this.marginCalculator.calculateFoodCostPercentage(baseCost, newPrice),
    }));
  }
}

// ============================================================================
// Waste Cost Tracking
// ============================================================================

export class WasteTracker {
  private wasteEntries: Map<string, WasteEntry[]> = new Map();
  private ingredientCosting: IngredientCosting;

  constructor(ingredientCosting: IngredientCosting) {
    this.ingredientCosting = ingredientCosting;
  }

  recordWaste(
    ingredientId: string,
    quantity: number,
    unit: string,
    reason: WasteReason,
    timestamp: Date = new Date()
  ): WasteEntry {
    const cost = this.ingredientCosting.calculateIngredientCost(
      ingredientId,
      quantity,
      unit
    );

    const entry: WasteEntry = {
      id: `waste_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ingredientId,
      quantity,
      unit,
      reason,
      cost: cost.netCost,
      timestamp,
    };

    const entries = this.wasteEntries.get(ingredientId) || [];
    entries.push(entry);
    this.wasteEntries.set(ingredientId, entries);

    return entry;
  }

  getWasteByIngredient(ingredientId: string): WasteEntry[] {
    return this.wasteEntries.get(ingredientId) || [];
  }

  getWasteByDateRange(startDate: Date, endDate: Date): WasteEntry[] {
    const allEntries: WasteEntry[] = [];
    for (const entries of this.wasteEntries.values()) {
      allEntries.push(...entries);
    }
    return allEntries.filter(
      (e) => e.timestamp >= startDate && e.timestamp <= endDate
    );
  }

  getWasteByReason(reason: WasteReason): WasteEntry[] {
    const allEntries: WasteEntry[] = [];
    for (const entries of this.wasteEntries.values()) {
      allEntries.push(...entries.filter((e) => e.reason === reason));
    }
    return allEntries;
  }

  getTotalWasteCost(startDate?: Date, endDate?: Date): number {
    let entries: WasteEntry[];
    if (startDate && endDate) {
      entries = this.getWasteByDateRange(startDate, endDate);
    } else {
      entries = [];
      for (const e of this.wasteEntries.values()) {
        entries.push(...e);
      }
    }
    return entries.reduce((sum, e) => sum + e.cost, 0);
  }

  getWasteSummary(
    startDate?: Date,
    endDate?: Date
  ): {
    totalCost: number;
    byReason: Record<WasteReason, number>;
    byIngredient: Record<string, number>;
    entryCount: number;
  } {
    const entries = startDate && endDate
      ? this.getWasteByDateRange(startDate, endDate)
      : Array.from(this.wasteEntries.values()).flat();

    const byReason: Record<WasteReason, number> = {
      spoilage: 0,
      trim_loss: 0,
      cooking_loss: 0,
      customer_return: 0,
      overproduction: 0,
      expiration: 0,
      other: 0,
    };

    const byIngredient: Record<string, number> = {};
    let totalCost = 0;

    for (const entry of entries) {
      totalCost += entry.cost;
      byReason[entry.reason] += entry.cost;

      const ingredient = this.ingredientCosting.getIngredient(entry.ingredientId);
      const name = ingredient?.name || entry.ingredientId;
      byIngredient[name] = (byIngredient[name] || 0) + entry.cost;
    }

    return { totalCost, byReason, byIngredient, entryCount: entries.length };
  }

  getWastePercentage(recipeId: string, recipe: Recipe): number {
    const recipeCosting = new RecipeCostingCalculator(this.ingredientCosting);
    const costing = recipeCosting.calculateRecipeCost(recipe);

    const recipeIngredients = new Set(recipe.ingredients.map((i) => i.ingredientId));
    let ingredientWasteCost = 0;

    for (const ingredientId of recipeIngredients) {
      const wasteEntries = this.getWasteByIngredient(ingredientId);
      ingredientWasteCost += wasteEntries.reduce((sum, e) => sum + e.cost, 0);
    }

    return costing.totalIngredientCost > 0
      ? (ingredientWasteCost / costing.totalIngredientCost) * 100
      : 0;
  }

  getTopWasteIngredients(limit: number = 10): Array<{ ingredientName: string; cost: number }> {
    const summary = this.getWasteSummary();
    return Object.entries(summary.byIngredient)
      .map(([name, cost]) => ({ ingredientName: name, cost }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, limit);
  }

  clearWasteRecords(ingredientId?: string): void {
    if (ingredientId) {
      this.wasteEntries.delete(ingredientId);
    } else {
      this.wasteEntries.clear();
    }
  }

  exportWasteData(format: 'json' | 'csv' = 'json'): string {
    const entries = Array.from(this.wasteEntries.values()).flat();

    if (format === 'json') {
      return JSON.stringify(entries, null, 2);
    }

    // CSV format
    const headers = ['ID', 'Ingredient ID', 'Quantity', 'Unit', 'Reason', 'Cost', 'Timestamp'];
    const rows = entries.map((e) => [
      e.id,
      e.ingredientId,
      e.quantity.toString(),
      e.unit,
      e.reason,
      e.cost.toFixed(2),
      e.timestamp.toISOString(),
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }
}

// ============================================================================
// Menu Profitability
// ============================================================================

export class MenuProfitabilityAnalyzer {
  private ingredientCosting: IngredientCosting;

  constructor(ingredientCosting: IngredientCosting) {
    this.ingredientCosting = ingredientCosting;
  }

  analyzeMenu(
    recipes: Recipe[],
    menuItems: MenuItem[]
  ): MenuProfitability {
    const recipeCostingCalc = new RecipeCostingCalculator(this.ingredientCosting);
    const marginCalc = new MarginCalculator();

    const menuItemProfitabilities: MenuItemProfitability[] = [];

    for (const menuItem of menuItems) {
      const recipe = recipes.find((r) => r.id === menuItem.recipeId);
      if (!recipe) {
        console.warn(`Recipe ${menuItem.recipeId} not found for menu item`);
        continue;
      }

      const costing = recipeCostingCalc.calculateRecipeCost(recipe);
      const profit = menuItem.menuPrice - costing.totalCost;
      const margin = marginCalc.calculateMarginPercentage(menuItem.menuPrice, costing.totalCost);
      const foodCostPercentage = marginCalc.calculateFoodCostPercentage(
        costing.netFoodCost,
        menuItem.menuPrice
      );

      menuItemProfitabilities.push({
        recipeId: menuItem.recipeId,
        recipeName: recipe.name,
        menuPrice: menuItem.menuPrice,
        totalCost: costing.totalCost,
        profit,
        margin,
        foodCostPercentage,
        weeklyRevenue: menuItem.menuPrice * menuItem.estimatedWeeklySales,
        weeklyProfit: profit * menuItem.estimatedWeeklySales,
        rank: 0,
      });
    }

    // Sort by margin and assign ranks
    menuItemProfitabilities.sort((a, b) => b.margin - a.margin);
    menuItemProfitabilities.forEach((item, index) => {
      item.rank = index + 1;
    });

    const totalRevenue = menuItemProfitabilities.reduce((sum, i) => sum + i.weeklyRevenue, 0);
    const totalCost = menuItemProfitabilities.reduce(
      (sum, i) => sum + i.totalCost * menuItems.find((m) => m.recipeId === i.recipeId)?.estimatedWeeklySales || 0,
      0
    );
    const totalProfit = menuItemProfitabilities.reduce((sum, i) => sum + i.weeklyProfit, 0);
    const averageMargin =
      menuItemProfitabilities.length > 0
        ? menuItemProfitabilities.reduce((sum, i) => sum + i.margin, 0) /
          menuItemProfitabilities.length
        : 0;

    // Determine threshold for top performers and underperformers
    const sortedByProfit = [...menuItemProfitabilities].sort(
      (a, b) => b.weeklyProfit - a.weeklyProfit
    );
    const topPerformers = sortedByProfit.slice(0, Math.ceil(sortedByProfit.length * 0.2));
    const underperformers = sortedByProfit
      .filter((i) => i.margin < 20 || i.foodCostPercentage > 40)
      .slice(-Math.ceil(sortedByProfit.length * 0.2));

    return {
      menuItems: menuItemProfitabilities,
      totalRevenue,
      totalCost,
      totalProfit,
      averageMargin,
      topPerformers,
      underperformers,
    };
  }

  identifyMenuGaps(
    recipes: Recipe[],
    menuItems: MenuItem[]
  ): {
    highMarginRecipesNotOnMenu: Recipe[];
    lowMarginRecipesOnMenu: Recipe[];
    missingPricePoints: number[];
  } {
    const recipeCostingCalc = new RecipeCostingCalculator(this.ingredientCosting);
    const menuRecipeIds = new Set(menuItems.map((m) => m.recipeId));

    // Recipes not on menu
    const highMarginRecipesNotOnMenu = recipes
      .filter((r) => !menuRecipeIds.has(r.id))
      .map((r) => {
        const costing = recipeCostingCalc.calculateRecipeCost(r);
        return { recipe: r, margin: costing.grossMargin };
      })
      .filter((item) => item.margin > 60)
      .map((item) => item.recipe);

    // Low margin recipes on menu
    const lowMarginRecipesOnMenu = menuItems
      .map((m) => ({
        menuItem: m,
        recipe: recipes.find((r) => r.id === m.recipeId),
      }))
      .filter((item): item is { menuItem: MenuItem; recipe: Recipe } => item.recipe !== undefined)
      .map((item) => {
        const costing = recipeCostingCalc.calculateRecipeCost(item.recipe);
        return {
          recipe: item.recipe,
          margin: costing.grossMargin,
          foodCost: costing.foodCostPercentage,
        };
      })
      .filter((item) => item.margin < 30 || item.foodCost > 40)
      .map((item) => item.recipe);

    // Analyze price points
    const prices = menuItems.map((m) => m.menuPrice).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      const gap = prices[i] - prices[i - 1];
      if (gap > prices[i - 1] * 0.5) {
        gaps.push((prices[i] + prices[i - 1]) / 2);
      }
    }

    return {
      highMarginRecipesNotOnMenu,
      lowMarginRecipesOnMenu,
      missingPricePoints: gaps,
    };
  }

  calculateMenuMixAnalysis(
    menuItems: MenuItem[],
    profitability: MenuProfitability
  ): {
    items: Array<{
      recipeName: string;
      menuPrice: number;
      salesMix: number;
      revenueMix: number;
      profitMix: number;
    }>;
    totalItems: number;
  } {
    const totalSales = menuItems.reduce((sum, m) => sum + m.estimatedWeeklySales, 0);
    const totalRevenue = profitability.totalRevenue;
    const totalProfit = profitability.totalProfit;

    const items = profitability.menuItems.map((item) => {
      const menuItem = menuItems.find((m) => m.recipeId === item.recipeId);
      const sales = menuItem?.estimatedWeeklySales || 0;

      return {
        recipeName: item.recipeName,
        menuPrice: item.menuPrice,
        salesMix: totalSales > 0 ? (sales / totalSales) * 100 : 0,
        revenueMix: totalRevenue > 0 ? (item.weeklyRevenue / totalRevenue) * 100 : 0,
        profitMix: totalProfit > 0 ? (item.weeklyProfit / totalProfit) * 100 : 0,
      };
    });

    return {
      items,
      totalItems: menuItems.length,
    };
  }
}

// ============================================================================
// Main Module Export
// ============================================================================

export class RecipeCostingModule {
  ingredientCosting: IngredientCosting;
  marginCalculator: MarginCalculator;
  wasteTracker: WasteTracker;
  recipeCostingCalculator: RecipeCostingCalculator;
  menuProfitabilityAnalyzer: MenuProfitabilityAnalyzer;

  constructor() {
    this.ingredientCosting = new IngredientCosting();
    this.marginCalculator = new MarginCalculator();
    this.wasteTracker = new WasteTracker(this.ingredientCosting);
    this.recipeCostingCalculator = new RecipeCostingCalculator(this.ingredientCosting);
    this.menuProfitabilityAnalyzer = new MenuProfitabilityAnalyzer(this.ingredientCosting);
  }

  // Convenience methods
  addIngredient(ingredient: Ingredient): void {
    this.ingredientCosting.addIngredient(ingredient);
  }

  calculateRecipeCost(recipe: Recipe): RecipeCosting {
    return this.recipeCostingCalculator.calculateRecipeCost(recipe);
  }

  analyzeMenu(recipes: Recipe[], menuItems: MenuItem[]): MenuProfitability {
    return this.menuProfitabilityAnalyzer.analyzeMenu(recipes, menuItems);
  }

  recordWaste(
    ingredientId: string,
    quantity: number,
    unit: string,
    reason: WasteReason
  ): WasteEntry {
    return this.wasteTracker.recordWaste(ingredientId, quantity, unit, reason);
  }

  getWasteSummary(startDate?: Date, endDate?: Date) {
    return this.wasteTracker.getWasteSummary(startDate, endDate);
  }

  suggestPrice(recipe: Recipe, targetMargin: number): number {
    return this.recipeCostingCalculator.suggestPrice(recipe, targetMargin);
  }

  calculateGrossMargin(sellingPrice: number, totalCost: number): number {
    return this.marginCalculator.calculateGrossMargin(sellingPrice, totalCost);
  }

  calculateMarginPercentage(sellingPrice: number, totalCost: number): number {
    return this.marginCalculator.calculateMarginPercentage(sellingPrice, totalCost);
  }

  calculateFoodCostPercentage(ingredientCost: number, sellingPrice: number): number {
    return this.marginCalculator.calculateFoodCostPercentage(ingredientCost, sellingPrice);
  }

  calculateTargetPrice(targetMargin: number, totalCost: number): number {
    return this.marginCalculator.calculateTargetPrice(targetMargin, totalCost);
  }

  calculateContributionMargin(
    sellingPrice: number,
    variableCost: number,
    fixedCost?: number
  ): { contribution: number; contributionRatio: number; breakEvenUnits: number } {
    return this.marginCalculator.calculateContributionMargin(sellingPrice, variableCost, fixedCost);
  }

  calculateMarkupPercentage(cost: number, sellingPrice: number): number {
    return this.marginCalculator.calculateMarkupPercentage(cost, sellingPrice);
  }

  calculatePriceWithMarkup(cost: number, markupPercentage: number): number {
    return this.marginCalculator.calculatePriceWithMarkup(cost, markupPercentage);
  }

  identifyMenuGaps(recipes: Recipe[], menuItems: MenuItem[]) {
    return this.menuProfitabilityAnalyzer.identifyMenuGaps(recipes, menuItems);
  }

  calculateMenuMixAnalysis(menuItems: MenuItem[], profitability: MenuProfitability) {
    return this.menuProfitabilityAnalyzer.calculateMenuMixAnalysis(menuItems, profitability);
  }
}

// Default export
export default RecipeCostingModule;

// Named exports for individual components
export {
  IngredientCosting,
  MarginCalculator,
  RecipeCostingCalculator,
  WasteTracker,
  MenuProfitabilityAnalyzer,
};
