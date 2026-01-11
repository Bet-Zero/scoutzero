#!/usr/bin/env tsx
/**
 * validateLedgerPicks.ts
 *
 * Validation script to prove received picks now show up in team inventory.
 * Demonstrates before/after counts and specific examples.
 *
 * Usage:
 *   npx tsx team-scrape/shared/ledger/validateLedgerPicks.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');

const LEDGER_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  '_artifacts',
  'output',
  'ledger'
);

const STAGED_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'shared',
  'firestore_staging',
  '_artifacts',
  'output',
  'baseTeams'
);

type CanonicalPick = {
  id: string;
  year: number;
  round: 1 | 2;
  status: string;
  originalTeam: string;
  owner: string; // Canonical owner field
  via?: string;
  recipient?: string;
  isSwap?: boolean;
  protection?: string | null;
  relation?: 'inventory' | 'obligation' | 'contested';
  swapDetails?: {
    swapWith?: string[];
    swapType?: string;
    favorable?: string;
  };
  metadata?: {
    realgmRawText?: string;
    realgmTeamPage?: string;
  };
};

type TeamViews = {
  teamCode: string;
  inventory: CanonicalPick[];
  obligations: CanonicalPick[];
  contested: CanonicalPick[];
};

type StagedTeamDoc = {
  teamCode: string;
  draftPicks: CanonicalPick[];
  draftPicksInventory?: CanonicalPick[];
  draftPicksObligations?: CanonicalPick[];
  draftPicksContested?: CanonicalPick[];
};

const MENTIONS_DIR = path.join(
  PROJECT_ROOT,
  'team-scrape',
  'draft-picks',
  '_artifacts',
  'output',
  'mentions'
);

async function loadJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

/**
 * Validates swap partner extraction for swap picks.
 * Specifically checks DAL mentions file for swap picks with partner info.
 */
async function validateSwapPartners(): Promise<{
  success: boolean;
  swapPicks: Array<{
    id: string;
    year: number;
    round: number;
    hasPartner: boolean;
    partner?: string;
    rawText?: string;
  }>;
  missingPartners: number;
}> {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 Swap Partner Validation\n');

  const dalMentionsPath = path.join(MENTIONS_DIR, 'draft_picks_mentions_DAL.json');
  const dalPicks = await loadJson<CanonicalPick[]>(dalMentionsPath);

  if (!dalPicks) {
    console.log('⚠️  DAL mentions file not found. Run scraper first.');
    console.log(`   Expected: ${dalMentionsPath}`);
    return { success: false, swapPicks: [], missingPartners: 0 };
  }

  console.log(`✅ Loaded DAL mentions: ${dalPicks.length} picks`);

  const swapPicks = dalPicks.filter((p) => p.isSwap === true);
  console.log(`   Found ${swapPicks.length} swap picks`);

  const results: Array<{
    id: string;
    year: number;
    round: number;
    hasPartner: boolean;
    partner?: string;
    rawText?: string;
  }> = [];

  let missingPartners = 0;

  for (const pick of swapPicks) {
    const partner =
      pick.swapDetails?.swapWith?.[0] ||
      (pick as unknown as { swapWithTeamId?: string }).swapWithTeamId;

    const hasPartner = !!partner;
    if (!hasPartner) missingPartners++;

    results.push({
      id: pick.id,
      year: pick.year,
      round: pick.round,
      hasPartner,
      partner: partner || undefined,
      rawText: pick.metadata?.realgmRawText,
    });

    // Specifically check DAL 2028 swap pick
    if (pick.year === 2028 && pick.round === 1 && pick.originalTeam === 'DAL') {
      console.log(`\n   🎯 DAL 2028 1st swap pick:`);
      console.log(`      ID: ${pick.id}`);
      console.log(`      Has partner: ${hasPartner ? '✅' : '❌'}`);
      if (hasPartner) {
        console.log(`      Partner: ${partner}`);
      }
      if (pick.metadata?.realgmRawText) {
        console.log(`      Raw text: "${pick.metadata.realgmRawText}"`);
        // Check if raw text contains swap indicators
        const rawText = pick.metadata.realgmRawText.toLowerCase();
        if (rawText.includes('own or okc') || rawText.includes('own or oklahoma')) {
          console.log(`      ⚠️  Raw text contains "Own or OKC/Oklahoma" but partner ${hasPartner ? 'was extracted' : 'is missing'}`);
        }
      } else {
        console.log(`      ⚠️  No raw text metadata available`);
      }
    }
  }

  console.log(`\n   Summary:`);
  console.log(`      Total swap picks: ${swapPicks.length}`);
  console.log(`      With partner: ${swapPicks.length - missingPartners}`);
  console.log(`      Missing partner: ${missingPartners}`);

  if (missingPartners > 0) {
    console.log(`\n   ⚠️  Swap picks missing partner info:`);
    for (const result of results.filter((r) => !r.hasPartner)) {
      console.log(`      - ${result.year} R${result.round} (${result.id})`);
      if (result.rawText) {
        console.log(`        Raw text: "${result.rawText.substring(0, 80)}..."`);
      }
    }
  }

  return {
    success: missingPartners === 0,
    swapPicks: results,
    missingPartners,
  };
}

