/** Assertions expose only fixed failure labels, never private original documents. */
import { createHash } from 'node:crypto';
import type { DocumentReference } from 'firebase-admin/firestore';
import { canonicalStringify } from '../../src/features/architect/utils/contractSource/deterministicDigest';

type RecordValue = Record<string, unknown>;
export type WorldInventory = Record<string, RecordValue>;
export type OriginalWorldExpectation = {
  worldId: string;
  identity: {
    createdBy: string;
    currentSeason: string;
    asOfDate: string;
    contractSourceRelease: {
      releaseId: string;
      releaseVersion: number;
      releaseDigest: string;
    };
    simulationFinancialBaseline: unknown;
    draftBaseline: unknown;
  };
  /** Full relative document membership and digests, retained before this run. Root is '.'. */
  documents: Record<string, string>;
};
const fail = (reason: string): never => {
  throw new Error(`Original-world preservation failed: ${reason}`);
};
const encode = (value: unknown) =>
  canonicalStringify(JSON.parse(JSON.stringify(value)));
export const inventoryDigests = (rows: WorldInventory) =>
  Object.fromEntries(
    Object.entries(rows)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, value]) => [
        path,
        createHash('sha256').update(encode(value)).digest('hex'),
      ])
  );

export async function readWorldInventory(
  root: DocumentReference
): Promise<WorldInventory> {
  const snapshot = await root.get();
  if (!snapshot.exists) fail('missing original root');
  const rows: WorldInventory = { '.': snapshot.data()! };
  async function descend(ref: DocumentReference) {
    for (const collection of await ref.listCollections()) {
      // listDocuments also includes missing intermediate documents with children.
      for (const child of await collection.listDocuments()) {
        const doc = await child.get();
        if (doc.exists)
          rows[child.path.slice(root.path.length + 1)] = doc.data()!;
        await descend(child);
      }
    }
  }
  await descend(root);
  return rows;
}

export function verifyOriginalWorld(
  expected: OriginalWorldExpectation,
  rows: WorldInventory,
  expectedTeamCount = 30
): void {
  const root = rows['.'];
  const identity = expected?.identity;
  const pin = identity?.contractSourceRelease;
  if (
    !identity ||
    !identity.createdBy ||
    !/^\d{4}-\d{2}$/.test(identity.currentSeason) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(identity.asOfDate) ||
    !pin?.releaseId ||
    !Number.isSafeInteger(pin.releaseVersion) ||
    pin.releaseVersion < 1 ||
    !/^sha256:[a-f0-9]{64}$/.test(pin.releaseDigest) ||
    !Object.hasOwn(identity, 'simulationFinancialBaseline') ||
    !Object.hasOwn(identity, 'draftBaseline')
  ) {
    fail('invalid expected identity');
  }
  if (!root) fail('missing original root');
  if (
    root.worldId !== expected.worldId ||
    encode({
      createdBy: root.createdBy,
      currentSeason: root.currentSeason,
      asOfDate: root.asOfDate,
      contractSourceRelease: root.contractSourceRelease,
      simulationFinancialBaseline: root.simulationFinancialBaseline ?? null,
      draftBaseline: root.draftBaseline ?? null,
    }) !== encode(identity)
  )
    fail('original identity mismatch');
  const teams = Object.entries(rows).filter(([path]) =>
    /^teams\/[^/]+$/.test(path)
  );
  const contracts = Object.entries(rows).filter(([path]) =>
    /^contractBaselines\/[^/]+$/.test(path)
  );
  if (
    teams.length !== expectedTeamCount ||
    teams.some(
      ([path, value]) =>
        value.teamCode !== path.split('/')[1] ||
        !Array.isArray(value.players) ||
        !value.players.length
    ) ||
    !contracts.length ||
    contracts.some(
      ([, value]) =>
        value.worldId !== expected.worldId ||
        !Array.isArray(value.ledgers) ||
        !value.ledgers.length
    )
  ) {
    fail('empty or incomplete original inventory');
  }
  if (
    identity.draftBaseline !== null &&
    (!rows['draftBaselines/root'] ||
      !Object.keys(rows).some((path) => /^entitlements\/[^/]+$/.test(path)))
  ) {
    fail('missing original draft inventory');
  }
  if (
    !expected.documents?.['.'] ||
    Object.values(expected.documents).some(
      (hash) => !/^[a-f0-9]{64}$/.test(hash)
    ) ||
    encode(inventoryDigests(rows)) !== encode(expected.documents)
  ) {
    fail('original membership or content changed');
  }
}
