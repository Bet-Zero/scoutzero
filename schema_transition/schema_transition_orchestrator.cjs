#!/usr/bin/env node
// Master Schema Transition Orchestrator (MODE-aware, emulator-friendly, live guard)

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// ─────────────────────────────────────────────────────────────────────────────
// CLI + ENV
// ─────────────────────────────────────────────────────────────────────────────
const argv = yargs(hideBin(process.argv))
  .option('mode', { type: 'string', choices: ['dry-run','shadow','live'] })
  .option('season', { type: 'string' })
  .option('sample-players', { type: 'string' })
  .option('sample-teams', { type: 'string' })
  .option('only', { type: 'string', desc: 'Comma list: players,contracts,teams' })
  .option('i-understand-the-risks', { type: 'boolean', default: false })
  .help(false)
  .parse();

const MODE = argv.mode || process.env.MODE || (process.env.DRY_RUN === '0' ? 'live' : 'dry-run'); // default safe
const SEASON = argv.season || process.env.SEASON || '2025-26';
const SAMPLE_PLAYERS = argv['sample-players'] || process.env.SAMPLE_PLAYERS || 'lebron_james';
const SAMPLE_TEAMS = argv['sample-teams'] || process.env.SAMPLE_TEAMS || 'lal';
const ONLY = (argv.only || process.env.ONLY || '').split(',').map(s => s.trim()).filter(Boolean);

const LIVE_MODE = MODE === 'live';
const SHADOW_MODE = MODE === 'shadow';
const DRY_RUN = MODE === 'dry-run';

// Live guard
if (LIVE_MODE && !argv['i-understand-the-risks']) {
  console.error('❌ Refusing LIVE mode without --i-understand-the-risks');
  process.exit(2);
}

// Emulator awareness: allow no real key when emulator is set
const USING_EMULATOR = !!process.env.FIRESTORE_EMULATOR_HOST;

// ─────────────────────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────────────────────
console.log('🔄 Schema Transition Master Orchestrator');
console.log('=====================================');
console.log(`Mode: ${MODE.toUpperCase()} ${USING_EMULATOR ? '(EMULATOR)' : ''}`);
console.log(`Season: ${SEASON}`);
if (DRY_RUN || SHADOW_MODE) {
  console.log(`Sample Players: ${SAMPLE_PLAYERS}`);
  console.log(`Sample Teams: ${SAMPLE_TEAMS}`);
}
if (ONLY.length) console.log(`Only: ${ONLY.join(', ')}`);
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
// Steps (can be filtered by --only)
// ─────────────────────────────────────────────────────────────────────────────
const BASE_DIR = __dirname;

const steps = [
  { key: 'export', name: 'Export Current Data', script: 'core/export_current.js', type: 'node', required: true, env: { SEASON } },
  { key: 'schema', name: 'Build Schema Trees', script: 'core/build_schema.cjs', type: 'node', required: true, env: { SEASON } },
  { key: 'scan', name: 'Scan Player Mapping', script: 'utils/scan_and_map_player.cjs', type: 'node', required: false, env: { PLAYER: SAMPLE_PLAYERS.split(',')[0], SEASON } },
  { key: 'map', name: 'Generate Schema Map', script: 'core/emit_schema_map.cjs', type: 'node', required: true, env: { SEASON } },
  { key: 'forecast', name: 'Generate Forecast Bundle', script: 'utils/generate_forecast_bundle.cjs', type: 'node', required: true, env: { SEASON } },
  { key: 'validate', name: 'Validate Schema Compatibility', script: 'utils/validate_forecast_compat.cjs', type: 'node', required: false, args: ['outputs/ForecastBundle_TARGET_{{FIRST_PLAYER}}.json'] },
  // Core migrations
  { key: 'contracts', name: 'Migrate Contracts & Views', script: 'core/migrate_contracts_and_views.cjs', type: 'node', required: true, env: { MODE, SEASON } },
  { key: 'players', name: 'Migrate Full Players', script: 'core/migrate_full_players.cjs', type: 'node', required: true, env: { MODE, SEASON, SAMPLE_PLAYERS: (DRY_RUN || SHADOW_MODE) ? SAMPLE_PLAYERS : undefined } },
  { key: 'teams', name: 'Build Team Seasons', script: 'core/build_team_seasons_full.cjs', type: 'node', required: true, env: { MODE, SEASON, SAMPLE_TEAMS: (DRY_RUN || SHADOW_MODE) ? SAMPLE_TEAMS : undefined } },
];

