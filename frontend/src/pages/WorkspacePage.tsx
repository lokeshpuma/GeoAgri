import React, { useState, useEffect } from 'react';
import {
  MapPin,
  ArrowRight,
  Layers,
  Cpu,
  Satellite,
  Droplets,
  CloudSun,
  ShieldCheck,
  TrendingUp,
  FileText,
  Compass,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Award,
  Sprout,
} from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { GeoAgriLogo } from '../components/GeoAgriLogo/GeoAgriLogo';
import { Button } from '../ui/Button';
import { fetchHealthSources, HealthSourcesResponse } from '../api/client';

const HOW_IT_WORKS_STAGES = [
  {
    stage: 1,
    title: '1. Draw Field Boundary',
    tagline: 'Define your parcel extent on satellite basemap',
    description:
      'Search coordinates or draw your parcel corners directly on the MapLibre satellite basemap. Live geodesic calculation yields accurate area in hectares, acres, and guntas.',
    features: ['MapLibre satellite canvas', 'Live polygon vertices & edges', 'Instant geodesic area', 'GeoJSON export'],
    icon: MapPin,
    color: 'var(--emerald-500)',
  },
  {
    stage: 2,
    title: '2. Environmental Intelligence',
    tagline: 'Earth Observation satellites & soil physics',
    description:
      'GeoAgri queries live Google Earth Engine and OpenLandMap layers to compute real Sentinel-2 vegetation indices (NDVI, NDMI, NDWI, EVI), 3D soil depth chemistry, and NASA POWER climate history.',
    features: ['Sentinel-1/2 GEE radar & NDVI', 'Soil chemistry (pH, SOC, N-P-K)', 'NASA POWER meteorology', 'SRTM elevation & terrain slope'],
    icon: Satellite,
    color: 'var(--info)',
  },
  {
    stage: 3,
    title: '3. Machine Learning Crop Models',
    tagline: 'Multi-crop rankings & quantile yields',
    description:
      'Synchronized machine learning models evaluate capability, moisture balances, and climate risk to predict viable crops and companion intercrop pairings with P10/P50/P90 yields.',
    features: ['Land capability grading', 'Crop suitability ranking', 'Companion intercrop pairings', 'Yield forecasts (t/ha)'],
    icon: Cpu,
    color: 'var(--gold-500)',
  },
  {
    stage: 4,
    title: '4. Decision Dossier',
    tagline: 'Actionable advisory report & PDF',
    description:
      'Review ranked crop recommendations, companion planting schemas, seasonal water demand budgets, and export a clean intelligence report.',
    features: ['Companion yield synergies', 'Water demand schedules', 'Climate risk scorecard', 'Exportable intelligence report'],
    icon: FileText,
    color: 'var(--emerald-300)',
  },
];

const DATA_SOURCES = [
  {
    title: 'Google Earth Engine',
    subtitle: 'Sentinel-2 & Landsat Imagery',
    description: '10m multispectral optical imagery. Computes real-time NDVI, NDMI, NDWI, EVI, and SAVI vegetation health indices.',
    badge: 'Earth Observation',
    icon: Satellite,
    color: 'var(--emerald-500)',
  },
  {
    title: 'SoilGrids / OpenLandMap',
    subtitle: 'Global Soil Chemical Profiles',
    description: 'High-resolution spatial predictions of topsoil chemistry: pH (H2O), Soil Organic Carbon (SOC), available Nitrogen, Phosphorus, Potassium, and texture.',
    badge: 'Soil Profiles',
    icon: Droplets,
    color: 'var(--info)',
  },
  {
    title: 'NASA POWER Meteorology',
    subtitle: 'Agroclimatology Time-Series',
    description: 'Daily and long-term 12-month climatology records providing precipitation, thermal extremes, solar irradiance, and relative humidity for agro-climatic matching.',
    badge: 'Climate & Weather',
    icon: CloudSun,
    color: 'var(--gold-500)',
  },
  {
    title: 'FAO EcoCrop Database',
    subtitle: 'Global Crop Environmental Envelopes',
    description: 'Expert bioclimatic envelopes covering 2,033 global crop taxa: absolute and optimal thresholds for temperature, precipitation, and soil pH. Public FAO data used with attribution.',
    badge: 'FAO Data',
    icon: Sprout,
    color: 'var(--emerald-500)',
  },
  {
    title: 'Agronomic Models',
    subtitle: 'Ensemble Decision Engines',
    description: 'Integrated FAO framework suitability grading, gradient boosted crop ranking, quantile regression yield models, and companion crop compatibility.',
    badge: 'Agronomic ML',
    icon: Cpu,
    color: 'var(--emerald-300)',
  },
];

