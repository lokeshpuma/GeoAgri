import React from 'react';
import { Droplet } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface IrrigationPanelProps {
  summary?: FullReportResponse['irrigation_summary'] | null;
}

export const IrrigationPanel: React.FC<IrrigationPanelProps> = ({ summary }) => {
  if (!summary) {
    return (
      <div className="glass-card irrigation-panel-wrap">
        <div className="flex-row-center gap-8">
          <Droplet className="text-info" size={20} />
          <h3 className="text-lg font-semibold m-0 text-ink-1">Irrigation Feasibility & Water Balance (Model C)</h3>
        </div>
        <p className="text-sm text-ink-2" style={{ marginTop: '12px', marginBottom: 0 }}>Irrigation feasibility not available for this parcel.</p>
      </div>
    );
  }

  const mode = summary.recommended_mode || 'rainfed';
  const waterDemand = summary.total_water_demand_m3 != null
    ? `${summary.total_water_demand_m3.toLocaleString()} m³`
    : 'Not available';
  const rainfall = summary.effective_rainfall_mm != null
    ? `${summary.effective_rainfall_mm} mm`
    : 'Not available';

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
            {mode}
          </span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Total Water Demand</span>
          <span className="metric-value">{waterDemand}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Effective Rainfall</span>
          <span className="metric-value">{rainfall}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Water Balance</span>
          <span className={`metric-value ${mode === 'rainfed' ? 'text-emerald-light' : 'text-gold'}`}>
            {mode === 'rainfed' ? '+ Surplus' : 'Supplemental'}
          </span>
        </div>
      </div>
    </div>
  );
};
