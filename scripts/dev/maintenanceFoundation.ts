/**
 * FILE: scripts/dev/maintenanceFoundation.ts
 * PURPOSE: Forward one explicit dated generation through the existing foundation builders.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 late aggregate-command repair.
 * LINKS: docs/operations/NBA_MAINTENANCE.md
 */
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { maintenanceContext } from './maintenanceContext.js';
import { maintenanceErrorMessage } from './maintenanceErrors.js';
import { privateJson } from './cloudStorage.js';

export async function buildFoundation(argv: string[], run = (script: string, args: string[], env: NodeJS.ProcessEnv) => {
  const result = spawnSync(process.execPath, ['--import', 'tsx', script, ...args], { env, stdio: 'inherit' });
  if (result.error || result.status !== 0) throw new Error('Foundation builder failed; generation remains incomplete');
}) {
  const { values } = parseArgs({ args: argv, options: {
    season: { type: 'string' }, 'as-of': { type: 'string' },
    'outputs-dir': { type: 'string' }, 'reports-dir': { type: 'string' },
  } });
  const year = Number(values.season);
  if (!Number.isInteger(year) || year < 2001 || year > 2100) throw new Error('Explicit --season END_YEAR required (2027 means 2026-27)');
  const context = maintenanceContext(`${year - 1}-${String(year).slice(-2)}`, values['as-of'] || '');
  const output = values['outputs-dir'] || process.env.OUTPUTS_DIR;
  const reports = values['reports-dir'] || process.env.REPORTS_DIR;
  if (!output || !reports) throw new Error('Explicit private --outputs-dir and --reports-dir required');
  const outputsDir = path.resolve(output); const reportsDir = path.resolve(reports);
  if (outputsDir === reportsDir || outputsDir.startsWith(reportsDir + path.sep) || reportsDir.startsWith(outputsDir + path.sep)) throw new Error('Use separate new output and report directories');
  for (const dir of [outputsDir, reportsDir]) {
    await mkdir(path.dirname(dir), { recursive: true, mode: 0o700 });
    await mkdir(dir, { mode: 0o700 }); // Fresh aggregate never mixes or overwrites a prior generation.
  }
  const env = { ...process.env, OUTPUTS_DIR: outputsDir, REPORTS_DIR: reportsDir,
    SEASON: String(year), SEASON_CODE: context.season, MAINTENANCE_SEASON: context.season, MAINTENANCE_AS_OF: context.asOf };
  const completed: string[] = [];
  const receipt = () => privateJson(path.join(outputsDir, 'foundation-run.json'), { version: 1, ...context, endYear: year, completed, complete: completed.length === 3 });
  await receipt();
  for (const name of ['build_all_player_ids', 'build_players_bios', 'build_player_index']) {
    const script = fileURLToPath(new URL(`../../player-scrape/shared/scripts/${name}.ts`, import.meta.url));
    await run(script, ['--season=' + year], env);
    completed.push(name); await receipt();
  }
  return { complete: true, ...context, endYear: year, outputsDir, reportsDir };
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  if (process.argv.includes('--help')) console.log('build:foundation -- --season=2027 --as-of=<UTC timestamp> --outputs-dir=<new private directory> --reports-dir=<new private directory>\nRuns existing IDs → bios → index in order; stops at first failure. Full source collection: run only when the refresh is authorized.');
  else try { console.log(JSON.stringify(await buildFoundation(process.argv.slice(2)))); }
  catch (error) { console.error(maintenanceErrorMessage(error)); process.exitCode = 1; }
}
