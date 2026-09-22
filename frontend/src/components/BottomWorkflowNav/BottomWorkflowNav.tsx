import React from 'react';
import { LayoutDashboard, MapPinned, Sprout, FileText, ChevronRight, Check, LucideIcon } from 'lucide-react';
import { useWorkflow, StepNumber } from '../../context/WorkflowContext';

interface StepMeta {
  step: StepNumber;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

const STEPS: StepMeta[] = [
  {
    step: 1,
    title: "Workspace",
    subtitle: "Overview",
    icon: LayoutDashboard,
  },
  {
    step: 2,
    title: "Field Analysis",
    subtitle: "Location & Satellite",
    icon: MapPinned,
  },
  {
    step: 3,
    title: "Crop Prediction",
    subtitle: "Multi-Crop & Yield",
    icon: Sprout,
  },
  {
    step: 4,
    title: "Summary & Report",
    subtitle: "Full Intelligence",
    icon: FileText,
  },
];

export const BottomWorkflowNav: React.FC = () => {
  const { currentStep, analysisStatus, isStepAccessible, goToStep } = useWorkflow();

  return (
    <div className="bottom-workflow-container">
      <nav className="bottom-workflow-nav" aria-label="Workflow Navigation">
        {STEPS.map((item, index) => {
          const isActive = currentStep === item.step;
          const isAccessible = isStepAccessible(item.step);
          const isCompleted = (item.step === 1 && currentStep > 1) ||
            (item.step === 2 && analysisStatus.predictionComplete && currentStep > 2) ||
            (item.step === 3 && analysisStatus.cropAnalysisComplete && currentStep > 3) ||
            (item.step < currentStep);
          const Icon = item.icon;

          return (
            <React.Fragment key={item.step}>
              <button
                type="button"
                className={`nav-step-button ${isActive ? 'active' : ''} ${isCompleted && !isActive ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''}`}
                onClick={() => {
                  if (isAccessible) {
                    goToStep(item.step);
                  }
                }}
                disabled={!isAccessible}
                title={!isAccessible ? "Complete preceding analysis steps to unlock" : `Go to Step ${item.step}: ${item.title}`}
              >
                <div className="step-icon-wrapper">
                  {isCompleted && !isActive ? (
                    <Check size={18} className="step-check-icon" />
                  ) : (
                    <Icon size={18} />
                  )}
                  <span className="step-badge">{item.step}</span>
                </div>

                <div className="step-text-content">
                  <div className="step-title-row">
                    <span className="step-number-label">Step {item.step}</span>
                    <span className="step-name">{item.title}</span>
                  </div>
                  <span className="step-subtitle-desc">{item.subtitle}</span>
                </div>

                {isActive && <div className="step-active-glow-bar" />}
              </button>

              {index < STEPS.length - 1 && (
                <div className={`nav-separator ${currentStep > item.step ? 'completed-sep' : ''}`}>
                  <ChevronRight size={16} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </div>
  );
};
