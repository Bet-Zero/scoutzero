#!/usr/bin/env node
// One-time generator for docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md.
//
// Reads the ESLint output for src/features/architect/** (same target rules as
// architect-cast-gate.mjs), assigns sequential CAST-NNN IDs, and emits a
// markdown ledger. Reasons are pre-filled for cases the project memory has
// already documented (Salary-Row, mutationPipeline catchall, Cap Legality,
// Season Manager). Everything else ships with a `TODO` reason, to be filled
// in incrementally by the user or by one supervised Codex pass.
//
// Usage: node scripts/generate-architect-cast-ledger.mjs

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const targetGlob = 'src/features/architect';
const outPath = resolve(
  repoRoot,
  'docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md'
);

const PATTERN_LABEL = {
  'no-explicit-any': '`any`',
  'as-never': '`as never`',
  'as-unknown-as': '`as unknown as`',
  'index-unknown': '`[key: string]: unknown`',
};

function classify(message) {
  if (message.ruleId === '@typescript-eslint/no-explicit-any') return 'no-explicit-any';
  if (message.ruleId !== 'no-restricted-syntax') return null;
  const t = message.message || '';
  if (t.startsWith('`as never`')) return 'as-never';
  if (t.startsWith('`as unknown as X`')) return 'as-unknown-as';
  if (t.startsWith('`[key: string]: unknown`')) return 'index-unknown';
  return null;
}

// Seam pre-fill heuristics, derived from memory/MEMORY.md entries.
// Each rule: if (file, pattern) matches, emit (seam, reason). Otherwise TODO.
function prefill({ file, pattern }) {
  const f = file;

  // Item 2 — leagueInvariants.ts legacy payload fields
  if (f.endsWith('utils/leagueInvariants.ts') && pattern === 'no-explicit-any') {
    return {
      seam: 'Item 2',
      reason:
        'Legacy `receiving`/`playersReceiving` fields on team entries not present in `ArchitectMutationPayload`. Needs payload-shape audit before narrowing.',
    };
  }

  // Item 3 — ArchitectContract catch-all index signature
  if (
    f.endsWith('utils/constants/types.ts') &&
    pattern === 'index-unknown'
  ) {
    return {
      seam: 'Item 3',
      reason:
        'Load-bearing: call sites access `years`, `contractYears`, `firstYearSalary`, `salariesByYear`, etc. that were never explicitly declared. Needs grep-audit before removing.',
    };
  }

  // Item 4 — ArchitectMutationTeamRecord.totals dual-shape
  if (
    f.endsWith('utils/mutationPipeline.ts') &&
    pattern === 'index-unknown'
  ) {
    return {
      seam: 'Item 4',
      reason:
        'Dual-shape boundary: `TeamCapTotals` (computed) vs `TeamTotals` (Firestore passthrough). Dozens of test fixtures use the Firestore shape. Needs split into `LoadedTeamCapTotals` + `ComputedTeamCapTotals`.',
    };
  }

  // Item 5 — JS-migrated utilities (as never casts)
  const item5Files = new Set([
    'src/features/architect/tradeMachine/TradePlayerRow.tsx',
    'src/features/architect/tradeMachine/CapImpactTiles.tsx',
    'src/features/architect/tradeMachine/OutgoingPlayersList.tsx',
    'src/features/architect/tradeMachine/EntitlementPickRow.tsx',
    'src/features/architect/utils/miscRules.ts',
  ]);
  if (item5Files.has(f) && pattern === 'as-never') {
    return {
      seam: 'Item 5',
      reason:
        'JS-migrated utility expects internal branded type (`SeasonId`, internal player/team/entitlement shape). Needs widened signatures or un-branded types on the utility side.',
    };
  }

  // Memory-documented cap-legality passes — Item 3-adjacent boundary types
  if (
    f.includes('capLegality') &&
    (pattern === 'index-unknown' || pattern === 'no-explicit-any')
  ) {
    return {
      seam: 'STANDALONE',
      reason:
        'Cap-legality adapter boundary — see `memory/MEMORY.md` "Cap Legality Validation Hardening Pass". Loose field retained for ArchitectDashboardPlayer callers and draftPick object shapes.',
    };
  }

  // Memory-documented season manager pass
  if (f.endsWith('utils/seasonManager.ts') && pattern === 'index-unknown') {
    return {
      seam: 'STANDALONE',
      reason:
        'Season-advance audit/hydration boundary — see `memory/MEMORY.md` "Season Manager Hardening Pass". Retained fields are audit-only or hydration-only.',
    };
  }

  return { seam: 'TODO', reason: 'TODO' };
}

