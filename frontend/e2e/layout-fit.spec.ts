import { test, expect } from '@playwright/test';
import * as path from 'path';

const VIEWPORTS = [
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
];

const SCREENS_DIR = path.resolve(process.cwd(), '../documentation/screens');

test.describe('Screen Fit & Viewport Screenshots (PRD v3.3 §3.5, AC-13)', () => {
  for (const vp of VIEWPORTS) {
    test(`verify layout and capture screenshots at ${vp.width}x${vp.height}`, async ({ page }) => {
      test.setTimeout(60000);
      await page.setViewportSize(vp);

      // Fast mock for map tiles to avoid network stalls
      await page.route('**/*arcgisonline*/**', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'image/png',
          body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
        });
      });

      // Intercept area endpoint
      await page.route('**/*field/area*', async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ area_ha: 2.5, status: 'ok' }),
        });
      });

      // Intercept predict endpoint with complete fixture
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

      // 1. BOUNDARY STUDIO PAGE (#boundary)
      await page.goto('/#boundary');
      await page.waitForTimeout(800);

      // Dismiss coach guidance card if visible so it doesn't intercept drawing clicks
      const dismissCoachBtn = page.getByRole('button', { name: /Close guidance card/i });
      if (await dismissCoachBtn.isVisible()) {
        await dismissCoachBtn.click();
        await page.waitForTimeout(200);
      }

      // Draw and complete a valid parcel
      const drawPolygonBtn = page.getByLabel('Draw polygon');
      await drawPolygonBtn.click();
      await page.waitForTimeout(300);

      const mapCanvas = page.locator('.boundary-map-canvas');
      await expect(mapCanvas).toBeVisible();
      const mapBox = await mapCanvas.boundingBox();
      if (!mapBox) throw new Error('Map canvas not found');

      const cx = mapBox.x + mapBox.width / 2;
      const cy = mapBox.y + mapBox.height / 2;
      const clickX = 195;
      const clickY = vp.width <= 600 ? 340 : cy;
      const delta = 25;

      await page.mouse.click(clickX - delta, clickY - delta);
      await page.waitForTimeout(200);
      await page.mouse.click(clickX + delta, clickY - delta);
      await page.waitForTimeout(200);
      await page.mouse.click(clickX + delta, clickY + delta);
      await page.waitForTimeout(200);
      await page.mouse.click(clickX - delta, clickY + delta);
      await page.waitForTimeout(200);
      // Close polygon by clicking starting vertex
      await page.mouse.click(clickX - delta, clickY - delta);
      await page.waitForTimeout(300);

      const confirmBtn = page.getByRole('button', { name: /Confirm Boundary/i });
      const finishBtn = page.getByRole('button', { name: /Finish shape/i });
      if (await finishBtn.count() > 0) {
        await finishBtn.scrollIntoViewIfNeeded();
        await finishBtn.click();
        await page.waitForTimeout(300);
      }

      await confirmBtn.scrollIntoViewIfNeeded();
      await expect(confirmBtn).toBeEnabled({ timeout: 6000 });

      // Assert no horizontal scroll on #boundary
      const boundaryHasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(boundaryHasHScroll, `Horizontal scroll detected on #boundary at ${vp.width}x${vp.height}`).toBe(false);

      // Assert map bottom edge >= viewport height - --step-bar-h (no blank strip)
      const currentMapBox = await mapCanvas.boundingBox();
      if (currentMapBox) {
        const stepBarH = await page.evaluate(() => {
          const v = getComputedStyle(document.documentElement).getPropertyValue('--step-bar-h');
          return parseInt(v, 10) || 64;
        });
        const bottomEdge = currentMapBox.y + currentMapBox.height;
        expect(bottomEdge).toBeGreaterThanOrEqual(vp.height - stepBarH - 30);
      }

      // Take screenshot of #boundary
      await page.screenshot({
        path: path.join(SCREENS_DIR, `screen_boundary_${vp.width}x${vp.height}.png`),
      });

      // 2. FIELD ANALYSIS PAGE (#analysis)
      await confirmBtn.click();

      await expect(page).toHaveURL(/#analysis/);
      await page.waitForTimeout(600);

      // Assert no horizontal scroll on #analysis
      const analysisHasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(analysisHasHScroll, `Horizontal scroll detected on #analysis at ${vp.width}x${vp.height}`).toBe(false);

      // On desktop (width > 900), verify map bottom edge and Selected Field panel bottom edge differ by < 24 px (PRD v3.4 AC-10)
      if (vp.width > 900) {
        const colLocator = page.locator('.field-map-column');
        const cardLocator = page.locator('.selected-field-card');
        if (await colLocator.isVisible() && await cardLocator.isVisible()) {
          const colBox = await colLocator.boundingBox();
          const cardBox = await cardLocator.boundingBox();
          if (colBox && cardBox) {
            const bottomDiff = Math.abs((colBox.y + colBox.height) - (cardBox.y + cardBox.height));
            expect(bottomDiff, `Map bottom and Selected Field bottom differ by ${bottomDiff}px (must be < 24px per AC-10)`).toBeLessThan(24);
          }
        }
      }

      // Take screenshot of #analysis
      await page.screenshot({
        path: path.join(SCREENS_DIR, `screen_analysis_${vp.width}x${vp.height}.png`),
      });

      // 3. CROP PREDICTION PAGE (#crops)
      const predictBtn = page.locator('.btn-predict-now');
      await predictBtn.scrollIntoViewIfNeeded();
      await predictBtn.click();

      const analyseCropsBtn = page.getByRole('button', { name: /Analyse All Crops/i }).first();
      await expect(analyseCropsBtn).toBeVisible({ timeout: 10000 });
      await analyseCropsBtn.click();

      await expect(page).toHaveURL(/#crops/);
      await page.waitForTimeout(600);

      // Assert no horizontal scroll on #crops
      const cropsHasHScroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(cropsHasHScroll, `Horizontal scroll detected on #crops at ${vp.width}x${vp.height}`).toBe(false);

      // Take screenshot of #crops
      await page.screenshot({
        path: path.join(SCREENS_DIR, `screen_crops_${vp.width}x${vp.height}.png`),
      });
    });
  }
});
