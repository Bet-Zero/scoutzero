/**
 * FILE: src/tests/architect/wizardTranslation.test.ts
 * PURPOSE: TM-9 — Tests for the wizard translation layer, WizardModel, draft handling,
 *          and jargon-free copy. Pure unit tests, no React rendering.
 * OWNERSHIP: Test suite (TM-9 Wizard Translation Layer)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createDefaultWizardModel,
  createDefaultWizardPick,
  formStateToWizardModel,
  wizardPickToId,
  pickIdToWizardPick,
} from '@/features/architect/admin/pickRightWizardModel';
import type { WizardModel } from '@/features/architect/admin/pickRightWizardModel';
import {
  wizardToFormState,
  wizardToDocument,
  validateWizardModel,
} from '@/features/architect/admin/wizardToEntitlement';
import { validateEntitlementDocument } from '@/features/architect/utils/entitlements/entitlementWriter';
import { buildEntitlementDocument } from '@/features/architect/admin/entitlementEditorFormState';
import type { EntitlementFormState } from '@/features/architect/admin/entitlementEditorFormState';
import {
  deriveTradabilityStatus,
  WIZARD_LABELS,
  WIZARD_STATUS_LABELS,
  WIZARD_KIND_LABELS,
  WIZARD_INTENT_LABELS,
  WIZARD_COMPARATOR_LABELS,
  JARGON_GLOSSARY,
  SELECTION_METHOD_OPTIONS,
} from '@/features/architect/admin/pickEditorCopy';
import {
  WIZARD_PRESETS,
  applyProtectionTemplate,
} from '@/features/architect/admin/ProtectionLadderTemplates';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
} from '@/features/architect/admin/pickRightWizardDraft';
import type { LoadedDraft } from '@/features/architect/admin/pickRightWizardDraft';

// ═══════════════════════════════════════════════════════════════════════════════
// 1. WizardModel factories & helpers
// ═══════════════════════════════════════════════════════════════════════════════

describe('WizardModel factories', () => {
  it('creates a default WizardModel with empty intent', () => {
    const model = createDefaultWizardModel();
    expect(model.intent).toBe('');
    expect(model.pick.team).toBe('LAL');
    expect(model.pick.year).toBe(2026);
    expect(model.pick.round).toBe(1);
  });

  it('accepts overrides', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
    });
    expect(model.intent).toBe('protect_pick');
    expect(model.pick.team).toBe('BOS');
  });

  it('creates a default WizardPick', () => {
    const pick = createDefaultWizardPick('PHI', 2028, 2);
    expect(pick.team).toBe('PHI');
    expect(pick.year).toBe(2028);
    expect(pick.round).toBe(2);
  });
});

describe('wizardPickToId / pickIdToWizardPick', () => {
  it('converts WizardPick to canonical pick ID', () => {
    expect(wizardPickToId({ team: 'BOS', year: 2027, round: 1 })).toBe(
      'BOS_2027_1'
    );
    expect(wizardPickToId({ team: 'LAL', year: 2028, round: 2 })).toBe(
      'LAL_2028_2'
    );
  });

  it('parses canonical pick ID back to WizardPick', () => {
    const pick = pickIdToWizardPick('BOS_2027_1');
    expect(pick.team).toBe('BOS');
    expect(pick.year).toBe(2027);
    expect(pick.round).toBe(1);
  });

  it('uses fallback for invalid pick ID', () => {
    const pick = pickIdToWizardPick('invalid', {
      team: 'PHI',
      year: 2028,
      round: 2,
    });
    expect(pick.team).toBe('PHI');
    expect(pick.year).toBe(2028);
    expect(pick.round).toBe(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. Translation layer: wizardToFormState
// ═══════════════════════════════════════════════════════════════════════════════

describe('wizardToFormState', () => {
  it('translates protect_pick → pick_ownership formState', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
    });

    const fs = wizardToFormState(model);

    expect(fs.kind).toBe('pick_ownership');
    expect(fs.holderTeam).toBe('BOS');
    expect(fs.seasonYear).toBe('2027');
    expect(fs.round).toBe('1');
    expect(fs.underlyingPickId).toBe('BOS_2027_1');
    expect(fs.underlyingStatus).toBe('clean');
  });

  it('sets underlyingStatus to "encumbered" when protections exist', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
      protection: {
        templateId: 'top3_unprotected',
        customLadder: [
          {
            year: '2027',
            condition: 'Top 3',
            ifTriggered: 'roll',
            rollToYear: '2028',
            convertToRound: '',
          },
          {
            year: '2028',
            condition: '',
            ifTriggered: 'cancel',
            rollToYear: '',
            convertToRound: '',
          },
        ],
      },
    });

    const fs = wizardToFormState(model);

    expect(fs.underlyingStatus).toBe('encumbered');
    expect(fs.protectionLadder).toHaveLength(2);
  });

  it('translates create_swap → swap_right formState', () => {
    const model = createDefaultWizardModel({
      intent: 'create_swap',
      pick: { team: 'BOS', year: 2027, round: 1 },
      swap: {
        swapType: 'best_of',
        controllerPick: { team: 'PHI', year: 2027, round: 1 },
        targetDescription: 'PHI own 1st round pick',
      },
    });

    const fs = wizardToFormState(model);

    expect(fs.kind).toBe('swap_right');
    expect(fs.swapType).toBe('best_of');
    expect(fs.swapControllerPickId).toBe('PHI_2027_1');
    expect(fs.swapTargetDefinition).toBe('PHI own 1st round pick');
  });

  it('translates create_conveyance → conveyance_right formState', () => {
    const model = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'BOS', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'PHI', year: 2027, round: 1 },
        ],
        selectionMethod: 'most_favorable',
        selectionRanks: [1],
      },
    });

    const fs = wizardToFormState(model);

    expect(fs.kind).toBe('conveyance_right');
    expect(fs.poolUnderlyingPickIdsText).toBe('BOS_2027_1\nPHI_2027_1');
    expect(fs.receivesComparator).toBe('more_favorable');
    expect(fs.receivesRankText).toBe('1');
  });

  it('maps selection methods correctly', () => {
    const base = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'BOS', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'PHI', year: 2027, round: 1 },
        ],
        selectionMethod: 'least_favorable',
        selectionRanks: [1],
      },
    });

    expect(wizardToFormState(base).receivesComparator).toBe('less_favorable');

    base.conveyance.selectionMethod = 'middle';
    expect(wizardToFormState(base).receivesComparator).toBe('middle');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. Translation validity: WizardModel → formState → document passes validation
// ═══════════════════════════════════════════════════════════════════════════════

describe('Translation → Validation pipeline', () => {
  it('protect_pick produces a valid document', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
    });

    const result = validateWizardModel(model);
    expect(result.valid).toBe(true);
  });

  it('create_swap produces a valid document', () => {
    const model = createDefaultWizardModel({
      intent: 'create_swap',
      pick: { team: 'BOS', year: 2027, round: 1 },
      swap: {
        swapType: 'best_of',
        controllerPick: { team: 'PHI', year: 2027, round: 1 },
        targetDescription: 'PHI own 1st round',
      },
    });

    const result = validateWizardModel(model);
    expect(result.valid).toBe(true);
  });

  it('create_conveyance produces a valid document', () => {
    const model = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'BOS', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'PHI', year: 2027, round: 1 },
        ],
        selectionMethod: 'most_favorable',
        selectionRanks: [1],
      },
    });

    const result = validateWizardModel(model);
    expect(result.valid).toBe(true);
  });

  it('wizardToDocument matches buildEntitlementDocument(wizardToFormState())', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
    });

    const viaDirect = wizardToDocument(model);
    const viaFormState = buildEntitlementDocument(wizardToFormState(model));

    expect(viaDirect).toEqual(viaFormState);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. Round-trip: WizardModel → formState → formStateToWizardModel
// ═══════════════════════════════════════════════════════════════════════════════

describe('Round-trip: WizardModel ↔ FormState', () => {
  it('protect_pick round-trips correctly', () => {
    const original = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
      description: 'Test description',
    });

    const fs = wizardToFormState(original);
    const restored = formStateToWizardModel(fs);

    expect(restored).not.toBeNull();
    expect(restored!.intent).toBe('protect_pick');
    expect(restored!.pick.team).toBe('BOS');
    expect(restored!.pick.year).toBe(2027);
    expect(restored!.pick.round).toBe(1);
    expect(restored!.description).toBe('Test description');
  });

  it('create_swap round-trips correctly', () => {
    const original = createDefaultWizardModel({
      intent: 'create_swap',
      pick: { team: 'BOS', year: 2027, round: 1 },
      swap: {
        swapType: 'worst_of',
        controllerPick: { team: 'PHI', year: 2027, round: 1 },
        targetDescription: 'PHI own pick',
      },
    });

    const fs = wizardToFormState(original);
    const restored = formStateToWizardModel(fs);

    expect(restored).not.toBeNull();
    expect(restored!.intent).toBe('create_swap');
    expect(restored!.swap.swapType).toBe('worst_of');
    expect(restored!.swap.controllerPick.team).toBe('PHI');
    expect(restored!.swap.targetDescription).toBe('PHI own pick');
  });

  it('create_conveyance round-trips correctly', () => {
    const original = createDefaultWizardModel({
      intent: 'create_conveyance',
      pick: { team: 'BOS', year: 2027, round: 1 },
      conveyance: {
        poolPicks: [
          { team: 'BOS', year: 2027, round: 1 },
          { team: 'PHI', year: 2027, round: 1 },
        ],
        selectionMethod: 'least_favorable',
        selectionRanks: [1, 2],
      },
    });

    const fs = wizardToFormState(original);
    const restored = formStateToWizardModel(fs);

    expect(restored).not.toBeNull();
    expect(restored!.intent).toBe('create_conveyance');
    expect(restored!.conveyance.poolPicks).toHaveLength(2);
    expect(restored!.conveyance.selectionMethod).toBe('least_favorable');
    expect(restored!.conveyance.selectionRanks).toEqual([1, 2]);
  });

  it('returns null for empty kind', () => {
    const fs = wizardToFormState(createDefaultWizardModel());
    const restored = formStateToWizardModel(fs);
    expect(restored).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. Tradability badge
// ═══════════════════════════════════════════════════════════════════════════════

describe('deriveTradabilityStatus', () => {
  it('returns "Unknown" for empty intent', () => {
    const model = createDefaultWizardModel();
    const badge = deriveTradabilityStatus(model);
    expect(badge.variant).toBe('amber');
    expect(badge.label).toBe('Unknown');
  });

  it('returns "Tradable" for protect_pick with no protections', () => {
    const model = createDefaultWizardModel({ intent: 'protect_pick' });
    const badge = deriveTradabilityStatus(model);
    expect(badge.variant).toBe('green');
    expect(badge.label).toBe('Tradable');
  });

  it('returns "Tradable with restriction" for protect_pick with protections', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      protection: {
        templateId: 'test',
        customLadder: [
          {
            year: '2027',
            condition: 'Top 3',
            ifTriggered: 'roll',
            rollToYear: '2028',
            convertToRound: '',
          },
        ],
      },
    });
    const badge = deriveTradabilityStatus(model);
    expect(badge.variant).toBe('amber');
    expect(badge.label).toBe('Tradable with restriction');
  });

  it('returns "Tradable with restriction" for swap', () => {
    const model = createDefaultWizardModel({ intent: 'create_swap' });
    const badge = deriveTradabilityStatus(model);
    expect(badge.variant).toBe('amber');
  });

  it('returns "Tradable with restriction" for conveyance', () => {
    const model = createDefaultWizardModel({ intent: 'create_conveyance' });
    const badge = deriveTradabilityStatus(model);
    expect(badge.variant).toBe('amber');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. UI copy — jargon-free labels
// ═══════════════════════════════════════════════════════════════════════════════

describe('UI copy — jargon-free labels', () => {
  it('WIZARD_LABELS contains no schema jargon', () => {
    const jargonTerms = [
      'underlying',
      'underlyingPickId',
      'underlyingStatus',
      'swapControllerPickId',
      'swapTargetDefinition',
      'poolUnderlyingPickIds',
      'receivesComparator',
      'receivesRank',
      'encumbered',
    ];
    const allValues = Object.values(WIZARD_LABELS).join(' ');
    for (const term of jargonTerms) {
      expect(allValues.toLowerCase()).not.toContain(term.toLowerCase());
    }
  });

  it('WIZARD_STATUS_LABELS maps "clean" to "Tradable"', () => {
    expect(WIZARD_STATUS_LABELS.clean).toBe('Tradable');
    expect(WIZARD_STATUS_LABELS.encumbered).toBe('Restricted');
    expect(WIZARD_STATUS_LABELS.pooled).toBe('Part of a pool');
  });

  it('WIZARD_KIND_LABELS are user-friendly', () => {
    expect(WIZARD_KIND_LABELS.pick_ownership).toBe('Protection');
    expect(WIZARD_KIND_LABELS.swap_right).toBe('Swap');
    expect(WIZARD_KIND_LABELS.conveyance_right).toBe('Pool');
  });

  it('WIZARD_INTENT_LABELS use action verbs', () => {
    expect(WIZARD_INTENT_LABELS.protect_pick).toContain('Protect');
    expect(WIZARD_INTENT_LABELS.create_swap).toContain('Swap');
    expect(WIZARD_INTENT_LABELS.create_conveyance).toContain('Pool');
  });

  it('SELECTION_METHOD_OPTIONS provides 3 user-friendly choices', () => {
    expect(SELECTION_METHOD_OPTIONS).toHaveLength(3);
    const labels = SELECTION_METHOD_OPTIONS.map((o) => o.label);
    expect(labels).toContain('Best (most favorable)');
    expect(labels).toContain('Worst (least favorable)');
    expect(labels).toContain('Middle');
  });

  it('JARGON_GLOSSARY covers all schema terms', () => {
    const schemaTerms = [
      'underlyingPickId',
      'underlyingStatus',
      'swapControllerPickId',
      'swapTargetDefinition',
      'poolUnderlyingPickIds',
      'receivesRank',
      'receivesComparator',
      'protectionLadder',
      'encumbered',
      'clean',
    ];
    for (const term of schemaTerms) {
      expect(JARGON_GLOSSARY).toHaveProperty(term);
      expect(JARGON_GLOSSARY[term].length).toBeGreaterThan(10);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. Draft handling — v2 format
// ═══════════════════════════════════════════════════════════════════════════════

describe('Draft handling (v2 envelope)', () => {
  const worldId = 'test-world';
  const draftId = 'test-ent';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('saveDraft stores v2 envelope', () => {
    const model = createDefaultWizardModel({ intent: 'protect_pick' });
    const fs = wizardToFormState(model);

    saveDraft(worldId, draftId, model, fs);

    const raw = localStorage.getItem(`pickrightdraft:${worldId}:${draftId}`);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.version).toBe(2);
    expect(parsed.wizardModel.intent).toBe('protect_pick');
    expect(parsed.formState.kind).toBe('pick_ownership');
  });

  it('loadDraft returns v2 shape with wizardModel key', () => {
    const model = createDefaultWizardModel({ intent: 'create_swap' });
    const fs = wizardToFormState(model);
    saveDraft(worldId, draftId, model, fs);

    const loaded = loadDraft(worldId, draftId);
    expect(loaded).not.toBeNull();
    expect('wizardModel' in loaded!).toBe(true);

    const v2 = loaded as {
      wizardModel: WizardModel;
      formState: EntitlementFormState;
    };
    expect(v2.wizardModel.intent).toBe('create_swap');
    expect(v2.formState.kind).toBe('swap_right');
  });

  it('loadDraft handles v1 (legacy) format', () => {
    // Simulate a v1 draft — raw EntitlementFormState JSON
    const v1Data: EntitlementFormState = {
      id: '',
      holderTeam: 'BOS',
      seasonYear: '2027',
      round: '1',
      kind: 'pick_ownership',
      description: '',
      underlyingPickId: 'BOS_2027_1',
      underlyingStatus: 'clean',
      swapControllerPickId: '',
      swapTargetDefinition: '',
      swapType: '',
      poolUnderlyingPickIdsText: '',
      receivesRankText: '',
      receivesComparator: '',
      protectionLadder: [],
    };
    localStorage.setItem(
      `pickrightdraft:${worldId}:${draftId}`,
      JSON.stringify(v1Data)
    );

    const loaded = loadDraft(worldId, draftId);
    expect(loaded).not.toBeNull();
    // v1 format: has holderTeam + kind but no wizardModel wrapper
    expect('holderTeam' in loaded!).toBe(true);
    expect('wizardModel' in loaded!).toBe(false);
  });

  it('hasDraft returns true when draft exists', () => {
    const model = createDefaultWizardModel({ intent: 'protect_pick' });
    const fs = wizardToFormState(model);
    saveDraft(worldId, draftId, model, fs);

    expect(hasDraft(worldId, draftId)).toBe(true);
    expect(hasDraft(worldId, 'nonexistent')).toBe(false);
  });

  it('clearDraft removes the draft', () => {
    const model = createDefaultWizardModel({ intent: 'protect_pick' });
    const fs = wizardToFormState(model);
    saveDraft(worldId, draftId, model, fs);
    expect(hasDraft(worldId, draftId)).toBe(true);

    clearDraft(worldId, draftId);
    expect(hasDraft(worldId, draftId)).toBe(false);
  });

  it('loadDraft returns null for corrupt data', () => {
    localStorage.setItem(
      `pickrightdraft:${worldId}:${draftId}`,
      '{invalid json'
    );
    expect(loadDraft(worldId, draftId)).toBeNull();
  });

  it('loadDraft returns null for empty object', () => {
    localStorage.setItem(`pickrightdraft:${worldId}:${draftId}`, '{}');
    expect(loadDraft(worldId, draftId)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. TM-10: Wizard presets — common protection patterns
// ═══════════════════════════════════════════════════════════════════════════════

describe('TM-10: WIZARD_PRESETS', () => {
  it('contains exactly 4 presets with the correct IDs', () => {
    expect(WIZARD_PRESETS).toHaveLength(4);
    const ids = WIZARD_PRESETS.map((p) => p.id);
    expect(ids).toEqual([
      'unprotected',
      'top4_unprotected',
      'top10_unprotected',
      'lottery_unprotected',
    ]);
  });

  it('unprotected preset produces empty ladder', () => {
    const preset = WIZARD_PRESETS.find((p) => p.id === 'unprotected')!;
    const tiers = applyProtectionTemplate(preset, 2027);
    expect(tiers).toHaveLength(0);
  });

  it('top4_unprotected produces 2-tier ladder', () => {
    const preset = WIZARD_PRESETS.find((p) => p.id === 'top4_unprotected')!;
    const tiers = applyProtectionTemplate(preset, 2027);
    expect(tiers).toHaveLength(2);
    expect(tiers[0]).toEqual({
      year: '2027',
      condition: 'Top 4',
      ifTriggered: 'roll',
      rollToYear: '2028',
      convertToRound: '',
    });
    expect(tiers[1]).toEqual({
      year: '2028',
      condition: 'Unprotected',
      ifTriggered: 'cancel',
      rollToYear: '',
      convertToRound: '',
    });
  });

  it('top10_unprotected produces 2-tier ladder', () => {
    const preset = WIZARD_PRESETS.find((p) => p.id === 'top10_unprotected')!;
    const tiers = applyProtectionTemplate(preset, 2027);
    expect(tiers).toHaveLength(2);
    expect(tiers[0].condition).toBe('Top 10');
    expect(tiers[0].ifTriggered).toBe('roll');
    expect(tiers[0].rollToYear).toBe('2028');
    expect(tiers[1].ifTriggered).toBe('cancel');
  });

  it('lottery_unprotected produces 2-tier ladder with Lottery condition', () => {
    const preset = WIZARD_PRESETS.find((p) => p.id === 'lottery_unprotected')!;
    const tiers = applyProtectionTemplate(preset, 2027);
    expect(tiers).toHaveLength(2);
    expect(tiers[0].condition).toBe('Lottery');
    expect(tiers[0].ifTriggered).toBe('roll');
    expect(tiers[0].rollToYear).toBe('2028');
    expect(tiers[1].ifTriggered).toBe('cancel');
  });

  it('selecting unprotected clears protectionLadder in formState', () => {
    const model = createDefaultWizardModel({
      intent: 'protect_pick',
      pick: { team: 'BOS', year: 2027, round: 1 },
      protection: { templateId: 'unprotected', customLadder: [] },
    });
    const fs = wizardToFormState(model);
    expect(fs.protectionLadder).toHaveLength(0);
    expect(fs.underlyingStatus).toBe('clean');
  });

  it('each preset passes the validation pipeline', () => {
    for (const preset of WIZARD_PRESETS) {
      const tiers = applyProtectionTemplate(preset, 2027);
      const model = createDefaultWizardModel({
        intent: 'protect_pick',
        pick: { team: 'BOS', year: 2027, round: 1 },
        protection: { templateId: preset.id, customLadder: tiers },
      });
      const result = validateWizardModel(model);
      expect(result.valid).toBe(true);
    }
  });
});
