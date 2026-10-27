import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawRectangleMode,
  TerraDrawCircleMode,
  TerraDrawFreehandMode,
  TerraDrawSelectMode,
  TerraDrawPointMode,
} from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
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
  const drawRef = useRef<TerraDraw | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [vertices, setVertices] = useState<[number, number][]>(() => initialPolygon || []);
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(() => initialPin || null);
  const [history, setHistory] = useState<[number, number][][]>([]);
  const [future, setFuture] = useState<[number, number][][]>([]);

  const { showToast } = useToast();

  const pushSnapshot = useCallback((newCoords: [number, number][]) => {
    setHistory(prev => [...prev.slice(-49), vertices]);
    setFuture([]);
    setVertices(newCoords);
  }, [vertices]);

  useEffect(() => {
    if (onHistoryStateChange) {
      const canUndo = (drawRef.current?.canUndo() ?? false) || history.length > 0;
      const canRedo = (drawRef.current?.canRedo() ?? false) || future.length > 0;
      onHistoryStateChange(canUndo, canRedo);
    }
  }, [history.length, future.length, onHistoryStateChange]);

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

  const syncFromTerraDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;

    const snapshot = draw.getSnapshot();
    const features = snapshot || [];
    if (!Array.isArray(features) || features.length === 0) {
      setVertices([]);
      setPinCoords(null);
      onGeometryChange(null, null);
      onValidationChange(evaluateBoundary([]));
      return;
    }

    const polyFeat = features.find((f: any) => f.geometry?.type === 'Polygon');
    const ptFeat = features.find((f: any) => f.geometry?.type === 'Point');

    if (polyFeat && polyFeat.geometry?.type === 'Polygon') {
      let rawCoords = polyFeat.geometry.coordinates[0] as [number, number][];
      if (rawCoords.length > 200) {
        rawCoords = simplifyFreehand(rawCoords);
      }
      const closed = normalizeRing(rawCoords);
      setVertices(closed);
      setPinCoords(null);
      pushSnapshot(closed);
      onGeometryChange(closed, null);
      onValidationChange(evaluateBoundary(closed));
    } else if (ptFeat && ptFeat.geometry?.type === 'Point') {
      const pt = ptFeat.geometry.coordinates as [number, number];
      setPinCoords(pt);
      setVertices([]);
      onGeometryChange(null, pt);
      onValidationChange({
        valid: true,
        issues: [],
        areaHa: 0,
        areaAcres: 0,
        areaGuntas: 0,
        perimeterM: 0,
        vertexCount: 1,
        centroid: pt,
      });
    }
  }, [onGeometryChange, onValidationChange, pushSnapshot]);

  // Handle external Undo trigger
  const prevUndoTrigger = useRef(undoTrigger);
  useEffect(() => {
    if (undoTrigger > prevUndoTrigger.current) {
      prevUndoTrigger.current = undoTrigger;
      if (drawRef.current && drawRef.current.canUndo()) {
        drawRef.current.undo();
        syncFromTerraDraw();
        showToast({ type: 'info', title: 'Undo', message: 'Reverted action' });
      } else if (history.length > 0) {
        const prev = history[history.length - 1];
        setFuture(f => [vertices, ...f]);
        setHistory(h => h.slice(0, -1));
        setVertices(prev);
        onGeometryChange(normalizeRing(prev), null);
        showToast({ type: 'info', title: 'Undo', message: 'Reverted action' });
      }
    }
  }, [undoTrigger, history, vertices, syncFromTerraDraw, onGeometryChange, showToast]);

  // Handle external Redo trigger
  const prevRedoTrigger = useRef(redoTrigger);
  useEffect(() => {
    if (redoTrigger > prevRedoTrigger.current) {
      prevRedoTrigger.current = redoTrigger;
      if (drawRef.current && drawRef.current.canRedo()) {
        drawRef.current.redo();
        syncFromTerraDraw();
        showToast({ type: 'info', title: 'Redo', message: 'Restored action' });
      } else if (future.length > 0) {
        const next = future[0];
        setHistory(h => [...h, vertices]);
        setFuture(f => f.slice(1));
        setVertices(next);
        onGeometryChange(normalizeRing(next), null);
        showToast({ type: 'info', title: 'Redo', message: 'Restored action' });
      }
    }
  }, [redoTrigger, future, vertices, syncFromTerraDraw, onGeometryChange, showToast]);

  // Sync external clear
  useEffect(() => {
    if ((!initialPolygon || initialPolygon.length === 0) && !initialPin) {
      if (drawRef.current) {
        drawRef.current.clear();
      }
      setVertices([]);
      setPinCoords(null);
    }
  }, [initialPolygon, initialPin]);

  // Initialize Map and TerraDraw
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: UNIFIED_MAP_STYLE,
      center: initialPolygon && initialPolygon.length > 0
        ? initialPolygon[0]
        : initialPin
        ? initialPin
        : [77.5946, 12.9716],
      zoom: initialPolygon || initialPin ? 15 : 12,
      maxZoom: 22,
      attributionControl: { compact: false },
    });

    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 120 }), 'bottom-right');

    const handleMapLoad = () => {
      applyBasemap(activeBasemap);

      // Initialize Terra Draw
      const adapter = new TerraDrawMapLibreGLAdapter({ map });
      const draw = new TerraDraw({
        adapter,
        modes: [
          new TerraDrawPolygonMode({
            snapping: { toCoordinate: true, toLine: true, showSnappingPoint: true },
            pointerDistance: 10,
          }),
          new TerraDrawRectangleMode(),
          new TerraDrawCircleMode({ segments: 64 }),
          new TerraDrawFreehandMode(),
          new TerraDrawSelectMode({
            flags: {
              polygon: {
                feature: {
                  draggable: true,
                  rotateable: false,
                  scaleable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
              rectangle: {
                feature: {
                  draggable: true,
                  rotateable: false,
                  scaleable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
              circle: {
                feature: {
                  draggable: true,
                  rotateable: false,
                  scaleable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
              freehand: {
                feature: {
                  draggable: true,
                  rotateable: false,
                  scaleable: true,
                  coordinates: {
                    midpoints: true,
                    draggable: true,
                    deletable: true,
                  },
                },
              },
              point: {
                feature: {
                  draggable: true,
                },
              },
            },
          }),
          new TerraDrawPointMode(),
        ],
      });

      draw.start();
      drawRef.current = draw;

      // Load initial geometry if provided
      if (initialPolygon && initialPolygon.length >= 3) {
        const ring = normalizeRing(initialPolygon);
        draw.addFeatures([
          {
            type: 'Feature',
            properties: { mode: 'polygon' },
            geometry: {
              type: 'Polygon',
              coordinates: [ring],
            },
          },
        ]);
        onGeometryChange(ring, null);
        onValidationChange(evaluateBoundary(ring));
      } else if (initialPin) {
        draw.addFeatures([
          {
            type: 'Feature',
            properties: { mode: 'point' },
            geometry: {
              type: 'Point',
              coordinates: initialPin,
            },
          },
        ]);
        onGeometryChange(null, initialPin);
      }

      // Hook events
      draw.on('finish', () => {
        syncFromTerraDraw();
        onToolChange('select');
      });

      draw.on('change', () => {
        syncFromTerraDraw();
      });

      // Set initial mode
      const targetMode = activeTool === 'pin' ? 'point' : activeTool === 'pan' ? 'static' : activeTool;
      try {
        draw.setMode(targetMode);
      } catch {
        // Mode ready
      }
    };

    map.on('load', handleMapLoad);
    map.on('styledata', () => applyBasemap(activeBasemap));

    return () => {
      if (drawRef.current) {
        try {
          drawRef.current.stop();
        } catch {
          // cleanup
        }
        drawRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync Basemap on prop change
  useEffect(() => {
    applyBasemap(activeBasemap);
  }, [activeBasemap, applyBasemap]);

  // Sync TerraDraw Mode with activeTool
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;

    const targetMode = activeTool === 'pin' ? 'point' : activeTool === 'pan' ? 'static' : activeTool;
    try {
      if (draw.getMode() !== targetMode) {
        draw.setMode(targetMode);
      }
    } catch (e) {
      console.warn('TerraDraw setMode error:', e);
    }
  }, [activeTool]);

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

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 'calc(100vh - 140px)' }}>
      <div
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
    </div>
  );
};
