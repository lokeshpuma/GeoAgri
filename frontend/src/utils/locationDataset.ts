/**
 * Global Agricultural Region Dataset & Worldwide Land Detection Engine.
 * Sourced from FAO Global Agro-Ecological Zones (GAEZ v4), USDA Foreign Agricultural Service,
 * ICAR 15 Agro-Climatic Zones, and Kaggle Global Crop Production Datasets.
 * 
 * Maps any (latitude, longitude) coordinate globally to its nearest agricultural zone,
 * country, province/state, primary soil order, and authentic benchmark crops.
 */

export interface AgriculturalLocation {
  district: string;
  state: string;
  country: string;
  lat: number;
  lon: number;
  agroZone: string;
  primarySoil: string;
  rainfallRegime: string;
  dominantCrops: string[];
}

export interface DetectedLocationResult {
  district: string;
  state: string;
  country: string;
  displayName: string;
  agroZone: string;
  primarySoil: string;
  dominantCrops: string[];
  distanceKm: number;
  source: 'global_agri_dataset' | 'kaggle_icar_dataset' | 'reverse_geocoded';
}

/**
 * Curated benchmark dataset of primary agricultural zones across all continents.
 */
export const GLOBAL_AGRI_REGIONS: AgriculturalLocation[] = [
  // 1. Karnataka, India (DEFAULT PINPOINT - Western Ghats & Southern Dry Zone)
  {
    district: "Chikmagalur / Hassan",
    state: "Karnataka",
    country: "India",
    lat: 13.3200,
    lon: 75.7500,
    agroZone: "Western Ghats & Southern Hills (Karnataka High-Elevation Zone)",
    primarySoil: "Lateritic Loams & Humic Red Soils",
    rainfallRegime: "1200–2200 mm (Southwest Monsoonal)",
    dominantCrops: ["Finger Millet (Ragi)", "Coffee (Arabica/Robusta)", "Arecanut", "Paddy (Rice)", "Black Pepper", "Cardamom"]
  },
  {
    district: "Mandya / Mysore",
    state: "Karnataka",
    country: "India",
    lat: 12.5222,
    lon: 76.8970,
    agroZone: "Southern Dry Agricultural Zone (Cauvery Basin)",
    primarySoil: "Red Sandy Loams & Alluvial Clay",
    rainfallRegime: "700–900 mm",
    dominantCrops: ["Finger Millet (Ragi)", "Paddy", "Sugarcane", "Coconut", "Maize"]
  },
  {
    district: "Dharwad / Belagavi",
    state: "Karnataka",
    country: "India",
    lat: 15.4589,
    lon: 75.0078,
    agroZone: "Northern Transition & Malaprabha Basin",
    primarySoil: "Medium to Deep Black Vertisols",
    rainfallRegime: "750–950 mm",
    dominantCrops: ["Bengal Gram (Chickpea)", "Soybean", "Maize", "Cotton", "Sorghum (Jowar)"]
  },
  {
    district: "Shimoga / Malnad",
    state: "Karnataka",
    country: "India",
    lat: 13.9299,
    lon: 75.5681,
    agroZone: "Hilly Zone (Malnad Agro-Ecology)",
    primarySoil: "Acidic Laterites & Red Clay",
    rainfallRegime: "1500–2800 mm",
    dominantCrops: ["Arecanut", "Paddy", "Ginger", "Black Pepper", "Rubber"]
  },

  // 2. California & Western United States
  {
    district: "Fresno / San Joaquin Valley",
    state: "California",
    country: "United States",
    lat: 36.7500,
    lon: -120.2500,
    agroZone: "Mediterranean Irrigated Arid Valley (Central Valley)",
    primarySoil: "Deep Alluvial Entisols & Calcareous Aridisols",
    rainfallRegime: "250–350 mm (Canal & Well Irrigated)",
    dominantCrops: ["Almonds", "Wine Grapes", "Processing Tomatoes", "Pistachios", "Citrus (Oranges)", "Walnuts"]
  },
  {
    district: "Salinas Valley / Monterey",
    state: "California",
    country: "United States",
    lat: 36.6777,
    lon: -121.6555,
    agroZone: "Coastal Cool Mediterranean (Salinas Salad Bowl)",
    primarySoil: "Fertile Fluvisols & Clay Loam",
    rainfallRegime: "350–450 mm (Marine Fog Assisted)",
    dominantCrops: ["Lettuce", "Strawberries", "Broccoli", "Wine Grapes", "Celery"]
  },
  {
    district: "Yakima Valley",
    state: "Washington",
    country: "United States",
    lat: 46.6021,
    lon: -120.5059,
    agroZone: "Pacific Northwest Semiarid Irrigated Basin",
    primarySoil: "Volcanic Loess & Sandy Loam",
    rainfallRegime: "200–300 mm (Cascade Rain Shadow)",
    dominantCrops: ["Apples", "Hops", "Sweet Cherries", "Wine Grapes", "Pears"]
  },

  // 3. Egypt & North Africa
  {
    district: "Gharbia / Tanta (Nile Delta)",
    state: "Gharbia",
    country: "Egypt",
    lat: 30.7500,
    lon: 31.2500,
    agroZone: "Lower Nile Delta Alluvial Agro-Ecosystem",
    primarySoil: "Deep Vertic Fluvisols (Ancient Nile Silt)",
    rainfallRegime: "50–120 mm (100% Perennial Nile Irrigation)",
    dominantCrops: ["Egyptian Cotton (Long-Staple)", "Durum Wheat", "Berseem (Egyptian Clover)", "Rice", "Fava Beans", "Maize"]
  },
  {
    district: "Kafr El Sheikh",
    state: "Kafr El Sheikh",
    country: "Egypt",
    lat: 31.1107,
    lon: 30.9388,
    agroZone: "Northern Nile Delta Coastal Lacustrine",
    primarySoil: "Saline-affected Silt Loam & Gleysols",
    rainfallRegime: "100–180 mm",
    dominantCrops: ["Rice", "Sugar Beet", "Wheat", "Cotton", "Barley"]
  },
  {
    district: "Fayoum Oasis",
    state: "Fayoum",
    country: "Egypt",
    lat: 29.3084,
    lon: 30.8428,
    agroZone: "Bahr Yussef Oasis Depression",
    primarySoil: "Calcareous Alluvium & Gypsiferous Silts",
    rainfallRegime: "10–25 mm (Canal Fed)",
    dominantCrops: ["Wheat", "Date Palm", "Tomatoes", "Onions", "Clover", "Aromatic Herbs"]
  },

  // 4. Argentina & South America (Pampas & Cerrado)
  {
    district: "Pergamino / Rosario",
    state: "Buenos Aires",
    country: "Argentina",
    lat: -34.5000,
    lon: -61.5000,
    agroZone: "Humid Pampas Core Grain Belt",
    primarySoil: "Deep High-SOC Mollisols (Pampa Chernozems)",
    rainfallRegime: "900–1150 mm (Temperate Subtropical)",
    dominantCrops: ["Soybeans", "Maize (Corn)", "Bread Wheat", "Sunflower", "Barley"]
  },
  {
    district: "Mendoza Valley",
    state: "Mendoza",
    country: "Argentina",
    lat: -32.8895,
    lon: -68.8458,
    agroZone: "Andean Piedmont Arid Oasis",
    primarySoil: "Coarse Alluvium & Gravelly Aridisols",
    rainfallRegime: "180–250 mm (Glacial Melt Fed)",
    dominantCrops: ["Wine Grapes (Malbec)", "Olives", "Garlic", "Peaches", "Plums"]
  },
  {
    district: "Sorriso / Sinop (Cerrado)",
    state: "Mato Grosso",
    country: "Brazil",
    lat: -12.5560,
    lon: -55.7200,
    agroZone: "Tropical Savanna Plateau (Cerrado Agribusiness Core)",
    primarySoil: "Deep Rhodic Ferralsols (Oxisols, Highly Weathered)",
    rainfallRegime: "1600–2100 mm (Bimodal Wet/Dry)",
    dominantCrops: ["Soybeans (Double Cropped)", "Maize (Safrinha)", "Cotton", "Sugarcane"]
  },
  {
    district: "Ribeirão Preto",
    state: "São Paulo",
    country: "Brazil",
    lat: -21.1767,
    lon: -47.8208,
    agroZone: "Subtropical Moist Plateau (Terra Roxa)",
    primarySoil: "Eutric Nitisols (Terra Roxa Fertile Basalt)",
    rainfallRegime: "1350–1600 mm",
    dominantCrops: ["Sugarcane (Ethanol/Sugar)", "Coffee", "Citrus (Juice Oranges)", "Soybeans"]
  },

  // 5. Rajasthan & Thar Desert (India)
  {
    district: "Jodhpur / Marwar",
    state: "Rajasthan",
    country: "India",
    lat: 26.2389,
    lon: 73.0243,
    agroZone: "Western Arid Desert Zone (Thar Desert Basin)",
    primarySoil: "Desert Arenosols & Sandy Calcareous Sierozem",
    rainfallRegime: "200–350 mm (Extreme High Evapotranspiration)",
    dominantCrops: ["Pearl Millet (Bajra)", "Cluster Bean (Guar)", "Moth Bean", "Rapeseed & Mustard", "Cumin (Jeera)"]
  },
  {
    district: "Bikaner",
    state: "Rajasthan",
    country: "India",
    lat: 28.0229,
    lon: 73.3119,
    agroZone: "Hyper-Arid Canal Irrigated Zone (Indira Gandhi Canal)",
    primarySoil: "Light Sandy Dunes & Calcic Gypsisols",
    rainfallRegime: "180–280 mm",
    dominantCrops: ["Cluster Bean (Guar)", "Groundnut", "Gram (Chickpea)", "Wheat", "Mustard"]
  },

  // 6. Punjab & Indo-Gangetic Plains (India)
  {
    district: "Ludhiana",
    state: "Punjab",
    country: "India",
    lat: 30.9010,
    lon: 75.8573,
    agroZone: "Trans-Gangetic Plains Zone (Green Revolution Core)",
    primarySoil: "Fertile Alluvial Inceptisols & Loam",
    rainfallRegime: "650–800 mm (Canal & Tube-well Irrigated)",
    dominantCrops: ["Wheat", "Basmati Paddy", "Mustard", "Maize", "Potato"]
  },
  {
    district: "Karnal",
    state: "Haryana",
    country: "India",
    lat: 29.6857,
    lon: 76.9905,
    agroZone: "Trans-Gangetic Plains Zone",
    primarySoil: "Rich Alluvial & Sandy Clay Loam",
    rainfallRegime: "700–850 mm",
    dominantCrops: ["Basmati Rice", "Wheat", "Sugarcane", "Mustard"]
  },

  // 7. Telangana, Andhra Pradesh & Maharashtra (India)
  {
    district: "Warangal / Rangareddy",
    state: "Telangana",
    country: "India",
    lat: 17.9784,
    lon: 79.5941,
    agroZone: "Southern Plateau & Hills (Deccan Semi-Arid)",
    primarySoil: "Red Sandy Loams & Medium Black Vertisols",
    rainfallRegime: "850–1050 mm",
    dominantCrops: ["Cotton", "Rice", "Chilli", "Maize", "Red Gram"]
  },
  {
    district: "Guntur",
    state: "Andhra Pradesh",
    country: "India",
    lat: 16.3067,
    lon: 80.4365,
    agroZone: "East Coast Plains & Krishna Delta",
    primarySoil: "Deep Black Vertisols & Deltaic Alluvium",
    rainfallRegime: "800–950 mm",
    dominantCrops: ["Cotton", "Chilli", "Tobacco", "Paddy"]
  },
  {
    district: "Chhatrapati Sambhaji Nagar / Nashik",
    state: "Maharashtra",
    country: "India",
    lat: 19.8762,
    lon: 75.3433,
    agroZone: "Western Plateau & Hills (Godavari Basin)",
    primarySoil: "Medium to Deep Black Vertisols (Regur)",
    rainfallRegime: "650–850 mm",
    dominantCrops: ["Soybean", "Cotton", "Sugarcane", "Onion", "Grapes", "Pomegranate"]
  },

  // 8. Mediterranean Europe (Spain, Italy, Greece)
  {
    district: "Jaén / Seville",
    state: "Andalusia",
    country: "Spain",
    lat: 37.7796,
    lon: -3.7849,
    agroZone: "Guadalquivir Mediterranean Basin",
    primarySoil: "Calcaric Cambisols & Terra Rossa",
    rainfallRegime: "500–650 mm (Hot Dry Summers)",
    dominantCrops: ["Olives (Picual)", "Wine Grapes", "Durum Wheat", "Almonds", "Sunflowers", "Citrus"]
  },
  {
    district: "Bologna / Parma (Po Valley)",
    state: "Emilia-Romagna",
    country: "Italy",
    lat: 44.4949,
    lon: 11.3426,
    agroZone: "Po River Temperate Alluvial Plain",
    primarySoil: "Deep Silty Fluvisols & Luvisols",
    rainfallRegime: "750–900 mm",
    dominantCrops: ["Soft Wheat", "Maize", "Wine Grapes", "Processing Tomatoes", "Soybeans", "Sugar Beet"]
  },

  // 9. US Midwest Corn & Soybean Belt
  {
    district: "Ames / Des Moines",
    state: "Iowa",
    country: "United States",
    lat: 42.0308,
    lon: -93.6319,
    agroZone: "Central Corn Belt (Prairie Peninsula)",
    primarySoil: "Rich Prairie Mollisols (Clarion-Nicollet-Webster)",
    rainfallRegime: "850–1000 mm (Continental Humid)",
    dominantCrops: ["Maize (Field Corn)", "Soybeans", "Oats", "Alfalfa"]
  },
  {
    district: "Champaign-Urbana",
    state: "Illinois",
    country: "United States",
    lat: 40.1164,
    lon: -88.2434,
    agroZone: "Eastern Corn Belt Prairie",
    primarySoil: "Silty Clay Loam Mollisols",
    rainfallRegime: "900–1050 mm",
    dominantCrops: ["Maize (Corn)", "Soybeans", "Winter Wheat"]
  },

  // 10. Western Europe (France, Germany, UK)
  {
    district: "Chartres / Beauce",
    state: "Centre-Val de Loire",
    country: "France",
    lat: 48.4439,
    lon: 1.4890,
    agroZone: "Parisian Basin Oceanic Grain Plateau (Granary of France)",
    primarySoil: "Deep Calcareous Loess & Luvisols",
    rainfallRegime: "600–720 mm",
    dominantCrops: ["Soft Wheat", "Barley", "Rapeseed (Canola)", "Sugar Beet", "Field Peas"]
  },

  // 11. Australia (Murray-Darling Basin)
  {
    district: "Griffith / Riverina",
    state: "New South Wales",
    country: "Australia",
    lat: -34.2889,
    lon: 146.0444,
    agroZone: "Murrumbidgee Semi-Arid Irrigation Area",
    primarySoil: "Red-Brown Earths & Self-Mulching Clays (Vertosols)",
    rainfallRegime: "380–480 mm (Snowy Scheme Water Fed)",
    dominantCrops: ["Wine Grapes", "Citrus", "Almonds", "Rice", "Cotton", "Canola", "Wheat"]
  },

  // 12. Southeast Asia & Tropical Lowlands
  {
    district: "Can Tho (Mekong Delta)",
    state: "Can Tho",
    country: "Vietnam",
    lat: 10.0452,
    lon: 105.7469,
    agroZone: "Lower Mekong Monsoonal Alluvial Lowland",
    primarySoil: "Deep Fluvisols & Gleysols",
    rainfallRegime: "1600–2100 mm (Tropical Monsoonal)",
    dominantCrops: ["Paddy Rice (Triple-Cropped)", "Tropical Fruits (Mango, Dragonfruit)", "Coconut", "Cassava"]
  },
  {
    district: "Suphan Buri / Central Plain",
    state: "Suphan Buri",
    country: "Thailand",
    lat: 14.4745,
    lon: 100.1177,
    agroZone: "Chao Phraya River Basin (Rice Bowl of Thailand)",
    primarySoil: "Alluvial Clay Vertisols",
    rainfallRegime: "1100–1400 mm",
    dominantCrops: ["Jasmine Rice", "Sugarcane", "Cassava", "Maize"]
  },

  // 13. Sub-Saharan Africa
  {
    district: "Ibadan / Oyo",
    state: "Oyo",
    country: "Nigeria",
    lat: 7.3775,
    lon: 3.9470,
    agroZone: "Derived Guinea Savanna & Rainforest Margin",
    primarySoil: "Ferruginous Tropical Soils & Lixisols",
    rainfallRegime: "1250–1450 mm (Bimodal Monsoonal)",
    dominantCrops: ["Cassava", "Yam", "Maize", "Cocoa", "Cowpea", "Oil Palm"]
  },
  {
    district: "Kumasi / Ashanti",
    state: "Ashanti",
    country: "Ghana",
    lat: 6.6885,
    lon: -1.6244,
    agroZone: "Moist Semi-Deciduous Tropical Forest",
    primarySoil: "Deep Acrisols & Ferric Luvisols",
    rainfallRegime: "1300–1600 mm",
    dominantCrops: ["Cocoa", "Cassava", "Plantain", "Oil Palm", "Maize"]
  },

  // 14. East Asia (China Central Plains)
  {
    district: "Zhengzhou / Henan Plains",
    state: "Henan",
    country: "China",
    lat: 34.7466,
    lon: 113.6253,
    agroZone: "Huang-Huai-Hai Alluvial Plain (Central Plains)",
    primarySoil: "Calcaric Cambisols & Loess Alluvium",
    rainfallRegime: "600–750 mm (Temperate Monsoon)",
    dominantCrops: ["Winter Wheat", "Summer Maize", "Soybeans", "Peanuts", "Cotton"]
  }
];

