/**
 * FILE: src/tests/architect/pickRightWizard.test.tsx
 * PURPOSE: Tests for PickRightWizardModal Quick Builder (TM-WIZARD-SIMPLIFY-E1).
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Updated for WizardModel-based modal.
 *  - 2026-02-13: TM-WIZARD-SIMPLIFY-E1 — Rewritten for Quick Builder single-screen UX.
 *  - 2026-02-13: TM-WIZARD-UX-E2 — Edit mode: PickSelector absent, identity summary present.
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
    expect(screen.getByTestId('quick-builder-preview')).toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-apply-bar')).toBeInTheDocument();
  });

  it('shows controls inline when Swap is selected', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    expect(screen.getByTestId('quick-swap-section')).toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-apply-bar')).toBeInTheDocument();
  });

  it('shows controls inline when Pool is selected', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_conveyance'));
    expect(screen.getByTestId('quick-pool-section')).toBeInTheDocument();
    expect(screen.getByTestId('pool-chips')).toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-apply-bar')).toBeInTheDocument();
  });

  // ── Edit mode ──

  it('opens directly in Quick Builder in edit mode', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.getByTestId('quick-builder')).toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-controls')).toBeInTheDocument();
  });

  it('shows "Edit Pick Right" title in edit mode', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.getByText('Edit Pick Right')).toBeInTheDocument();
  });

  it('hides action cards in edit mode (type is locked)', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(
      screen.queryByTestId('quick-builder-actions')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('quick-builder-active-type')).toBeInTheDocument();
  });

  // ── Protection template flow ──

  it('applies protection template and shows ladder tiers', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-protect_pick'));
    fireEvent.click(screen.getByTestId('template-top4_unprotected'));
    expect(screen.getByText('Top 4')).toBeInTheDocument();
  });

  // ── Swap flow ──

  it('shows swap type buttons in swap mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_swap'));
    expect(screen.getByText('Swap most favorable')).toBeInTheDocument();
    expect(screen.getByText('Swap least favorable')).toBeInTheDocument();
  });

  // ── Pool flow ──

  it('shows pool management and chips in pool mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_conveyance'));
    expect(screen.getByText('Picks in Pool')).toBeInTheDocument();
    expect(screen.getByText('+ Add Pick')).toBeInTheDocument();
  });

  it('adds picks to pool', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('action-create_conveyance'));
    fireEvent.click(screen.getByText('+ Add Pick'));
    fireEvent.click(screen.getByText('+ Add Pick'));
    const removeButtons = screen.getAllByText('✕');
    expect(removeButtons.length).toBe(2);
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

  // ── Advanced editor callback ──

  it('calls onOpenAdvanced when Advanced Editor button clicked', () => {
    const onOpenAdvanced = vi.fn();
    render(
      <PickRightWizardModal
        {...defaultEditProps}
        onOpenAdvanced={onOpenAdvanced}
      />
    );
    fireEvent.click(screen.getByTestId('wizard-open-advanced'));
    expect(onOpenAdvanced).toHaveBeenCalledTimes(1);
    expect(onOpenAdvanced.mock.calls[0][0]).toHaveProperty(
      'kind',
      'pick_ownership'
    );
  });

  // ── Cancel ──

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<PickRightWizardModal {...defaultCreateProps} onClose={onClose} />);
    const cancelButton = screen.getByTestId('wizard-back');
    fireEvent.click(cancelButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Tradability badge ──

  it('shows tradability badge when an action is selected', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.getByTestId('tradability-badge')).toBeInTheDocument();
    expect(screen.getByText('Tradable')).toBeInTheDocument();
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
    // Owner line
    expect(screen.getByTestId('edit-identity-owner').textContent).toContain(
      'Owner:'
    );
    expect(screen.getByTestId('edit-identity-owner').textContent).toContain(
      'BOS'
    );
    // Pick ID
    expect(screen.getByTestId('edit-identity-pick-id').textContent).toContain(
      'BOS_2027_1'
    );
    // Helper copy
    expect(
      screen.getByText(
        'To change the pick itself or type, create a new pick right.'
      )
    ).toBeInTheDocument();
  });

  it('shows PickSelector in create mode (TM-WIZARD-UX-E2)', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByTestId('pick-selector')).toBeInTheDocument();
    expect(
      screen.queryByTestId('edit-identity-summary')
    ).not.toBeInTheDocument();
  });
});
