import React from 'react';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  circle?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '20px',
  borderRadius = 'var(--r-xs)',
  circle = false,
  className = '',
  style,
  ...rest
}) => {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width: circle ? height : width,
        height,
        borderRadius: circle ? '50%' : borderRadius,
        background: 'linear-gradient(90deg, var(--bg-1) 0%, var(--bg-2) 50%, var(--bg-1) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.8s infinite linear',
        ...style,
      }}
      {...rest}
    />
  );
};
