import type { VideoExample } from '@/schemas/players_v2';

export type NormalizedVideoExamples = {
  traits: Record<string, VideoExample[]>;
  roles: Record<string, VideoExample[]>;
  subroles: Record<string, VideoExample[]>;
  shootingProfile: VideoExample[];
  twoWayMeter: VideoExample[];
  overall: VideoExample[];
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const trimString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const createEmptyVideoExamples = (): NormalizedVideoExamples => ({
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: [],
  twoWayMeter: [],
  overall: [],
});

export const isYouTubeUrl = (url: unknown): boolean => {
  if (typeof url !== 'string') return false;
  const value = url.trim().toLowerCase();
  return value.includes('youtube.com/watch?v=') || value.includes('youtu.be/');
};

export const extractYouTubeId = (url: unknown): string | null => {
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

export const getYouTubeEmbedUrl = (url: unknown): string | null => {
  const id = extractYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
};

export const getYouTubeThumbnailUrl = (url: unknown): string | null => {
  const id = extractYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};

export const buildVideoExample = (url: unknown, label: unknown): VideoExample | null => {
  const trimmedUrl = trimString(url);
  if (!trimmedUrl) return null;
  const trimmedLabel = trimString(label);

  const videoExample: VideoExample = {
    url: trimmedUrl,
    createdAt: Date.now(),
  };

  if (trimmedLabel) {
    videoExample.label = trimmedLabel;
  }

  return videoExample;
};

const normalizeVideoExample = (value: unknown): VideoExample | null => {
  if (typeof value === 'string') {
    const url = trimString(value);
    if (!url) return null;
    return { url, createdAt: Date.now() };
  }

  if (!isPlainObject(value)) return null;
  const url = trimString(value.url);
  if (!url) return null;

  const label = trimString(value.label);
  const createdAt =
    typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)
      ? value.createdAt
      : Date.now();

  const normalized: VideoExample = { url, createdAt };

  if (label) {
    normalized.label = label;
  }

  return normalized;
};

export const normalizeVideoExampleList = (list: unknown): VideoExample[] => {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => normalizeVideoExample(item))
    .filter((item): item is VideoExample => item !== null && !!item.url);
};

const normalizeVideoExampleMap = (
  value: unknown
): Record<string, VideoExample[]> => {
  if (!isPlainObject(value)) return {};
  return Object.entries(value).reduce<Record<string, VideoExample[]>>(
    (acc, [key, list]) => {
      const normalizedList = normalizeVideoExampleList(list);
      if (normalizedList.length) acc[key] = normalizedList;
      return acc;
    },
    {}
  );
};

const normalizeSubroleMap = (
  value: unknown
): Record<string, VideoExample[]> => {
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

export const normalizeVideoExamples = (raw: unknown): NormalizedVideoExamples => {
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

export const DEFAULT_VIDEO_EXAMPLES: NormalizedVideoExamples = createEmptyVideoExamples();
