/**
 * FILE: src/features/architect/cockpit/authorityLabel.ts
 * PURPOSE: Single source of truth for Architect authority/mode → user-facing
 *          label vocabulary. Maps the existing `ArchitectModePresentationKind`
 *          enum (plus receipt/event authority and season modifiers) to the
 *          short operator-facing labels defined in the implementation master
 *          spec (§4.1) and the Activity Rail contract (Labeling Rules).
 * OWNERSHIP: Feature: architect/cockpit
 *
 * Shared artifact: introduced by interconnectivity Slice 1 and reused by
 * Slices 2 (Player Action Menu), 4 (History outbound links), and 5
 * (Compare/Guide). Every authority/mode string surfaced in the cockpit must
 * come from here — do NOT inline per-slice label strings.
 *
 * No mutation authority, no React, no side effects: a pure mapping helper.
 */
import type {
  ArchitectEntryAuthorityKind,
  ArchitectModePresentationKind,
} from '@/features/architect/GMDashboard/hooks/useArchitectModePresentation';

/**
 * Visual tone bucket for an authority label. Surfaces map this to their own
 * styling; the helper never returns CSS so it stays presentation-agnostic.
 * `AUTHORITY_TONE_BADGE_CLASSES` below provides the cockpit chip styling for
 * rail/menu badges so even that mapping lives in one place.
 */
export type AuthorityTone =
  | 'committed'
  | 'local'
  | 'pending'
  | 'failed'
  | 'dev'
  | 'sandbox'
  | 'unavailable'
  | 'warn';

export interface AuthorityLabelResult {
  /** Short, operator-facing label (e.g. `Committed`, `Local draft`). */
  label: string;
  tone: AuthorityTone;
}

export interface AuthorityLabelInput {
  /** Internal mode/entry authority kind, when known. */
  kind?: ArchitectModePresentationKind | ArchitectEntryAuthorityKind | null;
  /** Receipt authority; only `committed-world` is a valid receipt authority. */
  receiptAuthority?: 'committed-world' | null;
  /** A committed world/history event — labels as `World event` rather than `Committed`. */
  isWorldEvent?: boolean;
  /** Viewing season differs from authoritative world season. */
  seasonMismatch?: boolean;
  /** State crosses a season-advance boundary. */
  multiSeason?: boolean;
  /** Concept exists in the product but is not modeled/derivable yet. */
  deferred?: boolean;
}

const COMMITTED: AuthorityLabelResult = { label: 'Committed', tone: 'committed' };
const WORLD_EVENT: AuthorityLabelResult = { label: 'World event', tone: 'committed' };
const SANDBOX: AuthorityLabelResult = { label: 'Sandbox', tone: 'sandbox' };
const LOCAL_DRAFT: AuthorityLabelResult = { label: 'Local draft', tone: 'local' };
const PENDING: AuthorityLabelResult = { label: 'Pending', tone: 'pending' };
const FAILED: AuthorityLabelResult = { label: 'Failed', tone: 'failed' };
const DEV_PREVIEW: AuthorityLabelResult = { label: 'DEV preview', tone: 'dev' };
const UNAVAILABLE: AuthorityLabelResult = { label: 'Unavailable', tone: 'unavailable' };
const DEFERRED: AuthorityLabelResult = { label: 'Deferred', tone: 'unavailable' };
const LOADING: AuthorityLabelResult = { label: 'Loading', tone: 'unavailable' };
const SEASON_MISMATCH: AuthorityLabelResult = {
  label: 'Season mismatch',
  tone: 'warn',
};
const MULTI_SEASON: AuthorityLabelResult = { label: 'Multi-season', tone: 'warn' };

/**
 * Maps every `ArchitectModePresentationKind` / `ArchitectEntryAuthorityKind`
 * value to its user-facing label. Covers each row of master spec §4.1.
 */
const BY_KIND: Record<ArchitectModePresentationKind, AuthorityLabelResult> = {
  'committed-world': COMMITTED,
  sandbox: SANDBOX,
  'local-only-preview': LOCAL_DRAFT,
  'pending-world-preview': PENDING,
  'failed-world-preview': FAILED,
  'dev-only-preview': DEV_PREVIEW,
  loading: LOADING,
  unavailable: UNAVAILABLE,
  error: FAILED,
};

/**
 * Resolve the user-facing authority label for a piece of cockpit state.
 *
 * Precedence (most specific first): season modifiers → deferred → committed
 * receipt/event → internal kind → unavailable fallback. Modifiers win because
 * a `Season mismatch` / `Multi-season` qualifier is the operator-relevant fact
 * even when the underlying state is otherwise committed.
 */
export function getAuthorityLabel(
  input: AuthorityLabelInput = {}
): AuthorityLabelResult {
  if (input.seasonMismatch) return SEASON_MISMATCH;
  if (input.multiSeason) return MULTI_SEASON;
  if (input.deferred) return DEFERRED;
  if (input.isWorldEvent) return WORLD_EVENT;
  if (input.receiptAuthority === 'committed-world') return COMMITTED;
  if (input.kind) return BY_KIND[input.kind];
  return UNAVAILABLE;
}

/**
 * Cockpit chip styling per tone. Kept here so badge classes are defined once
 * alongside the labels rather than duplicated across rail/menu surfaces.
 */
export const AUTHORITY_TONE_BADGE_CLASSES: Record<AuthorityTone, string> = {
  committed: 'border-cockpit-safe/30 bg-cockpit-safe/10 text-cockpit-safe',
  local: 'border-cockpit-watch/30 bg-cockpit-watch/10 text-cockpit-watch',
  pending: 'border-cockpit-info/30 bg-cockpit-info/10 text-cockpit-info',
  failed: 'border-cockpit-danger/30 bg-cockpit-danger/10 text-cockpit-danger',
  dev: 'border-cockpit-edge bg-cockpit-inlay text-cockpit-text-muted',
  sandbox: 'border-cockpit-edge bg-cockpit-inlay text-cockpit-text-secondary',
  unavailable: 'border-cockpit-edge bg-cockpit-inlay text-cockpit-text-muted',
  warn: 'border-cockpit-info/30 bg-cockpit-info/10 text-cockpit-info',
};
