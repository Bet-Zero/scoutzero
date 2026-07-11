/**
 * FILE: scripts/emu/reviewCompareShot.ts
 * PURPOSE: BZE-236 required review step — seed a saved world with COMMITTED MOVES
 *   into the running review harness, then screenshot the Compare room in its
 *   POPULATED state at the owner's fixed 1280x720 review view with BOTH drawers
 *   open, and measure fit. The prior BZE-236 shot only covered the empty/sandbox
 *   Compare; this drives the real additions / removals / contract-changes /
 *   cap-allocation-delta / tax-apron cards so they can be judged for fit,
 *   readability, token conformance, and clipping.
 *
 * Compare is event-derived (useWorldTeamEvents -> normalize -> deriveComparisonViewModel).
 * So a populated Compare requires committed event docs under
 * architect_worlds/<worldId>/events plus a world team roster that lets the
 * roster-delta classifier resolve additions (on roster) vs removals (off roster)
 * vs contract-changes (on roster). This seeds all three, honestly, for MIA.
 *
 * REVIEW ONLY. Talks only to the local emulator (demo-architect-review).
 *
 * Prereq: `npm run architect:review:up` already running (5173/8082/9099).
 * Usage:  npx tsx scripts/emu/reviewCompareShot.ts --label=bze236-compare-populated
 */
import { chromium } from 'playwright';
import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { seedSeasonAdvanceReviewWorld } from '../../tests/e2e/helpers/architectReviewWorld';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.replace(/^--/, '').split('=');
    return [m[0], m.slice(1).join('=') ?? true];
  })
);

const TEAM = 'MIA';
const LABEL = String(args.label ?? 'bze236-compare-populated');
const OUT_DIR = String(args.out ?? path.join(process.cwd(), 'tmp', 'review-shots'));
const WAIT = Number(args.wait ?? 2800);
const BASE = 'http://127.0.0.1:5173';
fs.mkdirSync(OUT_DIR, { recursive: true });

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8082';
const PROJECT_ID = 'demo-architect-review';
const app =
  admin.apps.find((a) => a?.name === 'review-compare-shot') ||
  admin.initializeApp({ projectId: PROJECT_ID }, 'review-compare-shot');
const db = app.firestore();

// --- Cap totals for the active team, before the first move and after the last.
// MIA fixture thresholds: cap 165.472M, tax 201.048M, apron1 209.661M, apron2 222.372M.
// The MIA review fixture already sits in the first-apron band; adding Darius Kane's
// MLE (and the other moves) genuinely pushes the roster above the SECOND apron, which
// is what the posture bar / activity rail render. Keep the event totals consistent
// with that real roster posture so the Compare cards agree with the rest of the screen.
const BEFORE_TOTALS = {
  totalCapAllocations: 210_000_000, // already first-apron, below second apron
  capSpace: -44_528_000, // salaryCap - alloc
  luxuryTax: 201_048_000,
  isOverTax: true,
  isFirstApron: true,
  isSecondApron: false,
  isHardCapped: false,
};
const AFTER_TOTALS = {
  totalCapAllocations: 235_100_000, // above the second apron
  capSpace: -69_628_000,
  luxuryTax: 201_048_000,
  isOverTax: true,
  isFirstApron: true,
  isSecondApron: true,
  isHardCapped: false,
};
const MID_TOTALS = {
  totalCapAllocations: 221_500_000,
  capSpace: -56_028_000,
  luxuryTax: 201_048_000,
  isOverTax: true,
  isFirstApron: true,
  isSecondApron: false,
  isHardCapped: false,
};

