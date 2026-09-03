import React from 'react';
import { Layers } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface IntercropPanelProps {
  summary: FullReportResponse['intercrop_summary'];
}

export const IntercropPanel: React.FC<IntercropPanelProps> = ({ summary }) => {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Layers style={{ color: '#10b981' }} size={20} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Companion Intercropping Guidance</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="metric-box">
          <span className="metric-label">Recommended Intercrop Pair</span>
          <span className="metric-value" style={{ color: '#a7f3d0', fontSize: '1.1rem' }}>{summary.top_pair}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Estimated Production Boost</span>
          <span className="metric-value" style={{ color: '#fbbf24' }}>+{summary.estimated_production_boost_t} Tonnes</span>
        </div>
      </div>

      <p style={{ fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
        ⚠️ {summary.disclaimer}
      </p>
    </div>
  );
};
