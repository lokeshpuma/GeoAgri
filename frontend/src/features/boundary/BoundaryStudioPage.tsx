import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useWorkflow } from '../../context/WorkflowContext';
import { BoundaryMap, SearchTargetValue } from './BoundaryMap';
import { ToolDock } from './ToolDock';
import { PlotSummaryPanel } from './PlotSummaryPanel';
import { SearchBar } from './SearchBar';
import { BasemapSwitcher } from './BasemapSwitcher';
import { CoachCard } from './CoachCard';
import { DrawTool, BasemapId, BoundaryValidationResult } from './boundaryTypes';
import { DrawStatus } from './extractBoundary';
import { useBoundaryDraw } from './useBoundaryDraw';
import { saveBoundaryDraft, loadBoundaryDraft, clearBoundaryDraft } from './boundaryStorage';
import { fetchFieldArea } from '../../api/client';
import { useToast } from '../../ui/Toast';
import centroid from '@turf/centroid';
import { Info } from 'lucide-react';
import { evaluateBoundary } from './boundaryMath';

const getBoundarySig = (poly: [number, number][] | null, pin: [number, number] | null): string => {
  const polyStr = poly ? poly.map(p => `${p[0].toFixed(6)},${p[1].toFixed(6)}`).join(';') : '';
  const pinStr = pin ? `${pin[0].toFixed(6)},${pin[1].toFixed(6)}` : '';
  return `${polyStr}|${pinStr}`;
};

