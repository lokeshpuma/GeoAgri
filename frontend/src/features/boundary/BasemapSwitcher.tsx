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
    <div className="basemap-switcher-container">
      <div className="glass-panel basemap-switcher-panel">
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label="Toggle basemap switcher"
          className="basemap-toggle-btn"
        >
          <Layers size={16} className="text-emerald" />
          <span>{BASEMAPS[activeBasemap].label}</span>
        </button>

        {isOpen && (
          <div className="animate-fade-rise basemap-dropdown">
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
                  className={`basemap-option-btn ${isSelected ? 'selected' : ''}`}
                >
                  <span>{item.label}</span>
                  {isSelected && (
                    <span className="basemap-indicator-dot" />
                  )}
                </button>
              );
            })}

            <div className="basemap-slider-row">
              <div className="basemap-slider-labels">
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
                className="basemap-slider-input"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
