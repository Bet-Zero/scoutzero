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
} from '@/features/architect/admin/pickRightWizardDraft';

// Mock form state matching EntitlementFormState shape
const mockFormState = {
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
};

describe('pickRightWizardDraft', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('saveDraft', () => {
    it('stores draft to localStorage with correct key', () => {
      saveDraft('world-1', 'ent:BOS:2027:1:own:test123', mockFormState);

      const key = 'pickrightdraft:world-1:ent:BOS:2027:1:own:test123';
      const stored = localStorage.getItem(key);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(mockFormState);
    });

    it('uses "new" suffix for create mode', () => {
      saveDraft('world-1', 'new', mockFormState);

      const key = 'pickrightdraft:world-1:new';
      const stored = localStorage.getItem(key);
      expect(stored).not.toBeNull();
    });
  });

  describe('loadDraft', () => {
    it('retrieves a previously saved draft', () => {
      saveDraft('world-1', 'new', mockFormState);
      const loaded = loadDraft('world-1', 'new');
      expect(loaded).toEqual(mockFormState);
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
  });

  describe('clearDraft', () => {
    it('removes a saved draft from localStorage', () => {
      saveDraft('world-1', 'new', mockFormState);
      expect(hasDraft('world-1', 'new')).toBe(true);

      clearDraft('world-1', 'new');
      expect(hasDraft('world-1', 'new')).toBe(false);
      expect(loadDraft('world-1', 'new')).toBeNull();
    });
  });

  describe('hasDraft', () => {
    it('returns true when draft exists', () => {
      saveDraft('world-1', 'new', mockFormState);
      expect(hasDraft('world-1', 'new')).toBe(true);
    });

    it('returns false when no draft exists', () => {
      expect(hasDraft('world-1', 'new')).toBe(false);
    });

    it('returns false after clearing a draft', () => {
      saveDraft('world-1', 'new', mockFormState);
      clearDraft('world-1', 'new');
      expect(hasDraft('world-1', 'new')).toBe(false);
    });
  });
});
