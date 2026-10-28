import { describe, it, expect } from 'vitest';
import { formatCropCategory, formatLimitingFactor, CATEGORY_LABELS, LIMITING_FACTOR_LABELS } from './labels';

describe('labels utility (PRD v3.3 §3.3 item 5)', () => {
  it('maps all standard limiting factor tokens to clean human readable labels', () => {
    expect(formatLimitingFactor('climatic_envelope')).toBe('Climate fit');
    expect(formatLimitingFactor('temperature')).toBe('Temperature');
    expect(formatLimitingFactor('rainfall')).toBe('Rainfall');
    expect(formatLimitingFactor('ph')).toBe('Soil pH');
    expect(formatLimitingFactor('altitude')).toBe('Altitude');
    expect(formatLimitingFactor('frost')).toBe('Frost');
    expect(formatLimitingFactor('texture')).toBe('Soil texture');
  });

  it('maps all category tokens to clean human readable labels without snake_case', () => {
    expect(formatCropCategory('cash_crops')).toBe('Cash / Industrial');
    expect(formatCropCategory('cash_industrial')).toBe('Cash / Industrial');
    expect(formatCropCategory('root_tuber')).toBe('Roots & Tubers');
    expect(formatCropCategory('fruit_nut')).toBe('Fruits & Nuts');
    expect(formatCropCategory('medicinal_aromatic')).toBe('Spices & Herbs');
    expect(formatCropCategory('cereals')).toBe('Cereals');
    expect(formatCropCategory('pulses')).toBe('Pulses');
  });

  it('ensures no label mapping returns snake_case', () => {
    const snakeCaseRegex = /[a-z]+_[a-z]+/;
    for (const val of Object.values(LIMITING_FACTOR_LABELS)) {
      expect(val).not.toMatch(snakeCaseRegex);
    }
    for (const val of Object.values(CATEGORY_LABELS)) {
      expect(val).not.toMatch(snakeCaseRegex);
    }
  });
});

