import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  'aria-label': string; // Mandatory for a11y (PRD §6.4 & §6.7)
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isActive?: boolean;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  'aria-label': ariaLabel,
  variant = 'glass',
  size = 'md',
  isActive = false,
  disabled,
  className = '',
  ...rest
}) => {
  const activeClass = isActive ? 'ui-icon-btn-active' : `ui-icon-btn-${variant}`;
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={`ui-icon-btn ui-icon-btn-${size} ${activeClass} interactive-scale ${className}`}
      {...rest}
    >
      {icon}
    </button>
  );
};
