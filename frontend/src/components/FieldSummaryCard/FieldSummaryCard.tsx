import React from 'react';
import { Compass, CheckCircle, AlertTriangle } from 'lucide-react';

interface FieldSummaryCardProps {
  areaHa: number | null;
  centroidLon: number;
  centroidLat: number;
  season: string;
  polygonValid: boolean;
  boundarySource?: string;
}

export const FieldSummaryCard: React.FC<FieldSummaryCardProps> = ({
  areaHa,
  centroidLon,
  centroidLat,
  season,
  polygonValid,
  boundarySource
}) => {
  return (
    <div className="glass-card field-summary-card">
      <h3 className="text-lg font-semibold m-0 text-ink-1">Field Geometry Summary</h3>
      
      <div className="field-coords-grid">
        <div className="metric-box">
          <span className="metric-label">Calculated Area</span>
          <span className="metric-value text-emerald">
            {areaHa != null ? `${areaHa.toFixed(2)} Ha` : 'N/A (Point Query)'}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Target Season</span>
          <span className="metric-value text-capitalize">{season}</span>
        </div>
      </div>

      <div className="flex-col gap-8 text-sm text-ink-2">
        <div className="flex-row-center gap-6">
          <Compass size={16} className="text-info" />
          <span>Centroid: <strong className="text-ink-1">{centroidLat.toFixed(4)}°N, {centroidLon.toFixed(4)}°E</strong></span>
        </div>
        <div className="flex-row-center gap-6">
          {polygonValid ? (
            <>
              <CheckCircle size={16} className="text-emerald-light" />
              <span className="text-emerald-light">Valid WGS84 Geodesic Ring {boundarySource ? `(${boundarySource})` : ''}</span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} className="text-gold" />
              <span className="text-gold">
                Point Query (No Polygon Boundary Provided)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
