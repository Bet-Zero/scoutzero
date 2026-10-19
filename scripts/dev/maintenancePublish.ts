/**
 * FILE: scripts/dev/maintenancePublish.ts
 * PURPOSE: Shared NBA maintenance mechanics with governed source and publication decisions.
 * OWNERSHIP: Operations tooling.
 * HISTORY: 2026-10-18 — BZE-324 Gate A implementation.
 * LINKS: docs/operations/NBA_MAINTENANCE.md; docs/operations/DRAFT_UPDATE_PROCESS.md
 */
/** Exact reviewed conditional groups, shared by local rehearsal and approved publication. */
import { firestoreFieldHash } from './firestoreValue.js';
import { maintenanceContext } from './maintenanceContext.js';
import { digest, SOURCE_PROJECT, DEMO_PROJECT } from './cloudData.js';
import { canonical } from './cloudPipeline.js';
import { assertOrdinaryDocumentPath } from './cloudPublishCheck.js';

type Fields = Record<string, unknown>;
type Precondition = { updateTime: string } | { exists: false };
export type MaintenanceEntry = { path: string; beforeFields: Fields | null; afterFields: Fields; precondition: Precondition };
export type Publication = {
  version: 1; project: typeof SOURCE_PROJECT | typeof DEMO_PROJECT; database: '(default)';
  inputSha256: string; season: string; asOf: string;
  groups: { id: string; entries: MaintenanceEntry[] }[];
  coverage?: { expected: number; processed: number; unchanged: number; withheld: string[]; failed: number; missing: number };
  withheldReasons?: Record<string, string>;
};
export type PublicationApproval = {
  planSha256: string; project: string; database: string; expiresAt: string;
  qualification: { verdict: 'ACCEPT'; reviewer: string; receipt: string; inputSha256: string };
  review: { verdict: 'ACCEPT'; reviewer: string; receipt: string; planSha256: string };
  owner: { decision: 'APPROVE'; actor: string; receipt: string; planSha256: string };
};
type Document = { fields?: Fields; updateTime: string };
export type PublicationStore = {
  project: Publication['project']; database: '(default)';
  read(path: string): Promise<Document | null>;
  readMany?(paths: string[]): Promise<Map<string, Document | null>>;
  commit(writes: unknown[]): Promise<void>;
};
const hash = (value: unknown) => digest(canonical(value));
const fullName = (plan: Publication, path: string) => `projects/${plan.project}/databases/${plan.database}/documents/${path}`;
const ledgerPath = (id: string, group: string) => `maintenance_publications/${id}/groups/${group}`;
function textField(value: string) { return { stringValue: value }; }