// Alias for backwards compatibility
export const INDIAN_AGRI_DISTRICTS = GLOBAL_AGRI_REGIONS;

/**
 * Calculates Great-Circle distance (in kilometers) between two coordinates
 * using the Haversine formula.
 */
function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest benchmark agricultural region from our global dataset.
 */
export function findNearestGlobalAgriRegion(lat: number, lon: number): DetectedLocationResult {
  let nearest = GLOBAL_AGRI_REGIONS[0];
  let minDistance = Infinity;

  for (const item of GLOBAL_AGRI_REGIONS) {
    const dist = haversineDistanceKm(lat, lon, item.lat, item.lon);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = item;
    }
  }

  const displayName = `${nearest.district}, ${nearest.state}, ${nearest.country}`;

  return {
    district: nearest.district,
    state: nearest.state,
    country: nearest.country,
    displayName,
    agroZone: nearest.agroZone,
    primarySoil: nearest.primarySoil,
    dominantCrops: nearest.dominantCrops,
    distanceKm: Math.round(minDistance),
    source: 'global_agri_dataset'
  };
}

// Backwards compatibility alias
export const findNearestAgriDistrict = findNearestGlobalAgriRegion;

/**
 * Dynamic Global Agro-Climatic Zone synthesis when a coordinate is in a country
 * further away from specific localized benchmark hubs.
 */
