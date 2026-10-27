import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface ClimateRiskReportProps {
  summary: FullReportResponse['climate_risk_summary'];
}

export const ClimateRiskReport: React.FC<ClimateRiskReportProps> = ({ summary }) => {
  const getRiskBadge = () => {
    if (summary.overall_risk_level === "Low") return "badge-high";
    if (summary.overall_risk_level === "Moderate") return "badge-moderate";
    return "badge-low";
  };

  return (
    <div className="glass-card climate-risk-wrap">
      <div className="flex-between">
        <div className="flex-row-center gap-8">
          <ShieldAlert className="text-gold" size={20} />
          <h3 className="text-lg font-semibold m-0 text-ink-1">Climate Risk Scorecard (Model E)</h3>
        </div>
        <span className={`badge ${getRiskBadge()}`}>
          {summary.overall_risk_level} Overall Risk
        </span>
      </div>

      <div className="climate-risk-grid">
        <div className="metric-box">
          <span className="metric-label">Drought Stress</span>
          <span className="metric-value">{summary.drought_risk_score.toFixed(0)}%</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Heat Stress</span>
          <span className="metric-value">{summary.heat_risk_score.toFixed(0)}%</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Excess Rain</span>
          <span className="metric-value">{summary.excess_rain_risk_score.toFixed(0)}%</span>
        </div>
      </div>

      <div className="summary-data-cell">
        <span className="text-sm text-ink-2">
          💬 <strong className="text-ink-1">Risk Advisory:</strong> {summary.note}
        </span>
      </div>
    </div>
  );
};
