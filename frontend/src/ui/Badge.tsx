import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'emerald' | 'gold' | 'danger' | 'warn' | 'info' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  style,
  ...rest
}) => {
  const getColors = () => {
    switch (variant) {
      case 'emerald':
        return {
          bg: 'rgba(34, 197, 139, 0.15)',
          border: 'rgba(34, 197, 139, 0.35)',
          text: 'var(--emerald-300)',
          dotColor: 'var(--emerald-500)',
        };
      case 'gold':
        return {
          bg: 'rgba(217, 173, 79, 0.15)',
          border: 'rgba(217, 173, 79, 0.35)',
          text: 'var(--gold-300)',
          dotColor: 'var(--gold-500)',
        };
      case 'danger':
        return {
          bg: 'rgba(255, 107, 107, 0.15)',
          border: 'rgba(255, 107, 107, 0.35)',
          text: 'var(--danger)',
          dotColor: 'var(--danger)',
        };
      case 'warn':
        return {
          bg: 'rgba(255, 180, 84, 0.15)',
          border: 'rgba(255, 180, 84, 0.35)',
          text: 'var(--warn)',
          dotColor: 'var(--warn)',
        };
      case 'info':
        return {
          bg: 'rgba(108, 182, 255, 0.15)',
          border: 'rgba(108, 182, 255, 0.35)',
          text: 'var(--info)',
          dotColor: 'var(--info)',
        };
      case 'neutral':
      default:
        return {
          bg: 'var(--bg-2)',
          border: 'var(--glass-border)',
          text: 'var(--ink-2)',
          dotColor: 'var(--ink-3)',
        };
    }
  };

  const colors = getColors();

  const isSmall = size === 'sm';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: isSmall ? '2px 8px' : '4px 10px',
        fontSize: isSmall ? '0.75rem' : '0.8125rem',
        fontWeight: 500,
        fontFamily: 'var(--font-ui)',
        lineHeight: 1.2,
        borderRadius: 'var(--r-pill)',
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: colors.dotColor,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  );
};
