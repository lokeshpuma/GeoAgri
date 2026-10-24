import { useState, useCallback, useEffect, useRef } from 'react';
import { DrawTool, BoundaryValidationResult } from './boundaryTypes';
import { evaluateBoundary, normalizeRing, simplifyFreehand } from './boundaryMath';

export interface UseBoundaryDrawProps {
  initialPolygon: [number, number][] | null;
  initialPin: [number, number] | null;
  onGeometryChange: (polygon: [number, number][] | null, pin: [number, number] | null) => void;
  onValidationChange: (validation: BoundaryValidationResult) => void;
}

const MAX_HISTORY = 50; // PRD §4.2 FR-B3

export function useBoundaryDraw({
  initialPolygon,
  initialPin,
  onGeometryChange,
  onValidationChange,
}: UseBoundaryDrawProps) {
  const [activeTool, setActiveTool] = useState<DrawTool>('polygon');
  const [vertices, setVertices] = useState<[number, number][]>(() => initialPolygon || []);
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(() => initialPin || null);

  // Undo / Redo stacks
  const [history, setHistory] = useState<[number, number][][]>([]);
  const [future, setFuture] = useState<[number, number][][]>([]);

  // Validation state
  const [validation, setValidation] = useState<BoundaryValidationResult>(() =>
    evaluateBoundary(initialPolygon || [])
  );

  // Push snapshot to history
  const pushHistory = useCallback((newVertices: [number, number][]) => {
    setHistory(prev => {
      const updated = [...prev, vertices];
      if (updated.length > MAX_HISTORY) {
        return updated.slice(updated.length - MAX_HISTORY);
      }
      return updated;
    });
    setFuture([]);
    setVertices(newVertices);
  }, [vertices]);

  // Update geometry & validation on changes
  useEffect(() => {
    if (activeTool === 'pin') {
      const pinVal: BoundaryValidationResult = {
        valid: pinCoords !== null,
        issues: pinCoords ? [] : [{ code: 'TOO_FEW_VERTICES', message: 'Click map to place pin.' }],
        areaHa: 0,
        areaAcres: 0,
        areaGuntas: 0,
        perimeterM: 0,
        vertexCount: pinCoords ? 1 : 0,
        centroid: pinCoords,
      };
      setValidation(pinVal);
      onValidationChange(pinVal);
      onGeometryChange(null, pinCoords);
    } else {
      const closed = vertices.length >= 3 ? normalizeRing(vertices) : null;
      const polyVal = evaluateBoundary(vertices);
      setValidation(polyVal);
      onValidationChange(polyVal);
      onGeometryChange(closed, null);
    }
  }, [vertices, pinCoords, activeTool]);

  // Add a vertex
  const addVertex = useCallback(
    (pt: [number, number]) => {
      pushHistory([...vertices, pt]);
    },
    [vertices, pushHistory]
  );

  // Update a vertex at index
  const updateVertex = useCallback(
    (index: number, newPt: [number, number]) => {
      const next = [...vertices];
      next[index] = newPt;
      pushHistory(next);
    },
    [vertices, pushHistory]
  );

  // Insert a midpoint
  const insertMidpoint = useCallback(
    (afterIndex: number, pt: [number, number]) => {
      const next = [...vertices];
      next.splice(afterIndex + 1, 0, pt);
      pushHistory(next);
    },
    [vertices, pushHistory]
  );

  // Delete a vertex
  const deleteVertex = useCallback(
    (index: number) => {
      if (vertices.length <= 3) return; // Min 3 vertices enforced (FR-B2)
      const next = vertices.filter((_, i) => i !== index);
      pushHistory(next);
    },
    [vertices, pushHistory]
  );

  // Set freehand points
  const setFreehand = useCallback(
    (pts: [number, number][]) => {
      const simplified = simplifyFreehand(pts);
      pushHistory(simplified);
    },
    [pushHistory]
  );

  // Close polygon
  const finishPolygon = useCallback(() => {
    if (vertices.length >= 3) {
      const closed = normalizeRing(vertices);
      pushHistory(closed);
      setActiveTool('select');
    }
  }, [vertices, pushHistory]);

  // Cancel shape
  const cancelShape = useCallback(() => {
    if (vertices.length > 0) {
      pushHistory([]);
    }
  }, [vertices, pushHistory]);

  // Undo
  const undo = useCallback(() => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setFuture(f => [vertices, ...f]);
    setHistory(h => h.slice(0, -1));
    setVertices(prev);
  }, [history, vertices]);

  // Redo
  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setHistory(h => [...h, vertices]);
    setFuture(f => f.slice(1));
    setVertices(next);
  }, [future, vertices]);

  // Clear all
  const clear = useCallback(() => {
    if (vertices.length > 0 || pinCoords !== null) {
      setHistory(h => [...h, vertices]);
      setFuture([]);
      setVertices([]);
      setPinCoords(null);
    }
  }, [vertices, pinCoords]);

  return {
    activeTool,
    setActiveTool,
    vertices,
    setVertices,
    pinCoords,
    setPinCoords,
    validation,
    canUndo: history.length > 0,
    canRedo: future.length > 0,
    addVertex,
    updateVertex,
    insertMidpoint,
    deleteVertex,
    setFreehand,
    finishPolygon,
    cancelShape,
    undo,
    redo,
    clear,
  };
}
