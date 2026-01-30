/**
 * FILE: scripts/emu/reseedBaseTeams.ts
 * PURPOSE: Restore/reseed architect_baseTeams collection from staged JSON in the emulator.
 * OWNERSHIP: Tooling: local emulator workflow
 *
 * HISTORY:
 *  - 2026-01-29: Created for emulator baseTeams restore workflow
 *
 * LINKS:
 *  - Related: scripts/emu/reseedEntitlements.ts
 *  - Source: team-scrape/shared/firestore_staging/_artifacts/output/baseTeams/{TEAM}.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { initAdminEmu, getEmulatorProjectId } from './adminEmu.js';

const REQUIRED_TEAMS = 30;
const BATCH_SIZE = 450;
const BASE_TEAMS_SOURCE_DIR = path.resolve(
  'team-scrape/shared/firestore_staging/_artifacts/output/baseTeams'
);
const BASE_TEAMS_COLLECTION = 'architect_baseTeams';

// Fields that must exist for a baseTeams doc to be considered valid
const REQUIRED_FIELDS = ['teamCode', 'teamName', 'roster'];

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

type TeamDoc = {
  teamCode: string;
  teamName: string;
  roster: string[];
  [key: string]: unknown;
};

const loadTeamJson = (teamCode: string): TeamDoc | null => {
  const filePath = path.join(BASE_TEAMS_SOURCE_DIR, `${teamCode}.json`);
  if (!fs.existsSync(filePath)) {
    log(`[reseed:baseTeams] ⚠️  Missing source file: ${filePath}`);
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as TeamDoc;
};

const getAvailableTeamCodes = (): string[] => {
  if (!fs.existsSync(BASE_TEAMS_SOURCE_DIR)) {
    throw new Error(
      `[reseed:baseTeams] Source directory not found: ${BASE_TEAMS_SOURCE_DIR}`
    );
  }
  const files = fs.readdirSync(BASE_TEAMS_SOURCE_DIR);
  return files
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace('.json', ''))
    .sort();
};

const validateDoc = (
  doc: TeamDoc | null,
  teamCode: string
): { valid: boolean; missing: string[]; warnings: string[] } => {
  if (!doc) {
    return { valid: false, missing: ['(entire document)'], warnings: [] };
  }
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const field of REQUIRED_FIELDS) {
    if (!(field in doc) || doc[field] === undefined || doc[field] === null) {
      missing.push(field);
    }
  }

  // Check roster - warn if empty but don't fail (emulator/dev env)
  if (!Array.isArray(doc.roster)) {
    missing.push('roster (not an array)');
  } else if (doc.roster.length === 0) {
    warnings.push('roster is empty - team will have no players');
  }

  return { valid: missing.length === 0, missing, warnings };
};

const writeAllTeams = async (
  db: FirebaseFirestore.Firestore,
  teamDocs: Map<string, TeamDoc>
): Promise<number> => {
  const teamCodes = Array.from(teamDocs.keys()).sort();
  let written = 0;

  // Process in batches
  for (let i = 0; i < teamCodes.length; i += BATCH_SIZE) {
    const chunk = teamCodes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const teamCode of chunk) {
      const doc = teamDocs.get(teamCode);
      if (doc) {
        const ref = db.collection(BASE_TEAMS_COLLECTION).doc(teamCode);
        batch.set(ref, doc); // Full replacement for restore
      }
    }

    await batch.commit();
    written += chunk.length;
    log(
      `[reseed:baseTeams] ✅ Batch committed: ${chunk.length} teams (${written}/${teamCodes.length})`
    );
  }

  return written;
};

const verifyFinalState = async (
  db: FirebaseFirestore.Firestore
): Promise<{ valid: boolean; issues: string[] }> => {
  const snapshot = await db.collection(BASE_TEAMS_COLLECTION).get();
  const issues: string[] = [];

  if (snapshot.size !== REQUIRED_TEAMS) {
    issues.push(`Expected ${REQUIRED_TEAMS} team docs, found ${snapshot.size}`);
  }

  const malformedTeams: string[] = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data() as TeamDoc;
    const validation = validateDoc(data, docSnap.id);
    if (!validation.valid) {
      malformedTeams.push(
        `${docSnap.id}: missing ${validation.missing.join(', ')}`
      );
    }
  });

  if (malformedTeams.length > 0) {
    issues.push(`Malformed docs: ${malformedTeams.join('; ')}`);
  }

  return { valid: issues.length === 0, issues };
};

const main = async () => {
  // initAdminEmu throws if FIRESTORE_EMULATOR_HOST is not set
  const { db, projectId } = initAdminEmu();

  log('[reseed:baseTeams] === RESEED ARCHITECT_BASETEAMS ===');
  log(`[reseed:baseTeams] projectId: ${projectId}`);
  log(`[reseed:baseTeams] Source: ${BASE_TEAMS_SOURCE_DIR}`);

  // Get available team files
  const teamCodes = getAvailableTeamCodes();
  log(`[reseed:baseTeams] Found ${teamCodes.length} team source files`);

  if (teamCodes.length !== REQUIRED_TEAMS) {
    throw new Error(
      `[reseed:baseTeams] Expected ${REQUIRED_TEAMS} team source files, found ${teamCodes.length}`
    );
  }

  // Load and validate all team docs
  const teamDocs = new Map<string, TeamDoc>();
  const loadErrors: string[] = [];
  const loadWarnings: string[] = [];

  for (const teamCode of teamCodes) {
    const doc = loadTeamJson(teamCode);
    const validation = validateDoc(doc, teamCode);
    if (!validation.valid) {
      loadErrors.push(`${teamCode}: missing ${validation.missing.join(', ')}`);
    } else if (doc) {
      teamDocs.set(teamCode, doc);
      if (validation.warnings.length > 0) {
        loadWarnings.push(`${teamCode}: ${validation.warnings.join(', ')}`);
      }
    }
  }

  if (loadErrors.length > 0) {
    log('[reseed:baseTeams] ❌ Source validation errors:');
    for (const err of loadErrors) {
      log(`  - ${err}`);
    }
    throw new Error(
      `[reseed:baseTeams] ${loadErrors.length} source file(s) have validation errors`
    );
  }

  if (loadWarnings.length > 0) {
    log('[reseed:baseTeams] ⚠️  Source warnings (non-fatal):');
    for (const warn of loadWarnings) {
      log(`  - ${warn}`);
    }
  }

  log(`[reseed:baseTeams] All ${teamDocs.size} source files validated`);

  // Write to Firestore
  log('[reseed:baseTeams] Writing teams to Firestore emulator...');
  const written = await writeAllTeams(db, teamDocs);
  log(`[reseed:baseTeams] Wrote ${written} team documents`);

  // Verify final state
  log('[reseed:baseTeams] Verifying final state...');
  const verification = await verifyFinalState(db);

  if (!verification.valid) {
    log('[reseed:baseTeams] ❌ Post-write verification failed:');
    for (const issue of verification.issues) {
      log(`  - ${issue}`);
    }
    process.exit(1);
  }

  log('');
  log('=== RESEED COMPLETE ===');
  log(
    `[reseed:baseTeams] ✅ ${REQUIRED_TEAMS} team docs restored with full data`
  );
  log(
    '[reseed:baseTeams] ✅ All docs have teamCode, teamName, and roster fields'
  );
};

main().catch((error) => {
  process.stderr.write(`[reseed:baseTeams] ${String(error)}\n`);
  process.exit(1);
});
