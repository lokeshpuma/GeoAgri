import React from 'react';
import { Layers } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface IntercropPanelProps {
  summary?: FullReportResponse['intercrop_summary'] | null;
}

export const IntercropPanel: React.FC<IntercropPanelProps> = ({ summary }) => {
  if (!summary) return null;

  return (
    <div className="glass-card intercrop-panel-container">
      <div className="intercrop-panel-header">
        <Layers className="text-emerald" size={20} />
        <h3 className="intercrop-panel-title">Companion Intercropping Guidance</h3>
      </div>

      <div className="intercrop-grid-2">
        <div className="metric-box">
          <span className="metric-label">Recommended Intercrop Pair</span>
          <span className="metric-value text-emerald">{summary.top_pair || 'None (Sole Cropping)'}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Estimated Production Boost</span>
          <span className="metric-value text-gold">+{summary.estimated_production_boost_t ?? 0} Tonnes</span>
        </div>
      </div>

      {summary.disclaimer && (
        <p className="intercrop-disclaimer">
          ⚠️ {summary.disclaimer}
        </p>
      )}
    </div>
  );
};
