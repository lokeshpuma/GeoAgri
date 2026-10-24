import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DrawTool, BasemapId, BoundaryValidationResult } from './boundaryTypes';
import { BASEMAPS } from './mapStyles';
import { evaluateBoundary, normalizeRing, simplifyFreehand } from './boundaryMath';
import { useToast } from '../../ui/Toast';

export interface BoundaryMapProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  activeBasemap: BasemapId;
  labelOpacity: number;
  initialPolygon: [number, number][] | null;
  initialPin: [number, number] | null;
  onGeometryChange: (coords: [number, number][] | null, pin: [number, number] | null) => void;
  onValidationChange: (validation: BoundaryValidationResult) => void;
  searchTarget: [number, number] | null;
}

export const BoundaryMap: React.FC<BoundaryMapProps> = ({
  activeTool,
  onToolChange,
  activeBasemap,
  labelOpacity,
  initialPolygon,
  initialPin,
  onGeometryChange,
  onValidationChange,
  searchTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [vertices, setVertices] = useState<[number, number][]>(() => initialPolygon || []);
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(() => initialPin || null);
  const [history, setHistory] = useState<[number, number][][]>([]);
  const [future, setFuture] = useState<[number, number][][]>([]);
  const isDrawingFreehand = useRef(false);
  const { showToast } = useToast();

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const basemapConfig = BASEMAPS[activeBasemap];

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: basemapConfig.style,
      center: initialPolygon && initialPolygon.length > 0
        ? initialPolygon[0]
        : initialPin
        ? initialPin
        : [0, 20], // World view default (PRD §4.3 FR-S4)
      zoom: initialPolygon || initialPin ? 15 : 2,
      attributionControl: { compact: false },
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      // Add GeoJSON polygon source & layers for boundary rendering
      map.addSource('boundary-polygon', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Polygon fill layer
      map.addLayer({
        id: 'boundary-polygon-fill',
        type: 'fill',
        source: 'boundary-polygon',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': '#22c58b',
          'fill-opacity': 0.25,
        },
      });

      // Polygon outline layer
      map.addLayer({
        id: 'boundary-polygon-line',
        type: 'line',
        source: 'boundary-polygon',
        paint: {
          'line-color': '#22c58b',
          'line-width': 3,
          'line-dasharray': [1, 0],
        },
      });

      // Vertex point handles
      map.addSource('boundary-vertices', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      map.addLayer({
        id: 'boundary-vertex-handles',
        type: 'circle',
        source: 'boundary-vertices',
        paint: {
          'circle-radius': 6,
          'circle-color': '#f3f1ea',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#05090a',
        },
      });

      mapRef.current = map;
      updateMapLayers(vertices);
    });

    return () => {
      map.remove();
    };
  }, []);

  // Update basemap style
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.isStyleLoaded()) return;
    const basemapConfig = BASEMAPS[activeBasemap];
    mapRef.current.setStyle(basemapConfig.style);
    mapRef.current.once('style.load', () => {
      // Re-add layers
      const map = mapRef.current;
      if (!map) return;
      if (!map.getSource('boundary-polygon')) {
        map.addSource('boundary-polygon', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        map.addLayer({
          id: 'boundary-polygon-fill',
          type: 'fill',
          source: 'boundary-polygon',
          paint: { 'fill-color': '#22c58b', 'fill-opacity': 0.25 },
        });
        map.addLayer({
          id: 'boundary-polygon-line',
          type: 'line',
          source: 'boundary-polygon',
          paint: { 'line-color': '#22c58b', 'line-width': 3 },
        });
      }
      updateMapLayers(vertices);
    });
  }, [activeBasemap]);

  // Update GeoJSON layers
  const updateMapLayers = useCallback((coords: [number, number][]) => {
    const map = mapRef.current;
    if (!map || !map.getSource('boundary-polygon')) return;

    if (coords.length >= 3) {
      const closed = normalizeRing(coords);
      const polySource: any = map.getSource('boundary-polygon');
      polySource.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [closed],
        },
      });

      // Update vertices handles
      const vertexFeatures = coords.map((pt, idx) => ({
        type: 'Feature',
        properties: { index: idx },
        geometry: { type: 'Point', coordinates: pt },
      }));

      const vertSource: any = map.getSource('boundary-vertices');
      if (vertSource) {
        vertSource.setData({
          type: 'FeatureCollection',
          features: vertexFeatures,
        });
      }
    } else {
      const polySource: any = map.getSource('boundary-polygon');
      polySource.setData({ type: 'FeatureCollection', features: [] });
      const vertSource: any = map.getSource('boundary-vertices');
      if (vertSource) vertSource.setData({ type: 'FeatureCollection', features: [] });
    }
  }, []);

  // Sync validation & parent geometry
  useEffect(() => {
    if (activeTool === 'pin') {
      onGeometryChange(null, pinCoords);
      onValidationChange({
        valid: pinCoords !== null,
        issues: pinCoords ? [] : [{ code: 'TOO_FEW_VERTICES', message: 'Click map to place pin.' }],
        areaHa: 0,
        areaAcres: 0,
        areaGuntas: 0,
        perimeterM: 0,
        vertexCount: pinCoords ? 1 : 0,
        centroid: pinCoords,
      });
    } else {
      updateMapLayers(vertices);
      const val = evaluateBoundary(vertices);
      onValidationChange(val);
      onGeometryChange(vertices.length >= 3 ? normalizeRing(vertices) : null, null);
    }
  }, [vertices, pinCoords, activeTool]);

  // Search target fly-to
  useEffect(() => {
    if (!searchTarget || !mapRef.current) return;
    mapRef.current.flyTo({ center: searchTarget, zoom: 16, speed: 1.4 });

    if (!searchMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'search-pulse-marker';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.background = '#d9ad4f';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = '0 0 12px #d9ad4f';

      searchMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(searchTarget)
        .addTo(mapRef.current);
    } else {
      searchMarkerRef.current.setLngLat(searchTarget);
    }
  }, [searchTarget]);

  // Map Click Interactions
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const pt: [number, number] = [
        Number(e.lngLat.lng.toFixed(5)),
        Number(e.lngLat.lat.toFixed(5)),
      ];

      if (activeTool === 'pin') {
        setPinCoords(pt);
        if (!pinMarkerRef.current) {
          pinMarkerRef.current = new maplibregl.Marker({ color: '#22c58b' })
            .setLngLat(pt)
            .addTo(map);
        } else {
          pinMarkerRef.current.setLngLat(pt);
        }
        return;
      }

      if (activeTool === 'polygon') {
        setHistory(prev => [...prev, vertices]);
        setFuture([]);
        setVertices(prev => [...prev, pt]);
      } else if (activeTool === 'rectangle') {
        if (vertices.length === 0) {
          setVertices([pt]);
        } else if (vertices.length === 1) {
          const p1 = vertices[0];
          const rect: [number, number][] = [
            p1,
            [pt[0], p1[1]],
            pt,
            [p1[0], pt[1]],
            p1,
          ];
          setHistory(prev => [...prev, vertices]);
          setVertices(rect);
          onToolChange('select');
        } else {
          setVertices([pt]);
        }
      }
    };

    const handleDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      if (activeTool === 'polygon' && vertices.length >= 3) {
        setVertices(prev => normalizeRing(prev));
        onToolChange('select');
        showToast({
          type: 'success',
          title: 'Polygon Closed',
          message: `${vertices.length} corners placed. You can now adjust vertices.`,
        });
      }
    };

    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);
    };
  }, [activeTool, vertices]);

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [vertices, ...f]);
    setHistory(h => h.slice(0, -1));
    setVertices(prev);
  }, [history, vertices]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(h => [...h, vertices]);
    setFuture(f => f.slice(1));
    setVertices(next);
  }, [future, vertices]);

  const handleClear = useCallback(() => {
    setHistory(h => [...h, vertices]);
    setVertices([]);
    setPinCoords(null);
    if (pinMarkerRef.current) pinMarkerRef.current.remove();
  }, [vertices]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'calc(100vh - 140px)' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
};
