/**
 * Unified Inventory Engine - ONE STOCK ACROSS VERTICALS
 * Restaurant + Hotel + Salon + Fitness + Retail
 */

export interface UniversalProduct {
  // Identity
  product_id: string;
  sku: string;
  barcodes: string[];

  // Classification
  verticals: Vertical[];
  categories: string[];
  tags: string[];

  // Inventory by location
  inventory: Record<string, LocationStock>;

  // Pricing by location
  pricing: Record<string, LocationPricing>;

  // Suppliers
  suppliers: Supplier[];

  // Channel listings
  channels: ChannelListing[];

  // AI predictions
  ai_predictions: AIPredictions;

  updated_at: string;
}

export type Vertical = 'restaurant' | 'hotel' | 'salon' | 'fitness' | 'retail' | 'grocery';

export interface LocationStock {
  available: number;
  reserved: number;
  damaged: number;
  in_transit: number;
  reorder_point: number;
  reorder_qty: number;
}

export interface LocationPricing {
  mrp: number;
  selling_price: number;
  cost_price: number;
  margin_percent: number;
}

export interface Supplier {
  supplier_id: string;
  name: string;
  lead_time_days: number;
  moq: number;
  cost_per_unit: number;
}

export interface ChannelListing {
  channel: 'zomato' | 'swiggy' | 'amazon' | 'myntra' | 'flipkart';
  listed: boolean;
  channel_product_id: string;
  channel_price: number;
  channel_stock: number;
  last_sync: string;
}

export interface AIPredictions {
  demand_forecast_30d: number;
  optimal_stock_level: number;
  best_selling_hours: string[];
  seasonal_factor: number;
  reorder_recommended: boolean;
}
