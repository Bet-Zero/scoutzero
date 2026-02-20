/**
 * FILE: src/tests/architect/entitlementIdentityLock.test.tsx
 * PURPOSE: TM-ENTITLEMENT-IDENTITY-LOCK — Validate that identity fields are
 *          locked in edit mode, "Create new from this…" switches to create mode,
 *          and detail fields persist through the duplicate action.
 *
 * HISTORY:
 *  - 2026-02-20: Created for TM-ENTITLEMENT-IDENTITY-LOCK execution.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { PickRightWizardModal } from '@/features/architect/admin/PickRightWizardModal';

afterEach(cleanup);

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseDoc = {
  id: 'ent:BOS:2027:1:own:abc',
  holderTeam: 'BOS',
  seasonYear: 2027,
  round: 1,
  kind: 'pick_ownership',
  description: 'Top-3 protected pick',
  underlyingPickId: 'pick:BOS:2027:1',
  protectionLadder: [
    { year: 2027, condition: 'Top 3', ifTriggered: 'roll', rollToYear: 2028 },
  ],
};

const swapDoc = {
  id: 'ent:BOS:2027:1:swap:def',
  holderTeam: 'BOS',
  seasonYear: 2027,
  round: 1,
  kind: 'swap_right',
  description: 'Swap right with LAL',
  swapControllerPickId: 'pick:LAL:2027:1',
  swapTargetDefinition: 'LAL own 1st round pick',
  swapType: 'best_of',
};

const defaultEditProps = {
  worldId: 'world-1',
  entitlementId: 'ent:BOS:2027:1:own:abc',
  initialDocument: baseDoc,
  userId: 'user-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  onDuplicateAsNew: vi.fn(),
};

const defaultCreateProps = {
  worldId: 'world-1',
  initialDocument: baseDoc,
  userId: 'user-1',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
  onDuplicateAsNew: vi.fn(),
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('TM-ENTITLEMENT-IDENTITY-LOCK', () => {
  describe('R1 — Identity fields locked in edit mode (Simple view)', () => {
    it('shows locked identity summary with lock icon in Simple view', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      const summary = container.querySelector(
        '[data-testid="edit-identity-summary"]'
      );
      expect(summary).toBeTruthy();
      // Should show team/year/round info
      expect(summary!.textContent).toContain('BOS');
      expect(summary!.textContent).toContain('2027');
      // Lock icon
      expect(summary!.textContent).toContain('🔒');
    });

    it('shows helper text about "Create new from this…" in Simple view', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      const hint = container.querySelector(
        '[data-testid="identity-lock-hint"]'
      );
      expect(hint).toBeTruthy();
      expect(hint!.textContent).toContain('Create new from this');
    });

    it('does NOT show PickSelector in Simple view when editing', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      // PickSelector has data-testid="pick-selector" — should not be present
      const pickSelectors = container.querySelectorAll(
        '[data-testid="pick-selector"]'
      );
      expect(pickSelectors.length).toBe(0);
    });
  });

  describe('R1 — Identity fields locked in edit mode (Advanced view)', () => {
    it('disables identity fields in Basics tab when editing', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      // Switch to Advanced view
      const advBtn = container.querySelector(
        '[data-testid="view-toggle-advanced"]'
      );
      expect(advBtn).toBeTruthy();
      fireEvent.click(advBtn!);

      // Identity fields should be disabled: holderTeam, seasonYear, round, kind, underlyingPickId
      const holderTeam = container.querySelector(
        '#entitlement-holderTeam'
      ) as HTMLInputElement;
      const seasonYear = container.querySelector(
        '#entitlement-seasonYear'
      ) as HTMLInputElement;
      const round = container.querySelector(
        '#entitlement-round'
      ) as HTMLSelectElement;
      const kind = container.querySelector(
        '#entitlement-kind'
      ) as HTMLSelectElement;
      const underlyingPickId = container.querySelector(
        '#entitlement-underlyingPickId'
      ) as HTMLInputElement;

      expect(holderTeam).toBeTruthy();
      expect(holderTeam.disabled).toBe(true);
      expect(seasonYear.disabled).toBe(true);
      expect(round.disabled).toBe(true);
      expect(kind.disabled).toBe(true);
      expect(underlyingPickId.disabled).toBe(true);
    });

    it('shows identity lock notice in Basics tab when editing', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      // Switch to Advanced view
      fireEvent.click(
        container.querySelector('[data-testid="view-toggle-advanced"]')!
      );

      const notice = container.querySelector(
        '[data-testid="identity-lock-notice"]'
      );
      expect(notice).toBeTruthy();
      expect(notice!.textContent).toContain('Create new from this');
    });

    it('disables swap identity fields in Swap tab when editing', () => {
      const swapProps = {
        ...defaultEditProps,
        entitlementId: 'ent:BOS:2027:1:swap:def',
        initialDocument: swapDoc,
      };
      const { container } = render(<PickRightWizardModal {...swapProps} />);

      // Switch to Advanced
      fireEvent.click(
        container.querySelector('[data-testid="view-toggle-advanced"]')!
      );

      // Click Swap tab
      const tabButtons = container.querySelectorAll(
        '.flex.flex-wrap.gap-3 button'
      );
      const swapTab = Array.from(tabButtons).find((b) =>
        b.textContent?.includes('Swap')
      );
      expect(swapTab).toBeTruthy();
      fireEvent.click(swapTab!);

      // swapControllerPickId and swapTargetDefinition should be disabled
      const controllerField = container.querySelector(
        '#entitlement-swapControllerPickId'
      ) as HTMLInputElement;
      const targetField = container.querySelector(
        '#entitlement-swapTargetDefinition'
      ) as HTMLTextAreaElement;

      expect(controllerField).toBeTruthy();
      expect(controllerField.disabled).toBe(true);
      expect(targetField).toBeTruthy();
      expect(targetField.disabled).toBe(true);
    });

    it('keeps detail fields (description) editable in Basics tab during edit', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      // Switch to Advanced
      fireEvent.click(
        container.querySelector('[data-testid="view-toggle-advanced"]')!
      );

      const descField = container.querySelector(
        '#entitlement-description'
      ) as HTMLInputElement;
      expect(descField).toBeTruthy();
      expect(descField.disabled).toBe(false);
    });
  });

  describe('R1 — Identity fields editable in create mode', () => {
    it('shows PickSelector in Simple view when creating (no entitlementId)', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultCreateProps} />
      );

      // In create mode, PickSelector should be present (no locked summary)
      const summary = container.querySelector(
        '[data-testid="edit-identity-summary"]'
      );
      expect(summary).toBeNull();
    });

    it('identity fields are enabled in Basics tab during create', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultCreateProps} />
      );

      // Switch to Advanced
      fireEvent.click(
        container.querySelector('[data-testid="view-toggle-advanced"]')!
      );

      const holderTeam = container.querySelector(
        '#entitlement-holderTeam'
      ) as HTMLInputElement;
      const seasonYear = container.querySelector(
        '#entitlement-seasonYear'
      ) as HTMLInputElement;
      const round = container.querySelector(
        '#entitlement-round'
      ) as HTMLSelectElement;
      const kind = container.querySelector(
        '#entitlement-kind'
      ) as HTMLSelectElement;

      expect(holderTeam.disabled).toBe(false);
      expect(seasonYear.disabled).toBe(false);
      expect(round.disabled).toBe(false);
      expect(kind.disabled).toBe(false);
    });

    it('does NOT show identity lock notice in create mode', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultCreateProps} />
      );

      // Switch to Advanced
      fireEvent.click(
        container.querySelector('[data-testid="view-toggle-advanced"]')!
      );

      const notice = container.querySelector(
        '[data-testid="identity-lock-notice"]'
      );
      expect(notice).toBeNull();
    });
  });

  describe('R2 — "Create new from this…" action', () => {
    it('shows "Create new from this…" button in edit mode', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      const btn = container.querySelector(
        '[data-testid="wizard-duplicate-as-new"]'
      );
      expect(btn).toBeTruthy();
      expect(btn!.textContent).toContain('Create new from this');
    });

    it('"Create new from this…" calls onDuplicateAsNew with id stripped', () => {
      const onDuplicateAsNew = vi.fn();
      const { container } = render(
        <PickRightWizardModal
          {...defaultEditProps}
          onDuplicateAsNew={onDuplicateAsNew}
        />
      );

      const btn = container.querySelector(
        '[data-testid="wizard-duplicate-as-new"]'
      );
      fireEvent.click(btn!);

      expect(onDuplicateAsNew).toHaveBeenCalledTimes(1);
      const doc = onDuplicateAsNew.mock.calls[0][0];
      // Must NOT contain original ID
      expect(doc).not.toHaveProperty('id');
      // Must retain detail fields
      expect(doc).toHaveProperty('holderTeam', 'BOS');
      expect(doc).toHaveProperty('kind', 'pick_ownership');
      expect(doc).toHaveProperty('description');
    });

    it('detail fields persist through the duplicate action', () => {
      const receivedDoc: Record<string, unknown>[] = [];
      const onDuplicateAsNew = vi.fn((doc) => receivedDoc.push(doc));

      const { container } = render(
        <PickRightWizardModal
          {...defaultEditProps}
          onDuplicateAsNew={onDuplicateAsNew}
        />
      );

      fireEvent.click(
        container.querySelector('[data-testid="wizard-duplicate-as-new"]')!
      );

      const doc = receivedDoc[0];
      // Detail fields should persist
      expect(doc.holderTeam).toBe('BOS');
      expect(doc.seasonYear).toBe(2027);
      expect(doc.round).toBe(1);
      expect(doc.kind).toBe('pick_ownership');
      // Protection ladder persists
      expect(doc.protectionLadder).toBeDefined();
    });

    it('does NOT show "Create new from this…" in create mode', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultCreateProps} />
      );

      const btn = container.querySelector(
        '[data-testid="wizard-duplicate-as-new"]'
      );
      expect(btn).toBeNull();
    });
  });

  describe('R3 — IDs are invisible', () => {
    it('does not show raw entitlement ID field in Basics tab', () => {
      const { container } = render(
        <PickRightWizardModal {...defaultEditProps} />
      );

      // Switch to Advanced view
      fireEvent.click(
        container.querySelector('[data-testid="view-toggle-advanced"]')!
      );

      // The old "Entitlement ID (read-only)" field should be gone
      const idField = container.querySelector('#entitlement-id');
      expect(idField).toBeNull();
    });
  });
});
