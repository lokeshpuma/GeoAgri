import React from 'react';
import {
  MapPin,
  Sparkles,
  ArrowRight,
  Layers,
  Cpu,
  Database,
  Satellite,
  Droplets,
  CloudSun,
  ShieldCheck,
  TrendingUp,
  FileText,
  Compass,
  CheckCircle2,
  ChevronRight,
  Activity,
  Award
} from 'lucide-react';
import { useWorkflow } from '../context/WorkflowContext';
import { GeoAgriLogo } from '../components/GeoAgriLogo/GeoAgriLogo';

const HOW_IT_WORKS_STAGES = [
  {
    stage: 1,
    title: "1. Select Location",
    tagline: "Pinpoint your parcel on the interactive map",
    description: "Choose any field location directly on the interactive map. Drop a pin or select boundaries to instantly capture WGS84 coordinates, centroid, and geodesic area.",
    features: ["Interactive MapLibre GL map", "Geodesic boundary ring", "Lat/Lon coordinate capture", "Instant parcel area (Ha)"],
    icon: MapPin,
    color: "#10b981",
  },
  {
    stage: 2,
    title: "2. Analyse the Land",
    tagline: "Multispectral satellite & soil synthesis",
    description: "GeoAgri AI queries Earth Observation satellites and global soil databases in real time. We extract vegetation indices, moisture indicators, 3D soil depth chemistry, and historical meteorological trends.",
    features: ["Sentinel-1/2 GEE radar & NDVI", "SoilGrids 250m (pH, SOC, N-P-K)", "NASA POWER rainfall & thermal", "SRTM 30m elevation & slope"],
    icon: Satellite,
    color: "#38bdf8",
  },
  {
    stage: 3,
    title: "3. Predict Crops",
    tagline: "Machine learning agronomic models",
    description: "Five synchronized AI engines evaluate land capability, water balances, and climatic resilience to rank suitable primary crops and symbiotic companion intercrops with yield forecasts.",
    features: ["Land suitability capability", "Crop-soil-climate matching", "Intercropping yield synergies", "P10/P50/P90 quantile yield bounds"],
    icon: Cpu,
    color: "#f59e0b",
  },
  {
    stage: 4,
    title: "4. Get Agricultural Intelligence",
    tagline: "Actionable decision support dossier",
    description: "Receive prioritized crop rankings, companion land allocation matrices, water demand schedules, climate risk advisories, and an exportable professional PDF report.",
    features: ["Top 5 companion pairings", "Top 10 yield predictions", "Irrigation & water balance", "Downloadable intelligence report"],
    icon: FileText,
    color: "#a855f7",
  },
];

const PIPELINE_NODES = [
  { name: "Location", icon: MapPin },
  { name: "Geospatial Data", icon: Compass },
  { name: "Satellite Analysis", icon: Satellite },
  { name: "Soil Analysis", icon: Droplets },
  { name: "Climate Analysis", icon: CloudSun },
  { name: "Land Suitability", icon: Award },
  { name: "Crop Recommendation", icon: Sparkles },
  { name: "Yield Prediction", icon: TrendingUp },
  { name: "Intercropping", icon: Layers },
  { name: "Agricultural Report", icon: FileText },
];

const DATA_SOURCES = [
  {
    title: "Google Earth Engine",
    subtitle: "Sentinel-1 & Sentinel-2 Satellites",
    description: "10-meter multispectral optical and C-band synthetic aperture radar (SAR) backscatter. Calculates real-time NDVI, NDMI, NDWI, EVI, and SAVI vegetation indices.",
    badge: "Satellite Observations",
    icon: Satellite,
    color: "#10b981",
  },
  {
    title: "ISRIC SoilGrids 250m",
    subtitle: "Global Automated Soil Mapping",
    description: "High-resolution spatial predictions of topsoil and subsoil chemical properties: pH (H2O), Soil Organic Carbon (SOC), available Nitrogen, Phosphorus, Potassium, and sand/silt/clay fractions.",
    badge: "Soil & Terrain Profiles",
    icon: Droplets,
    color: "#38bdf8",
  },
  {
    title: "NASA POWER Meteorology",
    subtitle: "Agroclimatology & Solar Energy",
    description: "30-year daily meteorological time-series providing historical precipitation, thermal extremes (Tmin/Tmax), solar irradiance, and relative humidity for agro-climatic zoning.",
    badge: "Climate & Weather Data",
    icon: CloudSun,
    color: "#f59e0b",
  },
  {
    title: "Global Agri & FAO GAEZ Datasets",
    subtitle: "Global Agro-Climatic Benchmarks",
    description: "Multi-decade global crop yields, USDA/Kaggle datasets, FAO Global Agro-Ecological Zones (GAEZ), and regional agronomic benchmarks mapped to coordinates for worldwide field baseline detection.",
    badge: "Global Datasets",
    icon: Database,
    color: "#ec4899",
  },
  {
    title: "Agronomic & ML Ensemble",
    subtitle: "Models A–E Decision Fusion",
    description: "Integrated FAO framework suitability grading, gradient boosted crop ranking, quantile regression yield models, and symbiotic intercropping compatibility algorithms.",
    badge: "Crop Suitability Models",
    icon: Cpu,
    color: "#a855f7",
  },
];