export const BoundaryStudioPage: React.FC = () => {
  const { formData, updateFormData, goToStep, confirmBoundary } = useWorkflow();
  const { showToast } = useToast();

  const [activeBasemap, setActiveBasemap] = useState<BasemapId>('satellite');
  const [labelOpacity, setLabelOpacity] = useState<number>(0.85);

  const [polygonCoords, setPolygonCoords] = useState<[number, number][] | null>(() => {
    return formData.polygonPts && formData.polygonPts.length > 0 ? formData.polygonPts : null;
  });
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(() => {
    return formData.pointPt || null;
  });
  const [plotName, setPlotName] = useState<string>(formData.selectedPresetName || '');

  const [drawStatus, setDrawStatus] = useState<DrawStatus>('none');
  const [finishShapeTrigger, setFinishShapeTrigger] = useState(0);
  const [isFrozen, setIsFrozen] = useState(false);
  const lastCommittedSig = useRef<string>(
    getBoundarySig(
      formData.polygonPts && formData.polygonPts.length > 0 ? formData.polygonPts : null,
      formData.pointPt || null
    )
  );

  const [validation, setValidation] = useState<BoundaryValidationResult>({
    valid: false,
    issues: [],
    areaHa: 0,
    areaAcres: 0,
    areaGuntas: 0,
    perimeterM: 0,
    vertexCount: 0,
    centroid: null,
  });

  const [activeTool, setActiveTool] = useState<DrawTool>('polygon');

  const [isVerifying, setIsVerifying] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [serverError, setServerError] = useState<{ code?: string; message: string } | null>(null);
  const [searchTarget, setSearchTarget] = useState<SearchTargetValue>(null);
  const [isCoachDismissed, setIsCoachDismissed] = useState(false);
  const [drawNote, setDrawNote] = useState<'multiple_polygons' | 'polygon_and_pin' | undefined>(undefined);
  const [hasPendingReplace, setHasPendingReplace] = useState(false);
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // Undo & Redo state management
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [undoTrigger, setUndoTrigger] = useState(0);
  const [redoTrigger, setRedoTrigger] = useState(0);

  const handleUndo = useCallback(() => setUndoTrigger(prev => prev + 1), []);
  const handleRedo = useCallback(() => setRedoTrigger(prev => prev + 1), []);

  // Restore draft from storage on mount (PRD v3.3 §3.4, AC-12)
  useEffect(() => {
    const draft = loadBoundaryDraft();
    if (draft && (!polygonCoords || polygonCoords.length === 0) && !pinCoords) {
      if (draft.polygon && draft.polygon.length >= 3) {
        setPolygonCoords(draft.polygon);
        setValidation(evaluateBoundary(draft.polygon));
        setDrawStatus('ready');
        setIsDraftRestored(true);
        showToast({
          type: 'info',
          title: 'Draft Restored',
          message: 'Restored your previous boundary draft.',
        });
      } else if (draft.pin) {
        setPinCoords(draft.pin);
        setDrawStatus('ready');
        setValidation({
          valid: true,
          issues: [],
          areaHa: 0,
          areaAcres: 0,
          areaGuntas: 0,
          perimeterM: 0,
          vertexCount: 1,
          centroid: draft.pin,
        });
        setIsDraftRestored(true);
      }
      if (draft.name) setPlotName(draft.name);
    }
  }, []);

  // Keyboard shortcuts (PRD §4.2 FR-B13)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Undo / Redo keyboard shortcuts
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'd') {
        setActiveTool('polygon');
      } else if (key === 'r') {
        setActiveTool('rectangle');
      } else if (key === 'c') {
        setActiveTool('circle');
      } else if (key === 'f') {
        setActiveTool('freehand');
      } else if (key === 'e') {
        setActiveTool('select');
      } else if (key === 'p') {
        setActiveTool('pin');
      } else if (key === 'escape') {
        setActiveTool('pan');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const handleGeometryChange = useCallback(
    (poly: [number, number][] | null, pin: [number, number] | null) => {
      const nextSig = getBoundarySig(poly, pin);
      setPolygonCoords(poly);
      setPinCoords(pin);

      // Only un-confirm if geometry actually changed signature (PRD v3.2 §2)
      if (nextSig !== lastCommittedSig.current) {
        setIsConfirmed(false);
        setServerError(null);
        updateFormData({ confirmed: false });
      }

      // Save draft
      saveBoundaryDraft({
        mode: poly ? 'polygon' : pin ? 'pin' : 'none',
        polygon: poly,
        pin: pin,
        name: plotName,
        confirmed: nextSig === lastCommittedSig.current && isConfirmed,
      });
    },
    [plotName, updateFormData, isConfirmed]
  );

  const handleFinishShape = useCallback(() => {
    setFinishShapeTrigger(prev => prev + 1);
  }, []);

  const handleEditBoundary = useCallback(() => {
    setIsFrozen(false);
    setIsConfirmed(false);
    updateFormData({ confirmed: false });
    setActiveTool('select');
  }, [updateFormData, setActiveTool]);

  const handleConfirm = async () => {
    setIsVerifying(true);
    setServerError(null);
    let finalAreaHa = validation.areaHa;
    let areaSource: 'server' | 'client-estimate' = 'client-estimate';

    if (polygonCoords && polygonCoords.length >= 3) {
      try {
        const serverArea = await fetchFieldArea(polygonCoords);
        if (serverArea && serverArea.area_ha != null) {
          finalAreaHa = serverArea.area_ha;
          areaSource = 'server';
        }
      } catch (err: any) {
        setIsVerifying(false);
        const code = err?.code || 'AREA_VALIDATION_ERROR';
        const message = err?.message || 'Server rejected boundary geometry.';
        setServerError({ code, message });
        showToast({
          type: 'error',
          title: `Validation Error (${code})`,
          message: message,
          durationMs: 4000,
        });
        return; // PRD §3.3 S5: Block confirmation on 422 errors!
      }
    }

    // Centroid extraction via @turf/centroid (PRD §3.3 S6)
    let computedCentroid: [number, number] | undefined = pinCoords || undefined;
    if (polygonCoords && polygonCoords.length >= 3) {
      try {
        const ring = [...polygonCoords];
        if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) {
          ring.push(ring[0]);
        }
        const polyFeature: any = {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [ring],
          },
        };
        const c = centroid(polyFeature);
        computedCentroid = [c.geometry.coordinates[0], c.geometry.coordinates[1]];
      } catch (e) {
        console.warn('Centroid computation error:', e);
        computedCentroid = validation.centroid || undefined;
      }
    }

    lastCommittedSig.current = getBoundarySig(polygonCoords, pinCoords);
    setIsVerifying(false);
    setIsConfirmed(true);
    setIsFrozen(true);

    // Save final confirmed draft
    saveBoundaryDraft({
      mode: polygonCoords ? 'polygon' : pinCoords ? 'pin' : 'none',
      polygon: polygonCoords,
      pin: pinCoords,
      name: plotName || (polygonCoords ? 'Custom Drawn Field' : 'Field Pin'),
      confirmed: true,
      areaHa: finalAreaHa,
    });

    // Atomically confirm boundary in global workflow context (PRD v3.2 §2)
    confirmBoundary({
      polygonPts: polygonCoords || [],
      pointPt: computedCentroid,
      areaHa: Number(finalAreaHa.toFixed(2)),
      plotName: plotName || (polygonCoords ? 'Custom Drawn Field' : 'Field Pin'),
      boundarySource: polygonCoords ? 'drawn' : 'point',
      areaSource: areaSource,
    });

    showToast({
      type: 'success',
      title: 'Boundary Confirmed',
      message: `${finalAreaHa.toFixed(2)} Ha verified. Advancing to Field Analysis.`,
      durationMs: 2500,
    });
  };

  const handleClear = () => {
    lastCommittedSig.current = '';
    setIsFrozen(false);
    setPolygonCoords(null);
    setPinCoords(null);
    setIsConfirmed(false);
    setServerError(null);
    setIsCoachDismissed(false);
    setCanUndo(false);
    setCanRedo(false);
    clearBoundaryDraft();
    updateFormData({
      polygonPts: [],
      pointPt: undefined,
      areaHa: 0,
      confirmed: false,
    });
    showToast({
      type: 'info',
      title: 'Boundary Cleared',
      message: 'All vertices and pins cleared.',
    });
  };

  const hasBoundary = Boolean((polygonCoords && polygonCoords.length > 0) || pinCoords);

  const ariaAnnouncement = validation.valid
    ? `Area ${validation.areaHa.toFixed(2)} ha, ${validation.vertexCount} vertices, boundary valid`
    : validation.issues.length > 0
    ? `Boundary issue: ${validation.issues[0].message}`
    : pinCoords
    ? `Pin location placed at ${pinCoords[1].toFixed(4)} N, ${pinCoords[0].toFixed(4)} E`
    : 'No boundary placed';

  return (
    <div className="boundary-studio-page">
      {/* Live ARIA Region for Screen Readers (PRD §3.4 S10) */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        id="boundary-status-announcer"
      >
        {ariaAnnouncement}
      </div>
      {/* Top Search Bar */}
      <SearchBar
        onFlyTo={(coords, zoom) => setSearchTarget({ coords, zoom })}
        onDropSearchMarker={(coords) => setSearchTarget({ coords, zoom: 16 })}
      />

      {/* Draft Restored Banner (PRD v3.3 §3.4, AC-12) */}
      {isDraftRestored && (
        <div className="draft-restore-banner" role="status">
          <div className="draft-restore-content">
            <Info size={16} className="text-info shrink-0" />
            <span>Draft boundary restored from previous session. Review and confirm when ready.</span>
          </div>
          <button
            type="button"
            className="btn-dismiss-draft-banner"
            onClick={() => setIsDraftRestored(false)}
            aria-label="Dismiss draft banner"
          >
            ×
          </button>
        </div>
      )}

      {/* Left Tool Dock */}
      <ToolDock
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        hasBoundary={hasBoundary}
      />

      {/* Main Map */}
      <BoundaryMap
        activeTool={activeTool}
        onToolChange={setActiveTool}
        activeBasemap={activeBasemap}
        labelOpacity={labelOpacity}
        initialPolygon={polygonCoords}
        initialPin={pinCoords}
        onGeometryChange={handleGeometryChange}
        onValidationChange={setValidation}
        searchTarget={searchTarget}
        undoTrigger={undoTrigger}
        redoTrigger={redoTrigger}
        onHistoryStateChange={(u, r) => {
          setCanUndo(u);
          setCanRedo(r);
        }}
        onDrawStatusChange={setDrawStatus}
        onDrawNoteChange={setDrawNote}
        onPendingReplaceChange={setHasPendingReplace}
        finishShapeTrigger={finishShapeTrigger}
        isFrozen={isFrozen}
      />

      {/* Right Plot Summary Panel */}
      <PlotSummaryPanel
        plotName={plotName}
        onPlotNameChange={setPlotName}
        validation={validation}
        isPinMode={activeTool === 'pin'}
        pinCoords={pinCoords}
        isConfirmed={isConfirmed}
        isVerifying={isVerifying}
        onConfirm={handleConfirm}
        polygonCoords={polygonCoords}
        serverError={serverError}
        drawStatus={drawStatus}
        hasMultipleShapes={drawNote === 'multiple_polygons' || hasPendingReplace}
        onFinishShape={handleFinishShape}
        onEditBoundary={handleEditBoundary}
      />

      {/* Bottom-left Basemap Switcher */}
      <BasemapSwitcher
        activeBasemap={activeBasemap}
        onSelectBasemap={setActiveBasemap}
        labelOpacity={labelOpacity}
        onLabelOpacityChange={setLabelOpacity}
      />

      {/* Corner Coach Card when empty */}
      {!hasBoundary && !isCoachDismissed && (
        <CoachCard onDismiss={() => setIsCoachDismissed(true)} />
      )}
    </div>
  );
};
