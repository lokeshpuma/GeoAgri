import React from "react";
import { Sprout, Leaf } from "lucide-react";
import { FullReportResponse } from "../../api/client";

interface CropSuitabilityRankingProps {
  crops: FullReportResponse['recommended_crops'];
  farmArea?: number;
}

export const CropSuitabilityRanking: React.FC<CropSuitabilityRankingProps> = ({ crops = [], farmArea = 5 }) => {
  if (!crops || crops.length === 0) {
    return null;
  }

  const top3 = crops.slice(0, 3);
  const rankLabels = ["RANK #1", "RANK #2", "RANK #3"];

  return (
    <div className="suit-ranking-wrap">
      {/* Header */}
      <div className="suit-ranking-header">
        <div className="suit-ranking-title-group">
          <Sprout size={20} className="suit-ranking-icon" />
          <div>
            <h2 className="suit-ranking-title">
              Top Companion Intercrop Pairings
            </h2>
            <p className="suit-ranking-subtitle">
              Optimized 75% Main Crop + 25% Companion Intercrop spatial land allocation
            </p>
          </div>
        </div>
        <span className="suit-ranking-badge">
          Top 3 Agronomic Synergies
        </span>
      </div>

      {/* 3 Cards Grid */}
      <div className="suit-ranking-grid">
        {top3.map((crop, idx) => {
          const mainYieldPerHa = crop.expected_yield_t_ha?.p50 || 2.5;
          const hasIntercrop = Boolean(crop.intercrop_options && crop.intercrop_options.length > 0);

          let intercropName = "";
          let yieldBoostPct = 0;
          let companionShareFactor = 0.0;

          if (hasIntercrop) {
            const opt = crop.intercrop_options[0];
            intercropName = opt.companion_crop_name;
            yieldBoostPct = Number((opt.yield_boost_pct * 100).toFixed(1));
            companionShareFactor = opt.companion_share_factor || 0.25;
          }

          const mainShare = hasIntercrop ? (1.0 - companionShareFactor) : 1.0;
          const mainArea = farmArea * mainShare;
          const intercropArea = farmArea * companionShareFactor;

          const mainTotalYield = Number((mainYieldPerHa * mainArea).toFixed(2));
          const intercropYieldPerHa = hasIntercrop ? Number((mainYieldPerHa * 0.58).toFixed(2)) : 0;
          const intercropTotalYield = hasIntercrop ? Number((intercropYieldPerHa * intercropArea).toFixed(2)) : 0;
          const combinedYield = Number((mainTotalYield + intercropTotalYield).toFixed(2));
          const matchPercent = Math.min(100, Math.round(crop.recommendation_score * 100));

          return (
            <div
              key={crop.crop_id || idx}
              className={`glass-card suit-ranking-card rank-${idx}`}
            >
              {/* Card Header */}
              <div className="suit-card-header">
                <div>
                  <span className={`suit-rank-pill rank-${idx}`}>
                    {rankLabels[idx]}
                  </span>
                  <h3 className="suit-card-name">
                    {crop.crop_name}
                  </h3>
                  <span className="suit-card-category">
                    {crop.category} • {crop.irrigation_mode}
                  </span>
                </div>

                <div className={`suit-boost-box ${hasIntercrop ? 'active' : ''}`}>
                  <div className="suit-boost-label">{hasIntercrop ? "Yield Boost" : "Strategy"}</div>
                  <div className={`suit-boost-val ${hasIntercrop ? 'active' : ''}`}>
                    {hasIntercrop ? `+${yieldBoostPct}%` : "Sole Crop"}
                  </div>
                </div>
              </div>

              {/* Companion Intercrop Tag */}
              <div className="suit-partner-box">
                <div className="suit-partner-left">
                  <Leaf size={14} className={`suit-partner-icon ${hasIntercrop ? '' : 'dim'}`} />
                  <span className="suit-partner-label">{hasIntercrop ? "Companion Partner:" : "Cropping System:"}</span>
                </div>
                <span className="suit-partner-name">
                  {hasIntercrop
                    ? intercropName
                    : crop.intercrop_data_available === false
                    ? "Companion data not yet available"
                    : "Sole Cropping (Monoculture)"}
                </span>
              </div>

              {/* Production Metrics */}
              <div className="suit-metrics-grid">
                <div>
                  <div className="suit-metric-label">
                    {hasIntercrop ? `Main Production (${Math.round(mainShare * 100)}%)` : "Total Primary Output"}
                  </div>
                  <div className="suit-metric-val">
                    {mainTotalYield} <span className="suit-metric-unit">tonnes</span>
                  </div>
                </div>
                <div>
                  <div className="suit-metric-label">
                    {hasIntercrop ? `Intercrop Extra (${Math.round(companionShareFactor * 100)}%)` : "Target Median Yield"}
                  </div>
                  <div className={`suit-metric-val ${hasIntercrop ? 'emerald' : 'info'}`}>
                    {hasIntercrop ? `+${intercropTotalYield} tonnes` : `${mainYieldPerHa.toFixed(2)} t/ha`}
                  </div>
                </div>
                <div className="suit-parcel-total-row">
                  <span className="suit-metric-label">Total Parcel Output:</span>
                  <span className="suit-parcel-total-val">
                    {combinedYield} tonnes
                  </span>
                </div>
              </div>

              {/* Suitability Match Progress Bar */}
              <div>
                <div className="suit-progress-row">
                  <span className="suit-progress-label">Suitability Match</span>
                  <span className="suit-progress-pct">{matchPercent}%</span>
                </div>
                <div className="suit-progress-track">
                  <div
                    className="suit-progress-bar"
                    style={{ width: `${matchPercent}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
