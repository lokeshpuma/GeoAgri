import React, { useEffect, useState } from 'react';

export interface StatNumberProps {
  value: number;
  decimals?: number;
  unit?: string;
  prefix?: string;
  durationMs?: number;
}

export const StatNumber: React.FC<StatNumberProps> = ({
  value,
  decimals = 2,
  unit,
  prefix,
  durationMs = 800,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(() => {
    // Check reduced motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return value;
    }
    return 0;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value);
      return;
    }

    if (value === 0) {
      setDisplayValue(0);
      return;
    }

    const start = performance.now();
    const startVal = displayValue;
    const targetVal = value;

    let frameId: number;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (targetVal - startVal) * eased;
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value, durationMs]);

  return (
    <span
      className="type-stat-number"
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: '4px',
        color: 'var(--ink-1)',
      }}
    >
      {prefix && <span style={{ fontSize: '0.65em', color: 'var(--ink-2)' }}>{prefix}</span>}
      <span>{displayValue.toFixed(decimals)}</span>
      {unit && (
        <span
          style={{
            fontSize: '0.55em',
            color: 'var(--ink-3)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
          }}
        >
          {unit}
        </span>
      )}
    </span>
  );
};
