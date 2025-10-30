import fs from "node:fs/promises";
import path from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { paths, isRegressionFixture } from "./config";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * getPlayerHtml
 * - If playerId is in the regression set and snapshot exists, return it.
 * - Else fetch live HTML from sourceUrl.
 * - NEVER write per-player HTML to disk in production flows.
 */
export async function getPlayerHtml(playerId: string, sourceUrl: string): Promise<string> {
  if (isRegressionFixture(playerId)) {
    const snapshotPath = path.join(paths.snapshotsDir, `${playerId}.html`);
    try {
      return await fs.readFile(snapshotPath, "utf8");
    } catch {
      // fall through to live fetch if snapshot missing
    }
  }
  const res = await fetch(sourceUrl, { cache: "no-store", mode: "cors" });
  if (!res.ok) throw new Error(`Failed to fetch ${sourceUrl}: ${res.status}`);
  return await res.text();
}

/**
 * CLI entrypoint - fetch player page using Playwright and save to working/page.html
 * Usage: PLAYER_URL="https://salaryswish.com/players/lebron-james" npm run fetch-player
 */
async function main() {
  const playerUrl = process.env.PLAYER_URL;
  
  if (!playerUrl) {
    console.error("Usage: PLAYER_URL=<url> npm run fetch-player");
    console.error("Example: PLAYER_URL=\"https://salaryswish.com/players/lebron-james\" npm run fetch-player");
    process.exit(1);
  }

  console.log(`🔍 Fetching: ${playerUrl}`);

  // Use playwright for fetching (handles dynamic content)
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate and wait for network idle
    await page.goto(playerUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for salary table to be rendered
    await page.waitForSelector('table', { timeout: 10000 }).catch(() => {
      console.warn('  ⚠️  No salary table found - page may not have loaded correctly');
    });

    // Extra wait for dynamic content
    await page.waitForTimeout(1000);

    // Get the HTML
    const html = await page.content();

    // Save to working/page.html
    const outputPath = path.join(__dirname, '../working/page.html');
    await fs.writeFile(outputPath, html, 'utf8');

    console.log(`✅ Saved HTML to: ${outputPath}`);
    console.log(`   Size: ${(html.length / 1024).toFixed(1)} KB`);
  } catch (error) {
    console.error('❌ Error fetching page:', error);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

// Only run main if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
}
