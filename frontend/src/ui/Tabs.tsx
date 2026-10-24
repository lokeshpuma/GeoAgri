import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'line';
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeId,
  onChange,
  variant = 'pill',
  className = '',
}) => {
  return (
    <div
      role="tablist"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: variant === 'pill' ? '6px' : '16px',
        background: variant === 'pill' ? 'var(--bg-2)' : 'transparent',
        padding: variant === 'pill' ? '4px' : '0',
        borderRadius: variant === 'pill' ? 'var(--r-pill)' : '0',
        border: variant === 'pill' ? '1px solid var(--glass-border)' : 'none',
        borderBottom: variant === 'line' ? '1px solid var(--glass-border)' : undefined,
      }}
    >
      {tabs.map(tab => {
        const isActive = tab.id === activeId;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: variant === 'pill' ? '6px 14px' : '8px 12px',
              fontSize: '0.875rem',
              fontWeight: isActive ? 600 : 500,
              fontFamily: 'var(--font-ui)',
              color: isActive ? 'var(--ink-1)' : 'var(--ink-2)',
              background: isActive && variant === 'pill' ? 'var(--glass-strong)' : 'transparent',
              border: 'none',
              borderBottom: variant === 'line' && isActive ? '2px solid var(--emerald-500)' : undefined,
              borderRadius: variant === 'pill' ? 'var(--r-pill)' : '0',
              boxShadow: isActive && variant === 'pill' ? 'var(--elev-1)' : 'none',
              cursor: 'pointer',
              transition: 'all var(--t-fast) var(--ease-out)',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon && <span>{tab.icon}</span>}
            <span>{tab.label}</span>
            {tab.badge && <span>{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
};
