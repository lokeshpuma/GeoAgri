import React, { useState } from 'react';
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
} from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { GeoAgriLogo } from '../components/GeoAgriLogo/GeoAgriLogo';
import { Button } from '../ui/Button';

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
    description: 'Daily meteorological records providing precipitation, thermal extremes (Tmin/Tmax), solar irradiance, and relative humidity for agro-climatic matching.',
    badge: 'Climate & Weather',
    icon: CloudSun,
    color: 'var(--gold-500)',
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

  return (
    <div className="workspace-page-container" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Background Topo Contours SVG (PRD §6.6) */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '600px',
          opacity: 0.08,
          pointerEvents: 'none',
          backgroundImage: `radial-gradient(circle at 50% 30%, transparent 20%, var(--bg-0) 75%), url("data:image/svg+xml,%3Csvg width='800' height='800' viewBox='0 0 800 800' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,400 Q200,250 400,400 T800,400' fill='none' stroke='%2322c58b' stroke-width='1.5'/%3E%3Cpath d='M0,450 Q200,300 400,450 T800,450' fill='none' stroke='%2322c58b' stroke-width='1.5'/%3E%3Cpath d='M0,500 Q200,350 400,500 T800,500' fill='none' stroke='%2322c58b' stroke-width='1.5'/%3E%3Cpath d='M0,350 Q200,200 400,350 T800,350' fill='none' stroke='%23d9ad4f' stroke-width='1.2'/%3E%3Cpath d='M0,300 Q200,150 400,300 T800,300' fill='none' stroke='%23d9ad4f' stroke-width='1.2'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* 1. IMMERSIVE HERO SECTION (ABOVE THE FOLD) */}
      <section
        className="workspace-hero"
        style={{
          minHeight: '75vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 24px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          className="glass-panel"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 16px',
            borderRadius: 'var(--r-pill)',
            marginBottom: '24px',
            boxShadow: 'var(--elev-1)',
          }}
        >
          <GeoAgriLogo size={18} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-2)' }}>
            GeoAgri AI • Planetary Agricultural Intelligence
          </span>
        </div>

        <h1
          className="type-display-hero"
          style={{
            maxWidth: '900px',
            margin: '0 auto 20px auto',
            color: 'var(--ink-1)',
          }}
        >
          Turn Your Field Location Into{' '}
          <span
            style={{
              background: 'var(--grad-brand)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Agricultural Intelligence
          </span>
        </h1>

        <p
          className="type-body"
          style={{
            maxWidth: '680px',
            margin: '0 auto 36px auto',
            color: 'var(--ink-2)',
            fontSize: '1.125rem',
            lineHeight: 1.6,
          }}
        >
          Calibrated satellite observations, soil physics, and machine learning models for verified field-level crop suitability and yield forecasting.
        </p>

        {/* Primary Call To Action (PRD §6.6: "Draw your land →" CTA to Step 2) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <Button
            variant="primary"
            size="lg"
            onClick={() => goToStep(2)}
            icon={<ArrowRight size={20} />}
            iconPosition="right"
            style={{
              padding: '16px 40px',
              fontSize: '1.0625rem',
              boxShadow: '0 0 28px var(--emerald-glow), var(--elev-2)',
            }}
          >
            Draw your land →
          </Button>

          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-3)' }}>
            No fake defaults • Real WGS84 geodesic coordinates • Interactive satellite studio
          </span>
        </div>

        {/* Value Proposition Highlights */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            maxWidth: '780px',
            width: '100%',
            marginTop: '56px',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '16px',
              textAlign: 'center',
              background: 'var(--glass)',
            }}
          >
            <div style={{ color: 'var(--emerald-500)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              100% Geodesic
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '4px' }}>
              Real parcel boundary calculation on WGS84 ellipsoid
            </div>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: '16px',
              textAlign: 'center',
              background: 'var(--glass)',
            }}
          >
            <div style={{ color: 'var(--gold-500)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              Sentinel-2 & Radar
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '4px' }}>
              Live Google Earth Engine multispectral index extraction
            </div>
          </div>

          <div
            className="glass-panel"
            style={{
              padding: '16px',
              textAlign: 'center',
              background: 'var(--glass)',
            }}
          >
            <div style={{ color: 'var(--info)', fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
              Quantile ML
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-3)', marginTop: '4px' }}>
              P10 / P50 / P90 harvest yield forecasts & companion systems
            </div>
          </div>
        </div>

        {/* Collapsible Accordion Trigger */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={{
            marginTop: '48px',
            background: 'none',
            border: 'none',
            color: 'var(--ink-2)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>{showDetails ? 'Hide details' : 'See how it works & intelligence architecture'}</span>
          <ChevronDown
            size={18}
            style={{
              transform: showDetails ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform var(--t-fast) var(--ease-out)',
            }}
          />
        </button>
      </section>

      {/* 2. COLLAPSIBLE ARCHITECTURE SECTIONS (LAZY-RENDERED) */}
      {showDetails && (
        <div className="animate-fade-rise" style={{ maxWidth: '1100px', margin: '0 auto 80px auto', padding: '0 24px' }}>
          {/* How It Works Grid */}
          <section style={{ marginBottom: '60px' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 className="type-title-1" style={{ color: 'var(--ink-1)', margin: 0 }}>
                Four-Stage Geospatial Workflow
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-3)', marginTop: '6px' }}>
                How GeoAgri AI converts your polygon into comprehensive agronomic recommendations.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {HOW_IT_WORKS_STAGES.map(s => {
                const Icon = s.icon;
                return (
                  <div
                    key={s.stage}
                    className="glass-panel"
                    style={{
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--r-sm)',
                        background: 'var(--bg-2)',
                        color: s.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink-1)', margin: 0 }}>
                      {s.title}
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                      {s.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Data Sources Grid */}
          <section>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 className="type-title-1" style={{ color: 'var(--ink-1)', margin: 0 }}>
                Connected Planetary Datasets
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-3)', marginTop: '6px' }}>
                Integrated Earth observation satellites, digital soil chemistry, and climate time-series.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
              {DATA_SOURCES.map((ds, i) => {
                const Icon = ds.icon;
                return (
                  <div
                    key={i}
                    className="glass-panel"
                    style={{
                      padding: '24px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: 'var(--r-xs)',
                          background: 'var(--bg-2)',
                          color: ds.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Icon size={18} />
                      </div>
                      <span
                        style={{
                          fontSize: '0.6875rem',
                          padding: '2px 8px',
                          borderRadius: 'var(--r-pill)',
                          background: 'var(--bg-2)',
                          color: 'var(--ink-2)',
                          border: '1px solid var(--glass-border)',
                        }}
                      >
                        {ds.badge}
                      </span>
                    </div>

                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--ink-1)', margin: 0 }}>
                      {ds.title}
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--ink-3)', lineHeight: 1.5, margin: 0 }}>
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
