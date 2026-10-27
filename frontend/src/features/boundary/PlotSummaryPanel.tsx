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
} from 'lucide-react';
import { BoundaryValidationResult } from './boundaryTypes';
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

  const canConfirm = (isPinMode ? pinCoords !== null : validation.valid) && !serverError;

  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        right: '20px',
        zIndex: 'var(--z-panel)',
        width: 'min(360px, 90vw)',
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          padding: '20px',
          background: 'var(--glass-strong)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--elev-3)',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
        }}
      >
        {/* Header & Status */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 600, color: 'var(--ink-1)' }}>
              Plot Summary
            </h4>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.8125rem', color: 'var(--ink-2)', fontWeight: 500 }}>
            Plot Name
          </label>
          <input
            type="text"
            value={plotName}
            onChange={e => onPlotNameChange(e.target.value)}
            placeholder="e.g. North Acre Paddy"
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--r-xs)',
              background: 'var(--bg-2)',
              border: '1px solid var(--glass-border)',
              color: 'var(--ink-1)',
              fontSize: '0.875rem',
              fontFamily: 'var(--font-ui)',
              outline: 'none',
            }}
          />
        </div>

        {/* Pin Warning Banner if Pin Mode */}
        {isPinMode && (
          <div
            style={{
              padding: '10px 12px',
              background: 'rgba(217, 173, 79, 0.12)',
              border: '1px solid rgba(217, 173, 79, 0.3)',
              borderRadius: 'var(--r-xs)',
              fontSize: '0.8125rem',
              color: 'var(--gold-300)',
              lineHeight: 1.4,
            }}
          >
            <strong>Pin only:</strong> Area unknown; environmental & regulatory models will use point coordinates without parcel perimeter.
          </div>
        )}

        {/* Server Area Error Banner (PRD §3.3 S5) */}
        {serverError && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              padding: '10px 12px',
              background: 'rgba(255, 107, 107, 0.15)',
              border: '1px solid rgba(255, 107, 107, 0.4)',
              borderRadius: 'var(--r-xs)',
              color: 'var(--danger)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.8125rem' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{serverError.code || 'AREA_VALIDATION_ERROR'}</span>
            </div>
            <div style={{ fontSize: '0.75rem', lineHeight: 1.4, paddingLeft: '23px' }}>
              {serverError.message}
            </div>
          </div>
        )}

        {/* Validation Errors list */}
        {!isPinMode && validation.issues.length > 0 && validation.vertexCount > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              padding: '10px 12px',
              background: 'rgba(255, 107, 107, 0.12)',
              border: '1px solid rgba(255, 107, 107, 0.3)',
              borderRadius: 'var(--r-xs)',
            }}
          >
            {validation.issues.map((issue, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8125rem', color: 'var(--danger)' }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                <span>{issue.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Live Metrics */}
        {!isPinMode ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
              padding: '12px',
              background: 'var(--bg-2)',
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Area
              </div>
              <StatNumber value={validation.areaHa} decimals={2} unit="ha" />
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)', marginTop: '2px' }}>
                {validation.areaAcres.toFixed(2)} ac · {validation.areaGuntas.toFixed(1)} guntas
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Perimeter
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--ink-1)' }}>
                {validation.perimeterM > 1000
                  ? `${(validation.perimeterM / 1000).toFixed(2)} km`
                  : `${Math.round(validation.perimeterM)} m`}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)', marginTop: '2px' }}>
                {validation.vertexCount} vertices
              </div>
            </div>

            {validation.centroid && (
              <div style={{ gridColumn: 'span 2', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Center Coordinates
                </div>
                <div style={{ fontSize: '0.8125rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-1)' }}>
                  {validation.centroid[1].toFixed(5)}°N, {validation.centroid[0].toFixed(5)}°E
                </div>
              </div>
            )}
          </div>
        ) : (
          pinCoords && (
            <div
              style={{
                padding: '12px',
                background: 'var(--bg-2)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--glass-border)',
              }}
            >
              <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Pin Location
              </div>
              <div style={{ fontSize: '0.875rem', fontFamily: 'var(--font-mono)', color: 'var(--ink-1)', marginTop: '4px' }}>
                {pinCoords[1].toFixed(5)}°N, {pinCoords[0].toFixed(5)}°E
              </div>
            </div>
          )
        )}

        {/* Server verification indicator */}
        {isConfirmed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--emerald-500)' }}>
            <ShieldCheck size={16} />
            <span>Server-verified boundary geometry ✓</span>
          </div>
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
          style={{ width: '100%' }}
        >
          {isConfirmed ? 'Update & Proceed →' : 'Confirm Boundary →'}
        </Button>

        {/* Geometry Export (GeoJSON Copy & Download) */}
        {(polygonCoords || pinCoords) && (
          <div style={{ display: 'flex', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
            <Button
              variant="glass"
              size="sm"
              icon={copied ? <Check size={14} /> : <Copy size={14} />}
              onClick={handleCopyGeoJSON}
              style={{ flex: 1 }}
            >
              {copied ? 'Copied' : 'Copy GeoJSON'}
            </Button>
            <Button
              variant="glass"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleDownloadGeoJSON}
              style={{ flex: 1 }}
            >
              Download
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
