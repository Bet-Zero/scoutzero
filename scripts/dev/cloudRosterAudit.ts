/** Audit source relationships and prepare evidence-backed proposals, never source writes. */
import path from 'node:path';
import { lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { coverage, digest, loadSnapshot, SOURCE_PROJECT, type Getter, type Snapshot, type SourceDocument } from './cloudData.js';
import { firebaseReader, googleReader } from './cloudReader.js';
import { decodeFields } from './cloudPipeline.js';
import { privateJson } from './cloudStorage.js';
import { PLAYERS_COLLECTION, ARCHITECT_BASE_PLAYERS_PATH as BASE_PLAYERS, ARCHITECT_BASE_TEAMS_PATH as BASE_TEAMS } from '../../src/constants/collections.js';

const PREFIX = `projects/${SOURCE_PROJECT}/databases/(default)/documents/`;
export async function privateRosterAuditDirectory(root: string, directory: string) {
  const base = path.resolve(root); const target = path.resolve(directory);
  if (!target.startsWith(base + path.sep)) throw new Error('Roster evidence must stay beneath the ignored private root');
  let current = base;
  for (const part of ['', ...path.relative(base, target).split(path.sep)]) {
    if (part) current = path.join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Private evidence destination cannot traverse links or files');
    } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') break; throw error; }
  }
  return target;
}
const nameKey = (value: unknown) => typeof value === 'string' ? value.normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase() : '';
function dob(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value); return Number.isFinite(date.valueOf()) ? date.toISOString().slice(0, 10) : null;
}
const fields = (doc: SourceDocument) => decodeFields(doc.fields || {}) as any;
export function rosterGaps(snapshot: Snapshot) {
  const report = coverage(snapshot); const byPath = new Map(snapshot.documents.map((d) => [d.name.slice(PREFIX.length), d]));
  const gaps: { teamId: string; playerId: string; candidates: string[] }[] = [];
  for (const team of snapshot.documents.filter((d) => d.name.startsWith(PREFIX + BASE_TEAMS + '/'))) {
    const t = fields(team); const teamId = team.name.split('/').at(-1)!;
    for (const playerId of t.roster || []) {
      if (typeof playerId !== 'string' || byPath.has(BASE_PLAYERS + '/' + playerId)) continue;
      const labels = (t.capHolds || []).filter((h: any) => h.playerId === playerId).map((h: any) => nameKey(h.playerName)).filter(Boolean);
      const candidates = snapshot.documents.filter((d) => d.name.startsWith(PREFIX + BASE_PLAYERS + '/')).filter((d) => {
        const b = fields(d); return labels.includes(nameKey(b.displayName)) && b.teamCode === teamId;
      }).map((d) => d.name.split('/').at(-1)!);
      gaps.push({ teamId, playerId, candidates });
    }
  }
  return { baselineSha256: report.sha256, capturedAt: report.capturedAt, gaps };
}
export function assessRosterGap(teamDoc: SourceDocument | null, missing: string, candidateDoc: SourceDocument | null, scoutingDoc: SourceDocument | null) {
  if (!teamDoc) return { supported: false, reason: 'Team source is unavailable' };
  const t = fields(teamDoc); const candidate = candidateDoc ? fields(candidateDoc) : null; const scouting = scoutingDoc ? fields(scoutingDoc) : null;
  const teamId = teamDoc.name.split('/').at(-1)!; const canonicalId = candidateDoc?.name.split('/').at(-1);
  if (!t.roster?.includes(missing)) return { supported: false, reason: 'Reference no longer appears in current team data' };
  const label = (t.capHolds || []).filter((h: any) => h.playerId === missing).map((h: any) => h.playerName);
  if (!candidate || !scouting || !canonicalId || candidate.playerId !== canonicalId || scouting.bio?.playerId !== canonicalId ||
      scoutingDoc?.name !== PREFIX + PLAYERS_COLLECTION + '/' + canonicalId || candidate.teamCode !== teamId ||
      !nameKey(candidate.displayName) || !label.some((n: unknown) => nameKey(n) === nameKey(candidate.displayName)) ||
      nameKey(candidate.displayName) !== nameKey(scouting.bio?.displayName) || !scouting.bio?.nbaId ||
      !dob(candidate.bio?.birthdate) || dob(candidate.bio.birthdate) !== dob(scouting.bio?.dob) ||
      t.roster.includes(canonicalId)) return { supported: false, reason: 'Identity, birthday, team or uniqueness evidence is incomplete' };
  return { supported: true, canonicalId, reason: 'Team hold name, both player names, birth dates, team and canonical IDs agree',
    evidence: { teamPath: teamDoc.name.slice(PREFIX.length), basePath: candidateDoc!.name.slice(PREFIX.length), scoutingPath: scoutingDoc!.name.slice(PREFIX.length),
      nbaId: scouting.bio.nbaId, birthDate: dob(scouting.bio.dob), updateTimes: [teamDoc.updateTime, candidateDoc!.updateTime, scoutingDoc!.updateTime] } };
}
export async function auditRosterSources(snapshot: Snapshot, get: Getter, directory: string) {
  const inventory = rosterGaps(snapshot); const readTime = new Date().toISOString();
  const cache = new Map<string, Promise<SourceDocument | null>>();
  const read = (relative: string) => {
    if (!cache.has(relative)) cache.set(relative, (async () => {
      const response = await get('https://firestore.googleapis.com/v1/' + PREFIX + relative + '?readTime=' + encodeURIComponent(readTime));
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Roster evidence read failed: HTTP ' + response.status);
      const doc = await response.json() as SourceDocument;
      if (doc.name !== PREFIX + relative || !doc.updateTime) throw new Error('Unexpected roster evidence identity');
      return doc;
    })());
    return cache.get(relative)!;
  };
  const rows = [];
  for (const gap of inventory.gaps) {
    const [team, existing, scouting] = await Promise.all([read(BASE_TEAMS + '/' + gap.teamId), read(BASE_PLAYERS + '/' + gap.playerId), read(PLAYERS_COLLECTION + '/' + gap.playerId)]);
    const proposals = [];
    for (const candidate of gap.candidates) {
      const [base, player] = await Promise.all([read(BASE_PLAYERS + '/' + candidate), read(PLAYERS_COLLECTION + '/' + candidate)]);
      const finding = assessRosterGap(team, gap.playerId, base, player);
      if (finding.supported && team) {
        const before = team.fields || {}; const after = JSON.parse(JSON.stringify(before));
        after.roster.arrayValue.values = after.roster.arrayValue.values.map((v: any) => v.stringValue === gap.playerId ? { stringValue: finding.canonicalId } : v);
        for (const hold of after.capHolds?.arrayValue?.values || []) {
          if (hold.mapValue?.fields?.playerId?.stringValue === gap.playerId) hold.mapValue.fields.playerId = { stringValue: finding.canonicalId };
        }
        proposals.push({ ...finding, path: BASE_TEAMS + '/' + gap.teamId, beforeFields: before, afterFields: after,
          precondition: { updateTime: team.updateTime }, qualification: 'database-identity-evidence-only',
          allowedChangedFields: ['roster', 'capHolds[].playerId'], requiredGates: ['Independent evidence review', 'Change-specific production approval', 'Fresh exact preconditions'],
          productionWriteAuthorized: false, preservedOtherFields: true });
      }
    }
    rows.push({ ...gap, basePlayerPresentNow: !!existing, scoutingPlayerPresentNow: !!scouting,
      proposedRepair: !existing && !scouting && proposals.length === 1 ? proposals[0] : null,
      status: existing ? 'present-upstream' : !scouting && proposals.length === 1 ? 'supported-reference-proposal' : 'missing-evidence' });
  }
  const result = { version: 1, baselineSha256: inventory.baselineSha256, baselineCapturedAt: inventory.capturedAt, evidenceReadTime: readTime,
    checkedAt: new Date().toISOString(), rows, productionWriteAuthorized: false,
    limitation: 'Reference proposals preserve source money and draft fields; not current NBA roster qualification or permission to publish. Missing players are not invented.' };
  await privateJson(path.join(directory, 'roster-audit.json'), result);
  const evidence = (await Promise.all([...cache.values()])).filter(Boolean);
  await privateJson(path.join(directory, 'source-evidence.json'), { readTime, documents: evidence, sha256: digest(evidence) });
  return { references: rows.length, supportedProposals: rows.filter((r) => r.status === 'supported-reference-proposal').length,
    presentUpstream: rows.filter((r) => r.status === 'present-upstream').length, missingEvidence: rows.filter((r) => r.status === 'missing-evidence').length,
    evidenceReadTime: readTime, directory, productionWriteAuthorized: false };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = (name: string) => process.argv.find((arg) => arg.startsWith('--' + name + '='))?.slice(name.length + 3);
  try {
    const root = path.resolve('.scoutzero-dev'); const config = path.join(root, 'reader/public-config.json');
    const directory = path.join(root, 'pipeline/roster-audits', new Date().toISOString().replace(/[:.]/g, '-'));
    const destination = await privateRosterAuditDirectory(root, option('output') || directory);
    const get = process.argv.includes('--google') ? await googleReader() : await firebaseReader(config);
    const snapshot = await loadSnapshot(path.join(root, 'core'));
    console.log(JSON.stringify(await auditRosterSources(snapshot, get, destination)));
  } catch (error) { console.error(error instanceof SyntaxError ? 'Invalid private roster evidence JSON' : error instanceof Error ? error.message : 'Roster audit failed'); process.exitCode = 1; }
}