const buildEvent = (opts: {
  eventId: string;
  mutationType: string;
  occurredAt: string;
  playerId: string;
  playerName: string;
  summary: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}) => ({
  eventId: opts.eventId,
  id: opts.eventId,
  schemaVersion: 1,
  worldId: '', // filled per-world below
  type: opts.mutationType,
  mutationType: opts.mutationType,
  seasonId: '2026-27',
  occurredAt: opts.occurredAt,
  timestamp: opts.occurredAt,
  teamCodes: [TEAM],
  teamsAffected: [TEAM],
  playerIds: [opts.playerId],
  beforeTotalsByTeam: { [TEAM]: opts.before },
  afterTotalsByTeam: { [TEAM]: opts.after },
  valid: true,
  violations: [],
  warnings: [],
  mutationMetadata: {
    type: opts.mutationType,
    playerId: opts.playerId,
    playerName: opts.playerName,
    teamCode: TEAM,
    summary: opts.summary,
  },
  metadata: {
    type: opts.mutationType,
    playerId: opts.playerId,
    playerName: opts.playerName,
    summary: opts.summary,
  },
});

const buildKanePlayer = () => ({
  id: 'mia_darius_kane',
  playerId: 'mia_darius_kane',
  player_id: 'mia_darius_kane',
  name: 'Darius Kane',
  displayName: 'Darius Kane',
  position: 'G',
  age: 27,
  teamCode: TEAM,
  teamId: TEAM,
  teamName: 'MIAMI HEAT',
  bio: {
    playerId: 'mia_darius_kane',
    displayName: 'Darius Kane',
    position: 'G',
    height: '6-4',
    weight: '205',
    age: 27,
    experience: 5,
  },
  futureContract: null,
  representation: null,
  original: null,
  contract: {
    contractType: 'MID-LEVEL EXCEPTION',
    isExtension: false,
    isRookieScale: false,
    startSeason: '2026-27',
    endSeason: '2027-28',
    contractLength: 2,
    yearsRemaining: 2,
    totalValue: 27_000_000,
    averageAnnualValue: 13_500_000,
    guaranteedValue: 27_000_000,
    guaranteedYears: 2,
    salariesByYear: [
      { season: '2026-27', salary: 13_500_000, capHit: 13_500_000, guaranteed: true, option: null },
      { season: '2027-28', salary: 13_500_000, capHit: 13_500_000, guaranteed: true, option: null },
    ],
    noTradeClause: false,
    tradeKicker: null,
    birdRights: { status: 'Non-Bird', eligibleFor: ['Mid-Level Exception'] },
    freeAgency: { type: 'UFA', year: 2028, capHold: 0 },
  },
});

const idOf = (p: unknown): string => {
  if (!p || typeof p !== 'object') return '';
  const r = p as Record<string, unknown>;
  const bio = (r.bio as Record<string, unknown>) || {};
  return String(r.id || r.player_id || r.playerId || bio.playerId || '');
};

