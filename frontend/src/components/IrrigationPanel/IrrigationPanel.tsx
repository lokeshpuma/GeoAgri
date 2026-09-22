import React from 'react';
import { Droplet } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface IrrigationPanelProps {
  summary: FullReportResponse['irrigation_summary'];
}

export const IrrigationPanel: React.FC<IrrigationPanelProps> = ({ summary }) => {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Droplet style={{ color: '#38bdf8' }} size={20} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Irrigation Feasibility & Water Balance (Model C)</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
        <div className="metric-box">
          <span className="metric-label">Recommended Mode</span>
          <span className="metric-value" style={{ color: '#38bdf8', textTransform: 'capitalize' }}>
            {summary.recommended_mode}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Total Water Demand</span>
          <span className="metric-value">{summary.total_water_demand_m3.toLocaleString()} m³</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Effective Rainfall</span>
          <span className="metric-value">{summary.effective_rainfall_mm} mm</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Water Balance</span>
          <span className="metric-value" style={{ color: summary.recommended_mode === 'rainfed' ? '#34d399' : '#fbbf24' }}>
            {summary.recommended_mode === 'rainfed' ? '+ Surplus' : 'Supplemental'}
          </span>
        </div>
      </div>
    </div>
  );
};
