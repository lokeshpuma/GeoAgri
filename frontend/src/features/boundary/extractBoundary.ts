/**
 * Turns a Terra Draw snapshot into "what the user has actually drawn".
 *
 * Terra Draw keeps helper features in the same store as the user's shape: closing points,
 * coordinate points, snapping points, mid points, selection points. While a polygon is being
 * drawn it also holds an in-progress polygon (currentlyDrawing = true) whose last vertex is the
 * mouse cursor. Reading "the first Polygon in the snapshot" therefore treats an unfinished shape
 * as a finished boundary. This function is the only place that decides what counts.
 *
 * Property names verified against terra-draw 1.38.0.
 */
export type LngLat = [number, number];

export interface SnapshotFeature {
  id?: string | number;
  geometry: { type: string; coordinates: unknown };
  properties?: Record<string, unknown>;
}

export type DrawStatus = 'none' | 'drawing' | 'ready';

export interface ExtractResult {
  status: DrawStatus;
  polygon: LngLat[] | null;   // closed ring, [lng, lat]
  pin: LngLat | null;
  note?: 'multiple_polygons' | 'polygon_and_pin';
}

const GUIDANCE_KEYS = ['closingPoint', 'midPoint', 'selectionPoint', 'snappingPoint', 'coordinatePoint'] as const;
const POLYGON_MODES = new Set(['polygon', 'rectangle', 'circle', 'freehand']);

export function isGuidance(f: SnapshotFeature): boolean {
  const p = f.properties ?? {};
  return GUIDANCE_KEYS.some((k) => p[k] === true);
}

function closeRing(ring: LngLat[]): LngLat[] {
  if (ring.length === 0) return ring;
  const a = ring[0];
  const b = ring[ring.length - 1];
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, a];
}

export function extractBoundary(features: SnapshotFeature[] | null | undefined): ExtractResult {
  const real = (features ?? []).filter((f) => !isGuidance(f));

  const polygons = real.filter(
    (f) => f.geometry?.type === 'Polygon' && POLYGON_MODES.has(String(f.properties?.mode)),
  );
  const pins = real.filter((f) => f.geometry?.type === 'Point' && f.properties?.mode === 'point');

  const inProgress = polygons.some((f) => f.properties?.currentlyDrawing === true);
  const finished = polygons.filter((f) => f.properties?.currentlyDrawing !== true);

  if (finished.length > 0) {
    // Single-polygon policy: if more than one exists, the most recently updated wins.
    const pick = [...finished].sort(
      (a, b) => Number(b.properties?.updatedAt ?? 0) - Number(a.properties?.updatedAt ?? 0),
    )[0];
    const ring = closeRing((pick.geometry.coordinates as LngLat[][])[0]);
    const note = finished.length > 1 ? 'multiple_polygons' : pins.length > 0 ? 'polygon_and_pin' : undefined;
    return { status: inProgress ? 'drawing' : 'ready', polygon: ring, pin: null, note };
  }
  if (inProgress) return { status: 'drawing', polygon: null, pin: null };
  if (pins.length > 0) {
    const latest = [...pins].sort((a, b) => Number(b.properties?.updatedAt ?? 0) - Number(a.properties?.updatedAt ?? 0))[0];
    return { status: 'ready', polygon: null, pin: latest.geometry.coordinates as LngLat };
  }
  return { status: 'none', polygon: null, pin: null };
}
