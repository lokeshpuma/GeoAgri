import React from 'react';
import { Activity } from 'lucide-react';

interface DiagnosticsPanelProps {
  environment: {
    rainfall_mm: number;
    temp_max_c: number;
    temp_min_c: number;
    temp_mean_c: number;
    humidity_pct: number;
    solar_radiation_mj_m2: number;
    ph: number;
    organic_carbon_g_kg: number;
    nitrogen_g_kg: number;
    phosphorus_ppm: number;
    potassium_ppm: number;
    texture_clay_pct: number;
    texture_sand_pct: number;
    texture_silt_pct: number;
  };
  satellite: {
    ndvi: number;
    ndwi: number;
    evi: number;
    savi: number;
    ndmi: number;
    elevation: number;
    slope: number;
    twi: number;
    vv: number;
    vh: number;
  };
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({ environment, satellite }) => {
  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Activity style={{ color: '#14b8a6' }} size={20} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Environmental & Spectral Diagnostics (34 Base Layers)</h3>
      </div>

      <div className="diagnostics-grid">
        <div className="metric-box">
          <span className="metric-label">NDVI (Vegetation)</span>
          <span className="metric-value" style={{ color: '#34d399' }}>{satellite.ndvi.toFixed(2)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">NDWI (Moisture)</span>
          <span className="metric-value" style={{ color: '#38bdf8' }}>{satellite.ndwi.toFixed(2)}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Seasonal Rainfall</span>
          <span className="metric-value">{environment.rainfall_mm} mm</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Mean Temperature</span>
          <span className="metric-value">{environment.temp_mean_c}°C</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Topsoil pH</span>
          <span className="metric-value">{environment.ph}</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Organic Carbon</span>
          <span className="metric-value">{environment.organic_carbon_g_kg} g/kg</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Elevation / Slope</span>
          <span className="metric-value">{satellite.elevation.toFixed(0)}m / {satellite.slope.toFixed(1)}°</span>
        </div>
        <div className="metric-box">
          <span className="metric-label">Radar VV / VH</span>
          <span className="metric-value">{satellite.vv} / {satellite.vh}</span>
        </div>
      </div>
    </div>
  );
};
