/**
 * FILE: src/features/architect/freeAgency/freeAgentPoolPersistence.ts
 * PURPOSE: Persist managed Free Agency pools under active world/team/season scope.
 * OWNERSHIP: Feature: architect/freeAgency
 */
import { deleteDoc, getDoc, setDoc } from 'firebase/firestore';
import { worldTeamFreeAgentPoolRef } from '@/features/architect/utils/architectFirestorePaths';

const SNAPSHOT_SCHEMA_VERSION = 1;
const SNAPSHOT_SOURCE = 'architect-free-agent-pool-management';

export type ManagedFreeAgentPoolSnapshot = {
  schemaVersion: typeof SNAPSHOT_SCHEMA_VERSION;
  source: typeof SNAPSHOT_SOURCE;
  worldId: string;
  teamCode: string;
  seasonKey: string;
  selectionKeys: string[];
  updatedAt: string;
};

type ManagedFreeAgentPoolScope = {
  worldId: string;
  teamCode: string;
  seasonKey: string;
};

type SaveManagedFreeAgentPoolInput = ManagedFreeAgentPoolScope & {
  selectionKeys: string[];
};

const normalizeSelectionKeys = (selectionKeys: string[]) =>
  Array.from(
    new Set(
      selectionKeys
        .map((selectionKey) => String(selectionKey || '').trim())
        .filter(Boolean)
    )
  );

const buildManagedFreeAgentPoolSnapshot = ({
  worldId,
  teamCode,
  seasonKey,
  selectionKeys,
}: SaveManagedFreeAgentPoolInput): ManagedFreeAgentPoolSnapshot => ({
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  source: SNAPSHOT_SOURCE,
  worldId,
  teamCode,
  seasonKey,
  selectionKeys: normalizeSelectionKeys(selectionKeys),
  updatedAt: new Date().toISOString(),
});

const readManagedFreeAgentPoolSnapshot = (
  raw: unknown,
  fallbackScope: ManagedFreeAgentPoolScope
): ManagedFreeAgentPoolSnapshot | null => {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Partial<ManagedFreeAgentPoolSnapshot>;
  const selectionKeys = Array.isArray(record.selectionKeys)
    ? normalizeSelectionKeys(record.selectionKeys)
    : [];

  return {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    source: SNAPSHOT_SOURCE,
    worldId:
      typeof record.worldId === 'string' && record.worldId.trim()
        ? record.worldId
        : fallbackScope.worldId,
    teamCode:
      typeof record.teamCode === 'string' && record.teamCode.trim()
        ? record.teamCode
        : fallbackScope.teamCode,
    seasonKey:
      typeof record.seasonKey === 'string' && record.seasonKey.trim()
        ? record.seasonKey
        : fallbackScope.seasonKey,
    selectionKeys,
    updatedAt:
      typeof record.updatedAt === 'string' && record.updatedAt.trim()
        ? record.updatedAt
        : '',
  };
};

export const saveWorldTeamFreeAgentPool = async (
  input: SaveManagedFreeAgentPoolInput
) => {
  const snapshot = buildManagedFreeAgentPoolSnapshot(input);
  await setDoc(
    worldTeamFreeAgentPoolRef(
      snapshot.worldId,
      snapshot.teamCode,
      snapshot.seasonKey
    ),
    snapshot
  );
  return snapshot;
};

export const loadWorldTeamFreeAgentPool = async (
  scope: ManagedFreeAgentPoolScope
) => {
  const snap = await getDoc(
    worldTeamFreeAgentPoolRef(scope.worldId, scope.teamCode, scope.seasonKey)
  );
  if (!snap.exists()) return null;
  return readManagedFreeAgentPoolSnapshot(snap.data(), scope);
};

export const resetWorldTeamFreeAgentPool = async (
  scope: ManagedFreeAgentPoolScope
) => {
  await deleteDoc(
    worldTeamFreeAgentPoolRef(scope.worldId, scope.teamCode, scope.seasonKey)
  );
};
