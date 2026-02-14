/**
 * FILE: src/tests/architect/quickBuilder.test.tsx
 * PURPOSE: Tests for Quick Builder behavior (TM-WIZARD-SIMPLIFY-E1, TM-WIZARD-UX-E2, TM-WIZARD-SIMPLIFY-E2).
 *          Covers pool chip → comparator+ranks translation, swap auto-fill,
 *          protect presets → formState pipeline, jargon-ban assertion,
 *          edit-mode identity summary vs create-mode PickSelector,
 *          TM-WIZARD-SIMPLIFY-E2 constraints (4 presets, read-only swap),
 *          Convert to Swap functionality, and no-arrow UI constraint.
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2026-02-13: Created for TM-WIZARD-SIMPLIFY-E1.
 *  - 2026-02-13: TM-WIZARD-UX-E2 — Added edit-mode identity summary tests.
 *  - 2026-02-14: TM-WIZARD-SIMPLIFY-E2 — Updated for 4 presets (no Lottery→Top10),
 *                read-only swap section in edit mode, "Other team's pick" label,
 *                Edit mode action buttons, Convert to Swap, no-arrow constraint.
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

  it('Lottery → Unprotected preset produces 2 tiers (TM-WIZARD-SIMPLIFY-E2)', () => {
    const template = WIZARD_PRESETS.find(
      (t) => t.id === 'lottery_unprotected'
    )!;
    const tiers = applyProtectionTemplate(template, 2026);
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'LAL', year: 2026, round: 1 },
      protection: {
        templateId: 'lottery_unprotected',
        customLadder: tiers,
      },
    });
    const formState = wizardToFormState(model);
    expect(formState.underlyingStatus).toBe('encumbered');
    expect(formState.protectionLadder.length).toBe(2);
    expect(formState.protectionLadder[0].condition).toBe('Lottery');
    expect(formState.protectionLadder[1].condition).toBe('Unprotected');
  });

  it('all 4 wizard presets produce valid formState (TM-WIZARD-SIMPLIFY-E2)', () => {
    expect(WIZARD_PRESETS.length).toBe(4); // Exactly 4 presets per ticket
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

// ─── TM-WIZARD-SIMPLIFY-E2: Preset Count Enforcement ─────────────────────────

describe('Wizard presets count (TM-WIZARD-SIMPLIFY-E2)', () => {
  it('WIZARD_PRESETS has exactly 4 presets', () => {
    expect(WIZARD_PRESETS.length).toBe(4);
  });

  it('preset list contains exactly: Unprotected, Top 4, Top 10, Lottery', () => {
    const ids = WIZARD_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'unprotected',
      'top4_unprotected',
      'top10_unprotected',
      'lottery_unprotected',
    ]);
  });

  it('Lottery→Top10→Unprotected is NOT in WIZARD_PRESETS', () => {
    const ids = WIZARD_PRESETS.map((p) => p.id);
    expect(ids).not.toContain('lottery_top10_unprotected');
  });
});

// ─── TM-WIZARD-SIMPLIFY-E2: Swap Edit Mode Read-Only Tests ──────────────────

const swapEditProps = {
  ...defaultProps,
  entitlementId: 'ent:BOS:2028:1:swap:xyz123',
  initialDocument: {
    id: 'ent:BOS:2028:1:swap:xyz123',
    holderTeam: 'BOS',
    seasonYear: 2028,
    round: 1,
    kind: 'swap_right',
    underlyingPickId: 'BOS_2028_1',
    swapControllerPickId: 'LAL_2028_1',
    swapTargetDefinition: 'LAL own 1st round pick',
    swapType: 'best_of',
    description: 'Swap with Lakers',
  },
};

describe('Swap edit mode read-only (TM-WIZARD-SIMPLIFY-E2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('swap edit mode does NOT render PickSelector for other team pick', () => {
    render(<PickRightWizardModal {...swapEditProps} />);
    // Should show controls
    expect(screen.getByTestId('quick-builder-controls')).toBeInTheDocument();
    // Should show read-only indicator for other team's pick
    expect(screen.getByTestId('swap-other-pick-readonly')).toBeInTheDocument();
  });

  it('swap edit mode shows "Other team\'s pick" as read-only team only (TM-WIZARD-SIMPLIFY-E2)', () => {
    render(<PickRightWizardModal {...swapEditProps} />);
    const readonlyPick = screen.getByTestId('swap-other-pick-readonly');
    // Should show team only, not full pick info (per ticket: "team only")
    expect(readonlyPick.textContent).toContain('LAL');
    expect(readonlyPick.textContent).toContain("Other team's pick");
    // Should NOT show year/round (that's redundant with identity at top)
    expect(readonlyPick.textContent).not.toContain('2028');
    expect(readonlyPick.textContent).not.toContain('1st');
  });

  it('swap create mode renders PickSelector for other team pick', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));

    // Should show PickSelector (not read-only)
    expect(
      screen.queryByTestId('swap-other-pick-readonly')
    ).not.toBeInTheDocument();
    // Should have the swap controls
    expect(screen.getByTestId('quick-swap-section')).toBeInTheDocument();
  });
});

// ─── TM-WIZARD-SIMPLIFY-E2: Label Enforcement ───────────────────────────────

describe('Label constraints (TM-WIZARD-SIMPLIFY-E2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('Quick UI does not contain "swap with team" wording', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';
    expect(text.toLowerCase()).not.toContain('swap with team');
  });

  it('swap section label says "Other team\'s pick" not "Their pick"', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    const container = screen.getByTestId('quick-swap-section');
    const text = container.textContent || '';
    expect(text).toContain("Other team's pick");
  });
});

// ─── TM-WIZARD-SIMPLIFY-E2: Convert to Swap Functionality ─────────────────────

const pickOwnershipEditProps = {
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

const swapRightEditProps = {
  ...defaultProps,
  entitlementId: 'ent:BOS:2028:1:swap:abc123',
  initialDocument: {
    id: 'ent:BOS:2028:1:swap:abc123',
    holderTeam: 'BOS',
    seasonYear: 2028,
    round: 1,
    kind: 'swap_right',
    underlyingPickId: 'BOS_2028_1',
    swapControllerPickId: 'LAL_2028_1',
    swapTargetDefinition: 'LAL own 1st round pick',
    swapType: 'best_of',
    description: 'Swap with Lakers',
  },
};

describe('Convert to Swap functionality (TM-WIZARD-SIMPLIFY-E2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('edit mode shows Protect and Swap action buttons', () => {
    render(<PickRightWizardModal {...pickOwnershipEditProps} />);
    expect(screen.getByTestId('quick-builder-actions')).toBeInTheDocument();
    expect(screen.getByTestId('action-protect_pick')).toBeInTheDocument();
    expect(screen.getByTestId('action-create_swap')).toBeInTheDocument();
  });

  it('edit mode does NOT show Pool action button', () => {
    render(<PickRightWizardModal {...pickOwnershipEditProps} />);
    expect(
      screen.queryByTestId('action-create_conveyance')
    ).not.toBeInTheDocument();
  });

  it('clicking Swap when editing pick_ownership shows Convert to Swap button', () => {
    const onDuplicateAsNew = vi.fn();
    render(
      <PickRightWizardModal
        {...pickOwnershipEditProps}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );
    fireEvent.click(screen.getByTestId('action-create_swap'));
    expect(screen.getByTestId('swap-convert-section')).toBeInTheDocument();
    expect(screen.getByTestId('convert-to-swap-btn')).toBeInTheDocument();
  });

  it('Convert to Swap button triggers onDuplicateAsNew with swap_right kind', () => {
    const onDuplicateAsNew = vi.fn();
    render(
      <PickRightWizardModal
        {...pickOwnershipEditProps}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );
    fireEvent.click(screen.getByTestId('action-create_swap'));
    fireEvent.click(screen.getByTestId('convert-to-swap-btn'));

    expect(onDuplicateAsNew).toHaveBeenCalledTimes(1);
    const doc = onDuplicateAsNew.mock.calls[0][0];
    expect(doc.kind).toBe('swap_right');
    expect(doc.holderTeam).toBe('BOS');
    expect(doc.seasonYear).toBe(2029);
    expect(doc.round).toBe(1);
  });

  it('swap_right document has controller pick set to current underlying pick', () => {
    const onDuplicateAsNew = vi.fn();
    render(
      <PickRightWizardModal
        {...pickOwnershipEditProps}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );
    fireEvent.click(screen.getByTestId('action-create_swap'));
    fireEvent.click(screen.getByTestId('convert-to-swap-btn'));

    const doc = onDuplicateAsNew.mock.calls[0][0];
    expect(doc.swapControllerPickId).toBe('BOS_2029_1');
    expect(doc.swapType).toBe('best_of');
  });

  it('editing a swap_right does NOT show Convert to Swap (shows normal swap controls)', () => {
    render(<PickRightWizardModal {...swapRightEditProps} />);
    // Already on swap intent, should see normal controls
    expect(
      screen.queryByTestId('swap-convert-section')
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('convert-to-swap-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('swap-type-best_of')).toBeInTheDocument();
  });

  it('does not show Convert to Swap section without onDuplicateAsNew callback', () => {
    render(<PickRightWizardModal {...pickOwnershipEditProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    // Without onDuplicateAsNew, convert section should not appear
    expect(
      screen.queryByTestId('swap-convert-section')
    ).not.toBeInTheDocument();
  });
});

// ─── TM-WIZARD-SIMPLIFY-E2: No Arrow (->) in Quick UI ────────────────────────

describe('No arrow in Quick UI (TM-WIZARD-SIMPLIFY-E2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('create mode protect screen has no arrow', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    const container = screen.getByTestId('quick-builder');
    expect(container.textContent).not.toContain('→');
  });

  it('create mode swap screen has no arrow', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    const container = screen.getByTestId('quick-builder');
    expect(container.textContent).not.toContain('→');
  });

  it('edit mode has no arrow in quick builder', () => {
    render(<PickRightWizardModal {...pickOwnershipEditProps} />);
    const container = screen.getByTestId('quick-builder');
    expect(container.textContent).not.toContain('→');
  });

  it('Advanced button text is "Advanced" without arrow', () => {
    render(<PickRightWizardModal {...defaultProps} />);
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    const advancedBtn = screen.getByTestId('wizard-open-advanced');
    expect(advancedBtn.textContent).toBe('Advanced');
    expect(advancedBtn.textContent).not.toContain('→');
  });
});
