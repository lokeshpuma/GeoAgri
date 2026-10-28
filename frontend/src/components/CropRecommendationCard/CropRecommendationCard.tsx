import React from 'react';
import { Leaf, Droplet, ShieldAlert, Award, AlertCircle } from 'lucide-react';
import { FullReportResponse } from '../../api/client';
import { formatCropCategory, formatLimitingFactor } from '../../utils/labels';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  const isTierA = crop.confidence_tier === 'A';

  // Companion logic
  const primaryIntercrop = crop.intercrop_options && crop.intercrop_options.length > 0
    ? crop.intercrop_options[0]
    : null;

  // Production calculation for Tier A
  const p50YieldHa = crop.expected_yield_t_ha?.p50;
  const totalProductionTonnes = crop.expected_production_t?.p50 ?? (p50YieldHa != null ? p50YieldHa * farmArea : null);
  const rawScore = crop.suitability_score ?? crop.score ?? (crop.recommendation_score > 1 ? crop.recommendation_score / 100 : crop.recommendation_score);
  const suitabilityPct = Math.min(100, Math.max(0, Math.round(rawScore * 100)));

  // Risk badge
  const riskScore = crop.climate_risk_score;
  const riskColorClass = riskScore != null
    ? (riskScore < 35 ? 'text-emerald-light' : riskScore < 60 ? 'text-gold' : 'text-danger')
    : 'text-ink-3';
  const riskLabel = riskScore != null
    ? (riskScore < 35 ? 'Low Risk' : riskScore < 60 ? 'Moderate Risk' : 'Elevated Risk')
    : 'Not assessed';

  const plantingMonthName = crop.best_planting_month && crop.best_planting_month >= 1 && crop.best_planting_month <= 12
    ? MONTH_NAMES[crop.best_planting_month - 1]
    : null;

  return (
    <div className={`crop-rec-card ${isTopTier ? 'top-tier' : ''} ${rankClass}`}>
      {/* Top Bar: Rank, Badges & Category */}
      <div className="crop-rec-top">
        <div className="crop-rec-top-badges">
          <span className={`rank-pill ${rankClass}`}>
            #{rank} RECOMMENDATION
          </span>

          {isTierA ? (
            <span
              className="tier-badge tier-a"
              title="ML-verified crop: Calibrated with regional agronomic training data and probabilistic quantile yield forecasts (P10–P90)."
            >
              <Award size={12} />
              ML-verified (Tier A)
            </span>
          ) : (
            <span
              className="tier-badge tier-b"
              title="Climate-envelope match: Validated against FAO EcoCrop global bioclimatic envelope (temperature, rainfall, soil pH). No empirical yield model."
            >
              <Leaf size={12} />
              Climate-envelope match (Tier B)
            </span>
          )}

          <span className="crop-category-tag">{formatCropCategory(crop.category)}</span>
        </div>

        <div className="suitability-score-pill">
          <span className="crop-rec-suit-label">Suitability</span>
          <strong className="crop-rec-suit-val">{suitabilityPct}%</strong>
        </div>
      </div>

      {/* Main Title & Scientific Name */}
      <div className="crop-rec-title-block">
        <h3 className="crop-main-name">{crop.crop_name}</h3>
        {crop.scientific_name && (
          <span className="crop-sci-name">{crop.scientific_name}</span>
        )}

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

        {/* Limiting Factor and Best Planting Month */}
        {crop.limiting_factor && (
          <div className="crop-limiting-tag">
            <AlertCircle size={13} className="text-warn flex-shrink-0" />
            <span>
              Limited by: <strong>{formatLimitingFactor(crop.limiting_factor)}</strong>
              {plantingMonthName ? ` • Best planting: ${plantingMonthName}` : ''}
            </span>
          </div>
        )}
      </div>

      {/* Key Metric Grid */}
      <div className="crop-rec-stats-grid">
        <div className="crop-stat-cell">
          <span className="crop-stat-label">Expected Yield</span>
          {isTierA && p50YieldHa != null ? (
            <>
              <div className="crop-stat-val">
                <strong>{p50YieldHa.toFixed(2)}</strong> <span className="stat-unit">t/ha</span>
              </div>
              <span className="crop-stat-sub">
                P10: {crop.expected_yield_t_ha?.p10.toFixed(2)} | P90: {crop.expected_yield_t_ha?.p90.toFixed(2)}
              </span>
            </>
          ) : (
            <>
              <div className="crop-stat-val text-ink-3">
                <span className="stat-unit">No yield data</span>
              </div>
              <span className="crop-stat-sub">
                {crop.yield_note || (crop.suitability_grade ? `Envelope: ${crop.suitability_grade}` : 'Envelope match')}
              </span>
            </>
          )}
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Total Production</span>
          {isTierA && totalProductionTonnes != null ? (
            <>
              <div className="crop-stat-val text-gold">
                <strong>{totalProductionTonnes.toFixed(1)}</strong> <span className="stat-unit">Tonnes</span>
              </div>
              <span className="crop-stat-sub">Across {farmArea.toFixed(2)} Ha field</span>
            </>
          ) : (
            <>
              <div className="crop-stat-val text-ink-3">
                <span className="stat-unit">No ML yield model</span>
              </div>
              <span className="crop-stat-sub">Tier B envelope match</span>
            </>
          )}
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Irrigation Need</span>
          <div className="flex-row-center gap-6 mt-1">
            <Droplet size={14} className="text-info" />
            <strong className="text-info text-capitalize text-sm">
              {crop.irrigation_mode}
            </strong>
          </div>
          <span className="crop-stat-sub">
            {crop.water_need_mm != null
              ? `${Math.round(crop.water_need_mm)} mm total`
              : (crop.score_rainfed != null && crop.score_irrigated != null
                  ? `Rainfed ${Math.round(crop.score_rainfed * 100)}% · Irrig ${Math.round(crop.score_irrigated * 100)}%`
                  : 'Precipitation matched')}
          </span>
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Climate Vulnerability</span>
          {riskScore != null ? (
            <>
              <div className="flex-row-center gap-6 mt-1">
                <ShieldAlert size={14} className={riskColorClass} />
                <strong className={`${riskColorClass} text-sm`}>{riskLabel}</strong>
              </div>
              <span className="crop-stat-sub">{riskScore.toFixed(0)}% risk index</span>
            </>
          ) : (
            <>
              <div className="flex-row-center gap-6 mt-1">
                <ShieldAlert size={14} className="text-ink-3" />
                <strong className="text-sm text-ink-3">Not assessed</strong>
              </div>
              <span className="crop-stat-sub">Envelope suitability</span>
            </>
          )}
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
