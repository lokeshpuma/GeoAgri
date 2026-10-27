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
    <div className="ui-slider-container">
      {(label !== undefined || formatValue !== undefined) && (
        <div className="ui-slider-header">
          {label && <label className="ui-slider-label">{label}</label>}
          <span className="ui-slider-val">{formatValue(value)}</span>
        </div>
      )}
      <div style={{ position: 'relative', width: '100%', display: 'flex' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          className="ui-slider-track"
          style={{
            background: `linear-gradient(to right, var(--emerald-500) 0%, var(--emerald-500) ${percentage}%, var(--bg-2) ${percentage}%, var(--bg-2) 100%)`,
          }}
        />
      </div>
    </div>
  );
};
