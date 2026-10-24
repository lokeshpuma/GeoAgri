import React from 'react';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'normal' | 'strong' | 'subtle';
  glow?: 'emerald' | 'gold' | 'none';
  elevation?: 1 | 2 | 3;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({
  children,
  variant = 'strong',
  glow = 'none',
  elevation = 2,
  className = '',
  style,
  ...rest
}) => {
  const getBackground = () => {
    switch (variant) {
      case 'subtle':
        return 'var(--glass)';
      case 'normal':
        return 'var(--glass-strong)';
      case 'strong':
      default:
        return 'var(--glass-strong)';
    }
  };

  const getGlow = () => {
    switch (glow) {
      case 'emerald':
        return '0 0 24px var(--emerald-glow)';
      case 'gold':
        return '0 0 24px var(--gold-glow)';
      case 'none':
      default:
        return undefined;
    }
  };

  const getElevation = () => {
    switch (elevation) {
      case 1:
        return 'var(--elev-1)';
      case 3:
        return 'var(--elev-3)';
      case 2:
      default:
        return 'var(--elev-2)';
    }
  };

  const boxShadow = [getElevation(), getGlow()].filter(Boolean).join(', ');

  return (
    <div
      className={`glass-panel ${className}`}
      style={{
        background: getBackground(),
        boxShadow,
        borderRadius: 'var(--r-md)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};
