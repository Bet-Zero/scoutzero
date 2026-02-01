#!/usr/bin/env tsx
/**
 * FILE: team-scrape/draft-picks/scripts/pst/pst_phase_12_3a_push_base_pick_rules.ts
 * PURPOSE: Push base pick rules to Firestore from the PST pick ledger.
 * SUPPORTS: Both emulator mode (via FIRESTORE_EMULATOR_HOST) and production (via serviceAccountKey.json)
 *
 * HISTORY:
 *  - 2026-01-31: Created for Phase 12.3A - Push Base Pick Rules to Firestore
 */

import admin from 'firebase-admin';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { constants } from 'node:fs';

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const INPUT_PATH = path.resolve('data/pst/pst_pick_ledger_final_2026_2033.json');
const BASE_PICK_RULES_COLLECTION = 'architect_basePickRules';

const BATCH_SIZE = 450;

/**
 * Canonical projectId for emulator mode.
 * MUST match the projectId in scripts/emu/adminEmu.ts
 */
const EMULATOR_FALLBACK_PROJECT_ID = 'scoutzero-bf1ae';

// --- Source Ledger Types ---

type LedgerProtection = {
  type: 'top_n' | 'range' | 'lottery';
  protectedRange: { start: number; end: number };
  description: string;
  appliesToYears: number[];
  evidenceRowRefs: string[];
};

type LedgerSelectionSpec = {
  kind: 'swap' | 'swap_right' | 'conveys';
  controller?: string;
  pool: string[];
  year: number;
  round: number;
  order?: 'least' | 'most';
  rank?: number;
  description: string;
  evidenceRowRefs: string[];
};

type LedgerSwap = {
  controller: string;
  pool: string[];
  year: number;
  round: number;
  direction: string;
  mostLeast: string | null;
  description: string;
  evidenceRowRefs: string[];
};

type LedgerDidNotConvey = {
  reason: string;
  evidenceRowRefs: string[];
};

type LedgerEncumbrances = {
  protections: LedgerProtection[];
  swaps: LedgerSwap[];
  conveyance: unknown[];
  didNotConvey: LedgerDidNotConvey[];
  selectionSpecs: LedgerSelectionSpec[];
};

type LedgerPick = {
  pickId: string;
  year: number;
  round: number;
  originalTeam: string;
  owner: string;
  ownershipSource: string;
  encumbrances: LedgerEncumbrances;
  evidenceRowRefs: string[];
};

type LedgerFile = {
  meta: {
    years: number[];
    generatedAt: string;
    totalPicks: number;
  };
  picks: LedgerPick[];
};

// --- Target Firestore Document Type ---

type BasePickRuleProtection = {
  type?: 'top_n' | 'range' | 'lottery';
  protectedRange?: string;
  appliesToYears?: number[];
  description?: string;
};

type BasePickRuleCondition = {
  kind: 'swap' | 'swap_right' | 'conveys' | 'did_not_convey';
  description: string;
  relatedPickIds?: string[];
  appliesToYears?: number[];
  controller?: string;
};

type BasePickRuleDoc = {
  pickId: string;
  seasonYear: number;
  round: 1 | 2;
  protections?: BasePickRuleProtection[];
  conditions?: BasePickRuleCondition[];
  ownershipSource?: string;
  evidenceRowRefs?: string[];
  updatedAtISO: string;
  source: 'PST_LEDGER_FINAL';
};

// --- Transformation Functions ---

function transformProtection(p: LedgerProtection): BasePickRuleProtection {
  const rangeStr = `${p.protectedRange.start}-${p.protectedRange.end}`;
  return {
    type: p.type,
    protectedRange: rangeStr,
    appliesToYears: p.appliesToYears?.length ? p.appliesToYears : undefined,
    description: p.description || undefined,
  };
}

function buildRelatedPickIds(
  pool: string[],
  year: number,
  round: number
): string[] {
  const suffix = round === 1 ? '1st' : '2nd';
  return pool.map((team) => `${team}_${year}_${suffix}`);
}

function transformSelectionSpec(
  spec: LedgerSelectionSpec
): BasePickRuleCondition {
  const relatedPickIds = buildRelatedPickIds(spec.pool, spec.year, spec.round);
  return {
    kind: spec.kind,
    description: spec.description,
    relatedPickIds,
    appliesToYears: [spec.year],
    controller: spec.controller,
  };
}

function transformSwap(swap: LedgerSwap): BasePickRuleCondition {
  const relatedPickIds = buildRelatedPickIds(swap.pool, swap.year, swap.round);
  return {
    kind: 'swap_right',
    description: swap.description,
    relatedPickIds,
    appliesToYears: [swap.year],
    controller: swap.controller,
  };
}

