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
  const gradeClass = grade.toLowerCase().includes("high")
    ? "high"
    : grade.toLowerCase().includes("moderate")
    ? "moderate"
    : "low";

  const colorClass = gradeClass === "high"
    ? "text-emerald"
    : gradeClass === "moderate"
    ? "text-gold"
    : "text-danger";

  return (
    <div className={`suit-banner-container ${gradeClass}`}>
      <div className="flex-between flex-wrap gap-8 w-full">
        <div className="suit-banner-left">
          <Award size={24} className={`${colorClass} flex-shrink-0`} />
          <div>
            <h4 className="text-xs text-ink-2 uppercase m-0 font-bold tracking-wider">
              Land Suitability Assessment (Model A)
            </h4>
            <div className={`suit-banner-grade ${colorClass}`}>
              {grade} Suitability ({Math.round(score * 100)}%)
            </div>
          </div>
        </div>
        <span className="badge badge-high text-xs px-3 py-1 font-bold">
          Confidence: {Math.round(confidence * 100)}%
        </span>
      </div>

      {limitingFactors.length > 0 && (
        <div className="flex-col gap-4 text-sm text-ink-1 mt-2">
          <span className="text-gold font-semibold flex-row-center gap-4">
            <AlertCircle size={14} /> Key Limiting Factors:
          </span>
          <ul className="m-0 pl-5 text-ink-2">
            {limitingFactors.map((f, i) => (
              <li key={i}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
