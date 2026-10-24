import React, { createContext, useContext, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'warn' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback(({ durationMs = 4000, ...rest }: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = { ...rest, id, durationMs };
    setToasts(prev => [...prev, newToast]);

    if (durationMs > 0) {
      setTimeout(() => {
        removeToast(id);
      }, durationMs);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 'var(--z-toast)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => {
          const getIcon = () => {
            switch (toast.type) {
              case 'success':
                return <CheckCircle size={18} style={{ color: 'var(--ok)', flexShrink: 0 }} />;
              case 'warn':
                return <AlertTriangle size={18} style={{ color: 'var(--warn)', flexShrink: 0 }} />;
              case 'error':
                return <AlertCircle size={18} style={{ color: 'var(--danger)', flexShrink: 0 }} />;
              case 'info':
              default:
                return <Info size={18} style={{ color: 'var(--info)', flexShrink: 0 }} />;
            }
          };

          return (
            <div
              key={toast.id}
              className="animate-fade-rise glass-panel"
              style={{
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '12px 16px',
                background: 'var(--bg-1)',
                border: '1px solid var(--glass-border)',
                borderRadius: 'var(--r-sm)',
                boxShadow: 'var(--elev-3)',
                color: 'var(--ink-1)',
                fontFamily: 'var(--font-ui)',
              }}
            >
              {getIcon()}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{toast.title}</div>
                {toast.message && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--ink-2)', marginTop: '2px' }}>
                    {toast.message}
                  </div>
                )}
              </div>
              <button
                aria-label="Dismiss toast"
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  color: 'var(--ink-3)',
                  display: 'flex',
                }}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
