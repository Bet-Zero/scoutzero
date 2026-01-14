#!/usr/bin/env -S node --experimental-strip-types
/* eslint-disable */
/**
 * Audit: Recipient inventory invariant
 *
 * For every pick mention where:
 *  - raw text contains "To TEAM"
 *  - recipient === TEAM
 *  - raw text does NOT look conditional/swap/protected
 * Then:
 *  - by_team/TEAM inventory must contain the pick
 *  - it must not be only in contested
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts
 *   npx tsx team-scrape/draft-picks/scripts/audit_recipient_inventory_invariant.ts --teams=DAL,LAL
 */

import fs from 'node:fs';
import path from 'node:path';

type Pick = any;

const MENTIONS_DIR_DEFAULT =
  'team-scrape/draft-picks/_artifacts/output/mentions';
const LEDGER_DIR_DEFAULT =
  'team-scrape/shared/firestore_staging/_artifacts/output/ledger/by_team';
const AUDIT_OUT_DIR = 'team-scrape/draft-picks/_artifacts/audits';
const OUT_FILE = path.join(
  AUDIT_OUT_DIR,
  'recipient_inventory_invariant_report.json'
);

const TEAM_CODES = new Set([
  'ATL',
  'BOS',
  'BKN',
  'CHA',
  'CHI',
  'CLE',
  'DAL',
  'DEN',
  'DET',
  'GSW',
  'HOU',
  'IND',
  'LAC',
  'LAL',
  'MEM',
  'MIA',
  'MIL',
  'MIN',
  'NOP',
  'NYK',
  'OKC',
  'ORL',
  'PHI',
  'PHX',
  'POR',
  'SAC',
  'SAS',
  'TOR',
  'UTA',
  'WAS',
]);

const CONDITIONAL_RE =
  /\b(if|unless|protected|swap|most favorable|least favorable|more favorable|less favorable|may convey|conveyable|convey|subject to|then|either|or)\b/i;

const SPLIT_OR_RANGE_RE = /\b\d+\s*-\s*\d+\b/;

function getArg(label: string, def?: string): string | undefined {
  const argv = process.argv.slice(2);
  const prefix = `--${label}=`;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === `--${label}`) {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
  }

  return def;
}

function normalizeCode(code?: string): string {
  return (code || '').toUpperCase().trim();
}

