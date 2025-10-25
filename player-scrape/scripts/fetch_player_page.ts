// fetch_player_page.ts — Download SalarySwish player page HTML with JavaScript rendering
//
// DESCRIPTION:
//   Uses Playwright to fetch a SalarySwish player page HTML with JavaScript execution.
//   Avoids 'networkidle' (modern sites rarely go idle), blocks noisy requests,
//   performs gentle interactions (scroll/tab/year click) if needed, and
//   waits on concrete selectors that indicate salary/contract content is present.
//   Saves fully rendered HTML to ../examples/page.html for parsing with parse_player.ts
//
// RUN:
//   PLAYER_URL="https://salaryswish.com/players/austin-reaves" npx tsx player-scrape/scripts/fetch_player_page.ts
//   OR
//   PLAYER_URL="https://salaryswish.com/players/austin-reaves" npm run fetch-player
//
// ENVIRONMENT VARIABLES:
//   PLAYER_URL (required) - Full URL to SalarySwish player page
//   HEADFUL=1             - (optional) Launch a visible browser for debugging
//   INTERACT=1            - (optional) Enable extra interactions (tabs/years) before snapshot
//
// OUTPUT:
//   ../examples/page.html - Fully rendered HTML snapshot with JavaScript executed

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type BrowserContext, type Page } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));

const playerUrlRaw = process.env.PLAYER_URL;
if (!playerUrlRaw) {
  console.error('❌ Missing PLAYER_URL environment variable');
  console.error(
    'Usage: PLAYER_URL="https://salaryswish.com/players/austin-reaves" npx tsx player-scrape/scripts/fetch_player_page.ts'
  );
  process.exit(1);
}

// --- Config -----------------------------------------------------------------
const HEADFUL = process.env.HEADFUL === '1';
const INTERACT = process.env.INTERACT === '1';

const NAV_TIMEOUT_MS = 60_000;
const WAIT_TIMEOUT_MS = 45_000;
const EXTRA_SETTLE_MS = 1_000;

const OUTPUT_PATH = process.env.TEMP_FILE
  ? join(__dirname, '../examples', process.env.TEMP_FILE)
  : join(__dirname, '../examples/page.html');

// Prefer non-www to reduce redirects / long-lived connections
const playerUrl = playerUrlRaw.replace('://www.', '://');

// Key selectors/regex that indicate salary/contract content is present.
// Adjust if SalarySwish changes markup semantics.
const PROOF_SELECTORS = [
  // Table with a recognizable header
  'table:has(th:has-text("Season"))',
  // Common text tokens that appear near contract/salary sections
  'text=/\\bSeason\\b|\\bSalary\\b|\\bCap Hit\\b|\\bGuaranteed\\b/i',
];

// --- Helpers ----------------------------------------------------------------

async function blockNoisyRequests(context: BrowserContext) {
  await context.route('**/*', (route) => {
    const url = route.request().url();
    if (
      /googletagmanager|google-analytics|gtag|doubleclick|segment|hotjar|clarity|optimizely|intercom|newrelic|akamai|datadog/i.test(
        url
      ) ||
      /fonts\.(gstatic|googleapis)\.com/i.test(url)
    ) {
      return route.abort();
    }
    route.continue();
  });
}

async function addDiagnostics(page: Page) {
  // Disable noisy console/error logging to keep terminal output clean
  // The ad blockers and failed JS requests are expected and not useful for our scraping
  // Uncomment these lines if you need to debug page loading issues:
  // page.on('console', (msg) =>
  //   console.log('🖥️ console:', msg.type(), msg.text())
  // );
  // page.on('pageerror', (err) =>
  //   console.warn('⚠️ pageerror:', err.message || String(err))
  // );
  // page.on('requestfailed', (req) =>
  //   console.warn('⚠️ requestfailed:', req.url(), req.failure()?.errorText)
  // );
}

async function waitForAnySelector(
  page: Page,
  selectors: string[],
  timeout: number
) {
  const races = selectors.map((sel) =>
    page.waitForSelector(sel, { timeout, state: 'visible' }).then(() => sel)
  );
  return Promise.any(races);
}

async function gentleInteractions(page: Page) {
  // Scroll near likely contract area to trigger lazy loaders/IntersectionObservers.
  const anchors = [
    'text=/\\bContract\\b/i',
    'text=/\\bSalary\\b/i',
    'text=/\\bCareer Earnings\\b/i',
    'text=/\\bTransactions\\b/i',
  ];
  for (const sel of anchors) {
    const loc = page.locator(sel).first();
    if ((await loc.count()) > 0) {
      await loc.scrollIntoViewIfNeeded().catch(() => {});
      break;
    }
  }

  if (!INTERACT) return;

  // If there are year tabs/buttons, click the first visible one to force render.
  // Also try generic "All" / "Career" if present.
  const yearOrTab = page
    .locator(
      [
        ':is(button,a):has-text(/20\\d{2}/i)',
        ':is(button,a):has-text(/All/i)',
        ':is(button,a):has-text(/Career/i)',
      ].join(', ')
    )
    .first();

  if ((await yearOrTab.count()) > 0 && (await yearOrTab.isVisible())) {
    await yearOrTab.click({ trial: false }).catch(() => {});
  }

  // Small wait to allow any dependent render to occur
  await page.waitForTimeout(300);
}

// --- Main -------------------------------------------------------------------

console.log(`🔍 Fetching player page with JavaScript rendering: ${playerUrl}`);

try {
  const browser = await chromium.launch({
    headless: !HEADFUL,
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
    // Extra headers can help look more "real" but aren't strictly necessary
    extraHTTPHeaders: {
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Upgrade-Insecure-Requests': '1',
    },
  });

  await blockNoisyRequests(context);

  const page = await context.newPage();

  // Stealth tweak: mask `navigator.webdriver`
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
  });

  await addDiagnostics(page);

  console.log('  📡 Loading page...');
  page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);
  page.setDefaultTimeout(WAIT_TIMEOUT_MS);

  await page.goto(playerUrl, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });

  console.log('  ⏳ Ensuring content is rendered (interactions if needed)...');
  await gentleInteractions(page);

  console.log('  🔎 Waiting for salary/contract proof in DOM...');
  try {
    const matched = await waitForAnySelector(
      page,
      PROOF_SELECTORS,
      WAIT_TIMEOUT_MS
    );
    console.log(`  ✅ Detected content via selector: ${matched}`);
  } catch {
    console.warn(
      '  ⚠️ Primary selectors not found; falling back to heuristics...'
    );
    // As a last resort, wait for any element that mentions common tokens.
    await page.waitForSelector('text=/Season|Salary|Cap Hit|Guaranteed/i', {
      timeout: 10_000,
    });
  }

  // Tiny buffer to let hydration/DOM settle
  await page.waitForTimeout(EXTRA_SETTLE_MS);

  const html = await page.content();

  await browser.close();

  // Ensure output dir exists
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });

  writeFileSync(OUTPUT_PATH, html, 'utf-8');

  console.log(`✅ Saved rendered player page HTML to: ${OUTPUT_PATH}`);
  console.log(`📄 HTML size: ${(html.length / 1024).toFixed(2)} KB`);

  // Quick validation — look for common tokens
  if (/(<table|Season|Salary|Cap Hit|Guaranteed)/i.test(html)) {
    console.log('✅ Salary/contract indicators found in HTML');
  } else {
    console.warn(
      '⚠️ Could not find typical salary/contract indicators in HTML'
    );
  }
} catch (error: any) {
  console.error(
    '❌ Error fetching player page:',
    error?.message ?? String(error)
  );
  process.exit(1);
}
