import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { DrawTool, BasemapId, BoundaryValidationResult } from './boundaryTypes';
import { UNIFIED_MAP_STYLE, BASEMAP_LAYER_IDS, BASEMAPS } from './mapStyles';
import { evaluateBoundary, normalizeRing, simplifyFreehand } from './boundaryMath';
import { useToast } from '../../ui/Toast';

export interface SearchTargetObject {
  coords: [number, number];
  zoom?: number;
}

export type SearchTargetValue = [number, number] | SearchTargetObject | null;

export interface BoundaryMapProps {
  activeTool: DrawTool;
  onToolChange: (tool: DrawTool) => void;
  activeBasemap: BasemapId;
  labelOpacity: number;
  initialPolygon: [number, number][] | null;
  initialPin: [number, number] | null;
  onGeometryChange: (coords: [number, number][] | null, pin: [number, number] | null) => void;
  onValidationChange: (validation: BoundaryValidationResult) => void;
  searchTarget: SearchTargetValue;
  undoTrigger?: number;
  redoTrigger?: number;
  onHistoryStateChange?: (canUndo: boolean, canRedo: boolean) => void;
}

/**
 * Generate 32 geodesic coordinates forming a circle from center and edge points
 */
function generateCircleCoords(center: [number, number], edge: [number, number], steps = 32): [number, number][] {
  const [lon1, lat1] = center;
  const [lon2, lat2] = edge;
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const radiusM = Math.max(R * c, 15); // minimum 15m radius

  const coords: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const bearing = ((i * 360) / steps) * (Math.PI / 180);
    const latRad = (lat1 * Math.PI) / 180;
    const lonRad = (lon1 * Math.PI) / 180;
    const angularDist = radiusM / R;

    const newLat = Math.asin(
      Math.sin(latRad) * Math.cos(angularDist) + Math.cos(latRad) * Math.sin(angularDist) * Math.cos(bearing)
    );
    const newLon =
      lonRad +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDist) * Math.cos(latRad),
        Math.cos(angularDist) - Math.sin(latRad) * Math.sin(newLat)
      );
    coords.push([
      Number(((newLon * 180) / Math.PI).toFixed(5)),
      Number(((newLat * 180) / Math.PI).toFixed(5)),
    ]);
  }
  coords.push(coords[0]);
  return coords;
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
  undoTrigger = 0,
  redoTrigger = 0,
  onHistoryStateChange,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);
  const pinMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [vertices, setVertices] = useState<[number, number][]>(() => initialPolygon || []);
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(() => initialPin || null);
  const [history, setHistory] = useState<[number, number][][]>([]);
  const [future, setFuture] = useState<[number, number][][]>([]);

  // Auxiliary refs for interactive drawing
  const circleCenterRef = useRef<[number, number] | null>(null);
  const isFreehandDrawingRef = useRef(false);
  const freehandPointsRef = useRef<[number, number][]>([]);
  const draggedVertexIdxRef = useRef<number | null>(null);

  const { showToast } = useToast();

  // Push snapshot to undo stack
  const pushSnapshot = useCallback((newCoords: [number, number][]) => {
    setHistory(prev => [...prev.slice(-49), vertices]);
    setFuture([]);
    setVertices(newCoords);
  }, [vertices]);

  // Notify parent of history stack availability
  useEffect(() => {
    if (onHistoryStateChange) {
      onHistoryStateChange(history.length > 0, future.length > 0);
    }
  }, [history.length, future.length, onHistoryStateChange]);

  // Handle external Undo trigger
  const prevUndoTrigger = useRef(undoTrigger);
  useEffect(() => {
    if (undoTrigger > prevUndoTrigger.current) {
      prevUndoTrigger.current = undoTrigger;
      if (history.length > 0) {
        const prev = history[history.length - 1];
        setFuture(f => [vertices, ...f]);
        setHistory(h => h.slice(0, -1));
        setVertices(prev);
        showToast({ type: 'info', title: 'Undo', message: 'Reverted previous action' });
      }
    }
  }, [undoTrigger, history, vertices, showToast]);

  // Handle external Redo trigger
  const prevRedoTrigger = useRef(redoTrigger);
  useEffect(() => {
    if (redoTrigger > prevRedoTrigger.current) {
      prevRedoTrigger.current = redoTrigger;
      if (future.length > 0) {
        const next = future[0];
        setHistory(h => [...h, vertices]);
        setFuture(f => f.slice(1));
        setVertices(next);
        showToast({ type: 'info', title: 'Redo', message: 'Restored action' });
      }
    }
  }, [redoTrigger, future, vertices, showToast]);

  // Sync external clear
  useEffect(() => {
    if (!initialPolygon || initialPolygon.length === 0) {
      if (vertices.length > 0) {
        setVertices([]);
        setHistory([]);
        setFuture([]);
      }
    }
    if (!initialPin && pinCoords) {
      setPinCoords(null);
      if (pinMarkerRef.current) pinMarkerRef.current.remove();
    }
  }, [initialPolygon, initialPin]);

  // Robust Basemap Visibility Applier
  const applyBasemap = useCallback(
    (targetId: BasemapId) => {
      const map = mapRef.current;
      if (!map) return;

      Object.entries(BASEMAP_LAYER_IDS).forEach(([id, layerId]) => {
        try {
          if (map.getLayer(layerId)) {
            const isTarget = id === targetId;
            map.setLayoutProperty(layerId, 'visibility', isTarget ? 'visible' : 'none');
            if (isTarget) {
              map.setPaintProperty(layerId, 'raster-opacity', 1.0);
            }
          }
        } catch {
          // Layer not yet loaded in WebGL context
        }
      });
    },
    []
  );

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: UNIFIED_MAP_STYLE,
      center: initialPolygon && initialPolygon.length > 0
        ? initialPolygon[0]
        : initialPin
        ? initialPin
        : [0, 20],
      zoom: initialPolygon || initialPin ? 15 : 2,
      maxZoom: 22, // Enable parcel-scale zoom down to high-resolution meters (< 30m window)
      attributionControl: { compact: false },
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-right');

    const handleMapLoad = () => {
      applyBasemap(activeBasemap);

      // Boundary Polygon GeoJSON Source & Layers
      if (!map.getSource('boundary-polygon')) {
        map.addSource('boundary-polygon', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'boundary-polygon-fill',
          type: 'fill',
          source: 'boundary-polygon',
          paint: {
            'fill-color': '#22c58b',
            'fill-opacity': 0.25,
          },
        });

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
      }

      // Vertex point handles
      if (!map.getSource('boundary-vertices')) {
        map.addSource('boundary-vertices', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        map.addLayer({
          id: 'boundary-vertex-handles',
          type: 'circle',
          source: 'boundary-vertices',
          paint: {
            'circle-radius': 7,
            'circle-color': '#f3f1ea',
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#05090a',
          },
        });
      }

      updateMapLayers(vertices);
    };

    map.on('load', handleMapLoad);
    map.on('styledata', () => applyBasemap(activeBasemap));

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Basemap on prop change
  useEffect(() => {
    applyBasemap(activeBasemap);
  }, [activeBasemap, applyBasemap]);

  // Update GeoJSON layers
  const updateMapLayers = useCallback((coords: [number, number][]) => {
    const map = mapRef.current;
    if (!map) return;

    try {
      const polySource: any = map.getSource('boundary-polygon');
      if (polySource) {
        if (coords.length >= 3) {
          const closed = normalizeRing(coords);
          polySource.setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [closed],
            },
          });
        } else {
          polySource.setData({ type: 'FeatureCollection', features: [] });
        }
      }

      const vertSource: any = map.getSource('boundary-vertices');
      if (vertSource) {
        if (coords.length > 0) {
          const vertexFeatures = coords.map((pt, idx) => ({
            type: 'Feature',
            properties: { index: idx },
            geometry: { type: 'Point', coordinates: pt },
          }));
          vertSource.setData({
            type: 'FeatureCollection',
            features: vertexFeatures,
          });
        } else {
          vertSource.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    } catch {
      // Source not ready yet
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

  // Search target fly-to with context-aware zoom
  useEffect(() => {
    if (!searchTarget || !mapRef.current) return;
    const center = Array.isArray(searchTarget) ? searchTarget : searchTarget.coords;
    const zoom = Array.isArray(searchTarget) ? 15 : (searchTarget.zoom || 15);

    mapRef.current.flyTo({ center, zoom, speed: 1.4 });

    if (!searchMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'search-pulse-marker';
      el.style.width = '14px';
      el.style.height = '14px';
      el.style.background = '#22c58b';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid #ffffff';
      el.style.boxShadow = '0 0 12px #22c58b';

      searchMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(center)
        .addTo(mapRef.current);
    } else {
      searchMarkerRef.current.setLngLat(center);
    }
  }, [searchTarget]);

  // Map Click Interactions across all tools
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: maplibregl.MapMouseEvent) => {
      const pt: [number, number] = [
        Number(e.lngLat.lng.toFixed(5)),
        Number(e.lngLat.lat.toFixed(5)),
      ];

      // Tool 1: Pin
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

      // Tool 2: Polygon
      if (activeTool === 'polygon') {
        pushSnapshot([...vertices, pt]);
        return;
      }

      // Tool 3: Rectangle
      if (activeTool === 'rectangle') {
        if (vertices.length === 0) {
          pushSnapshot([pt]);
        } else if (vertices.length === 1) {
          const p1 = vertices[0];
          const rect: [number, number][] = [
            p1,
            [pt[0], p1[1]],
            pt,
            [p1[0], pt[1]],
            p1,
          ];
          pushSnapshot(rect);
          onToolChange('select');
          showToast({
            type: 'success',
            title: 'Rectangle Placed',
            message: 'You can now drag corners in Select mode.',
          });
        } else {
          pushSnapshot([pt]);
        }
        return;
      }

      // Tool 4: Circle
      if (activeTool === 'circle') {
        if (!circleCenterRef.current) {
          circleCenterRef.current = pt;
          showToast({
            type: 'info',
            title: 'Center Set',
            message: 'Click outside the center to define the circle radius.',
          });
        } else {
          const center = circleCenterRef.current;
          circleCenterRef.current = null;
          const circleRing = generateCircleCoords(center, pt, 32);
          pushSnapshot(circleRing);
          onToolChange('select');
          showToast({
            type: 'success',
            title: 'Circular Parcel Created',
            message: '32-point circular boundary generated.',
          });
        }
        return;
      }
    };

    // Double-click to close polygon
    const handleDblClick = (e: maplibregl.MapMouseEvent) => {
      e.preventDefault();
      if (activeTool === 'polygon' && vertices.length >= 3) {
        pushSnapshot(normalizeRing(vertices));
        onToolChange('select');
        showToast({
          type: 'success',
          title: 'Polygon Closed',
          message: `${vertices.length} corners placed. You can now adjust vertices in Select mode.`,
        });
      }
    };

    // Freehand Drawing (Mouse Down -> Move -> Up)
    const handleMouseDown = (e: maplibregl.MapMouseEvent) => {
      if (activeTool === 'freehand') {
        isFreehandDrawingRef.current = true;
        freehandPointsRef.current = [[e.lngLat.lng, e.lngLat.lat]];
        map.getCanvas().style.cursor = 'crosshair';
      } else if (activeTool === 'select') {
        // Check if user clicked on a vertex handle to drag it
        const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
          [e.point.x - 8, e.point.y - 8],
          [e.point.x + 8, e.point.y + 8],
        ];
        const features = map.queryRenderedFeatures(bbox, { layers: ['boundary-vertex-handles'] });
        if (features.length > 0) {
          draggedVertexIdxRef.current = features[0].properties?.index ?? null;
          map.dragPan.disable();
        }
      }
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      if (activeTool === 'freehand' && isFreehandDrawingRef.current) {
        const last = freehandPointsRef.current[freehandPointsRef.current.length - 1];
        const dx = e.lngLat.lng - last[0];
        const dy = e.lngLat.lat - last[1];
        if (dx * dx + dy * dy > 0.00000004) {
          freehandPointsRef.current.push([e.lngLat.lng, e.lngLat.lat]);
          updateMapLayers(freehandPointsRef.current);
        }
      } else if (activeTool === 'select' && draggedVertexIdxRef.current !== null) {
        const idx = draggedVertexIdxRef.current;
        const newCoords = [...vertices];
        newCoords[idx] = [Number(e.lngLat.lng.toFixed(5)), Number(e.lngLat.lat.toFixed(5))];
        setVertices(newCoords);
      }
    };

    const handleMouseUp = () => {
      if (activeTool === 'freehand' && isFreehandDrawingRef.current) {
        isFreehandDrawingRef.current = false;
        map.getCanvas().style.cursor = '';
        if (freehandPointsRef.current.length >= 3) {
          const simplified = simplifyFreehand(freehandPointsRef.current);
          const closed = normalizeRing(simplified);
          pushSnapshot(closed);
          onToolChange('select');
          showToast({
            type: 'success',
            title: 'Freehand Boundary Finished',
            message: `Created boundary with ${closed.length} points.`,
          });
        }
      } else if (activeTool === 'select' && draggedVertexIdxRef.current !== null) {
        draggedVertexIdxRef.current = null;
        map.dragPan.enable();
        pushSnapshot(vertices);
      }
    };

    map.on('click', handleClick);
    map.on('dblclick', handleDblClick);
    map.on('mousedown', handleMouseDown);
    map.on('mousemove', handleMouseMove);
    map.on('mouseup', handleMouseUp);

    return () => {
      map.off('click', handleClick);
      map.off('dblclick', handleDblClick);
      map.off('mousedown', handleMouseDown);
      map.off('mousemove', handleMouseMove);
      map.off('mouseup', handleMouseUp);
    };
  }, [activeTool, vertices, pushSnapshot, onToolChange, showToast, updateMapLayers]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'calc(100vh - 140px)' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
};
