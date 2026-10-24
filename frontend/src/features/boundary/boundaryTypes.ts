export type BoundaryMode = 'none' | 'polygon' | 'pin';

export interface BoundaryState {
  mode: BoundaryMode;
  polygon: [number, number][] | null; // closed ring, [lng, lat]
  pin: [number, number] | null;
  name: string; // user plot name
  areaHa: number | null; // server-verified; null for pin or unverified
  areaSource: 'server' | 'client-estimate' | null;
  confirmed: boolean;
  source: 'drawn' | 'demo';
}

export type DrawTool =
  | 'pan'
  | 'polygon'
  | 'rectangle'
  | 'circle'
  | 'freehand'
  | 'select'
  | 'pin';

export type BasemapId = 'satellite' | 'streets' | 'terrain' | 'dark';

export interface ValidityIssue {
  code:
    | 'SELF_INTERSECTION'
    | 'TOO_FEW_VERTICES'
    | 'TOO_SMALL'
    | 'TOO_LARGE'
    | 'NOT_CLOSED'
    | 'ANTIMERIDIAN'
    | 'INVALID_COORDINATES';
  message: string;
}

export interface BoundaryValidationResult {
  valid: boolean;
  issues: ValidityIssue[];
  areaHa: number;
  areaAcres: number;
  areaGuntas: number;
  perimeterM: number;
  vertexCount: number;
  centroid: [number, number] | null;
}
