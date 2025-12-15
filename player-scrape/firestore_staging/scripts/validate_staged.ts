// validate_staged.ts — Validate staged Firestore files against schemas
//
// DESCRIPTION:
//   Validates staged player files (players_v2 and basePlayers) against Zod schemas
//   to ensure correct shape before pushing to Firestore.
//
// USAGE:
//   npx tsx player-scrape/firestore_staging/validate_staged.ts [playerId...]
//   If no playerIds provided, validates all staged players

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  PlayerMainDocZ,
  ContractDocZ,
  SeasonDocZ,
  ContractsViewDocZ,
} from '@/schemas/players_v2';
import { BasePlayerDocZ } from '@/schemas/architect';

const STAGE_DIR = path.resolve('player-scrape/firestore_staging/_artifacts/output');

interface ValidationResult {
  playerId: string;
  valid: boolean;
  errors: string[];
}

async function loadJson(filepath: string) {
  const raw = await readFile(filepath, 'utf8');
  return JSON.parse(raw);
}

async function validatePlayer(playerId: string): Promise<ValidationResult> {
  const errors: string[] = [];

  try {
    // Load staged files
    const playersV2Path = path.join(STAGE_DIR, 'players_v2', `${playerId}.json`);
    const basePlayerPath = path.join(STAGE_DIR, 'basePlayers', `${playerId}.json`);

    const playersV2 = await loadJson(playersV2Path);
    const basePlayer = await loadJson(basePlayerPath);

    // Validate main doc
    const mainDocResult = PlayerMainDocZ.safeParse(playersV2.doc);
    if (!mainDocResult.success) {
      errors.push(
        `Main doc validation failed: ${mainDocResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      );
    }

    // Validate contracts
    if (playersV2.contracts) {
      for (const [contractId, contract] of Object.entries(playersV2.contracts)) {
        const contractResult = ContractDocZ.safeParse(contract);
        if (!contractResult.success) {
          errors.push(
            `Contract ${contractId} validation failed: ${contractResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
      }
    }

    // Validate seasons
    if (playersV2.seasons) {
      for (const [seasonId, season] of Object.entries(playersV2.seasons)) {
        const seasonResult = SeasonDocZ.safeParse(season);
        if (!seasonResult.success) {
          errors.push(
            `Season ${seasonId} validation failed: ${seasonResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
          );
        }
      }
    }

    // Validate contracts view
    if (playersV2.views?.contracts) {
      const viewResult = ContractsViewDocZ.safeParse(playersV2.views.contracts);
      if (!viewResult.success) {
        errors.push(
          `Contracts view validation failed: ${viewResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
        );
      }
    }

    // Validate basePlayer
    const basePlayerResult = BasePlayerDocZ.safeParse(basePlayer);
    if (!basePlayerResult.success) {
      errors.push(
        `BasePlayer validation failed: ${basePlayerResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`
      );
    }

    return {
      playerId,
      valid: errors.length === 0,
      errors,
    };
  } catch (error: any) {
    return {
      playerId,
      valid: false,
      errors: [`Failed to load or validate: ${error.message}`],
    };
  }
}

async function main() {
  const playerIds = process.argv.slice(2);

  let playersToValidate: string[];

  if (playerIds.length > 0) {
    playersToValidate = playerIds;
  } else {
    // Validate all staged players
    const playersV2Dir = path.join(STAGE_DIR, 'players_v2');
    const files = await readdir(playersV2Dir);
    playersToValidate = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''));
  }

  console.log(`🔍 Validating ${playersToValidate.length} player(s)...\n`);

  const results: ValidationResult[] = [];
  for (const playerId of playersToValidate) {
    const result = await validatePlayer(playerId);
    results.push(result);
    if (result.valid) {
      console.log(`✅ ${playerId}`);
    } else {
      console.error(`❌ ${playerId}`);
      result.errors.forEach((err) => console.error(`   ${err}`));
    }
  }

  const validCount = results.filter((r) => r.valid).length;
  const invalidCount = results.filter((r) => !r.valid).length;

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Valid: ${validCount}`);
  console.log(`   ❌ Invalid: ${invalidCount}`);

  if (invalidCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Validation failed:', err);
  process.exit(1);
});

