/**
 * FILE: src/tests/architect/quickBuilder.test.tsx
 * PURPOSE: Tests for Quick Builder behavior (TM-WIZARD-SIMPLIFY-E1, TM-WIZARD-UX-E2).
 *          Covers pool chip → comparator+ranks translation, swap auto-fill,
 *          protect presets → formState pipeline, jargon-ban assertion,
 *          and edit-mode identity summary vs create-mode PickSelector.
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2026-02-13: Created for TM-WIZARD-SIMPLIFY-E1.
 *  - 2026-02-13: TM-WIZARD-UX-E2 — Added edit-mode identity summary tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PickRightWizardModal } from '@/features/architect/admin/PickRightWizardModal';
import {
  POOL_CHIP_PRESETS,
  detectPoolChip,
  BANNED_JARGON_WORDS,
} from '@/features/architect/admin/pickEditorCopy';
import { wizardToFormState } from '@/features/architect/admin/wizardToEntitlement';
import { createDefaultWizardModel } from '@/features/architect/admin/pickRightWizardModel';
import {
  WIZARD_PRESETS,
  applyProtectionTemplate,
} from '@/features/architect/admin/ProtectionLadderTemplates';

// ── Mocks ──

vi.mock('@/firebaseConfig', () => ({ db: {} }));
vi.mock(
  '@/features/architect/utils/entitlements/entitlementWriter',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/features/architect/utils/entitlements/entitlementWriter')
    >('@/features/architect/utils/entitlements/entitlementWriter');
    return {
      ...actual,
      writeWorldEntitlement: vi.fn().mockResolvedValue({ success: true }),
      attachEntitlementToTeam: vi.fn(),
      detachEntitlementFromTeam: vi.fn(),
      isEntitlementAuthoringEnabled: () => true,
    };
  }
);

const defaultProps = {
  worldId: 'world-123',
  entitlementId: undefined,
  initialDocument: undefined,
  userId: 'user-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  onOpenAdvanced: vi.fn(),
};

// ─── Pool Chip Translation Tests ─────────────────────────────────────────────

describe('Pool Chip Translation (T4)', () => {
  it('Best chip → comparator=more_favorable, ranks=[1]', () => {
    const chip = POOL_CHIP_PRESETS.find((c) => c.id === 'best')!;
    expect(chip.comparator).toBe('more_favorable');
    expect(chip.ranks).toEqual([1]);
  });

  it('Top 2 chip → comparator=more_favorable, ranks=[1,2]', () => {
    const chip = POOL_CHIP_PRESETS.find((c) => c.id === 'top2')!;
    expect(chip.comparator).toBe('more_favorable');
    expect(chip.ranks).toEqual([1, 2]);
  });

  it('Worst chip → comparator=less_favorable, ranks=[1]', () => {
    const chip = POOL_CHIP_PRESETS.find((c) => c.id === 'worst')!;
    expect(chip.comparator).toBe('less_favorable');
    expect(chip.ranks).toEqual([1]);
  });

  it('Bottom 2 chip → comparator=less_favorable, ranks=[1,2]', () => {
    const chip = POOL_CHIP_PRESETS.find((c) => c.id === 'bottom2')!;
    expect(chip.comparator).toBe('less_favorable');
    expect(chip.ranks).toEqual([1, 2]);
  });

  it('Middle chip → comparator=middle, ranks=[1]', () => {
    const chip = POOL_CHIP_PRESETS.find((c) => c.id === 'middle')!;
    expect(chip.comparator).toBe('middle');
    expect(chip.ranks).toEqual([1]);
  });

  it('detectPoolChip correctly reverse-detects all presets', () => {
    expect(detectPoolChip('more_favorable', [1])).toBe('best');
    expect(detectPoolChip('more_favorable', [1, 2])).toBe('top2');
    expect(detectPoolChip('less_favorable', [1])).toBe('worst');
    expect(detectPoolChip('less_favorable', [1, 2])).toBe('bottom2');
    expect(detectPoolChip('middle', [1])).toBe('middle');
  });

  it('detectPoolChip returns null for non-preset combos', () => {
    expect(detectPoolChip('more_favorable', [1, 2, 3])).toBeNull();
    expect(detectPoolChip('less_favorable', [3])).toBeNull();
  });
});

// ─── Quick Protect Preset → FormState Pipeline Tests ─────────────────────────

describe('Quick Protect Presets → formState pipeline (T2)', () => {
  it('Unprotected preset produces clean formState with no ladder', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
      protection: { templateId: 'unprotected', customLadder: [] },
    });
    const formState = wizardToFormState(model);
    expect(formState.kind).toBe('pick_ownership');
    expect(formState.underlyingPickId).toBe('BOS_2027_1');
    expect(formState.underlyingStatus).toBe('clean');
    expect(formState.protectionLadder).toEqual([]);
  });

  it('Top 4 → Unprotected preset produces encumbered with 2 tiers', () => {
    const template = WIZARD_PRESETS.find((t) => t.id === 'top4_unprotected')!;
    const tiers = applyProtectionTemplate(template, 2027);
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
      protection: { templateId: 'top4_unprotected', customLadder: tiers },
    });
    const formState = wizardToFormState(model);
    expect(formState.kind).toBe('pick_ownership');
    expect(formState.underlyingStatus).toBe('encumbered');
    expect(formState.protectionLadder.length).toBe(2);
    expect(formState.protectionLadder[0].condition).toBe('Top 4');
    expect(formState.protectionLadder[0].year).toBe('2027');
    expect(formState.protectionLadder[1].condition).toBe('Unprotected');
    expect(formState.protectionLadder[1].year).toBe('2028');
  });

  it('Lottery → Top 10 → Unprotected preset produces 3 tiers', () => {
    const template = WIZARD_PRESETS.find(
      (t) => t.id === 'lottery_top10_unprotected'
    )!;
    const tiers = applyProtectionTemplate(template, 2026);
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'LAL', year: 2026, round: 1 },
      protection: {
        templateId: 'lottery_top10_unprotected',
        customLadder: tiers,
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.underlyingStatus).toBe('encumbered');
    expect(formState.protectionLadder.length).toBe(3);
    expect(formState.protectionLadder[0].condition).toBe('Lottery');
    expect(formState.protectionLadder[1].condition).toBe('Top 10');
  });

  it('all 5 wizard presets produce valid formState', () => {
    for (const preset of WIZARD_PRESETS) {
      const tiers = applyProtectionTemplate(preset, 2027);
      const model = createDefaultWizardModel({
        intent: 'protect_pick',
        pick: { team: 'BOS', year: 2027, round: 1 },
        protection: { templateId: preset.id, customLadder: tiers },
      });
      const formState = wizardToFormState(model);
      expect(formState.kind).toBe('pick_ownership');
      expect(formState.underlyingPickId).toBe('BOS_2027_1');
    }
  });
});

// ─── Swap Auto-Fill Tests ────────────────────────────────────────────────────

describe('Swap auto-fill target description (T3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('swap formState maps swapType correctly', () => {
    const model = createDefaultWizardModel({
      intent: 'create_swap',
      pick: { team: 'BOS', year: 2027, round: 1 },
      swap: {
        swapType: 'best_of',
        controllerPick: { team: 'LAL', year: 2027, round: 1 },
        targetDescription: 'LAL own 1st round pick',
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.kind).toBe('swap_right');
    expect(formState.swapType).toBe('best_of');
    expect(formState.swapControllerPickId).toBe('LAL_2027_1');
    expect(formState.swapTargetDefinition).toBe('LAL own 1st round pick');
  });

  it('swap worst_of maps correctly', () => {
    const model = createDefaultWizardModel({
      intent: 'create_swap',
      pick: { team: 'BOS', year: 2027, round: 1 },
      swap: {
        swapType: 'worst_of',
        controllerPick: { team: 'MIA', year: 2027, round: 1 },
        targetDescription: 'MIA own 1st round pick',
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.swapType).toBe('worst_of');
  });
});

// ─── Pool Chip → formState Pipeline Tests ────────────────────────────────────

describe('Pool chips → formState comparator+ranks pipeline (T4)', () => {
  it('Best chip → formState with more_favorable comparator and rank 1', () => {
    const model = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'HOU', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'LAL', year: 2027, round: 1 },
        ],
        selectionMethod: 'most_favorable',
        selectionRanks: [1],
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.receivesComparator).toBe('more_favorable');
    expect(formState.receivesRankText).toBe('1');
  });

  it('Top 2 chip → formState with more_favorable and ranks 1,2', () => {
    const model = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'HOU', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'LAL', year: 2027, round: 1 },
          { team: 'MIA', year: 2027, round: 1 },
        ],
        selectionMethod: 'most_favorable',
        selectionRanks: [1, 2],
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.receivesComparator).toBe('more_favorable');
    expect(formState.receivesRankText).toBe('1, 2');
  });

  it('Worst chip → formState with less_favorable and rank 1', () => {
    const model = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'HOU', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'LAL', year: 2027, round: 1 },
        ],
        selectionMethod: 'least_favorable',
        selectionRanks: [1],
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.receivesComparator).toBe('less_favorable');
    expect(formState.receivesRankText).toBe('1');
  });

  it('Middle chip → formState with middle comparator', () => {
    const model = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'HOU', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'LAL', year: 2027, round: 1 },
          { team: 'MIA', year: 2027, round: 1 },
        ],
        selectionMethod: 'middle',
        selectionRanks: [1],
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.receivesComparator).toBe('middle');
  });
});

// ─── Jargon-Ban Assertion Tests ──────────────────────────────────────────────

describe('Jargon-ban assertion for Quick Builder (T5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('Quick Builder protect mode has no banned jargon', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';
    for (const word of BANNED_JARGON_WORDS) {
      expect(text).not.toContain(word);
    }
  });

  it('Quick Builder swap mode has no banned jargon', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';
    for (const word of BANNED_JARGON_WORDS) {
      expect(text).not.toContain(word);
    }
  });

  it('Quick Builder pool mode has no banned jargon', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-create_conveyance'));
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';
    for (const word of BANNED_JARGON_WORDS) {
      expect(text).not.toContain(word);
    }
  });
});

// ─── TM-WIZARD-UX-E2: Edit vs Create Identity Tests ─────────────────────────

const editProps = {
  ...defaultProps,
  entitlementId: 'ent:BOS:2029:1:own:xyz789',
  initialDocument: {
    id: 'ent:BOS:2029:1:own:xyz789',
    holderTeam: 'BOS',
    seasonYear: 2029,
    round: 1,
    kind: 'pick_ownership',
    underlyingPickId: 'BOS_2029_1',
    underlyingStatus: 'clean',
    description: 'Boston 2029 1st',
  },
};

describe('Edit mode identity summary (TM-WIZARD-UX-E2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('edit mode does NOT render PickSelector', () => {
    render(<PickRightWizardModal {...editProps} />);
    expect(screen.queryByTestId('pick-selector')).not.toBeInTheDocument();
  });

  it('edit mode renders locked identity summary with team/year/round', () => {
    render(<PickRightWizardModal {...editProps} />);
    const summary = screen.getByTestId('edit-identity-summary');
    expect(summary).toBeInTheDocument();
    const primary = screen.getByTestId('edit-identity-primary');
    expect(primary.textContent).toContain('BOS');
    expect(primary.textContent).toContain('2029');
    expect(primary.textContent).toContain('1st');
  });

  it('edit mode shows Owner line', () => {
    render(<PickRightWizardModal {...editProps} />);
    const owner = screen.getByTestId('edit-identity-owner');
    expect(owner.textContent).toContain('Owner:');
    expect(owner.textContent).toContain('BOS');
  });

  it('edit mode shows Pick ID', () => {
    render(<PickRightWizardModal {...editProps} />);
    const pickId = screen.getByTestId('edit-identity-pick-id');
    expect(pickId.textContent).toContain('BOS_2029_1');
  });

  it('create mode renders PickSelector, NOT identity summary', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    expect(screen.getByTestId('pick-selector')).toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-identity-summary')
    ).not.toBeInTheDocument();
  });

  it('edit mode still shows action controls and apply bar', () => {
    render(<PickRightWizardModal {...editProps} />);
    expect(screen.getByTestId('quick-builder-controls')).toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-apply-bar')).toBeInTheDocument();
  });
});
