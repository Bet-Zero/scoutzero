/**
 * FILE: scripts/emu/reviewShot.mjs
 * PURPOSE: Drive the Architect review harness with the repo's bundled Playwright
 *   chromium at the owner's fixed 1280x720 review view, screenshot a room, and
 *   measure fit (BZE-229 / BZE-230).
 *
 * The owner-fixed review view: a FULL 18-man roster (team DEN, 15 standard + 3
 * two-way) + BOTH side drawers open (the narrowest room body). Partial rosters
 * and single-drawer states are NOT valid review targets.
 *
 * Prereq: `npm run architect:review:up` (5173/8082/9099) + review data seeded.
 * Usage:
 *   node scripts/emu/reviewShot.mjs --room=capfull --team=DEN --drawers=both --label=fct
 *   node scripts/emu/reviewShot.mjs --room=cap --team=DEN --drawers=both --clickText=2028-29
 * Flags: --room --team --drawers=both --label --out --wait --query --clickText
 *        --flags=capSheetFixtures,teamHistoryFixtures,offseasonPreview (owner-facing = none)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.replace(/^--/, '').split('=');
    return [m[0], m.slice(1).join('=') ?? true];
  })
);

const room = args.room ?? 'capfull';
const team = args.team ?? 'DEN';
const label = args.label ?? `${room}-${team}`;
const extraQuery = args.query ? `&${args.query}` : '';
const waitMs = Number(args.wait ?? 2800);
const outDir = args.out ?? path.join(process.cwd(), 'tmp', 'review-shots');
fs.mkdirSync(outDir, { recursive: true });

const FLAG_KEYS = {
  capSheetFixtures: 'hz.dev.capSheetFixtures',
  offseasonPreview: 'hz.dev.offseasonPreview',
  teamHistoryFixtures: 'hz.dev.teamHistoryFixtures',
};
const devFlags = Object.fromEntries(
  String(args.flags ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((name) => [FLAG_KEYS[name] ?? name, 'true'])
);

const url = `http://127.0.0.1:5173/gm/${team}?room=${room}${extraQuery}`;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 2,
});
await context.addInitScript(() => {
  window.confirm = () => true;
});
await context.addInitScript((flags) => {
  Object.entries(flags).forEach(([k, v]) => window.localStorage.setItem(k, v));
}, devFlags);

const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text());
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page
  .waitForFunction(
    () => !/Loading GM Dashboard/i.test(document.body.innerText),
    { timeout: 30000 }
  )
  .catch(() => {});
await page.waitForTimeout(waitMs);

if (args.clickText) {
  const clicked = await page.evaluate((txt) => {
    const els = Array.from(
      document.querySelectorAll('button,[role="tab"],[role="button"],a')
    );
    const el = els.find((e) => (e.textContent || '').trim() === txt);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }, args.clickText);
  console.log('clickText matched:', clicked);
  await page.waitForTimeout(1400);
}

// Worst-case review view: pin the left nav rail open while the right activity
// rail stays open (its default), so the room body is at its narrowest.
if (args.drawers === 'both') {
  const pinned = await page.evaluate(() => {
    const activityCollapsed = document.querySelector(
      '[data-testid="cockpit-activity-rail-expand"]'
    );
    if (activityCollapsed) activityCollapsed.click();
    const pin = document.querySelector('[data-testid="cockpit-nav-rail-pin"]');
    if (pin) {
      pin.click();
      return true;
    }
    return false;
  });
  console.log('drawers both — nav rail pinned:', pinned);
  await page.waitForTimeout(1200);
}

const measure = await page.evaluate(() => {
  const r = (n) => Math.round(n * 10) / 10;
  const rect = (el) => {
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return {
      w: r(b.width),
      h: r(b.height),
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
      scrollW: el.scrollWidth,
      clientW: el.clientWidth,
    };
  };
  const body = document.querySelector('[data-testid="cockpit-room-frame-body"]');
  const docEl = document.documentElement;
  return {
    room: rect(body),
    bodyOverflowsV: body ? body.scrollHeight > body.clientHeight + 1 : null,
    bodyOverflowsH: body ? body.scrollWidth > body.clientWidth + 1 : null,
    docScrollV: docEl.scrollHeight > docEl.clientHeight + 1,
    docScrollH: docEl.scrollWidth > docEl.clientWidth + 1,
  };
});

const shotPath = path.join(outDir, `${label}.png`);
await page.screenshot({ path: shotPath, fullPage: false });
const result = { url, label, drawers: args.drawers ?? 'default', measure, consoleErrors: consoleErrors.slice(0, 8) };
fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
console.log(`\nSHOT: ${shotPath}`);
await browser.close();
