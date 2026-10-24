import React from 'react';
import { Layers } from 'lucide-react';
import { BasemapId } from './boundaryTypes';
import { BASEMAPS } from './mapStyles';

export interface BasemapSwitcherProps {
  activeBasemap: BasemapId;
  onSelectBasemap: (id: BasemapId) => void;
  labelOpacity: number;
  onLabelOpacityChange: (opacity: number) => void;
}

export const BasemapSwitcher: React.FC<BasemapSwitcherProps> = ({
  activeBasemap,
  onSelectBasemap,
  labelOpacity,
  onLabelOpacityChange,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '24px',
        left: '20px',
        zIndex: 'var(--z-panel)',
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--glass-strong)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--elev-2)',
          padding: '8px',
          gap: '8px',
        }}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle basemap switcher"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'none',
            border: 'none',
            padding: '6px 10px',
            cursor: 'pointer',
            color: 'var(--ink-1)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
          }}
        >
          <Layers size={16} style={{ color: 'var(--emerald-500)' }} />
          <span>{BASEMAPS[activeBasemap].label}</span>
        </button>

        {isOpen && (
          <div
            className="animate-fade-rise"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              paddingTop: '6px',
              borderTop: '1px solid var(--glass-border)',
              minWidth: '160px',
            }}
          >
            {(Object.keys(BASEMAPS) as BasemapId[]).map(id => {
              const item = BASEMAPS[id];
              const isSelected = id === activeBasemap;
              return (
                <button
                  key={id}
                  onClick={() => {
                    onSelectBasemap(id);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 'var(--r-xs)',
                    background: isSelected ? 'var(--bg-2)' : 'transparent',
                    border: 'none',
                    color: isSelected ? 'var(--emerald-500)' : 'var(--ink-2)',
                    fontSize: '0.75rem',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all var(--t-fast) var(--ease-out)',
                  }}
                >
                  <span>{item.label}</span>
                  {isSelected && (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: 'var(--emerald-500)',
                      }}
                    />
                  )}
                </button>
              );
            })}

            <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--ink-3)', marginBottom: '4px' }}>
                <span>Labels</span>
                <span>{Math.round(labelOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={labelOpacity}
                onChange={e => onLabelOpacityChange(Number(e.target.value))}
                style={{ width: '100%', height: '4px', accentColor: 'var(--emerald-500)' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
