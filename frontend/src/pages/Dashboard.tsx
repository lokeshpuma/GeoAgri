import React, { useState, useEffect } from 'react';
import { MapPin, Sliders, Play, RefreshCw, Layers, Sparkles, Sprout, Table as TableIcon } from 'lucide-react';
import { GeoAgriLogo } from '../components/GeoAgriLogo/GeoAgriLogo';
import { fetchFullReport, FullReportResponse, PredictRequestPayload } from '../api/client';
import { MapSelector } from '../components/MapSelector/MapSelector';
import { FieldSummaryCard } from '../components/FieldSummaryCard/FieldSummaryCard';
import { SuitabilityBanner } from '../components/SuitabilityBanner/SuitabilityBanner';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel/DiagnosticsPanel';
import { CropTable } from '../components/CropTable/CropTable';
import { YieldChart } from '../components/YieldChart/YieldChart';
import { IrrigationPanel } from '../components/IrrigationPanel/IrrigationPanel';
import { ClimateRiskReport } from '../components/ClimateRiskReport/ClimateRiskReport';
import { IntercropPanel } from '../components/IntercropPanel/IntercropPanel';
import { CropSuitabilityRanking } from '../components/CropSuitabilityRanking/CropSuitabilityRanking';
import { YieldComparisonChart } from '../components/YieldComparisonChart/YieldComparisonChart';
import { MultiCroppingTable } from '../components/MultiCroppingTable/MultiCroppingTable';

