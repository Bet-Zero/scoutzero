/**
 * FILE: src/features/architect/GMDashboard/hooks/useArchitectState.helpers.ts
 * PURPOSE: Season helpers, storage key utilities, and date derivation for useArchitectState.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * Wave 11 Step 3: Extracted from useArchitectState.ts (season helpers section).
 */

import { getWorldMetadata } from '@/features/architect/utils/worldManager';
import type { CapProjectionMap } from './useArchitectState.types';

// ==== Season helpers ====
export const LOCAL_SEASON_KEY = 'hz.currentSeasonEndYear';
export const ACTIVE_WORLD_STORAGE_KEY_PREFIX = 'architect.activeWorldId.';

export const getActiveWorldStorageKey = (userId: string) =>
  `${ACTIVE_WORLD_STORAGE_KEY_PREFIX}${userId}`;

export const readPersistedActiveWorldId = (userId: string) =>
  localStorage.getItem(getActiveWorldStorageKey(userId));

export const writePersistedActiveWorldId = (
  userId: string,
  worldId: string | null
) => {
  const storageKey = getActiveWorldStorageKey(userId);

  if (worldId) {
    localStorage.setItem(storageKey, worldId);
    return;
  }

  localStorage.removeItem(storageKey);
};

export const getIsoDateString = (date: Date = new Date()) =>
  date.toISOString().slice(0, 10);

export const ISO_DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const addDaysToIsoDate = (isoDate: string, dayCount: number): string => {
  if (!ISO_DATE_ONLY_PATTERN.test(isoDate)) {
    throw new Error('World date must use YYYY-MM-DD format');
  }

  const [year, month, day] = isoDate
    .split('-')
    .map((value) => parseInt(value, 10));
  const nextDate = new Date(Date.UTC(year, month - 1, day));
  nextDate.setUTCDate(nextDate.getUTCDate() + dayCount);
  return getIsoDateString(nextDate);
};

export const isUsableActiveWorldMetadata = (
  metadata: Record<string, unknown> | null | undefined,
  userId: string
) =>
  Boolean(metadata) &&
  metadata?.isArchived !== true &&
  !(
    typeof metadata?.createdBy === 'string' && metadata.createdBy !== userId
  );

export const resolveUsableActiveWorldId = async (
  candidateWorldId: string | null | undefined,
  userId: string
): Promise<string | null> => {
  if (!candidateWorldId) {
    return null;
  }

  try {
    const metadata = (await getWorldMetadata(candidateWorldId)) as Record<
      string,
      unknown
    >;

    return isUsableActiveWorldMetadata(metadata, userId)
      ? candidateWorldId
      : null;
  } catch {
    return null;
  }
};

export const getDefaultSeasonEndYear = (date: Date = new Date()): number => {
  // NBA season flips July 1 → 2024-25 ends in 2025, 2025-26 ends in 2026
  const y = date.getFullYear();
  const month = date.getMonth();

  // General case for future years
  return month >= 6 ? y + 1 : y;
};

export const seasonEndYearsFromCaps = (
  caps: CapProjectionMap | null | undefined
): number[] => {
  const keys = Object.keys(caps || {});
  const years = keys
    .map((k) => {
      if (/^\d{4}-\d{2}$/.test(k)) {
        const tail = parseInt(k.split('-')[1], 10);
        return 2000 + tail; // "2024-25" -> 2025
      }
      const num = parseInt(k, 10);
      return Number.isFinite(num) ? num : null; // allow "2025"
    })
    .filter((y): y is number => y !== null);
  // De-dup and sort
  return Array.from(new Set(years)).sort((a, b) => a - b);
};

/**
 * Find the closest year in availableYears to the target year.
 * Returns the target if availableYears is empty, or the closest match by absolute difference.
 */
export const findClosestYear = (target: number, availableYears: number[]): number => {
  if (!availableYears || availableYears.length === 0) return target;
  if (availableYears.includes(target)) return target;

  // Find the year with the smallest absolute difference
  let closest = availableYears[0];
  let minDiff = Math.abs(target - closest);

  for (const year of availableYears) {
    const diff = Math.abs(target - year);
    if (diff < minDiff) {
      minDiff = diff;
      closest = year;
    }
  }
  return closest;
};

export const normalizeLookupKey = (name: string | null | undefined): string => {
  if (!name) return '';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
};
