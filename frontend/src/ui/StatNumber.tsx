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
    <span className="ui-stat-number type-stat-number">
      {prefix && <span className="ui-stat-prefix">{prefix}</span>}
      <span>{displayValue.toFixed(decimals)}</span>
      {unit && <span className="ui-stat-unit">{unit}</span>}
    </span>
  );
};