async function seedCommittedWorld(uid: string): Promise<string> {
  const worldId = await seedSeasonAdvanceReviewWorld(uid, 'Compare Review — MIA Moves');

  // Patch the MIA world team roster: + Darius Kane (addition), - Owen Frost (removal).
  const teamRef = db.doc(`architect_worlds/${worldId}/teams/${TEAM}`);
  const teamSnap = await teamRef.get();
  const team = (teamSnap.data() || {}) as Record<string, unknown>;
  const players = (Array.isArray(team.players) ? team.players : []) as unknown[];
  const withoutFrost = players.filter((p) => idOf(p) !== 'mia_owen_frost');
  const nextPlayers = [...withoutFrost, buildKanePlayer()];
  const activeContracts = (Array.isArray(team.activeContracts) ? team.activeContracts : []).filter(
    (c) => {
      const r = (c || {}) as Record<string, unknown>;
      return String(r.player_id || '') !== 'mia_owen_frost';
    }
  );
  activeContracts.push({
    name: 'Darius Kane',
    player_id: 'mia_darius_kane',
    contract: buildKanePlayer().contract,
    years: 2,
    type: 'MID-LEVEL EXCEPTION',
    signAndTrade: false,
    guaranteed: true,
    isMinimum: false,
    yearsOfService: 5,
  });
  await teamRef.set(
    { players: nextPlayers, roster: nextPlayers, activeContracts },
    { merge: true }
  );

  // Write three committed events (chronological): waive -> extend -> sign.
  const events = [
    buildEvent({
      eventId: 'evt_mia_waive_frost',
      mutationType: 'waivePlayer',
      occurredAt: '2026-07-02T15:00:00.000Z',
      playerId: 'mia_owen_frost',
      playerName: 'Owen Frost',
      summary: 'Waive: Owen Frost',
      before: BEFORE_TOTALS,
      after: MID_TOTALS,
    }),
    buildEvent({
      eventId: 'evt_mia_extend_bennett',
      mutationType: 'extendPlayer',
      occurredAt: '2026-07-03T15:00:00.000Z',
      playerId: 'mia_theo_bennett',
      playerName: 'Theo Bennett',
      summary: 'Extend: Theo Bennett',
      before: MID_TOTALS,
      after: MID_TOTALS,
    }),
    buildEvent({
      eventId: 'evt_mia_sign_kane',
      mutationType: 'signFreeAgent',
      occurredAt: '2026-07-04T15:00:00.000Z',
      playerId: 'mia_darius_kane',
      playerName: 'Darius Kane',
      summary: 'Sign: Darius Kane (MLE)',
      before: MID_TOTALS,
      after: AFTER_TOTALS,
    }),
  ];
  const batch = db.batch();
  for (const ev of events) {
    batch.set(db.doc(`architect_worlds/${worldId}/events/${ev.eventId}`), {
      ...ev,
      worldId,
    });
  }
  // Reflect the committed moves on world metadata (honest counts).
  batch.set(
    db.doc(`architect_worlds/${worldId}`),
    {
      modifiedTeams: [TEAM],
      lastModifiedTeams: [TEAM],
      actionCount: events.length,
      stats: {
        totalTrades: 0,
        totalSignings: 1,
        totalWaives: 1,
        totalRenounces: 0,
        teamsInvolved: 1,
      },
    },
    { merge: true }
  );
  await batch.commit();

  return worldId;
}

