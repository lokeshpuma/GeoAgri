import React, { useState } from 'react';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delayMs?: number;
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  children,
  position = 'top',
  delayMs = 200,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [timer, setTimer] = useState<number | null>(null);

  const show = () => {
    const t = window.setTimeout(() => setIsVisible(true), delayMs);
    setTimer(t);
  };

  const hide = () => {
    if (timer) window.clearTimeout(timer);
    setIsVisible(false);
  };

  const getPositionStyles = (): React.CSSProperties => {
    switch (position) {
      case 'bottom':
        return {
          top: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'left':
        return {
          right: 'calc(100% + 8px)',
          top: '50%',
          transform: 'translateY(-50%)',
        };
      case 'right':
        return {
          left: 'calc(100% + 8px)',
          top: '50%',
          transform: 'translateY(-50%)',
        };
      case 'top':
      default:
        return {
          bottom: 'calc(100% + 8px)',
          left: '50%',
          transform: 'translateX(-50%)',
        };
    }
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {isVisible && (
        <div
          role="tooltip"
          className="animate-fade-rise"
          style={{
            position: 'absolute',
            zIndex: 'var(--z-toast)',
            padding: '6px 12px',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-ui)',
            fontWeight: 500,
            color: 'var(--ink-1)',
            background: 'var(--bg-1)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-xs)',
            boxShadow: 'var(--elev-2)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            ...getPositionStyles(),
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
};
