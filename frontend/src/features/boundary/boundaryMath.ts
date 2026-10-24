import area from '@turf/area';
import length from '@turf/length';
import kinks from '@turf/kinks';
import centroid from '@turf/centroid';
import simplify from '@turf/simplify';
import booleanValid from '@turf/boolean-valid';
import { BoundaryValidationResult, ValidityIssue } from './boundaryTypes';

export const FIELD_MIN_HA = 0.01; // ~100 m2
export const FIELD_MAX_HA = 1000.0;

/**
 * Calculates if coordinates form a counter-clockwise ring (positive signed area)
 */
export function isCounterClockwise(coords: [number, number][]): boolean {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x1, y1] = coords[i];
    const [x2, y2] = coords[i + 1];
    sum += (x2 - x1) * (y2 + y1);
  }
  return sum < 0; // In standard Cartesian, negative signed area is CCW
}

/**
 * Enforces closed counter-clockwise ring with 5 decimal precision
 */
export function normalizeRing(coords: [number, number][]): [number, number][] {
  if (coords.length < 3) return coords;

  const rounded = coords.map(([lng, lat]) => [
    Number(lng.toFixed(5)),
    Number(lat.toFixed(5)),
  ]) as [number, number][];

  // Ensure closed
  const first = rounded[0];
  const last = rounded[rounded.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    rounded.push([first[0], first[1]]);
  }

  // Ensure CCW
  if (!isCounterClockwise(rounded)) {
    const closed = rounded.slice(0, -1).reverse();
    closed.push([closed[0][0], closed[0][1]]);
    return closed;
  }

  return rounded;
}

/**
 * Evaluates geometry validity according to PRD §5.4 & §7
 */
export function evaluateBoundary(coords: [number, number][]): BoundaryValidationResult {
  const issues: ValidityIssue[] = [];

  if (!coords || coords.length === 0) {
    return {
      valid: false,
      issues: [{ code: 'TOO_FEW_VERTICES', message: 'No boundary drawn.' }],
      areaHa: 0,
      areaAcres: 0,
      areaGuntas: 0,
      perimeterM: 0,
      vertexCount: 0,
      centroid: null,
    };
  }

  // Check unique points excluding closure
  const uniqueCount =
    coords.length > 1 &&
    coords[0][0] === coords[coords.length - 1][0] &&
    coords[0][1] === coords[coords.length - 1][1]
      ? coords.length - 1
      : coords.length;

  if (uniqueCount < 3) {
    issues.push({
      code: 'TOO_FEW_VERTICES',
      message: 'Polygon must have at least 3 distinct corners.',
    });
  }

  // Check coordinate bounds & antimeridian
  let crossesAntimeridian = false;
  let invalidCoords = false;
  let hasPositiveLng = false;
  let hasNegativeLng = false;

  for (const [lng, lat] of coords) {
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      invalidCoords = true;
    }
    if (lng > 170) hasPositiveLng = true;
    if (lng < -170) hasNegativeLng = true;
  }

  if (hasPositiveLng && hasNegativeLng) {
    crossesAntimeridian = true;
  }

  if (invalidCoords) {
    issues.push({
      code: 'INVALID_COORDINATES',
      message: 'Coordinates exceed standard WGS84 range.',
    });
  }

  if (crossesAntimeridian) {
    issues.push({
      code: 'ANTIMERIDIAN',
      message: 'Boundaries crossing the 180° antimeridian are not supported.',
    });
  }

  // Ensure closed for GeoJSON polygon
  const closedCoords = normalizeRing(coords);

  const polyFeature: any = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [closedCoords],
    },
  };

  const lineFeature: any = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: closedCoords,
    },
  };

  // Self-intersection check
  try {
    const selfIntersections = kinks(polyFeature);
    if (selfIntersections.features && selfIntersections.features.length > 0) {
      issues.push({
        code: 'SELF_INTERSECTION',
        message: 'Edges cross each other (bow-tie shape).',
      });
    }
  } catch {
    // If kinks check fails, fallback to booleanValid
  }

  try {
    if (!booleanValid(polyFeature)) {
      if (!issues.some(i => i.code === 'SELF_INTERSECTION')) {
        issues.push({
          code: 'SELF_INTERSECTION',
          message: 'Boundary geometry is mathematically invalid.',
        });
      }
    }
  } catch {
    // ignore
  }

  // Area & perimeter calculations
  let areaM2 = 0;
  let perimeterM = 0;
  let centerPt: [number, number] | null = null;

  try {
    areaM2 = area(polyFeature);
    perimeterM = length(lineFeature, { units: 'meters' });
    const c = centroid(polyFeature);
    centerPt = c.geometry.coordinates as [number, number];
  } catch {
    // geometry could not be measured
  }

  const areaHa = areaM2 / 10000;
  const areaAcres = areaM2 / 4046.8564224;
  const areaGuntas = areaAcres * 40;

  if (areaHa < FIELD_MIN_HA) {
    issues.push({
      code: 'TOO_SMALL',
      message: `Area (${areaHa.toFixed(3)} ha) is below minimum of ${FIELD_MIN_HA} ha.`,
    });
  } else if (areaHa > FIELD_MAX_HA) {
    issues.push({
      code: 'TOO_LARGE',
      message: `Area (${areaHa.toFixed(1)} ha) exceeds maximum limit of ${FIELD_MAX_HA} ha.`,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
    areaHa,
    areaAcres,
    areaGuntas,
    perimeterM,
    vertexCount: uniqueCount,
    centroid: centerPt,
  };
}

/**
 * Freehand simplification capped at 200 vertices
 */
export function simplifyFreehand(coords: [number, number][]): [number, number][] {
  if (coords.length <= 4) return coords;

  const line: any = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: coords,
    },
  };

  try {
    const simplified = simplify(line, { tolerance: 0.00005, highQuality: true });
    let res = simplified.geometry.coordinates as [number, number][];
    if (res.length > 200) {
      // Step down resolution if vertex count exceeds 200
      const coarser = simplify(line, { tolerance: 0.00015, highQuality: true });
      res = coarser.geometry.coordinates as [number, number][];
    }
    return res;
  } catch {
    return coords;
  }
}
