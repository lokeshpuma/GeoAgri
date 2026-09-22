import React from 'react';
import { Award, Leaf, Droplet, ShieldAlert, TrendingUp } from 'lucide-react';
import { FullReportResponse } from '../../api/client';

interface CropRecommendationCardProps {
  crop: FullReportResponse['recommended_crops'][0];
  rank: number;
  farmArea: number;
}

const RANK_BADGE_COLORS: Record<number, { bg: string; text: string; border: string; glow: string }> = {
  1: { bg: 'rgba(234, 179, 8, 0.2)', text: '#fbbf24', border: '#eab308', glow: 'rgba(234, 179, 8, 0.3)' },
  2: { bg: 'rgba(148, 163, 184, 0.2)', text: '#cbd5e1', border: '#94a3b8', glow: 'rgba(148, 163, 184, 0.3)' },
  3: { bg: 'rgba(217, 119, 6, 0.2)', text: '#f59e0b', border: '#d97706', glow: 'rgba(217, 119, 6, 0.3)' },
  4: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399', border: '#10b981', glow: 'rgba(16, 185, 129, 0.2)' },
  5: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', border: '#3b82f6', glow: 'rgba(59, 130, 246, 0.2)' },
};

export const CropRecommendationCard: React.FC<CropRecommendationCardProps> = ({
  crop,
  rank,
  farmArea,
}) => {
  const isTopTier = rank <= 3;
  const colors = RANK_BADGE_COLORS[rank] || RANK_BADGE_COLORS[4];

  // Companion logic
  const primaryIntercrop = crop.intercrop_options && crop.intercrop_options.length > 0
    ? crop.intercrop_options[0]
    : null;

  const companionName = primaryIntercrop ? primaryIntercrop.companion_crop_name : "Cowpea (Lobia)";
  const yieldBoostPct = primaryIntercrop
    ? (primaryIntercrop.yield_boost_pct * 100).toFixed(1)
    : "14.5";

  // Production calculation
  const p50YieldHa = crop.expected_yield_t_ha?.p50 || 2.5;
  const totalProductionTonnes = crop.expected_production_t?.p50 || (p50YieldHa * farmArea);
  const suitabilityPct = Math.min(100, Math.round(crop.recommendation_score * 100));

  // Risk badge
  const riskColor = crop.climate_risk_score < 35 ? '#34d399' : crop.climate_risk_score < 60 ? '#fbbf24' : '#f87171';
  const riskLabel = crop.climate_risk_score < 35 ? 'Low Risk' : crop.climate_risk_score < 60 ? 'Moderate Risk' : 'Elevated Risk';

  return (
    <div
      className={`crop-rec-card ${isTopTier ? 'top-tier' : ''}`}
      style={{
        borderColor: isTopTier ? colors.border : 'var(--bg-card-border)',
        boxShadow: isTopTier ? `0 8px 30px ${colors.glow}` : undefined,
      }}
    >
      {/* Top Bar: Rank & Category */}
      <div className="crop-rec-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className="rank-pill"
            style={{
              background: colors.bg,
              color: colors.text,
              border: `1px solid ${colors.border}`,
            }}
          >
            #{rank} RECOMMENDATION
          </span>
          <span className="crop-category-tag">{crop.category}</span>
        </div>

        <div className="suitability-score-pill">
          <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Suitability</span>
          <strong style={{ color: '#34d399', fontSize: '1rem' }}>{suitabilityPct}%</strong>
        </div>
      </div>

      {/* Main Title & Companion Crop */}
      <div className="crop-rec-title-block">
        <h3 className="crop-main-name">{crop.crop_name}</h3>
        <div className="companion-intercrop-banner">
          <Leaf size={15} style={{ color: '#10b981', flexShrink: 0 }} />
          <span>
            Companion: <strong className="companion-name-text" style={{ color: 'var(--text-main)' }}>+{companionName}</strong>
          </span>
          <span className="yield-boost-pill">+{yieldBoostPct}% Yield Boost</span>
        </div>
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
          <div className="crop-stat-val" style={{ color: '#fbbf24' }}>
            <strong>{totalProductionTonnes.toFixed(1)}</strong> <span className="stat-unit">Tonnes</span>
          </div>
          <span className="crop-stat-sub">Across {farmArea.toFixed(2)} Ha field</span>
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Irrigation Need</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <Droplet size={14} style={{ color: '#38bdf8' }} />
            <strong style={{ textTransform: 'capitalize', color: '#38bdf8', fontSize: '0.9rem' }}>
              {crop.irrigation_mode}
            </strong>
          </div>
          <span className="crop-stat-sub">{crop.water_need_mm} mm total</span>
        </div>

        <div className="crop-stat-cell">
          <span className="crop-stat-label">Climate Vulnerability</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <ShieldAlert size={14} style={{ color: riskColor }} />
            <strong style={{ color: riskColor, fontSize: '0.9rem' }}>{riskLabel}</strong>
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
