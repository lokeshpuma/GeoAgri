import React from 'react';
import { Droplet } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface IrrigationPanelProps {
  summary: FullReportResponse['irrigation_summary'];
}

export const IrrigationPanel: React.FC<IrrigationPanelProps> = ({ summary }) => {
  return (
    <div className="glass-card irrigation-panel-wrap">
      <div className="flex-row-center gap-8">
        <Droplet className="text-info" size={20} />
        <h3 className="text-lg font-semibold m-0 text-ink-1">Irrigation Feasibility & Water Balance (Model C)</h3>
      </div>

      <div className="irrigation-grid-3">
        <div className="metric-box">
          <span className="metric-label">Recommended Mode</span>
          <span className="metric-value text-info text-capitalize">
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
          <span className={`metric-value ${summary.recommended_mode === 'rainfed' ? 'text-emerald-light' : 'text-gold'}`}>
            {summary.recommended_mode === 'rainfed' ? '+ Surplus' : 'Supplemental'}
          </span>
        </div>
      </div>
    </div>
  );
};
