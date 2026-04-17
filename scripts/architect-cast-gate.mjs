#!/usr/bin/env node
// Architect cast-ledger gate.
//
// Runs ESLint on src/features/architect/** and compares the per-file violation
// counts for the four tracked patterns (`: any`/`as any`, `as never`,
// `as unknown as X`, `[key: string]: unknown`) against the committed baseline
// at .architect-cast-baseline.json.
//
// The gate is the source of truth for CI. ESLint severity drives IDE display
// only. A PR may keep counts equal or reduce them; any per-file increase fails
// the build. New justified exceptions must come with an inline rule-scoped
// `eslint-disable-next-line ... -- LEDGER:CAST-NNN` comment plus a matching
// row in docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md (PR review enforces
// these — the gate enforces the count invariant only).
//
// Usage:
//   node scripts/architect-cast-gate.mjs           # check against baseline
//   node scripts/architect-cast-gate.mjs --write   # regenerate baseline

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, relative } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');
const baselinePath = resolve(repoRoot, '.architect-cast-baseline.json');
const targetGlob = 'src/features/architect';

const BUCKETS = {
  'no-explicit-any': 'no-explicit-any',
  'as-never': 'no-restricted-syntax:as-never',
  'as-unknown-as': 'no-restricted-syntax:as-unknown-as',
  'index-unknown': 'no-restricted-syntax:index-unknown',
};

function classify(message) {
  if (message.ruleId === '@typescript-eslint/no-explicit-any') return BUCKETS['no-explicit-any'];
  if (message.ruleId !== 'no-restricted-syntax') return null;
  const text = message.message || '';
  if (text.startsWith('`as never`')) return BUCKETS['as-never'];
  if (text.startsWith('`as unknown as X`')) return BUCKETS['as-unknown-as'];
  if (text.startsWith('`[key: string]: unknown`')) return BUCKETS['index-unknown'];
  return null;
}

function runEslint() {
  const result = spawnSync(
    'npx',
    ['eslint', targetGlob, '--ext', '.ts,.tsx', '--format=json'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  if (result.error) throw result.error;
  const stdout = result.stdout || '';
  if (!stdout.trim()) {
    throw new Error(
      `ESLint produced no output. stderr:\n${result.stderr || '(empty)'}`
    );
  }
  return JSON.parse(stdout);
}

function buildSnapshot(eslintResults) {
  const files = {};
  for (const fileResult of eslintResults) {
    const relPath = relative(repoRoot, fileResult.filePath);
    if (!relPath.startsWith('src/features/architect/')) continue;
    for (const message of fileResult.messages) {
      const bucket = classify(message);
      if (!bucket) continue;
      files[relPath] ??= {};
      files[relPath][bucket] = (files[relPath][bucket] ?? 0) + 1;
    }
  }
  const sortedFiles = {};
  for (const k of Object.keys(files).sort()) {
    const inner = {};
    for (const b of Object.keys(files[k]).sort()) inner[b] = files[k][b];
    sortedFiles[k] = inner;
  }
  return sortedFiles;
}

function totals(snapshot) {
  let totalViolations = 0;
  for (const file of Object.values(snapshot)) {
    for (const n of Object.values(file)) totalViolations += n;
  }
  return { files: Object.keys(snapshot).length, violations: totalViolations };
}

function compare(baseline, current) {
  const additions = [];
  const reductions = [];
  const allFiles = new Set([
    ...Object.keys(baseline.files ?? {}),
    ...Object.keys(current),
  ]);
  for (const file of allFiles) {
    const base = baseline.files?.[file] ?? {};
    const cur = current[file] ?? {};
    const buckets = new Set([...Object.keys(base), ...Object.keys(cur)]);
    for (const bucket of buckets) {
      const b = base[bucket] ?? 0;
      const c = cur[bucket] ?? 0;
      if (c > b) additions.push({ file, bucket, baseline: b, current: c, delta: c - b });
      else if (c < b) reductions.push({ file, bucket, baseline: b, current: c, delta: c - b });
    }
  }
  return { additions, reductions };
}

function writeBaseline(snapshot) {
  const t = totals(snapshot);
  const payload = {
    _meta: {
      generated: new Date().toISOString(),
      gate: 'scripts/architect-cast-gate.mjs',
      ledger: 'docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md',
      buckets: Object.values(BUCKETS),
      totalFiles: t.files,
      totalViolations: t.violations,
    },
    files: snapshot,
  };
  writeFileSync(baselinePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`Wrote baseline → ${relative(repoRoot, baselinePath)}`);
  console.log(`  Files: ${t.files}  Violations: ${t.violations}`);
}

function main() {
  const writeMode = process.argv.includes('--write');
  console.log(`Running ESLint on ${targetGlob} ...`);
  const eslintResults = runEslint();
  const current = buildSnapshot(eslintResults);
  const t = totals(current);
  console.log(`Current: ${t.files} files, ${t.violations} tracked violations`);

  if (writeMode) {
    writeBaseline(current);
    return;
  }

  if (!existsSync(baselinePath)) {
    console.error(
      `\nNo baseline found at ${relative(repoRoot, baselinePath)}.\n` +
        `Run \`node scripts/architect-cast-gate.mjs --write\` to generate one.`
    );
    process.exit(2);
  }

  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'));
  const { additions, reductions } = compare(baseline, current);

  if (additions.length === 0) {
    if (reductions.length > 0) {
      const removed = reductions.reduce((s, r) => s + Math.abs(r.delta), 0);
      console.log(
        `\nGate PASS — ratchet went down by ${removed} violation(s) across ${reductions.length} file/bucket pair(s).`
      );
      console.log(
        `Regenerate baseline to lock in: \`node scripts/architect-cast-gate.mjs --write\``
      );
      for (const r of reductions.slice(0, 10)) {
        console.log(`  - ${r.file} [${r.bucket}]: ${r.baseline} → ${r.current}`);
      }
      if (reductions.length > 10) console.log(`  ... and ${reductions.length - 10} more.`);
    } else {
      console.log('\nGate PASS — no change vs baseline.');
    }
    return;
  }

  console.error(`\nGate FAIL — ${additions.length} per-file/bucket increase(s) detected.\n`);
  for (const a of additions) {
    console.error(`  + ${a.file} [${a.bucket}]: ${a.baseline} → ${a.current} (+${a.delta})`);
  }
  console.error(
    `\nIf this is a justified new exception:\n` +
      `  1. Add an inline \`// eslint-disable-next-line <rule> -- LEDGER:CAST-NNN\` comment at the new site.\n` +
      `  2. Add a matching CAST-NNN row in docs/architect/ARCHITECT_TYPE_CAST_LEDGER.md with seam reference and non-placeholder reason.\n` +
      `  3. Run \`node scripts/architect-cast-gate.mjs --write\` to update the baseline.\n` +
      `\nIf this is unjustified, fix the cast or refactor instead.`
  );
  process.exit(1);
}

main();
