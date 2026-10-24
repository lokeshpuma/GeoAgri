import { BasemapId } from './boundaryTypes';

export interface BasemapConfig {
  id: BasemapId;
  label: string;
  attribution: string;
}

export const BASEMAPS: Record<BasemapId, BasemapConfig> = {
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, USDA, USGS, AeroGRID, IGN, and the GIS User Community',
  },
  streets: {
    id: 'streets',
    label: 'Streets',
    attribution: '© OpenStreetMap contributors, CartoDB',
  },
  terrain: {
    id: 'terrain',
    label: 'Terrain',
    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap',
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    attribution: '© OpenStreetMap contributors, CartoDB',
  },
};

export const BASEMAP_LAYER_IDS: Record<BasemapId, string> = {
  satellite: 'basemap-layer-satellite',
  streets: 'basemap-layer-streets',
  terrain: 'basemap-layer-terrain',
  dark: 'basemap-layer-dark',
};

/**
 * Unified multi-basemap MapLibre style.
 * Pre-defines all raster sources and layers so that switching basemaps
 * is an instantaneous, zero-flash visibility toggle that never resets
 * GeoJSON boundary polygon sources or WebGL context.
 *
 * Notice layer maxzoom: 24 enables overzooming raster imagery down to
 * high-resolution parcel scales (< 30m window).
 */
export const UNIFIED_MAP_STYLE: any = {
  version: 8,
  sources: {
    'esri-satellite': {
      type: 'raster',
      tiles: [
        import.meta.env.VITE_SATELLITE_TILES_URL ||
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; USDA, USGS, AeroGRID, IGN',
    },
    'osm-streets': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
    'opentopomap': {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 17,
      attribution: '&copy; OpenStreetMap &copy; OpenTopoMap',
    },
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'basemap-layer-dark',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 24,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 1.0 },
    },
    {
      id: 'basemap-layer-terrain',
      type: 'raster',
      source: 'opentopomap',
      minzoom: 0,
      maxzoom: 24,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 1.0 },
    },
    {
      id: 'basemap-layer-streets',
      type: 'raster',
      source: 'osm-streets',
      minzoom: 0,
      maxzoom: 24,
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 1.0 },
    },
    {
      id: 'basemap-layer-satellite',
      type: 'raster',
      source: 'esri-satellite',
      minzoom: 0,
      maxzoom: 24,
      layout: { visibility: 'visible' },
      paint: { 'raster-opacity': 1.0 },
    },
  ],
};
