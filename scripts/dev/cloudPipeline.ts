import { canonical, firestoreFieldHash } from './firestoreValue.js';
export { canonical } from './firestoreValue.js';
/** Reuse the player stager/validator; retain inputs and exact review plans privately. No publisher. */
import { maintenanceContext } from './maintenanceContext.js';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { stagePlayer } from '../../player-scrape/firestore_staging/scripts/stage_player.js';
import { validatePlayer } from '../../player-scrape/firestore_staging/scripts/validate_staged.js';
import { BasePlayerDocZ } from '../../src/schemas/architect.js';
import { DATA_DIR, SOURCE_PROJECT, digest, loadSnapshot, validateSnapshot, type Snapshot } from './cloudData.js';
import { privateDirectory, privateJson } from './cloudStorage.js';

const PREFIX = `projects/${SOURCE_PROJECT}/databases/(default)/documents/`;
const hash = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const idPattern = /^[\p{L}\p{N}][\p{L}\p{M}\p{N}_]{0,100}$/u;

function encode(value: unknown): unknown {
  if (value === null) return { nullValue: 'NULL_VALUE' };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) return Number.isSafeInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encode) } };
  if (value && typeof value === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, encode(item)])) } };
  throw new Error('Unsupported staged value');
}
export function mergeTypedFields(before: Record<string, any>, patch: Record<string, unknown>): Record<string, unknown> {
  const result = { ...before };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (key === 'salariesByYear' && Array.isArray(value) && before[key]?.arrayValue) {
      const prior = before[key].arrayValue.values || [];
      const bySeason = new Map(prior.map((row: any) => [row.mapValue?.fields?.season?.stringValue, row]));
      const incoming = new Set(value.map((row: any) => row.season));
      result[key] = { arrayValue: { values: [
        ...prior.filter((row: any) => !incoming.has(row.mapValue?.fields?.season?.stringValue)),
        ...value.map((row: any) => ({ mapValue: { fields: mergeTypedFields((bySeason.get(row.season) as any)?.mapValue?.fields || {}, row) } })),
      ] } };
    } else if (value && typeof value === 'object' && !Array.isArray(value) && before[key]?.mapValue) {
      result[key] = { mapValue: { fields: mergeTypedFields(before[key].mapValue.fields || {}, value as Record<string, unknown>) } };
    } else result[key] = encode(value);
  }
  return result;
}
type Provenance = {
  version: 1; kind: 'scrape' | 'firestore-recovery'; acquiredAt: string;
  statsInventory?: string[]; statsStatus?: Record<string, string>;
  baselineSha256?: string; sourceUrls: string[]; qualification: 'unreviewed';
  files: { path: string; sha256: string; bytes: number }[];
};

export function decodeFields(fields: Record<string, unknown>): Record<string, unknown> {
  const decode = (input: unknown): unknown => {
    if (!input || typeof input !== 'object') throw new Error('Invalid Firestore typed value');
    const v = input as Record<string, any>;
    if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
    if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
    if ('nullValue' in v) return null;
    if ('integerValue' in v) {
      const value = Number(v.integerValue);
      if (!Number.isSafeInteger(value)) throw new Error('Integer cannot be staged without loss');
      return value;
    }
    if ('doubleValue' in v) {
      const value = Number(v.doubleValue);
      if (!Number.isFinite(value)) throw new Error('Nonfinite numeric fields cannot be staged without loss');
      return value;
    }
    for (const key of ['stringValue', 'booleanValue', 'timestampValue']) if (key in v) return v[key];
    throw new Error('Unsupported typed field; do not silently normalize it');
  };
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]));
}

/** Human review representation only; opaque Firestore values stay typed and untouched. */
function reviewFields(fields: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    try { return [key, decodeFields({ value }).value]; }
    catch { return [key, { retainedFirestoreValue: value }]; }
  }));
}

