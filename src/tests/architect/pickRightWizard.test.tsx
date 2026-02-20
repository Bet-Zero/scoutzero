/**
 * FILE: src/tests/architect/pickRightWizard.test.tsx
 * PURPOSE: Tests for PickRightWizardModal Quick Builder.
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Updated for WizardModel-based modal.
 *  - 2026-02-13: TM-WIZARD-SIMPLIFY-E1 — Rewritten for Quick Builder single-screen UX.
 *  - 2026-02-13: TM-WIZARD-UX-E2 — Edit mode: PickSelector absent, identity summary present.
 *  - 2026-02-14: TM-WIZARD-SIMPLIFY-E2 — Updated for compact no-scroll UI with 4 presets,
 *                read-only swap section in edit mode, "Other team's pick" label,
 *                Edit mode shows Protect+Swap action buttons, Convert to Swap functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fireEvent,
  render,
  screen,
  cleanup,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PickRightWizardModal } from '@/features/architect/admin/PickRightWizardModal';

const mockWriteWorldEntitlement = vi.fn();

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock(
  '@/features/architect/utils/entitlements/entitlementWriter',
  async () => {
    const actual = await vi.importActual<
      typeof import('@/features/architect/utils/entitlements/entitlementWriter')
    >('@/features/architect/utils/entitlements/entitlementWriter');
    return {
      ...actual,
      writeWorldEntitlement: (...args: unknown[]) =>
        mockWriteWorldEntitlement(...args),
      attachEntitlementToTeam: vi.fn(),
      detachEntitlementFromTeam: vi.fn(),
      isEntitlementAuthoringEnabled: () => true,
    };
  }
);

const defaultCreateProps = {
  worldId: 'world-123',
  entitlementId: undefined,
  initialDocument: undefined,
  userId: 'user-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  onOpenAdvanced: vi.fn(),
};

const defaultEditProps = {
  ...defaultCreateProps,
  entitlementId: 'ent:BOS:2027:1:own:abcd1234',
  initialDocument: {
    id: 'ent:BOS:2027:1:own:abcd1234',
    holderTeam: 'BOS',
    seasonYear: 2027,
    round: 1,
    kind: 'pick_ownership',
    underlyingPickId: 'BOS_2027_1',
    underlyingStatus: 'clean',
    description: 'Boston 2027 1st',
  },
};

describe('PickRightWizardModal — Quick Builder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockWriteWorldEntitlement.mockResolvedValue({
      success: true,
      path: 'architect_worlds/world-123/entitlements/test',
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // ── Quick Builder single-screen ──

  it('opens with Quick Builder in create mode (single screen)', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByTestId('quick-builder')).toBeInTheDocument();
    // No multi-step indicators
    expect(screen.queryByText('1. Type')).not.toBeInTheDocument();
    expect(screen.queryByText('2. Details')).not.toBeInTheDocument();
  });

  it('shows action cards for Protect, Swap, and Pool', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByTestId('action-protect_pick')).toBeInTheDocument();
    expect(screen.getByTestId('action-create_swap')).toBeInTheDocument();
    expect(screen.getByTestId('action-create_conveyance')).toBeInTheDocument();
  });

  it('shows pick selector in create mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByTestId('pick-selector')).toBeInTheDocument();
  });

  it('shows controls inline when Protect is selected', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    expect(screen.getByTestId('quick-protect-section')).toBeInTheDocument();
    // TM-WIZARD-SIMPLIFY-E2: Preview section removed for compact UI
    expect(screen.getByTestId('quick-builder-apply-bar')).toBeInTheDocument();
  });

  it('shows controls inline when Swap is selected', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    expect(screen.getByTestId('quick-swap-section')).toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-apply-bar')).toBeInTheDocument();
  });

  it('shows pool redirect message when Pool is selected (TM-WIZARD-SIMPLIFY-E2)', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_conveyance'));
    // Pool/conveyance is now advanced-only, shows redirect message
    expect(screen.getByTestId('quick-pool-section')).toBeInTheDocument();
    expect(screen.queryByTestId('pool-chips')).not.toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-apply-bar')).toBeInTheDocument();
  });

  // ── Edit mode ──

  it('opens directly in Quick Builder in edit mode', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.getByTestId('quick-builder')).toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-controls')).toBeInTheDocument();
  });

  it('shows "Entitlement Editor" title in edit mode', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.getByText('Entitlement Editor')).toBeInTheDocument();
  });

  // TM-WIZARD-SIMPLIFY-E2: Edit mode now shows action buttons (Protect + Swap)
  it('shows Protect and Swap action buttons in edit mode (TM-WIZARD-SIMPLIFY-E2)', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.getByTestId('quick-builder-actions')).toBeInTheDocument();
    expect(screen.getByTestId('action-protect_pick')).toBeInTheDocument();
    expect(screen.getByTestId('action-create_swap')).toBeInTheDocument();
  });

  it('does not show Pool action button in edit mode (TM-WIZARD-SIMPLIFY-E2)', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(
      screen.queryByTestId('action-create_conveyance')
    ).not.toBeInTheDocument();
  });

  // ── Protection template flow ──

  it('applies protection template and selects it (TM-WIZARD-SIMPLIFY-E2)', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    fireEvent.click(screen.getByTestId('template-top4_unprotected'));
    // TM-WIZARD-SIMPLIFY-E2: Ladder preview removed for compact UI
    // Verify template is selected by button state
    const templateBtn = screen.getByTestId('template-top4_unprotected');
    expect(templateBtn).toHaveClass('bg-blue-600');
  });

  // ── Swap flow ──

  it('shows swap type buttons in swap mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    expect(screen.getByText('Most favorable')).toBeInTheDocument();
    expect(screen.getByText('Least favorable')).toBeInTheDocument();
  });

  // ── Pool flow (TM-WIZARD-SIMPLIFY-E2: Pool is Advanced Editor only) ──

  it('shows pool redirect to Advanced view', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_conveyance'));
    // Pool is now advanced-only, shows redirect message in quick-pool-section
    const poolSection = screen.getByTestId('quick-pool-section');
    expect(poolSection).toBeInTheDocument();
    // Verify the Advanced button exists within the pool section context
    expect(screen.getAllByText('Advanced').length).toBeGreaterThanOrEqual(1);
  });

  it.skip('adds picks to pool (TM-WIZARD-SIMPLIFY-E2: pool is Advanced Editor only)', () => {
    // This test is skipped because pool management is now Advanced Editor only
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_conveyance'));
    // Pool UI is no longer on quick screen
  });

  // ── Apply flow ──

  it('calls writer on Apply click when valid', async () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    fireEvent.click(screen.getByTestId('wizard-apply'));
    await waitFor(() => {
      expect(mockWriteWorldEntitlement).toHaveBeenCalledTimes(1);
    });
  });

  // ── Draft flow ──

  it('saves draft on Save Draft click', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    fireEvent.click(screen.getByTestId('wizard-save-draft'));
    const key = `pickrightdraft:world-123:ent:BOS:2027:1:own:abcd1234`;
    const raw = localStorage.getItem(key);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(2);
    expect(parsed.wizardModel).toBeDefined();
    expect(parsed.formState).toBeDefined();
  });

  // ── Advanced editor: internal view toggle (Unified Editor) ──

  it('switches to Advanced view when Advanced button clicked', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    fireEvent.click(screen.getByTestId('wizard-open-advanced'));
    // After clicking Advanced, the view toggle should show Advanced as active
    const advancedToggle = screen.getByTestId('view-toggle-advanced');
    expect(advancedToggle.className).toContain('bg-blue-600');
  });

  // E1.2: Advanced view shows current formState (not stale snapshot)
  it('Advanced view shows current modified formState after user edits in Simple', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    // Modify form: select Protect action and apply a protection template
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    fireEvent.click(screen.getByTestId('template-top4_unprotected'));
    // Switch to Advanced view
    fireEvent.click(screen.getByTestId('wizard-open-advanced'));
    // The Advanced view should be active
    const advancedToggle = screen.getByTestId('view-toggle-advanced');
    expect(advancedToggle.className).toContain('bg-blue-600');
    // The Apply button should still be present (same modal)
    expect(screen.getByTestId('wizard-apply-footer')).toBeTruthy();
  });

  // ── Cancel ──

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<PickRightWizardModal {...defaultCreateProps} onClose={onClose} />);
    const cancelButton = screen.getByTestId('wizard-back');
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Tradability badge (TM-WIZARD-SIMPLIFY-E2: removed from quick screen) ──

  it.skip('shows tradability badge when an action is selected (removed in TM-WIZARD-SIMPLIFY-E2)', () => {
    // Tradability badge removed from quick screen for compact UI
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.queryByTestId('tradability-badge')).not.toBeInTheDocument();
  });

  // ── Validity ──

  it('shows validity indicator in preview', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    const indicators = screen.getAllByTestId('validity-indicator');
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });

  // ── Jargon-free UI ──

  it('does not display schema jargon in Quick Builder', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';

    // These schema terms should NOT appear in Quick Builder
    expect(text).not.toContain('underlyingPickId');
    expect(text).not.toContain('underlyingStatus');
    expect(text).not.toContain('swapControllerPickId');
    expect(text).not.toContain('swapTargetDefinition');
    expect(text).not.toContain('poolUnderlyingPickIds');
    expect(text).not.toContain('receivesComparator');
  });

  // ── Identity lock ──

  // ── TM-WIZARD-UX-E2: Edit mode identity summary (no PickSelector) ──

  it('does NOT show PickSelector in edit mode (TM-WIZARD-UX-E2)', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.queryByTestId('pick-selector')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pick-selector-team')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pick-selector-year')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pick-selector-round')).not.toBeInTheDocument();
  });

  it('shows locked identity summary in edit mode (TM-WIZARD-UX-E2)', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    const summary = screen.getByTestId('edit-identity-summary');
    expect(summary).toBeInTheDocument();
    // Primary line: team + year + round label
    expect(screen.getByTestId('edit-identity-primary').textContent).toContain(
      'BOS'
    );
    expect(screen.getByTestId('edit-identity-primary').textContent).toContain(
      '2027'
    );
    expect(screen.getByTestId('edit-identity-primary').textContent).toContain(
      '1st'
    );
    // Pick ID
    expect(screen.getByTestId('edit-identity-pick-id').textContent).toContain(
      'BOS_2027_1'
    );
    // TM-WIZARD-SIMPLIFY-E2: Removed verbose elements for compact UI
  });

  it('shows PickSelector in create mode (TM-WIZARD-UX-E2)', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByTestId('pick-selector')).toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-identity-summary')
    ).not.toBeInTheDocument();
  });

  // ── TM-WIZARD-SIMPLIFY-E2: Convert to Swap functionality ──

  it('shows Convert to Swap button when editing pick_ownership and selecting Swap', () => {
    const onDuplicateAsNew = vi.fn();
    render(
      <PickRightWizardModal
        {...defaultEditProps}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );
    // Click Swap action
    fireEvent.click(screen.getByTestId('action-create_swap'));
    // Should see Convert to Swap section (not normal swap controls)
    expect(screen.getByTestId('swap-convert-section')).toBeInTheDocument();
    expect(screen.getByTestId('convert-to-swap-btn')).toBeInTheDocument();
    // Should NOT see normal swap direction buttons
    expect(screen.queryByTestId('swap-type-best_of')).not.toBeInTheDocument();
  });

  it('calls onDuplicateAsNew with swap_right document when Convert to Swap clicked', () => {
    const onDuplicateAsNew = vi.fn();
    render(
      <PickRightWizardModal
        {...defaultEditProps}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );
    fireEvent.click(screen.getByTestId('action-create_swap'));
    fireEvent.click(screen.getByTestId('convert-to-swap-btn'));

    expect(onDuplicateAsNew).toHaveBeenCalledTimes(1);
    const calledWith = onDuplicateAsNew.mock.calls[0][0];
    expect(calledWith.kind).toBe('swap_right');
    expect(calledWith.holderTeam).toBe('BOS');
    expect(calledWith.seasonYear).toBe(2027);
    expect(calledWith.round).toBe(1);
    expect(calledWith.swapControllerPickId).toBe('BOS_2027_1');
    expect(calledWith.swapType).toBe('best_of');
  });

  it('does not show Convert to Swap when editing a swap_right entitlement', () => {
    const swapEditProps = {
      ...defaultCreateProps,
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
      onDuplicateAsNew: vi.fn(),
    };
    render(<PickRightWizardModal {...swapEditProps} />);
    // Should already be on swap intent, should see normal swap controls
    expect(screen.queryByTestId('convert-to-swap-btn')).not.toBeInTheDocument();
    expect(screen.getByTestId('swap-type-best_of')).toBeInTheDocument();
  });

  it('original entitlement document is not mutated when Convert to Swap is clicked', () => {
    const onDuplicateAsNew = vi.fn();
    const originalDoc = {
      id: 'ent:BOS:2027:1:own:abcd1234',
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'BOS_2027_1',
      underlyingStatus: 'clean',
      description: 'Boston 2027 1st',
    };
    render(
      <PickRightWizardModal
        {...defaultCreateProps}
        entitlementId="ent:BOS:2027:1:own:abcd1234"
        initialDocument={originalDoc}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );
    fireEvent.click(screen.getByTestId('action-create_swap'));
    fireEvent.click(screen.getByTestId('convert-to-swap-btn'));

    // Original document should be unchanged
    expect(originalDoc.kind).toBe('pick_ownership');
    // New document should be swap_right
    expect(onDuplicateAsNew.mock.calls[0][0].kind).toBe('swap_right');
  });

  // ── TM-WIZARD-SIMPLIFY-E2: No arrow in quick UI ──

  it('does not show arrow (->) in quick UI (TM-WIZARD-SIMPLIFY-E2)', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';
    expect(text).not.toContain('→');
  });

  it('does not show arrow in protect mode quick UI', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';
    expect(text).not.toContain('→');
  });

  it('does not show arrow in swap mode quick UI', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    const container = screen.getByTestId('quick-builder');
    const text = container.textContent || '';
    expect(text).not.toContain('→');
  });
});
