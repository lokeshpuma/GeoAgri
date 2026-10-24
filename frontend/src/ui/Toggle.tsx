import React from 'react';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  description?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  description,
}) => {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      {(label || description) && (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {label && (
            <span style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--ink-1)' }}>
              {label}
            </span>
          )}
          {description && (
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-3)' }}>
              {description}
            </span>
          )}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={{
          position: 'relative',
          width: '40px',
          height: '22px',
          borderRadius: 'var(--r-pill)',
          background: checked ? 'var(--emerald-500)' : 'var(--bg-2)',
          border: '1px solid var(--glass-border)',
          transition: 'all var(--t-fast) var(--ease-out)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          padding: 0,
          boxShadow: checked ? '0 0 10px var(--emerald-glow)' : 'none',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '20px' : '2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#ffffff',
            boxShadow: 'var(--elev-1)',
            transition: 'left var(--t-fast) var(--ease-spring)',
          }}
        />
      </button>
    </label>
  );
};