export function assertInputPath(file: string) {
  if (!/^(player_index\.json|contracts\/[A-Z]{3,4}\/[\p{L}\p{M}\p{N}_]+\.json|stats\/[A-Z]{3,4}\/[\p{L}\p{M}\p{N}_]+\.json|raw\/[\p{L}\p{M}\p{N}_-]+\.(html|json))$/u.test(file)) {
    throw new Error('Pipeline input is not an approved source artifact');
  }
}

export async function verifyInputBundle(dir: string) {
  const provenance = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8')) as Provenance;
  if (provenance.version !== 1 || !['scrape', 'firestore-recovery'].includes(provenance.kind) ||
      provenance.qualification !== 'unreviewed' || !Number.isFinite(Date.parse(provenance.acquiredAt)) ||
      !Array.isArray(provenance.files) || !provenance.files.length || !Array.isArray(provenance.sourceUrls)) throw new Error('Invalid source-input manifest');
  const seen = new Set<string>();
  for (const entry of provenance.files) {
    assertInputPath(entry.path);
    if (seen.has(entry.path)) throw new Error('Duplicate pipeline input');
    seen.add(entry.path);
    const file = path.join(dir, entry.path);
    let parent = dir;
    for (const part of entry.path.split('/').slice(0, -1)) {
      parent = path.join(parent, part);
      if (!(await lstat(parent)).isDirectory()) throw new Error('Pipeline input directories must not be symbolic links');
    }
    if (!(await lstat(file)).isFile()) throw new Error('Pipeline input must be a regular file');
    const bytes = await readFile(file);
    if (bytes.length !== entry.bytes || hash(bytes) !== entry.sha256) throw new Error('Pipeline input integrity mismatch');
  }
  if (provenance.statsInventory && (!Array.isArray(provenance.statsInventory) || new Set(provenance.statsInventory).size !== provenance.statsInventory.length ||
      provenance.statsInventory.some(id => !idPattern.test(id) || !['processed', 'fallback', 'no-games'].includes(provenance.statsStatus?.[id] || '')))) throw new Error('Invalid per-player statistics scope');
  if (!seen.has('player_index.json')) throw new Error('Player index is required');
  return provenance;
}

/** Recover lost staging inputs from database bytes; never label them a fresh scrape. */
export async function recoverPlayerInput(playerId: string, sourceDir: string) {
  if (!idPattern.test(playerId)) throw new Error('Invalid player ID');
  const snapshot = await loadSnapshot(sourceDir);
  const doc = snapshot.documents.find((d) => d.name === PREFIX + 'architect_basePlayers/' + playerId);
  if (!doc) throw new Error('Base player is absent from this source baseline');
  const value = BasePlayerDocZ.parse(decodeFields(doc.fields || {}));
  const team = value.teamCode || 'FREE';
  if (!/^[A-Z]{3,4}$/.test(team)) throw new Error('Recovered player has an invalid team code');
  const baselineSha256 = digest(snapshot);
  const dir = path.resolve(DATA_DIR, 'pipeline', 'inputs', baselineSha256, playerId);
  const files: Record<string, unknown> = {
    'player_index.json': { [playerId]: { fullName: value.displayName, displayName: value.displayName, teamCode: value.teamCode } },
    [`contracts/${team}/${playerId}.json`]: value,
  };
  const seasons = snapshot.documents.filter((d) => d.name.startsWith(PREFIX + `players_v2/${playerId}/seasons/`));
  if (seasons.length) files[`stats/${team}/${playerId}.json`] = {
    playerId, teamCode: value.teamCode,
    seasons: Object.fromEntries(seasons.map((d) => {
      const season = decodeFields(d.fields || {});
      return [String(season.season || d.name.split('/').at(-1)), season];
    })),
  };
  const entries = [];
  for (const [file, contents] of Object.entries(files)) {
    await privateJson(path.join(dir, file), contents);
    const bytes = await readFile(path.join(dir, file));
    entries.push({ path: file, sha256: hash(bytes), bytes: bytes.length });
  }
  await privateJson(path.join(dir, 'manifest.json'), {
    version: 1, kind: 'firestore-recovery', acquiredAt: snapshot.readTime || snapshot.capturedAt,
    baselineSha256, qualification: 'unreviewed', sourceUrls: [doc.name], files: entries,
  } satisfies Provenance);
  await verifyInputBundle(dir);
  return dir;
}

