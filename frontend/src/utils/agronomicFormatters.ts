/**
 * Agronomic Formatters & Interpretation Utilities
 * Converts raw GEE, SoilGrids, and meteorological metrics into
 * human-understandable labels, ratings, and agricultural implications.
 * Truthful handling: Never returns fake evaluations or interpretations for missing (null/undefined) data.
 */

export interface MetricInterpretation {
  label: string;
  value: string;
  rawValue: string;
  rating: "optimal" | "moderate" | "warning" | "neutral";
  interpretation: string;
  implication: string;
  unit?: string;
}

export function interpretNDVI(ndvi?: number | null): MetricInterpretation {
  if (ndvi == null || isNaN(ndvi)) {
    return {
      label: "Vegetation Health (NDVI)",
      value: "Not available",
      rawValue: "NDVI: N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Satellite vegetation index could not be retrieved for this field.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "moderate";
  let interpretation = "Moderate vegetation canopy";
  let implication = "Vegetation is actively growing with moderate biomass density. Good for early to mid-stage crops.";

  if (ndvi >= 0.6) {
    rating = "optimal";
    interpretation = "Healthy, vigorous vegetation";
    implication = "High photosynthetic activity and dense green biomass, indicating prime vegetative health.";
  } else if (ndvi >= 0.4) {
    rating = "optimal";
    interpretation = "Healthy vegetative cover";
    implication = "Adequate canopy cover for standard crop growth and grain filling.";
  } else if (ndvi >= 0.2) {
    rating = "warning";
    interpretation = "Sparse / early-stage growth";
    implication = "Low canopy density; typical for newly seeded fields, dry stubble, or emerging seedlings.";
  } else {
    rating = "warning";
    interpretation = "Barren or fallow surface";
    implication = "Minimal photosynthetic cover; field is likely fallow or post-harvest.";
  }

  return {
    label: "Vegetation Health (NDVI)",
    value: ndvi.toFixed(2),
    rawValue: `NDVI: ${ndvi.toFixed(3)}`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretNDMI(ndmi?: number | null): MetricInterpretation {
  if (ndmi == null || isNaN(ndmi)) {
    return {
      label: "Soil & Crop Moisture (NDMI)",
      value: "Not available",
      rawValue: "NDMI: N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Canopy moisture index could not be retrieved for this field.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "moderate";
  let interpretation = "Low–moderate moisture";
  let implication = "Canopy moisture is sufficient for moderate water-demand crops, but monitor dry spells.";

  if (ndmi >= 0.25) {
    rating = "optimal";
    interpretation = "High moisture content";
    implication = "Leaves and topsoil are well-hydrated; low vulnerability to short-term dry spells.";
  } else if (ndmi >= 0.1) {
    rating = "optimal";
    interpretation = "Adequate canopy moisture";
    implication = "Balanced moisture profile, supporting normal transpiration and nutrient uptake.";
  } else if (ndmi >= 0.0) {
    rating = "moderate";
    interpretation = "Low–moderate moisture";
    implication = "Slight water limitation; supplemental irrigation recommended during critical stages.";
  } else {
    rating = "warning";
    interpretation = "Moisture deficit / dry canopy";
    implication = "Plant water stress indicated; requires urgent irrigation or drought-tolerant crop selection.";
  }

  return {
    label: "Soil & Crop Moisture (NDMI)",
    value: ndmi.toFixed(2),
    rawValue: `NDMI: ${ndmi.toFixed(3)}`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretNDWI(ndwi?: number | null): MetricInterpretation {
  if (ndwi == null || isNaN(ndwi)) {
    return {
      label: "Water Availability (NDWI)",
      value: "Not available",
      rawValue: "NDWI: N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Surface water availability index could not be retrieved.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "moderate";
  let interpretation = "Moderate water index";
  let implication = "Balanced surface water balance without surface waterlogging risks.";

  if (ndwi >= 0.1) {
    rating = "optimal";
    interpretation = "High surface water presence";
    implication = "Abundant surface moisture; highly favorable for paddy and wetland farming.";
  } else if (ndwi >= -0.15) {
    rating = "moderate";
    interpretation = "Standard field drainage";
    implication = "Normal root zone aeration without ponding or excessive drought.";
  } else {
    rating = "warning";
    interpretation = "Low surface water level";
    implication = "Dry surface profile; well-drained but requires assured irrigation for sensitive crops.";
  }

  return {
    label: "Water Availability (NDWI)",
    value: ndwi.toFixed(2),
    rawValue: `NDWI: ${ndwi.toFixed(3)}`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretRainfall(rainfallMm?: number | null): MetricInterpretation {
  if (rainfallMm == null || isNaN(rainfallMm)) {
    return {
      label: "Seasonal Rainfall",
      value: "Not available",
      rawValue: "N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Seasonal precipitation data could not be retrieved.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "moderate";
  let interpretation = "Moderate seasonal rainfall";
  let implication = "Suitable for standard Kharif crops like maize, pulses, and rainfed cotton with good soil moisture.";

  if (rainfallMm > 900) {
    rating = "optimal";
    interpretation = "High seasonal precipitation";
    implication = "Strong water surplus; well suited for paddy, sugarcane, and perennial banana plantations.";
  } else if (rainfallMm >= 500) {
    rating = "optimal";
    interpretation = "Adequate seasonal rainfall";
    implication = "Good moisture regime for millets, pulses, oilseeds, and medium-duration cereals.";
  } else if (rainfallMm >= 300) {
    rating = "moderate";
    interpretation = "Low-moderate rainfall";
    implication = "Semi-arid regime; requires drought-hardy crops (sorghum, pearl millet, pulses) or irrigation.";
  } else {
    rating = "warning";
    interpretation = "Arid / Deficit rainfall";
    implication = "High crop risk under pure rainfed conditions; drip or furrow irrigation is mandatory.";
  }

  return {
    label: "Seasonal Rainfall",
    value: `${rainfallMm.toFixed(1)} mm`,
    rawValue: `${rainfallMm.toFixed(1)} mm`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretTemperature(tempMeanC?: number | null): MetricInterpretation {
  if (tempMeanC == null || isNaN(tempMeanC)) {
    return {
      label: "Average Temperature",
      value: "Not available",
      rawValue: "N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Thermal regime temperature could not be retrieved.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "optimal";
  let interpretation = "Optimal thermal range";
  let implication = "Favorable metabolic temperatures supporting broad tropical and sub-tropical crop development.";

  if (tempMeanC > 32) {
    rating = "warning";
    interpretation = "High heat stress regime";
    implication = "Extreme daytime heat may impact pollination and increase evapotranspiration losses.";
  } else if (tempMeanC >= 22) {
    rating = "optimal";
    interpretation = "Warm tropical growing climate";
    implication = "Ideal for C4 cereals (maize, sugarcane, sorghum), cotton, and tropical legumes.";
  } else if (tempMeanC >= 15) {
    rating = "optimal";
    interpretation = "Mild temperate/sub-tropical";
    implication = "Ideal for Rabi wheat, mustard, barley, and winter vegetables.";
  } else {
    rating = "moderate";
    interpretation = "Cool seasonal climate";
    implication = "Slower crop vegetative cycle; favors cool-season horticultural varieties.";
  }

  return {
    label: "Average Temperature",
    value: `${tempMeanC.toFixed(1)}°C`,
    rawValue: `${tempMeanC.toFixed(1)}°C`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretPH(ph?: number | null): MetricInterpretation {
  if (ph == null || isNaN(ph)) {
    return {
      label: "Topsoil pH",
      value: "Not available",
      rawValue: "N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Soil pH measurement could not be retrieved.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "optimal";
  let interpretation = "Optimal neutral soil";
  let implication = "Maximum availability of primary nutrients (N, P, K) and micronutrients for roots.";

  if (ph < 5.5) {
    rating = "warning";
    interpretation = "Strongly acidic soil";
    implication = "Potential aluminum/iron toxicity; agricultural liming recommended to raise pH.";
  } else if (ph < 6.5) {
    rating = "optimal";
    interpretation = "Slightly acidic / suitable for many crops";
    implication = "Excellent for legumes, tea, potato, maize, and diverse field crops.";
  } else if (ph <= 7.5) {
    rating = "optimal";
    interpretation = "Neutral to near-neutral";
    implication = "Prime agronomic condition; broad adaptability across cereal, cash, and horticultural crops.";
  } else if (ph <= 8.5) {
    rating = "moderate";
    interpretation = "Moderately alkaline (calcareous)";
    implication = "Common in black cotton Vertisols; zinc and iron micronutrient sprays may be needed.";
  } else {
    rating = "warning";
    interpretation = "Strongly alkaline / sodic";
    implication = "High salinity or sodium content; gypsum application and leaching advised.";
  }

  return {
    label: "Topsoil pH",
    value: ph.toFixed(2),
    rawValue: `pH ${ph.toFixed(2)}`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretOrganicCarbon(socGKg?: number | null): MetricInterpretation {
  if (socGKg == null || isNaN(socGKg)) {
    return {
      label: "Organic Carbon",
      value: "Not available",
      rawValue: "N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Soil organic carbon content could not be retrieved.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "moderate";
  let interpretation = "Moderate organic carbon";
  let implication = "Satisfactory soil structure; organic manures (FYM/compost) will boost microbial activity.";

  if (socGKg >= 10.0) {
    rating = "optimal";
    interpretation = "Good / Rich organic carbon level";
    implication = "High cation exchange capacity and water holding capacity; excellent natural fertility.";
  } else if (socGKg >= 6.0) {
    rating = "optimal";
    interpretation = "Medium organic carbon";
    implication = "Healthy biological activity supporting standard nutrient cycling.";
  } else {
    rating = "warning";
    interpretation = "Low organic carbon (< 0.6%)";
    implication = "Low soil humus; green manuring and cover cropping strongly recommended.";
  }

  return {
    label: "Organic Carbon",
    value: `${socGKg.toFixed(2)} g/kg`,
    rawValue: `${socGKg.toFixed(2)} g/kg`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretTerrain(elevation?: number | null, slope?: number | null): MetricInterpretation {
  if (elevation == null || slope == null || isNaN(elevation) || isNaN(slope)) {
    return {
      label: "Elevation & Slope",
      value: "Not available",
      rawValue: "N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Terrain elevation and slope metrics could not be retrieved.",
    };
  }

  let rating: "optimal" | "moderate" | "warning" | "neutral" = "optimal";
  let interpretation = "Gentle flat plain";
  let implication = "Ideal for tractor mechanization, laser leveling, and uniform furrow/flood irrigation.";

  if (slope > 8.0) {
    rating = "warning";
    interpretation = "Moderate to steep slope";
    implication = "Risk of soil erosion and fast water runoff; contour bunding or drip irrigation needed.";
  } else if (slope > 3.0) {
    rating = "moderate";
    interpretation = "Gently undulating slope";
    implication = "Good natural drainage with minimal erosion risk; suitable for raised bed planting.";
  }

  return {
    label: "Elevation & Slope",
    value: `${Math.round(elevation)}m / ${slope.toFixed(1)}°`,
    rawValue: `Elev: ${Math.round(elevation)}m, Slope: ${slope.toFixed(1)}°`,
    rating,
    interpretation,
    implication,
  };
}

export function interpretRadar(vv?: number | null, vh?: number | null): MetricInterpretation {
  if (vv == null || vh == null || isNaN(vv) || isNaN(vh)) {
    return {
      label: "Radar Backscatter (VV / VH)",
      value: "Not available",
      rawValue: "N/A",
      rating: "neutral",
      interpretation: "Not available",
      implication: "Sentinel-1 microwave penetration data could not be retrieved.",
    };
  }
  return {
    label: "Radar Backscatter (VV / VH)",
    value: `${vv.toFixed(1)} / ${vh.toFixed(1)} dB`,
    rawValue: `VV: ${vv.toFixed(2)} dB, VH: ${vh.toFixed(2)} dB`,
    rating: "neutral",
    interpretation: "Sentinel-1 microwave penetration",
    implication: "Confirms surface roughness and canopy structural density even through cloud cover.",
  };
}

/**
 * Generates a comprehensive, human-readable agricultural recommendation summary
 * synthesized directly from the field's real environmental, soil, and prediction data.
 */
export function generateAgronomicRecommendation(report: any): string {
  if (!report) return "";

  const env = report.environment || {};
  const sat = report.satellite_features || {};
  const suit = report.land_suitability || {};
  const irri = report.irrigation_summary || {};
  const risk = report.climate_risk_summary || {};
  const topCrops = report.recommended_crops?.slice(0, 5) || [];
  const topCrop = topCrops[0];

  const topNames = topCrops.map((c: any) => c.crop_name).join(", ");
  const companionOpt = topCrop?.intercrop_options?.[0];

  const companionBullet = companionOpt
    ? `- **Symbiotic Companion Pairing:** Intercropping with **${companionOpt.companion_crop_name}** in a ${Math.round((1 - companionOpt.companion_share_factor) * 100)}:${Math.round(companionOpt.companion_share_factor * 100)} spatial arrangement delivers a **+${(companionOpt.yield_boost_pct * 100).toFixed(1)}%** yield synergy via ${companionOpt.rationale || 'atmospheric nitrogen fixation and canopy layering'}.`
    : `- **Cropping Strategy:** Cultivated under **sole cropping (monoculture)** management; no symbiotic companion pairing indicated under current soil parameters.`;

  const ndviStr = sat.ndvi != null ? sat.ndvi.toFixed(2) : "N/A";
  const ndmiStr = sat.ndmi != null ? sat.ndmi.toFixed(2) : "N/A";
  const phStr = env.ph != null ? env.ph.toFixed(2) : "N/A";
  const socStr = env.organic_carbon_g_kg != null ? `${env.organic_carbon_g_kg.toFixed(1)} g/kg` : "N/A";
  const rainStr = env.rainfall_mm != null ? `${env.rainfall_mm.toFixed(0)} mm` : "N/A";
  const tempStr = env.temp_mean_c != null ? `${env.temp_mean_c.toFixed(1)}°C` : "N/A";
  const irriMode = irri.recommended_mode || "N/A";
  const riskLvl = risk.overall_risk_level || "Not assessed";

  return `Based on the selected location's satellite vegetation condition (NDVI: ${ndviStr}, NDMI: ${ndmiStr}), soil characteristics (pH: ${phStr}, SOC: ${socStr}), rainfall (${rainStr}), temperature (${tempStr}), moisture availability, irrigation feasibility (${irriMode}) and climate risk (${riskLvl}), the following crop combinations were ranked: **${topNames || 'No crops ranked'}**.

Your parcel demonstrates **${suit.grade || 'Standard'} Suitability (${suit.score != null ? Math.round(suit.score * 100) : 0}%)** with a **${suit.confidence != null ? Math.round(suit.confidence * 100) : 0}% diagnostic confidence**.

### Key Agronomic Action Plan:
- **Primary Cultivar Allocation:** **${topCrop?.crop_name || "Top Recommended Crop"}** ranks #1 with a **${topCrop?.recommendation_score != null ? Math.round(topCrop.recommendation_score * 100) : 0}% suitability score**, offering an expected median yield of **${topCrop?.expected_yield_t_ha?.p50 != null ? topCrop.expected_yield_t_ha.p50 : 'N/A'} tonnes/ha** (P10–P90 range: ${topCrop?.expected_yield_t_ha?.p10 ?? 'N/A'}–${topCrop?.expected_yield_t_ha?.p90 ?? 'N/A'} t/ha).
${companionBullet}
- **Irrigation Strategy:** Evaluated as **${(irri.recommended_mode || 'N/A').toUpperCase()}** with an estimated seasonal crop water requirement of **${irri.total_water_demand_m3 != null ? irri.total_water_demand_m3.toLocaleString() : 'N/A'} m³** against **${irri.effective_rainfall_mm ?? 'N/A'} mm** effective rainfall.
- **Climate Resilience:** Overall climatic vulnerability is **${risk.overall_risk_level || 'N/A'}** (Drought Stress: ${risk.drought_risk_score != null ? risk.drought_risk_score.toFixed(0) : 'N/A'}%, Heat Stress: ${risk.heat_risk_score != null ? risk.heat_risk_score.toFixed(0) : 'N/A'}%). Advisory: ${risk.note || 'None'}`;
}
