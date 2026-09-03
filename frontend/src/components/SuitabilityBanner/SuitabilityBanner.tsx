import React from 'react';
import { Award, AlertCircle } from 'lucide-react';

interface SuitabilityBannerProps {
  grade: "High" | "Moderate" | "Low" | "Not Suitable";
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
      case "High": return { bg: "rgba(16, 185, 129, 0.15)", border: "rgba(16, 185, 129, 0.4)", text: "#34d399" };
      case "Moderate": return { bg: "rgba(245, 158, 11, 0.15)", border: "rgba(245, 158, 11, 0.4)", text: "#fbbf24" };
      case "Low": return { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)", text: "#f87171" };
      default: return { bg: "rgba(107, 114, 128, 0.15)", border: "rgba(107, 114, 128, 0.4)", text: "#9ca3af" };
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Award size={24} style={{ color: style.text }} />
          <div>
            <h4 style={{ fontSize: '0.85rem', color: '#9ca3af', textTransform: 'uppercase' }}>Land Suitability Assessment (Model A)</h4>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: style.text }}>
              {grade} Suitability ({Math.round(score * 100)}%)
            </div>
          </div>
        </div>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '12px' }}>
          Confidence: {Math.round(confidence * 100)}%
        </span>
      </div>

      {limitingFactors.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.85rem', color: '#d1d5db' }}>
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