export function changedFields(before: unknown, after: unknown, prefix = ''): string[] {
  const identity = (value: unknown) => digest({ defined: value !== undefined, value: value ?? null });
  if (identity(before) === identity(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap((key) =>
      changedFields((before as Record<string, unknown>)[key], (after as Record<string, unknown>)[key], prefix ? prefix + '.' + key : key));
  }
  return [prefix || '(document)'];
}

export function planPlayerWrites(snapshot: Snapshot, playerId: string, staged: any, base: unknown) {
  validateSnapshot(snapshot);
  if (!idPattern.test(playerId) || !snapshot.readTime || snapshot.authentication === 'unauthenticated' ||
      !['google', 'firebase-anonymous'].includes(snapshot.authentication || '') || !Number.isFinite(Date.parse(snapshot.readTime)) ||
      Date.parse(snapshot.readTime) > Date.now() + 60000 || Date.now() - Date.parse(snapshot.readTime) > 86400000) throw new Error('Update plans require an authenticated live baseline less than 24 hours old');
  if (snapshot.collections.players_v2?.status !== 'read' || snapshot.collections.architect_basePlayers?.status !== 'read') throw new Error('Root coverage is missing');
  // Reuse historical contract keys only for the same deal identity; a later
  // signing gets its own deterministic ID instead of overwriting contract_1.
  const contractIdentity = (v: any) => digest([v.startSeason, v.signingDate ?? null, v.signingTeam, v.isExtension ?? false]);
  const oldContracts = snapshot.documents.filter(d => d.name.startsWith(PREFIX + `players_v2/${playerId}/contracts/`));
  const remapped: Record<string, any> = {}; const keyMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(staged.contracts || {})) {
    const identity = contractIdentity(value);
    const matches = oldContracts.filter(d => contractIdentity(decodeFields(Object.fromEntries(Object.entries(d.fields || {}).filter(([k]) => ['startSeason', 'signingDate', 'signingTeam', 'isExtension'].includes(k))))) === identity);
    if (matches.length > 1) throw new Error('Ambiguous retained contract identity requires explicit evidence reconciliation');
    const newKey = matches[0]?.name.split('/').at(-1) || 'deal_' + identity.slice(0, 24);
    if (remapped[newKey]) throw new Error('Duplicate staged contract identity');
    keyMap[key] = newKey; remapped[newKey] = value;
  }
  const replaceKeys = (v: any): any => Array.isArray(v) ? v.map(replaceKeys) : v && typeof v === 'object' ?
    Object.fromEntries(Object.entries(v).map(([key, value]) => [key, key === 'sourceContractId' && typeof value === 'string' ? keyMap[value] || value : replaceKeys(value)])) : v;
  for (const old of (base === undefined ? [] : oldContracts)) {
    const key = old.name.split('/').at(-1)!;
    const metadata = (old.fields?.metadata as any)?.mapValue?.fields;
    if (!remapped[key] && metadata?.isCurrent?.booleanValue === true) {
      const identityFields = decodeFields(Object.fromEntries(Object.entries(old.fields || {}).filter(([name]) => ['startSeason', 'signingDate', 'signingTeam', 'isExtension'].includes(name))));
      remapped[key] = { ...identityFields, metadata: { isCurrent: false } };
    }
  }
  staged = { ...staged, contracts: remapped, views: replaceKeys(staged.views) };
  const candidates: Record<string, unknown> = { [`players_v2/${playerId}`]: staged.doc, ...(base === undefined ? {} : { [`architect_basePlayers/${playerId}`]: base }) };
  for (const child of ['contracts', 'seasons', 'views']) {
    const collection = `players_v2/${playerId}/${child}`;
    if (snapshot.collections[collection]?.status !== 'read') throw new Error('Cannot determine nested-record preconditions from missing coverage');
    for (const [id, value] of Object.entries(staged[child] || {})) {
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error('Invalid staged child ID');
      candidates[collection + '/' + id] = value;
    }
  }
  return Object.entries(candidates).map(([documentPath, after]) => {
    if (after === undefined || after === null) throw new Error('Staged document is missing');
    const old = snapshot.documents.find((d) => d.name === PREFIX + documentPath);
    if (old && !old.updateTime) throw new Error('Existing record lacks update-time precondition');
    const before = old ? reviewFields(old.fields || {}) : null;
    const patch = { ...(after as Record<string, unknown>) };
    if (old?.fields?.createdAt) delete patch.createdAt;
    // Ordinal contract IDs are historical storage keys, not deal identities.
    // Never merge a different deal into contract_1 after an expiry/extension.
    if (old && documentPath.includes('/contracts/')) {
      const prior = reviewFields(old.fields || {});
      const identity = (v: any) => [v.startSeason, v.signingDate ?? null, v.signingTeam, v.isExtension ?? false];
      if (digest(identity(prior)) !== digest(identity(patch))) throw new Error('Contract identity changed; preserve history and prepare an explicitly reviewed new contract ID');
    }
    const afterFields = mergeTypedFields(old?.fields || {}, patch);
    if (documentPath === `players_v2/${playerId}` && staged.statsProvided && !staged.doc.currentSeasonStats) delete afterFields.currentSeasonStats;
    const merged = reviewFields(afterFields);
    return { path: documentPath, beforeFields: old ? old.fields || {} : null,
      precondition: old ? { updateTime: old.updateTime! } : { exists: false as const },
      after: merged, afterFields, beforeSha256: firestoreFieldHash(old ? old.fields || {} : null), afterSha256: firestoreFieldHash(afterFields),
      changedFields: changedFields(before, merged) };
  }).filter((entry) => entry.changedFields.length);
}