// Filter by --only
const INCLUDE = ONLY.length
  ? new Set(ONLY.map(x => x.toLowerCase()))
  : null;

const filteredSteps = steps.filter(s => {
  if (!INCLUDE) return true;
  // Map keys for convenience
  const keyMap = {
    players: 'players',
    contracts: 'contracts',
    teams: 'teams',
    export: 'export',
    schema: 'schema',
    scan: 'scan',
    map: 'map',
    forecast: 'forecast',
    validate: 'validate',
  };
  return INCLUDE.has(keyMap[s.key] || s.key);
});

// ─────────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────────
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
      cwd: BASE_DIR,
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
      if (code === 0) resolve({ stdout, stderr, code });
      else reject({ stdout, stderr, code, error: `Process exited with code ${code}` });
    });

    child.on('error', (error) => reject({ stdout, stderr, code: -1, error: error.message }));
  });
}

async function runStep(step) {
  console.log(`\n📋 Step ${currentStep + 1}/${filteredSteps.length}: ${step.name}`);
  console.log(`   ${step.description || ''}`);
  console.log(`   Running: ${step.script}`);

  const startTime = Date.now();

  try {
    let cmd = 'node';
    let args = [path.join(BASE_DIR, step.script)];

    // arg template replacement
    if (step.args) {
      const processedArgs = step.args.map((arg) =>
        arg.includes('{{FIRST_PLAYER}}') && firstPlayer ? arg.replace('{{FIRST_PLAYER}}', firstPlayer) : arg
      );
      args.push(...processedArgs);
    }

    // Clean env
    const cleanEnv = {};
    if (step.env) for (const [k, v] of Object.entries(step.env)) if (v !== undefined) cleanEnv[k] = v;

    // Safety: never pass live if guard is not set
    if (MODE === 'live' && !argv['i-understand-the-risks']) cleanEnv.MODE = 'shadow';

    const result = await runCommand(cmd, args, cleanEnv);
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`   ✅ Completed in ${duration}s`);

    // Capture first player from forecast output
    if (step.key === 'forecast' && !firstPlayer) {
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
      failures.push({ step: step.name, error: error.error || error.message, required: true });
      throw error;
    } else {
      failures.push({ step: step.name, error: error.error || error.message, required: false });
      console.log(`   ⚠️  Non-critical step failed, continuing...`);
      return null;
    }
  }
}

async function main() {
  const startTime = Date.now();

  // Preflight: keys/emulator check
  const hasKey = fs.existsSync(path.join(process.cwd(), 'serviceAccountKey.json')) || !!process.env.SA_PATH;
  if (!hasKey && !USING_EMULATOR && !DRY_RUN) {
    console.error('❌ Missing credentials or emulator for MODE=' + MODE);
    console.error('   Use Firestore emulator (set FIRESTORE_EMULATOR_HOST & GCLOUD_PROJECT) or supply SA_PATH.');
    process.exit(1);
  }

  // outputs/
  const outputDir = path.join(BASE_DIR, 'outputs');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  for (const step of filteredSteps) {
    await runStep(step).then(() => currentStep++).catch(err => {
      if (step.required) {
        console.log(`\n💥 CRITICAL FAILURE: ${step.name}`);
        console.log('   Pipeline stopped due to required step failure');
        throw err;
      }
    });
  }

  // Summary
  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n' + '='.repeat(50));
  console.log('📊 Schema Transition Summary');
  console.log('='.repeat(50));
  console.log(`Total time: ${totalTime}s`);
  console.log(`Steps completed: ${currentStep}/${filteredSteps.length}`);
  console.log(`Mode: ${MODE.toUpperCase()} ${USING_EMULATOR ? '(EMULATOR)' : ''}`);

  if (failures.length === 0) {
    console.log('✅ All selected steps completed successfully!');
  } else {
    console.log(`⚠️  ${failures.length} step(s) had issues:`);
    failures.forEach(f => console.log(`   ${f.required ? '❌' : '⚠️'} ${f.step}: ${f.error}`));
    const crit = failures.some(f => f.required);
    if (crit) process.exit(1);
  }
}

main().catch((error) => {
  console.error('\n💥 Orchestrator failed:', error);
  process.exit(1);
});
