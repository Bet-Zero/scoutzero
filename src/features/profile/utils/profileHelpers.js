/**
 * FILE: src/features/profile/utils/profileHelpers.js
 * PURPOSE: Profile utilities for player lists, modal labels, and blurb access.
 * OWNERSHIP: Feature: profile/scouting
 *
 * HISTORY:
 *  - 2026-01-21: Updated by plan `plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-1-data-contract/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

import { normalizeBlurbs } from '@/shared/utils/blurbs';

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

export function getVideoExamples(key) {
  const examples = {
    trait_Shooting: ['https://www.youtube.com/embed/sampleVideo1'],
  };
  return examples[key] || [];
}
