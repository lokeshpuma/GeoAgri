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
import { extractBoundary, DrawStatus, SnapshotFeature, isGuidance, POLYGON_MODES } from './extractBoundary';
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
  onDrawStatusChange?: (status: DrawStatus) => void;
  onDrawNoteChange?: (note?: 'multiple_polygons' | 'polygon_and_pin') => void;
  onPendingReplaceChange?: (hasPending: boolean) => void;
  finishShapeTrigger?: number;
  isFrozen?: boolean;
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
  onDrawStatusChange,
  onDrawNoteChange,
  onPendingReplaceChange,
  finishShapeTrigger = 0,
  isFrozen = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const drawRef = useRef<TerraDraw | null>(null);
  const searchMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [pendingReplace, setPendingReplace] = useState<{
    newFeature: any;
    oldFeatureIds: string[];
  } | null>(null);

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

  const lastCommittedSig = useRef<string>('');
  const sig = (r: [number, number][] | null) => (r ? r.map(c => c.join(',')).join(';') : '');

  const syncFromTerraDraw = useCallback(() => {
    const draw = drawRef.current;
    if (!draw) return;

    const res = extractBoundary(draw.getSnapshot() as any);
    if (onDrawStatusChange) {
      onDrawStatusChange(res.status); // 'none' | 'drawing' | 'ready'
    }
    if (onDrawNoteChange) {
      onDrawNoteChange(res.note);
    }
    const next = sig(res.polygon) + '|' + (res.pin?.join(',') ?? '');
    if (res.status === 'drawing') return; // never treat an unfinished shape as a boundary
    if (next === lastCommittedSig.current) return; // selection or hover changes must not un-confirm
    lastCommittedSig.current = next;

    if (res.polygon) {
      setVertices(res.polygon);
      setPinCoords(null);
      pushSnapshot(res.polygon);
      onGeometryChange(res.polygon, null);
      onValidationChange(evaluateBoundary(res.polygon));
    } else if (res.pin) {
      setPinCoords(res.pin);
      setVertices([]);
      onGeometryChange(null, res.pin);
      onValidationChange({
        valid: true,
        issues: [],
        areaHa: 0,
        areaAcres: 0,
        areaGuntas: 0,
        perimeterM: 0,
        vertexCount: 1,
        centroid: res.pin,
      });
    } else {
      setVertices([]);
      setPinCoords(null);
      onGeometryChange(null, null);
      onValidationChange(evaluateBoundary([]));
    }
  }, [onDrawStatusChange, onGeometryChange, onValidationChange, pushSnapshot]);

  // Handle Finish Shape button trigger (PRD v3.2 §2, v3.3 §3.4)
  const prevFinishTrigger = useRef(finishShapeTrigger);
  useEffect(() => {
    if (finishShapeTrigger > prevFinishTrigger.current) {
      prevFinishTrigger.current = finishShapeTrigger;
      const draw = drawRef.current;
      if (!draw) return;
      const snapshot = draw.getSnapshot() as any[];
      const inProgress = snapshot.find(
        (f: any) => f.geometry?.type === 'Polygon' && f.properties?.currentlyDrawing === true
      );
      if (inProgress && inProgress.id) {
        const rawCoords = (inProgress.geometry.coordinates as [number, number][][])[0];
        let coords = rawCoords.slice(0, -1); // drop cursor coordinate
        if (
          coords.length > 1 &&
          coords[0][0] === coords[coords.length - 1][0] &&
          coords[0][1] === coords[coords.length - 1][1]
        ) {
          coords = coords.slice(0, -1);
        }
        // Deduplicate consecutive identical points
        const deduped: [number, number][] = [];
        for (const pt of coords) {
          if (
            deduped.length === 0 ||
            pt[0] !== deduped[deduped.length - 1][0] ||
            pt[1] !== deduped[deduped.length - 1][1]
          ) {
            deduped.push(pt);
          }
        }
        coords = deduped;
        if (coords.length >= 3) {
          const closedRing = [...coords, coords[0]];
          const real = (snapshot ?? []).filter((f: any) => !isGuidance(f));
          const existingFinished = real.filter(
            (f: any) =>
              f.geometry?.type === 'Polygon' &&
              f.properties?.currentlyDrawing !== true &&
              String(f.id) !== String(inProgress.id)
          );

          draw.removeFeatures([String(inProgress.id)]);

          if (existingFinished.length > 0) {
            const candidateFeature = {
              type: 'Feature',
              id: crypto.randomUUID(),
              properties: { mode: 'polygon' },
              geometry: {
                type: 'Polygon',
                coordinates: [closedRing],
              },
            };
            setPendingReplace({
              newFeature: candidateFeature,
              oldFeatureIds: existingFinished.map((f: any) => String(f.id)),
            });
            syncFromTerraDraw();
            return;
          }

          draw.addFeatures([
            {
              type: 'Feature',
              id: crypto.randomUUID(),
              properties: { mode: 'polygon' },
              geometry: {
                type: 'Polygon',
                coordinates: [closedRing],
              },
            },
          ]);
          draw.setMode('select');
          onToolChange('select');
          syncFromTerraDraw();
        }
      }
    }
  }, [finishShapeTrigger, onToolChange, syncFromTerraDraw]);

  useEffect(() => {
    onPendingReplaceChange?.(pendingReplace !== null);
  }, [pendingReplace, onPendingReplaceChange]);

  const handleConfirmReplace = useCallback(() => {
    const draw = drawRef.current;
    if (!draw || !pendingReplace) return;

    draw.removeFeatures(pendingReplace.oldFeatureIds);
    draw.addFeatures([pendingReplace.newFeature]);
    setPendingReplace(null);
    syncFromTerraDraw();
    onToolChange('select');
  }, [pendingReplace, syncFromTerraDraw, onToolChange]);

  const handleRejectReplace = useCallback(() => {
    setPendingReplace(null);
    syncFromTerraDraw();
    onToolChange('select');
  }, [syncFromTerraDraw, onToolChange]);

  // Freeze map on Confirm (PRD v3.2 §2)
  useEffect(() => {
    const draw = drawRef.current;
    if (!draw) return;
    if (isFrozen) {
      draw.setMode('static');
    }
  }, [isFrozen]);

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

      // Load initial geometry if provided without auto-confirming (PRD v3.2 §2)
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
        lastCommittedSig.current = sig(ring) + '|';
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
        lastCommittedSig.current = '|' + initialPin.join(',');
        onValidationChange({
          valid: true,
          issues: [],
          areaHa: 0,
          areaAcres: 0,
          areaGuntas: 0,
          perimeterM: 0,
          vertexCount: 1,
          centroid: initialPin,
        });
      }

      // Hook events
      draw.on('finish', (id: string | number, ctx: any) => {
        if (ctx && ctx.action === 'draw') {
          const snapshot = draw.getSnapshot() as any[];
          const real = (snapshot ?? []).filter((f: any) => !isGuidance(f));
          const finishedPolygons = real.filter(
            (f: any) =>
              f.geometry?.type === 'Polygon' &&
              POLYGON_MODES.has(String(f.properties?.mode)) &&
              f.properties?.currentlyDrawing !== true
          );

          if (finishedPolygons.length > 1) {
            const newFeature =
              finishedPolygons.find((f: any) => String(f.id) === String(id)) ||
              finishedPolygons[finishedPolygons.length - 1];
            const oldFeatures = finishedPolygons.filter(
              (f: any) => String(f.id) !== String(newFeature.id)
            );

            draw.removeFeatures([String(newFeature.id)]);
            setPendingReplace({
              newFeature,
              oldFeatureIds: oldFeatures.map((f: any) => String(f.id)),
            });
            syncFromTerraDraw();
            return;
          }

          onToolChange('select');
        }
        syncFromTerraDraw();
      });

      draw.on('change', () => {
        syncFromTerraDraw();
      });

      // Set initial mode
      const targetMode = isFrozen ? 'static' : (activeTool === 'pin' ? 'point' : activeTool === 'pan' ? 'static' : activeTool);
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
    if (!draw || isFrozen) return;

    const targetMode = activeTool === 'pin' ? 'point' : activeTool === 'pan' ? 'static' : activeTool;
    try {
      if (draw.getMode() !== targetMode) {
        draw.setMode(targetMode);
      }
    } catch (e) {
      console.warn('TerraDraw setMode error:', e);
    }
  }, [activeTool, isFrozen]);

  // Search target fly-to with context-aware zoom
  useEffect(() => {
    if (!searchTarget || !mapRef.current) return;
    const center = Array.isArray(searchTarget) ? searchTarget : searchTarget.coords;
    const zoom = Array.isArray(searchTarget) ? 15 : (searchTarget.zoom || 15);

    mapRef.current.flyTo({ center, zoom, speed: 1.4 });

    if (!searchMarkerRef.current) {
      const el = document.createElement('div');
      el.className = 'search-pulse-marker';

      searchMarkerRef.current = new maplibregl.Marker({ element: el })
        .setLngLat(center)
        .addTo(mapRef.current);
    } else {
      searchMarkerRef.current.setLngLat(center);
    }
  }, [searchTarget]);

  return (
    <div className="boundary-map-wrapper">
      <div
        ref={mapContainerRef}
        className="boundary-map-canvas"
      />
      {pendingReplace && (
        <div
          className="replace-boundary-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="replace-dialog-title"
        >
          <div className="replace-boundary-dialog glass-card">
            <div className="replace-dialog-header">
              <h3 id="replace-dialog-title" className="replace-dialog-title">
                Replace current boundary with the new shape?
              </h3>
            </div>
            <p className="replace-dialog-desc">
              GeoAgri supports one parcel boundary at a time. Do you want to replace your existing boundary with the newly drawn shape?
            </p>
            <div className="replace-dialog-actions">
              <button
                type="button"
                className="btn-secondary btn-replace-no"
                onClick={handleRejectReplace}
              >
                No
              </button>
              <button
                type="button"
                className="btn-primary btn-replace-yes"
                onClick={handleConfirmReplace}
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