export const Dashboard: React.FC = () => {
  const [polygonPts, setPolygonPts] = useState<[number, number][]>([
    [78.4850, 17.3850],
    [78.4870, 17.3850],
    [78.4870, 17.3870],
    [78.4850, 17.3870],
    [78.4850, 17.3850]
  ]);
  const [pointPt, setPointPt] = useState<[number, number] | undefined>(undefined);
  const [areaHa, setAreaHa] = useState<number>(2.35);
  const [season, setSeason] = useState<"kharif" | "rabi" | "zaid" | "annual" | "perennial">("kharif");
  const [irrigationPref, setIrrigationPref] = useState<"rainfed" | "supplemental" | "full" | "">("");

  // Manual soil inputs
  const [phInput, setPhInput] = useState<string>("");
  const [socInput, setSocInput] = useState<string>("");

  const [activeView, setActiveView] = useState<'intercrop' | 'plan'>('intercrop');
  const [report, setReport] = useState<FullReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunAnalysis = async () => {
    setLoading(true);
    setError(null);

    const payload: PredictRequestPayload = {
      polygon: polygonPts.length > 0 ? polygonPts : undefined,
      point: pointPt,
      season: season,
      limit: 100,
      irrigation_preference: irrigationPref ? (irrigationPref as any) : null,
      manual_soil: (phInput || socInput) ? {
        ph: phInput ? parseFloat(phInput) : null,
        organic_carbon: socInput ? parseFloat(socInput) : null
      } : null
    };

    try {
      const res = await fetchFullReport(payload);
      setReport(res);
    } catch (err: any) {
      setError(err.message || "Failed to connect to GeoAgri AI backend server.");
    } finally {
      setLoading(false);
    }
  };

  // Initial auto-run on mount
  useEffect(() => {
    handleRunAnalysis();
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon" style={{ background: 'transparent' }}>
            <GeoAgriLogo size={28} />
          </div>
          <div>
            <h1 className="brand-title">GeoAgri AI</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Location-Driven Agricultural Intelligence (Global Edition)</span>
          </div>
        </div>

        <button onClick={handleRunAnalysis} disabled={loading} className="btn-primary">
          {loading ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
          {loading ? "Running Models A-E..." : "Run Analysis"}
        </button>
      </header>

      <main className="dashboard-container">
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', padding: '16px', borderRadius: '12px', color: '#f87171' }}>
            ⚠️ <strong>Error:</strong> {error}
          </div>
        )}

        {/* Top Controls & Map Grid */}
        <div className="top-grid">
          <MapSelector
            onPolygonChange={(pts, ha) => { setPolygonPts(pts); setAreaHa(ha); }}
            onPointChange={(pt) => setPointPt(pt)}
          />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <FieldSummaryCard
              areaHa={report ? report.field_summary.area_ha : areaHa}
              centroidLon={report ? report.field_summary.centroid_lon : 78.4860}
              centroidLat={report ? report.field_summary.centroid_lat : 17.3850}
              season={season}
              polygonValid={report ? report.field_summary.polygon_valid : true}
              usedFallbackBuffer={report ? report.field_summary.used_fallback_buffer : false}
            />

            {/* Filter Configuration Panel */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders style={{ color: '#f59e0b' }} size={20} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Agronomic Controls & Manual Overrides</h3>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Target Season</label>
                  <select
                    className="form-control"
                    value={season}
                    onChange={(e) => setSeason(e.target.value as any)}
                  >
                    <option value="kharif">Kharif (Monsoon)</option>
                    <option value="rabi">Rabi (Winter)</option>
                    <option value="zaid">Zaid (Summer)</option>
                    <option value="annual">Annual / Perennial</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Irrigation Preference</label>
                  <select
                    className="form-control"
                    value={irrigationPref}
                    onChange={(e) => setIrrigationPref(e.target.value as any)}
                  >
                    <option value="">Auto (Balanced)</option>
                    <option value="rainfed">Rainfed Preference</option>
                    <option value="supplemental">Supplemental Irrigation</option>
                    <option value="full">Full Irrigation</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Manual Soil pH (Override)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 6.8"
                    className="form-control"
                    value={phInput}
                    onChange={(e) => setPhInput(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Organic Carbon (g/kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="e.g. 12.0"
                    className="form-control"
                    value={socInput}
                    onChange={(e) => setSocInput(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Sections */}
        {report && (
          <>
            <SuitabilityBanner
              grade={report.land_suitability.grade}
              score={report.land_suitability.score}
              confidence={report.land_suitability.confidence}
              limitingFactors={report.land_suitability.limiting_factors}
            />

            <DiagnosticsPanel
              environment={report.environment}
              satellite={report.satellite_features}
            />

            <div className="middle-grid">
              <YieldChart crops={report.recommended_crops} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
                <IrrigationPanel summary={report.irrigation_summary} />
                <ClimateRiskReport summary={report.climate_risk_summary} />
                <IntercropPanel summary={report.intercrop_summary} />
              </div>
            </div>

            {/* View Mode Switcher */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setActiveView('intercrop')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  border: activeView === 'intercrop' ? '1px solid #10b981' : '1px solid var(--bg-card-border)',
                  background: activeView === 'intercrop' ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-card)',
                  color: activeView === 'intercrop' ? '#34d399' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                <Sprout size={18} />
                <span>Companion Intercropping Matrix</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveView('plan')}
                style={{
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  border: activeView === 'plan' ? '1px solid #3b82f6' : '1px solid var(--bg-card-border)',
                  background: activeView === 'plan' ? 'rgba(59, 130, 246, 0.2)' : 'var(--bg-card)',
                  color: activeView === 'plan' ? '#60a5fa' : '#9ca3af',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                }}
              >
                <TableIcon size={18} />
                <span>100+ Master Crop Plan</span>
              </button>
            </div>

            {/* Conditional Views */}
            {activeView === 'intercrop' ? (
              <>
                <CropSuitabilityRanking crops={report.recommended_crops} farmArea={report.field_summary.area_ha} />
                <YieldComparisonChart crops={report.recommended_crops} farmArea={report.field_summary.area_ha} />
                <MultiCroppingTable crops={report.recommended_crops} farmArea={report.field_summary.area_ha} />
              </>
            ) : (
              <CropTable crops={report.recommended_crops} />
            )}
          </>
        )}
      </main>
    </div>
  );
};
