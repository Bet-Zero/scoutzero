#!/usr/bin/env node
// Master Schema Transition Orchestrator
// Runs all 11 files in the correct sequence with error handling and progress tracking

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const DRY_RUN = process.env.DRY_RUN === '1';
const SEASON = process.env.SEASON || '2025-26';
const SAMPLE_PLAYERS = process.env.SAMPLE_PLAYERS || 'lebron_james';
const SAMPLE_TEAMS = process.env.SAMPLE_TEAMS || 'lal';

console.log('🔄 Schema Transition Master Orchestrator');
console.log('=====================================');
console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE MIGRATION'}`);
console.log(`Season: ${SEASON}`);
if (DRY_RUN) {
  console.log(`Sample Players: ${SAMPLE_PLAYERS}`);
  console.log(`Sample Teams: ${SAMPLE_TEAMS}`);
}
console.log('');

// Define the complete pipeline
const steps = [
  {
    name: 'Export Current Data',
    script: 'core/export_current.js',
    type: 'node',
    description: 'Export existing Firestore structure to JSON',
    required: true,
  },
  {
    name: 'Build Schema Trees',
    script: 'core/build_schema.cjs',
    type: 'node',
    description: 'Analyze exported data structure and build field trees',
    required: true,
  },
  {
    name: 'Scan Player Mapping',
    script: 'utils/scan_and_map_player.cjs',
    type: 'node',
    env: { PLAYER: SAMPLE_PLAYERS.split(',')[0], SEASON },
    description: 'Create detailed old→new field mappings for sample player',
    required: false,
  },
  {
    name: 'Generate Schema Map',
    script: 'core/emit_schema_map.cjs',
    type: 'node',
    env: { SEASON },
    description: 'Generate complete old→new path mappings',
    required: true,
  },
  {
    name: 'Generate Forecast Bundle',
    script: 'utils/generate_forecast_bundle.cjs',
    type: 'node',
    env: { SEASON },
    description: 'Create forecast bundles for validation testing',
    required: true,
  },
  {
    name: 'Validate Schema Compatibility',
    script: 'utils/validate_forecast_compat.cjs',
    type: 'node',
    args: ['outputs/ForecastBundle_TARGET_{{FIRST_PLAYER}}.json'],
    description: 'Test that new schema meets requirements',
    required: false,
  },
  {
    name: 'Migrate Contracts & Views',
    script: 'core/migrate_contracts_and_views.cjs',
    type: 'node',
    env: { DRY_RUN: DRY_RUN ? '1' : '0', SEASON },
    description: 'Create contract docs and season views with NBA ID lookups',
    required: true,
  },
  {
    name: 'Migrate Full Players',
    script: 'core/migrate_full_players.cjs',
    type: 'node',
    env: {
      DRY_RUN: DRY_RUN ? '1' : '0',
      SEASON,
      SAMPLE_PLAYERS: DRY_RUN ? SAMPLE_PLAYERS : undefined,
    },
    description:
      'Migrate complete player data (bio, stats, evaluation, contracts)',
    required: true,
  },
  {
    name: 'Build Team Seasons',
    script: 'core/build_team_seasons_full.cjs',
    type: 'node',
    env: {
      DRY_RUN: DRY_RUN ? '1' : '0',
      SEASON,
      SAMPLE_TEAMS: DRY_RUN ? SAMPLE_TEAMS : undefined,
    },
    description: 'Create team season documents with roster IDs and cap tables',
    required: true,
  },
];

let currentStep = 0;
let failures = [];
let firstPlayer = null;

function runCommand(cmd, args = [], env = {}) {
  return new Promise((resolve, reject) => {
    const fullEnv = { ...process.env, ...env };
    const child = spawn(cmd, args, {
      stdio: 'pipe',
      env: fullEnv,
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      process.stdout.write(output);
    });

    child.stderr.on('data', (data) => {
      const output = data.toString();
      stderr += output;
      process.stderr.write(output);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr, code });
      } else {
        reject({
          stdout,
          stderr,
          code,
          error: `Process exited with code ${code}`,
        });
      }
    });

    child.on('error', (error) => {
      reject({ stdout, stderr, code: -1, error: error.message });
    });
  });
}

