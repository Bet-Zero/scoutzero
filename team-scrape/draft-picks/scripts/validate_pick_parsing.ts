#!/usr/bin/env -S node --experimental-strip-types
/**
 * Validation Script for Draft Pick Parsing
 * 
 * Tests the parsing logic against existing raw data to verify:
 * - No duplicate IDs
 * - Correct status assignment (incoming vs own)
 * - Correct originalTeam assignment
 * - No team has multiple "own" picks for same year/round
 * 
 * Run: npx tsx team-scrape/draft-picks/scripts/validate_pick_parsing.ts
 */

import fs from 'node:fs';
import path from 'node:path';

interface Pick {
  id: string;
  year: number;
  round: number;
  status: string;
  originalTeam: string;
  owner: string; // Canonical owner field
  via?: string;
}

interface ValidationIssue {
  severity: 'error' | 'warning';
  category: string;
  description: string;
  picks?: Pick[];
}

function validatePickData(filePath: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const picks: Pick[] = data;
  
  // 1. Check for duplicate IDs
  const idCounts = new Map<string, Pick[]>();
  for (const pick of picks) {
    if (!idCounts.has(pick.id)) {
      idCounts.set(pick.id, []);
    }
    idCounts.get(pick.id)!.push(pick);
  }
  
  for (const [id, picksWithId] of idCounts) {
    if (picksWithId.length > 1) {
      issues.push({
        severity: 'error',
        category: 'Duplicate ID',
        description: `ID "${id}" appears ${picksWithId.length} times`,
        picks: picksWithId,
      });
    }
  }
  
  // 2. Check for teams with multiple "own" picks in same year/round
  const ownPicks = picks.filter(p => p.status === 'own');
  const ownByTeamYearRound = new Map<string, Pick[]>();
  
  for (const pick of ownPicks) {
    const key = `${pick.originalTeam}_${pick.year}_${pick.round}`;
    if (!ownByTeamYearRound.has(key)) {
      ownByTeamYearRound.set(key, []);
    }
    ownByTeamYearRound.get(key)!.push(pick);
  }
  
  for (const [key, picksGroup] of ownByTeamYearRound) {
    if (picksGroup.length > 1) {
      issues.push({
        severity: 'error',
        category: 'Multiple Own Picks',
        description: `Team has ${picksGroup.length} "own" picks for ${key} (impossible!)`,
        picks: picksGroup,
      });
    }
  }
  
  // 3. Check for mismatched originalTeam and owner on "own" picks
  for (const pick of ownPicks) {
    if (pick.originalTeam !== pick.owner) {
      issues.push({
        severity: 'error',
        category: 'Own Pick Mismatch',
        description: `Pick ${pick.id} marked as "own" but originalTeam (${pick.originalTeam}) != owner (${pick.owner})`,
        picks: [pick],
      });
    }
  }
  
  // 4. Check for incoming picks where originalTeam == owner
  const incomingPicks = picks.filter(p => p.status === 'incoming');
  for (const pick of incomingPicks) {
    if (pick.originalTeam === pick.owner && !pick.via) {
      issues.push({
        severity: 'warning',
        category: 'Incoming Pick Issue',
        description: `Pick ${pick.id} marked as "incoming" but originalTeam == owner (${pick.owner})`,
        picks: [pick],
      });
    }
  }
  
  return issues;
}

function validateByCurrentOwner(dirPath: string): ValidationIssue[] {
  const allIssues: ValidationIssue[] = [];
  
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const teamCode = file.replace('draft_picks_', '').replace('.json', '');
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const picks: Pick[] = data;
    
    // Check that all picks have owner matching the team
    for (const pick of picks) {
      if (pick.owner !== teamCode) {
        allIssues.push({
          severity: 'error',
          category: 'Wrong Current Owner',
          description: `Pick ${pick.id} in ${teamCode} file but owner is ${pick.owner}`,
          picks: [pick],
        });
      }
    }
    
    // Check for multiple "own" picks in same year/round
    const ownPicks = picks.filter(p => p.status === 'own');
    const byYearRound = new Map<string, Pick[]>();
    
    for (const pick of ownPicks) {
      const key = `${pick.year}_${pick.round}`;
      if (!byYearRound.has(key)) {
        byYearRound.set(key, []);
      }
      byYearRound.get(key)!.push(pick);
    }
    
    for (const [key, picksGroup] of byYearRound) {
      if (picksGroup.length > 1) {
        allIssues.push({
          severity: 'error',
          category: 'Multiple Own Picks',
          description: `${teamCode} has ${picksGroup.length} "own" picks for year ${key.split('_')[0]} round ${key.split('_')[1]}`,
          picks: picksGroup,
        });
      }
    }
  }
  
  return allIssues;
}

