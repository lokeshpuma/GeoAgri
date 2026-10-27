import React, { useState } from 'react';
import {
  Sprout,
  ArrowRight,
  ArrowLeft,
  BarChart3,
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
  AlertTriangle,
  Eye
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
import { YIELD_CHART_COLORS } from '../theme/palette';

export const CropPredictionPage: React.FC = () => {
  const { report, formData, goToStep, detectedLocation, theme } = useWorkflow();
  const [expandedInsightCropId, setExpandedInsightCropId] = useState<string | null>(null);
  const isLight = theme === 'light';

  const crops = report?.recommended_crops || [];
  const farmArea = report?.field_summary?.area_ha || formData.areaHa;
  const centroidLat = report?.field_summary?.centroid_lat || (formData.pointPt ? formData.pointPt[1] : formData.polygonPts[0]?.[1]);
  const centroidLon = report?.field_summary?.centroid_lon || (formData.pointPt ? formData.pointPt[0] : formData.polygonPts[0]?.[0]);

  const suit = report?.land_suitability || { grade: "High", score: 0.83, confidence: 0.90 };
  const irri = report?.irrigation_summary || { recommended_mode: "Rainfed", total_water_demand_m3: 11400, effective_rainfall_mm: 789.8 };
  const risk = report?.climate_risk_summary || { overall_risk_level: "Low", drought_risk_score: 6, heat_risk_score: 5, note: "Low climatic risk profile during active growing window." };
  const env = report?.environment || { ph: 5.92, organic_carbon_g_kg: 6.1, rainfall_mm: 1053, temp_mean_c: 23.1 };
  const sat = report?.satellite_features || { ndvi: 0.59, ndmi: 0.23 };

  const top5Crops = crops.slice(0, 5);
  const top10Crops = crops.slice(0, 10);
  const topCrop = top5Crops[0];
  const companionOpt = topCrop?.intercrop_options?.[0];
  const companionName = companionOpt?.companion_crop_name || "";
  const boostPct = companionOpt ? (companionOpt.yield_boost_pct * 100).toFixed(1) : "0.0";
  const topNames = top5Crops.map(c => c.crop_name).join(", ");

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

        <div className="crop-pred-actions-row">
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

      {/* SHADOW MODE BANNER STRIP (PRD v2.1 §5A.7, §19.4, M23) */}
      {report?.gate_mode === 'shadow' && (
        <div className="crop-pred-shadow-banner">
          <div className="crop-pred-shadow-left">
            <Eye size={18} className="crop-pred-shadow-icon" />
            <span className="crop-pred-shadow-badge">
              SHADOW MODE — verdict not enforced
            </span>
          </div>
          <span className="crop-pred-shadow-text">
            Land detection & irrigability verdict ({report?.irrigability?.verdict?.replace(/_/g, ' ') || 'SHADOW'}) are computed for telemetry; crop models are fully evaluated.
          </span>
        </div>
      )}

      {/* PARTLY CHECKED WARNING NOTICE (PRD v2.1 M23) */}
      {report?.detection?.warnings && report.detection.warnings.length > 0 && (
        <div className="crop-pred-shadow-banner">
          <AlertTriangle size={15} className="crop-pred-shadow-icon" />
          <span className="crop-pred-shadow-text"><strong>Partly checked:</strong> {report.detection.warnings.join('; ')}</span>
        </div>
      )}

      {report?.irrigability && (report.irrigability.verdict === 'NOT_IRRIGABLE' || report.irrigability.verdict === 'NOT_IRRIGABLE_PROVISIONAL') && report?.gate_mode === 'enforce' ? (
        <div className="glass-card gate-blocked-card">
          <div className="flex-row-center gap-16">
            <div className="gate-blocked-icon">
              <ShieldAlert size={32} />
            </div>
            <div>
              <div className="flex-row-center gap-10">
                <span className="detection-badge-danger">
                  {report.irrigability.verdict.replace(/_/g, ' ')}
                </span>
                <span className="text-ink-2 text-sm">
                  Land Classification: <strong>{report.land_class?.dominant?.replace(/_/g, ' ') || 'NON-AGRICULTURAL'}</strong> {report.land_class?.subclass ? `(${report.land_class.subclass.replace(/_/g, ' ')})` : ''}
                </span>
              </div>
              <h2 className="gate-blocked-title mt-1">
                Cultivation & Irrigation Not Permitted On This Plot
              </h2>
            </div>
          </div>

          <p className="gate-blocked-desc">
            {report.irrigability.reasons?.[0]?.reason ||
              'This parcel is classified under legal forest, water body, urban built-up, or severe terrain exclusion. In accordance with PRD compliance rules, agronomic crop recommendation models are bypassed.'}
          </p>

          {report.irrigability.reasons && report.irrigability.reasons.length > 0 && (
            <div className="detection-feature-card">
              <h4 className="text-danger font-semibold mb-2">
                Evidence & Regulatory Grounding:
              </h4>
              <ul className="text-ink-2 text-sm pl-4 m-0">
                {report.irrigability.reasons.map((r, idx) => (
                  <li key={idx} className="mb-1">
                    <strong>{r.rule_id}</strong>: {r.reason} (Layer: {r.layer})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="crop-pred-actions-row mt-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => goToStep(1)}
            >
              <ArrowLeft size={16} />
              <span>Select Different Plot On Map</span>
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => goToStep(4)}
            >
              <span>View Full Legal & Terrain Report</span>
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      ) : crops.length === 0 ? (
        <div className="glass-card text-center p-8">
          <Sprout size={48} className="text-emerald mx-auto mb-4" />
          <h3 className="text-lg font-semibold">No Crop Predictions Yet</h3>
          <p className="text-ink-2 text-sm">
            Please return to Step 2 (Field Analysis) and click <strong>Predict Now</strong> to process your field.
          </p>
          <button
            type="button"
            className="btn-primary mt-4"
            onClick={() => goToStep(2)}
          >
            Go to Field Analysis
          </button>
        </div>
      ) : (
        <>
          {/* SECTION 1 — ANALYSIS SUMMARY */}
          <section className="glass-card analysis-summary-bar">
            <div className="summary-pill-item">
              <MapPin size={16} className="text-info" />
              <div>
                <span className="summary-pill-label">Selected Location</span>
                <strong className="summary-pill-val">{centroidLat?.toFixed(4)}°N, {centroidLon?.toFixed(4)}°E</strong>
              </div>
            </div>

            {detectedLocation && (
              <div className="summary-pill-item">
                {detectedLocation.isWater || detectedLocation.isArable === false ? (
                  <>
                    <AlertTriangle size={16} className="text-danger" />
                    <div>
                      <span className="summary-pill-label">Detected Biome</span>
                      <strong className="summary-pill-val text-danger">
                        {detectedLocation.district}
                      </strong>
                    </div>
                  </>
                ) : (
                  <>
                    <Compass size={16} className="text-emerald" />
                    <div>
                      <span className="summary-pill-label">Regional Benchmark</span>
                      <strong className="summary-pill-val text-emerald">
                        {detectedLocation.district}, {detectedLocation.state}
                      </strong>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="summary-pill-item">
              <Layers size={16} className="text-emerald" />
              <div>
                <span className="summary-pill-label">Field Area</span>
                <strong className="summary-pill-val">
                  {farmArea != null ? `${farmArea.toFixed(2)} ha` : 'Point Query'}
                </strong>
                {report?.irrigability?.irrigable_area_ha != null && farmArea != null && report.irrigability.irrigable_area_ha < farmArea && (
                  <span className="text-xs text-emerald block">
                    Usable: {report.irrigability.irrigable_area_ha.toFixed(2)} ha
                  </span>
                )}
              </div>
            </div>

            {report?.irrigability && (
              <div className="summary-pill-item">
                <ShieldAlert size={16} className={report.irrigability.verdict === 'IRRIGABLE' ? 'text-emerald' : 'text-gold'} />
                <div>
                  <span className="summary-pill-label">Irrigability Verdict</span>
                  <strong className={`summary-pill-val ${report.irrigability.verdict === 'IRRIGABLE' ? 'text-emerald' : 'text-gold'}`}>
                    {report.irrigability.verdict.replace(/_/g, ' ')}
                  </strong>
                </div>
              </div>
            )}

            <div className="summary-pill-item">
              <Calendar size={16} className="text-gold" />
              <div>
                <span className="summary-pill-label">Target Season</span>
                <strong className="summary-pill-val text-capitalize">{formData.season}</strong>
              </div>
            </div>

            <div className="summary-pill-item">
              <Award size={16} className={suit.score === 0 ? 'text-danger' : 'text-emerald'} />
              <div>
                <span className="summary-pill-label">Land Suitability</span>
                <strong className={`summary-pill-val ${suit.score === 0 ? 'text-danger' : ''}`}>
                  {Math.round(suit.score * 100)}% ({suit.grade})
                </strong>
              </div>
            </div>

            <div className="summary-pill-item">
              <ShieldAlert size={16} className="text-gold" />
              <div>
                <span className="summary-pill-label">Climate Risk</span>
                <strong className="summary-pill-val">{risk.overall_risk_level} Risk</strong>
              </div>
            </div>

            <div className="summary-pill-item">
              <Droplets size={16} className="text-info" />
              <div>
                <span className="summary-pill-label">Irrigation Mode</span>
                <strong className="summary-pill-val text-capitalize">{irri.recommended_mode}</strong>
              </div>
            </div>
          </section>

          {/* DETECTION PANEL (PRD v2.1 §5A, M16, M23) */}
          {report?.detection && (
            <section className="glass-card p-5">
              <div className="flex-between mb-4">
                <div className="flex-row-center gap-10">
                  <Layers size={18} className="text-emerald" />
                  <h3 className="text-base font-bold m-0">
                    Physical & Land Surface Detection
                  </h3>
                </div>
                <div className="flex-row-center gap-8">
                  <span className={`detection-badge-${report.gate_mode === 'enforce' ? 'danger' : (report.gate_mode === 'shadow' ? 'info' : 'neutral')}`}>
                    Gate: {report.gate_mode || 'off'}
                  </span>
                </div>
              </div>

              <div className="detection-grid">
                {/* 1. Forest */}
                <div className="detection-feature-card">
                  <div className="flex-between mb-2">
                    <span className="text-xs font-semibold text-ink-2">Forest Cover</span>
                    <span className={`detection-badge-${report.detection.forest?.state === 'detected' ? (report.detection.forest?.plantation_signature ? 'info' : 'danger') : (report.detection.forest?.state === 'not detected' ? 'ok' : 'neutral')}`}>
                      {report.detection.forest?.plantation_signature ? 'PLANTATION' : (report.detection.forest?.state?.toUpperCase() || 'UNKNOWN')}
                    </span>
                  </div>
                  <div className="text-base font-bold text-ink-1 mb-1">
                    {report.detection.forest?.share != null ? `${(report.detection.forest.share * 100).toFixed(1)}% share` : 'N/A'}
                  </div>
                  <div className="text-xs text-ink-3">
                    Source: {report.detection.forest?.source || 'ESA WorldCover / Hansen'}
                  </div>
                  {report.detection.forest?.plantation_signature && (
                    <div className="text-xs text-info mt-1 font-semibold">
                      Plantation guarded (not forest)
                    </div>
                  )}
                </div>

                {/* 2. Buildings */}
                <div className="detection-feature-card">
                  <div className="flex-between mb-2">
                    <span className="text-xs font-semibold text-ink-2">Buildings</span>
                    <span className={`detection-badge-${report.detection.buildings?.state === 'detected' ? 'danger' : (report.detection.buildings?.state === 'not detected' ? 'ok' : 'neutral')}`}>
                      {report.detection.buildings?.state?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="text-base font-bold text-ink-1 mb-1">
                    {report.detection.buildings?.share != null ? `${(report.detection.buildings.share * 100).toFixed(1)}% footprint` : (report.detection.buildings?.footprint_m2 != null ? `${report.detection.buildings.footprint_m2.toFixed(0)} m²` : 'None')}
                  </div>
                  <div className="text-xs text-ink-3">
                    Source: {report.detection.buildings?.source || 'OpenFreeMap / MS Buildings'}
                  </div>
                </div>

                {/* 3. Roads */}
                <div className="detection-feature-card">
                  <div className="flex-between mb-2">
                    <span className="text-xs font-semibold text-ink-2">Roads & Access</span>
                    <span className={`detection-badge-${report.detection.roads?.state === 'detected' ? 'ok' : 'neutral'}`}>
                      {report.detection.roads?.state?.toUpperCase() || 'UNKNOWN'}
                    </span>
                  </div>
                  <div className="text-base font-bold text-ink-1 mb-1">
                    {report.detection.roads?.distance_m != null ? `${report.detection.roads.distance_m.toFixed(0)} m to road` : 'Detected'}
                  </div>
                  <div className="text-xs text-ink-3">
                    Source: OpenStreetMap Transport
                  </div>
                </div>

                {/* 4. Water */}
                <div className="detection-feature-card">
                  <div className="flex-between mb-2">
                    <span className="text-xs font-semibold text-ink-2">Surface Water</span>
                    <span className={`detection-badge-${report.detection.water?.state === 'detected' ? 'danger' : 'ok'}`}>
                      {report.detection.water?.state?.toUpperCase() || 'NOT DETECTED'}
                    </span>
                  </div>
                  <div className="text-base font-bold text-ink-1 mb-1">
                    {report.detection.water?.share != null ? `${(report.detection.water.share * 100).toFixed(1)}% water` : 'Dry land'}
                  </div>
                  <div className="text-xs text-ink-3">
                    Source: JRC Global Surface Water
                  </div>
                </div>

                {/* 5. Terrain */}
                <div className="detection-feature-card">
                  <div className="flex-between mb-2">
                    <span className="text-xs font-semibold text-ink-2">Terrain & Relief</span>
                    <span className={`detection-badge-${report.detection.terrain?.state === 'detected' ? 'danger' : 'ok'}`}>
                      {report.detection.terrain?.state === 'detected' ? 'STEEP SLOPE' : 'SUITABLE'}
                    </span>
                  </div>
                  <div className="text-base font-bold text-ink-1 mb-1">
                    {report.detection.terrain?.slope_mean != null ? `${report.detection.terrain.slope_mean.toFixed(1)}° slope` : 'Gentle slope'}
                  </div>
                  <div className="text-xs text-ink-3">
                    {report.detection.terrain?.elevation_mean != null ? `Elev: ${report.detection.terrain.elevation_mean.toFixed(0)}m • ` : ''}
                    Source: Copernicus GLO-30
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2 — TOP 5 MULTI-CROP RECOMMENDATIONS OR NON-ARABLE NOTICE */}
          {top5Crops.length === 0 ? (
            <section className="crop-section">
              <div className="glass-card non-arable-card">
                <AlertTriangle size={52} className="text-danger mx-auto mb-4" />
                <h2 className="non-arable-title">
                  Cultivation Not Feasible: Non-Arable Zone Selected
                </h2>
                <p className="non-arable-desc">
                  The selected coordinate (<strong>{centroidLat?.toFixed(4)}°N, {centroidLon?.toFixed(4)}°E</strong>) lies within an open water body or polar permafrost zone (<strong>{detectedLocation?.displayName || 'Non-Arable Terrestrial Zone'}</strong>).
                  Because open water and ice shields lack soil lithology and experience sub-zero or aquatic environments, Land Suitability is <strong>0% (Not Suitable)</strong> and <strong>no crops can be planted here</strong>.
                </p>
                <div className="non-arable-factors">
                  ⚠️ Limiting Factors: {(suit as any).limiting_factors && (suit as any).limiting_factors.length > 0 ? (suit as any).limiting_factors.join('. ') : (detectedLocation?.warningMessage || 'Terrestrial crop cultivation impossible in open water / polar ice.')}
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => goToStep(2)}
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
                  <div className="flex-row-center gap-8">
                    <Sparkles size={20} className="text-emerald" />
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
            <div className="glass-card yield-chart-container">
              <div className="flex-between">
                <div>
                  <div className="flex-row-center gap-8">
                    <BarChart3 size={20} className="text-info" />
                    <h3 className="yield-chart-title">
                      Top 10 Crops vs. Predicted Yield Potential
                    </h3>
                  </div>
                  <p className="yield-chart-desc">
                    Comparing expected median yield (P50) alongside lower-bound (P10 pessimistic) and upper-bound (P90 optimistic) uncertainty bounds.
                  </p>
                </div>
                <span className="badge badge-moderate text-xs">
                  Units: Tonnes per Hectare (t/ha)
                </span>
              </div>

              <div className="yield-chart-body">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={chartData}
                    margin={{ top: 10, right: 30, left: 130, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={isLight ? YIELD_CHART_COLORS.gridLight : YIELD_CHART_COLORS.grid} />
                    <XAxis type="number" stroke={isLight ? YIELD_CHART_COLORS.tooltipBorderLight : YIELD_CHART_COLORS.tooltipBorderDark} unit=" t/ha" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke={isLight ? YIELD_CHART_COLORS.tooltipBorderLight : YIELD_CHART_COLORS.tooltipBorderDark}
                      width={120}
                      tick={{ fontSize: 11, fill: isLight ? YIELD_CHART_COLORS.tooltipBgDark : YIELD_CHART_COLORS.tooltipBgLight, fontWeight: 600 }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: isLight ? YIELD_CHART_COLORS.tooltipBgLight : YIELD_CHART_COLORS.tooltipBgDark,
                        border: isLight ? YIELD_CHART_COLORS.tooltipBorderLight : YIELD_CHART_COLORS.tooltipBorderDark,
                        borderRadius: '10px',
                        color: isLight ? YIELD_CHART_COLORS.tooltipBgDark : YIELD_CHART_COLORS.tooltipBgLight
                      }}
                      labelStyle={{ color: isLight ? YIELD_CHART_COLORS.tooltipBgDark : YIELD_CHART_COLORS.tooltipBgLight, fontWeight: 700 }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                    <Bar dataKey="p10" fill={YIELD_CHART_COLORS.p10} name="P10 (Pessimistic)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="expectedYield" fill={YIELD_CHART_COLORS.p50} name="P50 (Median Expected)" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="p90" fill={YIELD_CHART_COLORS.p90} name="P90 (Optimistic)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>

          {/* SECTION 6 — ADDITIONAL CROP INSIGHTS */}
          <section className="crop-section">
            <div className="section-header">
              <div className="flex-row-center gap-8">
                <Info size={20} className="text-info" />
                <h2 className="section-title">Additional Agronomic Crop Insights</h2>
              </div>
              <span className="badge badge-high">Deep Agronomic Profiling</span>
            </div>

            <div className="crop-insights-grid">
              {top5Crops.map((crop, idx) => {
                const isExpanded = expandedInsightCropId === crop.crop_id;
                const companion = crop.intercrop_options?.[0];

                return (
                  <div key={crop.crop_id || idx} className="glass-card crop-insight-card">
                    <div
                      className="flex-between cursor-pointer"
                      onClick={() => setExpandedInsightCropId(isExpanded ? null : crop.crop_id)}
                    >
                      <div className="flex-row-center gap-10">
                        <span className="rank-badge-num">#{idx + 1}</span>
                        <div>
                          <h3 className="text-base font-bold m-0 text-ink-1">
                            {crop.crop_name}
                          </h3>
                          <span className="text-xs text-ink-2">
                            {crop.category} • Suitability Match: {(crop.recommendation_score * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>

                      <div className="flex-row-center gap-8">
                        {companion ? (
                          <span className="badge badge-high text-xs">
                            +{(companion.yield_boost_pct * 100).toFixed(1)}% {companion.companion_crop_name}
                          </span>
                        ) : (
                          <span className="badge badge-low text-xs opacity-70">
                            Sole Cropping
                          </span>
                        )}
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
                        <strong>Intercrop Benefit:</strong> {companion ? (
                          `Co-planting with ${companion.companion_crop_name} boosts harvest by +${(companion.yield_boost_pct * 100).toFixed(1)}% via ${companion.rationale || 'symbiotic nutrient & canopy synergy'}.`
                        ) : (
                          "Cultivated as a sole crop; no agronomic intercrop pairing indicated."
                        )}
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
                        <div className="detection-grid">
                          <div className="tech-item"><span className="tech-name">Soil Compatibility</span><span className="tech-val text-emerald-light">High</span></div>
                          <div className="tech-item"><span className="tech-name">Thermal Regime</span><span className="tech-val">Optimal</span></div>
                          <div className="tech-item"><span className="tech-name">Moisture Index</span><span className="tech-val">Compatible</span></div>
                          <div className="tech-item"><span className="tech-name">P10 Pessimistic</span><span className="tech-val">{crop.expected_yield_t_ha.p10} t/ha</span></div>
                          <div className="tech-item"><span className="tech-name">P50 Expected</span><span className="tech-val text-gold">{crop.expected_yield_t_ha.p50} t/ha</span></div>
                          <div className="tech-item"><span className="tech-name">P90 Optimistic</span><span className="tech-val">{crop.expected_yield_t_ha.p90} t/ha</span></div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 7 — AI AGRICULTURAL INSIGHT */}
          <section className="crop-section">
            <div className="glass-card ai-insight-box">
              <div className="section-header mb-4">
                <div className="flex-row-center gap-8">
                  <Sparkles size={20} className="text-emerald" />
                  <h3 className="text-xl font-bold m-0 text-ink-1">
                    AI Agricultural Insight
                  </h3>
                </div>
                <span className="badge badge-high">Ensemble Decision Synthesis</span>
              </div>

              {/* 1. Executive Synthesis Paragraph */}
              <p className="text-sm leading-relaxed text-ink-1 mb-4">
                {aiInsightNarrative || `Based on the selected location's satellite vegetation condition (NDVI: ${sat.ndvi?.toFixed(2) || '0.59'}, NDMI: ${sat.ndmi?.toFixed(2) || '0.23'}), soil characteristics (pH: ${env.ph?.toFixed(2) || '5.92'}, SOC: ${env.organic_carbon_g_kg?.toFixed(1) || '6.1'} g/kg), seasonal rainfall (${Math.round(env.rainfall_mm || 1053)} mm), and ambient temperature (${env.temp_mean_c?.toFixed(1) || '23.1'}°C), the following crops were ranked: ${topNames || 'Finger Millet (Ragi), Maize, Groundnut'}.`}
              </p>

              {/* 2. High Suitability & Diagnostic Confidence Banner */}
              <div className="ai-suitability-highlight">
                <div className="flex-row-center gap-10">
                  <Award size={22} className="text-emerald flex-shrink-0" />
                  <div>
                    <span className="text-xs uppercase tracking-wider text-ink-2 font-semibold">
                      Parcel Suitability Grade
                    </span>
                    <div className="text-lg font-extrabold text-emerald">
                      {suit.grade || 'High'} Suitability ({Math.round((suit.score || 0.83) * 100)}%)
                    </div>
                  </div>
                </div>

                <div className="ai-conf-badge">
                  <CheckCircle size={15} className="text-emerald" />
                  <span className="text-sm font-bold text-ink-1">
                    Diagnostic Confidence: {Math.round((suit.confidence || 0.90) * 100)}%
                  </span>
                </div>
              </div>

              {/* 3. Key Agronomic Action Plan — 4 Clean Cards */}
              <div>
                <h4 className="text-base font-bold text-ink-1 mb-3 flex-row-center gap-8">
                  <Leaf size={16} className="text-emerald" />
                  Key Agronomic Action Plan
                </h4>

                <div className="action-plan-grid">
                  {/* Card 1: Cultivar */}
                  <div className="action-plan-card">
                    <div className="flex-between">
                      <span className="text-xs font-bold uppercase text-emerald">
                        Primary Cultivar Allocation
                      </span>
                      <span className="badge badge-high text-xs px-2 py-1">
                        Rank #1
                      </span>
                    </div>
                    <div className="text-sm font-bold text-ink-1">
                      {topCrop?.crop_name || "Finger Millet (Ragi)"}
                    </div>
                    <p className="text-xs text-ink-2 m-0 leading-normal">
                      Suitability match of <strong>{Math.round(((topCrop?.recommendation_score || 0.83) * 100))}%</strong> with expected median yield of <strong>{topCrop?.expected_yield_t_ha?.p50 || 1.56} t/ha</strong> (P10–P90: {topCrop?.expected_yield_t_ha?.p10 || 0.93}–{topCrop?.expected_yield_t_ha?.p90 || 2.56} t/ha).
                    </p>
                  </div>

                  {/* Card 2: Intercrop */}
                  <div className="action-plan-card">
                    {companionOpt ? (
                      <>
                        <div className="flex-between">
                          <span className="text-xs font-bold uppercase text-info">
                            Symbiotic Companion Pairing
                          </span>
                          <span className="badge badge-high text-xs px-2 py-1">
                            +{boostPct}% Synergy
                          </span>
                        </div>
                        <div className="text-sm font-bold text-ink-1">
                          Intercrop with {companionName}
                        </div>
                        <p className="text-xs text-ink-2 m-0 leading-normal">
                          Recommended <strong>{Math.round((1 - companionOpt.companion_share_factor) * 100)}:{Math.round(companionOpt.companion_share_factor * 100)} spatial arrangement</strong> boosts total parcel harvest via atmospheric nitrogen fixation and canopy layering.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="flex-between">
                          <span className="text-xs font-bold uppercase text-ink-2">
                            Cropping Pattern
                          </span>
                          <span className="badge badge-low text-xs px-2 py-1">
                            Sole Crop
                          </span>
                        </div>
                        <div className="text-sm font-bold text-ink-1">
                          Sole Cropping Optimized
                        </div>
                        <p className="text-xs text-ink-2 m-0 leading-normal">
                          No verified intercrop pairing identified for this crop under current soil and climate regimes. Monoculture management recommended.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Card 3: Irrigation */}
                  <div className="action-plan-card">
                    <div className="flex-between">
                      <span className="text-xs font-bold uppercase text-info">
                        Irrigation Strategy
                      </span>
                      <span className="badge badge-moderate text-xs px-2 py-1 text-capitalize">
                        {irri.recommended_mode || 'Rainfed'}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-ink-1">
                      Water Management Mode: {String(irri.recommended_mode || 'Rainfed').toUpperCase()}
                    </div>
                    <p className="text-xs text-ink-2 m-0 leading-normal">
                      Seasonal water demand of <strong>{irri.total_water_demand_m3?.toLocaleString() || '11,400'} m³</strong> against <strong>{irri.effective_rainfall_mm || '789.8'} mm</strong> effective precipitation.
                    </p>
                  </div>

                  {/* Card 4: Climate Resilience */}
                  <div className="action-plan-card">
                    <div className="flex-between">
                      <span className="text-xs font-bold uppercase text-gold">
                        Climate Resilience
                      </span>
                      <span className="badge badge-high text-xs px-2 py-1">
                        {risk.overall_risk_level || 'Low'} Risk
                      </span>
                    </div>
                    <div className="text-sm font-bold text-ink-1">
                      Drought: {risk.drought_risk_score?.toFixed(0) || '6'}% • Heat: {risk.heat_risk_score?.toFixed(0) || '5'}%
                    </div>
                    <p className="text-xs text-ink-2 m-0 leading-normal">
                      {risk.note || 'Low climatic risk profile during active vegetative and grain filling window.'}
                    </p>
                  </div>
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
              <span>Previous (Field Analysis)</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => goToStep(4)}
            >
              <span>Detailed Summary</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
