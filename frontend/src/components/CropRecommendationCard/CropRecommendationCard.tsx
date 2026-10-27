import React from 'react';
import { Leaf, Droplet, ShieldAlert } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface CropRecommendationCardProps {
  crop: FullReportResponse['recommended_crops'][0];
  rank: number;
  farmArea: number;
}

export const CropRecommendationCard: React.FC<CropRecommendationCardProps> = ({
  crop,
  rank,
  farmArea,
}) => {
  const isTopTier = rank <= 3;
  const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-default';

  // Companion logic
  const primaryIntercrop = crop.intercrop_options && crop.intercrop_options.length > 0
    ? crop.intercrop_options[0]
    : null;

  // Production calculation
  const p50YieldHa = crop.expected_yield_t_ha?.p50 || 2.5;
  const totalProductionTonnes = crop.expected_production_t?.p50 || (p50YieldHa * farmArea);
  const suitabilityPct = Math.min(100, Math.round(crop.recommendation_score * 100));

  // Risk badge
  const riskColorClass = crop.climate_risk_score < 35 ? 'text-emerald-light' : crop.climate_risk_score < 60 ? 'text-gold' : 'text-danger';
  const riskLabel = crop.climate_risk_score < 35 ? 'Low Risk' : crop.climate_risk_score < 60 ? 'Moderate Risk' : 'Elevated Risk';

  return (
    <div className={`crop-rec-card ${isTopTier ? 'top-tier' : ''} ${rankClass}`}>
      {/* Top Bar: Rank & Category */}
      <div className="crop-rec-top">
        <div className="flex-row-center gap-8">
          <span className={`rank-pill ${rankClass}`}>
            #{rank} RECOMMENDATION
          </span>
          <span className="crop-category-tag">{crop.category}</span>
        </div>

        <div className="suitability-score-pill">
          <span className="crop-rec-suit-label">Suitability</span>
          <strong className="crop-rec-suit-val">{suitabilityPct}%</strong>
        </div>
      </div>

      {/* Main Title & Companion Crop */}
      <div className="crop-rec-title-block">
        <h3 className="crop-main-name">{crop.crop_name}</h3>
        {primaryIntercrop ? (
          <div className="companion-intercrop-banner">
            <Leaf size={15} className="text-emerald flex-shrink-0" />
            <span>
              Companion: <strong className="companion-name-text">+{primaryIntercrop.companion_crop_name}</strong>
            </span>
            <span className="yield-boost-pill">+{(primaryIntercrop.yield_boost_pct * 100).toFixed(1)}% Yield Boost</span>
          </div>
        ) : (
          <div className="companion-intercrop-banner sole">
            <Leaf size={15} className="text-ink-3 flex-shrink-0" />
            <span>
              Management: <strong className="companion-name-text">Sole Cropping</strong>
            </span>
          </div>
        )}
      </div>

      {/* Key Metric Grid */}
      <div className="crop-rec-stats-grid">
        <div className="crop-stat-cell">
          <span className="crop-stat-label">Expected Yield</span>
          <div className="crop-stat-val">
            <strong>{p50YieldHa.toFixed(2)}</strong> <span className="stat-unit">t/ha</span>
          </div>
          <span className="crop-stat-sub">
            P10: {crop.expected_yield_t_ha.p10} | P90: {crop.expected_yield_t_ha.p90}
          </span>
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Total Production</span>
          <div className="crop-stat-val text-gold">
            <strong>{totalProductionTonnes.toFixed(1)}</strong> <span className="stat-unit">Tonnes</span>
          </div>
          <span className="crop-stat-sub">Across {farmArea.toFixed(2)} Ha field</span>
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Irrigation Need</span>
          <div className="flex-row-center gap-6 mt-1">
            <Droplet size={14} className="text-info" />
            <strong className="text-info text-capitalize text-sm">
              {crop.irrigation_mode}
            </strong>
          </div>
          <span className="crop-stat-sub">{crop.water_need_mm} mm total</span>
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Climate Vulnerability</span>
          <div className="flex-row-center gap-6 mt-1">
            <ShieldAlert size={14} className={riskColorClass} />
            <strong className={`${riskColorClass} text-sm`}>{riskLabel}</strong>
          </div>
          <span className="crop-stat-sub">{crop.climate_risk_score.toFixed(0)}% risk index</span>
        </div>
      </div>

      {/* Rationale Excerpt */}
      {crop.rationale && (
        <p className="crop-rec-rationale">
          💡 {crop.rationale}
        </p>
      )}
    </div>
  );
};
