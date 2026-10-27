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
      <div aria-live="polite" className="ui-toast-portal">
        {toasts.map(toast => {
          const getIcon = () => {
            switch (toast.type) {
              case 'success':
                return <CheckCircle size={18} className="toast-icon-ok" />;
              case 'warn':
                return <AlertTriangle size={18} className="toast-icon-warn" />;
              case 'error':
                return <AlertCircle size={18} className="toast-icon-danger" />;
              case 'info':
              default:
                return <Info size={18} className="toast-icon-info" />;
            }
          };

          return (
            <div
              key={toast.id}
              className={`ui-toast-item animate-fade-rise glass-panel ui-toast-${toast.type === 'success' ? 'emerald' : toast.type}`}
            >
              {getIcon()}
              <div className="ui-toast-content">
                <div className="ui-toast-title">{toast.title}</div>
                {toast.message && (
                  <div className="ui-toast-msg">{toast.message}</div>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss toast"
                onClick={() => removeToast(toast.id)}
                className="ui-toast-close"
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
