/**
 * FILE: src/tests/architect/vacuumE3.duplicateAsNew.test.tsx
 * PURPOSE: TM-VACUUM-E3 — Duplicate as new button in wizard (vacuum + world modes).
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E3 duplicate flow validation.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock Firebase and dependencies
vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

vi.mock('@/features/architect/utils/entitlements/entitlementWriter', () => ({
  isEntitlementAuthoringEnabled: () => true,
  generateEntitlementId: () => 'ent:BOS:2027:1:own:gen1',
  getEntitlementPath: () => 'test/path',
  validateEntitlementDocument: () => ({ valid: true }),
  writeWorldEntitlement: vi.fn(async () => ({
    success: true,
    path: 'test/path',
  })),
}));

vi.mock(
  '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore',
  () => ({
    applyVacuumEdit: vi.fn(),
    applyVacuumCreate: vi.fn(),
    removeEdit: vi.fn(),
    removeCreate: vi.fn(),
    hasEdit: () => false,
    hasCreate: () => false,
    makeVacuumEntitlementId: () => 'vacuum:BOS:2027:1:own:newid123',
  })
);

vi.mock('@/features/architect/admin/pickRightWizardDraft', () => ({
  saveDraft: vi.fn(),
  loadDraft: () => null,
  clearDraft: vi.fn(),
  hasDraft: () => false,
}));

vi.mock(
  '@/features/architect/admin/PickRightWizardSteps/WizardStepDetails',
  () => ({
    WizardStepDetails: () => <div data-testid="wizard-step-details" />,
  })
);

vi.mock(
  '@/features/architect/admin/PickRightWizardSteps/WizardStepReview',
  () => ({
    WizardStepReview: () => <div data-testid="wizard-step-review" />,
  })
);

vi.mock('@/features/architect/admin/pickEditorCopy', () => ({
  WIZARD_INTENT_LABELS: {
    protect_pick: 'Protect a Pick',
    create_swap: 'Create a Swap Right',
    create_conveyance: 'Create a Conveyance Right',
  },
  WIZARD_LABELS: {
    pickIdentity: 'Pick',
    pickHelp: '',
    otherPick: "Other team's pick",
    swapBestOf: 'Most favorable',
    swapWorstOf: 'Least favorable',
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { PickRightWizardModal } from '@/features/architect/admin/PickRightWizardModal';

afterEach(cleanup);

describe('PickRightWizardModal — Duplicate as new', () => {
  const baseDoc = {
    id: 'ent:BOS:2027:1:own:abc',
    holderTeam: 'BOS',
    seasonYear: 2027,
    round: 1,
    kind: 'pick_ownership',
    description: 'Original pick',
    underlyingPickId: 'pick:BOS:2027:1',
  };

  it('shows Duplicate as new button in edit mode when handler provided', () => {
    const onDuplicateAsNew = vi.fn();
    const { container } = render(
      <PickRightWizardModal
        worldId="world-1"
        entitlementId="ent:BOS:2027:1:own:abc"
        initialDocument={baseDoc}
        userId="user-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );

    const btns = container.querySelectorAll(
      '[data-testid="wizard-duplicate-as-new"]'
    );
    expect(btns.length).toBe(1);
    expect(btns[0].textContent).toBe('Create new from this…');
  });

  it('does NOT show Duplicate as new button in create mode', () => {
    const { container } = render(
      <PickRightWizardModal
        worldId="world-1"
        initialDocument={baseDoc}
        userId="user-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onDuplicateAsNew={vi.fn()}
      />
    );

    // entitlementId is not passed → undefined → isEditMode=false
    const btns = container.querySelectorAll(
      '[data-testid="wizard-duplicate-as-new"]'
    );
    expect(btns.length).toBe(0);
  });

  it('does NOT show Duplicate as new button when handler not provided', () => {
    const { container } = render(
      <PickRightWizardModal
        worldId="world-1"
        entitlementId="ent:BOS:2027:1:own:abc"
        initialDocument={baseDoc}
        userId="user-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    const btns = container.querySelectorAll(
      '[data-testid="wizard-duplicate-as-new"]'
    );
    expect(btns.length).toBe(0);
  });

  it('calls onDuplicateAsNew with document minus id when clicked', () => {
    const onDuplicateAsNew = vi.fn();
    const { container } = render(
      <PickRightWizardModal
        worldId="world-1"
        entitlementId="ent:BOS:2027:1:own:abc"
        initialDocument={baseDoc}
        userId="user-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );

    const btn = container.querySelector(
      '[data-testid="wizard-duplicate-as-new"]'
    );
    expect(btn).toBeTruthy();
    expect(btn).not.toBeNull();
    fireEvent.click(btn!);

    expect(onDuplicateAsNew).toHaveBeenCalledTimes(1);
    const calledWith = onDuplicateAsNew.mock.calls[0][0];
    // Document should NOT contain the original entitlement ID
    expect(calledWith).not.toHaveProperty('id');
    // But should retain the content fields
    expect(calledWith).toHaveProperty('holderTeam', 'BOS');
    expect(calledWith).toHaveProperty('kind', 'pick_ownership');
  });

  it('shows Duplicate as new in vacuum mode edit', () => {
    const onDuplicateAsNew = vi.fn();
    const { container } = render(
      <PickRightWizardModal
        worldId={null}
        entitlementId="ent:BOS:2027:1:own:abc"
        initialDocument={baseDoc}
        userId={null}
        vacuumMode={true}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
        onDuplicateAsNew={onDuplicateAsNew}
      />
    );

    const btns = container.querySelectorAll(
      '[data-testid="wizard-duplicate-as-new"]'
    );
    expect(btns.length).toBe(1);
  });
});
