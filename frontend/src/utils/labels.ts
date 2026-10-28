/**
 * Shared agronomic and category label mappings (PRD v3.3 §3.3 item 5).
 * Prevents raw snake_case tokens from reaching user-facing cards and UI elements.
 */

export const LIMITING_FACTOR_LABELS: Record<string, string> = {
  climatic_envelope: 'Climate fit',
  temperature: 'Temperature',
  rainfall: 'Rainfall',
  ph: 'Soil pH',
  altitude: 'Altitude',
  frost: 'Frost',
  texture: 'Soil texture',
  none: 'None',
};

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'All Crops',
  cereal: 'Cereals',
  cereals: 'Cereals',
  pulse: 'Pulses',
  pulses: 'Pulses',
  vegetable: 'Vegetables',
  vegetables: 'Vegetables',
  fruit_nut: 'Fruits & Nuts',
  fruits_nuts: 'Fruits & Nuts',
  oilseed: 'Oilseeds',
  oilseeds: 'Oilseeds',
  root_tuber: 'Roots & Tubers',
  roots_tubers: 'Roots & Tubers',
  spice: 'Spices & Herbs',
  spices: 'Spices & Herbs',
  medicinal_aromatic: 'Spices & Herbs',
  fodder: 'Fodder',
  cash_crops: 'Cash / Industrial',
  cash_industrial: 'Cash / Industrial',
  plantation: 'Plantation',
  general: 'General',
};

export function formatLimitingFactor(factor: string | null | undefined): string {
  if (!factor) return 'None';
  const key = factor.toLowerCase().trim();
  if (LIMITING_FACTOR_LABELS[key]) {
    return LIMITING_FACTOR_LABELS[key];
  }
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function formatCropCategory(category: string | null | undefined): string {
  if (!category) return 'General';
  const key = category.toLowerCase().trim();
  if (CATEGORY_LABELS[key]) {
    return CATEGORY_LABELS[key];
  }
  return key
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

