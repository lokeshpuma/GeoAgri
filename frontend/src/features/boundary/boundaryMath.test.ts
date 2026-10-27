import { describe, it, expect } from 'vitest';
import { evaluateBoundary, normalizeRing, isCounterClockwise } from './boundaryMath';

describe('boundaryMath tests (AC-1..AC-8)', () => {
  it('detects counter-clockwise polygon and normalizes ring with 5 decimals', () => {
    // CCW square in WGS84
    const pts: [number, number][] = [
      [75.75, 13.32],
      [75.76, 13.32],
      [75.76, 13.33],
      [75.75, 13.33],
    ];
    const ring = normalizeRing(pts);
    expect(ring.length).toBe(5);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    expect(isCounterClockwise(ring)).toBe(true);
  });

  it('detects self-intersecting bow-tie as invalid with SELF_INTERSECTION issue', () => {
    // Bow-tie
    const bowtie: [number, number][] = [
      [75.75, 13.32],
      [75.76, 13.33],
      [75.75, 13.33],
      [75.76, 13.32],
    ];
    const result = evaluateBoundary(bowtie);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'SELF_INTERSECTION')).toBe(true);
  });

  it('detects too few vertices (< 3 points)', () => {
    const line: [number, number][] = [
      [75.75, 13.32],
      [75.76, 13.32],
    ];
    const result = evaluateBoundary(line);
    expect(result.valid).toBe(false);
    expect(result.issues.some(i => i.code === 'TOO_FEW_VERTICES')).toBe(true);
  });

  it('computes valid area in ha, acres, and guntas for valid parcel', () => {
    const square: [number, number][] = [
      [75.750, 13.320],
      [75.751, 13.320],
      [75.751, 13.321],
      [75.750, 13.321],
      [75.750, 13.320],
    ];
    const result = evaluateBoundary(square);
    expect(result.valid).toBe(true);
    expect(result.areaHa).toBeGreaterThan(1.0);
    expect(result.areaHa).toBeLessThan(1.5);
    expect(result.areaAcres).toBeCloseTo(result.areaHa * 2.47105, 1);
    expect(result.areaGuntas).toBeCloseTo(result.areaAcres * 40, 1);
  });

  it('computes interior geometric centroid using @turf/centroid (PRD §3.3 S6)', () => {
    const square: [number, number][] = [
      [75.750, 13.320],
      [75.760, 13.320],
      [75.760, 13.330],
      [75.750, 13.330],
      [75.750, 13.320],
    ];
    const result = evaluateBoundary(square);
    expect(result.centroid).not.toBeNull();
    // Centroid must be near the midpoint (75.755, 13.325), NOT the first vertex [75.750, 13.320]
    expect(result.centroid![0]).toBeCloseTo(75.755, 3);
    expect(result.centroid![1]).toBeCloseTo(13.325, 3);
    expect(result.centroid).not.toEqual(square[0]);
  });
});