function inferGlobalAgroZone(lat: number, lon: number, country: string): {
  agroZone: string;
  primarySoil: string;
  dominantCrops: string[];
} {
  const absLat = Math.abs(lat);

  // 1. Mediterranean Climates (30° - 44° latitude on western/subtropical coasts)
  if (absLat >= 30 && absLat <= 44 && ((lon >= -125 && lon <= -115) || (lon >= -10 && lon <= 35))) {
    return {
      agroZone: "Mediterranean Subtropical Agro-Climatic Zone",
      primarySoil: "Calcaric Cambisols & Terra Rossa",
      dominantCrops: ["Olives", "Wine Grapes", "Almonds", "Durum Wheat", "Citrus", "Processing Tomatoes"]
    };
  }

  // 2. Tropical Humid / Monsoonal (0° - 20° latitude)
  if (absLat < 20) {
    return {
      agroZone: "Tropical Monsoonal & Humid Equatorial Zone",
      primarySoil: "Humic Ferralsols & Alluvial Fluvisols",
      dominantCrops: ["Paddy Rice", "Cassava", "Coffee", "Bananas", "Sugarcane", "Spices"]
    };
  }

  // 3. Subtropical Dry & Arid Belts (18° - 32° continental interiors)
  if (absLat >= 20 && absLat <= 32) {
    return {
      agroZone: "Subtropical Arid & Semi-Arid Agricultural Zone",
      primarySoil: "Aridisols & Calcareous Sandy Loams",
      dominantCrops: ["Pearl Millet", "Sorghum", "Cotton", "Chickpea", "Sesame", "Wheat (Irrigated)"]
    };
  }

  // 4. Temperate Continental & Corn/Grain Belts (35° - 55° latitude)
  if (absLat > 32 && absLat <= 55) {
    return {
      agroZone: "Temperate Plains & Continental Grain Zone",
      primarySoil: "Rich Mollisols & Luvisol Loams",
      dominantCrops: ["Wheat", "Maize (Corn)", "Soybeans", "Barley", "Rapeseed (Canola)", "Potatoes"]
    };
  }

  // 5. Cold Temperate / Boreal (> 55° latitude)
  return {
    agroZone: "Cold Temperate Short-Season Zone",
    primarySoil: "Podzols & Gleysols",
    dominantCrops: ["Spring Barley", "Oats", "Rye", "Potatoes", "Rapeseed"]
  };
}

