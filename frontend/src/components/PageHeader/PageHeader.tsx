import React from 'react';
import { RefreshCw, Sun, Moon, Bot } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';
import { GeoAgriLogo } from '../GeoAgriLogo/GeoAgriLogo';

const STEP_TITLES: Record<number, string> = {
  1: "Step 1/4 • GeoAgri AI Overview",
  2: "Step 2/4 • Location & Field Analysis",
  3: "Step 3/4 • Multi-Crop Prediction",
  4: "Step 4/4 • Detailed Summary & Report",
};

export const PageHeader: React.FC = () => {
  const { currentStep, loading, runAnalysis, report, theme, toggleTheme, goToStep, isChatOpen, setIsChatOpen } = useWorkflow();

  return (
    <header className="app-header">
      <div
        className="brand"
        onClick={() => goToStep(1)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
        title="Click to navigate to Workspace Overview"
      >
        <div className="brand-icon" style={{ background: 'transparent', padding: 0, overflow: 'hidden' }}>
          <GeoAgriLogo size={32} />
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

        {/* Re-run AI / Run Jobs Button */}
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

        {/* Explainable AI Agronomic Advisor Chatbot Button (placed next to Run Jobs) */}
        <button
          type="button"
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={`btn-chat-toggle ${isChatOpen ? 'active' : ''}`}
          title="Open Explainable AI Advisor (Learn what NDVI, SOC, P50, t/ha & Workflow mean)"
          aria-label="Toggle Explainable AI Advisor"
          id="ai-advisor-toggle-btn"
        >
          <Bot size={17} style={{ color: '#10b981' }} />
          <span>AI Advisor</span>
          <span className="copilot-pulse-dot" />
        </button>
      </div>
    </header>
  );
};
