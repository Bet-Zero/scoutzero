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

/** Completion receipt and each coherent group are committed together. No league-wide atomic claim. */
export async function publishMaintenance(plan: Publication, approval: PublicationApproval, store: PublicationStore) {
  const id = validatePublication(plan, approval, store);
  let completed = 0; let resumed = 0;
  for (const group of plan.groups) {
    const receiptPath = ledgerPath(id, group.id);
    const receipt = await store.read(receiptPath);
    if (receipt) {
      if (receipt.fields?.planSha256 && hash(receipt.fields.planSha256) === hash(textField(id)) &&
          hash(receipt.fields.state) === hash(textField('applied')) && hash(receipt.fields.groupSha256) === hash(textField(hash(group)))) {
        for (const entry of group.entries) {
          const live = await store.read(entry.path);
          if (!live || firestoreFieldHash(live.fields || {}) !== firestoreFieldHash(entry.afterFields) || live.updateTime !== receipt.updateTime) throw new Error('Completed group changed; publication is no longer verified');
        }
        completed++; resumed++; continue;
      }
      throw new Error('Conflicting or recovered completion record');
    }
    // Check the whole group before any write; Firestore rechecks at atomic commit.
    for (const entry of group.entries) {
      const live = await store.read(entry.path);
      if (firestoreFieldHash(live ? live.fields || {} : null) !== firestoreFieldHash(entry.beforeFields) ||
          (live ? !('updateTime' in entry.precondition) || entry.precondition.updateTime !== live.updateTime : entry.beforeFields !== null)) throw new Error('Live before-image/precondition changed; group withheld');
    }
    await store.commit([
      ...group.entries.map(entry => ({ update: { name: fullName(plan, entry.path), fields: entry.afterFields }, currentDocument: entry.precondition })),
      { update: { name: fullName(plan, receiptPath), fields: { planSha256: textField(id), state: textField('applied'), groupSha256: textField(hash(group)) } }, currentDocument: { exists: false } },
    ]);
    const proof = await store.read(receiptPath);
    if (!proof) throw new Error('Completion record missing; inspect before retry');
    for (const entry of group.entries) {
      const live = await store.read(entry.path);
      if (!live || firestoreFieldHash(live.fields || {}) !== firestoreFieldHash(entry.afterFields) || live.updateTime !== proof.updateTime) throw new Error('Readback failed; incomplete publication');
    }
    completed++;
  }
  return { planSha256: id, completedGroups: completed, resumedGroups: resumed, complete: completed === plan.groups.length };
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
