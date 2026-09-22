import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  Sparkles,
  RotateCcw,
  HelpCircle,
  Compass,
  MapPin,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import { useWorkflow } from '../../context/WorkflowContext';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  quickChips?: string[];
}

export const AgriChatBot: React.FC = () => {
  const { isChatOpen, setIsChatOpen, report, formData, detectedLocation } = useWorkflow();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Active field metrics
  const centroidLat = report?.field_summary?.centroid_lat || formData.pointPt?.[0] || 13.2893;
  const centroidLon = report?.field_summary?.centroid_lon || formData.pointPt?.[1] || 75.9122;
  const areaHa = report?.field_summary?.area_ha || formData.areaHa || 2.85;
  const ndvi = report?.satellite_features?.ndvi ?? 0.59;
  const ndmi = report?.satellite_features?.ndmi ?? 0.23;
  const elevation = report?.satellite_features?.elevation ?? 940;
  const slope = report?.satellite_features?.slope ?? 2.8;
  const twi = report?.satellite_features?.twi ?? 7.8;
  const vv = report?.satellite_features?.vv ?? -10.4;
  const vh = report?.satellite_features?.vh ?? -16.2;
  const ph = report?.environment?.ph ?? 5.92;
  const soc = report?.environment?.organic_carbon_g_kg ?? 6.1;
  const rainfall = report?.environment?.rainfall_mm ?? 1053;
  const temp = report?.environment?.temp_mean_c ?? 23.1;
  const suitGrade = report?.land_suitability?.grade ?? 'High';
  const suitScore = Math.round((report?.land_suitability?.score ?? 0.83) * 100);
  const suitConf = Math.round((report?.land_suitability?.confidence ?? 0.90) * 100);
  const topCropName = report?.recommended_crops?.[0]?.crop_name ?? 'Finger Millet (Ragi)';
  const topCropYield = report?.recommended_crops?.[0]?.expected_yield_t_ha?.p50 ?? 1.56;
  const locName = detectedLocation?.displayName || 'Detected Location';

  // Initialize greeting message on first open
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'msg-welcome',
          sender: 'bot',
          text: `👋 Hello! I am your **GeoAgri Explainable AI Advisor**.\n\nI can explain all the scientific, satellite, and agronomic terms used in this platform—in simple, plain English.\n\nAsk me anything or tap one of the quick topics below!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          quickChips: [
            "What is NDVI?",
            "What is Soil Organic Carbon (SOC)?",
            "Explain P10, P50 & P90 yields",
            "What is a Hectare and Tonnes/Ha?",
            "Explain my active field's values",
            "How does the 4-step workflow work?"
          ]
        }
      ]);
    }
  }, [messages.length]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isChatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [messages, isChatOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isChatOpen) {
        setIsChatOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChatOpen, setIsChatOpen]);

  /**
   * Explainable AI Knowledge Engine: matches queries to structured, plain-English explanations.
   */
  const generateExplainableAnswer = (query: string): string => {
    const q = query.toLowerCase().trim();

    // 1. NDVI (Normalized Difference Vegetation Index)
    if (q.includes('ndvi') || q.includes('vegetation index') || q.includes('greenness')) {
      return `### 🛰️ What is NDVI (Normalized Difference Vegetation Index)?

**Plain Definition:**
NDVI is a satellite measurement of **how green, dense, and healthy plants are** on your land. Healthy green plants reflect high amounts of Near-Infrared (NIR) light and absorb visible Red light for photosynthesis.

**Mathematical Formula:**
\`NDVI = (NIR - Red) / (NIR + Red)\`

**What the values mean (-1.0 to +1.0):**
- **< 0.0:** Open water bodies, snow, or clouds.
- **0.0 to 0.2:** Bare soil, dry sand, rocks, or paved roads.
- **0.2 to 0.4:** Sparse vegetation, early crop emergence, or arid rangeland.
- **0.4 to 0.6:** Developing crop canopy, pastures, or moderate biomass.
- **0.6 to 0.85+:** Dense, thriving, photosynthetically peak green crop canopy.

📍 **Your Active Field Value:**
Your parcel shows an **NDVI of ${ndvi.toFixed(2)}**, indicating **${ndvi >= 0.5 ? 'healthy, dense vegetative biomass' : 'moderate vegetation cover'}**.`;
    }

    // 2. NDMI / NDPI / Moisture
    if (q.includes('ndmi') || q.includes('ndpi') || q.includes('moisture index') || q.includes('leaf water')) {
      return `### 💧 What is NDMI (Normalized Difference Moisture Index)?

**Plain Definition:**
NDMI measures the **actual liquid water content inside crop leaves**. While NDVI looks at how green the leaves are, NDMI looks at how well-hydrated they are using Shortwave-Infrared (SWIR) satellite bands.

**Mathematical Formula:**
\`NDMI = (NIR - SWIR) / (NIR + SWIR)\`

**What the values mean (-1.0 to +1.0):**
- **< -0.2:** Severe canopy water stress or bare parched ground.
- **-0.2 to 0.1:** Low moisture, dry canopy, irrigation may be needed.
- **0.1 to 0.3:** Optimal canopy hydration for active vegetative growth.
- **> 0.3:** Very high moisture or water-saturated foliage.

📍 **Your Active Field Value:**
Your parcel has an **NDMI of ${ndmi.toFixed(2)}**, representing **${ndmi >= 0.15 ? 'adequate leaf hydration with low drought stress' : 'moderate leaf hydration'}**.`;
    }

    // 3. NDWI / Water Index
    if (q.includes('ndwi') || q.includes('water index') || q.includes('water body')) {
      return `### 🌊 What is NDWI (Normalized Difference Water Index)?

**Plain Definition:**
NDWI is designed to detect **open surface water bodies, irrigation ponds, and waterlogged soil**.

**Mathematical Formula:**
\`NDWI = (Green - NIR) / (Green + NIR)\`

**What the values mean:**
- **Positive values (> 0.0 to 1.0):** Open water surfaces (rivers, lakes, flooded rice paddies).
- **Negative values (< 0.0):** Terrestrial land, vegetation, and dry soil.

This metric is critical for identifying whether a selected coordinate is an arable terrestrial field or an unplantable water body.`;
    }

    // 4. Radar VV and VH Backscatter (Sentinel-1 SAR)
    if (q.includes('vv') || q.includes('vh') || q.includes('radar') || q.includes('sar') || q.includes('backscatter')) {
      return `### 📡 What is Sentinel-1 Radar Backscatter (VV & VH in dB)?

**Plain Definition:**
Unlike optical cameras, **Synthetic Aperture Radar (SAR)** fires microwave pulses that shoot straight through thick clouds, haze, and rain—day or night. The radar echo that bounces back to the satellite is measured in decibels (dB).

**The Two Polarizations:**
1. **VV (Vertical transmit / Vertical receive):**
   - Measures surface roughness, soil moisture, and ground dielectric properties.
   - Typical range: **-5 dB to -15 dB**.
2. **VH (Vertical transmit / Horizontal receive - Cross-polarization):**
   - Measures **volume scattering** caused by crop stems, canopy thickness, and vertical biomass structure.
   - Typical range: **-12 dB to -22 dB**.

📍 **Your Active Field Values:**
- **VV:** ${vv.toFixed(1)} dB (indicates firm soil surface with moderate moisture reflection)
- **VH:** ${vh.toFixed(1)} dB (indicates healthy vegetative canopy volume)`;
    }

    // 5. Soil Organic Carbon (SOC)
    if (q.includes('organic carbon') || q.includes('soc') || q.includes('carbon')) {
      return `### 🧪 What is Soil Organic Carbon (SOC in g/kg)?

**Plain Definition:**
Soil Organic Carbon is the **organic matter and decomposed plant humus in your topsoil**. It is the single most important indicator of soil health, microbial biodiversity, and natural moisture holding capacity.

**What the values mean (grams of carbon per kilogram of soil):**
- **< 5.0 g/kg:** Depleted / Degraded soil. Needs farmyard manure, compost, or biochar.
- **5.0 to 10.0 g/kg:** Moderate fertility. Supports standard cereals and millets.
- **10.0 to 20.0 g/kg:** High fertility. Excellent moisture retention and nutrient exchange.
- **> 20.0 g/kg:** Very rich organic soils (often seen in forest soils or black cotton soils).

📍 **Your Active Field Value:**
Your parcel has **${soc.toFixed(1)} g/kg SOC**, which is **${soc >= 10 ? 'high organic fertility' : soc >= 5 ? 'moderate fertility suitable for sustainable cropping' : 'low, recommend adding green manure'}**.`;
    }

    // 6. Soil pH
    if (q.includes('ph') || q.includes('acidity') || q.includes('alkalinity') || q.includes('soil ph')) {
      return `### 🧪 What is Soil pH?

**Plain Definition:**
Soil pH measures the **acidity or alkalinity of your soil** on a logarithmic scale from 0 to 14, where 7.0 is neutral.

**What the values mean:**
- **< 5.5 (Strongly Acidic):** Phosphorus becomes locked up; aluminum and manganese can become toxic to roots. Lime application recommended.
- **6.0 to 7.2 (Near Neutral):** **The Goldilocks zone for agriculture!** Maximum availability of Nitrogen, Phosphorus, Potassium, and micronutrients.
- **7.5 to 8.5 (Alkaline / Calcareous):** Zinc, iron, and boron become bound up. Gypsum or organic amendments recommended.

📍 **Your Active Field Value:**
Your parcel's topsoil pH is **${ph.toFixed(2)}**, which is **${ph >= 6.0 && ph <= 7.5 ? 'ideal and balanced for most commercial crops' : ph < 6.0 ? 'slightly acidic, favorable for millets, tea, coffee, and legumes' : 'alkaline'}**.`;
    }

    // 7. Hectare (ha / "Hector")
    if (q.includes('hectare') || q.includes('hector') || q.includes('ha') || q.includes('area')) {
      return `### 📐 What is a Hectare (ha)?

**Plain Definition:**
A **Hectare (ha)** is the standard metric international unit used for measuring land area in agriculture and forestry.

**Quick Conversions:**
- **1 Hectare** = **10,000 square meters (m²)**
- **1 Hectare** = **2.471 Acres**
- **1 Hectare** = **107,639 square feet**
- **100 Hectares** = **1 square kilometer (km²)**

📍 **Your Active Field Size:**
Your current geodesic parcel area is **${areaHa.toFixed(2)} Hectares** (which equals approximately **${(areaHa * 2.471).toFixed(2)} Acres** or **${Math.round(areaHa * 10000).toLocaleString()} m²**).`;
    }

    // 8. Tonnes per Hectare (t/ha)
    if (q.includes('tonne') || q.includes('tonnes') || q.includes('t/ha') || q.includes('yield') || q.includes('per hectare') || q.includes('hector p')) {
      return `### 🌾 What does Tonnes per Hectare (t/ha) mean?

**Plain Definition:**
**Tonnes per Hectare (t/ha)** measures crop **yield productivity**—how much weight of harvest you produce on one hectare of land.

**Quick Breakdown:**
- **1 Tonne** = **1,000 kilograms (kg)** = **2,204.6 lbs**
- **1 t/ha** = **1,000 kg per 10,000 m²** = **0.1 kg per square meter (100 g/m²)**
- **1 t/ha** ≈ **404.7 kg per Acre** ≈ **892 lbs per Acre**

**Example for your field:**
- Top ranked crop: **${topCropName}**
- Expected yield: **${topCropYield} t/ha**
- Total estimated parcel harvest: \`${topCropYield} t/ha × ${areaHa.toFixed(2)} ha\` = **${(topCropYield * areaHa).toFixed(2)} total tonnes** (${Math.round(topCropYield * areaHa * 1000).toLocaleString()} kg).`;
    }

    // 9. P10, P50, and P90 Uncertainty Bounds
    if (q.includes('p10') || q.includes('p50') || q.includes('p90') || q.includes('percentile') || q.includes('uncertainty')) {
      return `### 📊 What are P10, P50, and P90 Yield Predictions?

**Plain Definition:**
Agriculture is inherently subject to weather fluctuations. Instead of giving a single speculative guess, GeoAgri uses **probabilistic Bayesian AI** to output three scenario bounds:

1. **P10 (Pessimistic Scenario - 10th Percentile):**
   - Represents an **adverse season** (e.g. drought, heat wave, delayed monsoon, or pest pressure).
   - There is a **90% probability that your actual yield will be higher than this number**.
2. **P50 (Median Expected Scenario - 50th Percentile):**
   - The **most probable, baseline harvest forecast** under normal seasonal weather and standard farming practices.
3. **P90 (Optimistic Scenario - 90th Percentile):**
   - Represents a **bumper harvest season** with timely rainfall distribution, optimal sunshine, and full fertilizer efficiency.
   - Only a 10% chance of exceeding this ceiling.

This gives financial planners and farmers a clear risk-adjusted range for budgeting!`;
    }

    // 10. Elevation, Slope, and TWI (Topography)
    if (q.includes('elevation') || q.includes('slope') || q.includes('twi') || q.includes('terrain') || q.includes('altitude')) {
      return `### 🗺️ What are Elevation, Slope, and TWI?

**1. Elevation (${elevation} m above sea level):**
Derived from Copernicus/SRTM 30m satellite radar. Temperature cools by ~0.65°C for every 100m increase in elevation. It determines chilling hours and whether temperate or tropical crops thrive.

**2. Slope (${slope.toFixed(1)}° inclination):**
- **< 2°:** Flat terrain. Ideal for mechanization and flood/drip irrigation.
- **2° to 5°:** Gentle slope. Good natural drainage, low erosion risk.
- **> 8°:** Steep slope. Requires contour bunding, terraces, or agroforestry to prevent topsoil loss.

**3. TWI (Topographic Wetness Index - ${twi.toFixed(1)}):**
Measures where water accumulates in the landscape based on gravity and terrain curvature.
- **< 5:** High ridges, water drains away rapidly (drought prone).
- **6 to 8:** Well-drained balanced agricultural soils.
- **> 9:** Low-lying depressions and valley bottoms prone to waterlogging.`;
    }

    // 11. 4-Step Workflow
    if (q.includes('workflow') || q.includes('step') || q.includes('process') || q.includes('how to use') || q.includes('steps')) {
      return `### 🔄 The GeoAgri 4-Step Intelligence Workflow

1. **Step 1: Workspace Overview**
   - Global dashboard showing platform architecture, 34-satellite telemetry engine, and global field search.
2. **Step 2: Field Analysis (Location & Satellite)**
   - Click anywhere on the global map to place your parcel marker.
   - Automatically queries Sentinel-1 radar, Sentinel-2 optical, SoilGrids 250m, and NASA POWER.
   - Generates the **Land Suitability Assessment (Model A)**.
3. **Step 3: Crop Prediction (Multi-Crop & Yield)**
   - Ensemble ML ranks the top 5 multi-crops, 75:25 symbiotic intercrop pairings (+15% boost), and probabilistic yield distributions (P10/P50/P90).
4. **Step 4: Summary & Report (Full Intelligence)**
   - Comprehensive executive agronomic dossier and downloadable official PDF summary report.`;
    }

    // 12. Land Suitability Score & Confidence
    if (q.includes('suitability') || q.includes('confidence') || q.includes('grade') || q.includes('model a') || q.includes('score')) {
      return `### 🎯 Land Suitability Score & Diagnostic Confidence

**1. Land Suitability Score (${suitScore}% - ${suitGrade}):**
Evaluates whether this parcel can biophysically support agricultural crops by scoring 12 environmental layers:
- Soil texture, pH, organic carbon, and NPK nutrients.
- Thermal extremes, growing degree days, and frost risk.
- Rainfall sufficiency and seasonal water deficit.
- Slope stability and topographic drainage.

**2. Diagnostic Confidence (${suitConf}%):**
Measures the **cross-verification agreement** between satellite optical sensors (Sentinel-2), radar backscatter (Sentinel-1), and ground-calibrated agrometeorological databases.`;
    }

    // 13. Active Parcel Values Summary
    if (q.includes('my value') || q.includes('my field') || q.includes('parcel') || q.includes('current') || q.includes('active')) {
      return `### 📋 Your Active Field Telemetry Summary

📍 **Location:** ${locName} (${centroidLat.toFixed(4)}°N, ${centroidLon.toFixed(4)}°E)
📐 **Area:** ${areaHa.toFixed(2)} ha (~${(areaHa * 2.471).toFixed(2)} acres)

**🌱 Satellite Telemetry:**
- **NDVI:** ${ndvi.toFixed(2)} (${ndvi >= 0.5 ? 'Dense, healthy vegetative canopy' : 'Moderate vegetation cover'})
- **NDMI:** ${ndmi.toFixed(2)} (Good leaf cellular hydration)
- **Sentinel-1 Radar:** VV ${vv.toFixed(1)} dB / VH ${vh.toFixed(1)} dB

**🧪 Soil & Environment:**
- **Soil pH:** ${ph.toFixed(2)} (${ph >= 6.0 && ph <= 7.2 ? 'Near Neutral' : ph < 6.0 ? 'Slightly Acidic' : 'Alkaline'})
- **Soil Organic Carbon (SOC):** ${soc.toFixed(1)} g/kg
- **Seasonal Rainfall:** ${Math.round(rainfall)} mm
- **Mean Temperature:** ${temp.toFixed(1)}°C
- **Elevation:** ${elevation} meters MSL

**🌾 AI Decision Synthesis:**
- **Land Suitability:** ${suitGrade} (${suitScore}%)
- **Diagnostic Confidence:** ${suitConf}%
- **Rank #1 Recommended Crop:** ${topCropName} (Expected ${topCropYield} t/ha)`;
    }

    // 14. Climate & Climate Risk
    if (q.includes('climate') || q.includes('risk') || q.includes('drought') || q.includes('heat')) {
      return `### 🛡️ What is Climate Risk & Vulnerability?

**Plain Definition:**
GeoAgri analyzes 40-year historical climate patterns from NASA POWER to quantify the risk of seasonal weather hazards during crop growth stages.

**The Key Hazards Evaluated:**
- **Drought Stress Risk:** Likelihood of consecutive dry days exceeding root-zone water capacity.
- **Heat Stress Risk:** Frequency of temperatures exceeding the 35°C critical threshold during pollination.
- **Thermal Regime:** Daily temperature minimums and maximums affecting crop vegetative growth.

📍 **Your Active Field Risk Profile:**
- Overall Risk Level: **${report?.climate_risk_summary?.overall_risk_level || 'Low'}**
- Drought Stress Score: **${report?.climate_risk_summary?.drought_risk_score?.toFixed(0) || '6'}%**
- Heat Stress Score: **${report?.climate_risk_summary?.heat_risk_score?.toFixed(0) || '5'}%**`;
    }

    // 15. Companion Intercropping (+15%)
    if (q.includes('intercrop') || q.includes('companion') || q.includes('synergy') || q.includes('pairing') || q.includes('75:25')) {
      return `### 🤝 What is Symbiotic Companion Intercropping?

**Plain Definition:**
Instead of planting a single monoculture crop across 100% of your land, GeoAgri calculates a **75:25 spatial arrangement**:
- **75% Area:** High-value primary crop (e.g. ${topCropName}).
- **25% Area:** Nitrogen-fixing legume companion (e.g. Cowpea / Lobia).

**Why It Delivers +15% Higher Yields:**
1. **Atmospheric Nitrogen Fixation:** Legume root nodules convert atmospheric N₂ into bioavailable nitrates, feeding both crops.
2. **Canopy Layering:** Tall crops capture high-angle sunlight while low-lying companions shade the ground, conserving soil moisture.
3. **Pest Disruption:** Mixed plantings prevent insect pest epidemics common in vast monocultures.`;
    }

    // 16. Default Intelligent Fallback
    return `### 💡 Explainable AI Agricultural Overview

You asked about: **"${query}"**

In GeoAgri's Geospatial Decision Support System, all parameters are interconnected:
- **Satellite Spectral Indices (NDVI, NDMI, NDWI, EVI):** Measure surface greenness, chlorophyll, and canopy water stress.
- **Topography (Elevation, Slope, TWI):** Dictate gravitational runoff, waterlogging risk, and mechanized farm accessibility.
- **Soil Chemistry (pH, SOC, NPK, Texture):** Provide the nutritional and physical foundation for root development.
- **Crop Yields (P10, P50, P90 in t/ha):** Provide probabilistic yield forecasts under varying climatic conditions.

Would you like to explore one of these specific topics?
- Tap **"What is NDVI?"** to learn about vegetation indices.
- Tap **"Explain P10, P50 & P90"** for yield uncertainty bounds.
- Tap **"Explain my active field's values"** for your current parcel data.`;
  };

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputValue).trim();
    if (!text) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');

    // Generate explainable response
    setTimeout(() => {
      const answer = generateExplainableAnswer(text);
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: answer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickChips: [
          "What is NDVI?",
          "What is Soil Organic Carbon (SOC)?",
          "Explain P10, P50 & P90 yields",
          "What is a Hectare and Tonnes/Ha?",
          "Explain my active field's values"
        ]
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 200);
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        sender: 'bot',
        text: `🔄 Chat history reset.\n\nI am your **GeoAgri Explainable AI Advisor**. Ask me any question about technical terms, satellite indices, soil metrics, or your current parcel values!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        quickChips: [
          "What is NDVI?",
          "What is Soil Organic Carbon (SOC)?",
          "Explain P10, P50 & P90 yields",
          "What is a Hectare and Tonnes/Ha?",
          "Explain my active field's values"
        ]
      }
    ]);
  };

  if (!isChatOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="agri-chatbot-backdrop"
        onClick={() => setIsChatOpen(false)}
        aria-hidden="true"
      />

      {/* Slide-out Drawer */}
      <aside className="agri-chatbot-drawer" aria-label="GeoAgri Explainable AI Advisor">
        {/* Header */}
        <div className="agri-chatbot-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div className="agri-chatbot-avatar">
              <Bot size={22} style={{ color: '#10b981' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  Explainable AI Advisor
                </h3>
                <span className="copilot-pulse-dot" />
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Technical Terms • Satellite Indices • Agronomy
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <button
              type="button"
              className="chatbot-header-btn"
              onClick={handleResetChat}
              title="Reset conversation"
            >
              <RotateCcw size={15} />
            </button>
            <button
              type="button"
              className="chatbot-header-btn"
              onClick={() => setIsChatOpen(false)}
              title="Close Advisor (Esc)"
              aria-label="Close Advisor"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Active Context Banner */}
        <div className="agri-chatbot-context-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--text-main)' }}>
            <MapPin size={13} style={{ color: '#10b981', flexShrink: 0 }} />
            <span style={{ fontWeight: 600 }}>Active Field:</span>
            <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {locName} ({centroidLat.toFixed(2)}°N, {centroidLon.toFixed(2)}°E • {areaHa.toFixed(2)} ha)
            </span>
          </div>
        </div>

        {/* Messages Container */}
        <div className="agri-chatbot-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`agri-chat-bubble ${msg.sender === 'user' ? 'bubble-user' : 'bubble-bot'}`}
            >
              <div className="bubble-content">
                <div className="bubble-text">
                  {msg.text.split('\n\n').map((para, pIdx) => {
                    if (para.startsWith('###')) {
                      return (
                        <h4 key={pIdx} className="bot-heading">
                          {para.replace(/^###\s*/, '')}
                        </h4>
                      );
                    }
                    if (para.startsWith('**') && para.endsWith('**') && !para.includes('\n')) {
                      return (
                        <strong key={pIdx} className="bot-strong-lead">
                          {para.replace(/^\*\*|\*\*$/g, '')}
                        </strong>
                      );
                    }
                    const lines = para.split('\n');
                    return (
                      <p key={pIdx} className="bot-paragraph">
                        {lines.map((line, lIdx) => {
                          const isBullet = line.trim().startsWith('-');
                          const content = isBullet ? line.trim().substring(1).trim() : line;
                          const parts = content.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

                          return (
                            <span key={lIdx} style={{ display: isBullet ? 'block' : 'inline', marginLeft: isBullet ? '12px' : 0 }}>
                              {isBullet && <span style={{ color: '#10b981', marginRight: '6px' }}>•</span>}
                              {parts.map((part, idx) => {
                                if (part.startsWith('**') && part.endsWith('**')) {
                                  return <strong key={idx} style={{ color: 'var(--text-main)' }}>{part.slice(2, -2)}</strong>;
                                }
                                if (part.startsWith('`') && part.endsWith('`')) {
                                  return <code key={idx} className="bot-code-pill">{part.slice(1, -1)}</code>;
                                }
                                return part;
                              })}
                              {lIdx < lines.length - 1 && !isBullet && <br />}
                            </span>
                          );
                        })}
                      </p>
                    );
                  })}
                </div>

                {/* Footer with Timestamp and Copy */}
                <div className="bubble-meta">
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'bot' && (
                    <button
                      type="button"
                      className="btn-copy-bubble"
                      onClick={() => handleCopy(msg.id, msg.text)}
                      title="Copy explanation"
                    >
                      {copiedId === msg.id ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                      <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
                </div>

                {/* Quick Chips Suggestions */}
                {msg.quickChips && msg.quickChips.length > 0 && (
                  <div className="bubble-chips-wrapper">
                    <span className="chips-title">Suggested Inquiries:</span>
                    <div className="bubble-chips-list">
                      {msg.quickChips.map((chip, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          className="chip-btn"
                          onClick={() => handleSendMessage(chip)}
                        >
                          {chip}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form
          className="agri-chatbot-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="agri-chatbot-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about NDVI, SOC, elevation, P50, t/ha, workflow..."
            aria-label="Ask about technical terms"
          />
          <button
            type="submit"
            className="agri-chatbot-send-btn"
            disabled={!inputValue.trim()}
            title="Send inquiry"
          >
            <Send size={16} />
          </button>
        </form>
      </aside>
    </>
  );
};
