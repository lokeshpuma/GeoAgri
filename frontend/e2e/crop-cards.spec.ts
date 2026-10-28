import { test, expect } from '@playwright/test';

test.describe('Crop Cards & UI Truthfulness (PRD v3.3 §3.3, AC-6 to AC-10)', () => {
  test('AC-10: no snake_case text reaches user-facing cards on #crops', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
    // Intercept area endpoint
    await page.route('**/*field/area*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ area_ha: 2.5, status: 'ok' }),
      });
    });

    // Mock predict endpoint
    await page.route('**/*predict/full-report*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          field_summary: { area_ha: 2.5, centroid_lon: 75.75, centroid_lat: 13.32, polygon_valid: true, boundary_source: 'user_drawn' },
          land_suitability: { grade: 'High', score: 0.88, confidence: 0.9, limiting_factors: [] },
          environment: {
            rainfall_mm: 850,
            temp_mean_c: 24.5,
            temp_max_c: 31.0,
            temp_min_c: 18.0,
            humidity_pct: 68.0,
            solar_radiation_mj_m2: 19.5,
            ph: 6.5,
            organic_carbon_g_kg: 7.5,
            nitrogen_g_kg: 1.2,
            phosphorus_ppm: 14.5,
            potassium_ppm: 180.0,
            texture_clay_pct: 22.0,
            texture_sand_pct: 45.0,
            texture_silt_pct: 33.0
          },
          satellite_features: { ndvi: 0.65, ndwi: 0.2, evi: 0.5, savi: 0.5, ndmi: 0.3, elevation: 820.0, slope: 2.0, twi: 8.0, vv: -12.0, vh: -18.0 },
          climatology_status: 'available',
          recommended_crops: [
            {
              crop_id: 'finger_millet',
              crop_name: 'Finger Millet',
              scientific_name: 'Eleusine coracana',
              category: 'cereal',
              recommendation_score: 0.95,
              suitability_score: 0.95,
              suitability_grade: 'Excellent',
              expected_yield_t_ha: { p10: 1.8, p50: 2.6, p90: 3.4 },
              expected_production_t: { p10: 4.5, p50: 6.5, p90: 8.5 },
              irrigation_mode: 'rainfed',
              water_need_mm: 550,
              climate_risk_score: 15,
              climate_risk_note: 'Low vulnerability',
              intercrop_options: [],
              rationale: 'Finger Millet ranks #1. Suitable for rainfed cultivation with natural precipitation (550 mm water need). Evaluated with ML yield models and regional priors.',
              data_confidence: 'high',
              confidence_tier: 'A',
              limiting_factor: 'rainfall',
              best_planting_month: 6,
              notes: []
            },
            {
              crop_id: 'vigna_unguiculata',
              crop_name: 'Cowpea',
              scientific_name: 'Vigna unguiculata',
              category: 'pulses',
              recommendation_score: 0.88,
              suitability_score: 0.88,
              suitability_grade: 'Good',
              expected_yield_t_ha: null,
              expected_production_t: null,
              irrigation_mode: 'rainfed',
              water_need_mm: null,
              climate_risk_score: null,
              climate_risk_note: null,
              intercrop_options: [],
              rationale: 'Cowpea ranks #2. Suitable for rainfed cultivation with natural precipitation (rainfall matched). EcoCrop bioclimatic envelope match (Good).',
              data_confidence: 'low',
              confidence_tier: 'B',
              limiting_factor: 'temperature',
              best_planting_month: 7,
              notes: []
            },
            {
              crop_id: 'curcuma_longa',
              crop_name: 'Turmeric',
              scientific_name: 'Curcuma longa',
              category: 'cash_crops',
              recommendation_score: 0.82,
              suitability_score: 0.82,
              suitability_grade: 'Good',
              expected_yield_t_ha: null,
              expected_production_t: null,
              irrigation_mode: 'supplemental',
              water_need_mm: null,
              climate_risk_score: null,
              intercrop_options: [],
              rationale: 'Turmeric ranks #3. Requires supplemental irrigation to achieve optimal potential (rainfall matched). EcoCrop bioclimatic envelope match (Good).',
              data_confidence: 'low',
              confidence_tier: 'B',
              limiting_factor: 'ph',
              best_planting_month: 5,
              notes: []
            }
          ],
          yield_summary: { top_recommended_crop: 'Finger Millet', p10_t_ha: 1.8, p50_t_ha: 2.6, p90_t_ha: 3.4 },
          production_summary: { top_recommended_crop: 'Finger Millet', p10_t: 4.5, p50_t: 6.5, p90_t: 8.5 },
          irrigation_summary: { recommended_mode: 'Rainfed', total_water_demand_m3: 13750, effective_rainfall_mm: 637.5 },
          climate_risk_summary: { overall_risk_level: 'Low', drought_risk_score: 6, heat_risk_score: 4, excess_rain_risk_score: 5, note: 'Low climatic risk' },
          intercrop_summary: { top_pair: 'None', estimated_production_boost_t: 0.0, disclaimer: '' },
          model_status: { model_a: 'ok', model_b: 'ok', model_c: 'ok', model_d: 'ok', model_e: 'ok' },
          gate_mode: 'shadow'
        })
      });
    });

    await page.goto('/#boundary');

    // Draw and confirm boundary
    const drawPolygonBtn = page.getByLabel('Draw polygon');
    await drawPolygonBtn.click();

    const mapContainer = page.locator('.boundary-map-canvas');
    const box = await mapContainer.boundingBox();
    if (!box) throw new Error('Map bounding box not found');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.waitForTimeout(500);
    await page.mouse.click(cx - 30, cy - 30);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 30, cy - 30);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 30, cy + 30);
    await page.waitForTimeout(150);
    await page.mouse.click(cx - 30, cy + 30);
    await page.waitForTimeout(200);

    const finishBtn = page.getByRole('button', { name: /Finish shape/i });
    if (await finishBtn.isVisible()) {
      await finishBtn.click();
      await page.waitForTimeout(200);
    }

    const confirmBtn = page.getByRole('button', { name: /Confirm Boundary/i });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Verify on #analysis
    await expect(page).toHaveURL(/#analysis/);
    await page.waitForTimeout(500);

    // Click Predict Now button to trigger prediction
    const predictBtn = page.getByRole('button', { name: /Predict Now/i }).first();
    await predictBtn.click();

    // Once prediction finishes, click "Analyse All Crops" to advance to #crops
    const analyseCropsBtn = page.getByRole('button', { name: /Analyse All Crops/i }).first();
    await expect(analyseCropsBtn).toBeVisible({ timeout: 10000 });
    await analyseCropsBtn.click();

    // Verify lands on #crops
    await expect(page).toHaveURL(/#crops/);
    await page.waitForTimeout(500);

    const cards = page.locator('.crop-rec-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const snakeCaseRegex = /[a-z]+_[a-z]+/;
    for (let i = 0; i < count; i++) {
      const cardText = await cards.nth(i).innerText();
      const match = cardText.match(snakeCaseRegex);
      expect(match, `Card #${i + 1} contains snake_case token "${match?.[0]}" in text:\n${cardText}`).toBeNull();
    }
  });
});
