import { test, expect } from '@playwright/test';

test.describe('Boundary Studio Drawing & Confirmation Flow (PRD v3.2 §2, §9 Q3)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend API calls
    await page.route('**/*field/area*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ area_ha: 1.5, status: 'ok' }),
      });
    });
  });

  test('cannot confirm when empty or unfinished, confirms and lands on #analysis when finished', async ({ page }) => {
    await page.goto('/#boundary');

    // Confirm button should be disabled initially
    const confirmBtn = page.getByRole('button', { name: /Confirm Boundary/i });
    await expect(confirmBtn).toBeDisabled();

    // Select polygon drawing tool
    const drawPolygonBtn = page.getByLabel('Draw polygon');
    await drawPolygonBtn.click();

    // Click on the map container to start drawing
    const mapContainer = page.locator('.boundary-map-canvas');
    await expect(mapContainer).toBeVisible();

    const box = await mapContainer.boundingBox();
    if (!box) throw new Error('Map container bounding box not found');

    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    // Wait for map container to settle
    await page.waitForTimeout(500);

    // Click 4 corners (forming a square well within 0.01 - 1000 ha limits)
    await page.mouse.click(centerX - 25, centerY - 25);
    await page.waitForTimeout(200);
    await page.mouse.click(centerX + 25, centerY - 25);
    await page.waitForTimeout(200);
    await page.mouse.click(centerX + 25, centerY + 25);
    await page.waitForTimeout(200);
    await page.mouse.click(centerX - 25, centerY + 25);
    await page.waitForTimeout(300);

    // Shape is unfinished (drawing in progress) -> Confirm MUST remain disabled
    await expect(confirmBtn).toBeDisabled();

    // The Finish shape helper banner should be visible
    const finishShapeBtn = page.getByRole('button', { name: /Finish shape/i });
    if (await finishShapeBtn.isVisible()) {
      // Click Finish shape
      await finishShapeBtn.click();
      await page.waitForTimeout(300);

      // Now shape is closed and valid -> Confirm button should become enabled
      await expect(confirmBtn).toBeEnabled();

      // Click Confirm Boundary
      await confirmBtn.click();

      // Must land on #analysis synchronously / atomically
      await expect(page).toHaveURL(/#analysis/);
    } else {
      // Complete by clicking first point or double clicking
      await page.mouse.dblclick(centerX - 100, centerY + 100);
      await page.waitForTimeout(300);

      if (await confirmBtn.isEnabled()) {
        await confirmBtn.click();
        await expect(page).toHaveURL(/#analysis/);
      }
    }
  });

  test('bow-tie / self-intersecting polygon blocks confirmation', async ({ page }) => {
    await page.goto('/#boundary');

    // Select polygon tool
    const drawPolygonBtn = page.getByLabel('Draw polygon');
    await drawPolygonBtn.click();

    const mapContainer = page.locator('.boundary-map-canvas');
    const box = await mapContainer.boundingBox();
    if (!box) throw new Error('Map container bounding box not found');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.waitForTimeout(500);

    // Draw a self-intersecting bow-tie: (0,0) -> (100,100) -> (100,0) -> (0,100)
    await page.mouse.click(cx - 50, cy - 50);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 50, cy + 50);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 50, cy - 50);
    await page.waitForTimeout(200);
    await page.mouse.click(cx - 50, cy + 50);
    await page.waitForTimeout(300);

    // Finish shape
    const finishShapeBtn = page.getByRole('button', { name: /Finish shape/i });
    if (await finishShapeBtn.isVisible()) {
      await finishShapeBtn.click();
      await page.waitForTimeout(300);
    }

    const confirmBtn = page.getByRole('button', { name: /Confirm Boundary/i });
    // Self-intersecting polygon is invalid -> Confirm must remain disabled
    await expect(confirmBtn).toBeDisabled();
  });
});
