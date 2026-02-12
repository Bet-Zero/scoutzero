/**
 * FILE: src/tests/entitlements/vacuumEntitlementOverlayStore.test.ts
 * PURPOSE: Unit tests for the vacuum entitlement overlay localStorage store.
 * OWNERSHIP: Feature: architect/tradeMachine (TM-VACUUM-E1)
 *
 * HISTORY:
 *  - 2026-02-12: Created for TM-VACUUM-E1 — Vacuum Pick Editing MVP.
 *
 * LINKS:
 *  - src/features/architect/utils/entitlements/vacuumEntitlementOverlayStore.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadVacuumOverlay,
  saveVacuumOverlay,
  applyVacuumEdit,
  applyVacuumCreate,
  clearVacuumOverlay,
  hasVacuumOverlay,
  getTeamOverlay,
  makeVacuumEntitlementId,
} from '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore';

describe('vacuumEntitlementOverlayStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── loadVacuumOverlay ──

  describe('loadVacuumOverlay', () => {
    it('returns empty envelope when localStorage is empty', () => {
      const envelope = loadVacuumOverlay();
      expect(envelope.version).toBe(1);
      expect(envelope.overlays).toEqual({});
      expect(envelope._updatedAt).toBeTruthy();
    });

    it('returns empty envelope when localStorage contains invalid JSON', () => {
      localStorage.setItem('vacuum_entitlement_overlay', 'not json');
      const envelope = loadVacuumOverlay();
      expect(envelope.version).toBe(1);
      expect(envelope.overlays).toEqual({});
    });

    it('returns empty envelope when version is wrong', () => {
      localStorage.setItem(
        'vacuum_entitlement_overlay',
        JSON.stringify({ version: 99, overlays: {} })
      );
      const envelope = loadVacuumOverlay();
      expect(envelope.version).toBe(1);
      expect(envelope.overlays).toEqual({});
    });

    it('returns valid envelope when stored correctly', () => {
      const stored = {
        version: 1,
        overlays: {
          BOS: { edits: {}, creates: {} },
        },
        _updatedAt: '2026-01-01T00:00:00.000Z',
      };
      localStorage.setItem(
        'vacuum_entitlement_overlay',
        JSON.stringify(stored)
      );
      const envelope = loadVacuumOverlay();
      expect(envelope.version).toBe(1);
      expect(envelope.overlays).toHaveProperty('BOS');
    });
  });

  // ── saveVacuumOverlay ──

  describe('saveVacuumOverlay', () => {
    it('persists envelope to localStorage', () => {
      const envelope = {
        version: 1 as const,
        overlays: { LAL: { edits: {}, creates: {} } },
        _updatedAt: '',
      };
      saveVacuumOverlay(envelope);
      const raw = localStorage.getItem('vacuum_entitlement_overlay');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.version).toBe(1);
      expect(parsed.overlays.LAL).toBeTruthy();
      expect(parsed._updatedAt).toBeTruthy();
    });
  });

  // ── applyVacuumEdit ──

  describe('applyVacuumEdit', () => {
    it('saves edit under correct teamCode and entitlementId', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', {
        description: 'Protected top 3',
      });

      const envelope = loadVacuumOverlay();
      expect(envelope.overlays.BOS).toBeTruthy();
      expect(
        envelope.overlays.BOS.edits['ent:BOS:2027:1:own:abc12345']
      ).toEqual({
        description: 'Protected top 3',
      });
    });

    it('merges successive edits for the same entitlement', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', {
        description: 'Protected top 3',
      });
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', {
        round: 2,
      });

      const envelope = loadVacuumOverlay();
      const edit = envelope.overlays.BOS.edits['ent:BOS:2027:1:own:abc12345'];
      expect(edit.description).toBe('Protected top 3');
      expect(edit.round).toBe(2);
    });

    it('keeps edits for different teams separate', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', { round: 1 });
      applyVacuumEdit('LAL', 'ent:LAL:2027:1:own:def67890', { round: 2 });

      const envelope = loadVacuumOverlay();
      expect(Object.keys(envelope.overlays)).toEqual(
        expect.arrayContaining(['BOS', 'LAL'])
      );
      expect(
        envelope.overlays.BOS.edits['ent:BOS:2027:1:own:abc12345']
      ).toBeTruthy();
      expect(
        envelope.overlays.LAL.edits['ent:LAL:2027:1:own:def67890']
      ).toBeTruthy();
    });
  });

  // ── applyVacuumCreate ──

  describe('applyVacuumCreate', () => {
    it('saves create under correct teamCode with vacuum ID', () => {
      const vacuumId = 'vacuum:BOS:2028:1:own:12345678';
      const fullDoc = {
        holderTeam: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      };

      applyVacuumCreate('BOS', vacuumId, fullDoc);

      const envelope = loadVacuumOverlay();
      expect(envelope.overlays.BOS.creates[vacuumId]).toBeTruthy();
      expect(envelope.overlays.BOS.creates[vacuumId].id).toBe(vacuumId);
      expect(envelope.overlays.BOS.creates[vacuumId].holderTeam).toBe('BOS');
    });

    it('overwrites existing create with same vacuum ID', () => {
      const vacuumId = 'vacuum:BOS:2028:1:own:12345678';
      applyVacuumCreate('BOS', vacuumId, { holderTeam: 'BOS', round: 1 });
      applyVacuumCreate('BOS', vacuumId, { holderTeam: 'BOS', round: 2 });

      const envelope = loadVacuumOverlay();
      expect(envelope.overlays.BOS.creates[vacuumId].round).toBe(2);
    });
  });

  // ── clearVacuumOverlay ──

  describe('clearVacuumOverlay', () => {
    it('removes overlay from localStorage', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', { round: 1 });
      expect(localStorage.getItem('vacuum_entitlement_overlay')).toBeTruthy();

      clearVacuumOverlay();
      expect(localStorage.getItem('vacuum_entitlement_overlay')).toBeNull();
    });

    it('is safe to call when no overlay exists', () => {
      expect(() => clearVacuumOverlay()).not.toThrow();
    });
  });

  // ── hasVacuumOverlay ──

  describe('hasVacuumOverlay', () => {
    it('returns false when localStorage is empty', () => {
      expect(hasVacuumOverlay()).toBe(false);
    });

    it('returns false when overlay has empty team entries', () => {
      saveVacuumOverlay({
        version: 1,
        overlays: { BOS: { edits: {}, creates: {} } },
        _updatedAt: '',
      });
      expect(hasVacuumOverlay()).toBe(false);
    });

    it('returns true after an edit is applied', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', { round: 1 });
      expect(hasVacuumOverlay()).toBe(true);
    });

    it('returns true after a create is applied', () => {
      applyVacuumCreate('BOS', 'vacuum:BOS:2028:1:own:12345678', {
        holderTeam: 'BOS',
      });
      expect(hasVacuumOverlay()).toBe(true);
    });

    it('returns false after clearing', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', { round: 1 });
      clearVacuumOverlay();
      expect(hasVacuumOverlay()).toBe(false);
    });
  });

  // ── getTeamOverlay ──

  describe('getTeamOverlay', () => {
    it('returns null when no overlay for team', () => {
      expect(getTeamOverlay('BOS')).toBeNull();
    });

    it('returns null when team has empty edits and creates', () => {
      saveVacuumOverlay({
        version: 1,
        overlays: { BOS: { edits: {}, creates: {} } },
        _updatedAt: '',
      });
      expect(getTeamOverlay('BOS')).toBeNull();
    });

    it('returns overlay when team has edits', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', { round: 1 });
      const overlay = getTeamOverlay('BOS');
      expect(overlay).toBeTruthy();
      expect(overlay!.edits['ent:BOS:2027:1:own:abc12345']).toBeTruthy();
    });

    it('does not return overlay for a different team', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', { round: 1 });
      expect(getTeamOverlay('LAL')).toBeNull();
    });
  });

  // ── makeVacuumEntitlementId ──

  describe('makeVacuumEntitlementId', () => {
    it('returns correct format with vacuum: prefix', () => {
      const id = makeVacuumEntitlementId({
        teamCode: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      });

      expect(id).toMatch(/^vacuum:BOS:2028:1:own:[a-z0-9]{8}$/);
    });

    it('maps swap_right kind correctly', () => {
      const id = makeVacuumEntitlementId({
        teamCode: 'LAL',
        seasonYear: 2027,
        round: 2,
        kind: 'swap_right',
      });

      expect(id).toMatch(/^vacuum:LAL:2027:2:swap:[a-z0-9]{8}$/);
    });

    it('maps conveyance_right kind correctly', () => {
      const id = makeVacuumEntitlementId({
        teamCode: 'MIA',
        seasonYear: 2029,
        round: 1,
        kind: 'conveyance_right',
      });

      expect(id).toMatch(/^vacuum:MIA:2029:1:conv:[a-z0-9]{8}$/);
    });

    it('generates unique IDs on successive calls', () => {
      const id1 = makeVacuumEntitlementId({
        teamCode: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      });
      const id2 = makeVacuumEntitlementId({
        teamCode: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      });

      expect(id1).not.toBe(id2);
    });
  });

  // ── Round-trip integrity ──

  describe('round-trip', () => {
    it('save → load preserves full envelope integrity', () => {
      applyVacuumEdit('BOS', 'ent:BOS:2027:1:own:abc12345', {
        description: 'Top 3 protected',
        protectionLadder: [{ year: 2027, condition: 'Top 3' }],
      });
      applyVacuumCreate('BOS', 'vacuum:BOS:2028:1:own:newpick1', {
        holderTeam: 'BOS',
        seasonYear: 2028,
        round: 1,
        kind: 'pick_ownership',
      });
      applyVacuumEdit('LAL', 'ent:LAL:2027:2:own:xyz', { round: 2 });

      const envelope = loadVacuumOverlay();

      expect(envelope.version).toBe(1);
      expect(Object.keys(envelope.overlays).sort()).toEqual(['BOS', 'LAL']);
      expect(
        envelope.overlays.BOS.edits['ent:BOS:2027:1:own:abc12345'].description
      ).toBe('Top 3 protected');
      expect(
        envelope.overlays.BOS.creates['vacuum:BOS:2028:1:own:newpick1']
          .holderTeam
      ).toBe('BOS');
      expect(envelope.overlays.LAL.edits['ent:LAL:2027:2:own:xyz'].round).toBe(
        2
      );
    });
  });
});
