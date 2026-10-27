import React from 'react';
import {
  Hand,
  Pentagon,
  Square,
  Circle,
  Pencil,
  Edit3,
  MapPin,
  Undo2,
  Redo2,
  Trash2,
  HelpCircle,
} from 'lucide-react';
import { DrawTool } from './boundaryTypes';
import { IconButton } from '../../ui/IconButton';
import { Tooltip } from '../../ui/Tooltip';
import { Popover } from '../../ui/Popover';

export interface ToolDockProps {
  activeTool: DrawTool;
  onSelectTool: (tool: DrawTool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  hasBoundary: boolean;
}

export const ToolDock: React.FC<ToolDockProps> = ({
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClear,
  hasBoundary,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: '80px',
        left: '20px',
        zIndex: 'var(--z-panel)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        pointerEvents: 'auto',
      }}
    >
      <div
        className="glass-panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '8px',
          background: 'var(--glass-strong)',
          borderRadius: 'var(--r-md)',
          boxShadow: 'var(--elev-2)',
        }}
      >
        <Tooltip content="Pan Map (Space / Esc)" position="right">
          <IconButton
            icon={<Hand size={18} />}
            aria-label="Pan map"
            isActive={activeTool === 'pan'}
            onClick={() => onSelectTool('pan')}
          />
        </Tooltip>

        <div style={{ height: '1px', background: 'var(--glass-border)', margin: '2px 0' }} />

        <Tooltip content="Draw Polygon (D)" position="right">
          <IconButton
            icon={<Pentagon size={18} />}
            aria-label="Draw polygon"
            isActive={activeTool === 'polygon'}
            onClick={() => onSelectTool('polygon')}
          />
        </Tooltip>

        <Tooltip content="Rectangle (R)" position="right">
          <IconButton
            icon={<Square size={18} />}
            aria-label="Draw rectangle"
            isActive={activeTool === 'rectangle'}
            onClick={() => onSelectTool('rectangle')}
          />
        </Tooltip>

        <Tooltip content="Circle (C)" position="right">
          <IconButton
            icon={<Circle size={18} />}
            aria-label="Draw circle"
            isActive={activeTool === 'circle'}
            onClick={() => onSelectTool('circle')}
          />
        </Tooltip>

        <Tooltip content="Freehand (F)" position="right">
          <IconButton
            icon={<Pencil size={18} />}
            aria-label="Draw freehand"
            isActive={activeTool === 'freehand'}
            onClick={() => onSelectTool('freehand')}
          />
        </Tooltip>

        <Tooltip content="Edit Corners / Midpoints (E)" position="right">
          <IconButton
            icon={<Edit3 size={18} />}
            aria-label="Edit corners and midpoints"
            isActive={activeTool === 'select'}
            disabled={!hasBoundary}
            onClick={() => onSelectTool('select')}
          />
        </Tooltip>

        <Tooltip content="Drop Pin (Point only) (P)" position="right">
          <IconButton
            icon={<MapPin size={18} />}
            aria-label="Drop pin"
            isActive={activeTool === 'pin'}
            onClick={() => onSelectTool('pin')}
          />
        </Tooltip>

        <div style={{ height: '1px', background: 'var(--glass-border)', margin: '2px 0' }} />

        <Tooltip content="Undo (Ctrl+Z)" position="right">
          <IconButton
            icon={<Undo2 size={18} />}
            aria-label="Undo"
            disabled={!canUndo}
            onClick={onUndo}
            variant="ghost"
          />
        </Tooltip>

        <Tooltip content="Redo (Shift+Ctrl+Z)" position="right">
          <IconButton
            icon={<Redo2 size={18} />}
            aria-label="Redo"
            disabled={!canRedo}
            onClick={onRedo}
            variant="ghost"
          />
        </Tooltip>

        <Tooltip content="Clear Boundary" position="right">
          <IconButton
            icon={<Trash2 size={18} />}
            aria-label="Clear boundary"
            disabled={!hasBoundary}
            onClick={onClear}
            variant="ghost"
            style={{ color: hasBoundary ? 'var(--danger)' : undefined }}
          />
        </Tooltip>

        <div style={{ height: '1px', background: 'var(--glass-border)', margin: '2px 0' }} />

        <Popover
          align="start"
          trigger={
            <IconButton
              icon={<HelpCircle size={18} />}
              aria-label="Keyboard shortcuts"
              variant="ghost"
            />
          }
        >
          <div style={{ width: '220px', fontFamily: 'var(--font-ui)' }}>
            <h5 style={{ margin: '0 0 10px 0', fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-1)' }}>
              Keyboard Shortcuts
            </h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Polygon</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>D</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Rectangle</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>R</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Circle (64-pt)</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>C</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Freehand</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>F</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Edit Corners & Midpoints</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>E</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Drop Pin</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>P</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Finish Polygon</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>Enter</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Delete Selected Vertex</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>Del / Backspace</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Pan / Cancel</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>Esc</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Undo</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>Ctrl+Z</kbd>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--ink-2)' }}>Redo</span>
                <kbd style={{ background: 'var(--bg-2)', padding: '1px 5px', borderRadius: '4px' }}>Ctrl+Y / ⇧⌘Z</kbd>
              </div>
            </div>
          </div>
        </Popover>
      </div>
    </div>
  );
};