async function runStep(step) {
  console.log(`\n📋 Step ${currentStep + 1}/${steps.length}: ${step.name}`);
  console.log(`   ${step.description}`);
  console.log(`   Running: ${step.script}`);

  const startTime = Date.now();

  try {
    // Prepare command
    let cmd, args;
    if (step.type === 'node') {
      cmd = 'node';
      args = [step.script]; // Remove the scripts/ prefix since we're now in schema_transition

      // Handle dynamic args (like first player replacement)
      if (step.args) {
        const processedArgs = step.args.map((arg) => {
          if (arg.includes('{{FIRST_PLAYER}}') && firstPlayer) {
            return arg.replace('{{FIRST_PLAYER}}', firstPlayer);
          }
          return arg;
        });
        args.push(...processedArgs);
      }
    }

    // Clean up environment (remove undefined values)
    const cleanEnv = {};
    if (step.env) {
      for (const [key, value] of Object.entries(step.env)) {
        if (value !== undefined) {
          cleanEnv[key] = value;
        }
      }
    }

    const result = await runCommand(cmd, args, cleanEnv);

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ Completed in ${duration}s`);

    // Extract first player for validation step
    if (step.name === 'Generate Forecast Bundle' && !firstPlayer) {
      const match = result.stdout.match(/ForecastBundle_TARGET_(\w+)\.json/);
      if (match) {
        firstPlayer = match[1];
        console.log(`   📝 Detected first player: ${firstPlayer}`);
      }
    }

    return result;
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ❌ Failed after ${duration}s`);
    console.log(`   Error: ${error.error || error.message}`);

    if (step.required) {
      failures.push({
        step: step.name,
        error: error.error || error.message,
        required: true,
      });
      throw error;
    } else {
      failures.push({
        step: step.name,
        error: error.error || error.message,
        required: false,
      });
      console.log(`   ⚠️  Non-critical step failed, continuing...`);
      return null;
    }
  }
}

async function main() {
  const startTime = Date.now();

  // Verify prerequisites
  if (!fs.existsSync('./serviceAccountKey.json')) {
    console.error('❌ Missing serviceAccountKey.json in project root');
    console.error('   Place your Firebase service account key before running');
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync('./outputs')) {
    fs.mkdirSync('./outputs', { recursive: true });
  }

  // Run each step
  for (const step of steps) {
    try {
      await runStep(step);
      currentStep++;
    } catch (error) {
      if (step.required) {
        console.log(`\n💥 CRITICAL FAILURE: ${step.name}`);
        console.log('   Pipeline stopped due to required step failure');
        break;
      }
    }
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(50));
  console.log('📊 Schema Transition Summary');
  console.log('='.repeat(50));
  console.log(`Total time: ${totalTime}s`);
  console.log(`Steps completed: ${currentStep}/${steps.length}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE MIGRATION'}`);

  if (failures.length === 0) {
    console.log('✅ All steps completed successfully!');

    if (DRY_RUN) {
      console.log('\n🔄 Next Steps:');
      console.log('1. Review the dry-run output above');
      console.log('2. Run without DRY_RUN=1 for live migration:');
      console.log('   node scripts/schema_transition_orchestrator.cjs');
    } else {
      console.log('\n🎉 Schema transition complete!');
      console.log(
        'Your Firestore has been migrated to the new hierarchical structure.'
      );
    }
  } else {
    console.log(`⚠️  ${failures.length} step(s) had issues:`);
    failures.forEach((f) => {
      const icon = f.required ? '❌' : '⚠️ ';
      console.log(`   ${icon} ${f.step}: ${f.error}`);
    });

    const criticalFailures = failures.filter((f) => f.required);
    if (criticalFailures.length > 0) {
      console.log('\n💥 Migration incomplete due to critical failures');
      process.exit(1);
    } else {
      console.log('\n✅ Migration completed with warnings');
    }
  }
}

main().catch((error) => {
  console.error('\n💥 Orchestrator failed:', error);
  process.exit(1);
});
