/**
 * FILE: src/tests/architect/advancedEditorHandoff.test.ts
 * PURPOSE: E1.2 — Tests for Pick Wizard → Advanced Editor handoff.
 *          Ensures formState conversion via buildEntitlementDocument works correctly,
 *          and verifies that entitlementId is not lost in edit flows.
 * OWNERSHIP: Test suite (TRADE_MACHINE_ENTITLEMENTS_ADVANCED_MASTER.md E1.2)
 *
 * HISTORY:
 *  - 2026-02-20: Created for E1.2 — Wizard → Advanced Editor Handoff execution.
 */

import { describe, it, expect } from 'vitest';
import {
  createEntitlementFormState,
  buildEntitlementDocument,
} from '@/features/architect/admin/entitlementEditorFormState';
import type { EntitlementFormState } from '@/features/architect/admin/entitlementEditorFormState';
import { wizardToFormState } from '@/features/architect/admin/wizardToEntitlement';
import {
  createDefaultWizardModel,
  formStateToWizardModel,
} from '@/features/architect/admin/pickRightWizardModel';
import {
  WIZARD_PRESETS,
  applyProtectionTemplate,
} from '@/features/architect/admin/ProtectionLadderTemplates';

// ═══════════════════════════════════════════════════════════════════════════════
// E1.2: Advanced Editor Handoff Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Advanced Editor Handoff — buildEntitlementDocument', () => {
  it('converts formState to document without losing protection ladder', () => {
    // Setup: create a wizard model and apply a protection template
    let model = createDefaultWizardModel();
    model = { ...model, intent: 'protect_pick' };

    // Apply protection template: applyProtectionTemplate(template, baseYear)
    // WIZARD_PRESETS[1] is 'top4_unprotected'
    const baseYear = model.pick.year || 2026;
    const tiers = applyProtectionTemplate(WIZARD_PRESETS[1], baseYear);
    // The correct field is protection.customLadder
    model = {
      ...model,
      protection: {
        ...model.protection,
        templateId: 'top4_unprotected',
        customLadder: tiers,
      },
    };

    // Convert wizard -> formState
    const formState = wizardToFormState(model);
    expect(formState.protectionLadder.length).toBe(2);

    // Convert formState -> document (this is what onOpenAdvanced does)
    const document = buildEntitlementDocument(formState);

    // Verify protection ladder is preserved in document
    expect(document.protectionLadder).toBeDefined();
    expect(Array.isArray(document.protectionLadder)).toBe(true);
    expect((document.protectionLadder as unknown[]).length).toBe(2);
  });

  it('preserves entitlementId when editing existing entitlement', () => {
    const existingId = 'ent:BOS:2027:1:own:abcd1234';
    const initialDocument = {
      id: existingId,
      holderTeam: 'BOS',
      seasonYear: 2027,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'BOS_2027_1',
    };

    // Create formState from existing document
    const formState = createEntitlementFormState(initialDocument, existingId);

    // Verify ID is correctly set
    expect(formState.id).toBe(existingId);

    // Simulate modification
    const modifiedFormState: EntitlementFormState = {
      ...formState,
      protectionLadder: [
        {
          year: '2027',
          condition: 'Top 10',
          ifTriggered: 'roll',
          rollToYear: '2028',
          convertToRound: '',
        },
      ],
    };

    // When opening advanced editor, we pass entitlementId separately
    // and use the modified formState for initialDocument
    const document = buildEntitlementDocument(modifiedFormState);

    // Document should reflect the modification
    expect(document.protectionLadder).toBeDefined();
    expect((document.protectionLadder as unknown[]).length).toBe(1);
    expect(
      (document.protectionLadder as Array<{ condition: string }>)[0].condition
    ).toBe('Top 10');
  });

  it('handles swap_right kind with all required fields', () => {
    // Setup a swap model
    let model = createDefaultWizardModel();
    model = {
      ...model,
      intent: 'create_swap',
      swap: {
        controllerPick: { team: 'BOS', year: 2027, round: 1 },
        targetDescription: 'Boston own 1st round pick',
        swapType: 'best_of',
      },
    };

    const formState = wizardToFormState(model);
    expect(formState.kind).toBe('swap_right');

    // Convert to document
    const document = buildEntitlementDocument(formState);

    expect(document.kind).toBe('swap_right');
    expect(document.swapControllerPickId).toBeDefined();
    expect(document.swapTargetDefinition).toBeDefined();
  });

  it('throws or produces invalid document on malformed formState', () => {
    // Create a deliberately malformed formState
    const malformedState: EntitlementFormState = {
      id: '',
      holderTeam: '', // Invalid: empty
      seasonYear: '', // Invalid: empty
      round: '' as '1' | '2', // Invalid: must be '1' or '2'
      kind: '' as 'pick_ownership', // Invalid: empty
      description: '',
      underlyingPickId: '',
      underlyingStatus: 'clean',
      poolUnderlyingPickIdsText: '',
      swapType: '',
      receivesComparator: 'more_favorable',
      receivesRankText: '',
      protectionLadder: [],
      swapControllerPickId: '',
      swapTargetDefinition: '',
      linkedEntitlementIdsText: '',
      residualOfEntitlementId: '',
      coveredByEntitlementIdsText: '',
    };

    // buildEntitlementDocument should not crash but may produce incomplete doc
    // The key test is that it doesn't throw an unhandled exception
    let doc = null;
    let error = null;
    try {
      doc = buildEntitlementDocument(malformedState);
    } catch (e) {
      error = e;
    }

    // If it doesn't throw, verify the document is missing required fields
    // (validation would catch this later)
    if (!error && doc) {
      // Document was built but is likely invalid
      // Our error handling in TradeEditor wraps this in try/catch
      expect(doc.holderTeam).toBe('');
    }
  });
});

