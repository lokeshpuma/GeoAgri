import React from 'react';
import { Compass, Maximize2, Calendar, CheckCircle, AlertTriangle } from 'lucide-react';

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
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Field Geometry Summary</h3>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="metric-box">
          <span className="metric-label">Calculated Area</span>
          <span className="metric-value" style={{ color: '#10b981' }}>
            {areaHa != null ? `${areaHa.toFixed(2)} Ha` : 'N/A (Point Query)'}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Target Season</span>
          <span className="metric-value" style={{ textTransform: 'capitalize' }}>{season}</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem', color: '#9ca3af' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Compass size={16} style={{ color: '#14b8a6' }} />
          <span>Centroid: <strong>{centroidLat.toFixed(4)}°N, {centroidLon.toFixed(4)}°E</strong></span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {polygonValid ? (
            <>
              <CheckCircle size={16} style={{ color: '#34d399' }} />
              <span style={{ color: '#34d399' }}>Valid WGS84 Geodesic Ring {boundarySource ? `(${boundarySource})` : ''}</span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} style={{ color: '#fbbf24' }} />
              <span style={{ color: '#fbbf24' }}>
                Point Query (No Polygon Boundary Provided)
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
