import React, { useState } from 'react';
import {
  MapPin,
  Activity,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Sparkles,
  Info,
  Droplet,
  ShieldAlert,
  Compass,
  CheckCircle,
  Play,
  RotateCcw,
  Check,
  RefreshCw,
  Sliders
} from 'lucide-react';
import { useWorkflow, PIPELINE_STAGES } from '../context/WorkflowContext';
import { MapSelector } from '../components/MapSelector/MapSelector';
import { SuitabilityBanner } from '../components/SuitabilityBanner/SuitabilityBanner';
import { IrrigationPanel } from '../components/IrrigationPanel/IrrigationPanel';
import { ClimateRiskReport } from '../components/ClimateRiskReport/ClimateRiskReport';
import { MetricCard } from '../components/MetricCard/MetricCard';
import {
  interpretNDVI,
  interpretNDMI,
  interpretNDWI,
  interpretRainfall,
  interpretTemperature,
  interpretPH,
  interpretOrganicCarbon,
  interpretTerrain,
  interpretRadar
} from '../utils/agronomicFormatters';

export const FieldAnalysisPage: React.FC = () => {
  const {
    formData,
    updateFormData,
    report,
    goToStep,
    loading,
    isPredicted,
    pipelineStageIndex,
    runPredictNow,
    startCropAnalysis,
    error,
    detectedLocation
  } = useWorkflow();

  const [showTechnicalData, setShowTechnicalData] = useState<boolean>(false);
  const [showSoilGridsData, setShowSoilGridsData] = useState<boolean>(false);
  const [showNasaData, setShowNasaData] = useState<boolean>(false);
  const [showAllTechnicalData, setShowAllTechnicalData] = useState<boolean>(false);

  // Field coordinates
  const centroidLat = report?.field_summary?.centroid_lat || (formData.pointPt ? formData.pointPt[1] : formData.polygonPts[0]?.[1] || 17.3850);
  const centroidLon = report?.field_summary?.centroid_lon || (formData.pointPt ? formData.pointPt[0] : formData.polygonPts[0]?.[0] || 78.4867);
  const areaHa = formData.areaHa || report?.field_summary?.area_ha || 2.35;

  const env = report?.environment;
  const sat = report?.satellite_features;

  return (
    <div className="page-container">
      {/* Top Title Bar */}
      <div className="page-title-row">
        <div>
          <span className="step-tag">STEP 2 OF 4 • DATA ACQUISITION & SENSING</span>
          <h1 className="page-title">Location & Field Analysis</h1>
          <p className="page-subtitle">
            Select a field location on the interactive map to begin geospatial, satellite, soil, and environmental analysis.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => goToStep(1)}
          >
            <ArrowLeft size={16} />
            <span>Workspace</span>
          </button>

          {isPredicted && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => startCropAnalysis()}
            >
              <span>Analyse All Crops</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-alert">
          ⚠️ <strong>Backend Processing Error:</strong> {error}
          <div style={{ marginTop: '8px' }}>
            <button
              type="button"
              className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '6px 14px' }}
              onClick={() => runPredictNow()}
            >
              Retry Field Analysis
            </button>
          </div>
        </div>
      )}

      {/* 1. INTERACTIVE MAP & SELECTED FIELD SIDE PANEL */}
      <div className="top-grid">
        <MapSelector
          onPolygonChange={(pts, ha, name) => {
            updateFormData({
              polygonPts: pts,
              areaHa: Number(ha.toFixed(2)),
              pointPt: undefined,
              selectedPresetName: name || "Selected Field Boundary"
            });
          }}
          onPointChange={(pt, name) => {
            updateFormData({
              pointPt: pt,
              polygonPts: [],
              selectedPresetName: name || `Custom Pin (${pt[1].toFixed(4)}°N, ${pt[0].toFixed(4)}°E)`
            });
          }}
          initialPolygon={formData.polygonPts}
          initialAreaHa={formData.areaHa}
          selectedPoint={formData.pointPt}
          report={report}
          isPredicted={isPredicted}
        />

        {/* Map Side Panel: "Selected Field" & "Predict Now" CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={20} style={{ color: '#10b981' }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                  Selected Field
                </h3>
              </div>
              <span className="badge badge-high" style={{ fontSize: '0.74rem' }}>
                ✓ Location Selected
              </span>
            </div>

            {/* Coordinates & Season */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="summary-data-cell">
                <span className="cell-label">Latitude</span>
                <strong className="cell-val" style={{ color: '#38bdf8' }}>{centroidLat.toFixed(4)}°N</strong>
              </div>
              <div className="summary-data-cell">
                <span className="cell-label">Longitude</span>
                <strong className="cell-val" style={{ color: '#38bdf8' }}>{centroidLon.toFixed(4)}°E</strong>
              </div>
              <div className="summary-data-cell" style={{ gridColumn: 'span 2' }}>
                <span className="cell-label">Target Season</span>
                <select
                  className="form-control"
                  style={{ padding: '6px 10px', fontSize: '0.85rem', marginTop: '4px' }}
                  value={formData.season}
                  onChange={(e) => updateFormData({ season: e.target.value as any })}
                >
                  <option value="kharif">Kharif (Monsoon Season)</option>
                  <option value="rabi">Rabi (Winter Season)</option>
                  <option value="zaid">Zaid (Summer Season)</option>
                  <option value="annual">Annual / Perennial</option>
                </select>
              </div>
            </div>

            {/* EDITABLE GEODESIC PARCEL AREA WITH HUMAN-CHANGEABLE CONTROLS & DEFAULT */}
            <div className="summary-data-cell" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="cell-label" style={{ fontWeight: 600 }}>
                  Geodesic Parcel Area
                </span>
                <span style={{ fontSize: '0.7rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.12)', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                  Human-Editable
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="number"
                  id="parcel-area-ha-input"
                  min="0.1"
                  max="5000"
                  step="0.05"
                  value={formData.areaHa}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    updateFormData({ areaHa: isNaN(val) || val <= 0 ? 1.0 : Number(val.toFixed(2)) });
                  }}
                  className="form-control"
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 700,
                    color: 'var(--accent-green)',
                    padding: '8px 12px',
                    flex: 1
                  }}
                  title="Edit land parcel area in hectares"
                />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-muted)' }}>Hectares</span>
              </div>

              {/* Quick Human-Changeable Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', fontWeight: 600 }}>Quick Presets:</span>
                {[0.5, 1.0, 2.35, 5.0, 10.0].map((presetHa) => (
                  <button
                    key={presetHa}
                    type="button"
                    onClick={() => updateFormData({ areaHa: presetHa })}
                    className={`preset-area-chip ${formData.areaHa === presetHa ? 'active' : ''}`}
                    title={`Set parcel size to ${presetHa} Ha`}
                  >
                    {presetHa === 2.35 ? '2.35 Ha (Def)' : `${presetHa} Ha`}
                  </button>
                ))}
              </div>
            </div>

            {/* DETECTED LOCATION FROM EXTERNAL DATASETS (KAGGLE / ICAR) */}
            {detectedLocation && (
              <div className="detected-location-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Compass size={15} style={{ color: '#ec4899' }} />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em', color: '#ec4899', textTransform: 'uppercase' }}>
                      Detected Regional Agri Benchmark
                    </span>
                  </div>
                  <span className="badge badge-high" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                    {detectedLocation.source === 'reverse_geocoded' ? 'Detected District' : 'Global Benchmark'}
                  </span>
                </div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  {detectedLocation.displayName}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Agro-Climatic Zone: <strong style={{ color: '#38bdf8' }}>{detectedLocation.agroZone}</strong>
                </div>
                {detectedLocation.dominantCrops && detectedLocation.dominantCrops.length > 0 && (
                  <div style={{ fontSize: '0.73rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Regional benchmarks: {detectedLocation.dominantCrops.slice(0, 4).join(', ')}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <MapPin size={14} style={{ color: '#14b8a6', flexShrink: 0 }} />
              <span>
                Selection: <strong>{formData.selectedPresetName}</strong>
              </span>
            </div>

            {/* PROMINENT "PREDICT NOW" BUTTON */}
            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', padding: '14px 20px', fontSize: '1.05rem', fontWeight: 700 }}
                onClick={() => runPredictNow()}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Analysing Your Location...</span>
                  </>
                ) : (
                  <>
                    <Play size={18} />
                    <span>{isPredicted ? "Re-Run Location Analysis →" : "Predict Now →"}</span>
                  </>
                )}
              </button>
              <p style={{ fontSize: '0.74rem', color: '#9ca3af', textAlign: 'center', margin: '8px 0 0 0' }}>
                💡 Triggers Google Earth Engine, Sentinel-1/2, SoilGrids & NASA POWER.
              </p>
            </div>
          </div>

          {/* Quick Land Suitability Banner if available */}
          {report && (
            <SuitabilityBanner
              grade={report.land_suitability.grade}
              score={report.land_suitability.score}
              confidence={report.land_suitability.confidence}
              limitingFactors={report.land_suitability.limiting_factors}
            />
          )}
        </div>
      </div>

      {/* 2. PROCESSING STATE ("Analysing Your Field...") */}
      {loading && (
        <section className="glass-card processing-dock-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RefreshCw size={22} className="animate-spin" style={{ color: '#10b981' }} />
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  GeoAgri AI is Analysing Your Location...
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  Executing cloud Earth Observation models across selected parcel
                </span>
              </div>
            </div>

            {/* Dynamic Technology Status Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span className={`badge ${pipelineStageIndex > 2 ? 'badge-high' : pipelineStageIndex === 2 ? 'badge-moderate' : 'badge-low'}`} style={{ fontSize: '0.72rem' }}>
                Google Earth Engine: {pipelineStageIndex > 2 ? 'Complete ✓' : pipelineStageIndex === 2 ? '● Processing' : 'Waiting'}
              </span>
              <span className={`badge ${pipelineStageIndex > 3 ? 'badge-high' : pipelineStageIndex === 3 ? 'badge-moderate' : 'badge-low'}`} style={{ fontSize: '0.72rem' }}>
                Sentinel-1/2: {pipelineStageIndex > 3 ? 'Complete ✓' : pipelineStageIndex === 3 ? '● Processing' : 'Waiting'}
              </span>
              <span className={`badge ${pipelineStageIndex > 4 ? 'badge-high' : pipelineStageIndex === 4 ? 'badge-moderate' : 'badge-low'}`} style={{ fontSize: '0.72rem' }}>
                SoilGrids: {pipelineStageIndex > 4 ? 'Complete ✓' : pipelineStageIndex === 4 ? '● Processing' : 'Waiting'}
              </span>
              <span className={`badge ${pipelineStageIndex > 5 ? 'badge-high' : pipelineStageIndex === 5 ? 'badge-moderate' : 'badge-low'}`} style={{ fontSize: '0.72rem' }}>
                NASA POWER: {pipelineStageIndex > 5 ? 'Complete ✓' : pipelineStageIndex === 5 ? '● Processing' : 'Waiting'}
              </span>
              <span className={`badge ${pipelineStageIndex > 7 ? 'badge-high' : pipelineStageIndex >= 6 ? 'badge-moderate' : 'badge-low'}`} style={{ fontSize: '0.72rem' }}>
                Agronomic Models: {pipelineStageIndex > 7 ? 'Complete ✓' : pipelineStageIndex >= 6 ? '● Processing' : 'Waiting'}
              </span>
            </div>
          </div>

          {/* Sequential Progress Checklist */}
          <div className="processing-pipeline-list">
            {PIPELINE_STAGES.map((st) => {
              const isDone = pipelineStageIndex > st.id;
              const isCurrent = pipelineStageIndex === st.id;
              return (
                <div
                  key={st.id}
                  className={`pipeline-stage-row ${isDone ? 'done' : isCurrent ? 'current' : 'pending'}`}
                >
                  <div className="stage-status-icon">
                    {isDone ? (
                      <Check size={14} style={{ color: '#34d399' }} />
                    ) : isCurrent ? (
                      <RefreshCw size={14} className="animate-spin" style={{ color: '#fbbf24' }} />
                    ) : (
                      <span className="stage-num-dot">{st.id}</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ fontSize: '0.85rem', color: isDone || isCurrent ? '#ffffff' : '#64748b' }}>
                        {st.title}
                      </strong>
                      <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{st.source}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: isDone ? '#34d399' : isCurrent ? '#fbbf24' : '#64748b' }}>
                      {isDone ? "Completed ✓" : isCurrent ? `${st.description}...` : "Waiting"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. AFTER PREDICT NOW COMPLETES: POPULATE FULL FIELD RESULTS */}
      {isPredicted && report && env && sat && (
        <>
          {/* Completion Status Confirmation Bar */}
          <div className="analysis-complete-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={22} style={{ color: '#10b981' }} />
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Location Analysis Complete
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                  All 34 satellite, soil, and meteorological layers successfully processed for {centroidLat.toFixed(4)}°N, {centroidLon.toFixed(4)}°E.
                </span>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              onClick={() => startCropAnalysis()}
              style={{ padding: '10px 22px' }}
            >
              <span>Analyse All Crops</span>
              <ArrowRight size={17} />
            </button>
          </div>

          {/* Human-Understandable Environmental & Satellite Analysis */}
          <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={20} style={{ color: '#10b981' }} />
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                    Environmental & Satellite Analysis
                  </h2>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '4px 0 0 0' }}>
                  Raw Earth Observation numbers and SoilGrids layers converted into plain-language agronomic evaluations.
                </p>
              </div>
              <span className="badge badge-high" style={{ fontSize: '0.75rem' }}>
                ● GEE & SoilGrids Verified
              </span>
            </div>

            {/* 8 Human-Friendly Metric Cards */}
            <div className="human-metrics-grid">
              <MetricCard data={interpretNDVI(sat.ndvi)} />
              <MetricCard data={interpretNDMI(sat.ndmi)} />
              <MetricCard data={interpretNDWI(sat.ndwi)} />
              <MetricCard data={interpretRainfall(env.rainfall_mm)} />
              <MetricCard data={interpretTemperature(env.temp_mean_c)} />
              <MetricCard data={interpretPH(env.ph)} />
              <MetricCard data={interpretOrganicCarbon(env.organic_carbon_g_kg)} />
              <MetricCard data={interpretTerrain(sat.elevation, sat.slope)} />
            </div>

            {/* Expandable Technical GEE & SoilGrids & NASA Data Sections */}
            <div className="technical-gee-accordion">
              <button
                type="button"
                className="accordion-toggle-btn"
                onClick={() => setShowTechnicalData(!showTechnicalData)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Layers size={16} style={{ color: '#38bdf8' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    Satellite & GEE Data (Radar & Multispectral)
                  </span>
                </div>
                {showTechnicalData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showTechnicalData && (
                <div className="technical-gee-body">
                  <div className="tech-table-grid">
                    <div className="tech-item"><span className="tech-name">Sentinel-2 NDVI</span><span className="tech-val">{sat.ndvi.toFixed(4)}</span></div>
                    <div className="tech-item"><span className="tech-name">Sentinel-2 NDMI</span><span className="tech-val">{sat.ndmi.toFixed(4)}</span></div>
                    <div className="tech-item"><span className="tech-name">Sentinel-2 NDWI</span><span className="tech-val">{sat.ndwi.toFixed(4)}</span></div>
                    <div className="tech-item"><span className="tech-name">Sentinel-2 EVI</span><span className="tech-val">{sat.evi.toFixed(4)}</span></div>
                    <div className="tech-item"><span className="tech-name">Sentinel-2 SAVI</span><span className="tech-val">{sat.savi.toFixed(4)}</span></div>
                    <div className="tech-item"><span className="tech-name">Sentinel-1 VV</span><span className="tech-val">{sat.vv.toFixed(2)} dB</span></div>
                    <div className="tech-item"><span className="tech-name">Sentinel-1 VH</span><span className="tech-val">{sat.vh.toFixed(2)} dB</span></div>
                    <div className="tech-item"><span className="tech-name">SRTM Elevation</span><span className="tech-val">{sat.elevation.toFixed(1)} m</span></div>
                    <div className="tech-item"><span className="tech-name">SRTM Slope</span><span className="tech-val">{sat.slope.toFixed(2)}°</span></div>
                    <div className="tech-item"><span className="tech-name">TWI Index</span><span className="tech-val">{sat.twi.toFixed(2)}</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Technical SoilGrids Section */}
            <div className="technical-gee-accordion">
              <button
                type="button"
                className="accordion-toggle-btn"
                onClick={() => setShowSoilGridsData(!showSoilGridsData)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Droplet size={16} style={{ color: '#10b981' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    Technical SoilGrids Data (3D Depth Chemistry)
                  </span>
                </div>
                {showSoilGridsData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showSoilGridsData && (
                <div className="technical-gee-body">
                  <div className="tech-table-grid">
                    <div className="tech-item"><span className="tech-name">Topsoil pH (H2O)</span><span className="tech-val">{env.ph.toFixed(2)}</span></div>
                    <div className="tech-item"><span className="tech-name">Organic Carbon (SOC)</span><span className="tech-val">{env.organic_carbon_g_kg.toFixed(2)} g/kg</span></div>
                    <div className="tech-item"><span className="tech-name">Total Nitrogen</span><span className="tech-val">{env.nitrogen_g_kg.toFixed(2)} g/kg</span></div>
                    <div className="tech-item"><span className="tech-name">Extractable Phosphorus</span><span className="tech-val">{env.phosphorus_ppm.toFixed(1)} ppm</span></div>
                    <div className="tech-item"><span className="tech-name">Available Potassium</span><span className="tech-val">{env.potassium_ppm.toFixed(1)} ppm</span></div>
                    <div className="tech-item"><span className="tech-name">Clay Fraction</span><span className="tech-val">{env.texture_clay_pct.toFixed(1)}%</span></div>
                    <div className="tech-item"><span className="tech-name">Sand Fraction</span><span className="tech-val">{env.texture_sand_pct.toFixed(1)}%</span></div>
                    <div className="tech-item"><span className="tech-name">Silt Fraction</span><span className="tech-val">{env.texture_silt_pct.toFixed(1)}%</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* Technical NASA POWER Section */}
            <div className="technical-gee-accordion">
              <button
                type="button"
                className="accordion-toggle-btn"
                onClick={() => setShowNasaData(!showNasaData)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Activity size={16} style={{ color: '#f59e0b' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    NASA POWER Climate Data (30-Year Historical Regimes)
                  </span>
                </div>
                {showNasaData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showNasaData && (
                <div className="technical-gee-body">
                  <div className="tech-table-grid">
                    <div className="tech-item"><span className="tech-name">Seasonal Precipitation</span><span className="tech-val">{env.rainfall_mm.toFixed(1)} mm</span></div>
                    <div className="tech-item"><span className="tech-name">Mean Daily Temp</span><span className="tech-val">{env.temp_mean_c.toFixed(1)}°C</span></div>
                    <div className="tech-item"><span className="tech-name">Max Daily Temp (Tmax)</span><span className="tech-val">{env.temp_max_c.toFixed(1)}°C</span></div>
                    <div className="tech-item"><span className="tech-name">Min Daily Temp (Tmin)</span><span className="tech-val">{env.temp_min_c.toFixed(1)}°C</span></div>
                    <div className="tech-item"><span className="tech-name">Mean Relative Humidity</span><span className="tech-val">{env.humidity_pct.toFixed(1)}%</span></div>
                    <div className="tech-item"><span className="tech-name">Solar Radiation</span><span className="tech-val">{env.solar_radiation_mj_m2.toFixed(1)} MJ/m²</span></div>
                  </div>
                </div>
              )}
            </div>

            {/* 4th Technical Section: Technical Data (Feature Vector & Models) */}
            <div className="technical-gee-accordion">
              <button
                type="button"
                className="accordion-toggle-btn"
                onClick={() => setShowAllTechnicalData(!showAllTechnicalData)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Cpu size={16} style={{ color: '#a855f7' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    Technical Data (78-Layer Feature Vector & AI Model Engines)
                  </span>
                </div>
                {showAllTechnicalData ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showAllTechnicalData && (
                <div className="technical-gee-body">
                  <div className="tech-table-grid">
                    <div className="tech-item"><span className="tech-name">Feature Vector Length</span><span className="tech-val">78 Diagnostic Bands</span></div>
                    <div className="tech-item"><span className="tech-name">Coordinate Reference System</span><span className="tech-val">EPSG:4326 (WGS84 Geodesic)</span></div>
                    <div className="tech-item"><span className="tech-name">Model A: Land Suitability</span><span className="tech-val" style={{ color: '#34d399' }}>Active (FAO Framework)</span></div>
                    <div className="tech-item"><span className="tech-name">Model B: Quantile Yields</span><span className="tech-val" style={{ color: '#34d399' }}>Active (GBDT P10/P50/P90)</span></div>
                    <div className="tech-item"><span className="tech-name">Model C: Irrigation Demand</span><span className="tech-val" style={{ color: '#34d399' }}>Active (FAO-56 Water Balance)</span></div>
                    <div className="tech-item"><span className="tech-name">Model D: Intercrop Symbiosis</span><span className="tech-val" style={{ color: '#34d399' }}>Active (Synergy Boost Matrix)</span></div>
                    <div className="tech-item"><span className="tech-name">Model E: Agro-Climatic Risk</span><span className="tech-val" style={{ color: '#34d399' }}>Active (30-Year Extremes)</span></div>
                    <div className="tech-item"><span className="tech-name">Satellite Ingestion Engine</span><span className="tech-val">Google Earth Engine API</span></div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Irrigation & Climate Risk Cards */}
          <div className="diagnostics-two-col">
            <IrrigationPanel summary={report.irrigation_summary} />
            <ClimateRiskReport summary={report.climate_risk_summary} />
          </div>

          {/* Final CTA at Bottom of Page 2 */}
          <div className="page-bottom-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => goToStep(1)}
            >
              <ArrowLeft size={16} />
              <span>← Back to Workspace</span>
            </button>

            <button
              type="button"
              className="btn-primary"
              onClick={() => startCropAnalysis()}
              style={{ padding: '12px 28px', fontSize: '1rem' }}
            >
              <span>Analyse All Crops →</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* Initial state before Predict Now is clicked */}
      {!isPredicted && !loading && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <Compass size={36} style={{ color: '#10b981', margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#ffffff', margin: '0 0 6px 0' }}>
            Location Selected: Ready for Analysis
          </h3>
          <p style={{ color: '#9ca3af', fontSize: '0.85rem', maxWidth: '600px', margin: '0 auto 18px auto' }}>
            Adjust your parcel boundaries on the map above if needed, then click <strong>Predict Now</strong> to query Google Earth Engine, Sentinel radar, SoilGrids, and NASA POWER.
          </p>
          <button
            type="button"
            className="btn-primary"
            onClick={() => runPredictNow()}
            style={{ padding: '12px 28px', fontSize: '0.95rem' }}
          >
            <Play size={18} />
            <span>Predict Now →</span>
          </button>
        </div>
      )}
    </div>
  );
};
