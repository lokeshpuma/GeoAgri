import React, { Suspense, lazy } from 'react';
import { WorkflowProvider, useWorkflow } from './context/WorkflowContext';
import { PageHeader } from './components/PageHeader/PageHeader';
import { BottomWorkflowNav } from './components/BottomWorkflowNav/BottomWorkflowNav';
import { ToastProvider } from './ui/Toast';

// Code-split pages and chatbot per PRD v3.1 §5.3 item 7 (AC-12, AC-13)
const WorkspacePage = lazy(() => import('./pages/WorkspacePage').then(m => ({ default: m.WorkspacePage })));
const BoundaryStudioPage = lazy(() => import('./features/boundary/BoundaryStudioPage').then(m => ({ default: m.BoundaryStudioPage })));
const FieldAnalysisPage = lazy(() => import('./pages/FieldAnalysisPage').then(m => ({ default: m.FieldAnalysisPage })));
const CropPredictionPage = lazy(() => import('./pages/CropPredictionPage').then(m => ({ default: m.CropPredictionPage })));
const SummaryReportPage = lazy(() => import('./pages/SummaryReportPage').then(m => ({ default: m.SummaryReportPage })));
const AgriChatBot = lazy(() => import('./components/AgriChatBot/AgriChatBot').then(m => ({ default: m.AgriChatBot })));

const PageFallback: React.FC = () => (
  <div className="page-loading-container" aria-label="Loading page">
    <div className="page-loading-orb" />
  </div>
);

const WorkflowContainer: React.FC = () => {
  const { currentStep, report } = useWorkflow();
  const isDemoMode = report?.data_mode === 'demo_synthetic';

  React.useEffect(() => {
    const updateDimensions = () => {
      const headerEl = document.querySelector('.app-header');
      const stepBarEl = document.querySelector('.bottom-workflow-container');

      if (headerEl) {
        const headerH = headerEl.getBoundingClientRect().height;
        if (headerH > 0) {
          document.documentElement.style.setProperty('--app-header-h', `${Math.round(headerH)}px`);
        }
      }
      if (stepBarEl) {
        const stepBarH = stepBarEl.getBoundingClientRect().height;
        if (stepBarH > 0) {
          document.documentElement.style.setProperty('--step-bar-h', `${Math.round(stepBarH)}px`);
        }
      }
    };

    updateDimensions();

    const observer = new ResizeObserver(() => {
      updateDimensions();
    });

    const headerEl = document.querySelector('.app-header');
    const stepBarEl = document.querySelector('.bottom-workflow-container');
    if (headerEl) observer.observe(headerEl);
    if (stepBarEl) observer.observe(stepBarEl);
    window.addEventListener('resize', updateDimensions);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const renderActiveStepPage = () => {
    switch (currentStep) {
      case 1:
        return <WorkspacePage />;
      case 2:
        return <BoundaryStudioPage />;
      case 3:
        return <FieldAnalysisPage />;
      case 4:
        return <CropPredictionPage />;
      case 5:
        return <SummaryReportPage />;
      default:
        return <WorkspacePage />;
    }
  };

  return (
    <div className="app-layout">
      {/* Dynamic Ambient Background for Executive Enterprise Theme */}
      <div className="dynamic-ambient-background" aria-hidden="true">
        <div className="ambient-orb ambient-orb-1" />
        <div className="ambient-orb ambient-orb-2" />
        <div className="ambient-orb ambient-orb-3" />
        <div className="ambient-grid-overlay" />
      </div>

      {isDemoMode && (
        <div
          className="demo-mode-ribbon"
          role="alert"
          style={{
            background: '#f59e0b',
            color: '#78350f',
            fontWeight: 700,
            textAlign: 'center',
            padding: '8px 16px',
            fontSize: '0.85rem',
            letterSpacing: '0.02em',
            zIndex: 9999,
            position: 'relative',
            borderBottom: '1px solid #d97706'
          }}
        >
          DEMO MODE: Synthetic satellite and soil data. Not for real agronomic use.
        </div>
      )}

      <PageHeader />
      <main className="main-content">
        <Suspense fallback={<PageFallback />}>
          {renderActiveStepPage()}
        </Suspense>
      </main>
      <BottomWorkflowNav />

      {/* Explainable AI Agronomic Advisor Chatbot Tab / Drawer */}
      <Suspense fallback={null}>
        <AgriChatBot />
      </Suspense>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <WorkflowProvider>
        <WorkflowContainer />
      </WorkflowProvider>
    </ToastProvider>
  );
};

export default App;