export async function preparePlayer(playerId: string, inputDir: string, sourceDir: string, context: { season: string; asOf: string }) {
  const dated = maintenanceContext(context.season, context.asOf);
  if (!idPattern.test(playerId)) throw new Error('Invalid player ID');
  const provenance = await verifyInputBundle(inputDir);
  const inputContext = provenance as typeof provenance & { season?: string; effectiveAt?: string };
  if ((inputContext.season && inputContext.season !== dated.season) || (inputContext.effectiveAt && new Date(inputContext.effectiveAt).toISOString() !== dated.asOf)) throw new Error('Input and preparation season/as-of differ');
  const snapshot = await loadSnapshot(sourceDir);
  const baselineSha256 = digest(snapshot);
  const runDir = path.resolve(DATA_DIR, 'pipeline', 'runs', new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID().slice(0, 8));
  await privateDirectory(runDir);
  // Retain the exact verified inputs in each run; no dependence on mutable producer paths.
  const { cp } = await import('node:fs/promises');
  await privateDirectory(path.join(runDir, 'inputs'));
  for (const entry of provenance.files) {
    const destination = path.join(runDir, 'inputs', entry.path);
    await privateDirectory(path.dirname(destination));
    await cp(path.join(inputDir, entry.path), destination, { errorOnExist: true, force: false });
  }
  await privateJson(path.join(runDir, 'inputs', 'manifest.json'), provenance);
  await verifyInputBundle(path.join(runDir, 'inputs'));
  const stagedDir = path.join(runDir, 'staged');
  await stagePlayer({ playerId, outDir: stagedDir, validate: true,
    season: dated.season, asOf: dated.asOf,
    indexPath: path.join(runDir, 'inputs/player_index.json'),
    contractsDir: path.join(runDir, 'inputs/contracts'), statsDir: path.join(runDir, 'inputs/stats') });
  const validation = await validatePlayer(playerId, stagedDir);
  await privateJson(path.join(runDir, 'validation.json'), validation);
  if (!validation.valid) throw new Error('Existing staged-player validation failed; private run evidence retained');
  const staged = JSON.parse(await readFile(path.join(stagedDir, 'players_v2', playerId + '.json'), 'utf8'));
  const base = JSON.parse(await readFile(path.join(stagedDir, 'basePlayers', playerId + '.json'), 'utf8'));
  staged.statsProvided = provenance.statsInventory ? provenance.statsInventory.includes(playerId) : provenance.files.some(file => file.path.startsWith('stats/') && file.path.endsWith('/' + playerId + '.json'));
  const entries = planPlayerWrites(snapshot, playerId, staged, base);
  const plan = { version: 1, context: dated, createdAt: new Date().toISOString(), sourceProject: SOURCE_PROJECT, baselineSha256,
    baselineReadTime: snapshot.readTime, inputManifestSha256: digest(provenance), provenance, entries,
    productionWriteAuthorized: false,
    gates: ['Independent qualification of original source inputs', 'Review exact before/after changes',
      'Change-specific production approval', 'Re-read and match every exact update-time/absence precondition'],
    excluded: ['PST/first-round rights', 'teams', 'accounts', 'user content', 'saved worlds'],
    note: 'Schema validation and database recovery do not establish current basketball facts. No production writer is provided.' };
  await privateJson(path.join(runDir, 'plan.json'), plan);
  const files: { path: string; sha256: string; bytes: number }[] = [];
  async function inventory(dir: string) {
    for (const file of await readdir(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, file.name);
      if (file.isDirectory()) await inventory(absolute);
      else { const bytes = await readFile(absolute); files.push({ path: path.relative(runDir, absolute), sha256: hash(bytes), bytes: bytes.length }); }
    }
  }
  await inventory(runDir);
  await privateJson(path.join(runDir, 'manifest.json'), { version: 1, baselineSha256, sourceKind: provenance.kind, files });
  return { runDir, recordsChanged: entries.length, validationPassed: true, productionWriteAuthorized: false };
}

