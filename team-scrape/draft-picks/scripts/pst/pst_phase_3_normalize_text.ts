
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { processRowText } from './pst_text_features';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const DATA_DIR = path.resolve(__dirname, '../../../../data/pst');
const RAW_ROWS_PATH = path.join(DATA_DIR, 'pst_raw_rows.json');
const OUTPUT_ROWS_PATH = path.join(DATA_DIR, 'pst_phase_3_normalized_rows.json');
const REPORT_PATH = path.join(DATA_DIR, 'pst_phase_3_report.json');

// Years window
const START_YEAR = 2026;
const END_YEAR = 2033;

interface RawRow {
  year: number;
  round: 1 | 2;
  originalTeam: string;
  displayOwner: string;
  rawText: string;
  rowKind: 'own' | 'transaction' | 'condition_not_met';
  source: string;
  sourceUrl: string;
  sourceTeamPage: string;
  snapshotPath: string;
  rowRef: string;
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
  console.log('Starting Phase 3: Text Normalization...');
  
  // 1. Read Inputs
  console.log(`Reading raw rows from ${RAW_ROWS_PATH}...`);
  const rawData = JSON.parse(await fs.readFile(RAW_ROWS_PATH, 'utf-8'));
  const rawRows: RawRow[] = rawData.rows;
  
  // 2. Filter & Process
  console.log(`Processing rows for years ${START_YEAR}-${END_YEAR}...`);
  
  const normalizedRows: NormalizedRow[] = [];
  const anomalies: any[] = [];
  
  // Stats counters
  const stats = {
    totalProcessed: 0,
    byRowKind: { own: 0, transaction: 0, condition_not_met: 0 } as Record<string, number>,
    teamMentions: {} as Record<string, number>,
    flags: {
        mentionsSwap: 0,
        mentionsProtection: 0,
        mentionsConveyance: 0,
        mentionsLeastMostFavorable: 0,
        mentionsDidNotConvey: 0,
        mentionsCash: 0,
        mentionsRights: 0
    } as Record<string, number>,
    rowsWithPickRefs: 0
  };

  for (const row of rawRows) {
    if (row.year < START_YEAR || row.year > END_YEAR) continue;
    
    // Process text features
    const features = processRowText(row.rawText);
    
    // Construct Pick ID
    const roundSuffix = row.round === 1 ? '1st' : '2nd';
    const pickId = `${row.originalTeam}_${row.year}_${roundSuffix}`;
    
    // Validation: own rows should have empty normalized text
    if (row.rowKind === 'own' && features.normalizedText.length > 0) {
      // This might happen if extraction was sloppy, but strict extraction should have handled it.
      // We will warn but keep it.
      console.warn(`[WARN] 'own' row has text: ${pickId} -> "${features.normalizedText}"`);
      anomalies.push({ type: 'OWN_HAS_TEXT', pickId, text: features.normalizedText });
    }
    
    // Validation: transaction/conditional should have text
    if (row.rowKind !== 'own' && features.normalizedText.length === 0) {
       console.warn(`[WARN] '${row.rowKind}' row has NO text: ${pickId}`);
       anomalies.push({ type: 'NON_OWN_EMPTY_TEXT', pickId });
    }

    const normRow: NormalizedRow = {
      pickId,
      year: row.year,
      round: row.round,
      roundSuffix,
      originalTeam: row.originalTeam,
      displayOwner: row.displayOwner,
      rowKind: row.rowKind,
      
      rawText: row.rawText,
      normalizedText: features.normalizedText,
      textHash: features.textHash,
      
      detectedTeamCodes: features.detectedTeamCodes,
      detectedYears: features.detectedYears,
      detectedRounds: features.detectedRounds,
      detectedPickRefs: features.detectedPickRefs,
      
      flags: features.flags,
      
      provenance: {
        source: 'PST',
        sourceUrl: row.sourceUrl,
        sourceTeamPage: row.sourceTeamPage,
        snapshotPath: row.snapshotPath,
        rowRef: row.rowRef
      }
    };
    
    normalizedRows.push(normRow);
    
    // Update Stats
    stats.totalProcessed++;
    stats.byRowKind[row.rowKind] = (stats.byRowKind[row.rowKind] || 0) + 1;
    
    features.detectedTeamCodes.forEach(t => {
       // Exclude self/original if desirable, but simple count is fine for now
       if (t !== row.displayOwner && t !== row.originalTeam) {
          stats.teamMentions[t] = (stats.teamMentions[t] || 0) + 1;
       }
    });
    
    if (features.detectedPickRefs.length > 0) stats.rowsWithPickRefs++;
    
    if (features.flags.mentionsSwap) stats.flags.mentionsSwap++;
    if (features.flags.mentionsProtection) stats.flags.mentionsProtection++;
    if (features.flags.mentionsConveyance) stats.flags.mentionsConveyance++;
    if (features.flags.mentionsLeastMostFavorable) stats.flags.mentionsLeastMostFavorable++;
    if (features.flags.mentionsDidNotConvey) stats.flags.mentionsDidNotConvey++;
    if (features.flags.mentionsCash) stats.flags.mentionsCash++;
    if (features.flags.mentionsRights) stats.flags.mentionsRights++;
  }
  
  // 3. Write Outputs
  const report = {
    generatedAt: new Date().toISOString(),
    stats: {
        totalRows: stats.totalProcessed,
        byRowKind: stats.byRowKind,
        top20TeamMentions: Object.entries(stats.teamMentions)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20),
        flags: stats.flags,
        rowsWithPickRefs: stats.rowsWithPickRefs
    },
    anomalies: anomalies
  };
  
  console.log(`Writing ${normalizedRows.length} rows to ${OUTPUT_ROWS_PATH}...`);
  await fs.writeFile(OUTPUT_ROWS_PATH, JSON.stringify(normalizedRows, null, 2));
  
  console.log(`Writing report to ${REPORT_PATH}...`);
  await fs.writeFile(REPORT_PATH, JSON.stringify(report, null, 2));
  
  console.log('Phase 3 COMPLETE.');
}

main().catch(console.error);
