import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  Download,
  Copy,
  MapPin,
  ArrowRight,
  ShieldCheck,
  Check,
  Info,
} from 'lucide-react';
import { BoundaryValidationResult } from './boundaryTypes';
import { DrawStatus } from './extractBoundary';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { StatNumber } from '../../ui/StatNumber';
import { useToast } from '../../ui/Toast';

export interface PlotSummaryPanelProps {
  plotName: string;
  onPlotNameChange: (name: string) => void;
  validation: BoundaryValidationResult;
  isPinMode: boolean;
  pinCoords: [number, number] | null;
  isConfirmed: boolean;
  isVerifying: boolean;
  onConfirm: () => void;
  polygonCoords: [number, number][] | null;
  serverError?: { code?: string; message: string } | null;
  drawStatus?: DrawStatus;
  onFinishShape?: () => void;
  onEditBoundary?: () => void;
}

export const PlotSummaryPanel: React.FC<PlotSummaryPanelProps> = ({
  plotName,
  onPlotNameChange,
  validation,
  isPinMode,
  pinCoords,
  isConfirmed,
  isVerifying,
  onConfirm,
  polygonCoords,
  serverError,
  drawStatus = 'none',
  onFinishShape,
  onEditBoundary,
}) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleCopyGeoJSON = () => {
    if (!polygonCoords && !pinCoords) return;

    let geojson: any;
    if (polygonCoords) {
      geojson = {
        type: 'Feature',
        properties: { name: plotName || 'Field Boundary', areaHa: validation.areaHa },
        geometry: {
          type: 'Polygon',
          coordinates: [polygonCoords],
        },
      };
    } else if (pinCoords) {
      geojson = {
        type: 'Feature',
        properties: { name: plotName || 'Field Pin' },
        geometry: {
          type: 'Point',
          coordinates: pinCoords,
        },
      };
    }

    navigator.clipboard.writeText(JSON.stringify(geojson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast({
      type: 'success',
      title: 'GeoJSON Copied',
      message: 'Plot geometry copied to clipboard.',
    });
  };

  const handleDownloadGeoJSON = () => {
    if (!polygonCoords && !pinCoords) return;

    let geojson: any;
    if (polygonCoords) {
      geojson = {
        type: 'Feature',
        properties: { name: plotName || 'Field Boundary', areaHa: validation.areaHa },
        geometry: {
          type: 'Polygon',
          coordinates: [polygonCoords],
        },
      };
    } else if (pinCoords) {
      geojson = {
        type: 'Feature',
        properties: { name: plotName || 'Field Pin' },
        geometry: {
          type: 'Point',
          coordinates: pinCoords,
        },
      };
    }

    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(plotName || 'plot').toLowerCase().replace(/\s+/g, '_')}_boundary.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const canConfirm =
    (isPinMode ? pinCoords !== null : (validation.valid && drawStatus !== 'drawing')) &&
    !serverError;

  return (
    <div className="plot-summary-container">
      <div className="glass-panel plot-summary-panel">
        {/* Header & Status */}
        <div className="plot-summary-header">
          <div>
            <h4 className="plot-summary-title">
              Plot Summary
            </h4>
            <span className="plot-summary-subtitle">
              {isPinMode ? 'Point Location Mode' : 'Polygon Boundary'}
            </span>
          </div>

          {isPinMode ? (
            <Badge variant={pinCoords ? 'gold' : 'neutral'} dot>
              {pinCoords ? 'Pin Dropped' : 'No Pin'}
            </Badge>
          ) : (
            <Badge variant={validation.valid ? 'emerald' : validation.vertexCount > 0 ? 'danger' : 'neutral'} dot>
              {validation.valid ? 'Valid Boundary' : validation.vertexCount > 0 ? 'Invalid' : 'Idle'}
            </Badge>
          )}
        </div>

        {/* Plot Name Input */}
        <div className="plot-name-field">
          <label className="plot-name-label">
            Plot Name
          </label>
          <input
            type="text"
            value={plotName}
            onChange={e => onPlotNameChange(e.target.value)}
            placeholder="e.g. North Acre Paddy"
            className="plot-name-input"
          />
        </div>

        {/* Pin Warning Banner if Pin Mode */}
        {isPinMode && (
          <div className="pin-warning-box">
            <strong>Pin only:</strong> Area unknown; environmental & regulatory models will use point coordinates without parcel perimeter.
          </div>
        )}

        {/* Server Area Error Banner (PRD §3.3 S5) */}
        {serverError && (
          <div className="server-error-box">
            <div className="server-error-title-row">
              <AlertTriangle size={15} className="shrink-0" />
              <span>{serverError.code || 'AREA_VALIDATION_ERROR'}</span>
            </div>
            <div className="server-error-msg">
              {serverError.message}
            </div>
          </div>
        )}

        {/* Validation Errors list */}
        {!isPinMode && validation.issues.length > 0 && validation.vertexCount > 0 && (
          <div className="validation-issues-box">
            {validation.issues.map((issue, i) => (
              <div key={i} className="validation-issue-item">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Live Metrics */}
        {!isPinMode ? (
          <div className="plot-metrics-grid">
            <div>
              <div className="plot-metric-label">
                Area
              </div>
              <StatNumber value={validation.areaHa} decimals={2} unit="ha" />
              <div className="plot-metric-sub">
                {validation.areaAcres.toFixed(2)} ac · {validation.areaGuntas.toFixed(1)} guntas
              </div>
            </div>

            <div>
              <div className="plot-metric-label">
                Perimeter
              </div>
              <div className="plot-perimeter-val">
                {validation.perimeterM > 1000
                  ? `${(validation.perimeterM / 1000).toFixed(2)} km`
                  : `${Math.round(validation.perimeterM)} m`}
              </div>
              <div className="plot-metric-sub">
                {validation.vertexCount} vertices
              </div>
            </div>

            {validation.centroid && (
              <div className="plot-coords-row">
                <div className="plot-metric-label">
                  Center Coordinates
                </div>
                <div className="plot-coords-val">
                  {validation.centroid[1].toFixed(5)}°N, {validation.centroid[0].toFixed(5)}°E
                </div>
              </div>
            )}
          </div>
        ) : (
          pinCoords && (
            <div className="pin-coords-box">
              <div className="plot-metric-label">
                Pin Location
              </div>
              <div className="pin-coords-val">
                {pinCoords[1].toFixed(5)}°N, {pinCoords[0].toFixed(5)}°E
              </div>
            </div>
          )
        )}

        {/* Drawing in-progress banner with Finish shape button (PRD v3.2 §2) */}
        {drawStatus === 'drawing' && (
          <div className="drawing-help-banner">
            <div className="drawing-help-content">
              <Info size={16} />
              <span>Finish the shape: double-click, click the first corner, or press Enter.</span>
            </div>
            {onFinishShape && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onFinishShape}
                className="btn-full-width btn-finish-shape"
              >
                Finish shape
              </Button>
            )}
          </div>
        )}

        {/* Server verification indicator */}
        {isConfirmed && (
          <div className="server-verified-row">
            <ShieldCheck size={16} />
            <span>Server-verified boundary geometry ✓</span>
          </div>
        )}

        {/* Edit boundary button when confirmed (PRD v3.2 §2) */}
        {isConfirmed && onEditBoundary && (
          <Button
            variant="glass"
            size="md"
            onClick={onEditBoundary}
            className="btn-full-width btn-edit-boundary"
          >
            Edit boundary
          </Button>
        )}

        {/* Action: Confirm boundary */}
        <Button
          variant="primary"
          size="lg"
          disabled={!canConfirm || isVerifying}
          isLoading={isVerifying}
          onClick={onConfirm}
          icon={<ArrowRight size={18} />}
          iconPosition="right"
          className="btn-full-width"
        >
          {isConfirmed ? 'Update & Proceed →' : 'Confirm Boundary →'}
        </Button>

        {/* Geometry Export (GeoJSON Copy & Download) */}
        {(polygonCoords || pinCoords) && (
          <div className="geometry-export-row">
            <Button
              variant="glass"
              size="sm"
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyGeoJSON}
              className="btn-flex-1"
            >
              {copied ? 'Copied' : 'Copy GeoJSON'}
            </Button>
            <Button
              variant="glass"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleDownloadGeoJSON}
              className="btn-flex-1"
            >
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
