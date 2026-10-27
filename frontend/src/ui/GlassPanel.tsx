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
  const variantClass = `glass-panel-${variant}`;
  const elevationClass = `glass-panel-elev-${elevation}`;
  const glowClass = glow !== 'none' ? `glass-panel-glow-${glow}` : '';

  return (
    <div
      className={`glass-panel ${variantClass} ${elevationClass} ${glowClass} ${className}`}
      style={style}
      {...rest}
    >
      {children}
    </div>
  );
};
