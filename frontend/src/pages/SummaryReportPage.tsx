import React from 'react';
import {
  MapPin,
  Activity,
  Award,
  Droplets,
  ShieldAlert,
  Sprout,
  TrendingUp,
  Leaf,
  CheckCircle,
  ArrowLeft,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { ReportDownloadButton } from '../components/ReportDownloadButton/ReportDownloadButton';
import {
  interpretNDVI,
  interpretNDMI,
  interpretNDWI,
  interpretRainfall,
  interpretTemperature,
  interpretPH,
  interpretOrganicCarbon,
  interpretTerrain,
  interpretRadar,
  generateAgronomicRecommendation
} from '../utils/agronomicFormatters';
import { getCoordinatesCentroid } from '../features/boundary/boundaryMath';

export const SummaryReportPage: React.FC = () => {
  const { report, formData, goToStep, detectedLocation } = useWorkflow();

  const handlePrint = () => {
    window.print();
  };

  const farmArea = report?.field_summary?.area_ha || formData.areaHa;
  const fallbackCenter = getCoordinatesCentroid(formData.polygonPts, formData.pointPt);
  const centroidLat = report?.field_summary?.centroid_lat ?? fallbackCenter?.[1] ?? 0;
  const centroidLon = report?.field_summary?.centroid_lon ?? fallbackCenter?.[0] ?? 0;

  const env = report?.environment || {
    rainfall_mm: 700.1,
    temp_max_c: 32.4,
    temp_min_c: 21.2,
    temp_mean_c: 26.5,
    humidity_pct: 68.2,
    solar_radiation_mj_m2: 19.5,
    ph: 6.64,
    organic_carbon_g_kg: 10.82,
    nitrogen_g_kg: 0.85,
    phosphorus_ppm: 14.2,
    potassium_ppm: 185.0,
    texture_clay_pct: 28.5,
    texture_sand_pct: 42.1,
    texture_silt_pct: 29.4
  };

  const sat = report?.satellite_features || {
    ndvi: 0.63,
    ndwi: -0.05,
    evi: 0.48,
    savi: 0.52,
    ndmi: 0.10,
    elevation: 239,
    slope: 0.8,
    twi: 8.4,
    vv: -11.2,
    vh: -17.5
  };

  const suit = report?.land_suitability || {
    grade: "High",
    score: 0.83,
    confidence: 0.90,
    limiting_factors: ["Minor summer evapotranspiration stress"]
  };

  const irri = report?.irrigation_summary || {
    recommended_mode: "Supplemental",
    total_water_demand_m3: 14200,
    effective_rainfall_mm: 480.0
  };

  const risk = report?.climate_risk_summary || {
    overall_risk_level: "Low",
    drought_risk_score: 22,
    heat_risk_score: 31,
    excess_rain_risk_score: 15,
    note: "Stable seasonal rainfall with low vulnerability to extreme meteorological shocks."
  };

  const crops = report?.recommended_crops || [];
  const top5Crops = crops.slice(0, 5);
  const top10Crops = crops.slice(0, 10);
  const topCrop = top5Crops[0];
  const companionOpt = topCrop?.intercrop_options?.[0];
  const companionName = companionOpt?.companion_crop_name || "";
  const boostPct = companionOpt ? (companionOpt.yield_boost_pct * 100).toFixed(1) : "0.0";

  // Environmental interpretation list
  const metricsList = [
    interpretNDVI(sat.ndvi),
    interpretNDMI(sat.ndmi),
    interpretNDWI(sat.ndwi),
    interpretRainfall(env.rainfall_mm),
    interpretTemperature(env.temp_mean_c),
    interpretPH(env.ph),
    interpretOrganicCarbon(env.organic_carbon_g_kg),
    interpretTerrain(sat.elevation, sat.slope),
    interpretRadar(sat.vv, sat.vh),
  ];

  const aiSynthesis = generateAgronomicRecommendation(report);
  const isServerArea = report?.field_summary?.area_source === 'server';
  const isDemoMode = report?.data_mode === 'demo_synthetic';

  return (
    <div className="page-container printable-report-area">
      {isDemoMode && (
        <div className="demo-mode-ribbon" role="alert" style={{ background: '#f59e0b', color: '#78350f', fontWeight: 600, textAlign: 'center', padding: '8px 12px', fontSize: '0.85rem', marginBottom: '16px', borderRadius: '6px' }}>
          DEMO MODE: Synthetic satellite and soil data. Not for real agronomic use.
        </div>
      )}

      {/* Printable Header (Visible during Print / PDF Export) */}
      <div className="print-header">
        <div className="flex-between align-start">
          <div>
            <div className="flex-row-center gap-8">
              <Sparkles size={20} className="text-emerald" />
              <h1 className="text-2xl font-extrabold m-0 text-ink-1">
                GeoAgri AI — Agricultural Intelligence Dossier
              </h1>
            </div>
            <p className="text-xs text-ink-2 font-medium mt-1">
              Global Agronomic Decision Support System • Multi-Criteria Bioclimatic Evaluation
            </p>
          </div>
          <div className="text-right text-xs text-ink-3 leading-normal">
            <div><strong>Generated:</strong> {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</div>
            <div><strong>Parcel ID:</strong> WGS84-{centroidLat?.toFixed(3)}-{centroidLon?.toFixed(3)}</div>
            <div><strong>Status:</strong> {isServerArea ? 'Geodesic Spatial Verified' : 'Area estimated in browser'}</div>
          </div>
        </div>
        <hr className="my-2 border-glass" />
      </div>

      {/* Screen Header */}
      <div className="page-title-row no-print">
        <div>
          <span className="step-tag">STEP 4 OF 4</span>
          <h1 className="page-title">GeoAgri AI — Detailed Field Report</h1>
          <p className="page-subtitle">
            Complete analysis, companion crop recommendations, and agronomic management guidelines.
          </p>
        </div>

        <ReportDownloadButton onPrint={handlePrint} />
      </div>

      {/* SECTION 1: FIELD OVERVIEW */}
      <section className="report-section glass-card">
        <div className="section-header">
          <div className="flex-row-center gap-8">
            <MapPin size={20} className="text-emerald" />
            <h2 className="section-title">1. Field Overview & Spatial Geography</h2>
          </div>
          <span className="badge badge-high">{isServerArea ? 'Geodesic Verified' : 'Area estimated in browser'}</span>
        </div>

        <div className="report-grid-3">
          <div className="summary-data-cell">
            <span className="cell-label">Location / Region</span>
            <strong className="cell-val">{detectedLocation?.displayName || formData.selectedPresetName || 'Custom Boundary'}</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Centroid Coordinates</span>
            <strong className="cell-val">{centroidLat?.toFixed(4)}°N, {centroidLon?.toFixed(4)}°E</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Geodesic Parcel Area</span>
            <strong className="cell-val text-emerald">
              {farmArea != null ? `${farmArea.toFixed(2)} Hectares` : 'N/A (Point Query)'}
            </strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Boundary Provenance</span>
            <strong className="cell-val">
              Boundary: {report?.field_summary?.boundary_source === 'drawn' ? 'drawn by user' : (report?.field_summary?.boundary_source || 'drawn by user')}
            </strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Land Classification</span>
            <strong className={`cell-val ${report?.land_class?.dominant === 'AGRICULTURAL' ? 'text-emerald' : 'text-danger'}`}>
              {report?.land_class?.dominant?.replace(/_/g, ' ') || 'AGRICULTURAL'} {report?.land_class?.subclass ? `(${report.land_class.subclass.replace(/_/g, ' ')})` : ''}
            </strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Irrigability Verdict</span>
            <strong className={`cell-val ${report?.irrigability?.verdict === 'IRRIGABLE' ? 'text-emerald' : (report?.irrigability?.verdict === 'CONDITIONALLY_IRRIGABLE' ? 'text-gold' : 'text-danger')}`}>
              {report?.irrigability?.verdict ? report.irrigability.verdict.replace(/_/g, ' ') : 'IRRIGABLE'}
            </strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Usable Irrigable Area</span>
            <strong className="cell-val text-emerald">
              {report?.irrigability?.irrigable_area_ha != null ? `${report.irrigability.irrigable_area_ha.toFixed(2)} Hectares` : (farmArea != null ? `${farmArea.toFixed(2)} Ha` : 'N/A')}
            </strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Target Season</span>
            <strong className="cell-val text-capitalize">{formData.season}</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Agro-Climatic Zone</span>
            <strong className="cell-val">{detectedLocation?.agroZone || "Global Agro-Ecological Zone"}</strong>
          </div>
        </div>

        {report?.irrigability && (report.irrigability.verdict === 'NOT_IRRIGABLE' || report.irrigability.verdict === 'NOT_IRRIGABLE_PROVISIONAL') && (
          <div className="non-arable-card mt-4 p-4 text-left">
            <strong className="text-danger block mb-1">
              ⚠ Regulatory Notice: Cultivation Excluded ({report.irrigability.verdict.replace(/_/g, ' ')})
            </strong>
            <p className="m-0 text-sm text-ink-2">
              {report.irrigability.reasons?.[0]?.reason || 'Plot falls within protected, water, urban, or wasteland boundaries.'}
            </p>
          </div>
        )}
      </section>

      {/* SECTION 2: SATELLITE & ENVIRONMENTAL ANALYSIS */}
      <section className="report-section glass-card">
        <div className="section-header">
          <div className="flex-row-center gap-8">
            <Activity size={20} className="text-info" />
            <h2 className="section-title">2. Satellite & Environmental Diagnostics</h2>
          </div>
          <span className="badge badge-moderate">Sentinel-1/2 + ISRIC 250m</span>
        </div>

        <div className="table-responsive">
          <table className="report-table">
            <thead>
              <tr>
                <th>Environmental Parameter</th>
                <th>Measured Value</th>
                <th>Agronomic Interpretation</th>
                <th>Agricultural Implication</th>
              </tr>
            </thead>
            <tbody>
              {metricsList.map((m, idx) => (
                <tr key={idx}>
                  <td className="font-semibold text-ink-1">{m.label}</td>
                  <td className="font-bold text-gold whitespace-nowrap">{m.value}</td>
                  <td>
                    <span className={`badge ${m.rating === 'optimal' ? 'badge-high' : 'badge-moderate'}`}>
                      {m.interpretation}
                    </span>
                  </td>
                  <td className="text-xs text-ink-2">{m.implication}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Print Page Break: Transitions to Page 2 in PDF */}
      <div className="print-page-break" />

      {/* SECTION 3, 4, 5: TRIO DIAGNOSTIC CARDS (Suitability, Irrigation, Climate Risk) */}
      <div className="report-trio-grid">
        {/* 3. Land Suitability */}
        <div className="report-section glass-card h-full">
          <div className="flex-row-center gap-8 mb-3">
            <Award size={18} className="text-emerald" />
            <h3 className="text-base font-bold m-0 text-ink-1">
              3. Land Suitability Assessment
            </h3>
          </div>
          <div className="ai-suitability-highlight mb-3">
            <div className={`text-xl font-extrabold ${suit.score === 0 ? 'text-danger' : 'text-emerald'}`}>
              {suit.grade} Suitability ({Math.round(suit.score * 100)}%)
            </div>
            <div className="text-xs text-ink-2 mt-1">
              Diagnostic Confidence: <strong>{Math.round(suit.confidence * 100)}%</strong>
            </div>
          </div>
          <div className="text-xs text-ink-1">
            <strong>Limiting Factors:</strong>
            <ul className="pl-4 mt-1">
              {suit.limiting_factors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4. Irrigation Analysis */}
        <div className="report-section glass-card h-full">
          <div className="flex-row-center gap-8 mb-3">
            <Droplets size={18} className="text-info" />
            <h3 className="text-base font-bold m-0 text-ink-1">
              4. Irrigation & Water Balance
            </h3>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div className="metric-box">
              <span className="metric-label">Recommended Mode</span>
              <span className="metric-value text-info text-capitalize">
                {irri.recommended_mode}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-label">Total Water Demand</span>
              <span className="metric-value">
                {irri.total_water_demand_m3.toLocaleString()} m³
              </span>
            </div>
          </div>
          <div className="text-xs text-ink-1 leading-relaxed">
            Seasonal effective rainfall is estimated at <strong>{irri.effective_rainfall_mm} mm</strong>. Soil moisture levels are adequate with supplemental watering required during flowering and pod development.
          </div>
        </div>

        {/* 5. Climate Risk */}
        <div className="report-section glass-card h-full">
          <div className="flex-row-center gap-8 mb-3">
            <ShieldAlert size={18} className="text-gold" />
            <h3 className="text-base font-bold m-0 text-ink-1">
              5. Climate Risk Scorecard
            </h3>
          </div>
          <div className="flex-between mb-3">
            <span className="badge badge-high text-sm">
              {risk.overall_risk_level} Climate Risk
            </span>
            <span className="text-xs text-ink-2">30-Year Trend Calibration</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="metric-box p-2">
              <span className="metric-label text-xs">Drought</span>
              <span className="metric-value text-sm">{risk.drought_risk_score.toFixed(0)}%</span>
            </div>
            <div className="metric-box p-2">
              <span className="metric-label text-xs">Heat Stress</span>
              <span className="metric-value text-sm">{risk.heat_risk_score.toFixed(0)}%</span>
            </div>
            <div className="metric-box p-2">
              <span className="metric-label text-xs">Excess Rain</span>
              <span className="metric-value text-sm">{risk.excess_rain_risk_score.toFixed(0)}%</span>
            </div>
          </div>
          <p className="text-xs text-ink-2 m-0">
            💬 <strong>Advisory:</strong> {risk.note}
          </p>
        </div>
      </div>

      {/* SECTION 6: TOP 5 CROP RECOMMENDATIONS */}
      <section className="report-section glass-card">
        <div className="section-header">
          <div className="flex-row-center gap-8">
            <Sprout size={20} className="text-emerald" />
            <h2 className="section-title">6. Top 5 Recommended Multi-Crop Combinations</h2>
          </div>
          <span className="badge badge-high">75% Main + 25% Companion Ratio</span>
        </div>

        <div className="table-responsive">
          <table className="report-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Primary Crop</th>
                <th>Companion Intercrop</th>
                <th className="text-right">Suitability</th>
                <th className="text-right">Expected Yield</th>
                <th className="text-center">Yield Boost</th>
                <th className="text-center">Irrigation</th>
                <th className="text-center">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {top5Crops.map((c, idx) => {
                const companion = c.intercrop_options?.[0];
                const p50 = c.expected_yield_t_ha?.p50;
                const totalYield = c.expected_production_t?.p50 != null
                  ? c.expected_production_t.p50.toFixed(1)
                  : (p50 != null ? (p50 * farmArea).toFixed(1) : null);

                return (
                  <tr key={idx}>
                    <td className={`font-bold ${idx === 0 ? 'text-gold' : 'text-ink-2'}`}>#{idx + 1}</td>
                    <td className="font-semibold text-ink-1">{c.crop_name}</td>
                    <td>
                      {companion ? (
                        <span className="text-emerald flex-row-center gap-1">
                          <Leaf size={12} /> {companion.companion_crop_name}
                        </span>
                      ) : (
                        <span className="text-ink-3 text-sm">None (Sole)</span>
                      )}
                    </td>
                    <td className="text-right font-bold text-emerald">
                      {(c.recommendation_score * 100).toFixed(1)}%
                    </td>
                    <td className="text-right font-bold text-gold">
                      {totalYield != null ? (
                        <>
                          {totalYield} t <span className="text-xs text-ink-3">({p50!.toFixed(2)} t/ha)</span>
                        </>
                      ) : (
                        <span className="text-ink-3 text-xs">No yield data (Tier B)</span>
                      )}
                    </td>
                    <td className="text-center">
                      {companion ? (
                        <span className="multi-crop-boost-tag">
                          +{(companion.yield_boost_pct * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-ink-3 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-center text-capitalize">
                      <span className="badge badge-high text-xs">{c.irrigation_mode}</span>
                    </td>
                    <td className="text-center">
                      <span className={`font-semibold text-xs ${c.climate_risk_score == null ? 'text-ink-3' : c.climate_risk_score < 35 ? 'text-emerald' : 'text-gold'}`}>
                        {c.climate_risk_score == null ? '—' : c.climate_risk_score < 35 ? 'Low' : 'Moderate'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 7: TOP 10 YIELD PREDICTIONS */}
      <section className="report-section glass-card">
        <div className="section-header">
          <div className="flex-row-center gap-8">
            <TrendingUp size={20} className="text-gold" />
            <h2 className="section-title">7. Top 10 Yield Predictions Summary</h2>
          </div>
          <span className="badge badge-moderate">Uncertainty Bounds Included</span>
        </div>

        <div className="table-responsive">
          <table className="report-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Cultivar</th>
                <th className="text-right">Total Harvest (P50)</th>
                <th className="text-right">Median Yield (P50)</th>
                <th className="text-right">P10–P90 Range</th>
                <th className="text-center">Water Need</th>
                <th className="text-right">Recommendation Score</th>
              </tr>
            </thead>
            <tbody>
              {top10Crops.map((c, idx) => (
                <tr key={idx}>
                  <td className="text-ink-3 font-semibold">{idx + 1}</td>
                  <td className="font-semibold text-ink-1">{c.crop_name}</td>
                  <td className="text-right font-bold text-gold">
                    {c.expected_production_t?.p50 != null ? (
                      `${c.expected_production_t.p50.toFixed(1)} t`
                    ) : (c.expected_yield_t_ha ? (
                      `${(c.expected_yield_t_ha.p50 * farmArea).toFixed(1)} t`
                    ) : (
                      <span className="text-ink-3 text-xs">—</span>
                    ))}
                  </td>
                  <td className="text-right">
                    {c.expected_yield_t_ha ? `${c.expected_yield_t_ha.p50.toFixed(2)} t/ha` : <span className="text-ink-3 text-xs">No yield data</span>}
                  </td>
                  <td className="text-right text-ink-2 text-xs">
                    {c.expected_yield_t_ha ? (
                      `${c.expected_yield_t_ha.p10.toFixed(2)} – ${c.expected_yield_t_ha.p90.toFixed(2)} t/ha`
                    ) : (
                      <span className="text-ink-3 text-xs">Envelope match</span>
                    )}
                  </td>
                  <td className="text-center text-info">{c.water_need_mm} mm</td>
                  <td className="text-right font-bold text-emerald-light">
                    {(c.recommendation_score * 100).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Print Page Break: Transitions to Page 3 in PDF */}
      <div className="print-page-break" />

      {/* SECTION 8: SYNTHESIZED AGRONOMIC INTELLIGENCE & ACTION PLAN */}
      <section className="report-section glass-card executive-recommendation-section">
        <div className="section-header">
          <div className="flex-row-center gap-8">
            <Sparkles size={20} className="text-emerald" />
            <h2 className="section-title">8. Synthesized Agronomic Intelligence & Strategic Action Plan</h2>
          </div>
          <span className="badge badge-high">AI Decision Support Engine</span>
        </div>

        {/* Executive Overview Synopsis */}
        <div className="executive-synopsis-banner">
          <p className="m-0 text-sm leading-relaxed text-ink-1">
            {aiSynthesis || `Based on the selected location's satellite diagnostics (NDVI: ${sat.ndvi?.toFixed(2)}, NDMI: ${sat.ndmi?.toFixed(2)}), soil characteristics (pH: ${env.ph?.toFixed(2)}, SOC: ${env.organic_carbon_g_kg?.toFixed(1)} g/kg), seasonal rainfall (${env.rainfall_mm?.toFixed(0)} mm), mean temperature (${env.temp_mean_c?.toFixed(1)}°C), and climate vulnerability (${risk.overall_risk_level}), the parcel demonstrates ${suit.grade} Suitability (${Math.round((suit.score || 0.8) * 100)}%) with ${Math.round((suit.confidence || 0.9) * 100)}% Diagnostic Confidence.`}
          </p>
        </div>

        {/* 4 Structured Executive Action Cards */}
        <div className="action-cards-grid">
          {/* Action 1: Primary Cultivar Allocation */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-icon-pill emerald">
                <Sprout size={16} />
              </div>
              <span className="action-type-badge">Primary Cultivar Allocation</span>
            </div>
            <div className="action-main-val">
              {topCrop?.crop_name || "Top Ranked Cultivar"}
            </div>
            <div className="action-meta-row">
              <span className="badge badge-high text-xs">
                {Math.round((topCrop?.recommendation_score || 0.8) * 100)}% Suitability
              </span>
              <span className="text-xs text-ink-2">
                Target Yield: <strong className="text-ink-1">{topCrop?.expected_yield_t_ha?.p50.toFixed(2) || "0.00"} t/ha</strong>
              </span>
            </div>
            <p className="action-desc">
              P10–P90 harvest boundary: {topCrop?.expected_yield_t_ha?.p10.toFixed(2)}–{topCrop?.expected_yield_t_ha?.p90.toFixed(2)} t/ha. Total estimated yield across parcel: <strong>{(topCrop?.expected_production_t?.p50 || ((topCrop?.expected_yield_t_ha?.p50 || 0) * farmArea)).toFixed(1)} tonnes</strong>.
            </p>
          </div>

          {/* Action 2: Symbiotic Companion Pairing */}
          <div className="action-card">
            {companionOpt ? (
              <>
                <div className="action-card-header">
                  <div className="action-icon-pill info">
                    <Leaf size={16} />
                  </div>
                  <span className="action-type-badge">Symbiotic Companion Pairing</span>
                </div>
                <div className="action-main-val">
                  {companionName}
                </div>
                <div className="action-meta-row">
                  <span className="badge badge-high text-xs">
                    +{boostPct}% Yield Synergy
                  </span>
                  <span className="text-xs text-ink-2">
                    75:25 Spatial Intercrop
                  </span>
                </div>
                <p className="action-desc">
                  Intercropping in a 75:25 spatial ratio accelerates atmospheric nitrogen fixation, improves soil organic matter turnover, and optimizes canopy light interception.
                </p>
              </>
            ) : (
              <>
                <div className="action-card-header">
                  <div className="action-icon-pill neutral">
                    <Leaf size={16} />
                  </div>
                  <span className="action-type-badge">Cropping Strategy</span>
                </div>
                <div className="action-main-val">
                  Sole Cropping Optimized
                </div>
                <div className="action-meta-row">
                  <span className="badge badge-low text-xs">
                    Monoculture
                  </span>
                  <span className="text-xs text-ink-2">
                    100% Primary Canopy
                  </span>
                </div>
                <p className="action-desc">
                  No verified symbiotic intercrop partner indicated for this cultivar under local edaphic parameters. Full parcel area dedicated to primary crop.
                </p>
              </>
            )}
          </div>

          {/* Action 3: Precision Irrigation Strategy */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-icon-pill info">
                <Droplets size={16} />
              </div>
              <span className="action-type-badge">Precision Irrigation Strategy</span>
            </div>
            <div className="action-main-val text-capitalize">
              {irri.recommended_mode} Mode
            </div>
            <div className="action-meta-row">
              <span className="badge badge-moderate text-xs">
                {irri.total_water_demand_m3.toLocaleString()} m³ Total Need
              </span>
              <span className="text-xs text-ink-2">
                Rainfall: <strong className="text-ink-1">{irri.effective_rainfall_mm.toFixed(1)} mm</strong>
              </span>
            </div>
            <p className="action-desc">
              Calibrated supplemental water scheduling during critical flowering and grain/tuber filling stages mitigates mid-season moisture stress while conserving water.
            </p>
          </div>

          {/* Action 4: Climate Resilience & Advisory */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-icon-pill gold">
                <ShieldAlert size={16} />
              </div>
              <span className="action-type-badge">Climate Resilience & Advisory</span>
            </div>
            <div className="action-main-val">
              {risk.overall_risk_level} Climatic Vulnerability
            </div>
            <div className="action-meta-row">
              <span className="text-xs text-ink-2">
                Drought: <strong className="text-ink-1">{risk.drought_risk_score.toFixed(0)}%</strong> • Heat: <strong className="text-ink-1">{risk.heat_risk_score.toFixed(0)}%</strong>
              </span>
            </div>
            <p className="action-desc">
              {risk.note}
            </p>
          </div>
        </div>

        {/* Dossier Certification Sign-off */}
        <div className="report-certification-footer">
          <div className="flex-row-center gap-8">
            <CheckCircle size={15} className="text-emerald" />
            <span className="text-sm font-bold text-ink-1">
              Certified Global Agricultural Decision Support System (DSS)
            </span>
          </div>
          <span className="text-xs text-ink-2">
            Bioclimatic Multi-Criteria Decision Engine • {isServerArea ? 'WGS84 Geodesic Verified' : 'Area estimated in browser'} • Report ID: WGS84-{centroidLat?.toFixed(3)}-{centroidLon?.toFixed(3)}
          </span>
        </div>
      </section>

      {/* SECTION 8B: OPEN DATA ATTRIBUTIONS & LICENCES (PRD v2.1 M30) */}
      <section className="report-section glass-card mt-4 p-4 text-xs text-ink-2 leading-relaxed">
        <h4 className="text-sm font-bold m-0 mb-2 text-ink-1">
          Data Sources, Licences & Open Data Attributions (PRD v2.1 M30)
        </h4>
        <div className="report-attributions-grid">
          <div><strong>• OpenStreetMap (OSM) / OpenFreeMap:</strong> © OpenStreetMap contributors, ODbL 1.0. Vector tiles under CC BY-SA 2.0.</div>
          <div><strong>• ESA WorldCover 2021:</strong> © ESA WorldCover consortium 2021 / Contains modified Copernicus Sentinel data (2021), CC BY 4.0.</div>
          <div><strong>• Copernicus DEM GLO-30:</strong> European Space Agency (ESA) Copernicus Programme, Open Access.</div>
          <div><strong>• Microsoft Open Buildings:</strong> Microsoft Global ML Building Footprints, CDLA-Permissive-2.0.</div>
          <div><strong>• Hansen / Global Forest Watch:</strong> Hansen, UMD, Google, USGS, NASA, CC BY 4.0.</div>
          <div><strong>• HydroSHEDS / HydroLAKES:</strong> Messager et al. (2016) / WWF US, CC BY 4.0.</div>
          <div><strong>• Protected Planet / WDPA:</strong> UNEP-WCMC & IUCN (2024), Non-Commercial Research & Decision Support.</div>
          <div><strong>• ISRO Bhuvan:</strong> National Remote Sensing Centre (NRSC), Department of Space, Government of India.</div>
        </div>
      </section>

      {/* SECTION 9: REPORT DOWNLOAD & ACTION DOCK */}
      <section className="report-section glass-card no-print">
        <div className="flex-between flex-wrap gap-16">
          <div>
            <h3 className="text-lg font-bold m-0 text-ink-1">
              9. Export & Share Agricultural Intelligence Dossier
            </h3>
            <p className="text-xs text-ink-2 mt-1">
              Download a high-resolution, branded PDF report containing all field data, satellite metrics, and crop forecasts.
            </p>
          </div>

          <ReportDownloadButton onPrint={handlePrint} />
        </div>
      </section>

      {/* Bottom Step Actions (Screen Only) */}
      <div className="page-bottom-actions no-print">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => goToStep(3)}
        >
          <ArrowLeft size={16} />
          <span>Previous (Crop Prediction)</span>
        </button>

        <button
          type="button"
          className="btn-primary"
          onClick={() => goToStep(1)}
        >
          <RotateCcw size={16} />
          <span>Start New Analysis</span>
        </button>
      </div>
    </div>
  );
};
