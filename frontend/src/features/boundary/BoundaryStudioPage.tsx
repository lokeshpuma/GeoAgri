import React, { useState, useCallback, useEffect } from 'react';
import { useWorkflow } from '../../context/WorkflowContext';
import { BoundaryMap, SearchTargetValue } from './BoundaryMap';
import { ToolDock } from './ToolDock';
import { PlotSummaryPanel } from './PlotSummaryPanel';
import { SearchBar } from './SearchBar';
import { BasemapSwitcher } from './BasemapSwitcher';
import { CoachCard } from './CoachCard';
import { DrawTool, BasemapId, BoundaryValidationResult } from './boundaryTypes';
import { saveBoundaryDraft, loadBoundaryDraft, clearBoundaryDraft } from './boundaryStorage';
import { fetchFieldArea } from '../../api/client';
import { useToast } from '../../ui/Toast';

export const BoundaryStudioPage: React.FC = () => {
  const { formData, updateFormData, goToStep } = useWorkflow();
  const { showToast } = useToast();

  const [activeTool, setActiveTool] = useState<DrawTool>('polygon');
  const [activeBasemap, setActiveBasemap] = useState<BasemapId>('satellite');
  const [labelOpacity, setLabelOpacity] = useState<number>(0.85);

  const [polygonCoords, setPolygonCoords] = useState<[number, number][] | null>(() => {
    return formData.polygonPts && formData.polygonPts.length > 0 ? formData.polygonPts : null;
  });
  const [pinCoords, setPinCoords] = useState<[number, number] | null>(() => {
    return formData.pointPt || null;
  });
  const [plotName, setPlotName] = useState<string>(formData.selectedPresetName || '');

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

  const [isVerifying, setIsVerifying] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [searchTarget, setSearchTarget] = useState<SearchTargetValue>(null);
  const [isCoachDismissed, setIsCoachDismissed] = useState(false);

  // Restore draft from storage on mount
  useEffect(() => {
    const draft = loadBoundaryDraft();
    if (draft && (!polygonCoords || polygonCoords.length === 0) && !pinCoords) {
      if (draft.polygon) {
        setPolygonCoords(draft.polygon);
        showToast({
          type: 'info',
          title: 'Draft Restored',
          message: 'Restored your previous boundary draft.',
        });
      } else if (draft.pin) {
        setPinCoords(draft.pin);
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

      const key = e.key.toLowerCase();
      if (key === 'd') {
        setActiveTool('polygon');
      } else if (key === 'r') {
        setActiveTool('rectangle');
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
  }, []);

  const handleGeometryChange = useCallback(
    (poly: [number, number][] | null, pin: [number, number] | null) => {
      setPolygonCoords(poly);
      setPinCoords(pin);
      setIsConfirmed(false);
      // Save draft
      saveBoundaryDraft({
        mode: poly ? 'polygon' : pin ? 'pin' : 'none',
        polygon: poly,
        pin: pin,
        name: plotName,
        confirmed: false,
      });
    },
    [plotName]
  );

  const handleConfirm = async () => {
    setIsVerifying(true);
    let finalAreaHa = validation.areaHa;
    let areaSource: 'server' | 'client-estimate' = 'client-estimate';

    if (polygonCoords && polygonCoords.length >= 3) {
      try {
        const serverArea = await fetchFieldArea(polygonCoords);
        if (serverArea && serverArea.area_ha != null) {
          finalAreaHa = serverArea.area_ha;
          areaSource = 'server';
        }
      } catch (err) {
        console.warn('Server area verification failed, using client geometry estimate:', err);
      }
    }

    setIsVerifying(false);
    setIsConfirmed(true);

    // Save final confirmed draft
    saveBoundaryDraft({
      mode: polygonCoords ? 'polygon' : pinCoords ? 'pin' : 'none',
      polygon: polygonCoords,
      pin: pinCoords,
      name: plotName || (polygonCoords ? 'Custom Drawn Field' : 'Field Pin'),
      confirmed: true,
      areaHa: finalAreaHa,
    });

    // Update global workflow context
    updateFormData({
      polygonPts: polygonCoords || [],
      pointPt: pinCoords || (polygonCoords ? polygonCoords[0] : undefined),
      areaHa: Number(finalAreaHa.toFixed(2)),
      selectedPresetName: plotName || 'Custom Drawn Field',
    });

    showToast({
      type: 'success',
      title: 'Boundary Confirmed',
      message: `${finalAreaHa.toFixed(2)} Ha verified (${areaSource}). Advancing to Field Analysis.`,
      durationMs: 2500,
    });

    // Navigate to Step 3: Field Analysis
    setTimeout(() => {
      goToStep(3);
    }, 400);
  };

  const handleClear = () => {
    setPolygonCoords(null);
    setPinCoords(null);
    setIsConfirmed(false);
    setIsCoachDismissed(false);
    clearBoundaryDraft();
    updateFormData({
      polygonPts: [],
      pointPt: undefined,
      areaHa: 0,
    });
    showToast({
      type: 'info',
      title: 'Boundary Cleared',
      message: 'All vertices and pins cleared.',
    });
  };

  const hasBoundary = Boolean((polygonCoords && polygonCoords.length > 0) || pinCoords);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'calc(100vh - 120px)',
        overflow: 'hidden',
        background: 'var(--bg-0)',
      }}
    >
      {/* Top Search Bar */}
      <SearchBar
        onFlyTo={(coords, zoom) => setSearchTarget({ coords, zoom })}
        onDropSearchMarker={(coords) => setSearchTarget({ coords, zoom: 16 })}
      />

      {/* Left Tool Dock */}
      <ToolDock
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        canUndo={false}
        canRedo={false}
        onUndo={() => {}}
        onRedo={() => {}}
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
