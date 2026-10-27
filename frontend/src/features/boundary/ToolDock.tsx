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
    <div className="tool-dock-container">
      <div className="glass-panel tool-dock-panel">
        <Tooltip content="Pan Map (Space / Esc)" position="right">
          <IconButton
            icon={<Hand size={18} />}
            aria-label="Pan map"
            isActive={activeTool === 'pan'}
            onClick={() => onSelectTool('pan')}
          />
        </Tooltip>

        <div className="tool-dock-divider" />

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

        <div className="tool-dock-divider" />

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
            className={hasBoundary ? 'text-danger' : undefined}
          />
        </Tooltip>

        <div className="tool-dock-divider" />

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
          <div className="shortcuts-popover-content">
            <h5 className="shortcuts-title">
              Keyboard Shortcuts
            </h5>
            <div className="shortcut-row">
              <span>Polygon</span>
              <kbd className="shortcut-key">D</kbd>
            </div>
            <div className="shortcut-row">
              <span>Rectangle</span>
              <kbd className="shortcut-key">R</kbd>
            </div>
            <div className="shortcut-row">
              <span>Circle (64-pt)</span>
              <kbd className="shortcut-key">C</kbd>
            </div>
            <div className="shortcut-row">
              <span>Freehand</span>
              <kbd className="shortcut-key">F</kbd>
            </div>
            <div className="shortcut-row">
              <span>Edit Corners & Midpoints</span>
              <kbd className="shortcut-key">E</kbd>
            </div>
            <div className="shortcut-row">
              <span>Drop Pin</span>
              <kbd className="shortcut-key">P</kbd>
            </div>
            <div className="shortcut-row">
              <span>Finish Polygon</span>
              <kbd className="shortcut-key">Enter</kbd>
            </div>
            <div className="shortcut-row">
              <span>Delete Selected Vertex</span>
              <kbd className="shortcut-key">Del / Backspace</kbd>
            </div>
            <div className="shortcut-row">
              <span>Pan / Cancel</span>
              <kbd className="shortcut-key">Esc</kbd>
            </div>
            <div className="shortcut-row">
              <span>Undo</span>
              <kbd className="shortcut-key">Ctrl+Z</kbd>
            </div>
            <div className="shortcut-row">
              <span>Redo</span>
              <kbd className="shortcut-key">Ctrl+Y / ⇧⌘Z</kbd>
            </div>
          </div>
        </Popover>
      </div>
    </div>
  );
};
