/**
 * FILE: scripts/dev/draftMaintenance.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Mechanical offline successor comparison; pins must come from retained independent review. */
import { readFile } from 'node:fs/promises';
import { loadDraftPickRelease } from '../../src/features/architect/utils/draftPickRelease.js';
import { compareDraftPickReleases } from '../../src/features/architect/utils/draftPickReleaseComparison.js';
import { privateJson } from './cloudStorage.js';

try {
  const option = (key: string) => process.argv.find(v => v.startsWith('--' + key + '='))?.slice(key.length + 3) || '';
  for (const key of ['baseline', 'baseline-pin', 'proposal', 'proposal-pin', 'out']) if (!option(key)) throw new Error('Separate retained payloads, independent pins and private output required');
  const baseline = await loadDraftPickRelease(await readFile(option('baseline'), 'utf8'), JSON.parse(await readFile(option('baseline-pin'), 'utf8')), 'retained-baseline');
  const proposal = await loadDraftPickRelease(await readFile(option('proposal'), 'utf8'), JSON.parse(await readFile(option('proposal-pin'), 'utf8')), 'proposal');
  const comparison = compareDraftPickReleases(baseline, proposal);
  await privateJson(option('out'), comparison);
  console.log(JSON.stringify({ compared: true, historicalEntitlements: baseline.foundation.retained.entitlements.length,
    historicalOccurrences: baseline.foundation.retained.occurrences.length, factualAcceptance: false, installed: false, execution: 'disabled' }));
} catch { console.error('Draft comparison withheld: verify independent review pins, exact payloads and retained lineage.'); process.exitCode = 1; }
