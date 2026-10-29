import { describe, it, expect } from 'vitest';
import {
  interpretNDVI,
  interpretNDMI,
  interpretNDWI,
  interpretRainfall,
  interpretTemperature,
  interpretPH,
  interpretOrganicCarbon,
  interpretTerrain,
  interpretRadar,
  generateAgronomicRecommendation
} from './agronomicFormatters';

describe('Truthful Agronomic Formatters (PRD v3.4 §3.4, AC-4, AC-5)', () => {
  it('returns truthful "Not available" when NDVI is null or undefined', () => {
    const resNull = interpretNDVI(null);
    expect(resNull.value).toBe('Not available');
    expect(resNull.rating).toBe('neutral');

    const resUndef = interpretNDVI(undefined);
    expect(resUndef.value).toBe('Not available');
  });

  it('returns truthful "Not available" when rainfall is null or undefined', () => {
    const res = interpretRainfall(null);
    expect(res.value).toBe('Not available');
    expect(res.rating).toBe('neutral');
  });

  it('returns truthful "Not available" when temperature is null or undefined', () => {
    const res = interpretTemperature(null);
    expect(res.value).toBe('Not available');
    expect(res.rating).toBe('neutral');
  });

  it('returns truthful "Not available" when soil properties are null', () => {
    const resPH = interpretPH(null);
    expect(resPH.value).toBe('Not available');

    const resSOC = interpretOrganicCarbon(null);
    expect(resSOC.value).toBe('Not available');
  });

  it('returns truthful "Not available" when terrain or radar are null', () => {
    const resTerrain = interpretTerrain(null, null);
    expect(resTerrain.value).toBe('Not available');

    const resRadar = interpretRadar(null, null);
    expect(resRadar.value).toBe('Not available');
  });

  it('generates truthful summary without crashes when environmental metrics are missing', () => {
    const emptyReport = {
      environment: null,
      satellite_features: null,
      land_suitability: { grade: "Moderate", score: 0.65, confidence: 0.8 },
      irrigation_summary: null,
      climate_risk_summary: null,
      recommended_crops: []
    };
    const rec = generateAgronomicRecommendation(emptyReport);
    expect(rec).toContain('NDVI: N/A');
    expect(rec).toContain('pH: N/A');
  });
});

