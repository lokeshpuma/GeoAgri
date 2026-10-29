import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface ClimateRiskReportProps {
  summary?: FullReportResponse['climate_risk_summary'] | null;
}

export const ClimateRiskReport: React.FC<ClimateRiskReportProps> = ({ summary }) => {
  if (!summary) {
    return (
      <div className="glass-card climate-risk-wrap">
        <div className="flex-between">
          <div className="flex-row-center gap-8">
            <ShieldAlert className="text-gold" size={20} />
            <h3 className="text-lg font-semibold m-0 text-ink-1">Climate Risk Scorecard (Model E)</h3>
          </div>
          <span className="badge badge-low">Not available</span>
        </div>
        <p className="text-sm text-ink-2" style={{ marginTop: '12px', marginBottom: 0 }}>Climate risk evaluation not available for this parcel.</p>
      </div>
    );
  }

  const getRiskBadge = () => {
    if (summary.overall_risk_level === "Low") return "badge-high";
    if (summary.overall_risk_level === "Moderate") return "badge-moderate";
    if (summary.overall_risk_level === "High") return "badge-low";
    return "badge-moderate";
  };

  const drought = summary.drought_risk_score != null ? `${summary.drought_risk_score.toFixed(0)}%` : 'N/A';
  const heat = summary.heat_risk_score != null ? `${summary.heat_risk_score.toFixed(0)}%` : 'N/A';
  const excessRain = summary.excess_rain_risk_score != null ? `${summary.excess_rain_risk_score.toFixed(0)}%` : 'N/A';
  const overallRisk = summary.overall_risk_level || 'Not assessed';

  return (
    <div className="glass-card climate-risk-wrap">
      <div className="flex-between">
        <div className="flex-row-center gap-8">
          <ShieldAlert className="text-gold" size={20} />
          <h3 className="text-lg font-semibold m-0 text-ink-1">Climate Risk Scorecard (Model E)</h3>
        </div>
        <span className={`badge ${getRiskBadge()}`}>
          {overallRisk} Overall Risk
        </span>
      </div>

      <div className="climate-risk-grid">
        <div className="metric-box">
          <span className="metric-label">Drought Stress</span>
          <span className="metric-value">{drought}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Heat Stress</span>
          <span className="metric-value">{heat}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Excess Rain</span>
          <span className="metric-value">{excessRain}</span>
        </div>
      </div>

      {summary.note && (
        <div className="summary-data-cell">
          <span className="text-sm text-ink-2">
            💬 <strong className="text-ink-1">Risk Advisory:</strong> {summary.note}
          </span>
        </div>
      )}
    </div>
  );
};
