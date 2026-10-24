import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'glass' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  isLoading = false,
  disabled,
  className = '',
  style,
  ...rest
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'var(--grad-brand)',
          color: '#05090a',
          fontWeight: 600,
          border: 'none',
          boxShadow: 'var(--elev-1), 0 0 12px var(--emerald-glow)',
        };
      case 'secondary':
        return {
          background: 'var(--bg-2)',
          color: 'var(--ink-1)',
          fontWeight: 500,
          border: '1px solid var(--glass-border)',
          boxShadow: 'var(--elev-1)',
        };
      case 'glass':
        return {
          background: 'var(--glass)',
          color: 'var(--ink-1)',
          fontWeight: 500,
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: 'var(--ink-2)',
          fontWeight: 500,
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          background: 'var(--danger)',
          color: '#ffffff',
          fontWeight: 600,
          border: 'none',
          boxShadow: 'var(--elev-1)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return {
          padding: '6px 12px',
          fontSize: '0.8125rem',
          borderRadius: 'var(--r-xs)',
          gap: '6px',
        };
      case 'lg':
        return {
          padding: '12px 24px',
          fontSize: '1rem',
          borderRadius: 'var(--r-md)',
          gap: '10px',
        };
      case 'md':
      default:
        return {
          padding: '8px 18px',
          fontSize: '0.875rem',
          borderRadius: 'var(--r-sm)',
          gap: '8px',
        };
    }
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`interactive-scale ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        fontFamily: 'var(--font-ui)',
        transition: 'all var(--t-fast) var(--ease-out)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        textDecoration: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...rest}
    >
      {isLoading ? (
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
          }}
        />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
        </>
      )}
    </button>
  );
};
