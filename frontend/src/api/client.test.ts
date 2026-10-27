import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFieldArea, AreaValidationError } from './client';

describe('fetchFieldArea error handling (PRD §3.3 S4)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts nested detail.code and detail.message on HTTP 422 error', async () => {
    const errorBody = {
      detail: {
        code: 'POLYGON_SELF_INTERSECTION',
        message: 'Boundary edges cross each other. Fix the intersecting vertex to proceed.',
        kinks_count: 1
      }
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Content',
      json: async () => errorBody
    });

    const polygon: [number, number][] = [
      [77.58, 12.96],
      [77.59, 12.97],
      [77.58, 12.97],
      [77.59, 12.96],
      [77.58, 12.96]
    ];

    await expect(fetchFieldArea(polygon)).rejects.toThrow(AreaValidationError);
    try {
      await fetchFieldArea(polygon);
    } catch (err: any) {
      expect(err).toBeInstanceOf(AreaValidationError);
      expect(err.code).toBe('POLYGON_SELF_INTERSECTION');
      expect(err.message).toBe('Boundary edges cross each other. Fix the intersecting vertex to proceed.');
      expect(err.status).toBe(422);
    }
  });

  it('handles flat code and message if detail is absent', async () => {
    const errorBody = {
      code: 'AREA_TOO_SMALL',
      message: 'Plot area is 0.02 ha, minimum allowed is 0.05 ha.'
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Content',
      json: async () => errorBody
    });

    const polygon: [number, number][] = [
      [77.58, 12.96],
      [77.581, 12.96],
      [77.581, 12.961],
      [77.58, 12.96]
    ];

    try {
      await fetchFieldArea(polygon);
    } catch (err: any) {
      expect(err.code).toBe('AREA_TOO_SMALL');
      expect(err.message).toContain('0.02 ha');
    }
  });

  it('returns valid area response on HTTP 200', async () => {
    const successBody = {
      area_ha: 1.5,
      perimeter_m: 500,
      centroid: [77.585, 12.965],
      polygon_valid: true
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => successBody
    });

    const polygon: [number, number][] = [
      [77.58, 12.96],
      [77.59, 12.96],
      [77.59, 12.97],
      [77.58, 12.97],
      [77.58, 12.96]
    ];

    const result = await fetchFieldArea(polygon);
    expect(result.area_ha).toBe(1.5);
    expect(result.polygon_valid).toBe(true);
  });
});
