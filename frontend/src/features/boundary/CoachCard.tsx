import React from 'react';
import { Search, PenTool, CheckSquare } from 'lucide-react';

export interface CoachCardProps {
  onDismiss?: () => void;
}

export const CoachCard: React.FC<CoachCardProps> = ({ onDismiss }) => {
  return (
    <div
      className="animate-fade-rise glass-panel"
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 'var(--z-panel)',
        padding: '24px 32px',
        maxWidth: '480px',
        width: '90%',
        background: 'var(--glass-strong)',
        border: '1px solid var(--glass-border)',
        borderRadius: 'var(--r-md)',
        boxShadow: 'var(--elev-3)',
        textAlign: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: 'rgba(34, 197, 139, 0.15)',
          color: 'var(--emerald-500)',
          marginBottom: '14px',
        }}
      >
        <PenTool size={22} />
      </div>

      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.25rem',
          fontWeight: 600,
          color: 'var(--ink-1)',
          margin: '0 0 6px 0',
        }}
      >
        Find your land, then place the first corner
      </h3>

      <p
        style={{
          fontSize: '0.875rem',
          color: 'var(--ink-2)',
          margin: '0 0 20px 0',
          lineHeight: 1.5,
        }}
      >
        Draw the real agricultural boundary of your plot for verified satellite diagnostics.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          textAlign: 'left',
          marginBottom: '16px',
        }}
      >
        <div
          style={{
            background: 'var(--bg-2)',
            padding: '12px',
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div style={{ color: 'var(--emerald-500)', marginBottom: '4px' }}>
            <Search size={16} />
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-1)' }}>1. Search</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Search place or coordinates</div>
        </div>

        <div
          style={{
            background: 'var(--bg-2)',
            padding: '12px',
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div style={{ color: 'var(--gold-500)', marginBottom: '4px' }}>
            <PenTool size={16} />
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-1)' }}>2. Draw</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Click corners along field edges</div>
        </div>

        <div
          style={{
            background: 'var(--bg-2)',
            padding: '12px',
            borderRadius: 'var(--r-xs)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <div style={{ color: 'var(--ok)', marginBottom: '4px' }}>
            <CheckSquare size={16} />
          </div>
          <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-1)' }}>3. Confirm</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>Double-click to close & confirm</div>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
        Press <kbd style={{ background: 'var(--bg-3)', padding: '2px 5px', borderRadius: '4px' }}>D</kbd> for Polygon, <kbd style={{ background: 'var(--bg-3)', padding: '2px 5px', borderRadius: '4px' }}>R</kbd> for Rectangle, <kbd style={{ background: 'var(--bg-3)', padding: '2px 5px', borderRadius: '4px' }}>P</kbd> for Pin
      </div>
    </div>
  );
};
