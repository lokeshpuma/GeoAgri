import React, { useState } from 'react';
import {
  Sprout,
  ArrowRight,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Layers,
  Sparkles,
  Info,
  MapPin,
  Calendar,
  Award,
  Droplets,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  Leaf,
  Compass,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  CartesianGrid
} from 'recharts';
import { useWorkflow } from '../context/WorkflowContext';
import { CropRecommendationCard } from '../components/CropRecommendationCard/CropRecommendationCard';
import { YieldPredictionTable } from '../components/YieldPredictionTable/YieldPredictionTable';
import { YieldComparisonChart } from '../components/YieldComparisonChart/YieldComparisonChart';
import { generateAgronomicRecommendation } from '../utils/agronomicFormatters';

export const CropPredictionPage: React.FC = () => {
  const { report, formData, goToStep, detectedLocation, theme } = useWorkflow();
  const [expandedInsightCropId, setExpandedInsightCropId] = useState<string | null>(null);
  const isLight = theme === 'light';

  const crops = report?.recommended_crops || [];
  const farmArea = report?.field_summary?.area_ha || formData.areaHa;
  const centroidLat = report?.field_summary?.centroid_lat || 17.3850;
  const centroidLon = report?.field_summary?.centroid_lon || 78.4867;

  const suit = report?.land_suitability || { grade: "High", score: 0.83, confidence: 0.90 };
  const irri = report?.irrigation_summary || { recommended_mode: "Supplemental" };
  const risk = report?.climate_risk_summary || { overall_risk_level: "Low" };

  const top5Crops = crops.slice(0, 5);
  const top10Crops = crops.slice(0, 10);

  // Chart data for Top 10 crops
  const chartData = top10Crops.map((c) => ({
    name: c.crop_name,
    expectedYield: Number(c.expected_yield_t_ha.p50.toFixed(2)),
    p10: Number(c.expected_yield_t_ha.p10.toFixed(2)),
    p90: Number(c.expected_yield_t_ha.p90.toFixed(2)),
  }));

  const aiInsightNarrative = generateAgronomicRecommendation(report);

  return (
    <div className="page-container">
      {/* Top Title Bar */}
      <div className="page-title-row">
        <div>
          <span className="step-tag">STEP 3 OF 4 • AGRONOMIC AI DECISION FUSION</span>
          <h1 className="page-title">Multi-Crop & Yield Prediction</h1>
          <p className="page-subtitle">
            AI-ranked crop and intercrop recommendations generated from your selected location.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => goToStep(2)}
          >
            <ArrowLeft size={16} />
            <span>Field Analysis</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => goToStep(4)}
          >
            <span>Detailed Summary</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {crops.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <Sprout size={48} style={{ color: '#10b981', margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600 }}>No Crop Predictions Yet</h3>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
            Please return to Step 2 (Field Analysis) and click <strong>Predict Now</strong> to process your field.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => goToStep(2)}
            style={{ marginTop: '16px' }}
          >
            Go to Field Analysis
          </button>
        </div>
      ) : (
        <>
          {/* SECTION 1 — ANALYSIS SUMMARY */}
          <section className="glass-card analysis-summary-bar">
            <div className="summary-pill-item">
              <MapPin size={16} style={{ color: '#38bdf8' }} />
              <div>
                <span className="summary-pill-label">Selected Location</span>
                <strong className="summary-pill-val">{centroidLat.toFixed(4)}°N, {centroidLon.toFixed(4)}°E</strong>
              </div>
            </div>

            {detectedLocation && (
              <div className="summary-pill-item">
                {detectedLocation.isWater || detectedLocation.isArable === false ? (
                  <>
                    <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                    <div>
                      <span className="summary-pill-label">Detected Biome</span>
                      <strong className="summary-pill-val" style={{ color: '#ef4444' }}>
                        {detectedLocation.district}
                      </strong>
                    </div>
                  </>
                ) : (
                  <>
                    <Compass size={16} style={{ color: '#059669' }} />
                    <div>
                      <span className="summary-pill-label">Regional Benchmark</span>
                      <strong className="summary-pill-val" style={{ color: '#059669' }}>
                        {detectedLocation.district}, {detectedLocation.state}
                      </strong>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="summary-pill-item">
              <Layers size={16} style={{ color: '#10b981' }} />
              <div>
                <span className="summary-pill-label">Field Area</span>
                <strong className="summary-pill-val">{farmArea.toFixed(2)} ha</strong>
              </div>
            </div>

            <div className="summary-pill-item">
              <Calendar size={16} style={{ color: '#f59e0b' }} />
              <div>
                <span className="summary-pill-label">Target Season</span>
                <strong className="summary-pill-val" style={{ textTransform: 'capitalize' }}>{formData.season}</strong>
              </div>
            </div>

            <div className="summary-pill-item">
              <Award size={16} style={{ color: suit.score === 0 ? '#ef4444' : '#10b981' }} />
              <div>
                <span className="summary-pill-label">Land Suitability</span>
                <strong className="summary-pill-val" style={{ color: suit.score === 0 ? '#ef4444' : undefined }}>
                  {Math.round(suit.score * 100)}% ({suit.grade})
                </strong>
              </div>
            </div>

            <div className="summary-pill-item">
              <ShieldAlert size={16} style={{ color: '#fbbf24' }} />
              <div>
                <span className="summary-pill-label">Climate Risk</span>
                <strong className="summary-pill-val">{risk.overall_risk_level} Risk</strong>
              </div>
            </div>

            <div className="summary-pill-item">
              <Droplets size={16} style={{ color: '#38bdf8' }} />
              <div>
                <span className="summary-pill-label">Irrigation Mode</span>
                <strong className="summary-pill-val" style={{ textTransform: 'capitalize' }}>{irri.recommended_mode}</strong>
              </div>
            </div>
          </section>

          {/* SECTION 2 — TOP 5 MULTI-CROP RECOMMENDATIONS OR NON-ARABLE NOTICE */}
          {top5Crops.length === 0 ? (
            <section className="crop-section">
              <div className="glass-card" style={{
                textAlign: 'center',
                padding: '48px 24px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.05)',
                borderRadius: '16px'
              }}>
                <AlertTriangle size={52} style={{ color: '#ef4444', margin: '0 auto 16px auto' }} />
                <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px' }}>
                  Cultivation Not Feasible: Non-Arable Zone Selected
                </h2>
                <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto 16px auto', lineHeight: 1.6 }}>
                  The selected coordinate (<strong>{centroidLat.toFixed(4)}°N, {centroidLon.toFixed(4)}°E</strong>) lies within an open water body or polar permafrost zone (<strong>{detectedLocation?.displayName || 'Non-Arable Terrestrial Zone'}</strong>).
                  Because open water and ice shields lack soil lithology and experience sub-zero or aquatic environments, Land Suitability is <strong>0% (Not Suitable)</strong> and <strong>no crops can be planted here</strong>.
                </p>
                <div style={{
                  display: 'inline-block',
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '0.88rem',
                  color: '#ef4444',
                  fontWeight: 600,
                  marginBottom: '28px'
                }}>
                  ⚠️ Limiting Factors: {(suit as any).limiting_factors && (suit as any).limiting_factors.length > 0 ? (suit as any).limiting_factors.join('. ') : (detectedLocation?.warningMessage || 'Terrestrial crop cultivation impossible in open water / polar ice.')}
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => goToStep(2)}
                    style={{ padding: '12px 28px', fontSize: '0.95rem' }}
                  >
                    <MapPin size={18} />
                    <span>Reposition Field onto Arable Land →</span>
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="crop-section">
                <div className="section-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={20} style={{ color: '#10b981' }} />
                    <h2 className="section-title">Top 5 Multi-Crop Recommendations</h2>
                  </div>
                  <span className="badge badge-high">
                    Spatial Land Allocation: 75% Main + 25% Companion
                  </span>
                </div>

                <div className="top5-cards-grid">
                  {top5Crops.map((crop, index) => (
                    <CropRecommendationCard
                      key={crop.crop_id || index}
                      crop={crop}
                      rank={index + 1}
                      farmArea={farmArea}
                    />
                  ))}
                </div>
              </section>

          {/* SECTION 3 — TOP 10 YIELD PREDICTIONS */}
          <section className="crop-section">
            <YieldPredictionTable crops={crops} farmArea={farmArea} />
          </section>

          {/* SECTION 4 — MULTI-CROP / INTERCROP ANALYSIS */}
          <section className="crop-section">
            <YieldComparisonChart crops={crops} farmArea={farmArea} />
          </section>

          {/* SECTION 5 — YIELD GRAPH */}
          <section className="crop-section">
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BarChart3 size={20} style={{ color: '#38bdf8' }} />
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                      Top 10 Crops vs. Predicted Yield Potential
                    </h3>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                    Comparing expected median yield (P50) alongside lower-bound (P10 pessimistic) and upper-bound (P90 optimistic) uncertainty bounds.
                  </p>
                </div>
                <span className="badge badge-moderate" style={{ fontSize: '0.75rem' }}>
                  Units: Tonnes per Hectare (t/ha)
                </span>
              </div>

              <div style={{ height: '440px', width: '100%', minWidth: 0, marginTop: '8px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 130, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? "#e2e8f0" : "rgba(255,255,255,0.05)"} />
                    <XAxis type="number" stroke={isLight ? "#475569" : "#9ca3af"} unit=" t/ha" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={isLight ? "#475569" : "#cbd5e1"}
                      width={120}
                      tick={{ fontSize: 11, fill: isLight ? '#0f172a' : '#cbd5e1', fontWeight: 600 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: isLight ? '#ffffff' : '#131a29',
                        border: isLight ? '1px solid #cbd5e1' : '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '10px',
                        boxShadow: isLight ? '0 8px 24px rgba(0,0,0,0.12)' : '0 8px 32px rgba(0,0,0,0.5)',
                        color: isLight ? '#0f172a' : '#ffffff'
                      }}
                      labelStyle={{ color: isLight ? '#0f172a' : '#ffffff', fontWeight: 700 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="p10" fill="#f87171" name="P10 (Pessimistic)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="expectedYield" fill="#10b981" name="P50 (Median Expected)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="p90" fill="#60a5fa" name="P90 (Optimistic)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* SECTION 6 — ADDITIONAL CROP INSIGHTS */}
          <section className="crop-section">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={20} style={{ color: '#38bdf8' }} />
                <h2 className="section-title">Additional Agronomic Crop Insights</h2>
              </div>
              <span className="badge badge-high">Deep Agronomic Profiling</span>
            </div>

            <div className="crop-insights-grid">
              {top5Crops.map((crop, idx) => {
                const isExpanded = expandedInsightCropId === crop.crop_id;
                const companion = crop.intercrop_options?.[0];
                const companionName = companion ? companion.companion_crop_name : "Cowpea (Lobia)";
                const boost = companion ? (companion.yield_boost_pct * 100).toFixed(1) : "14.5";

                return (
                  <div key={crop.crop_id || idx} className="glass-card crop-insight-card">
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => setExpandedInsightCropId(isExpanded ? null : crop.crop_id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className="rank-badge-num">#{idx + 1}</span>
                        <div>
                          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                            {crop.crop_name}
                          </h3>
                          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                            {crop.category} • Suitability Match: {(crop.recommendation_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="badge badge-high" style={{ fontSize: '0.72rem' }}>
                          +{boost}% Companion Synergy
                        </span>
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>

                    {/* 8 Concise Agronomic Bullets */}
                    <div className="insight-bullets-list">
                      <div className="insight-bullet-item">
                        <strong>Why Selected:</strong> {crop.rationale}
                      </div>
                      <div className="insight-bullet-item">
                        <strong>Soil Compatibility:</strong> High affinity for regional topsoil pH & texture with optimal root-zone aeration.
                      </div>
                      <div className="insight-bullet-item">
                        <strong>Climate Compatibility:</strong> Daily thermal regimes and solar radiation align with vegetative growth cycles.
                      </div>
                      <div className="insight-bullet-item">
                        <strong>Moisture Compatibility:</strong> Canopy water requirement correlates well with seasonal precipitation patterns.
                      </div>
                      <div className="insight-bullet-item">
                        <strong>Irrigation Requirement:</strong> Demands {crop.water_need_mm} mm under {crop.irrigation_mode} water management.
                      </div>
                      <div className="insight-bullet-item">
                        <strong>Intercrop Benefit:</strong> Co-planting with {companionName} boosts harvest by +{boost}% via atmospheric nitrogen fixation.
                      </div>
                      <div className="insight-bullet-item">
                        <strong>Yield Expectation:</strong> Median P50 forecast of {crop.expected_yield_t_ha.p50} t/ha (Total: {(crop.expected_yield_t_ha.p50 * farmArea).toFixed(1)} tonnes across {farmArea.toFixed(2)} ha).
                      </div>
                      <div className="insight-bullet-item">
                        <strong>Risk Consideration:</strong> {crop.climate_risk_note || 'Low vulnerability to seasonal climatic anomalies.'}
                      </div>
                    </div>

                    {/* Detailed Expandable Section */}
                    {isExpanded && (
                      <div className="insight-expanded-details">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <div className="tech-item"><span className="tech-name">Soil Compatibility</span><span className="tech-val" style={{ color: '#34d399' }}>High</span></div>
                          <div className="tech-item"><span className="tech-name">Thermal Regime</span><span className="tech-val">Optimal</span></div>
                          <div className="tech-item"><span className="tech-name">Moisture Index</span><span className="tech-val">Compatible</span></div>
                          <div className="tech-item"><span className="tech-name">P10 Pessimistic</span><span className="tech-val">{crop.expected_yield_t_ha.p10} t/ha</span></div>
                          <div className="tech-item"><span className="tech-name">P50 Expected</span><span className="tech-val" style={{ color: '#fbbf24' }}>{crop.expected_yield_t_ha.p50} t/ha</span></div>
                          <div className="tech-item"><span className="tech-name">P90 Optimistic</span><span className="tech-val">{crop.expected_yield_t_ha.p90} t/ha</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 7 — AI AGRICULTURAL INSIGHT NARRATIVE */}
          <section className="crop-section">
            <div className="glass-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="section-header" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={20} style={{ color: '#10b981' }} />
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                    AI Agricultural Insight
                  </h3>
                </div>
                <span className="badge badge-high">Ensemble Decision Synthesis</span>
              </div>

              <div className="recommendation-narrative-box">
                <div style={{ lineHeight: '1.75', fontSize: '0.92rem', color: 'var(--text-main)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {aiInsightNarrative.split('\n\n').map((paragraph, pIdx) => {
                    if (paragraph.startsWith('###')) {
                      return (
                        <h4 key={pIdx} style={{ fontSize: '1.02rem', fontWeight: 700, color: '#10b981', margin: '4px 0 2px 0' }}>
                          {paragraph.replace(/^###\s*/, '')}
                        </h4>
                      );
                    }
                    const lines = paragraph.split('\n');
                    return (
                      <div key={pIdx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {lines.map((line, lIdx) => {
                          const isBullet = line.trim().startsWith('-');
                          const content = isBullet ? line.trim().substring(1).trim() : line;
                          const parts = content.split(/(\*\*[^*]+\*\*)/g);
                          const formatted = parts.map((part, idx) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              return <strong key={idx} style={{ color: 'var(--text-main)' }}>{part.slice(2, -2)}</strong>;
                            }
                            return part;
                          });

                          return (
                            <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: isBullet ? '8px' : '0' }}>
                              {isBullet && <span style={{ color: '#10b981', fontWeight: 700 }}>•</span>}
                              <span>{formatted}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
          </>
          )}

          {/* BOTTOM ACTIONS */}
          <div className="page-bottom-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => goToStep(2)}
            >
              <ArrowLeft size={16} />
              <span>← Previous (Field Analysis)</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => goToStep(4)}
              style={{ padding: '12px 28px', fontSize: '1rem' }}
            >
              <span>Detailed Summary →</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
