import { describe, it, expect } from 'vitest';
import { buildHeadshotUrl, DEFAULT_HEADSHOT } from '@/utils/headshots.js';

describe('buildHeadshotUrl', () => {
  it('returns player.headshot when provided', () => {
    const player = { headshot: 'https://example.com/custom.jpg' };
    expect(buildHeadshotUrl(player)).toBe('https://example.com/custom.jpg');
  });

  it('returns player.headshotUrl when headshot not provided', () => {
    const player = { headshotUrl: 'https://example.com/custom2.jpg' };
    expect(buildHeadshotUrl(player)).toBe('https://example.com/custom2.jpg');
  });

  it('builds Blob URL using player.id', () => {
    const player = { id: '12345' };
    expect(buildHeadshotUrl(player)).toBe('https://ofbebc3ljlmaq3bj.public.blob.vercel-storage.com/headshots/12345.png');
  });

  it('builds Blob URL using player.player_id when id not available', () => {
    const player = { player_id: '67890' };
    expect(buildHeadshotUrl(player)).toBe('https://ofbebc3ljlmaq3bj.public.blob.vercel-storage.com/headshots/67890.png');
  });

  it('returns DEFAULT_HEADSHOT when no valid data provided', () => {
    expect(buildHeadshotUrl({})).toBe(DEFAULT_HEADSHOT);
    expect(buildHeadshotUrl(null)).toBe(DEFAULT_HEADSHOT);
    expect(buildHeadshotUrl(undefined)).toBe(DEFAULT_HEADSHOT);
  });

  it('encodes special characters in player IDs', () => {
    const player = { id: 'test player/special' };
    expect(buildHeadshotUrl(player)).toBe('https://ofbebc3ljlmaq3bj.public.blob.vercel-storage.com/headshots/test%20player%2Fspecial.png');
  });
});