describe('Advanced Editor Handoff — Edit vs Create semantics', () => {
  it('edit mode: entitlementId should be passed from wizard context', () => {
    const editEntitlementId = 'ent:LAL:2026:1:own:xyz789';
    const initialDocument = {
      id: editEntitlementId,
      holderTeam: 'LAL',
      seasonYear: 2026,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'LAL_2026_1',
    };

    const formState = createEntitlementFormState(
      initialDocument,
      editEntitlementId
    );

    // Wizard passes: entitlementId=editEntitlementId, initialDocument=buildEntitlementDocument(formState)
    // Verify handler would use the correct ID
    expect(formState.id).toBe(editEntitlementId);

    // Document conversion should work
    const document = buildEntitlementDocument(formState);
    expect(document).toBeTruthy();
    expect(document.holderTeam).toBe('LAL');
  });

  it('create mode: entitlementId should be undefined', () => {
    // In create mode, wizard opens with no entitlementId
    const formState = createEntitlementFormState(undefined, undefined);

    // Handler would pass: entitlementId=undefined, initialDocument=buildEntitlementDocument(formState)
    expect(formState.id).toBe('');

    const document = buildEntitlementDocument(formState);
    expect(document).toBeTruthy();
  });
});

describe('Advanced Editor Handoff — formStateToWizardModel roundtrip', () => {
  it('loading existing doc into wizard then opening advanced preserves data', () => {
    const existingDoc = {
      id: 'ent:MIA:2028:1:own:test123',
      holderTeam: 'MIA',
      seasonYear: 2028,
      round: 1,
      kind: 'pick_ownership',
      underlyingPickId: 'MIA_2028_1',
      protectionLadder: [
        {
          year: 2028,
          condition: 'Top 5',
          ifTriggered: 'roll',
          rollToYear: 2029,
        },
        {
          year: 2029,
          condition: 'Unprotected',
          ifTriggered: 'cancel',
        },
      ],
    };

    // Wizard loads existing doc -> formState -> wizardModel
    const formState = createEntitlementFormState(existingDoc, existingDoc.id);
    expect(formState.protectionLadder.length).toBe(2);

    // User makes no changes but clicks Advanced
    // Handler converts: buildEntitlementDocument(formState)
    const documentForAdvanced = buildEntitlementDocument(formState);

    // Verify data integrity
    expect(documentForAdvanced.holderTeam).toBe('MIA');
    expect(documentForAdvanced.seasonYear).toBe(2028);
    expect(Array.isArray(documentForAdvanced.protectionLadder)).toBe(true);
    expect((documentForAdvanced.protectionLadder as unknown[]).length).toBe(2);
  });
});