const USER_DELIVERABLES = [
  {
    title: "Land Suitability Assessment",
    description: "Understand whether your parcel is prime, moderate, or marginal for agriculture, backed by diagnostic confidence and limiting factor diagnostics.",
    icon: Award,
    color: "#10b981",
  },
  {
    title: "Environmental & Soil Health",
    description: "Translate complex satellite numbers into plain-language ratings for photosynthetic vigor, canopy moisture, soil pH, and fertility levels.",
    icon: Activity,
    color: "#38bdf8",
  },
  {
    title: "Irrigation & Water Balance",
    description: "Receive calculated seasonal crop water demand (m³) against effective rainfall to optimize rainfed vs supplemental irrigation schedules.",
    icon: Droplets,
    color: "#06b6d4",
  },
  {
    title: "Climate Risk Scorecard",
    description: "Identify vulnerability to seasonal meteorological risks: drought stress, heatwaves during flowering, and excess waterlogging hazards.",
    icon: ShieldCheck,
    color: "#f59e0b",
  },
  {
    title: "Multi-Crop & Companion System",
    description: "Discover optimal 75% primary crop + 25% companion intercrop pairings (e.g. Sugarcane + Cowpea) that boost total yield by +10% to +15%.",
    icon: Layers,
    color: "#ec4899",
  },
  {
    title: "Yield Predictions & Uncertainty",
    description: "Review predicted harvest potential with statistical uncertainty bounds (P10 pessimistic, P50 expected, P90 optimistic) in tonnes per hectare.",
    icon: TrendingUp,
    color: "#a855f7",
  },
];

