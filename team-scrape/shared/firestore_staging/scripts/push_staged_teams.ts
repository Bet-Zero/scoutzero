#!/usr/bin/env tsx
/**
 * push_staged_teams.ts
 *
 * Writes staged `/architect/baseTeams/{teamCode}` documents to Firestore.
 * Mirrors the player staging push script but only targets the architect_baseTeams
 * collection.
 *
 * Usage:
 *   npx tsx team-scrape/shared/firestore_staging/push_staged_teams.ts LAL --confirmProject=scoutzero-bf1ae
 *   npx tsx team-scrape/shared/firestore_staging/push_staged_teams.ts LAL BOS --confirmProject=scoutzero-bf1ae
 */

import admin from 'firebase-admin';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// =============================================================================
// PRODUCTION GUARDRAILS
// =============================================================================

const PROD_PROJECT_ID = 'scoutzero-bf1ae';

function isEmulatorMode(): boolean {
  return !!process.env.FIRESTORE_EMULATOR_HOST;
}

function parseConfirmProjectArg(): string | undefined {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--confirmProject=')) {
      return arg.split('=')[1];
    }
  }
  return undefined;
}

function runGuardrails(): void {
  // If emulator mode is set, skip guardrails (allow emulator writes)
  if (isEmulatorMode()) {
    console.log(
      `[guard] Emulator mode detected (${process.env.FIRESTORE_EMULATOR_HOST}). Skipping prod guardrails.`
    );
    return;
  }

  // Production mode: require --confirmProject
  const confirmed = parseConfirmProjectArg();
  if (!confirmed) {
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: MISSING --confirmProject FLAG');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error('  Production push requires explicit project confirmation.');
    console.error('');
    console.error('  REQUIRED:');
    console.error(`    --confirmProject=${PROD_PROJECT_ID}`);
    console.error('');
    console.error('  EXAMPLE:');
    console.error(
      `    npx tsx push_staged_teams.ts LAL BOS --confirmProject=${PROD_PROJECT_ID}`
    );
    console.error('');
    process.exit(1);
  }

  if (confirmed !== PROD_PROJECT_ID) {
    console.error('');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('  🚫 BLOCKED: PROJECT ID MISMATCH');
    console.error(
      '═══════════════════════════════════════════════════════════════════════════════'
    );
    console.error('');
    console.error(`  Expected: ${PROD_PROJECT_ID}`);
    console.error(`  Provided: ${confirmed}`);
    console.error('');
    process.exit(1);
  }

  console.log(`✅ Production guardrails passed: ${PROD_PROJECT_ID}`);
}

// =============================================================================
// MAIN SCRIPT
// =============================================================================

type CliConfig = {
  stageDir: string;
  teams: string[];
  delayMs: number;
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
};

const SERVICE_ACCOUNT_PATH = path.resolve('serviceAccountKey.json');
const STAGE_DIR = path.resolve(
  'team-scrape/shared/firestore_staging/_artifacts/output'
);

const BASE_TEAMS_COLLECTION = 'architect_baseTeams';

const serviceAccount = await readFile(SERVICE_ACCOUNT_PATH, 'utf8').then(
  JSON.parse
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function loadJson<T>(filepath: string): Promise<T> {
  const raw = await readFile(filepath, 'utf8');
  return JSON.parse(raw) as T;
}

function parseArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === `--${name}`) {
      const next = args[i + 1];
      if (!next || next.startsWith('--')) return 'true';
      return next;
    }
    if (arg.startsWith(`--${name}=`)) {
      const [, val] = arg.split('=');
      return val ?? 'true';
    }
  }
  return undefined;
}

function parseNumberArg(name: string, def: number): number {
  const raw = parseArg(name);
  if (raw == null) return def;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : def;
}

function parseCli(): CliConfig {
  const args = process.argv.slice(2);
  const teams: string[] = [];
  let stageDir = STAGE_DIR;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--stageDir=')) {
      stageDir = path.resolve(arg.split('=')[1] ?? STAGE_DIR);
    } else if (arg === '--stageDir') {
      stageDir = path.resolve(args[i + 1] ?? STAGE_DIR);
      i += 1;
    } else if (!arg.startsWith('--')) {
      teams.push(arg.toUpperCase());
    }
  }

  const delayMs = parseNumberArg('delayMs', 500);
  const maxRetries = Math.max(parseNumberArg('maxRetries', 3), 1);
  const retryDelayMs = parseNumberArg('retryDelayMs', 1000);
  const backoffMultiplier = Math.max(parseNumberArg('backoffMultiplier', 2), 1);

  return {
    stageDir,
    teams,
    delayMs,
    maxRetries,
    retryDelayMs,
    backoffMultiplier,
  };
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pushTeam(teamCode: string, stageDir: string) {
  const baseTeamPath = path.join(stageDir, 'baseTeams', `${teamCode}.json`);
  const baseTeamDoc = await loadJson<Record<string, unknown>>(baseTeamPath);

  await db.collection(BASE_TEAMS_COLLECTION).doc(teamCode).set(baseTeamDoc);

  console.log(`✅ Pushed ${teamCode}`);
}

async function pushTeamWithRetry(teamCode: string, config: CliConfig) {
  let attempt = 0;
  while (attempt < config.maxRetries) {
    attempt += 1;
    try {
      await pushTeam(teamCode, config.stageDir);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `⚠️  Failed to push ${teamCode} on attempt ${attempt}/${config.maxRetries}: ${message}`
      );
      if (attempt >= config.maxRetries) {
        throw err;
      }
      const wait =
        config.retryDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
      console.warn(`   Retrying in ${wait}ms...`);
      await sleep(wait);
    }
  }
}

async function main() {
  // Run production guardrails
  runGuardrails();

  const config = parseCli();

  if (!config.teams.length) {
    console.error(
      'Usage: npx tsx team-scrape/shared/firestore_staging/push_staged_teams.ts TEAM_CODE [TEAM_CODE...] [--stageDir=path] [--delayMs=500] [--maxRetries=3] [--retryDelayMs=1000] [--backoffMultiplier=2]'
    );
    process.exit(1);
  }

  console.log(
    `\n=== Push Staged Teams ===\n` +
      `Teams: ${config.teams.join(', ')}\n` +
      `Stage dir: ${config.stageDir}\n` +
      `Delay between teams: ${config.delayMs}ms\n` +
      `Max retries: ${config.maxRetries}\n` +
      `Retry delay: ${config.retryDelayMs}ms x${config.backoffMultiplier}\n`
  );

  for (const [index, teamCode] of config.teams.entries()) {
    console.log(`\n▶︎ (${index + 1}/${config.teams.length}) ${teamCode}`);
    await pushTeamWithRetry(teamCode, config);
    if (config.delayMs > 0 && index < config.teams.length - 1) {
      await sleep(config.delayMs);
    }
  }

  console.log('\n🎉 All teams pushed.');
}

main().catch((err) => {
  console.error('Push failed:', err);
  process.exit(1);
});
