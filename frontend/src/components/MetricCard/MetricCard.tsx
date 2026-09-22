import React from 'react';
import { MetricInterpretation } from '../../utils/agronomicFormatters';

interface MetricCardProps {
  data: MetricInterpretation;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ data, icon }) => {
  const getRatingBadge = () => {
    switch (data.rating) {
      case 'optimal':
        return { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
      case 'warning':
        return { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', border: 'rgba(239, 68, 68, 0.3)' };
      case 'moderate':
        return { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.3)' };
      default:
        return { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)' };
    }
  };

  const badgeStyle = getRatingBadge();

  return (
    <div className="human-metric-card">
      <div className="human-metric-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {icon && <span className="metric-icon-slot">{icon}</span>}
          <span className="human-metric-label">{data.label}</span>
        </div>
        <span
          className="human-metric-badge"
          style={{
            background: badgeStyle.bg,
            color: badgeStyle.text,
            border: `1px solid ${badgeStyle.border}`,
          }}
        >
          {data.interpretation}
        </span>
      </div>

      <div className="human-metric-value-row">
        <span className="human-metric-value" style={{ color: badgeStyle.text }}>
          {data.value}
        </span>
        <span className="human-metric-raw" title="Raw technical value">
          {data.rawValue}
        </span>
      </div>

      <p className="human-metric-implication">
        {data.implication}
      </p>
    </div>
  );
};
