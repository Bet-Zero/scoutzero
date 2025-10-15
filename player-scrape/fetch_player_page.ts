// fetch_player_page.ts — Download SalarySwish player page HTML with JavaScript rendering
//
// DESCRIPTION:
//   Uses Playwright to fetch a SalarySwish player page HTML with JavaScript execution.
//   Waits for dynamic content (salary tables) to load before saving.
//   Saves the fully rendered HTML to page.html for parsing with parse_player.ts
//
// RUN:
//   PLAYER_URL="https://salaryswish.com/players/austin-reaves" npx tsx player-scrape/fetch_player_page.ts
//   OR
//   PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
//
// ENVIRONMENT VARIABLES:
//   PLAYER_URL (required) - Full URL to SalarySwish player page
//
// OUTPUT:
//   ./player-scrape/page.html - Fully rendered HTML snapshot with JavaScript executed

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));

const playerUrl = process.env.PLAYER_URL;

if (!playerUrl) {
  console.error('❌ Missing PLAYER_URL environment variable');
  console.error('Usage: PLAYER_URL="https://salaryswish.com/players/austin-reaves" npx tsx player-scrape/fetch_player_page.ts');
  process.exit(1);
}

console.log(`🔍 Fetching player page with JavaScript rendering: ${playerUrl}`);

try {
  // Launch headless browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  // Navigate to the player page
  console.log('  📡 Loading page...');
  await page.goto(playerUrl, { waitUntil: 'networkidle', timeout: 30000 });
  
  // Wait for salary table to be rendered (key indicator that JS has executed)
  console.log('  ⏳ Waiting for salary table to render...');
  await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
    console.warn('  ⚠️  No table found - page may not have salary data');
  });
  
  // Additional wait to ensure all dynamic content is loaded
  await page.waitForTimeout(2000);
  
  // Get the fully rendered HTML
  const html = await page.content();
  
  // Clean up
  await browser.close();
  
  // Save to file
  const outputPath = join(__dirname, 'page.html');
  writeFileSync(outputPath, html, 'utf-8');
  
  console.log(`✅ Saved rendered player page HTML to: ${outputPath}`);
  console.log(`📄 HTML size: ${(html.length / 1024).toFixed(2)} KB`);
  
  // Quick validation - check if we have a table
  if (html.includes('<table') && html.includes('Season') && html.includes('Salary')) {
    console.log('✅ Salary table detected in HTML');
  } else {
    console.warn('⚠️  Warning: Salary table may not be present in rendered HTML');
  }
  
} catch (error: any) {
  console.error('❌ Error fetching player page:', error.message);
  process.exit(1);
}
