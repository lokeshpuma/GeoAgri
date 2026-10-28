import { describe, it, expect } from 'vitest';
import { extractBoundary, type SnapshotFeature } from './extractBoundary';

const sq = [[75.7, 13.3], [75.71, 13.3], [75.71, 13.31], [75.7, 13.31], [75.7, 13.3]];
const poly = (props: Record<string, unknown>, ring = sq): SnapshotFeature => ({
  geometry: { type: 'Polygon', coordinates: [ring] }, properties: { mode: 'polygon', ...props },
});
const pt = (props: Record<string, unknown>, c = [75.7, 13.3]): SnapshotFeature => ({
  geometry: { type: 'Point', coordinates: c }, properties: props,
});

describe('extractBoundary', () => {
  it('empty store -> none', () => {
    expect(extractBoundary([]).status).toBe('none');
    expect(extractBoundary(null).status).toBe('none');
  });

  it('polygon still being drawn is NOT a boundary (cursor vertex, closing points)', () => {
    const r = extractBoundary([
      poly({ currentlyDrawing: true }),
      pt({ mode: 'polygon', closingPoint: true }),
      pt({ mode: 'polygon', coordinatePoint: true }),
    ]);
    expect(r.status).toBe('drawing');
    expect(r.polygon).toBeNull();
  });

  it('finished polygon -> ready, helper points ignored', () => {
    const r = extractBoundary([
      poly({}),
      pt({ mode: 'select', selectionPoint: true }),
      pt({ mode: 'select', midPoint: true }),
      pt({ mode: 'polygon', snappingPoint: true }),
    ]);
    expect(r.status).toBe('ready');
    expect(r.polygon).toHaveLength(5);
    expect(r.pin).toBeNull();
  });

  it('selection/mid points alone are never mistaken for a pin', () => {
    const r = extractBoundary([pt({ mode: 'select', selectionPoint: true }), pt({ mode: 'select', midPoint: true })]);
    expect(r.status).toBe('none');
    expect(r.pin).toBeNull();
  });

  it('real pin -> ready with coordinates', () => {
    const r = extractBoundary([pt({ mode: 'point' }, [77.1, 12.9])]);
    expect(r).toMatchObject({ status: 'ready', pin: [77.1, 12.9], polygon: null });
  });

  it('two polygons: most recent wins and the caller is told', () => {
    const older = poly({ updatedAt: 1 }, [[0, 0], [1, 0], [1, 1], [0, 0]]);
    const newer = poly({ updatedAt: 2 });
    const r = extractBoundary([older, newer]);
    expect(r.note).toBe('multiple_polygons');
    expect(r.polygon?.[0]).toEqual([75.7, 13.3]);
  });

  it('un-closed ring is closed', () => {
    const r = extractBoundary([poly({}, sq.slice(0, 4))]);
    expect(r.polygon?.[0]).toEqual(r.polygon?.[r.polygon.length - 1]);
  });

  it('a second polygon started while the first exists: status is drawing, first is kept', () => {
    const r = extractBoundary([poly({}), poly({ currentlyDrawing: true }, [[1, 1], [2, 1], [2, 2], [1, 1]])]);
    expect(r.status).toBe('drawing');
    expect(r.polygon).not.toBeNull();
  });
});
