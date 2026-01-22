/**
 * FILE: src/shared/utils/videoExamples.js
 * PURPOSE: Normalize and validate video example entries for evaluation blurbs.
 * OWNERSHIP: Feature: shared/utils (player evaluations)
 *
 * HISTORY:
 *  - 2026-01-22: Created by plan `plans/_archive/scouting-player-profile-phase-3-videos/plan.md`, chunk_n/a
 *
 * LINKS:
 *  - Plan: plans/_archive/scouting-player-profile-phase-3-videos/plan.md
 *  - Latest Chunk: n/a (no chunks used)
 */

const EMPTY_VIDEO_EXAMPLES = {
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: [],
  twoWayMeter: [],
  overall: [],
};

const isPlainObject = (value) =>
  value && typeof value === 'object' && !Array.isArray(value);

const trimString = (value) =>
  typeof value === 'string' ? value.trim() : '';

export const createEmptyVideoExamples = () => ({
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: [],
  twoWayMeter: [],
  overall: [],
});

export const isYouTubeUrl = (url) => {
  if (typeof url !== 'string') return false;
  const value = url.trim().toLowerCase();
  return value.includes('youtube.com/watch?v=') || value.includes('youtu.be/');
};

export const extractYouTubeId = (url) => {
  if (typeof url !== 'string') return null;
  const value = url.trim();

  const watchMatch = value.match(/[?&]v=([^&]+)/);
  if (watchMatch?.[1]) return watchMatch[1];

  const shortMatch = value.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch?.[1]) return shortMatch[1];

  const embedMatch = value.match(/youtube\.com\/embed\/([^?&]+)/);
  if (embedMatch?.[1]) return embedMatch[1];

  return null;
};

export const getYouTubeEmbedUrl = (url) => {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
};

export const getYouTubeThumbnailUrl = (url) => {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

export const buildVideoExample = (url, label) => {
  const trimmedUrl = trimString(url);
  if (!trimmedUrl) return null;
  const trimmedLabel = trimString(label);
  return {
    url: trimmedUrl,
    label: trimmedLabel || undefined,
    createdAt: Date.now(),
  };
};

const normalizeVideoExample = (value) => {
  if (typeof value === 'string') {
    const url = trimString(value);
    if (!url) return null;
    return { url };
  }

  if (!isPlainObject(value)) return null;
  const url = trimString(value.url);
  if (!url) return null;

  const label = trimString(value.label);
  const createdAt = Number.isFinite(value.createdAt)
    ? value.createdAt
    : undefined;

  return {
    url,
    label: label || undefined,
    createdAt,
  };
};

export const normalizeVideoExampleList = (list) => {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => normalizeVideoExample(item))
    .filter((item) => item && item.url);
};

const normalizeVideoExampleMap = (value) => {
  if (!isPlainObject(value)) return {};
  return Object.entries(value).reduce((acc, [key, list]) => {
    const normalizedList = normalizeVideoExampleList(list);
    if (normalizedList.length) acc[key] = normalizedList;
    return acc;
  }, {});
};

const normalizeSubroleMap = (value) => {
  if (!isPlainObject(value)) return {};
  const hasBuckets =
    isPlainObject(value.offense) || isPlainObject(value.defense);
  if (!hasBuckets) {
    return normalizeVideoExampleMap(value);
  }

  return {
    ...normalizeVideoExampleMap(value.offense),
    ...normalizeVideoExampleMap(value.defense),
  };
};

export const normalizeVideoExamples = (raw) => {
  if (!isPlainObject(raw)) {
    return createEmptyVideoExamples();
  }

  const subroles = isPlainObject(raw.subroles)
    ? raw.subroles
    : isPlainObject(raw.subRoles)
      ? raw.subRoles
      : {};

  return {
    traits: normalizeVideoExampleMap(raw.traits),
    roles: normalizeVideoExampleMap(raw.roles),
    subroles: normalizeSubroleMap(subroles),
    shootingProfile: normalizeVideoExampleList(raw.shootingProfile),
    twoWayMeter: normalizeVideoExampleList(raw.twoWayMeter),
    overall: normalizeVideoExampleList(raw.overall),
  };
};

export const DEFAULT_VIDEO_EXAMPLES = { ...EMPTY_VIDEO_EXAMPLES };
