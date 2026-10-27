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
    <label className={`ui-toggle-container ${disabled ? 'disabled' : ''}`}>
      {(label || description) && (
        <div className="ui-toggle-text">
          {label && <span className="ui-toggle-title">{label}</span>}
          {description && <span className="ui-toggle-desc">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`ui-toggle-switch ${checked ? 'checked' : ''}`}
      >
        <span className="ui-toggle-thumb" />
      </button>
    </label>
  );
};