/**
 * Detects location from latitude & longitude:
 * 1. Queries OpenStreetMap reverse geocoding (timeout 2s).
 * 2. Augments with country, state/province, and district.
 * 3. Binds authentic global agro-climatic zone, primary soil order, and crop benchmarks.
 */
export async function detectLocationFromCoordinates(
  lat: number,
  lon: number
): Promise<DetectedLocationResult> {
  const offlineMatch = findNearestGlobalAgriRegion(lat, lon);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const country = addr.country || offlineMatch.country;
      const state = addr.state || addr.province || addr.region || addr.territory || offlineMatch.state;
      const district = addr.state_district || addr.county || addr.district || addr.city || addr.town || addr.municipality || offlineMatch.district;

      // Clean display name
      const parts = [district, state, country].filter(Boolean);
      const displayName = parts.join(', ');

      const dist = offlineMatch.distanceKm;
      let agroZone = offlineMatch.agroZone;
      let primarySoil = offlineMatch.primarySoil;
      let dominantCrops = offlineMatch.dominantCrops;

      // If coordinate is further than 750km from a known hub, use country and latitude synthesis
      if (dist > 750) {
        const synthesized = inferGlobalAgroZone(lat, lon, country);
        agroZone = synthesized.agroZone;
        primarySoil = synthesized.primarySoil;
        dominantCrops = synthesized.dominantCrops;
      }

      return {
        district,
        state,
        country,
        displayName,
        agroZone,
        primarySoil,
        dominantCrops,
        distanceKm: dist,
        source: 'reverse_geocoded'
      };
    }
  } catch {
    // Fall back to offline nearest global agricultural region
  }

  return offlineMatch;
}
