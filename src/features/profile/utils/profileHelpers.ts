import { normalizeBlurbs } from '@/shared/utils/blurbs';
import type { Blurbs } from '@/shared/utils/blurbs';
import {
  normalizeVideoExamples,
  normalizeVideoExampleList,
} from '@/shared/utils/videoExamples';
import type { NormalizedVideoExamples } from '@/shared/utils/videoExamples';
import type { VideoExample } from '@/schemas/players_v2';

export type ProfilePlayerSummary = {
  name?: string | null;
  bio?: {
    displayName?: string | null;
    name?: string | null;
    display?: {
      team?: string | null;
    } | null;
  } | null;
};

export type PlayersDataMap = Record<string, ProfilePlayerSummary | null | undefined>;
export type ProfileDetailKey = string | null | undefined;

export function getPlayersForTeam(
  playersData: PlayersDataMap,
  team: string | null | undefined
): string[] {
  return Object.keys(playersData)
    .filter((key) => !team || playersData[key]?.bio?.display?.team === team)
    .sort((a, b) => {
      const aName =
        playersData[a]?.bio?.displayName || playersData[a]?.name || '';
      const bName =
        playersData[b]?.bio?.displayName || playersData[b]?.name || '';
      return aName
        .split(' ')
        .slice(-1)[0]
        .localeCompare(bName.split(' ').slice(-1)[0]);
    });
}

export function getModalTitle(key: ProfileDetailKey): string {
  if (!key) return 'Breakdown';
  if (key.startsWith('trait_')) return `Trait Breakdown: ${key.slice(6)}`;
  if (key.startsWith('role_')) return `Role Breakdown: ${key.slice(5)}`;
  if (key.startsWith('subrole_')) return `Sub-Role Breakdown: ${key.slice(8)}`;
  if (key === 'shooting_profile') return 'Shooting Profile Breakdown';
  if (key === 'two_way_meter') return 'Two-Way Meter Breakdown';
  if (key === 'overall') return 'Overall Breakdown';
  return 'Breakdown';
}

export function getBlurbValue(blurbs: unknown, key: ProfileDetailKey): string {
  const normalized = normalizeBlurbs(blurbs);
  if (!key) return '';
  if (key.startsWith('trait_'))
    return normalized.traits?.[key.slice(6)] || '';
  if (key.startsWith('role_'))
    return normalized.roles?.[key.slice(5)] || '';
  if (key.startsWith('subrole_'))
    return normalized.subroles?.[key.slice(8)] || '';
  if (key === 'shooting_profile') return normalized.shootingProfile || '';
  if (key === 'two_way_meter') return normalized.twoWayMeter || '';
  if (key === 'overall') return normalized.overall || '';
  return '';
}

export function getVideoExamplesForKey(
  videoExamples: unknown,
  key: ProfileDetailKey
): VideoExample[] {
  const normalized = normalizeVideoExamples(videoExamples);
  if (!key) return [];
  if (key.startsWith('trait_'))
    return normalized.traits?.[key.slice(6)] || [];
  if (key.startsWith('role_'))
    return normalized.roles?.[key.slice(5)] || [];
  if (key.startsWith('subrole_'))
    return normalized.subroles?.[key.slice(8)] || [];
  if (key === 'shooting_profile') return normalized.shootingProfile || [];
  if (key === 'two_way_meter') return normalized.twoWayMeter || [];
  if (key === 'overall') return normalized.overall || [];
  return [];
}

export function setVideoExamplesForKey(
  videoExamples: unknown,
  key: ProfileDetailKey,
  list: unknown
): NormalizedVideoExamples {
  const normalized = normalizeVideoExamples(videoExamples);
  const safeList = normalizeVideoExampleList(list);
  if (!key) return normalized;

  if (key.startsWith('trait_')) {
    return {
      ...normalized,
      traits: { ...normalized.traits, [key.slice(6)]: safeList },
    };
  }

  if (key.startsWith('role_')) {
    return {
      ...normalized,
      roles: { ...normalized.roles, [key.slice(5)]: safeList },
    };
  }

  if (key.startsWith('subrole_')) {
    return {
      ...normalized,
      subroles: { ...normalized.subroles, [key.slice(8)]: safeList },
    };
  }

  if (key === 'shooting_profile') {
    return { ...normalized, shootingProfile: safeList };
  }

  if (key === 'two_way_meter') {
    return { ...normalized, twoWayMeter: safeList };
  }

  if (key === 'overall') {
    return { ...normalized, overall: safeList };
  }

  return normalized;
}

export function addVideoExampleForKey(
  videoExamples: unknown,
  key: ProfileDetailKey,
  example: VideoExample
): NormalizedVideoExamples {
  const current = getVideoExamplesForKey(videoExamples, key);
  return setVideoExamplesForKey(videoExamples, key, [...current, example]);
}

export function removeVideoExampleForKey(
  videoExamples: unknown,
  key: ProfileDetailKey,
  index: number
): NormalizedVideoExamples {
  const current = getVideoExamplesForKey(videoExamples, key);
  return setVideoExamplesForKey(
    videoExamples,
    key,
    current.filter((_, i) => i !== index)
  );
}

/**
 * Update a blurb value by key, returning a new blurbs object.
 * Centralizes the key-format parsing (trait_, role_, subrole_, etc.).
 */
export function setBlurbForKey(
  blurbs: unknown,
  key: ProfileDetailKey,
  value: string
): Blurbs {
  const normalized = normalizeBlurbs(blurbs);
  if (!key) return normalized;
  if (key.startsWith('trait_'))
    return { ...normalized, traits: { ...normalized.traits, [key.slice(6)]: value } };
  if (key.startsWith('role_'))
    return { ...normalized, roles: { ...normalized.roles, [key.slice(5)]: value } };
  if (key.startsWith('subrole_'))
    return { ...normalized, subroles: { ...normalized.subroles, [key.slice(8)]: value } };
  if (key === 'shooting_profile')
    return { ...normalized, shootingProfile: value };
  if (key === 'two_way_meter')
    return { ...normalized, twoWayMeter: value };
  if (key === 'overall')
    return { ...normalized, overall: value };
  return normalized;
}

export function updateVideoExampleLabelForKey(
  videoExamples: unknown,
  key: ProfileDetailKey,
  index: number,
  label: string
): NormalizedVideoExamples {
  const current = getVideoExamplesForKey(videoExamples, key);
  const next = current.map((item, i) =>
    i === index ? { ...item, label } : item
  );
  return setVideoExamplesForKey(videoExamples, key, next);
}
