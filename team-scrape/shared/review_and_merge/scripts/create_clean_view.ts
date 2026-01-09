#!/usr/bin/env tsx
/**
 * Create Clean View - Team Data Visualization
 * 
 * Removes technical metadata and URLs from merged team data to show
 * a clean view of the structure as it would appear in the UI.
 * 
 * Usage:
 *   npm run clean-view
 *   tsx team-scrape/shared/review_and_merge/scripts/create_clean_view.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Types for the merged data structure
interface MergedTeamData {
  teamCode: string;
  teamName: string;
  season: string;
  roster?: Array<{ displayName: string; sourceUrl: string }>;
  capHolds?: Array<{ displayName: string; sourceUrl?: string; capHoldAmount?: number; type?: string }>;
  exceptions?: {
    mle?: any;
    bae?: any;
    tpe?: any[];
  };
  totals?: Record<string, any>;
  draftPicks?: {
    incoming?: any[];
    outgoing?: any[];
    own?: any[];
    contested?: any[];
  };
  sources?: any;
  mergedAt?: string;
  version?: string;
}

interface CleanTeamData {
  teamCode: string;
  teamName: string;
  season: string;
  summary: {
    rosterCount: number;
    capHoldsCount: number;
    draftPicksCount: number;
  };
  roster: string[];
  capHolds: Array<{
    player: string;
    amount?: string;
    type?: string;
  }>;
  exceptions: {
    mle?: string;
    bae?: string;
    tpe?: Array<{ amount: string; expires?: string }>;
  };
  capSummary?: {
    activeSalary: string;
    capSpace: string;
    luxuryTaxStatus: string;
    firstApronStatus: string;
    secondApronStatus: string;
    rosterCount: number;
  };
  draftPicks: {
    own: string[];
    incoming: string[];
    outgoing: string[];
    contested: string[];
  };
}

// Format currency
function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(2)}M`;
  } else if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

// Format draft pick
function formatDraftPick(pick: any): string {
  const year = pick.year || '????';
  const round = pick.round || '?';
  const protection = pick.protection ? ` (${pick.protection})` : '';
  const swap = pick.isSwap ? ' [SWAP]' : '';
  const via = pick.originalTeam !== pick.owner ? ` via ${pick.originalTeam}` : '';
  return `${year} Round ${round}${via}${protection}${swap}`;
}

// Create clean view of team data
function createCleanView(mergedData: MergedTeamData): CleanTeamData {
  const cleanData: CleanTeamData = {
    teamCode: mergedData.teamCode,
    teamName: mergedData.teamName,
    season: mergedData.season,
    summary: {
      rosterCount: mergedData.roster?.length || 0,
      capHoldsCount: mergedData.capHolds?.length || 0,
      draftPicksCount: Object.values(mergedData.draftPicks || {}).flat().length,
    },
    roster: (mergedData.roster || []).map(p => p.displayName),
    capHolds: (mergedData.capHolds || []).map(ch => ({
      player: ch.displayName,
      amount: ch.capHoldAmount ? formatCurrency(ch.capHoldAmount) : undefined,
      type: ch.type,
    })),
    exceptions: {
      mle: mergedData.exceptions?.mle ? formatCurrency(mergedData.exceptions.mle.amount || 0) : undefined,
      bae: mergedData.exceptions?.bae ? formatCurrency(mergedData.exceptions.bae.amount || 0) : undefined,
      tpe: (mergedData.exceptions?.tpe || []).map(t => ({
        amount: formatCurrency(t.amount || 0),
        expires: t.expires,
      })),
    },
    draftPicks: {
      own: (mergedData.draftPicks?.own || []).map(formatDraftPick),
      incoming: (mergedData.draftPicks?.incoming || []).map(formatDraftPick),
      outgoing: (mergedData.draftPicks?.outgoing || []).map(formatDraftPick),
      contested: (mergedData.draftPicks?.contested || []).map(formatDraftPick),
    },
  };

  // Add cap summary if totals exist
  if (mergedData.totals) {
    const t = mergedData.totals;
    cleanData.capSummary = {
      activeSalary: formatCurrency(t.activeSalary || 0),
      capSpace: formatCurrency(t.capSpace || 0),
      luxuryTaxStatus: t.taxSpace >= 0 ? `Below by ${formatCurrency(t.taxSpace)}` : `Over by ${formatCurrency(Math.abs(t.taxSpace))}`,
      firstApronStatus: t.firstApronTriggered ? 'TRIGGERED' : `Room: ${formatCurrency(t.firstApronRoom || 0)}`,
      secondApronStatus: t.secondApronTriggered ? 'TRIGGERED' : `Room: ${formatCurrency(t.secondApronRoom || 0)}`,
      rosterCount: t.rosterCount || 0,
    };
  }

  return cleanData;
}

// Generate markdown view
function generateMarkdownView(cleanData: CleanTeamData): string {
  const lines: string[] = [];
  
  lines.push(`# ${cleanData.teamName} (${cleanData.teamCode})`);
  lines.push(`**Season:** ${cleanData.season}\n`);
  
  // Summary
  lines.push(`## Summary`);
  lines.push(`- Roster: ${cleanData.summary.rosterCount} players`);
  lines.push(`- Cap Holds: ${cleanData.summary.capHoldsCount} items`);
  lines.push(`- Draft Picks: ${cleanData.summary.draftPicksCount} total\n`);
  
  // Cap Summary
  if (cleanData.capSummary) {
    lines.push(`## Cap Summary`);
    lines.push(`- Active Salary: ${cleanData.capSummary.activeSalary}`);
    lines.push(`- Cap Space: ${cleanData.capSummary.capSpace}`);
    lines.push(`- Luxury Tax: ${cleanData.capSummary.luxuryTaxStatus}`);
    lines.push(`- First Apron: ${cleanData.capSummary.firstApronStatus}`);
    lines.push(`- Second Apron: ${cleanData.capSummary.secondApronStatus}`);
    lines.push(`- Roster Count: ${cleanData.capSummary.rosterCount}\n`);
  }
  
  // Roster
  lines.push(`## Roster (${cleanData.roster.length})`);
  cleanData.roster.forEach((player, i) => {
    lines.push(`${i + 1}. ${player}`);
  });
  lines.push('');
  
  // Cap Holds
  if (cleanData.capHolds.length > 0) {
    lines.push(`## Cap Holds (${cleanData.capHolds.length})`);
    cleanData.capHolds.forEach((ch, i) => {
      const amt = ch.amount ? ` - ${ch.amount}` : '';
      const type = ch.type ? ` [${ch.type}]` : '';
      lines.push(`${i + 1}. ${ch.player}${amt}${type}`);
    });
    lines.push('');
  }
  
  // Exceptions
  if (cleanData.exceptions.mle || cleanData.exceptions.bae || (cleanData.exceptions.tpe && cleanData.exceptions.tpe.length > 0)) {
    lines.push(`## Exceptions`);
    if (cleanData.exceptions.mle) {
      lines.push(`- Mid-Level Exception (MLE): ${cleanData.exceptions.mle}`);
    }
    if (cleanData.exceptions.bae) {
      lines.push(`- Bi-Annual Exception (BAE): ${cleanData.exceptions.bae}`);
    }
    if (cleanData.exceptions.tpe && cleanData.exceptions.tpe.length > 0) {
      lines.push(`- Trade Exceptions (TPE):`);
      cleanData.exceptions.tpe.forEach((tpe, i) => {
        const expires = tpe.expires ? ` (expires ${tpe.expires})` : '';
        lines.push(`  ${i + 1}. ${tpe.amount}${expires}`);
      });
    }
    lines.push('');
  }
  
  // Draft Picks
  lines.push(`## Draft Picks`);
  
  if (cleanData.draftPicks.own.length > 0) {
    lines.push(`\n### Own Picks (${cleanData.draftPicks.own.length})`);
    cleanData.draftPicks.own.forEach((pick, i) => {
      lines.push(`${i + 1}. ${pick}`);
    });
  }
  
  if (cleanData.draftPicks.incoming.length > 0) {
    lines.push(`\n### Incoming Picks (${cleanData.draftPicks.incoming.length})`);
    cleanData.draftPicks.incoming.forEach((pick, i) => {
      lines.push(`${i + 1}. ${pick}`);
    });
  }
  
  if (cleanData.draftPicks.outgoing.length > 0) {
    lines.push(`\n### Outgoing Picks (${cleanData.draftPicks.outgoing.length})`);
    cleanData.draftPicks.outgoing.forEach((pick, i) => {
      lines.push(`${i + 1}. ${pick}`);
    });
  }
  
  if (cleanData.draftPicks.contested.length > 0) {
    lines.push(`\n### Contested/Conditional Picks (${cleanData.draftPicks.contested.length})`);
    cleanData.draftPicks.contested.forEach((pick, i) => {
      lines.push(`${i + 1}. ${pick}`);
    });
  }
  
  lines.push('');
  lines.push('---\n');
  
  return lines.join('\n');
}

// Main execution
async function main() {
  const inputDir = path.join(
    process.cwd(),
    'team-scrape/shared/firestore_staging/output/merged'
  );
  const outputDir = path.join(
    process.cwd(),
    'team-scrape/shared/review_and_merge/out_clean_views'
  );
  
  // Create output directory
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  console.log('📊 Creating clean views of merged team data...\n');
  
  // Process individual team files
  const teamFiles = fs.readdirSync(inputDir).filter(f => 
    f.endsWith('_merged.json') && f !== 'all_teams_merged.json'
  );
  
  const allCleanData: CleanTeamData[] = [];
  let markdownAll = '# Team Data - Clean View\n\n';
  markdownAll += `Generated: ${new Date().toISOString()}\n\n`;
  markdownAll += '---\n\n';
  
  for (const file of teamFiles) {
    const inputPath = path.join(inputDir, file);
    const teamCode = file.replace('_merged.json', '');
    
    console.log(`Processing ${teamCode}...`);
    
    // Read and parse merged data
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const mergedData: MergedTeamData = JSON.parse(rawData);
    
    // Create clean view
    const cleanData = createCleanView(mergedData);
    allCleanData.push(cleanData);
    
    // Write JSON output
    const jsonOutputPath = path.join(outputDir, `${teamCode}_clean.json`);
    fs.writeFileSync(jsonOutputPath, JSON.stringify(cleanData, null, 2));
    console.log(`  ✓ JSON: ${jsonOutputPath}`);
    
    // Generate markdown
    const markdown = generateMarkdownView(cleanData);
    const mdOutputPath = path.join(outputDir, `${teamCode}_clean.md`);
    fs.writeFileSync(mdOutputPath, markdown);
    console.log(`  ✓ Markdown: ${mdOutputPath}`);
    
    // Add to combined markdown
    markdownAll += markdown;
  }
  
  // Write combined files
  const allJsonPath = path.join(outputDir, 'all_teams_clean.json');
  fs.writeFileSync(allJsonPath, JSON.stringify(allCleanData, null, 2));
  console.log(`\n✓ All teams JSON: ${allJsonPath}`);
  
  const allMdPath = path.join(outputDir, 'all_teams_clean.md');
  fs.writeFileSync(allMdPath, markdownAll);
  console.log(`✓ All teams Markdown: ${allMdPath}`);
  
  // Generate summary
  console.log('\n📈 Summary:');
  console.log(`  Teams processed: ${teamFiles.length}`);
  console.log(`  Output directory: ${outputDir}`);
  console.log('\nFiles generated:');
  console.log(`  - ${teamFiles.length} individual JSON files`);
  console.log(`  - ${teamFiles.length} individual Markdown files`);
  console.log(`  - 1 combined JSON file (all_teams_clean.json)`);
  console.log(`  - 1 combined Markdown file (all_teams_clean.md)`);
  console.log('\n✅ Clean views created successfully!');
}

// Run the script
main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