export function validatePublication(plan: Publication, approval: PublicationApproval, store: PublicationStore) {
  maintenanceContext(plan.season, plan.asOf);
  const id = hash(plan);
  if (plan.version !== 1 || ![SOURCE_PROJECT, DEMO_PROJECT].includes(plan.project) || plan.database !== '(default)' ||
      store.project !== plan.project || store.database !== plan.database || !/^[a-f0-9]{64}$/.test(plan.inputSha256) ||
      !Array.isArray(plan.groups) || !plan.groups.length) throw new Error('Invalid publication target or inputs');
  if (approval.planSha256 !== id || approval.project !== plan.project || approval.database !== plan.database ||
      !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= Date.now() ||
      approval.qualification?.verdict !== 'ACCEPT' || approval.qualification.inputSha256 !== plan.inputSha256 ||
      approval.review?.verdict !== 'ACCEPT' || approval.review.planSha256 !== id ||
      approval.owner?.decision !== 'APPROVE' || approval.owner.planSha256 !== id ||
      !approval.qualification.reviewer || !approval.review.reviewer || !approval.owner.actor ||
      ![approval.qualification.receipt, approval.review.receipt, approval.owner.receipt].every(v => /^https:\/\/(linear.app|github.com)\//.test(v))) {
    throw new Error('Exact independent qualification, reviewed plan and unexpired change-specific owner approval required');
  }
  if (plan.coverage && (plan.coverage.withheld.length || plan.coverage.failed || plan.coverage.missing || plan.coverage.processed !== plan.groups.length || plan.coverage.expected !== plan.coverage.processed + plan.coverage.unchanged)) throw new Error('Incomplete required publication coverage; withheld groups cannot be silently dropped');
  const seen = new Set<string>(); const groups = new Set<string>();
  for (const group of plan.groups) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(group.id) || groups.has(group.id) || !group.entries.length || group.entries.length > 450 ||
        Buffer.byteLength(JSON.stringify(group)) > 7_000_000) throw new Error('Invalid bounded transaction group');
    groups.add(group.id);
    for (const entry of group.entries) {
      if (!/^architect_baseTeams\/[A-Z]{3}$/.test(entry.path)) assertOrdinaryDocumentPath(entry.path);
      if (entry.path.startsWith('architect_baseTeams/')) {
        if (!entry.beforeFields) throw new Error('Ordinary maintenance requires an existing team');
        for (const key of new Set([...Object.keys(entry.beforeFields), ...Object.keys(entry.afterFields)])) {
          if (/draft|pick|entitlement/i.test(key) && firestoreFieldHash(entry.beforeFields[key]) !== firestoreFieldHash(entry.afterFields[key])) throw new Error('Ordinary maintenance cannot change draft associations');
        }
      }
      if (seen.has(entry.path) || !entry.afterFields || firestoreFieldHash(entry.beforeFields) === firestoreFieldHash(entry.afterFields) ||
          (entry.beforeFields === null ? !('exists' in entry.precondition && entry.precondition.exists === false) :
            !('updateTime' in entry.precondition && Number.isFinite(Date.parse(entry.precondition.updateTime))))) throw new Error('Invalid entry or live precondition');
      seen.add(entry.path);
    }
  }
  return id;
}

/** Bulk reads retain exact per-document checks; no collection listing is required. */
async function readDocuments(store: PublicationStore, paths: string[]) {
  if (store.readMany) return store.readMany(paths);
  const result = new Map<string, Document | null>();
  for (const path of paths) result.set(path, await store.read(path));
  return result;
}
function appliedReceipt(receipt: Document, id: string, group: Publication['groups'][number]) {
  if (hash(receipt.fields?.planSha256) !== hash(textField(id)) ||
      hash(receipt.fields?.state) !== hash(textField('applied')) ||
      hash(receipt.fields?.groupSha256) !== hash(textField(hash(group)))) throw new Error('Conflicting or recovered completion record');
}
function verifyGroup(group: Publication['groups'][number], receipt: Document, documents: Map<string, Document | null>) {
  for (const entry of group.entries) {
    const live = documents.get(entry.path);
    if (!live || firestoreFieldHash(live.fields || {}) !== firestoreFieldHash(entry.afterFields) || live.updateTime !== receipt.updateTime) {
      throw new Error('Completed group changed; publication is no longer verified');
    }
  }
}

