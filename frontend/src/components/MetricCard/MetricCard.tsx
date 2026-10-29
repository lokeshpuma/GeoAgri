import React from 'react';
import { MetricInterpretation } from '../../utils/agronomicFormatters';

interface MetricCardProps {
  data: MetricInterpretation;
  icon?: React.ReactNode;
}

export const MetricCard: React.FC<MetricCardProps> = ({ data, icon }) => {
  const isUnavailable = !data || data.value === 'Not available' || data.interpretation === 'Not available';

  const ratingClass = isUnavailable
    ? 'neutral'
    : data.rating === 'optimal'
    ? 'optimal'
    : data.rating === 'warning'
    ? 'warning'
    : data.rating === 'moderate'
    ? 'moderate'
    : 'neutral';

  const colorClass = isUnavailable
    ? 'text-ink-3'
    : data.rating === 'optimal'
    ? 'text-emerald-light'
    : data.rating === 'warning'
    ? 'text-danger'
    : data.rating === 'moderate'
    ? 'text-gold'
    : 'text-ink-3';

  return (
    <div className="human-metric-card">
      <div className="human-metric-header">
        <div className="flex-row-center gap-8">
          {icon && <span className="metric-icon-slot">{icon}</span>}
          <span className="human-metric-label">{data.label}</span>
        </div>
        <span className={`human-metric-badge badge-${ratingClass}`}>
          {data.interpretation}
        </span>
      </div>

      <div className="human-metric-value-row">
        <span className={`human-metric-value ${colorClass}`}>
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
