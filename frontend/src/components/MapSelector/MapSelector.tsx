import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  Layers,
  MapPin,
  Plus,
  Minus,
  Crosshair,
  Navigation,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  Check,
  Upload
} from 'lucide-react';
import { fetchFieldArea, FullReportResponse } from '../../api/client';

export interface MapSelectorProps {
  onPolygonChange: (polygon: [number, number][], areaHa: number, name?: string) => void;
  onPointChange: (point: [number, number], name?: string) => void;
  initialPolygon?: [number, number][];
  initialArea?: number;
  selectedPoint?: [number, number];
  report?: FullReportResponse | null;
  isPredicted?: boolean;
}

export type AnalysisLayerType = 'standard' | 'satellite' | 'terrain';

/**
 * Returns clean, minimal, agriculture-focused MapLibre style JSON.
 * Honors VITE_MAP_STYLE_URL / NEXT_PUBLIC_MAP_STYLE_URL if configured.
 */
function getMapStyleDefinition(): string | maplibregl.StyleSpecification {
  const metaEnv = (import.meta as any)?.env;
  const envUrl =
    (metaEnv && (metaEnv.VITE_MAP_STYLE_URL || metaEnv.NEXT_PUBLIC_MAP_STYLE_URL)) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).NEXT_PUBLIC_MAP_STYLE_URL) ||
    '';

  // Use external style only if explicitly configured with a full tile service (ignore demotiles which lacks satellite/terrain raster layers)
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0 && !envUrl.includes('demotiles.maplibre.org')) {
    return envUrl.trim();
  }

  // Clean OpenStreetMap, Esri Satellite, and OpenTopoMap tile specs
  return {
    version: 8,
    name: 'GeoAgri Clean OSM',
    sources: {
      'osm-voyager': {
        type: 'raster',
        tiles: [
          'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
        maxzoom: 19
      },
      'satellite-imagery': {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: '&copy; Esri, Earthstar Geographics',
        maxzoom: 19
      },
      'opentopo-imagery': {
        type: 'raster',
        tiles: [
          'https://tile.opentopomap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution:
          '&copy; <a href="https://opentopomap.org" target="_blank" rel="noreferrer">OpenTopoMap</a> (CC-BY-SA)',
        maxzoom: 17
      }
    },
    layers: [
      {
        id: 'osm-base-layer',
        type: 'raster',
        source: 'osm-voyager',
        minzoom: 0,
        maxzoom: 19,
        layout: {
          visibility: 'visible'
        }
      },
      {
        id: 'satellite-base-layer',
        type: 'raster',
        source: 'satellite-imagery',
        minzoom: 0,
        maxzoom: 19,
        layout: {
          visibility: 'none'
        }
      },
      {
        id: 'opentopo-base-layer',
        type: 'raster',
        source: 'opentopo-imagery',
        minzoom: 0,
        maxzoom: 17,
        layout: {
          visibility: 'none'
        }
      }
    ]
  };
}

export const MapSelector: React.FC<MapSelectorProps> = ({
  onPolygonChange,
  onPointChange,
  initialPolygon = [],
  initialArea = 0,
  selectedPoint,
  report = null,
  isPredicted = false
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);

  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [polygonPts, setPolygonPts] = useState<[number, number][]>(initialPolygon);
  const [areaHa, setAreaHa] = useState<number>(initialArea);
  const [activeLayer, setActiveLayer] = useState<AnalysisLayerType>('standard');
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // Compute current display coordinates [lng, lat]
  const currentLng = selectedPoint ? selectedPoint[0] : polygonPts[0] ? polygonPts[0][0] : 0;
  const currentLat = selectedPoint ? selectedPoint[1] : polygonPts[0] ? polygonPts[0][1] : 20;

  // Update base layer styling when activeLayer changes
  const applyLayerStyling = useCallback((map: maplibregl.Map, layer: AnalysisLayerType) => {
    if (!map.isStyleLoaded()) return;

    // Toggle base raster tiles
    if (map.getLayer('satellite-base-layer') && map.getLayer('osm-base-layer')) {
      if (layer === 'satellite') {
        map.setLayoutProperty('satellite-base-layer', 'visibility', 'visible');
        map.setLayoutProperty('osm-base-layer', 'visibility', 'none');
        if (map.getLayer('opentopo-base-layer')) map.setLayoutProperty('opentopo-base-layer', 'visibility', 'none');
      } else if (layer === 'terrain') {
        if (map.getLayer('opentopo-base-layer')) map.setLayoutProperty('opentopo-base-layer', 'visibility', 'visible');
        map.setLayoutProperty('osm-base-layer', 'visibility', 'none');
        map.setLayoutProperty('satellite-base-layer', 'visibility', 'none');
      } else {
        map.setLayoutProperty('osm-base-layer', 'visibility', 'visible');
        map.setLayoutProperty('satellite-base-layer', 'visibility', 'none');
        if (map.getLayer('opentopo-base-layer')) map.setLayoutProperty('opentopo-base-layer', 'visibility', 'none');
      }
    }
  }, []);

  // Initialize MapLibre GL map
  const initMap = useCallback(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    setMapLoaded(false);
    setLoadError(null);

    try {
      const initialCenter: [number, number] = [currentLng, currentLat];

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: getMapStyleDefinition(),
        center: initialCenter,
        zoom: 14,
        pitch: 0,
        bearing: 0,
        attributionControl: false // Custom minimal attribution
      });

      map.addControl(
        new maplibregl.AttributionControl({
          compact: true
        }),
        'bottom-right'
      );

      // Custom GeoAgri Marker element
      const markerEl = document.createElement('div');
      markerEl.className = 'geoagri-map-marker';
      markerEl.setAttribute('role', 'img');
      markerEl.setAttribute('aria-label', 'Selected field location');
      markerEl.innerHTML = `
        <div class="marker-floating-label">Selected Field</div>
        <div class="marker-pin">
          <div class="marker-pulse-ring"></div>
          <div class="marker-core"></div>
        </div>
        <div class="marker-pointer"></div>
      `;

      const marker = new maplibregl.Marker({
        element: markerEl,
        anchor: 'bottom'
      })
        .setLngLat(initialCenter)
        .addTo(map);

      markerRef.current = marker;

      map.on('load', () => {
        setMapLoaded(true);
        applyLayerStyling(map, activeLayer);

        // Add boundary polygon source and layers
        const geojson: any = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: polygonPts && polygonPts.length >= 3 ? [polygonPts] : []
          }
        };

        if (!map.getSource('field-polygon-source')) {
          map.addSource('field-polygon-source', {
            type: 'geojson',
            data: geojson
          });

          map.addLayer({
            id: 'field-polygon-fill',
            type: 'fill',
            source: 'field-polygon-source',
            paint: {
              'fill-color': '#10b981',
              'fill-opacity': 0.28
            }
          });

          map.addLayer({
            id: 'field-polygon-line',
            type: 'line',
            source: 'field-polygon-source',
            paint: {
              'line-color': '#10b981',
              'line-width': 2.5
            }
          });
        }

        // Resize to ensure crisp canvas
        map.resize();
      });

      // Handle map click for location reselection
      map.on('click', (e: any) => {
        const lng = Number(e.lngLat.lng.toFixed(5));
        const lat = Number(e.lngLat.lat.toFixed(5));

        marker.setLngLat([lng, lat]);
        setPolygonPts([]);

        onPointChange([lng, lat], `Custom Location (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`);
      });

      map.on('error', (e: any) => {
        console.warn("MapLibre tile notice:", e);
      });

      mapRef.current = map;
    } catch (err: any) {
      console.error("MapLibre initialization error:", err);
      setLoadError(err?.message || "Failed to initialize MapLibre WebGL context.");
    }
  }, [currentLat, currentLng, initialPolygon, applyLayerStyling, onPointChange, activeLayer]);

  // Initial mount effect
  useEffect(() => {
    initMap();

    const handleResize = () => {
      mapRef.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update styling when activeLayer changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      applyLayerStyling(mapRef.current, activeLayer);
    }
  }, [activeLayer, mapLoaded, applyLayerStyling]);

  // Update polygon overlay when polygonPts changes
  useEffect(() => {
    if (mapRef.current && mapLoaded) {
      const src = mapRef.current.getSource('field-polygon-source') as maplibregl.GeoJSONSource | undefined;
      if (src) {
        src.setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: polygonPts && polygonPts.length >= 3 ? [polygonPts] : []
          }
        });
      }
    }
  }, [polygonPts, mapLoaded]);



  // Zoom handlers
  const handleZoomIn = () => {
    mapRef.current?.zoomIn({ duration: 300 });
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut({ duration: 300 });
  };

  // Center on current selection
  const handleCenterField = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [currentLng, currentLat],
        zoom: 14,
        essential: true
      });
    }
  };

  // Locate Me using browser geolocation
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));

        if (mapRef.current) {
          mapRef.current.flyTo({ center: [lng, lat], zoom: 15, speed: 1.2 });
        }
        if (markerRef.current) {
          markerRef.current.setLngLat([lng, lat]);
        }

        setPolygonPts([]);
        onPointChange([lng, lat], `Current Location (${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E)`);
      },
      (err) => {
        setIsLocating(false);
        console.warn("Geolocation prompt error:", err.message);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  return (
    <div className="glass-card map-card-container">
      {/* 1. Header Bar */}
      <div className="map-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="map-title-icon">
            <Layers style={{ color: 'var(--accent-green)' }} size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              Field Location & Map
            </h3>
            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
              Clean OpenStreetMap • MapLibre GL JS
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-high" style={{ fontSize: '0.78rem', padding: '4px 10px' }}>
            {areaHa > 0 ? `${areaHa.toFixed(2)} Ha Target Area` : "Target Coordinate"}
          </span>
        </div>
      </div>

      {/* 2. Map Viewport & Overlays */}

      {/* 3. Map Viewport & Overlays */}
      <div className="map-viewport-wrapper">
        <div
          ref={mapContainerRef}
          className="maplibre-container"
          tabIndex={0}
          aria-label="Interactive field location map. Drag to pan, click to set field coordinates."
        />

        {/* Loading Overlay */}
        {!mapLoaded && !loadError && (
          <div className="map-loading-overlay">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <RefreshCw size={26} className="animate-spin" style={{ color: 'var(--accent-green)' }} />
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Loading GeoAgri Map...
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Initializing clean OpenStreetMap geographic data
              </span>
            </div>
          </div>
        )}

        {/* Error State Fallback */}
        {loadError && (
          <div className="map-error-overlay">
            <AlertTriangle size={32} style={{ color: 'var(--accent-amber)', marginBottom: '8px' }} />
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1rem', color: 'var(--text-main)' }}>
              Map could not be loaded
            </h4>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
              {loadError}
            </p>
            <button
              type="button"
              className="btn-secondary"
              onClick={initMap}
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
            >
              <RefreshCw size={14} />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Floating Location Information Overlay */}
        <div className="map-floating-panel">
          <div className="floating-panel-title">
            <MapPin size={12} style={{ color: 'var(--accent-green)' }} />
            <span>SELECTED LOCATION</span>
          </div>
          <div className="floating-panel-coords">
            {currentLat.toFixed(4)}° N, {currentLng.toFixed(4)}° E
          </div>
          <div className="floating-panel-hint">
            Click another point to change location
          </div>
        </div>

        {/* Floating Minimal Map Controls */}
        <div className="map-controls-group" role="toolbar" aria-label="Map Navigation Controls">
          <button
            type="button"
            onClick={handleZoomIn}
            className="map-ctrl-btn"
            title="Zoom In"
            aria-label="Zoom in"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="map-ctrl-btn"
            title="Zoom Out"
            aria-label="Zoom out"
          >
            <Minus size={16} />
          </button>
          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className={`map-ctrl-btn ${isLocating ? 'locating' : ''}`}
            title="Use My Location"
            aria-label="Use my location"
          >
            <Navigation size={15} className={isLocating ? "animate-pulse" : ""} />
          </button>
          <button
            type="button"
            onClick={handleCenterField}
            className="map-ctrl-btn"
            title="Center Field Parcel"
            aria-label="Center field parcel"
          >
            <Crosshair size={15} />
          </button>
        </div>

        {/* Base Layer Switcher (Standard / Satellite / Terrain) */}
        <div className="analysis-layers-overlay">
          <div className="analysis-layers-pill-bar">
            {[
              { id: 'standard', label: 'Standard' },
              { id: 'satellite', label: 'Satellite' },
              { id: 'terrain', label: 'Terrain' }
            ].map((lyr) => (
              <button
                key={lyr.id}
                type="button"
                onClick={() => setActiveLayer(lyr.id as AnalysisLayerType)}
                className={`layer-toggle-btn ${activeLayer === lyr.id ? 'active' : ''}`}
                title={`Switch to ${lyr.label} view`}
              >
                {lyr.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Footer Guidance */}
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
        💡 Click anywhere on the map to place a field marker or select a preset region to load parcel boundaries.
      </p>
    </div>
  );
};
