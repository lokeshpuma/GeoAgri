import React from 'react';
import { RefreshCw, Sun, Moon, Bot } from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';
import { GeoAgriLogo } from '../GeoAgriLogo/GeoAgriLogo';

const STEP_TITLES: Record<number, string> = {
  1: "Step 1/5 • Overview",
  2: "Step 2/5 • Boundary Studio",
  3: "Step 3/5 • Field Intelligence",
  4: "Step 4/5 • Crop Prediction",
  5: "Step 5/5 • Executive Report",
};

export const PageHeader: React.FC = () => {
  const { currentStep, loading, runAnalysis, report, theme, toggleTheme, goToStep, isChatOpen, setIsChatOpen } = useWorkflow();

  return (
    <header className="app-header">
      <div
        className="brand brand-link"
        onClick={() => goToStep(1)}
        title="Click to navigate to Workspace Overview"
      >
        <div className="brand-icon brand-icon-box">
          <GeoAgriLogo size={32} />
        </div>
        <div>
          <div className="brand-row">
            <h1 className="brand-title">GeoAgri AI</h1>
          </div>
          <span className="brand-subtitle">Global Geospatial Agricultural Intelligence</span>
        </div>
      </div>

      <div className="header-actions-row">
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
              <Sun size={15} className="text-gold" />
              <span className="theme-toggle-label">Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={15} className="text-info" />
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
          <Bot size={17} className="text-emerald" />
          <span>AI Advisor</span>
          <span className="copilot-pulse-dot" />
        </button>
      </div>
    </header>
  );
};
