import React, { useState, useRef, useEffect } from 'react';

export interface PopoverProps {
  trigger: React.ReactElement;
  children: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  align = 'center',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const getAlignmentStyle = (): React.CSSProperties => {
    switch (align) {
      case 'start':
        return { left: 0 };
      case 'end':
        return { right: 0 };
      case 'center':
      default:
        return { left: '50%', transform: 'translateX(-50%)' };
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {React.cloneElement(trigger, {
        onClick: (e: React.MouseEvent) => {
          if (trigger.props.onClick) trigger.props.onClick(e);
          setIsOpen(!isOpen);
        },
      })}
      {isOpen && (
        <div
          className="animate-fade-rise glass-panel"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            zIndex: 'var(--z-modal)',
            background: 'var(--bg-1)',
            border: '1px solid var(--glass-border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--elev-3)',
            padding: '16px',
            minWidth: '220px',
            ...getAlignmentStyle(),
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
};
