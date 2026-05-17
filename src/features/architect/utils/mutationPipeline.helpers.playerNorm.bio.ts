/**
 * Wave 20 Step 1: Bio normalizer functions extracted from
 * mutationPipeline.helpers.playerNorm.ts (lines 74–287).
 */

import {
  asLooseRecord,
  normalizeStringArray,
  toOptionalBoolean,
  toOptionalIdString,
  toOptionalNumber,
  toOptionalNumberish,
  toOptionalTrimmedString,
} from './mutationPipeline.helpers';
import type {
  ArchitectMutationBirdRights,
  ArchitectMutationPlayerRecord,
  CurrentStatePlayerBio,
  CurrentStatePlayerBioDisplay,
  CurrentStatePlayerBioDraft,
  MutationPlayerBioLike,
} from './mutationPipeline';

export function normalizeCurrentStatePlayerBioDisplay(
  value: unknown
): CurrentStatePlayerBioDisplay | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBioDisplay = {};
  const freeAgentType = toOptionalTrimmedString(record.freeAgentType);
  const freeAgentYear = toOptionalNumberish(record.freeAgentYear);
  const team = toOptionalTrimmedString(record.team);
  const teamId = toOptionalTrimmedString(record.teamId);
  const yearsPro = toOptionalNumberish(record.yearsPro);

  if (freeAgentType !== undefined) {
    normalized.freeAgentType = freeAgentType;
  }
  if (freeAgentYear !== undefined) {
    normalized.freeAgentYear = freeAgentYear;
  }
  if (team !== undefined) {
    normalized.team = team;
  }
  if (teamId !== undefined) {
    normalized.teamId = teamId;
  }
  if (yearsPro !== undefined) {
    normalized.yearsPro = yearsPro;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStatePlayerBioDraft(
  value: unknown
): CurrentStatePlayerBioDraft | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBioDraft = {};
  const year = toOptionalNumber(record.year);
  const round = toOptionalNumber(record.round);
  const pick = toOptionalNumber(record.pick);
  const teamId = toOptionalTrimmedString(record.teamId);

  if (year !== undefined) {
    normalized.year = year;
  }
  if (round !== undefined) {
    normalized.round = round;
  }
  if (pick !== undefined) {
    normalized.pick = pick;
  }
  if (teamId !== undefined) {
    normalized.teamId = teamId;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStatePlayerBio(
  value: MutationPlayerBioLike | null | undefined
): CurrentStatePlayerBio | undefined {
  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: CurrentStatePlayerBio = {};
  const displayName = toOptionalTrimmedString(record.displayName);
  const playerId = toOptionalIdString(record.playerId);
  const name = toOptionalTrimmedString(record.name);
  const position = toOptionalTrimmedString(record.position);
  const age = toOptionalNumber(record.age);
  const height = toOptionalNumberish(record.height);
  const weight = toOptionalNumberish(record.weight);
  const dob = toOptionalTrimmedString(record.dob);
  const birthplace = toOptionalTrimmedString(record.birthplace);
  const nationality = toOptionalTrimmedString(record.nationality);
  const shoots = toOptionalTrimmedString(record.shoots);
  const agentRecord = asLooseRecord(record.agent);
  const draft = normalizeCurrentStatePlayerBioDraft(record.draft);
  const display = normalizeCurrentStatePlayerBioDisplay(record.display);
  const nbaId = toOptionalNumber(record.nbaId);
  const experience = toOptionalNumberish(record.experience);
  const yearsExperience = toOptionalNumberish(record.yearsExperience);
  const yearsPro = toOptionalNumberish(record.yearsPro);
  const team = toOptionalTrimmedString(record.team);
  const draftYear = toOptionalNumberish(record.draftYear);
  const draftRound = toOptionalNumber(record.draftRound);
  const draftPick = toOptionalNumberish(record.draftPick);
  const legacyYearsPro = toOptionalNumberish(record['Years Pro']);

  if (displayName !== undefined) {
    normalized.displayName = displayName;
  }
  if (playerId !== undefined) {
    normalized.playerId = playerId;
  }
  if (name !== undefined) {
    normalized.name = name;
  }
  if (position !== undefined) {
    normalized.position = position;
  }
  if (age !== undefined) {
    normalized.age = age;
  }
  if (height !== undefined) {
    normalized.height = height;
  }
  if (weight !== undefined) {
    normalized.weight = weight;
  }
  if (dob !== undefined) {
    normalized.dob = dob;
  }
  if (birthplace !== undefined) {
    normalized.birthplace = birthplace;
  }
  if (nationality !== undefined) {
    normalized.nationality = nationality;
  }
  if (shoots !== undefined) {
    normalized.shoots = shoots;
  }
  if (agentRecord) {
    normalized.agent = {
      name: toOptionalTrimmedString(agentRecord.name) ?? null,
      agency: toOptionalTrimmedString(agentRecord.agency) ?? null,
    };
  }
  if (draft !== undefined) {
    normalized.draft = draft;
  }
  if (display !== undefined) {
    normalized.display = display;
  }
  if (nbaId !== undefined) {
    normalized.nbaId = nbaId;
  }
  if (experience !== undefined) {
    normalized.experience = experience;
  }
  if (yearsExperience !== undefined) {
    normalized.yearsExperience = yearsExperience;
  }
  if (yearsPro !== undefined) {
    normalized.yearsPro = yearsPro;
  }
  if (team !== undefined) {
    normalized.team = team;
  }
  if (draftYear !== undefined) {
    normalized.draftYear = draftYear;
  }
  if (draftRound !== undefined) {
    normalized.draftRound = draftRound;
  }
  if (draftPick !== undefined) {
    normalized.draftPick = draftPick;
  }
  if (legacyYearsPro !== undefined) {
    normalized['Years Pro'] = legacyYearsPro;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export function normalizeCurrentStatePlayerBirdRights(
  value: ArchitectMutationPlayerRecord['birdRights']
): ArchitectMutationBirdRights | string | undefined {
  if (typeof value === 'string') {
    return toOptionalTrimmedString(value);
  }

  const record = asLooseRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: ArchitectMutationBirdRights = {};
  const status = toOptionalTrimmedString(record.status);
  const type = toOptionalTrimmedString(record.type);
  const yearsOfService = toOptionalNumberish(record.yearsOfService);
  const yearsWithTeam = toOptionalNumberish(record.yearsWithTeam);
  const eligibleFor = normalizeStringArray(record.eligibleFor);
  const renounced = toOptionalBoolean(record.renounced);

  if (status !== undefined) {
    normalized.status = status;
  }
  if (type !== undefined) {
    normalized.type = type;
  }
  if (yearsOfService !== undefined) {
    normalized.yearsOfService = yearsOfService;
  }
  if (yearsWithTeam !== undefined) {
    normalized.yearsWithTeam = yearsWithTeam;
  }
  if (eligibleFor !== undefined) {
    normalized.eligibleFor = eligibleFor;
  }
  if (renounced !== undefined) {
    normalized.renounced = renounced;
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}
