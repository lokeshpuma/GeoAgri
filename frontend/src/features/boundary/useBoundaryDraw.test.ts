import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoundaryDraw } from './useBoundaryDraw';

describe('useBoundaryDraw hook tests (FR-B1..FR-B4)', () => {
  it('initializes with empty geometry and default polygon tool', () => {
    const onGeom = vi.fn();
    const onVal = vi.fn();

    const { result } = renderHook(() =>
      useBoundaryDraw({
        initialPolygon: null,
        initialPin: null,
        onGeometryChange: onGeom,
        onValidationChange: onVal,
      })
    );

    expect(result.current.activeTool).toBe('polygon');
    expect(result.current.vertices).toEqual([]);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('adds vertices, updates undo stack, and performs undo/redo', () => {
    const onGeom = vi.fn();
    const onVal = vi.fn();

    const { result } = renderHook(() =>
      useBoundaryDraw({
        initialPolygon: null,
        initialPin: null,
        onGeometryChange: onGeom,
        onValidationChange: onVal,
      })
    );

    act(() => {
      result.current.addVertex([75.75, 13.32]);
    });
    expect(result.current.vertices.length).toBe(1);
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.addVertex([75.76, 13.32]);
    });
    expect(result.current.vertices.length).toBe(2);

    act(() => {
      result.current.undo();
    });
    expect(result.current.vertices.length).toBe(1);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });
    expect(result.current.vertices.length).toBe(2);
  });

  it('enforces minimum 3 vertices when deleting', () => {
    const onGeom = vi.fn();
    const onVal = vi.fn();

    const initial: [number, number][] = [
      [75.75, 13.32],
      [75.76, 13.32],
      [75.76, 13.33],
    ];

    const { result } = renderHook(() =>
      useBoundaryDraw({
        initialPolygon: initial,
        initialPin: null,
        onGeometryChange: onGeom,
        onValidationChange: onVal,
      })
    );

    act(() => {
      result.current.deleteVertex(0);
    });
    // Should NOT delete because length is 3 (min 3 vertices enforced per FR-B2)
    expect(result.current.vertices.length).toBe(3);
  });
});
