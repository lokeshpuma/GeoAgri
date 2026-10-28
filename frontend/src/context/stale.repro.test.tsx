import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { WorkflowProvider, useWorkflow } from './WorkflowContext';

describe('Regression test for Confirm Boundary atomic navigation (PRD v3.2 §2 C1)', () => {
  it('confirmBoundary from step 2 lands on step 3 with confirmed:true, even when invoked from a handler created before the call', () => {
    let capturedConfirmBoundary: any;
    let capturedGoToStep: any;

    function TestComponent() {
      const { currentStep, formData, confirmBoundary, goToStep } = useWorkflow();
      capturedConfirmBoundary = confirmBoundary;
      capturedGoToStep = goToStep;

      return (
        <div>
          <div data-testid="current-step">{currentStep}</div>
          <div data-testid="confirmed">{String(formData.confirmed)}</div>
        </div>
      );
    }

    render(
      <WorkflowProvider>
        <TestComponent />
      </WorkflowProvider>
    );

    // Initial state: Step 1, not confirmed
    expect(screen.getByTestId('current-step').textContent).toBe('1');
    expect(screen.getByTestId('confirmed').textContent).toBe('undefined');

    // Move to Step 2
    act(() => {
      capturedGoToStep(2);
    });
    expect(screen.getByTestId('current-step').textContent).toBe('2');

    // Call confirmBoundary from step 2
    act(() => {
      capturedConfirmBoundary({
        polygonPts: [
          [75.7, 13.3],
          [75.8, 13.3],
          [75.8, 13.4],
          [75.7, 13.4],
          [75.7, 13.3],
        ],
        areaHa: 2.5,
        plotName: 'Test Field',
        boundarySource: 'drawn',
        areaSource: 'server',
      });
    });

    // Verify atomic transition: immediately lands on Step 3 with confirmed: true
    expect(screen.getByTestId('current-step').textContent).toBe('3');
    expect(screen.getByTestId('confirmed').textContent).toBe('true');
  });
});
