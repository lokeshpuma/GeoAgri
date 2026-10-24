import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div
      className={`glass-panel ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '36px 24px',
        background: 'var(--glass)',
        border: '1px dashed var(--glass-border)',
        borderRadius: 'var(--r-md)',
      }}
    >
      {icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--bg-2)',
            color: 'var(--emerald-500)',
            marginBottom: '14px',
            boxShadow: 'var(--elev-1)',
          }}
        >
          {icon}
        </div>
      )}
      <h4
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: '1.125rem',
          fontWeight: 600,
          color: 'var(--ink-1)',
          margin: 0,
        }}
      >
        {title}
      </h4>
      {description && (
        <p
          style={{
            fontSize: '0.875rem',
            color: 'var(--ink-3)',
            maxWidth: '380px',
            margin: '8px 0 0 0',
            lineHeight: 1.5,
          }}
        >
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '18px' }}>{action}</div>}
    </div>
  );
};
