#!/usr/bin/env tsx
/**
 * pst_generate_test_data.ts
 *
 * Generates test data for Phase 4 development.
 * Creates mock Phase 2 ledger and Phase 3 normalized rows
 * with realistic encumbrance patterns.
 *
 * Usage:
 *   npx tsx team-scrape/draft-picks/scripts/pst/pst_generate_test_data.ts
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_TEAM_CODES } from './pst_team_slugs';
import { processRowText } from './pst_text_features';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const DATA_DIR = path.join(PROJECT_ROOT, 'data', 'pst');

// Year range
const START_YEAR = 2026;
const END_YEAR = 2033;

// Sample encumbrance texts for realistic testing
const SAMPLE_ENCUMBRANCES = {
  protections: [
    { team: 'LAL', year: 2026, round: 1, text: 'To Pelicans - Protected top 4 in 2026' },
    { team: 'DAL', year: 2027, round: 1, text: 'To Knicks - Protected 1-10 in 2027, becomes 2028 first round pick if not conveyed' },
    { team: 'PHX', year: 2026, round: 1, text: 'To Wizards - Lottery protected through 2026-27' },
    { team: 'BKN', year: 2028, round: 1, text: 'To Rockets - Top 3 protected in 2028' },
    { team: 'UTA', year: 2027, round: 1, text: 'To Thunder - Protected top 10 in 2027' },
    { team: 'WAS', year: 2029, round: 1, text: 'To Hawks - Protected 1-14 (lottery) in 2029' },
    { team: 'POR', year: 2026, round: 2, text: 'To Bulls - Protected top 55 in 2026' },
    { team: 'TOR', year: 2028, round: 1, text: 'To Spurs - Top 6 protected in 2028, if not conveyed becomes unprotected 2029 first round' },
  ],
  swaps: [
    { team: 'CLE', year: 2027, round: 1, text: 'Thunder has option to swap first round picks with Cavaliers in 2027' },
    { team: 'HOU', year: 2028, round: 1, text: 'Thunder has right to swap with Rockets or Clippers - most favorable of Houston, LA Clippers picks' },
    { team: 'NOP', year: 2026, round: 1, text: 'Lakers have right to swap first round picks with Pelicans' },
    { team: 'ATL', year: 2029, round: 1, text: 'Spurs option to swap with Hawks - least favorable of Hawks, Magic, Pistons picks' },
    { team: 'OKC', year: 2027, round: 1, text: 'Thunder can swap with multiple teams - option to swap Houston, Clippers, Bucks picks' },
    { team: 'MIA', year: 2027, round: 1, text: 'Celtics right to swap first round pick with Heat' },
  ],
  conveyance: [
    { team: 'MIN', year: 2028, round: 1, text: 'To Warriors - If pick does not convey, becomes 2029 second round pick' },
    { team: 'SAC', year: 2027, round: 1, text: 'Protected top 12. If not conveyed in 2027, converts to 2028 first round pick protected top 10' },
    { team: 'IND', year: 2029, round: 1, text: 'If protection is not met, else receives unprotected 2030 first round' },
  ],
  didNotConvey: [
    { team: 'CHI', year: 2025, round: 1, text: 'Did not convey - fell in lottery (pick #9)', rowKind: 'condition_not_met' as const },
    { team: 'DET', year: 2025, round: 1, text: 'Protection exercised - pick was top 10', rowKind: 'condition_not_met' as const },
  ],
  ownPicks: [
    { team: 'BOS', year: 2026, round: 1, text: '' },
    { team: 'MIL', year: 2027, round: 1, text: '' },
    { team: 'DEN', year: 2028, round: 1, text: '' },
  ],
};

interface BaseLedgerItem {
  pickId: string;
  originalTeam: string;
  year: number;
  round: 1 | 2;
  owner: string;
  ownershipSource: 'BASE' | 'PST_DISPLAY';
  rowKind?: string;
  provenance?: {
    sourceTeamPage: string;
    sourceUrl: string;
    snapshotPath: string;
    rowRef: string;
  };
}

interface NormalizedRow {
  pickId: string;
  year: number;
  round: 1 | 2;
  roundSuffix: '1st' | '2nd';
  originalTeam: string;
  displayOwner: string;
  rowKind: string;
  rawText: string;
  normalizedText: string;
  textHash: string;
  detectedTeamCodes: string[];
  detectedYears: number[];
  detectedRounds: (1 | 2)[];
  detectedPickRefs: string[];
  flags: {
    mentionsSwap: boolean;
    mentionsProtection: boolean;
    mentionsConveyance: boolean;
    mentionsLeastMostFavorable: boolean;
    mentionsDidNotConvey: boolean;
    mentionsCash: boolean;
    mentionsRights: boolean;
  };
  provenance: {
    source: string;
    sourceUrl: string;
    sourceTeamPage: string;
    snapshotPath: string;
    rowRef: string;
  };
}

async function main() {
  console.log('Generating Phase 4 test data...\n');

  await fs.mkdir(DATA_DIR, { recursive: true });

  // 1. Generate base ledger (480 picks)
  const baseLedger: BaseLedgerItem[] = [];
  const normalizedRows: NormalizedRow[] = [];

  // Create a map of encumbrances by key
  const encumbranceMap = new Map<string, { text: string; owner: string; rowKind: string }>();

  // Add protection encumbrances
  for (const p of SAMPLE_ENCUMBRANCES.protections) {
    const key = `${p.team}_${p.year}_${p.round === 1 ? '1st' : '2nd'}`;
    // Extract recipient team from text
    const recipientMatch = p.text.match(/To\s+(\w+)/i);
    const owner = recipientMatch ? extractTeamCode(recipientMatch[1]) || p.team : p.team;
    encumbranceMap.set(key, { text: p.text, owner, rowKind: 'transaction' });
  }

  // Add swap encumbrances
  for (const s of SAMPLE_ENCUMBRANCES.swaps) {
    const key = `${s.team}_${s.year}_${s.round === 1 ? '1st' : '2nd'}`;
    encumbranceMap.set(key, { text: s.text, owner: s.team, rowKind: 'transaction' });
  }

  // Add conveyance encumbrances
  for (const c of SAMPLE_ENCUMBRANCES.conveyance) {
    const key = `${c.team}_${c.year}_${c.round === 1 ? '1st' : '2nd'}`;
    if (!encumbranceMap.has(key)) {
      encumbranceMap.set(key, { text: c.text, owner: c.team, rowKind: 'transaction' });
    }
  }

  let rowIndex = 0;

  // Generate all 480 picks
  for (let year = START_YEAR; year <= END_YEAR; year++) {
    for (const round of [1, 2] as const) {
      for (const teamCode of ALL_TEAM_CODES) {
        const roundSuffix = round === 1 ? '1st' : '2nd';
        const pickId = `${teamCode}_${year}_${roundSuffix}`;

        const encumbrance = encumbranceMap.get(pickId);
        const hasEncumbrance = !!encumbrance;

        // Create base ledger entry
        const basePick: BaseLedgerItem = {
          pickId,
          originalTeam: teamCode,
          year,
          round,
          owner: hasEncumbrance ? encumbrance.owner : teamCode,
          ownershipSource: hasEncumbrance ? 'PST_DISPLAY' : 'BASE',
        };

        if (hasEncumbrance) {
          basePick.rowKind = encumbrance.rowKind;
          basePick.provenance = {
            sourceTeamPage: teamCode,
            sourceUrl: `https://www.prosportstransactions.com/basketball/DraftTrades/Future/${teamCode}.htm`,
            snapshotPath: `data/pst/pages/${teamCode}.html`,
            rowRef: `r${++rowIndex}`,
          };
        }

        baseLedger.push(basePick);

        // Create normalized row if there's text
        if (hasEncumbrance && encumbrance.text) {
          const features = processRowText(encumbrance.text);

          const normRow: NormalizedRow = {
            pickId,
            year,
            round,
            roundSuffix,
            originalTeam: teamCode,
            displayOwner: encumbrance.owner,
            rowKind: encumbrance.rowKind,
            rawText: encumbrance.text,
            normalizedText: features.normalizedText,
            textHash: features.textHash,
            detectedTeamCodes: features.detectedTeamCodes,
            detectedYears: features.detectedYears,
            detectedRounds: features.detectedRounds,
            detectedPickRefs: features.detectedPickRefs,
            flags: features.flags,
            provenance: {
              source: 'PST',
              sourceUrl: `https://www.prosportstransactions.com/basketball/DraftTrades/Future/${teamCode}.htm`,
              sourceTeamPage: teamCode,
              snapshotPath: `data/pst/pages/${teamCode}.html`,
              rowRef: `r${rowIndex}`,
            },
          };

          normalizedRows.push(normRow);
        }
      }
    }
  }

  // Add did-not-convey rows (these are from past years but we include for testing)
  for (const dnc of SAMPLE_ENCUMBRANCES.didNotConvey) {
    rowIndex++;
    const roundSuffix = dnc.round === 1 ? '1st' : '2nd';
    const pickId = `${dnc.team}_${dnc.year}_${roundSuffix}`;
    const features = processRowText(dnc.text);

    // Only add normalized row, not base ledger (past year)
    normalizedRows.push({
      pickId,
      year: dnc.year,
      round: dnc.round as 1 | 2,
      roundSuffix: roundSuffix as '1st' | '2nd',
      originalTeam: dnc.team,
      displayOwner: dnc.team,
      rowKind: dnc.rowKind,
      rawText: dnc.text,
      normalizedText: features.normalizedText,
      textHash: features.textHash,
      detectedTeamCodes: features.detectedTeamCodes,
      detectedYears: features.detectedYears,
      detectedRounds: features.detectedRounds,
      detectedPickRefs: features.detectedPickRefs,
      flags: features.flags,
      provenance: {
        source: 'PST',
        sourceUrl: `https://www.prosportstransactions.com/basketball/DraftTrades/Future/${dnc.team}.htm`,
        sourceTeamPage: dnc.team,
        snapshotPath: `data/pst/pages/${dnc.team}.html`,
        rowRef: `r${rowIndex}`,
      },
    });
  }

  // Write outputs
  const baseLedgerPath = path.join(DATA_DIR, 'pst_ledger_with_display_owner.json');
  const normalizedRowsPath = path.join(DATA_DIR, 'pst_phase_3_normalized_rows.json');

  await fs.writeFile(baseLedgerPath, JSON.stringify(baseLedger, null, 2));
  console.log(`✓ Base ledger: ${baseLedgerPath}`);
  console.log(`  Count: ${baseLedger.length}`);

  await fs.writeFile(normalizedRowsPath, JSON.stringify(normalizedRows, null, 2));
  console.log(`✓ Normalized rows: ${normalizedRowsPath}`);
  console.log(`  Count: ${normalizedRows.length}`);

  console.log('\n✅ Test data generated successfully!');
  console.log('   Run: npm run pst:phase-4');
}

function extractTeamCode(label: string): string | undefined {
  const teamMap: Record<string, string> = {
    Pelicans: 'NOP',
    Knicks: 'NYK',
    Wizards: 'WAS',
    Rockets: 'HOU',
    Thunder: 'OKC',
    Hawks: 'ATL',
    Bulls: 'CHI',
    Spurs: 'SAS',
    Warriors: 'GSW',
    Celtics: 'BOS',
    Clippers: 'LAC',
    Lakers: 'LAL',
    Heat: 'MIA',
  };
  return teamMap[label];
}

main().catch(console.error);