function readJson(filePath: string): Pick[] {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function isUnconditionalTo(pick: Pick, team: string): boolean {
  const rawOriginal = (pick?.metadata?.realgmRawText || '').toString();
  if (!rawOriginal) return false;

  // Treat only truly unconditional "To TEAM ..." rows as candidates.
  // Important: many RealGM rows contain multiple clauses ("Own; ... to TEAM") or
  // conditional/protected/swap language. Those are NOT in-scope for this invariant.
  const raw = rawOriginal.replace(/\s+/g, ' ').trim();

  const recipient = normalizeCode(pick?.recipient);
  const owner = normalizeCode(pick?.owner);
  if (recipient !== team) return false;

  // Require the row to start with "To TEAM" (not somewhere mid-sentence).
  if (!new RegExp(`^To\\s+${team}\\b`, 'i').test(raw)) return false;

  // Require ownership signal to align; otherwise this is likely a partial/conditional clause.
  if (owner !== team) return false;

  // Exclude obvious non-unconditional cases.
  if (raw.includes(';')) return false;
  if (SPLIT_OR_RANGE_RE.test(raw)) return false;
  if (CONDITIONAL_RE.test(raw)) return false;

  return true;
}

type LedgerIndex = {
  inventory: Set<string>;
  obligations: Set<string>;
  contested: Set<string>;
  byId: Map<string, Pick>;
  missing: boolean;
};

const ledgerCache = new Map<string, LedgerIndex>();

function loadLedgerIndex(team: string, ledgerDir: string): LedgerIndex {
  const cached = ledgerCache.get(team);
  if (cached) return cached;

  const ledgerPath = path.join(ledgerDir, `${team}.json`);
  if (!fs.existsSync(ledgerPath)) {
    const missingIndex = {
      inventory: new Set<string>(),
      obligations: new Set<string>(),
      contested: new Set<string>(),
      byId: new Map<string, Pick>(),
      missing: true,
    };
    ledgerCache.set(team, missingIndex);
    return missingIndex;
  }

  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const inventory = new Set<string>();
  const obligations = new Set<string>();
  const contested = new Set<string>();
  const byId = new Map<string, Pick>();

  for (const p of ledger.inventory || []) {
    if (p?.id) inventory.add(p.id);
    if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
  }
  for (const p of ledger.obligations || []) {
    if (p?.id) obligations.add(p.id);
    if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
  }
  for (const p of ledger.contested || []) {
    if (p?.id) contested.add(p.id);
    if (p?.id && !byId.has(p.id)) byId.set(p.id, p);
  }

  const index = { inventory, obligations, contested, byId, missing: false };
  ledgerCache.set(team, index);
  return index;
}

function main() {
  const mentionsDir = getArg('mentionsDir', MENTIONS_DIR_DEFAULT)!;
  const ledgerDir = getArg('ledgerDir', LEDGER_DIR_DEFAULT)!;
  const teamsArg = getArg('teams', 'ALL')!;
  const teams =
    teamsArg === 'ALL'
      ? null
      : new Set(
          teamsArg
            .split(',')
            .map((t) => normalizeCode(t))
            .filter(Boolean)
        );

  if (!fs.existsSync(mentionsDir)) {
    console.error(`Missing mentions directory: ${mentionsDir}`);
    process.exit(1);
  }

  const mentionFiles = fs
    .readdirSync(mentionsDir)
    .filter(
      (f) => f.startsWith('draft_picks_mentions_') && f.endsWith('.json')
    );

  if (mentionFiles.length === 0) {
    console.error(`No mentions files found in: ${mentionsDir}`);
    process.exit(1);
  }

  let picksScanned = 0;
  let candidates = 0;
  const failures: Array<Record<string, unknown>> = [];
  const teamsSeen = new Set<string>();

  for (const file of mentionFiles) {
    const teamCode = normalizeCode(
      file.replace('draft_picks_mentions_', '').replace('.json', '')
    );
    if (teams && !teams.has(teamCode)) continue;
    teamsSeen.add(teamCode);

    const filePath = path.join(mentionsDir, file);
    const picks = readJson(filePath);
    if (!Array.isArray(picks)) continue;

    for (const pick of picks) {
      picksScanned += 1;
      const recipient = normalizeCode(pick?.recipient);
      if (!recipient || !TEAM_CODES.has(recipient)) continue;
      if (!isUnconditionalTo(pick, recipient)) continue;

      candidates += 1;
      const ledgerIndex = loadLedgerIndex(recipient, ledgerDir);
      const pickId = pick?.id;
      const inInventory = pickId ? ledgerIndex.inventory.has(pickId) : false;
      const inObligations = pickId
        ? ledgerIndex.obligations.has(pickId)
        : false;
      const inContested = pickId ? ledgerIndex.contested.has(pickId) : false;
      const bucketsFound = [
        inInventory ? 'inventory' : null,
        inObligations ? 'obligations' : null,
        inContested ? 'contested' : null,
      ].filter(Boolean);

      if (!inInventory) {
        const ledgerPick = pickId ? ledgerIndex.byId.get(pickId) : undefined;
        failures.push({
          id: pick?.id,
          year: pick?.year,
          round: pick?.round,
          srcTeamPage: pick?.metadata?.realgmTeamPage,
          recipient: pick?.recipient,
          owner: pick?.owner,
          status: pick?.status,
          relation: ledgerPick?.relation ?? null,
          raw: pick?.metadata?.realgmRawText,
          landed: bucketsFound[0] || 'not_found',
          bucketsFound,
          ledgerMissing: ledgerIndex.missing,
        });
      }
    }
  }

  const summary = {
    mentionsDir,
    ledgerDir,
    teamsAudited: teamsSeen.size,
    picksScanned,
    candidatesChecked: candidates,
    failures: failures.length,
  };

  fs.mkdirSync(AUDIT_OUT_DIR, { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ summary, failures }, null, 2),
    'utf8'
  );

  console.log('\n=== RECIPIENT INVENTORY INVARIANT AUDIT ===');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nWrote: ${OUT_FILE}`);

  if (failures.length > 0) {
    console.error(`\n❌ Invariant violations found: ${failures.length}`);
    for (const f of failures.slice(0, 10)) {
      console.error(
        `  - ${String(f.id)} (src=${String(f.srcTeamPage)} recipient=${String(
          f.recipient
        )} landed=${String(f.landed)})`
      );
    }
    if (failures.length > 10) {
      console.error(`  ... and ${failures.length - 10} more`);
    }
    process.exit(1);
  }

  console.log('\n✅ Invariant satisfied.');
}

main();