function transformDidNotConvey(dnc: LedgerDidNotConvey): BasePickRuleCondition {
  return {
    kind: 'did_not_convey',
    description: `Did not convey: ${dnc.reason}`,
  };
}

function transformLedgerPick(pick: LedgerPick): BasePickRuleDoc | null {
  const { encumbrances } = pick;

  // Build protections array
  const protections = encumbrances.protections.map(transformProtection);

  // Build conditions from selectionSpecs (preferred) or fallback to swaps
  const conditions: BasePickRuleCondition[] = [];

  if (encumbrances.selectionSpecs.length > 0) {
    conditions.push(...encumbrances.selectionSpecs.map(transformSelectionSpec));
  } else if (encumbrances.swaps.length > 0) {
    // Fallback to swaps if no selectionSpecs
    conditions.push(...encumbrances.swaps.map(transformSwap));
  }

  // Add didNotConvey as conditions
  if (encumbrances.didNotConvey.length > 0) {
    conditions.push(...encumbrances.didNotConvey.map(transformDidNotConvey));
  }

  // Skip picks with no rules
  if (protections.length === 0 && conditions.length === 0) {
    return null;
  }

  return {
    pickId: pick.pickId,
    seasonYear: pick.year,
    round: pick.round as 1 | 2,
    protections: protections.length > 0 ? protections : undefined,
    conditions: conditions.length > 0 ? conditions : undefined,
    ownershipSource: pick.ownershipSource,
    evidenceRowRefs: pick.evidenceRowRefs?.length
      ? pick.evidenceRowRefs
      : undefined,
    updatedAtISO: new Date().toISOString(),
    source: 'PST_LEDGER_FINAL',
  };
}

// --- Utility Functions ---

async function loadJson<T>(filepath: string): Promise<T> {
  const raw = await readFile(filepath, 'utf8');
  return JSON.parse(raw) as T;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function fileExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function isEmulatorMode(): boolean {
  return !!process.env.FIRESTORE_EMULATOR_HOST;
}

function resolveEmulatorProjectId(): string {
  return (
    process.env.GCLOUD_PROJECT ??
    process.env.FIREBASE_PROJECT ??
    process.env.PROJECT_ID ??
    EMULATOR_FALLBACK_PROJECT_ID
  );
}

async function initializeAdmin(): Promise<FirebaseFirestore.Firestore> {
  if (isEmulatorMode()) {
    const projectId = resolveEmulatorProjectId();
    console.log(`[push] Emulator mode: projectId=${projectId}`);
    admin.initializeApp({ projectId });
  } else {
    if (!(await fileExists(SERVICE_ACCOUNT_PATH))) {
      throw new Error(
        `Service account not found at ${SERVICE_ACCOUNT_PATH} and not in emulator mode. ` +
          'Either run the emulator or provide a service account.'
      );
    }
    const serviceAccount = JSON.parse(
      await readFile(SERVICE_ACCOUNT_PATH, 'utf8')
    );
    console.log('[push] Production mode: using service account');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }
  return admin.firestore();
}

// --- Main ---

async function main() {
  const db = await initializeAdmin();

  const ledger = await loadJson<LedgerFile>(INPUT_PATH);
  const picks = ledger.picks || [];

  if (!picks.length) {
    console.warn('No picks found in ledger file.');
    return;
  }

  // Transform picks to rules, filtering out nulls (picks with no encumbrances)
  const rules = picks
    .map(transformLedgerPick)
    .filter((r): r is BasePickRuleDoc => r !== null);

  console.log(
    `\n=== Push Base Pick Rules ===\n` +
      `Input: ${INPUT_PATH}\n` +
      `Total picks in ledger: ${picks.length}\n` +
      `Picks with rules: ${rules.length}\n`
  );

  if (!rules.length) {
    console.warn('No picks with rules to push.');
    return;
  }

  // Log sample doc IDs
  const sampleIds = rules.slice(0, 5).map((r) => r.pickId);
  console.log(`Sample doc IDs: ${sampleIds.join(', ')}\n`);

  const chunks = chunkArray(rules, BATCH_SIZE);

  for (const [index, chunk] of chunks.entries()) {
    const batch = db.batch();
    chunk.forEach((rule) => {
      const docRef = db.collection(BASE_PICK_RULES_COLLECTION).doc(rule.pickId);
      batch.set(docRef, rule);
    });

    await batch.commit();
    console.log(
      `✅ Batch ${index + 1}/${chunks.length} committed (${chunk.length} docs)`
    );
  }

  console.log(`\n🎉 Base pick rules push complete. ${rules.length} docs written.`);
}

main().catch((err) => {
  console.error('Push failed:', err);
  process.exit(1);
});
