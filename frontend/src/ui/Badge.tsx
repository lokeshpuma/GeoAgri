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
  ...rest
}) => {
  return (
    <span
      className={`ui-badge ui-badge-${size} ui-badge-${variant} ${className}`}
      {...rest}
    >
      {dot && <span className="ui-badge-dot" />}
      {children}
    </span>
  );
};
