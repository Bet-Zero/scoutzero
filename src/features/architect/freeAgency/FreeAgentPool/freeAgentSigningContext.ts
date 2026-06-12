import type { FreeAgentSurfaceEntry } from './types';

type UnknownRecord = Record<string, unknown>;

export type FreeAgentSigningLane =
  | 'bird-rights'
  | 'restricted-rights'
  | 'option-decision'
  | 'cap-space-exception'
  | 'rights-renounced';

export type FreeAgentSigningContext = {
  rightsLabel: string;
  laneLabel: string;
  lane: FreeAgentSigningLane;
  capHoldLabel: string | null;
};

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null;

const toFiniteNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const numericValue = Number(value.replace(/[$,]/g, '').trim());
  return Number.isFinite(numericValue) ? numericValue : null;
};

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const readBirdRightsRecord = (source: unknown): UnknownRecord | null => {
  if (!isRecord(source)) return null;
  const contract = isRecord(source.contract) ? source.contract : null;
  const contractBirdRights = contract?.birdRights;
  const rootBirdRights = source.birdRights;

  if (isRecord(contractBirdRights)) return contractBirdRights;
  if (isRecord(rootBirdRights)) return rootBirdRights;
  return null;
};

const readRightsLabel = (entry: FreeAgentSurfaceEntry) => {
  const freeAgentBirdRights = readBirdRightsRecord(entry.freeAgent);
  const surfaceBirdRights = readBirdRightsRecord(entry.surfacePlayer);
  const rawRights = firstString(
    entry.freeAgent.birdRights,
    freeAgentBirdRights?.status,
    freeAgentBirdRights?.type,
    entry.surfacePlayer.birdRights,
    surfaceBirdRights?.status,
    surfaceBirdRights?.type
  );

  return rawRights || 'None';
};

const readFreeAgentType = (entry: FreeAgentSurfaceEntry) =>
  firstString(
    entry.freeAgent.freeAgentType,
    entry.freeAgent.fa_type,
    entry.surfacePlayer.freeAgentType,
    entry.surfacePlayer.fa_type,
    entry.surfacePlayer.bio?.display?.freeAgentType
  ) || 'UFA';

const readCapHold = (entry: FreeAgentSurfaceEntry) => {
  const freeAgentBirdRights = readBirdRightsRecord(entry.freeAgent);
  const surfaceBirdRights = readBirdRightsRecord(entry.surfacePlayer);
  const candidates = [
    entry.freeAgent.capHold,
    entry.freeAgent.capHoldAmount,
    entry.freeAgent.cap_hold,
    freeAgentBirdRights?.capHold,
    freeAgentBirdRights?.capHoldAmount,
    entry.surfacePlayer.capHold,
    entry.surfacePlayer.capHoldAmount,
    entry.surfacePlayer.cap_hold,
    surfaceBirdRights?.capHold,
    surfaceBirdRights?.capHoldAmount,
  ];

  for (const candidate of candidates) {
    const amount = toFiniteNumber(candidate);
    if (amount != null && amount > 0) return amount;
  }
  return null;
};

const formatCompactCurrency = (amount: number) => {
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const rounded = millions >= 10 ? millions.toFixed(1) : millions.toFixed(2);
    return `$${rounded.replace(/\.0$/, '')}M`;
  }
  if (amount >= 1_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return `$${amount.toLocaleString()}`;
};

export const getFreeAgentSigningContext = (
  entry: FreeAgentSurfaceEntry
): FreeAgentSigningContext => {
  const rightsLabel = readRightsLabel(entry);
  const rightsKey = rightsLabel.toLowerCase();
  const freeAgentType = readFreeAgentType(entry).toUpperCase();
  const capHold = readCapHold(entry);

  if (freeAgentType === 'PO' || freeAgentType === 'TO') {
    return {
      rightsLabel,
      lane: 'option-decision',
      laneLabel: 'Option decision',
      capHoldLabel: capHold ? `Hold ${formatCompactCurrency(capHold)}` : null,
    };
  }

  if (rightsKey.includes('renounced')) {
    return {
      rightsLabel,
      lane: 'rights-renounced',
      laneLabel: 'Rights renounced',
      capHoldLabel: capHold ? `Hold ${formatCompactCurrency(capHold)}` : null,
    };
  }

  if (freeAgentType === 'RFA' || rightsKey.includes('restricted')) {
    return {
      rightsLabel,
      lane: 'restricted-rights',
      laneLabel: 'Restricted rights',
      capHoldLabel: capHold ? `Hold ${formatCompactCurrency(capHold)}` : null,
    };
  }

  if (rightsKey !== 'none' && rightsKey !== 'no rights') {
    return {
      rightsLabel,
      lane: 'bird-rights',
      laneLabel: 'Bird rights path',
      capHoldLabel: capHold ? `Hold ${formatCompactCurrency(capHold)}` : null,
    };
  }

  return {
    rightsLabel: 'None',
    lane: 'cap-space-exception',
    laneLabel: 'Cap space / exception',
    capHoldLabel: capHold ? `Hold ${formatCompactCurrency(capHold)}` : null,
  };
};
