/**
 * FILE: src/features/profile/utils/profileHelpers.js
 * PURPOSE: Profile utilities for player lists, modal labels, and blurb access.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-22: Added video example helpers (Phase 3)
 *  - 2026-01-21: Updated by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import { normalizeBlurbs } from '@/shared/utils/blurbs';
import {
  normalizeVideoExamples,
  normalizeVideoExampleList,
} from '@/shared/utils/videoExamples';

export function getPlayersForTeam(playersData, team) {
  if (!team) return [];
  return Object.keys(playersData)
    .filter((key) => playersData[key]?.bio?.display?.team === team)
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

export function getModalTitle(key) {
  if (!key) return 'Breakdown';
  if (key.startsWith('trait_')) return `Trait Breakdown: ${key.slice(6)}`;
  if (key.startsWith('role_')) return `Role Breakdown: ${key.slice(5)}`;
  if (key.startsWith('subrole_')) return `Sub-Role Breakdown: ${key.slice(8)}`;
  if (key === 'shooting_profile') return 'Shooting Profile Breakdown';
  if (key === 'two_way_meter') return 'Two-Way Meter Breakdown';
  if (key === 'overall') return 'Overall Breakdown';
  return 'Breakdown';
}

export function getBlurbValue(blurbs, key) {
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

export function getVideoExamplesForKey(videoExamples, key) {
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

export function setVideoExamplesForKey(videoExamples, key, list) {
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

export function addVideoExampleForKey(videoExamples, key, example) {
  const current = getVideoExamplesForKey(videoExamples, key);
  return setVideoExamplesForKey(videoExamples, key, [...current, example]);
}

export function removeVideoExampleForKey(videoExamples, key, index) {
  const current = getVideoExamplesForKey(videoExamples, key);
  return setVideoExamplesForKey(
    videoExamples,
    key,
    current.filter((_, i) => i !== index)
  );
}

/**
 * Update a blurb value by key, returning a new blurbs object.
 * Centralizes the key-format parsing (trait_, role_, subrole_, etc.)
 */
export function setBlurbForKey(blurbs, key, value) {
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

export function updateVideoExampleLabelForKey(videoExamples, key, index, label) {
  const current = getVideoExamplesForKey(videoExamples, key);
  const next = current.map((item, i) =>
    i === index ? { ...item, label } : item
  );
  return setVideoExamplesForKey(videoExamples, key, next);
}
