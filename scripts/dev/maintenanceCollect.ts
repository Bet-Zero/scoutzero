import { randomUUID } from 'node:crypto';
/** Same portable collectors and parsers on supported local/cloud runtimes. No publisher. */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { getPlayerHtml } from '../../player-scrape/contracts/scripts/fetch_player_page.js';
import { parsePlayer } from '../../player-scrape/contracts/scripts/parse_player.js';
import { basePlayerSchema } from '../../player-scrape/shared/schema/player_scrape_schema.js';
import { fetchPlayerStatsBase, fetchPlayerStatsAdvanced, fetchTeamStatsPerGame, cleanupContext } from '../../player-scrape/stats/scripts/fetch_player_stats.js';
import { parseStats } from '../../player-scrape/stats/scripts/parse_stats.js';
import { buildStatsOutput } from '../../player-scrape/stats/scripts/run_stats.js';
import { parseTeamHtml } from '../../team-scrape/team-data/scripts/parse_team.js';
import { openMaintenanceRun, type RunRequest } from './maintenanceRun.js';
import { maintenanceContext } from './maintenanceContext.js';
import { privateDirectory, privateJson } from './cloudStorage.js';

export async function collectMaintenance(dir: string, request: RunRequest, resume = false) {
  const dated = maintenanceContext(request.season, request.asOf);
  const run = await openMaintenanceRun(dir, request, resume);
  const save = async (file: string, value: unknown) => { await privateJson(path.join(dir, file), value); return file; };
  const raw = async (file: string, value: string) => { await privateDirectory(path.dirname(path.join(dir, file))); await writeFile(path.join(dir, file), value, { mode: 0o600 }); return file; };
  let unchanged = 0;
  let teamStats: unknown;
  try {
    for (const [id, entry] of Object.entries(request.inventory)) {
      if (await run.verified(id)) { unchanged++; continue; }
      const files: string[] = [];
      const attemptId = id + '-' + randomUUID();
      try {
        if (!/^[A-Z]{3,4}$/.test(entry.teamCode || '')) { await run.record(id, 'missing', []); continue; }
        const team = entry.teamCode;
        if (request.operation === 'stats') {
          const nbaId = entry.nbaId ?? entry.nbaStatsId;
          if (!/^\d+$/.test(String(nbaId || ''))) { await run.record(id, 'missing', []); continue; }
          const base = await fetchPlayerStatsBase(String(nbaId), dated.startYear);
          const advanced = await fetchPlayerStatsAdvanced(String(nbaId), dated.startYear);
          files.push(await save(`raw/${attemptId}-base.json`, base), await save(`raw/${attemptId}-advanced.json`, advanced));
          if (base.parameters?.PlayerID != null && String(base.parameters.PlayerID) !== String(nbaId)) throw new Error('NBA response identity mismatch');
          if (!Array.isArray(base.resultSets)) throw new Error('Malformed NBA response');
          const seasonSet = base.resultSets.find((s: any) => /season.*totals.*regularseason/i.test(s.name));
          if (!seasonSet || !Array.isArray(seasonSet.rowSet)) throw new Error('Missing required season result set');
          if (!seasonSet.rowSet.length) { await run.record(id, 'no-games', files); continue; }
          const parsed = parseStats(base, advanced, { season: dated.startYear, teamCode: team, pos: entry.position, age: entry.age, allowFallback: true });
          if (parsed._fallbackType === 'current') {
            teamStats ??= await fetchTeamStatsPerGame(dated.startYear);
            files.push(await save(`raw/${attemptId}-teams.json`, teamStats));
          }
          const output = buildStatsOutput(parsed, id, team, parsed._fallbackType === 'current' ? teamStats : null);
          output.meta.lastStatsUpdate = { _seconds: Math.floor(Date.parse(dated.asOf) / 1000), _nanoseconds: 0 };
          files.push(await save(`stats/${team}/${id}.json`, output));
          await run.record(id, parsed._fallbackType === 'current' ? 'processed' : 'fallback', files);
        } else {
          const url = new URL(entry.url || '');
          if (url.protocol !== 'https:' || url.hostname !== 'www.salaryswish.com' || url.username || url.password || url.port || url.search || url.hash ||
              !(request.operation === 'contracts' ? /^\/players\/[a-z0-9-]+$/ : /^\/teams\/[a-z0-9-]+$/).test(url.pathname)) throw new Error('Exact source URL required');
          const fetchHtml = async () => {
            if (request.operation === 'contracts') return getPlayerHtml(id, url.href, { fresh: true });
            const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(45000) });
            if (!response.ok) throw new Error('Team source fetch failed');
            return response.text();
          };
          const first = await fetchHtml(); files.push(await raw(`raw/${attemptId}-first.html`, first));
          const second = await fetchHtml(); files.push(await raw(`raw/${attemptId}-second.html`, second));
          if (request.operation === 'contracts') {
            const output = basePlayerSchema.parse(await parsePlayer(first, { playerId: id, teamCode: team, teamName: entry.teamName, sourceUrl: url.href, asOf: new Date(dated.asOf) }));
            if (!output.contract.salariesByYear.length) throw new Error('No supplied contract salary rows');
            files.push(await save(`contracts/${team}/${id}.json`, output));
          } else {
            const output = await parseTeamHtml(first, { url: url.href, team, season: dated.season, asOf: dated.asOf });
            if (!output.roster.length || !output.teamName || !output.totals.salaryCap) throw new Error('Incomplete team page');
            files.push(await save(`teams/${team}.json`, output));
          }
          await run.record(id, 'processed', files);
        }
      } catch (error) {
        files.push(await save(`failures/${attemptId}.json`, { category: error instanceof Error ? error.name : 'UnknownError', message: error instanceof Error ? error.message.replace(/https?:\/\/\S+/g, '[source URL]') : 'Collection failed' }));
        await run.record(id, 'failed', files);
      }
    }
  } finally { await cleanupContext(); }
  const result = { ...run.coverage(), unchanged, qualified: false, productionWriteAuthorized: false };
  await privateJson(path.join(dir, 'coverage.json'), result);
  return result;
}

if (decodeURIComponent(import.meta.url) === `file://${process.argv[1]}`) {
  try {
    const option = (key: string) => process.argv.find(v => v.startsWith('--' + key + '='))?.slice(key.length + 3) || '';
    const operation = option('operation');
    if (!['contracts', 'stats', 'teams'].includes(operation) || !option('run') || !option('inventory')) throw new Error('operation, private run and explicit inventory required');
    const inventory = JSON.parse(await readFile(option('inventory'), 'utf8'));
    const result = await collectMaintenance(path.resolve(option('run')), { operation: operation as RunRequest['operation'], inventory, season: option('season'), asOf: option('as-of') }, process.argv.includes('--resume'));
    console.log(JSON.stringify(result));
    if (!result.complete) process.exitCode = 1;
  } catch { console.error('Maintenance collection failed; inspect private coverage. Fresh runs never reuse prior output.'); process.exitCode = 1; }
}