// Main execution
console.log('🔍 Validating Draft Pick Parsing\n');
console.log('='.repeat(60));

const baseDir =
  process.env.DRAFT_PICKS_DIR ||
  path.join(process.cwd(), 'team-scrape', 'draft-picks', 'output');

// Validate structured data
console.log('\n📊 Validating Structured Data...');
const structuredPath = path.join(baseDir, 'draft_picks_structured.json');
if (fs.existsSync(structuredPath)) {
  const issues = validatePickData(structuredPath);
  if (issues.length === 0) {
    console.log('✅ No issues found');
  } else {
    console.log(`❌ Found ${issues.length} issues:\n`);
    for (const issue of issues) {
      console.log(`${issue.severity.toUpperCase()}: ${issue.category}`);
      console.log(`  ${issue.description}`);
      if (issue.picks && issue.picks.length <= 3) {
        issue.picks.forEach(p => {
          console.log(`    - ${p.id} (status: ${p.status}, orig: ${p.originalTeam}, owner: ${p.owner})`);
        });
      }
      console.log();
    }
  }
} else {
  console.log('⚠️  File not found:', structuredPath);
}

// Validate by_current_owner directory
console.log('\n📂 Validating By Current Owner Files...');
const byOwnerDir = path.join(baseDir, 'by_current_owner');
if (fs.existsSync(byOwnerDir)) {
  const issues = validateByCurrentOwner(byOwnerDir);
  if (issues.length === 0) {
    console.log('✅ No issues found');
  } else {
    console.log(`❌ Found ${issues.length} issues:\n`);
    
    // Group by category
    const byCategory = new Map<string, ValidationIssue[]>();
    for (const issue of issues) {
      if (!byCategory.has(issue.category)) {
        byCategory.set(issue.category, []);
      }
      byCategory.get(issue.category)!.push(issue);
    }
    
    for (const [category, categoryIssues] of byCategory) {
      console.log(`\n${category} (${categoryIssues.length} issues):`);
      for (const issue of categoryIssues.slice(0, 5)) { // Show first 5
        console.log(`  • ${issue.description}`);
      }
      if (categoryIssues.length > 5) {
        console.log(`  ... and ${categoryIssues.length - 5} more`);
      }
    }
  }
} else {
  console.log('⚠️  Directory not found:', byOwnerDir);
}

// Show specific problematic cases
console.log('\n' + '='.repeat(60));
console.log('\n🔎 Specific Case Analysis: OKC 2026 First Round\n');

const okcPath = path.join(byOwnerDir, 'draft_picks_OKC.json');
if (fs.existsSync(okcPath)) {
  const okcData = JSON.parse(fs.readFileSync(okcPath, 'utf8'));
  const okc2026First = okcData.filter((p: Pick) => p.year === 2026 && p.round === 1);
  
  console.log(`Found ${okc2026First.length} first-round picks for OKC in 2026:\n`);
  
  okc2026First.forEach((pick: Pick, i: number) => {
    console.log(`${i + 1}. ${pick.id}`);
    console.log(`   Status: ${pick.status}`);
    console.log(`   Original Team: ${pick.originalTeam}`);
    console.log(`   Owner: ${pick.owner}`);
    console.log(`   Via: ${pick.via || 'none'}`);
    console.log();
  });
  
  // Check for issues
  const ownPicks = okc2026First.filter((p: Pick) => p.status === 'own');
  if (ownPicks.length > 1) {
    console.log('❌ ISSUE: Multiple "own" picks detected!');
    console.log('   A team can only have ONE own first-round pick per year.\n');
  } else if (ownPicks.length === 1) {
    console.log('✅ Correct: Only one "own" pick\n');
  }
  
  const duplicateIds = new Map<string, number>();
  okc2026First.forEach((p: Pick) => {
    duplicateIds.set(p.id, (duplicateIds.get(p.id) || 0) + 1);
  });
  
  const hasDuplicates = Array.from(duplicateIds.values()).some(count => count > 1);
  if (hasDuplicates) {
    console.log('❌ ISSUE: Duplicate IDs detected!');
    duplicateIds.forEach((count, id) => {
      if (count > 1) {
        console.log(`   "${id}" appears ${count} times`);
      }
    });
  } else {
    console.log('✅ Correct: No duplicate IDs\n');
  }
}

console.log('\n' + '='.repeat(60));
console.log('\n📋 Summary\n');
console.log('The validation shows issues that exist in the current data.');
console.log('These issues should be fixed by re-running the scraper with');
console.log('the updated parsing logic (requires internet access).\n');
console.log('To re-scrape: npm run realgm:drafts\n');
