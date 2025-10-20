// fetch_page.ts — with Playwright interactions for Draft
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import path from 'node:path';

const URL = process.env.TEAM_URL!;
if (!URL) {
  console.error('Set TEAM_URL');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Using 'load' instead of 'networkidle' as it's more reliable for modern web apps
  // Increased timeout to 60s to handle slow page loads
  await page.goto(URL, {
    waitUntil: 'load',
    timeout: 60000,
  });

  // Scroll to Draft block (near TRADE EXCEPTIONS)
  await page.locator('text=TRADE EXCEPTIONS').scrollIntoViewIfNeeded();
  // Try clicking a year & round so picks render
  try {
    await page
      .locator('text=Draft')
      .first()
      .waitFor({ state: 'visible', timeout: 2000 });
    // Click first available year button and both rounds if present
    const yearBtn = page
      .locator('button:has-text("2026"), a:has-text("2026")')
      .first();
    if (await yearBtn.isVisible()) await yearBtn.click();
    const r1 = page.locator(':is(button,a):has-text("Round 1")').first();
    if (await r1.isVisible()) await r1.click();
    const r2 = page.locator(':is(button,a):has-text("Round 2")').first();
    if (await r2.isVisible()) await r2.click();
    await page.waitForTimeout(500); // allow DOM update
  } catch {}

  const html = await page.content();
  const outputPath = path.join(
    process.cwd(),
    'team-scrape',
    'working',
    'page.html'
  );
  await fs.writeFile(outputPath, html, 'utf8');
  await browser.close();
  console.log(`Saved ${outputPath} (Playwright with Draft interactions)`);
})();
