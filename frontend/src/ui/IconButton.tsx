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
  style,
  ...rest
}) => {
  const getDimensions = () => {
    switch (size) {
      case 'sm':
        return { width: '36px', height: '36px', iconSize: 16 };
      case 'lg':
        return { width: '48px', height: '48px', iconSize: 22 };
      case 'md':
      default:
        return { width: '40px', height: '40px', iconSize: 18 }; // Minimum 40px hit area
    }
  };

  const dims = getDimensions();

  const getVariantStyles = (): React.CSSProperties => {
    if (isActive) {
      return {
        background: 'var(--emerald-500)',
        color: '#05090a',
        border: '1px solid var(--emerald-300)',
        boxShadow: '0 0 12px var(--emerald-glow)',
      };
    }

    switch (variant) {
      case 'primary':
        return {
          background: 'var(--grad-brand)',
          color: '#05090a',
          border: 'none',
          boxShadow: 'var(--elev-1)',
        };
      case 'secondary':
        return {
          background: 'var(--bg-2)',
          color: 'var(--ink-1)',
          border: '1px solid var(--glass-border)',
        };
      case 'glass':
        return {
          background: 'var(--glass)',
          color: 'var(--ink-1)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--ink-2)',
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          background: 'var(--danger)',
          color: '#ffffff',
          border: 'none',
        };
    }
  };

  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={isActive}
      disabled={disabled}
      className={`interactive-scale ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: dims.width,
        height: dims.height,
        minWidth: dims.width,
        minHeight: dims.height,
        borderRadius: 'var(--r-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all var(--t-fast) var(--ease-out)',
        padding: 0,
        ...getVariantStyles(),
        ...style,
      }}
      {...rest}
    >
      {icon}
    </button>
  );
};
