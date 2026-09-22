import React from 'react';
import { Sparkles, RefreshCw, Sun, Moon } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';

const STEP_TITLES: Record<number, string> = {
  1: "Step 1/4 • GeoAgri AI Overview",
  2: "Step 2/4 • Location & Field Analysis",
  3: "Step 3/4 • Multi-Crop Prediction",
  4: "Step 4/4 • Detailed Summary & Report",
};

export const PageHeader: React.FC = () => {
  const { currentStep, loading, runAnalysis, report, theme, toggleTheme } = useWorkflow();

  return (
    <header className="app-header">
      <div className="brand">
        <div className="brand-icon">
          <Sparkles style={{ color: '#ffffff' }} size={22} />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 className="brand-title">GeoAgri AI</h1>
          </div>
          <span className="brand-subtitle">Global Geospatial Agricultural Intelligence</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div className="header-step-pill">
          <span className="pulse-dot" />
          <span>{STEP_TITLES[currentStep]}</span>
        </div>

        {/* Dark / Light Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="btn-theme-toggle"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
          aria-label="Toggle theme mode"
          id="theme-toggle-btn"
        >
          {theme === 'dark' ? (
            <>
              <Sun size={15} style={{ color: '#f59e0b' }} />
              <span className="theme-toggle-label">Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={15} style={{ color: '#6366f1' }} />
              <span className="theme-toggle-label">Dark Mode</span>
            </>
          )}
        </button>

        {report && (
          <button
            type="button"
            onClick={() => runAnalysis()}
            disabled={loading}
            className="btn-secondary"
            title="Refresh AI models with current field settings"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            <span>{loading ? "Recomputing..." : "Re-run AI"}</span>
          </button>
        )}
      </div>
    </header>
  );
};