export const WorkspacePage: React.FC = () => {
  const { goToStep } = useWorkflow();

  return (
    <div className="workspace-page-container">
      {/* 1. HERO SECTION */}
      <section className="workspace-hero">
        <div className="hero-badge">
          <GeoAgriLogo size={18} />
          <span>GeoAgri AI • Location-Driven Agricultural Intelligence</span>
        </div>

        <h1 className="hero-title">
          Turn Your Field Location Into <span className="text-gradient-teal">Agricultural Intelligence</span>
        </h1>

        <p className="hero-description">
          GeoAgri AI combines geospatial intelligence, satellite observations, soil profiles, climate data, and machine learning models to generate location-specific agricultural recommendations for your field.
        </p>

        {/* HERO CENTERED CTA BUTTON (FOR FASTER ACCESS) */}
        <div className="hero-cta-wrap" style={{ marginTop: '28px', display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn-primary cta-dominant-button"
            onClick={() => goToStep(2)}
            style={{
              padding: '16px 36px',
              fontSize: '1.1rem',
              fontWeight: 700,
              boxShadow: '0 4px 28px rgba(16, 185, 129, 0.45)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <span>Analyse Your Location</span>
            <ArrowRight size={22} />
          </button>
        </div>
      </section>

      {/* 2. HOW IT WORKS (4-STAGE PROCESS) */}
      <section className="workflow-info-section">
        <div className="info-section-header">
          <span className="step-tag">END-TO-END WORKFLOW</span>
          <h2 className="info-section-title">How GeoAgri AI Works</h2>
          <p className="info-section-subtitle">
            Four streamlined stages convert raw field coordinates into actionable crop and yield intelligence.
          </p>
        </div>

        <div className="how-it-works-grid">
          {HOW_IT_WORKS_STAGES.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.stage} className="how-card glass-card">
                <div className="how-card-top">
                  <div className="how-icon-box" style={{ background: `${s.color}20`, color: s.color }}>
                    <Icon size={22} />
                  </div>
                  <span className="how-stage-number" style={{ color: s.color }}>
                    STAGE 0{s.stage}
                  </span>
                </div>

                <h3 className="how-card-title">{s.title}</h3>
                <span className="how-card-tagline">{s.tagline}</span>
                <p className="how-card-desc">{s.description}</p>

                <ul className="how-card-features">
                  {s.features.map((f, idx) => (
                    <li key={idx}>
                      <CheckCircle2 size={13} style={{ color: s.color, flexShrink: 0 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. VISUAL AI PIPELINE */}
      <section className="workflow-info-section">
        <div className="info-section-header">
          <span className="step-tag">INTELLIGENCE ARCHITECTURE</span>
          <h2 className="info-section-title">The Geospatial AI Pipeline</h2>
          <p className="info-section-subtitle">
            Seamless multi-layered data ingestion and decision fusion engine.
          </p>
        </div>

        <div className="pipeline-flow-container glass-card">
          <div className="pipeline-flow-grid">
            {PIPELINE_NODES.map((node, i) => {
              const Icon = node.icon;
              return (
                <React.Fragment key={i}>
                  <div className="pipeline-node-chip">
                    <div className="pipeline-node-icon">
                      <Icon size={16} />
                    </div>
                    <span className="pipeline-node-name">{node.name}</span>
                  </div>
                  {i < PIPELINE_NODES.length - 1 && (
                    <div className="pipeline-flow-arrow">
                      <ChevronRight size={14} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. DATA & INTELLIGENCE SOURCES */}
      <section className="workflow-info-section">
        <div className="info-section-header">
          <span className="step-tag">FOUNDATIONAL DATASETS</span>
          <h2 className="info-section-title">Data & Intelligence Sources</h2>
          <p className="info-section-subtitle">
            Calibrated on global earth observation satellites, digital soil atlases, and meteorological archives.
          </p>
        </div>

        <div className="data-sources-grid">
          {DATA_SOURCES.map((ds, i) => {
            const Icon = ds.icon;
            return (
              <div key={i} className="source-card glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div className="source-icon-box" style={{ color: ds.color, background: `${ds.color}15` }}>
                    <Icon size={20} />
                  </div>
                  <span className="source-badge" style={{ color: ds.color, borderColor: `${ds.color}35`, background: `${ds.color}10` }}>
                    {ds.badge}
                  </span>
                </div>

                <h3 className="source-title">{ds.title}</h3>
                <span className="source-subtitle">{ds.subtitle}</span>
                <p className="source-desc">{ds.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. WHAT YOU WILL RECEIVE */}
      <section className="workflow-info-section">
        <div className="info-section-header">
          <span className="step-tag">INTELLIGENCE DELIVERABLES</span>
          <h2 className="info-section-title">What You Will Receive</h2>
          <p className="info-section-subtitle">
            Comprehensive field diagnostics and crop forecasts delivered across the workflow.
          </p>
        </div>

        <div className="deliverables-grid">
          {USER_DELIVERABLES.map((d, i) => {
            const Icon = d.icon;
            return (
              <div key={i} className="deliverable-card glass-card">
                <div className="deliverable-icon-slot" style={{ color: d.color, background: `${d.color}15` }}>
                  <Icon size={20} />
                </div>
                <div>
                  <h4 className="deliverable-title">{d.title}</h4>
                  <p className="deliverable-desc">{d.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. SINGLE DOMINANT BOTTOM CTA */}
      <section className="workspace-cta-dock glass-card">
        <div className="cta-content-block">
          <span className="step-tag">READY TO BEGIN</span>
          <h2 className="cta-dock-title">Ready to analyse your field location?</h2>
          <p className="cta-dock-subtitle">
            Select a location on the interactive map and let GeoAgri AI perform the complete satellite and agronomic analysis.
          </p>
        </div>

        <button
          type="button"
          className="btn-primary cta-dominant-button"
          onClick={() => goToStep(2)}
        >
          <span>Analyse Your Location</span>
          <ArrowRight size={20} />
        </button>
      </section>
    </div>
  );
};