export async function verifyPipelineRun(runDir: string) {
  const manifest = JSON.parse(await readFile(path.join(runDir, 'manifest.json'), 'utf8'));
  if (manifest.version !== 1 || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Invalid retained pipeline run');
  const seen = new Set<string>();
  for (const file of manifest.files) {
    if (typeof file.path !== 'string' || file.path.startsWith('/') || file.path.split('/').some((p: string) => !p || p === '.' || p === '..') || seen.has(file.path)) throw new Error('Invalid retained artifact path');
    seen.add(file.path);
    const absolute = path.join(runDir, file.path);
    if (!(await lstat(absolute)).isFile()) throw new Error('Retained artifact is not a regular file');
    const bytes = await readFile(absolute);
    if (hash(bytes) !== file.sha256 || bytes.length !== file.bytes) throw new Error('Retained pipeline artifact integrity mismatch');
  }
  for (const required of ['plan.json', 'validation.json', 'inputs/manifest.json']) if (!seen.has(required)) throw new Error('Required retained artifact is missing');
  const provenance = await verifyInputBundle(path.join(runDir, 'inputs'));
  const plan = JSON.parse(await readFile(path.join(runDir, 'plan.json'), 'utf8'));
  const validation = JSON.parse(await readFile(path.join(runDir, 'validation.json'), 'utf8'));
  if (plan.version !== 1 || plan.sourceProject !== SOURCE_PROJECT || plan.baselineSha256 !== manifest.baselineSha256 ||
      plan.productionWriteAuthorized !== false || !validation.valid || plan.inputManifestSha256 !== digest(provenance)) throw new Error('Retained pipeline plan contract failed');
  return { integrityVerified: true, validationPassed: true, sourceKind: provenance.kind,
    recordsChanged: plan.entries.length, baselineSha256: plan.baselineSha256,
    productionWriteAuthorized: false, requiredGates: plan.gates };
}

