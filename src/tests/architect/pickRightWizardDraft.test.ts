/**
 * FILE: src/tests/architect/pickRightWizardDraft.test.ts
 * PURPOSE: Tests for localStorage draft helpers (TM-8).
 * OWNERSHIP: Test suite
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  saveDraft,
  loadDraft,
  clearDraft,
  hasDraft,
  type LoadedDraft,
} from '@/features/architect/admin/pickRightWizardDraft';
import { createDefaultWizardModel } from '@/features/architect/admin/pickRightWizardModel';
import type { EntitlementFormState } from '@/features/architect/admin/entitlementEditorFormState';

// Mock wizard model for v2 envelope testing
const mockWizardModel = createDefaultWizardModel({
  intent: 'protect_pick',
  pick: { team: 'BOS', year: 2027, round: 1 },
  description: 'Boston 2027 1st',
});

// Mock form state matching EntitlementFormState shape
const mockFormState: EntitlementFormState = {
  id: 'ent:BOS:2027:1:own:test123',
  holderTeam: 'BOS',
  seasonYear: '2027',
  round: '1',
  kind: 'pick_ownership' as const,
  description: 'Boston 2027 1st',
  underlyingPickId: 'BOS_2027_1',
  underlyingStatus: 'clean' as const,
  swapControllerPickId: '',
  swapTargetDefinition: '',
  swapType: '' as const,
  poolUnderlyingPickIdsText: '',
  receivesRankText: '',
  receivesComparator: '' as const,
  protectionLadder: [],
  linkedEntitlementIdsText: '',
  residualOfEntitlementId: '',
  coveredByEntitlementIdsText: '',
};

function isDraftEnvelope(
  draft: LoadedDraft | null
): draft is Extract<LoadedDraft, { wizardModel: unknown }> {
  return Boolean(draft && 'wizardModel' in draft);
}

describe('pickRightWizardDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveDraft', () => {
    it('stores draft to localStorage with correct key and v2 envelope format', () => {
      saveDraft(
        'world-1',
        'ent:BOS:2027:1:own:test123',
        mockWizardModel,
        mockFormState
      );

      const key = 'pickrightdraft:world-1:ent:BOS:2027:1:own:test123';
      const stored = localStorage.getItem(key);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveProperty('version', 2);
      expect(parsed).toHaveProperty('wizardModel');
      expect(parsed).toHaveProperty('formState');
      expect(parsed.wizardModel).toMatchObject(mockWizardModel);
      expect(parsed.formState).toEqual(mockFormState);
    });

    it('uses "new" suffix for create mode', () => {
      saveDraft('world-1', 'new', mockWizardModel, mockFormState);

      const key = 'pickrightdraft:world-1:new';
      const stored = localStorage.getItem(key);
      expect(stored).not.toBeNull();

      const parsed = JSON.parse(stored!);
      expect(parsed.version).toBe(2);
    });
  });

  describe('loadDraft', () => {
    it('retrieves a previously saved draft as v2 envelope', () => {
      saveDraft('world-1', 'new', mockWizardModel, mockFormState);
      const loaded = loadDraft('world-1', 'new');

      expect(loaded).not.toBeNull();
      expect(loaded).toHaveProperty('wizardModel');
      expect(loaded).toHaveProperty('formState');
      expect(isDraftEnvelope(loaded)).toBe(true);
      if (!isDraftEnvelope(loaded)) {
        throw new Error('Expected v2 draft envelope');
      }
      expect(loaded.wizardModel).toMatchObject(mockWizardModel);
      expect(loaded.formState).toEqual(mockFormState);
    });

    it('returns null when no draft exists', () => {
      const loaded = loadDraft('world-1', 'nonexistent');
      expect(loaded).toBeNull();
    });

    it('returns null for corrupt data in localStorage', () => {
      const key = 'pickrightdraft:world-1:corrupt';
      localStorage.setItem(key, 'this is not json{{{');
      const loaded = loadDraft('world-1', 'corrupt');
      expect(loaded).toBeNull();
    });

    it('returns null for valid JSON missing required fields', () => {
      const key = 'pickrightdraft:world-1:incomplete';
      localStorage.setItem(key, JSON.stringify({ foo: 'bar' }));
      const loaded = loadDraft('world-1', 'incomplete');
      expect(loaded).toBeNull();
    });

    it('auto-migrates v1 legacy drafts (raw formState)', () => {
      // Simulate a v1 draft (raw EntitlementFormState) stored in localStorage
      const key = 'pickrightdraft:world-1:legacy-v1';
      localStorage.setItem(key, JSON.stringify(mockFormState));

      const loaded = loadDraft('world-1', 'legacy-v1');
      expect(loaded).not.toBeNull();
      // v1 drafts return raw formState (no wizardModel property)
      expect(loaded).not.toHaveProperty('wizardModel');
      expect(loaded).toEqual(mockFormState);
    });
  });

  describe('clearDraft', () => {
    it('removes a saved draft from localStorage', () => {
      saveDraft('world-1', 'new', mockWizardModel, mockFormState);
      expect(hasDraft('world-1', 'new')).toBe(true);

      clearDraft('world-1', 'new');
      expect(hasDraft('world-1', 'new')).toBe(false);
      expect(loadDraft('world-1', 'new')).toBeNull();
    });
  });

  describe('hasDraft', () => {
    it('returns true when draft exists', () => {
      saveDraft('world-1', 'new', mockWizardModel, mockFormState);
      expect(hasDraft('world-1', 'new')).toBe(true);
    });

    it('returns false when no draft exists', () => {
      expect(hasDraft('world-1', 'new')).toBe(false);
    });

    it('returns false after clearing a draft', () => {
      saveDraft('world-1', 'new', mockWizardModel, mockFormState);
      clearDraft('world-1', 'new');
      expect(hasDraft('world-1', 'new')).toBe(false);
    });
  });
});
