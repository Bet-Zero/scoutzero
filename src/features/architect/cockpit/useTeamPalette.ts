/**
 * FILE: src/features/architect/cockpit/useTeamPalette.ts
 * PURPOSE: Resolve a team identifier (slug, code, or name) to accent colors
 *          and expose them as CSS variables on a target element.
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Read-only hook. No mutation authority. No Firestore I/O.
 *
 * Resolution order:
 *   1. Trim the input.
 *   2. If it matches a slug key in TEAM_COLOR_MAP (via getTeamColors normalization),
 *      use it directly.
 *   3. Otherwise, map team code → slug via TEAM_LOGO_MAP (e.g. LAL → lakers).
 *   4. Fall back to DEFAULT_COLORS (neutral grey). Never throws.
 */
import { useEffect, useMemo, type RefObject } from 'react';
import {
  getTeamColors,
  TEAM_COLOR_MAP,
  type TeamColors,
} from '@/shared/utils/formatting/teamColors';
import { TEAM_LOGO_MAP } from '@/shared/utils/formatting/teamLogos';

type PaletteInput = string | null | undefined;

function normalizeSlug(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '');
}

function resolveTeamColorsSafe(input: PaletteInput): TeamColors {
  if (!input) return getTeamColors(null);

  const raw = String(input).trim();
  if (!raw) return getTeamColors(null);

  const direct = TEAM_COLOR_MAP[normalizeSlug(raw)];
  if (direct) return direct;

  const mapped = TEAM_LOGO_MAP[raw] || TEAM_LOGO_MAP[raw.toUpperCase()];
  if (mapped && TEAM_COLOR_MAP[mapped]) return TEAM_COLOR_MAP[mapped];

  return getTeamColors(raw);
}

interface UseTeamPaletteOptions {
  target?: RefObject<HTMLElement | null>;
}

export function useTeamPalette(
  input: PaletteInput,
  { target }: UseTeamPaletteOptions = {}
) {
  const palette = useMemo(() => resolveTeamColorsSafe(input), [input]);

  useEffect(() => {
    const node = target?.current ?? null;
    if (!node) return;

    node.style.setProperty('--team-primary', palette.primary);
    node.style.setProperty('--team-on-primary', palette.text);
    node.style.setProperty('--team-secondary', palette.secondary);

    return () => {
      node.style.removeProperty('--team-primary');
      node.style.removeProperty('--team-on-primary');
      node.style.removeProperty('--team-secondary');
    };
  }, [palette, target]);

  return palette;
}
