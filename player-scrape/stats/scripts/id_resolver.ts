// stats/scripts/id_resolver.ts
// Resolve NBA stats player ID from our shared index or cache file

import fs from 'node:fs/promises';
import path from 'node:path';
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

type IdCache = Record<string, string>;

async function readJson<T>(p: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(p, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJson<T>(p: string, data: T): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(data, null, 2), 'utf8');
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

  // 3) Local cache (non-destructive)
  const cache = (await readJson<IdCache>(paths.idsCache)) || {};
  if (cache[playerId]) return cache[playerId];

  // 4) Defer network resolution to runtime (caller may fetch and then cache)
  return null;
}

export async function cacheNbaPlayerId(
  playerId: string,
  nbaId: string
): Promise<void> {
  const cache = (await readJson<IdCache>(paths.idsCache)) || {};
  if (cache[playerId] === nbaId) return;
  cache[playerId] = nbaId;
  await writeJson(paths.idsCache, cache);
}
