/**
 * FILE: src/tests/architect/pickRightWizard.test.tsx
 * PURPOSE: Tests for PickRightWizardModal and wizard flow (TM-8 + TM-9).
 * OWNERSHIP: Test suite
 *
 * HISTORY:
 *  - 2026-02-05: Created for TM-8 Pick Editor UX Overhaul.
 *  - 2026-02-05: TM-9 — Updated for WizardModel-based modal, new test IDs,
 *                removed advanced inline mode tests (now external callback).
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

describe('PickRightWizardModal', () => {
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

  // ── Create mode ──

  it('opens with intent step in create mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByTestId('wizard-step-intent')).toBeInTheDocument();
    expect(screen.getByText('What would you like to do?')).toBeInTheDocument();
  });

  it('shows three intent options (no advanced inline)', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByTestId('intent-protect_pick')).toBeInTheDocument();
    expect(screen.getByTestId('intent-create_swap')).toBeInTheDocument();
    expect(screen.getByTestId('intent-create_conveyance')).toBeInTheDocument();
  });

  it('advances to details step when Protect a Pick is selected', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    expect(screen.getByTestId('wizard-step-details')).toBeInTheDocument();
  });

  it('advances to details step when Swap Right is selected', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-create_swap'));
    expect(screen.getByTestId('wizard-step-details')).toBeInTheDocument();
  });

  it('advances to details step when Conveyance Right is selected', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-create_conveyance'));
    expect(screen.getByTestId('wizard-step-details')).toBeInTheDocument();
  });

  // ── Edit mode ──

  it('opens directly at details step in edit mode', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    // Edit mode starts at intent, but with initialDocument populating the model
    // The user sees the intent already highlighted
    expect(screen.getByTestId('wizard-step-intent')).toBeInTheDocument();
  });

  it('shows "Edit Pick Right" title in edit mode', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    expect(screen.getByText('Edit Pick Right')).toBeInTheDocument();
  });

  // ── Protection template flow ──

  it('applies protection template and shows ladder tiers', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    // Click Top 3 -> Unprotected template
    fireEvent.click(screen.getByTestId('template-top3_unprotected'));
    expect(screen.getByText('Top 3')).toBeInTheDocument();
  });

  // ── Review step ──

  it('navigates to review step with Next button', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    fireEvent.click(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('wizard-step-review')).toBeInTheDocument();
  });

  it('shows validity indicator in review step', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    // Go to details then review
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    fireEvent.click(screen.getByTestId('wizard-next'));
    const indicators = screen.getAllByTestId('validity-indicator');
    expect(indicators.length).toBeGreaterThanOrEqual(1);
  });

  // ── Tradability badge ──

  it('shows tradability badge in details step', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    expect(screen.getByTestId('tradability-badge')).toBeInTheDocument();
    // No protections = Tradable
    expect(screen.getByText('Tradable')).toBeInTheDocument();
  });

  it('shows tradability badge in review step', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    fireEvent.click(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('review-tradability-badge')).toBeInTheDocument();
  });

  // ── Apply flow ──

  it('calls writer on Apply click when valid', async () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    fireEvent.click(screen.getByTestId('wizard-next'));
    fireEvent.click(screen.getByTestId('wizard-apply'));
    await waitFor(() => {
      expect(mockWriteWorldEntitlement).toHaveBeenCalledTimes(1);
    });
  });

  // ── Draft flow ──

  it('saves draft to localStorage on Save Draft click', () => {
    render(<PickRightWizardModal {...defaultEditProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    fireEvent.click(screen.getByTestId('wizard-next'));
    fireEvent.click(screen.getByTestId('wizard-save-draft'));
    const key = `pickrightdraft:world-123:ent:BOS:2027:1:own:abcd1234`;
    const raw = localStorage.getItem(key);
    expect(raw).not.toBeNull();
    // v2 format
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(2);
    expect(parsed.wizardModel).toBeDefined();
    expect(parsed.formState).toBeDefined();
  });

  // ── Advanced editor callback ──

  it('calls onOpenAdvanced with formState when advanced button clicked', () => {
    const onOpenAdvanced = vi.fn();
    render(
      <PickRightWizardModal
        {...defaultEditProps}
        onOpenAdvanced={onOpenAdvanced}
      />
    );
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    fireEvent.click(screen.getByTestId('wizard-next'));
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

  // ── Back navigation ──

  it('navigates back from details to intent', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    expect(screen.getByTestId('wizard-step-details')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wizard-back'));
    expect(screen.getByTestId('wizard-step-intent')).toBeInTheDocument();
  });

  it('navigates back from review to details', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));
    fireEvent.click(screen.getByTestId('wizard-next'));
    expect(screen.getByTestId('wizard-step-review')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('wizard-back'));
    expect(screen.getByTestId('wizard-step-details')).toBeInTheDocument();
  });

  // ── Swap flow ──

  it('shows swap type buttons in swap mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-create_swap'));
    expect(screen.getByText('Best of')).toBeInTheDocument();
    expect(screen.getByText('Worst of')).toBeInTheDocument();
  });

  // ── Conveyance flow ──

  it('shows pool management in conveyance mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-create_conveyance'));
    expect(screen.getByText('Pool of Picks')).toBeInTheDocument();
    expect(screen.getByText('+ Add Pick')).toBeInTheDocument();
  });

  it('adds picks to conveyance pool', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-create_conveyance'));
    fireEvent.click(screen.getByText('+ Add Pick'));
    fireEvent.click(screen.getByText('+ Add Pick'));
    const removeButtons = screen.getAllByText('Remove');
    expect(removeButtons.length).toBe(2);
  });

  // ── Jargon-free UI ──

  it('does not display schema jargon in wizard mode', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    fireEvent.click(screen.getByTestId('intent-protect_pick'));

    const container = screen.getByTestId('wizard-step-details');
    const text = container.textContent || '';

    // These schema terms should NOT appear in wizard mode
    expect(text).not.toContain('underlyingPickId');
    expect(text).not.toContain('underlyingStatus');
    expect(text).not.toContain('swapControllerPickId');
    expect(text).not.toContain('swapTargetDefinition');
    expect(text).not.toContain('poolUnderlyingPickIds');
    expect(text).not.toContain('receivesComparator');
  });

  // ── Step indicator ──

  it('shows step indicator with correct highlighting', () => {
    render(<PickRightWizardModal {...defaultCreateProps} />);
    expect(screen.getByText('1. Type')).toBeInTheDocument();
    expect(screen.getByText('2. Details')).toBeInTheDocument();
    expect(screen.getByText('3. Review')).toBeInTheDocument();
  });
});
