// stats/scripts/id_resolver.ts
// Resolve NBA stats player ID from shared player index

import fs from 'node:fs/promises';
import { paths } from './config';

type PlayerIndexEntry = {
  salarySwishSlug?: string;
  teamCode?: string;
  displayName?: string;
  nbaId?: string | number;
  nbaStatsId?: string | number;
  [k: string]: unknown;
};

type PlayerIndex = Record<string, PlayerIndexEntry>;

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function resolveNbaPlayerId(
  playerId: string
): Promise<string | null> {
  // 1) Explicit override via env
  const envId = process.env.NBA_ID;
  if (envId) return String(envId);

  // 2) Shared player index (check both nbaId and nbaStatsId for compatibility)
  const index = (await readJson<PlayerIndex>(paths.sharedIndex)) || {};
  const entry = index[playerId];
  if (entry) {
    const id = (entry as any).nbaId || entry.nbaStatsId;
    if (id != null) return String(id);
  }

  // 3) Not found - caller must resolve via network or provide manually
  return null;
}
