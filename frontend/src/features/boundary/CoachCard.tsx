import React from 'react';
import { Search, PenTool, CheckSquare, X } from 'lucide-react';

export interface CoachCardProps {
  onDismiss?: () => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({ onDismiss }) => {
  return (
    <div
      className="animate-fade-rise glass-panel"
      style={{
        position: 'absolute',
        top: '76px',
        left: '74px',
        zIndex: 'var(--z-panel)',
        padding: '16px 18px',
        width: '320px',
        maxWidth: 'calc(100vw - 100px)',
        background: 'var(--glass-strong)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--elev-3)',
        pointerEvents: 'auto',
      }}
    >
      {/* Top Header with Dismiss Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(34, 197, 139, 0.15)',
              color: 'var(--emerald-500)',
            }}
          >
            <PenTool size={15} />
          </div>
          <h4
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: 'var(--ink-1)',
              margin: 0,
            }}
          >
            Find your land
          </h4>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            aria-label="Close guidance card"
            title="Dismiss helper"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--ink-3)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: 'var(--r-xs)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      <p
        style={{
          fontSize: '0.78125rem',
          color: 'var(--ink-2)',
          margin: '0 0 12px 0',
          lineHeight: 1.45,
        }}
      >
        Search place name or paste coordinates above, then click corners to trace boundary.
      </p>

      {/* 3 Step Pills */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          marginBottom: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-2)',
            padding: '6px 10px',
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <Search size={14} style={{ color: 'var(--emerald-500)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink-1)' }}>1. Search:</strong> Place name or lat, lng
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-2)',
            padding: '6px 10px',
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <PenTool size={14} style={{ color: 'var(--gold-500)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink-1)' }}>2. Draw:</strong> Click corners along parcel edges
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'var(--bg-2)',
            padding: '6px 10px',
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <CheckSquare size={14} style={{ color: 'var(--ok)', flexShrink: 0 }} />
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-2)' }}>
            <strong style={{ color: 'var(--ink-1)' }}>3. Confirm:</strong> Double-click to close
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.6875rem', color: 'var(--ink-3)', textAlign: 'center' }}>
        Press <kbd style={{ background: 'var(--bg-3)', padding: '1px 4px', borderRadius: '3px' }}>D</kbd> Polygon · <kbd style={{ background: 'var(--bg-3)', padding: '1px 4px', borderRadius: '3px' }}>R</kbd> Rect · <kbd style={{ background: 'var(--bg-3)', padding: '1px 4px', borderRadius: '3px' }}>P</kbd> Pin
      </div>
    </div>
  );
};
