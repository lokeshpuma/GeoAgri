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
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert style={{ color: '#f59e0b' }} size={20} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Climate Risk Scorecard (Model E)</h3>
        </div>
        <span className={`badge ${getRiskBadge()}`}>
          {summary.overall_risk_level} Overall Risk
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
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

      <p style={{ fontSize: '0.85rem', color: '#d1d5db', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px' }}>
        💬 <strong>Risk Advisory:</strong> {summary.note}
      </p>
    </div>
  );
};
