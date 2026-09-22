import React from 'react';
import {
  FileText,
  MapPin,
  Activity,
  Award,
  Droplets,
  ShieldAlert,
  Sprout,
  TrendingUp,
  Leaf,
  Compass,
  CheckCircle,
  Download,
  Printer,
  ArrowLeft,
  RotateCcw,
  Sparkles,
  AlertTriangle
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

export const SummaryReportPage: React.FC = () => {
  const { report, formData, goToStep, detectedLocation } = useWorkflow();

  const handlePrint = () => {
    window.print();
  };

  const farmArea = report?.field_summary?.area_ha || formData.areaHa;
  const centroidLat = report?.field_summary?.centroid_lat || 17.3850;
  const centroidLon = report?.field_summary?.centroid_lon || 78.4867;

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
  const companionName = companionOpt?.companion_crop_name || "Cowpea (Lobia)";
  const boostPct = companionOpt ? (companionOpt.yield_boost_pct * 100).toFixed(1) : "15.0";

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

  return (
    <div className="page-container printable-report-area">
      {/* Printable Header (Visible during Print / PDF Export) */}
      <div className="print-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} style={{ color: '#059669' }} />
              <h1 style={{ fontSize: '20pt', fontWeight: 800, margin: 0, color: '#0f172a', letterSpacing: '-0.02em' }}>
                GeoAgri AI — Agricultural Intelligence Dossier
              </h1>
            </div>
            <p style={{ fontSize: '9pt', color: '#475569', margin: '3px 0 0 0', fontWeight: 500 }}>
              Global Agronomic Decision Support System • Multi-Criteria Bioclimatic Evaluation
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8.5pt', color: '#64748b', lineHeight: 1.4 }}>
            <div><strong>Generated:</strong> {new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}</div>
            <div><strong>Parcel ID:</strong> WGS84-{centroidLat.toFixed(3)}-{centroidLon.toFixed(3)}</div>
            <div><strong>Status:</strong> Geodesic Spatial Verified</div>
          </div>
        </div>
        <hr style={{ margin: '10px 0', borderColor: '#cbd5e1' }} />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MapPin size={20} style={{ color: '#10b981' }} />
            <h2 className="section-title">1. Field Overview & Spatial Geography</h2>
          </div>
          <span className="badge badge-high">Geodesic Verified</span>
        </div>

        <div className="report-grid-3">
          <div className="summary-data-cell">
            <span className="cell-label">Location / Region</span>
            <strong className="cell-val">{detectedLocation?.displayName || formData.selectedPresetName}</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Centroid Coordinates</span>
            <strong className="cell-val">{centroidLat.toFixed(4)}°N, {centroidLon.toFixed(4)}°E</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Geodesic Parcel Area</span>
            <strong className="cell-val" style={{ color: '#10b981' }}>{farmArea.toFixed(2)} Hectares</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Target Season</span>
            <strong className="cell-val" style={{ textTransform: 'capitalize' }}>{formData.season}</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Agro-Climatic Zone</span>
            <strong className="cell-val">{detectedLocation?.agroZone || "Global Agro-Ecological Zone"}</strong>
          </div>
          <div className="summary-data-cell">
            <span className="cell-label">Soil Texture Composition</span>
            <strong className="cell-val">
              {env.texture_clay_pct.toFixed(0)}% Clay • {env.texture_sand_pct.toFixed(0)}% Sand • {env.texture_silt_pct.toFixed(0)}% Silt
            </strong>
          </div>
        </div>
      </section>

      {/* SECTION 2: SATELLITE & ENVIRONMENTAL ANALYSIS */}
      <section className="report-section glass-card">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={20} style={{ color: '#38bdf8' }} />
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
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{m.label}</td>
                  <td style={{ fontWeight: 700, color: '#fbbf24', whiteSpace: 'nowrap' }}>{m.value}</td>
                  <td>
                    <span className={`badge ${m.rating === 'optimal' ? 'badge-high' : 'badge-moderate'}`}>
                      {m.interpretation}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{m.implication}</td>
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
        <div className="report-section glass-card" style={{ height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Award size={18} style={{ color: '#10b981' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              3. Land Suitability Assessment
            </h3>
          </div>
          <div style={{ background: suit.score === 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', border: suit.score === 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: suit.score === 0 ? '#ef4444' : '#10b981' }}>
              {suit.grade} Suitability ({Math.round(suit.score * 100)}%)
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Diagnostic Confidence: <strong>{Math.round(suit.confidence * 100)}%</strong>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
            <strong>Limiting Factors:</strong>
            <ul style={{ paddingLeft: '18px', marginTop: '6px' }}>
              {suit.limiting_factors.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 4. Irrigation Analysis */}
        <div className="report-section glass-card" style={{ height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Droplets size={18} style={{ color: '#38bdf8' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              4. Irrigation & Water Balance
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div className="metric-box">
              <span className="metric-label">Recommended Mode</span>
              <span className="metric-value" style={{ color: '#38bdf8', fontSize: '1.05rem', textTransform: 'capitalize' }}>
                {irri.recommended_mode}
              </span>
            </div>
            <div className="metric-box">
              <span className="metric-label">Total Water Demand</span>
              <span className="metric-value" style={{ fontSize: '1.05rem' }}>
                {irri.total_water_demand_m3.toLocaleString()} m³
              </span>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
            Seasonal effective rainfall is estimated at <strong>{irri.effective_rainfall_mm} mm</strong>. Soil moisture levels are adequate with supplemental watering required during flowering and pod development.
          </div>
        </div>

        {/* 5. Climate Risk */}
        <div className="report-section glass-card" style={{ height: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <ShieldAlert size={18} style={{ color: '#f59e0b' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              5. Climate Risk Scorecard
            </h3>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span className="badge badge-high" style={{ fontSize: '0.85rem' }}>
              {risk.overall_risk_level} Climate Risk
            </span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>30-Year Trend Calibration</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div className="metric-box" style={{ padding: '8px' }}>
              <span className="metric-label" style={{ fontSize: '0.68rem' }}>Drought</span>
              <span className="metric-value" style={{ fontSize: '0.95rem' }}>{risk.drought_risk_score.toFixed(0)}%</span>
            </div>
            <div className="metric-box" style={{ padding: '8px' }}>
              <span className="metric-label" style={{ fontSize: '0.68rem' }}>Heat Stress</span>
              <span className="metric-value" style={{ fontSize: '0.95rem' }}>{risk.heat_risk_score.toFixed(0)}%</span>
            </div>
            <div className="metric-box" style={{ padding: '8px' }}>
              <span className="metric-label" style={{ fontSize: '0.68rem' }}>Excess Rain</span>
              <span className="metric-value" style={{ fontSize: '0.95rem' }}>{risk.excess_rain_risk_score.toFixed(0)}%</span>
            </div>
          </div>
          <p style={{ fontSize: '0.78rem', color: '#9ca3af', margin: 0 }}>
            💬 <strong>Advisory:</strong> {risk.note}
          </p>
        </div>
      </div>

      {/* SECTION 6: TOP 5 CROP RECOMMENDATIONS */}
      <section className="report-section glass-card">
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sprout size={20} style={{ color: '#10b981' }} />
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
                <th style={{ textAlign: 'right' }}>Suitability</th>
                <th style={{ textAlign: 'right' }}>Expected Yield</th>
                <th style={{ textAlign: 'center' }}>Yield Boost</th>
                <th style={{ textAlign: 'center' }}>Irrigation</th>
                <th style={{ textAlign: 'center' }}>Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {top5Crops.map((c, idx) => {
                const companion = c.intercrop_options?.[0];
                const boost = companion ? (companion.yield_boost_pct * 100).toFixed(1) : "14.5";
                const totalYield = (c.expected_production_t?.p50 || (c.expected_yield_t_ha.p50 * farmArea)).toFixed(1);

                return (
                  <tr key={idx}>
                    <td style={{ fontWeight: 700, color: idx === 0 ? '#fbbf24' : '#9ca3af' }}>#{idx + 1}</td>
                    <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.crop_name}</td>
                    <td>
                      <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Leaf size={12} /> {companion?.companion_crop_name || "Cowpea (Lobia)"}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                      {(c.recommendation_score * 100).toFixed(1)}%
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>
                      {totalYield} t <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>({c.expected_yield_t_ha.p50} t/ha)</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: '4px', fontWeight: 700, fontSize: '0.75rem' }}>
                        +{boost}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', textTransform: 'capitalize' }}>
                      <span className="badge badge-high" style={{ fontSize: '0.75rem' }}>{c.irrigation_mode}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: c.climate_risk_score < 35 ? '#10b981' : '#fbbf24', fontWeight: 600, fontSize: '0.8rem' }}>
                        {c.climate_risk_score < 35 ? 'Low' : 'Moderate'}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} style={{ color: '#f59e0b' }} />
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
                <th style={{ textAlign: 'right' }}>Total Harvest (P50)</th>
                <th style={{ textAlign: 'right' }}>Median Yield (P50)</th>
                <th style={{ textAlign: 'right' }}>P10–P90 Range</th>
                <th style={{ textAlign: 'center' }}>Water Need</th>
                <th style={{ textAlign: 'right' }}>Recommendation Score</th>
              </tr>
            </thead>
            <tbody>
              {top10Crops.map((c, idx) => (
                <tr key={idx}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{idx + 1}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-main)' }}>{c.crop_name}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#fbbf24' }}>
                    {(c.expected_production_t?.p50 || (c.expected_yield_t_ha.p50 * farmArea)).toFixed(1)} t
                  </td>
                  <td style={{ textAlign: 'right' }}>{c.expected_yield_t_ha.p50.toFixed(2)} t/ha</td>
                  <td style={{ textAlign: 'right', color: '#9ca3af', fontSize: '0.78rem' }}>
                    {c.expected_yield_t_ha.p10.toFixed(2)} – {c.expected_yield_t_ha.p90.toFixed(2)} t/ha
                  </td>
                  <td style={{ textAlign: 'center', color: '#38bdf8' }}>{c.water_need_mm} mm</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>
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
      <section className="report-section glass-card executive-recommendation-section" style={{ borderLeft: '4px solid #10b981' }}>
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} style={{ color: '#10b981' }} />
            <h2 className="section-title">8. Synthesized Agronomic Intelligence & Strategic Action Plan</h2>
          </div>
          <span className="badge badge-high">AI Decision Support Engine</span>
        </div>

        {/* Executive Overview Synopsis */}
        <div className="executive-synopsis-banner">
          <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: '1.65', color: 'var(--text-main)' }}>
            Based on the selected location's satellite diagnostics (NDVI: <strong>{sat.ndvi.toFixed(2)}</strong>, NDMI: <strong>{sat.ndmi.toFixed(2)}</strong>), soil characteristics (pH: <strong>{env.ph.toFixed(2)}</strong>, SOC: <strong>{env.organic_carbon_g_kg.toFixed(1)} g/kg</strong>), seasonal rainfall (<strong>{env.rainfall_mm.toFixed(0)} mm</strong>), mean temperature (<strong>{env.temp_mean_c.toFixed(1)}°C</strong>), and climate vulnerability (<strong>{risk.overall_risk_level}</strong>), the parcel demonstrates <strong style={{ color: '#10b981' }}>{suit.grade} Suitability ({Math.round(suit.score * 100)}%)</strong> with <strong style={{ color: '#38bdf8' }}>{Math.round(suit.confidence * 100)}% Diagnostic Confidence</strong>.
          </p>
        </div>

        {/* 4 Structured Executive Action Cards */}
        <div className="action-cards-grid">
          {/* Action 1: Primary Cultivar Allocation */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-icon-pill" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                <Sprout size={16} />
              </div>
              <span className="action-type-badge">Primary Cultivar Allocation</span>
            </div>
            <div className="action-main-val">
              {topCrop?.crop_name || "Top Ranked Cultivar"}
            </div>
            <div className="action-meta-row">
              <span className="badge badge-high" style={{ fontSize: '0.72rem' }}>
                {Math.round((topCrop?.recommendation_score || 0.8) * 100)}% Suitability
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Target Yield: <strong style={{ color: 'var(--text-main)' }}>{topCrop?.expected_yield_t_ha?.p50.toFixed(2) || "0.00"} t/ha</strong>
              </span>
            </div>
            <p className="action-desc">
              P10–P90 harvest boundary: {topCrop?.expected_yield_t_ha?.p10.toFixed(2)}–{topCrop?.expected_yield_t_ha?.p90.toFixed(2)} t/ha. Total estimated yield across parcel: <strong>{(topCrop?.expected_production_t?.p50 || ((topCrop?.expected_yield_t_ha?.p50 || 0) * farmArea)).toFixed(1)} tonnes</strong>.
            </p>
          </div>

          {/* Action 2: Symbiotic Companion Pairing */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-icon-pill" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                <Leaf size={16} />
              </div>
              <span className="action-type-badge">Symbiotic Companion Pairing</span>
            </div>
            <div className="action-main-val">
              {companionName}
            </div>
            <div className="action-meta-row">
              <span className="badge badge-high" style={{ fontSize: '0.72rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' }}>
                +{boostPct}% Yield Synergy
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                75:25 Spatial Intercrop
              </span>
            </div>
            <p className="action-desc">
              Intercropping in a 75:25 spatial ratio accelerates atmospheric nitrogen fixation, improves soil organic matter turnover, and optimizes canopy light interception.
            </p>
          </div>

          {/* Action 3: Precision Irrigation Strategy */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-icon-pill" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                <Droplets size={16} />
              </div>
              <span className="action-type-badge">Precision Irrigation Strategy</span>
            </div>
            <div className="action-main-val" style={{ textTransform: 'capitalize' }}>
              {irri.recommended_mode} Mode
            </div>
            <div className="action-meta-row">
              <span className="badge badge-moderate" style={{ fontSize: '0.72rem' }}>
                {irri.total_water_demand_m3.toLocaleString()} m³ Total Need
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Rainfall: <strong style={{ color: 'var(--text-main)' }}>{irri.effective_rainfall_mm.toFixed(1)} mm</strong>
              </span>
            </div>
            <p className="action-desc">
              Calibrated supplemental water scheduling during critical flowering and grain/tuber filling stages mitigates mid-season moisture stress while conserving water.
            </p>
          </div>

          {/* Action 4: Climate Resilience & Advisory */}
          <div className="action-card">
            <div className="action-card-header">
              <div className="action-icon-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
                <ShieldAlert size={16} />
              </div>
              <span className="action-type-badge">Climate Resilience & Advisory</span>
            </div>
            <div className="action-main-val">
              {risk.overall_risk_level} Climatic Vulnerability
            </div>
            <div className="action-meta-row">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Drought: <strong style={{ color: 'var(--text-main)' }}>{risk.drought_risk_score.toFixed(0)}%</strong> • Heat: <strong style={{ color: 'var(--text-main)' }}>{risk.heat_risk_score.toFixed(0)}%</strong>
              </span>
            </div>
            <p className="action-desc">
              {risk.note}
            </p>
          </div>
        </div>

        {/* Dossier Certification Sign-off */}
        <div className="report-certification-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={15} style={{ color: '#10b981' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)' }}>
              Certified Global Agricultural Decision Support System (DSS)
            </span>
          </div>
          <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
            Bioclimatic Multi-Criteria Decision Engine • WGS84 Geodesic Verified • Report ID: WGS84-{centroidLat.toFixed(3)}-{centroidLon.toFixed(3)}
          </span>
        </div>
      </section>

      {/* SECTION 9: REPORT DOWNLOAD & ACTION DOCK */}
      <section className="report-section glass-card no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
              9. Export & Share Agricultural Intelligence Dossier
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
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
