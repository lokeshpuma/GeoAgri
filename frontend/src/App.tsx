import React from 'react';
import { WorkflowProvider, useWorkflow } from './context/WorkflowContext';
import { PageHeader } from './components/PageHeader/PageHeader';
import { BottomWorkflowNav } from './components/BottomWorkflowNav/BottomWorkflowNav';
import { WorkspacePage } from './pages/WorkspacePage';
import { FieldAnalysisPage } from './pages/FieldAnalysisPage';
import { CropPredictionPage } from './pages/CropPredictionPage';
import { SummaryReportPage } from './pages/SummaryReportPage';

const WorkflowContainer: React.FC = () => {
  const { currentStep } = useWorkflow();

  const renderActiveStepPage = () => {
    switch (currentStep) {
      case 1:
        return <WorkspacePage />;
      case 2:
        return <FieldAnalysisPage />;
      case 3:
        return <CropPredictionPage />;
      case 4:
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

      <PageHeader />
      <main style={{ flex: 1, width: '100%', position: 'relative', zIndex: 1 }}>
        {renderActiveStepPage()}
      </main>
      <BottomWorkflowNav />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <WorkflowProvider>
      <WorkflowContainer />
    </WorkflowProvider>
  );
};

export default App;
