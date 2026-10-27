import React from 'react';
import { Layers } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface IntercropPanelProps {
  summary: FullReportResponse['intercrop_summary'];
}

export const IntercropPanel: React.FC<IntercropPanelProps> = ({ summary }) => {
  return (
    <div className="glass-card intercrop-panel-container">
      <div className="intercrop-panel-header">
        <Layers className="text-emerald" size={20} />
        <h3 className="intercrop-panel-title">Companion Intercropping Guidance</h3>
      </div>

      <div className="intercrop-grid-2">
        <div className="metric-box">
          <span className="metric-label">Recommended Intercrop Pair</span>
          <span className="metric-value text-emerald">{summary.top_pair}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Estimated Production Boost</span>
          <span className="metric-value text-gold">+{summary.estimated_production_boost_t} Tonnes</span>
        </div>
      </div>

      <p className="intercrop-disclaimer">
        ⚠️ {summary.disclaimer}
      </p>
    </div>
  );
};