export const WorkspacePage: React.FC = () => {
  const { goToStep } = useWorkflow();
  const [showDetails, setShowDetails] = useState(false);
  const [sourcesHealth, setSourcesHealth] = useState<HealthSourcesResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    fetchHealthSources()
      .then(data => {
        if (isMounted) setSourcesHealth(data);
      })
      .catch(() => {
        // Backend offline or starting up
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="workspace-page-container">
      {/* Background Topo Contours SVG (PRD §6.6) */}
      <div
        aria-hidden="true"
        className="workspace-topo-bg"
      />

      {/* 1. IMMERSIVE HERO SECTION (ABOVE THE FOLD) */}
      <section className="workspace-hero">
        <div className="glass-panel workspace-hero-badge">
          <GeoAgriLogo size={18} />
          <span className="workspace-hero-badge-text">
            GeoAgri AI • Planetary Agricultural Intelligence
          </span>
        </div>

        <h1 className="type-display-hero workspace-hero-title">
          Turn Your Field Location Into{' '}
          <span className="workspace-hero-gradient-text">
            Agricultural Intelligence
          </span>
        </h1>

        <p className="type-body workspace-hero-desc">
          Calibrated satellite observations, soil physics, and machine learning models for verified field-level crop suitability and yield forecasting.
        </p>

        {/* Source Readiness Chips (PRD v3.4 §5.3) */}
        {sourcesHealth?.sources && (
          <div className="source-chips-row mb-4" role="status" aria-label="Data source readiness">
            <span
              className={`source-chip ${sourcesHealth.sources.earth_engine.initialized ? 'status-ok' : 'status-failed'}`}
              title={sourcesHealth.sources.earth_engine.initialized ? 'Earth Engine connected' : 'Earth Engine unconfigured'}
            >
              <span className={`chip-dot ${sourcesHealth.sources.earth_engine.initialized ? 'status-ok' : 'status-failed'}`} />
              Earth Engine: {sourcesHealth.sources.earth_engine.initialized ? 'Ready' : 'Unconfigured'}
            </span>
            <span
              className={`source-chip ${sourcesHealth.sources.nasa_power.status === 'ok' ? 'status-ok' : 'status-failed'}`}
              title={`NASA POWER: ${sourcesHealth.sources.nasa_power.status}`}
            >
              <span className={`chip-dot ${sourcesHealth.sources.nasa_power.status === 'ok' ? 'status-ok' : 'status-failed'}`} />
              NASA POWER: {sourcesHealth.sources.nasa_power.status === 'ok' ? 'Online' : 'Offline'}
            </span>
            <span
              className={`source-chip ${sourcesHealth.sources.soilgrids.status === 'ok' ? 'status-ok' : 'status-failed'}`}
              title={`SoilGrids mode: ${sourcesHealth.sources.soilgrids.mode}`}
            >
              <span className={`chip-dot ${sourcesHealth.sources.soilgrids.status === 'ok' ? 'status-ok' : 'status-failed'}`} />
              SoilGrids: Ready
            </span>
            <span
              className={`source-chip ${sourcesHealth.sources.rules.status === 'ok' ? 'status-ok' : 'status-failed'}`}
              title="Agronomic and regulatory rule files"
            >
              <span className={`chip-dot ${sourcesHealth.sources.rules.status === 'ok' ? 'status-ok' : 'status-failed'}`} />
              Rules: {sourcesHealth.sources.rules.status === 'ok' ? 'Loaded' : 'Missing'}
            </span>
            <span
              className={`source-chip ${sourcesHealth.sources.registry.status === 'ok' ? 'status-ok' : 'status-failed'}`}
              title={`${sourcesHealth.sources.registry.total_crops} crops registered`}
            >
              <span className={`chip-dot ${sourcesHealth.sources.registry.status === 'ok' ? 'status-ok' : 'status-failed'}`} />
              Registry: {sourcesHealth.sources.registry.total_crops} crops
            </span>
            <span
              className={`source-chip ${sourcesHealth.sources.models.status === 'ok' ? 'status-ok' : 'status-failed'}`}
              title="Predictive and quantile models"
            >
              <span className={`chip-dot ${sourcesHealth.sources.models.status === 'ok' ? 'status-ok' : 'status-failed'}`} />
              Models: {sourcesHealth.sources.models.status === 'ok' ? 'Ready' : 'Partial'}
            </span>
          </div>
        )}

        {/* Primary Call To Action (PRD §6.6: "Draw your land →" CTA to Step 2) */}
        <div className="workspace-cta-col">
          <Button
            variant="primary"
            size="lg"
            onClick={() => goToStep(2)}
            icon={<ArrowRight size={20} />}
            iconPosition="right"
            className="workspace-cta-button"
          >
            Draw your land →
          </Button>

          <span className="workspace-cta-note">
            No fake defaults • Real WGS84 geodesic coordinates • Interactive satellite studio
          </span>
        </div>

        {/* Value Proposition Highlights */}
        <div className="workspace-features-grid">
          <div className="glass-panel workspace-feature-card">
            <div className="workspace-feature-card-val text-emerald">
              100% Geodesic
            </div>
            <div className="workspace-feature-card-sub">
              Real parcel boundary calculation on WGS84 ellipsoid
            </div>
          </div>

          <div className="glass-panel workspace-feature-card">
            <div className="workspace-feature-card-val text-gold">
              Sentinel-2 & Radar
            </div>
            <div className="workspace-feature-card-sub">
              Live Google Earth Engine multispectral index extraction
            </div>
          </div>

          <div className="glass-panel workspace-feature-card">
            <div className="workspace-feature-card-val text-info">
              Quantile ML
            </div>
            <div className="workspace-feature-card-sub">
              P10 / P50 / P90 harvest yield forecasts & companion systems
            </div>
          </div>
        </div>

        {/* Collapsible Accordion Trigger */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="workspace-details-toggle"
        >
          <span>{showDetails ? 'Hide details' : 'See how it works & intelligence architecture'}</span>
          <ChevronDown
            size={18}
            className={`workspace-chevron ${showDetails ? 'open' : ''}`}
          />
        </button>
      </section>

      {/* 2. COLLAPSIBLE ARCHITECTURE SECTIONS (LAZY-RENDERED) */}
      {showDetails && (
        <div className="animate-fade-rise workspace-details-container">
          {/* How It Works Grid */}
          <section className="workspace-details-section">
            <div className="workspace-details-heading-group">
              <h2 className="type-title-1 workspace-details-title">
                Four-Stage Geospatial Workflow
              </h2>
              <p className="workspace-details-sub">
                How GeoAgri AI converts your polygon into comprehensive agronomic recommendations.
              </p>
            </div>

            <div className="workspace-stages-grid">
              {HOW_IT_WORKS_STAGES.map(s => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.stage}
                    className="glass-panel workspace-stage-card"
                  >
                    <div className="workspace-stage-icon-box">
                      <Icon size={20} className="text-emerald" />
                    </div>
                    <h3 className="workspace-stage-title">
                      {s.title}
                    </h3>
                    <p className="workspace-stage-desc">
                      {s.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Data Sources Grid */}
          <section>
            <div className="workspace-details-heading-group">
              <h2 className="type-title-1 workspace-details-title">
                Connected Planetary Datasets
              </h2>
              <p className="workspace-details-sub">
                Integrated Earth observation satellites, digital soil chemistry, and climate time-series.
              </p>
            </div>

            <div className="workspace-sources-grid">
              {DATA_SOURCES.map((ds, i) => {
                const Icon = ds.icon;
                return (
                  <div
                    key={i}
                    className="glass-panel workspace-source-card"
                  >
                    <div className="workspace-source-top">
                      <div className="workspace-source-icon-box">
                        <Icon size={18} className="text-emerald" />
                      </div>
                      <span className="workspace-source-badge">
                        {ds.badge}
                      </span>
                    </div>

                    <h3 className="workspace-source-title">
                      {ds.title}
                    </h3>
                    <p className="workspace-source-desc">
                      {ds.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
