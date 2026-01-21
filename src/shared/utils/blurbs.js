/**
 * FILE: src/shared/utils/blurbs.js
 * PURPOSE: Normalize evaluation blurbs across flat and nested storage formats.
 * OWNERSHIP: Feature: shared/utils (player evaluations)
 *
 * HISTORY:
 *  - 2026-01-21: Created by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

const EMPTY_BLRUBS = {
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: '',
  twoWayMeter: '',
  overall: '',
};

const isPlainObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);

const coerceText = (value) => {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
};

export const DEFAULT_BLRUBS = { ...EMPTY_BLRUBS };

export const normalizeBlurbs = (raw) => {
  if (!isPlainObject(raw)) {
    return { ...EMPTY_BLRUBS, traits: {}, roles: {}, subroles: {} };
  }

  const hasNested =
    isPlainObject(raw.traits) ||
    isPlainObject(raw.roles) ||
    isPlainObject(raw.subroles) ||
    isPlainObject(raw.subRoles) ||
    Object.prototype.hasOwnProperty.call(raw, 'shootingProfile') ||
    Object.prototype.hasOwnProperty.call(raw, 'twoWayMeter') ||
    Object.prototype.hasOwnProperty.call(raw, 'overall');

  if (hasNested) {
    const subroles = isPlainObject(raw.subroles)
      ? raw.subroles
      : isPlainObject(raw.subRoles)
        ? raw.subRoles
        : {};

    return {
      traits: isPlainObject(raw.traits) ? { ...raw.traits } : {},
      roles: isPlainObject(raw.roles) ? { ...raw.roles } : {},
      subroles: { ...subroles },
      shootingProfile:
        typeof raw.shootingProfile === 'string' ? raw.shootingProfile : '',
      twoWayMeter: typeof raw.twoWayMeter === 'string' ? raw.twoWayMeter : '',
      overall: typeof raw.overall === 'string' ? raw.overall : '',
    };
  }

  const normalized = {
    ...EMPTY_BLRUBS,
    traits: {},
    roles: {},
    subroles: {},
  };

  Object.entries(raw).forEach(([key, value]) => {
    const text = coerceText(value);
    if (key.startsWith('trait_')) normalized.traits[key.slice(6)] = text;
    else if (key.startsWith('role_')) normalized.roles[key.slice(5)] = text;
    else if (key.startsWith('subrole_'))
      normalized.subroles[key.slice(8)] = text;
    else if (key === 'shooting_profile') normalized.shootingProfile = text;
    else if (key === 'two_way_meter') normalized.twoWayMeter = text;
    else if (key === 'overall') normalized.overall = text;
  });

  return normalized;
};
