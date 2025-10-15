// fetch_player_page.ts — Download SalarySwish player page HTML
//
// DESCRIPTION:
//   Uses got to fetch a SalarySwish player page HTML.
//   Saves the HTML to page.html for parsing with parse_player.ts
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
//   ./player-scrape/page.html - Raw HTML snapshot of the player page

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import got from 'got';

const __dirname = dirname(fileURLToPath(import.meta.url));

const playerUrl = process.env.PLAYER_URL;

if (!playerUrl) {
  console.error('❌ Missing PLAYER_URL environment variable');
  console.error('Usage: PLAYER_URL="https://salaryswish.com/players/austin-reaves" npx tsx player-scrape/fetch_player_page.ts');
  process.exit(1);
}

console.log(`🔍 Fetching player page: ${playerUrl}`);

try {
  // Fetch the HTML content using got
  const response = await got(playerUrl, {
    timeout: { request: 15000 },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });
  
  const html = response.body;
  
  // Save to file
  const outputPath = join(__dirname, 'page.html');
  writeFileSync(outputPath, html, 'utf-8');
  
  console.log(`✅ Saved player page HTML to: ${outputPath}`);
  console.log(`📄 HTML size: ${(html.length / 1024).toFixed(2)} KB`);
  
} catch (error: any) {
  console.error('❌ Error fetching player page:', error.message);
  process.exit(1);
}