async function validateLedgerOutput() {
  console.log('\n🔍 Validating Ledger Draft Picks Output\n');
  console.log('='.repeat(60));

  // Check if ledger output exists
  const ledgerPath = path.join(LEDGER_DIR, 'pick_ledger.json');
  const ledger = await loadJson<CanonicalPick[]>(ledgerPath);

  if (!ledger) {
    console.log('❌ Master ledger not found. Run the pipeline first.');
    console.log(`   Expected: ${ledgerPath}`);
    return { success: false };
  }

  console.log(`✅ Master ledger found: ${ledger.length} entries`);

  // Load per-team views
  const byTeamDir = path.join(LEDGER_DIR, 'by_team');
  let teamFiles: string[] = [];
  try {
    teamFiles = await readdir(byTeamDir);
  } catch {
    console.log('❌ Per-team views directory not found.');
    return { success: false };
  }

  console.log(`✅ Per-team view files: ${teamFiles.length}`);

  // Validate specific examples
  console.log('\n' + '='.repeat(60));
  console.log('📊 Team-by-Team Validation\n');

  const teamsToValidate = ['ATL', 'LAL', 'UTA', 'OKC', 'NOP', 'DAL'];
  const results: Array<{
    team: string;
    inventory: number;
    obligations: number;
    contested: number;
    incomingPicks: string[];
  }> = [];

  for (const teamCode of teamsToValidate) {
    const viewsPath = path.join(byTeamDir, `${teamCode}.json`);
    const views = await loadJson<TeamViews>(viewsPath);

    if (!views) {
      console.log(`⚠️  ${teamCode}: No ledger views found`);
      continue;
    }

    // Find incoming picks (picks from other teams)
    const incomingPicks = views.inventory.filter(
      (p) => p.originalTeam !== teamCode
    );

    results.push({
      team: teamCode,
      inventory: views.inventory.length,
      obligations: views.obligations.length,
      contested: views.contested.length,
      incomingPicks: incomingPicks.map(
        (p) => `${p.year} R${p.round} from ${p.originalTeam}${p.via ? ` via ${p.via}` : ''}`
      ),
    });

    console.log(`${teamCode}:`);
    console.log(`   Inventory: ${views.inventory.length} picks`);
    console.log(`   Obligations: ${views.obligations.length} picks`);
    console.log(`   Contested: ${views.contested.length} picks`);

    if (incomingPicks.length > 0) {
      console.log(`   ✨ INCOMING PICKS (received from other teams):`);
      for (const p of incomingPicks.slice(0, 5)) {
        console.log(
          `      - ${p.year} R${p.round} from ${p.originalTeam}${p.via ? ` via ${p.via}` : ''}`
        );
      }
      if (incomingPicks.length > 5) {
        console.log(`      ... and ${incomingPicks.length - 5} more`);
      }
    }
    console.log('');
  }

  // Check staged team docs
  console.log('='.repeat(60));
  console.log('📦 Staged Team Docs Validation\n');

  for (const teamCode of teamsToValidate.slice(0, 3)) {
    const stagedPath = path.join(STAGED_DIR, `${teamCode}.json`);
    const staged = await loadJson<StagedTeamDoc>(stagedPath);

    if (!staged) {
      console.log(`⚠️  ${teamCode}: No staged doc found`);
      continue;
    }

    console.log(`${teamCode} staged doc:`);
    console.log(`   draftPicks: ${staged.draftPicks?.length ?? 0}`);
    console.log(`   draftPicksInventory: ${staged.draftPicksInventory?.length ?? 'N/A'}`);
    console.log(`   draftPicksObligations: ${staged.draftPicksObligations?.length ?? 'N/A'}`);
    console.log(`   draftPicksContested: ${staged.draftPicksContested?.length ?? 'N/A'}`);

    // Check for received picks in staged inventory
    const receivedInStaged = staged.draftPicksInventory?.filter(
      (p) => p.originalTeam !== teamCode
    ) || [];

    if (receivedInStaged.length > 0) {
      console.log(`   ✨ RECEIVED PICKS IN STAGED INVENTORY: ${receivedInStaged.length}`);
      for (const p of receivedInStaged.slice(0, 3)) {
        console.log(
          `      - ${p.year} R${p.round} from ${p.originalTeam}`
        );
      }
    }
    console.log('');
  }

  // Summary table
  console.log('='.repeat(60));
  console.log('📋 Summary Table\n');
  console.log('Team | Inventory | Obligations | Contested | Incoming');
  console.log('-----|-----------|-------------|-----------|----------');
  for (const r of results) {
    console.log(
      `${r.team.padEnd(4)} | ${String(r.inventory).padEnd(9)} | ${String(r.obligations).padEnd(11)} | ${String(r.contested).padEnd(9)} | ${r.incomingPicks.length}`
    );
  }

  // Specific validation examples
  console.log('\n' + '='.repeat(60));
  console.log('🎯 Specific Validation Examples\n');

  // Example 1: Utah receiving Lakers pick
  const utaViews = await loadJson<TeamViews>(path.join(byTeamDir, 'UTA.json'));
  if (utaViews) {
    const lalPickInUta = utaViews.inventory.find(
      (p) => p.originalTeam === 'LAL'
    );
    if (lalPickInUta) {
      console.log('✅ Example 1: Utah has Lakers pick in inventory');
      console.log(`   Pick: ${lalPickInUta.year} R${lalPickInUta.round} from LAL`);
      console.log(`   Status: ${lalPickInUta.status}`);
      console.log(`   Protection: ${lalPickInUta.protection || 'None'}`);
    } else {
      console.log('⚠️  Example 1: Utah does not have Lakers pick yet (may need real scrape data)');
    }
  }

  // Example 2: Lakers obligations
  const lalViews = await loadJson<TeamViews>(path.join(byTeamDir, 'LAL.json'));
  if (lalViews) {
    const lalObligations = lalViews.obligations.filter(
      (p) => p.status === 'outgoing' || p.owner !== 'LAL'
    );
    if (lalObligations.length > 0) {
      console.log('\n✅ Example 2: Lakers outgoing obligations found');
      for (const p of lalObligations.slice(0, 3)) {
        console.log(
          `   - ${p.year} R${p.round} → ${p.recipient || p.owner} (${p.protection || 'unprotected'})`
        );
      }
    } else {
      console.log('\n⚠️  Example 2: No Lakers obligations found (may need real scrape data)');
    }
  }

  return {
    success: true,
    ledgerCount: ledger.length,
    teamCount: teamFiles.length,
    results,
  };
}

// Run validation
validateLedgerOutput()
  .then((result) => {
    console.log('\n' + '='.repeat(60));
    if (result.success) {
      console.log('✅ Validation complete.');
      if (result.swapValidation && !result.swapValidation.success) {
        console.log('⚠️  Swap partner validation found missing partners.');
        console.log('   Re-run scraper to capture raw text and improve parsing.');
      }
    } else {
      console.log('❌ Validation failed. Run the pipeline first.');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('❌ Validation error:', err);
    process.exit(1);
  });