async function readUid(page: import('playwright').Page): Promise<string> {
  return page
    .evaluate(
      () =>
        new Promise<string>((resolve) => {
          const req = indexedDB.open('firebaseLocalStorageDb');
          req.onsuccess = () => {
            try {
              const store = req.result
                .transaction('firebaseLocalStorage', 'readonly')
                .objectStore('firebaseLocalStorage');
              const all = store.getAll();
              all.onsuccess = () => {
                const rows = (all.result || []) as Array<{
                  fbase_key?: string;
                  value?: { uid?: string } | string;
                }>;
                const rec = rows.find((r) =>
                  String(r.fbase_key || '').includes('authUser')
                );
                let v: { uid?: string } | string | undefined = rec ? rec.value : undefined;
                if (typeof v === 'string') {
                  try {
                    v = JSON.parse(v) as { uid?: string };
                  } catch {
                    v = undefined;
                  }
                }
                resolve(
                  v && typeof v === 'object' && typeof v.uid === 'string' ? v.uid : ''
                );
              };
              all.onerror = () => resolve('');
            } catch {
              resolve('');
            }
          };
          req.onerror = () => resolve('');
        })
    )
    .catch(() => '');
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  await context.addInitScript(() => {
    window.confirm = () => true;
    // tsx/esbuild --keep-names wraps functions with __name(); that helper is
    // injected in module scope, not the browser, so any page.evaluate closure
    // referencing it throws. Provide an identity shim so evaluates run.
    (window as unknown as { __name?: (fn: unknown) => unknown }).__name = (fn) => fn;
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });

  // 1) Boot so the anonymous uid exists.
  await page.goto(`${BASE}/gm/${TEAM}?room=capfull`, { waitUntil: 'domcontentloaded' });
  await page
    .waitForFunction(() => !/Loading GM Dashboard/i.test(document.body.innerText), {
      timeout: 30000,
    })
    .catch(() => {});
  await page.waitForTimeout(2000);

  let uid = '';
  for (let i = 0; i < 40 && !uid; i++) {
    uid = await readUid(page);
    if (!uid) await page.waitForTimeout(750);
  }
  if (!uid) throw new Error('Could not read anonymous review uid.');
  console.log('review uid:', uid);

  // 2) Seed the saved world with committed moves.
  const worldId = await seedCommittedWorld(uid);
  console.log('seeded worldId:', worldId);

  // 3) Activate the world and open Compare.
  await page.evaluate(
    ({ u, w }) => window.localStorage.setItem(`architect.activeWorldId.${u}`, w),
    { u: uid, w: worldId }
  );
  await page.goto(`${BASE}/gm/${TEAM}?room=compare`, { waitUntil: 'domcontentloaded' });
  await page
    .waitForFunction(() => !/Loading GM Dashboard/i.test(document.body.innerText), {
      timeout: 30000,
    })
    .catch(() => {});
  await page.waitForTimeout(WAIT);

  // 4) Worst-case view: pin left nav rail open with the right activity rail open.
  const pinned = await page.evaluate(() => {
    const expand = document.querySelector('[data-testid="cockpit-activity-rail-expand"]');
    if (expand) (expand as HTMLElement).click();
    const pin = document.querySelector('[data-testid="cockpit-nav-rail-pin"]');
    if (pin) {
      (pin as HTMLElement).click();
      return true;
    }
    return false;
  });
  console.log('nav rail pinned:', pinned);
  await page.waitForTimeout(1200);

  // 5) Measure fit + capture.
  const measure = await page.evaluate(() => {
    const r = (n: number) => Math.round(n * 10) / 10;
    const rect = (el: Element | null) => {
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
    const has = (sel: string) => Boolean(document.querySelector(sel));
    return {
      room: rect(body),
      bodyOverflowsV: body ? body.scrollHeight > body.clientHeight + 1 : null,
      bodyOverflowsH: body ? body.scrollWidth > body.clientWidth + 1 : null,
      docScrollV: docEl.scrollHeight > docEl.clientHeight + 1,
      docScrollH: docEl.scrollWidth > docEl.clientWidth + 1,
      cards: {
        available: has('[data-testid="comparison-available"]'),
        additions: has('[data-testid="comparison-roster-additions"]'),
        removals: has('[data-testid="comparison-roster-removals"]'),
        changed: has('[data-testid="comparison-roster-changed"]'),
        capDelta: has('[data-testid="comparison-cap-delta"]'),
        apronDelta: has('[data-testid="comparison-apron-delta"]'),
      },
      eventCountText:
        document.querySelector('[data-testid="comparison-event-count"]')?.textContent?.trim() ||
        null,
    };
  });

  const shotPath = path.join(OUT_DIR, `${LABEL}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });

  // Also capture the bottom of the room (the Deferred/Unavailable footer that
  // sits just below the fold) so the review covers the whole populated tab.
  await page.evaluate(() => {
    const body = document.querySelector('[data-testid="cockpit-room-frame-body"]');
    if (body) body.scrollTop = body.scrollHeight;
  });
  await page.waitForTimeout(500);
  const bottomShot = path.join(OUT_DIR, `${LABEL}-bottom.png`);
  await page.screenshot({ path: bottomShot, fullPage: false });
  console.log(`SHOT(bottom): ${bottomShot}`);
  const result = {
    url: `${BASE}/gm/${TEAM}?room=compare`,
    label: LABEL,
    worldId,
    drawers: 'both',
    measure,
    consoleErrors: consoleErrors.slice(0, 8),
  };
  fs.writeFileSync(path.join(OUT_DIR, `${LABEL}.json`), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  console.log(`\nSHOT: ${shotPath}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
