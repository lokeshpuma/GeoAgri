import React from 'react';

export interface SliderProps {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  formatValue?: (val: number) => string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  formatValue = val => String(val),
  disabled = false,
}) => {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {(label !== undefined || formatValue !== undefined) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {label && (
            <label style={{ fontSize: '0.8125rem', color: 'var(--ink-2)', fontWeight: 500 }}>
              {label}
            </label>
          )}
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>
            {formatValue(value)}
          </span>
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            height: '6px',
            appearance: 'none',
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, var(--emerald-500) 0%, var(--emerald-500) ${percentage}%, var(--bg-2) ${percentage}%, var(--bg-2) 100%)`,
            borderRadius: 'var(--r-pill)',
            outline: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
        />
      </div>
    </div>
  );
};
