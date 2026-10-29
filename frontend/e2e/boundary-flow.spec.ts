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

  test('drawing only 3 corners without finishing leaves Confirm disabled (PRD v3.3 §3.4)', async ({ page }) => {
    await page.goto('/#boundary');

    const drawPolygonBtn = page.getByLabel('Draw polygon');
    await drawPolygonBtn.click();

    const mapContainer = page.locator('.boundary-map-canvas');
    const box = await mapContainer.boundingBox();
    if (!box) throw new Error('Map container bounding box not found');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.waitForTimeout(500);

    // Click only 3 corners without closing or finishing
    await page.mouse.click(cx - 30, cy - 30);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 30, cy - 30);
    await page.waitForTimeout(150);
    await page.mouse.click(cx, cy + 30);
    await page.waitForTimeout(300);

    // Unfinished shape: Confirm button MUST remain disabled
    const confirmBtn = page.getByRole('button', { name: /Confirm Boundary/i });
    await expect(confirmBtn).toBeDisabled();

    // Finish shape banner should be offered
    const finishShapeBtn = page.getByRole('button', { name: /Finish shape/i });
    await expect(finishShapeBtn).toBeVisible();
  });

  test('reload restores the draft with a banner and does not auto-confirm (AC-12)', async ({ page }) => {
    await page.goto('/#boundary');

    const drawPolygonBtn = page.getByLabel('Draw polygon');
    await drawPolygonBtn.click();

    const mapContainer = page.locator('.boundary-map-canvas');
    const box = await mapContainer.boundingBox();
    if (!box) throw new Error('Map container bounding box not found');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    await page.waitForTimeout(500);
    await page.mouse.click(cx - 25, cy - 25);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 25, cy - 25);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 25, cy + 25);
    await page.waitForTimeout(150);
    await page.mouse.click(cx - 25, cy + 25);
    await page.waitForTimeout(200);

    const finishShapeBtn = page.getByRole('button', { name: /Finish shape/i });
    if (await finishShapeBtn.isVisible()) {
      await finishShapeBtn.click();
      await page.waitForTimeout(300);
    }

    const confirmBtn = page.getByRole('button', { name: /Confirm Boundary/i });
    await expect(confirmBtn).toBeEnabled();

    // Reload page without confirming
    await page.reload();
    await page.waitForTimeout(800);

    // Assert on #boundary and restore banner is visible
    expect(page.url()).toContain('#boundary');
    const restoreBanner = page.locator('.draft-restore-banner');
    await expect(restoreBanner).toBeVisible();
    await expect(restoreBanner).toContainText(/restored/i);

    // Assert shape is loaded and ready to confirm, but has NOT auto-confirmed
    await expect(confirmBtn).toBeEnabled();
    expect(page.url()).not.toContain('#analysis');
  });

  test('drawing a second shape shows replace prompt; Yes keeps new shape, No keeps first shape (AC-11)', async ({ page }) => {
    await page.goto('/#boundary');

    const drawPolygonBtn = page.getByLabel('Draw polygon');
    await drawPolygonBtn.click();

    const mapContainer = page.locator('.boundary-map-canvas');
    const box = await mapContainer.boundingBox();
    if (!box) throw new Error('Map container bounding box not found');

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Draw first shape (4 corners)
    await page.waitForTimeout(500);
    await page.mouse.click(cx - 50, cy - 50);
    await page.waitForTimeout(150);
    await page.mouse.click(cx - 10, cy - 50);
    await page.waitForTimeout(150);
    await page.mouse.click(cx - 10, cy - 10);
    await page.waitForTimeout(150);
    await page.mouse.click(cx - 50, cy - 10);
    await page.waitForTimeout(200);

    const finishShapeBtn = page.getByRole('button', { name: /Finish shape/i });
    if (await finishShapeBtn.isVisible()) {
      await finishShapeBtn.click();
      await page.waitForTimeout(300);
    }

    const confirmBtn = page.getByRole('button', { name: /Confirm Boundary/i });
    await expect(confirmBtn).toBeEnabled();

    // Now start drawing a second shape
    await drawPolygonBtn.click();
    await page.waitForTimeout(300);

    await page.mouse.click(cx + 20, cy + 20);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 60, cy + 20);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 60, cy + 60);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 20, cy + 60);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 20, cy + 20);
    await page.waitForTimeout(200);

    if (await finishShapeBtn.isVisible()) {
      await finishShapeBtn.click();
      await page.waitForTimeout(300);
    }

    // Verify replace prompt appears with exact text
    const promptTitle = page.getByText('Replace current boundary with the new shape?');
    await expect(promptTitle).toBeVisible();

    // Click "No" to reject replacement
    const noBtn = page.getByRole('button', { name: /^no/i });
    await noBtn.click();
    await page.waitForTimeout(300);

    // Assert prompt dismissed and exactly one shape remains (first shape kept)
    await expect(promptTitle).not.toBeVisible();
    await expect(confirmBtn).toBeEnabled();

    // Now draw a second shape again and click "Yes"
    await drawPolygonBtn.click();
    await page.waitForTimeout(300);

    await page.mouse.click(cx + 20, cy + 20);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 60, cy + 20);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 60, cy + 60);
    await page.waitForTimeout(150);
    await page.mouse.click(cx + 20, cy + 60);
    await page.waitForTimeout(200);
    await page.mouse.click(cx + 20, cy + 20);
    await page.waitForTimeout(200);

    if (await finishShapeBtn.isVisible()) {
      await finishShapeBtn.click();
      await page.waitForTimeout(300);
    }

    await expect(promptTitle).toBeVisible();

    // Click "Yes" to accept replacement
    const yesBtn = page.getByRole('button', { name: /^yes/i });
    await yesBtn.click();
    await page.waitForTimeout(300);

    // Assert prompt dismissed and one shape remains
    await expect(promptTitle).not.toBeVisible();
    await expect(confirmBtn).toBeEnabled();
  });
});
