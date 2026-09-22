import React from 'react';
import { Award, AlertCircle } from 'lucide-react';

interface SuitabilityBannerProps {
  grade: "High" | "Moderate" | "Low" | "Not Suitable" | string;
  score: number;
  confidence: number;
  limitingFactors: string[];
}

export const SuitabilityBanner: React.FC<SuitabilityBannerProps> = ({
  grade,
  score,
  confidence,
  limitingFactors
}) => {
  const getGradeStyle = () => {
    switch (grade) {
      case "High": return { bg: "rgba(16, 185, 129, 0.12)", border: "rgba(16, 185, 129, 0.35)", text: "#10b981" };
      case "Moderate": return { bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.35)", text: "#f59e0b" };
      case "Low": return { bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.35)", text: "#ef4444" };
      default: return { bg: "rgba(107, 114, 128, 0.12)", border: "rgba(107, 114, 128, 0.35)", text: "#6b7280" };
    }
  };

  const style = getGradeStyle();

  return (
    <div
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: '16px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Award size={24} style={{ color: style.text, flexShrink: 0 }} />
          <div>
            <h4 style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0, fontWeight: 700, letterSpacing: '0.04em' }}>
              Land Suitability Assessment (Model A)
            </h4>
            <div style={{ fontSize: '1.35rem', fontWeight: 800, color: style.text }}>
              {grade} Suitability ({Math.round(score * 100)}%)
            </div>
          </div>
        </div>
        <span className="badge badge-high" style={{ fontSize: '0.8rem', padding: '6px 12px', fontWeight: 700 }}>
          Confidence: {Math.round(confidence * 100)}%
        </span>
      </div>

      {limitingFactors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
          <span style={{ fontWeight: 600, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle size={14} /> Key Limiting Factors:
          </span>
          <ul style={{ paddingLeft: '20px', margin: 0 }}>
            {limitingFactors.map((factor, idx) => (
              <li key={idx}>{factor}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
