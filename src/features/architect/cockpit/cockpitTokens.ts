/**
 * FILE: src/features/architect/cockpit/cockpitTokens.ts
 * PURPOSE: Color and surface tokens for the Architect cockpit shell (Phase 1).
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Tokens are consumed by:
 *  - tailwind.config.js (extended as `theme.extend.colors.cockpit` so chrome
 *    can use utilities like `bg-cockpit-bar`, `border-cockpit-edge`).
 *  - useTeamPalette (injects accent CSS variables onto the cockpit root).
 *
 * Visual direction: dark, premium, dense sports-management cockpit. Not
 * sci-fi. Team accent is intentionally narrow — never a panel wash.
 */

export const cockpitTokens = {
  surface: {
    void: '#0A0C10',
    bar: '#0F1218',
    slab: '#13171F',
    raised: '#1A1F29',
    edge: '#232A36',
    inlay: '#0B0E14',
  },
  text: {
    primary: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.62)',
    muted: 'rgba(255,255,255,0.40)',
    ghost: 'rgba(255,255,255,0.20)',
  },
  status: {
    safe: '#34D399',
    watch: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
  },
  accent: {
    primary: 'var(--team-primary, #4F46E5)',
    onPrimary: 'var(--team-on-primary, #FFFFFF)',
  },
} as const;

export type CockpitTokens = typeof cockpitTokens;
