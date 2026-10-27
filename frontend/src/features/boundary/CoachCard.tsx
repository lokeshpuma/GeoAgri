import React from 'react';
import { Search, PenTool, CheckSquare, X } from 'lucide-react';

export interface CoachCardProps {
  onDismiss?: () => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({ onDismiss }) => {
  return (
    <div className="animate-fade-rise glass-panel coach-card-panel">
      {/* Top Header with Dismiss Button */}
      <div className="coach-header-row">
        <div className="coach-title-group">
          <div className="coach-icon-badge">
            <PenTool size={15} />
          </div>
          <h4 className="coach-title">
            Find your land
          </h4>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Close guidance card"
            title="Dismiss helper"
            className="coach-dismiss-btn"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <p className="coach-desc">
        Search place name or paste coordinates above, then click corners to trace boundary.
      </p>

      {/* 3 Step Pills */}
      <div className="coach-steps-list">
        <div className="coach-step-item">
          <Search size={14} className="text-emerald shrink-0" />
          <div className="coach-step-text">
            <strong>1. Search:</strong> Place name or lat, lng
          </div>
        </div>

        <div className="coach-step-item">
          <PenTool size={14} className="text-gold shrink-0" />
          <div className="coach-step-text">
            <strong>2. Draw:</strong> Click corners along parcel edges
          </div>
        </div>

        <div className="coach-step-item">
          <CheckSquare size={14} className="text-emerald shrink-0" />
          <div className="coach-step-text">
            <strong>3. Confirm:</strong> Double-click to close
          </div>
        </div>
      </div>

      <div className="coach-shortcuts-footer">
        Press <kbd className="coach-kbd">D</kbd> Polygon · <kbd className="coach-kbd">R</kbd> Rect · <kbd className="coach-kbd">P</kbd> Pin
      </div>
    </div>
  );
};