function runEslint() {
  const result = spawnSync(
    'npx',
    ['eslint', targetGlob, '--ext', '.ts,.tsx', '--format=json'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error) throw result.error;
  if (!result.stdout?.trim()) {
    throw new Error(`ESLint produced no output. stderr:\n${result.stderr || ''}`);
  }
  return JSON.parse(result.stdout);
}

function collect() {
  const results = runEslint();
  const rows = [];
  for (const fileResult of results) {
    const relPath = relative(repoRoot, fileResult.filePath);
    if (!relPath.startsWith('src/features/architect/')) continue;
    for (const m of fileResult.messages) {
      const pattern = classify(m);
      if (!pattern) continue;
      rows.push({ file: relPath, line: m.line, column: m.column, pattern });
    }
  }
  rows.sort((a, b) => {
    if (a.file !== b.file) return a.file.localeCompare(b.file);
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });
  return rows;
}

function pad(n, width) {
  return String(n).padStart(width, '0');
}

function renderRow(row, id) {
  const { seam, reason } = prefill({ file: row.file, pattern: row.pattern });
  const escape = (s) => s.replaceAll('|', '\\|');
  return `| ${id} | ${escape(row.file)}:${row.line} | ${PATTERN_LABEL[row.pattern]} | ${seam} | ${escape(reason)} |`;
}

function render(rows) {
  const today = new Date().toISOString().slice(0, 10);
  const todoCount = rows.filter((r) => {
    const p = prefill({ file: r.file, pattern: r.pattern });
    return p.seam === 'TODO';
  }).length;
  const prefilledCount = rows.length - todoCount;

  const lines = [];
  lines.push('# Architect Type Cast Ledger');
  lines.push('');
  lines.push(`**Generated:** ${today} · **Total entries:** ${rows.length} (${prefilledCount} pre-filled, ${todoCount} TODO)`);
  lines.push('');
  lines.push('Companion to [.architect-cast-baseline.json](../../.architect-cast-baseline.json) and the gate at [scripts/architect-cast-gate.mjs](../../scripts/architect-cast-gate.mjs). Cross-reference: [ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md](ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md) defines Items 2–5 referenced in the Seam column.');
  lines.push('');
  lines.push('## Protocol (four invariants)');
  lines.push('');
  lines.push('**Invariant 1 — Baseline only goes down.** A PR may keep the per-file/per-bucket counts in [.architect-cast-baseline.json](../../.architect-cast-baseline.json) equal or reduce them. A PR may never increase them unless the new exception meets every part of Invariant 2.');
  lines.push('');
  lines.push('**Invariant 2 — New exceptions require all four:**');
  lines.push('');
  lines.push('1. Inline `eslint-disable-next-line` comment scoped to **the exact rule** being suppressed. No broad `eslint-disable-next-line` without a rule name; no file-level `eslint-disable`.');
  lines.push('2. The disable comment includes a `-- LEDGER:CAST-NNN` tag.');
  lines.push('3. A matching `CAST-NNN` row exists in this file.');
  lines.push('4. The ledger row\'s Reason column is **non-placeholder** — actual prose explaining why the cast is load-bearing, with a seam reference (`Item 2`/`Item 3`/`Item 4`/`Item 5` from the deferred-work doc, or `STANDALONE`).');
  lines.push('');
  lines.push('PR rejected if any of the four are missing.');
  lines.push('');
  lines.push('**Invariant 3 — Removing a cast updates both stores.** Remove the inline comment (if present), the ledger row below, and regenerate the baseline with `node scripts/architect-cast-gate.mjs --write` in the same PR.');
  lines.push('');
  lines.push('**Invariant 4 — Break-glass clause.** Temporary unledgered exceptions are forbidden except in a break-glass situation explicitly approved by the repo owner (e.g., production hotfix). Any break-glass exception must be converted to a properly-ledgered exception in the immediately-following PR. No "just this once" without a same-week follow-up.');
  lines.push('');
  lines.push('## Seam references');
  lines.push('');
  lines.push('Seam IDs in the table below map to the architectural work items in [ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md](ARCHITECT_TYPE_HARDENING_DEFERRED_WORK.md):');
  lines.push('');
  lines.push('- **Item 2** — `leagueInvariants.ts` legacy payload field audit');
  lines.push('- **Item 3** — `ArchitectContract` catch-all index signature');
  lines.push('- **Item 4** — `ArchitectMutationTeamRecord.totals` dual-shape split');
  lines.push('- **Item 5** — `as never` casts caused by JS-migrated utilities');
  lines.push('- **STANDALONE** — load-bearing exception not part of a known multi-file seam');
  lines.push('- **TODO** — awaiting categorization; needs a reading of the surrounding code to decide');
  lines.push('');
  lines.push('When a seam is fixed, delete every ledger row tagged with that Item together, update the baseline, and remove the corresponding inline disable comments (if any).');
  lines.push('');
  lines.push('## Entries');
  lines.push('');
  lines.push('| ID | File:line | Pattern | Seam | Reason |');
  lines.push('| -- | --------- | ------- | ---- | ------ |');
  rows.forEach((row, i) => {
    const id = `CAST-${pad(i + 1, 3)}`;
    lines.push(renderRow(row, id));
  });
  lines.push('');
  return lines.join('\n');
}

function main() {
  const rows = collect();
  const markdown = render(rows);
  writeFileSync(outPath, markdown);
  console.log(`Wrote ledger → ${relative(repoRoot, outPath)}`);
  console.log(`  ${rows.length} entries`);
}

main();