/** Partial runs skip completed data, never claim completion until a whole-plan readback. */
export async function publishMaintenance(plan: Publication, approval: PublicationApproval, store: PublicationStore,
  options: { deadline?: number; maxGroups?: number; now?: () => number } = {}) {
  const id = validatePublication(plan, approval, store);
  const now = options.now || Date.now;
  if (options.deadline !== undefined && !Number.isFinite(options.deadline) ||
      options.maxGroups !== undefined && (!Number.isSafeInteger(options.maxGroups) || options.maxGroups < 1)) throw new Error('Invalid publication execution budget');
  const expired = () => options.deadline !== undefined && now() >= options.deadline;
  let applied = 0; let resumed = 0;
  const partial = () => ({ planSha256: id, completedGroups: applied + resumed, resumedGroups: resumed,
    appliedGroups: applied, totalGroups: plan.groups.length, state: 'partial' as const, complete: false });
  if (expired()) return partial();
  const receipts = await readDocuments(store, plan.groups.map(g => ledgerPath(id, g.id)));
  // Authenticate the ledger only. Re-reading completed data on every partial run starves later groups.
  for (const group of plan.groups) {
    const receipt = receipts.get(ledgerPath(id, group.id));
    if (receipt) { appliedReceipt(receipt, id, group); resumed++; }
  }
  for (const group of plan.groups) {
    const receiptPath = ledgerPath(id, group.id);
    if (receipts.get(receiptPath)) continue;
    if (expired() || applied >= (options.maxGroups ?? Infinity)) return partial();
    // Renew approval expiry checks before each new atomic group, including long local rehearsals.
    if (Date.parse(approval.expiresAt) <= Date.now()) throw new Error('Publication approval expired');
    const before = await readDocuments(store, group.entries.map(e => e.path));
    for (const entry of group.entries) {
      const live = before.get(entry.path);
      if (firestoreFieldHash(live ? live.fields || {} : null) !== firestoreFieldHash(entry.beforeFields) ||
          (live ? !('updateTime' in entry.precondition) || entry.precondition.updateTime !== live.updateTime : entry.beforeFields !== null)) throw new Error('Live before-image/precondition changed; group withheld');
    }
    if (expired()) return partial();
    await store.commit([
      ...group.entries.map(entry => ({ update: { name: fullName(plan, entry.path), fields: entry.afterFields }, currentDocument: entry.precondition })),
      { update: { name: fullName(plan, receiptPath), fields: { planSha256: textField(id), state: textField('applied'), groupSha256: textField(hash(group)) } }, currentDocument: { exists: false } },
    ]);
    const proof = await readDocuments(store, [receiptPath, ...group.entries.map(e => e.path)]);
    const receipt = proof.get(receiptPath);
    if (!receipt) throw new Error('Completion record missing; inspect before retry');
    appliedReceipt(receipt, id, group); verifyGroup(group, receipt, proof); applied++;
  }
  if (expired()) return partial();
  // One coherent bulk snapshot includes every receipt and after-image, including all resumed groups.
  const final = await readDocuments(store, plan.groups.flatMap(g => [ledgerPath(id, g.id), ...g.entries.map(e => e.path)]));
  for (const group of plan.groups) {
    const receipt = final.get(ledgerPath(id, group.id));
    if (!receipt) throw new Error('Completion record missing; inspect before retry');
    appliedReceipt(receipt, id, group); verifyGroup(group, receipt, final);
  }
  if (expired()) return partial();
  if (Date.parse(approval.expiresAt) <= Date.now()) throw new Error('Publication approval expired');
  return { planSha256: id, completedGroups: applied + resumed, resumedGroups: resumed,
    appliedGroups: applied, totalGroups: plan.groups.length, state: 'complete' as const, complete: true };
}

/** Rehearsal recovery only. A production reversal requires its own newly reviewed plan. */
export async function restoreMaintenanceRehearsal(plan: Publication, store: PublicationStore) {
  if (plan.project !== DEMO_PROJECT || store.project !== DEMO_PROJECT) throw new Error('Automatic restoration is emulator-only');
  const id = hash(plan);
  for (const group of [...plan.groups].reverse()) {
    const receiptPath = ledgerPath(id, group.id); const receipt = await store.read(receiptPath);
    if (!receipt || hash(receipt.fields?.state) !== hash(textField('applied'))) throw new Error('Missing applied rehearsal receipt');
    for (const entry of group.entries) {
      const live = await store.read(entry.path);
      if (!live || live.updateTime !== receipt.updateTime || firestoreFieldHash(live.fields || {}) !== firestoreFieldHash(entry.afterFields)) throw new Error('Concurrent edit prevents restoration');
    }
    await store.commit([
      ...group.entries.map(entry => entry.beforeFields === null ? { delete: fullName(plan, entry.path), currentDocument: { updateTime: receipt.updateTime } } :
        { update: { name: fullName(plan, entry.path), fields: entry.beforeFields }, currentDocument: { updateTime: receipt.updateTime } }),
      { update: { name: fullName(plan, receiptPath), fields: { ...receipt.fields, state: textField('restored') } }, currentDocument: { updateTime: receipt.updateTime } },
    ]);
    for (const entry of group.entries) {
      const live = await store.read(entry.path);
      if (firestoreFieldHash(live ? live.fields || {} : null) !== firestoreFieldHash(entry.beforeFields)) throw new Error('Restoration readback failed');
    }
  }
}
