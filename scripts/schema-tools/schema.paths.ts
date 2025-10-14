// ===============================
// SCSP™ FULL FILE REPLACEMENT
// File: scripts/schema.paths.ts
// Purpose: Centralize collection names & path builders based on schema.lock.json
// ===============================
import * as fs from 'fs';

export interface SchemaPaths {
  playersRoot: string; // e.g., "players_v2"
  teamsRoot: string; // e.g., "teams" or "architect/teams"
  playerContractsSub: string; // e.g., "Contracts"
  playerSeasonsSub?: string; // e.g., "seasons" (if you use it)
  contractYearsSub?: string; // e.g., "years"
}

let cached: SchemaPaths | null = null;

export function getSchemaPaths(): SchemaPaths {
  if (cached) return cached;

  // Load the lock (edit path if you store elsewhere)
  const raw = fs.readFileSync(
    'schema-lock-players_v2/players_schema.lock.json',
    'utf8'
  );
  const lock = JSON.parse(raw) as {
    docs: Array<{ path: string; subcollections: string[] }>;
  };

  // Heuristics: find a player doc that has a Contracts subcollection
  const playerDoc = lock.docs.find((d) => d.path.split('/').length === 2); // {playersRoot}/{playerId}
  const playersRoot = playerDoc?.path.split('/')[0] ?? 'players_v2';

  // Look for a doc under playersRoot that lists likely subcollections
  const firstPlayer = lock.docs.find((d) =>
    d.path.startsWith(playersRoot + '/')
  );
  const contractsSub =
    (firstPlayer?.subcollections || []).find((s) => /contracts/i.test(s)) ||
    'Contracts';
  const seasonsSub = (firstPlayer?.subcollections || []).find((s) =>
    /season/i.test(s)
  );

  // Try to detect a "years" subcollection under any contract doc
  const aContractDoc = lock.docs.find((d) => {
    const parts = d.path.split('/');
    return (
      parts[0] === playersRoot &&
      parts[2] === contractsSub &&
      parts.length === 4
    );
  });
  let yearsSub: string | undefined;
  if (aContractDoc) {
    const sub = lock.docs.find(
      (d) =>
        d.path.startsWith(aContractDoc.path + '/') &&
        d.path.split('/').length === 6
    );
    if (sub) yearsSub = sub.path.split('/')[4];
  }

  // Teams root (if present)
  const teamRootDoc = lock.docs.find(
    (d) => d.path.split('/').length === 2 && d.path !== playerDoc?.path
  );
  const teamsRoot = (lock as any).roots?.includes('teams')
    ? 'teams'
    : (teamRootDoc?.path.split('/')[0] ?? 'teams');

  cached = {
    playersRoot,
    teamsRoot,
    playerContractsSub: contractsSub,
    playerSeasonsSub: seasonsSub,
    contractYearsSub: yearsSub,
  };
  return cached;
}
