/**
 * FILE: tests/entitlements/vacuumTradeTransfer.test.ts
 * PURPOSE: Tests for TM-PICKS-E1 — Vacuum overlay trade transfer operations
 * OWNERSHIP: Feature: architect/tradeMachine
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  loadVacuumOverlay,
  applyVacuumTransfer,
  removeTransfer,
  getTransfersForTeam,
  hasTransfer,
  getTransfer,
  clearVacuumOverlay,
  hasVacuumOverlay,
} from '@/features/architect/utils/entitlements/vacuumEntitlementOverlayStore';

describe('vacuumTradeTransfer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ── applyVacuumTransfer ──

  describe('applyVacuumTransfer', () => {
    it('records a transfer in the overlay envelope', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');

      const envelope = loadVacuumOverlay();
      expect(envelope.transfers).toHaveProperty('ent_001');
      expect(envelope.transfers.ent_001).toEqual({
        entitlementId: 'ent_001',
        fromTeam: 'LAL',
        toTeam: 'BOS',
      });
    });

    it('persists to localStorage', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');

      // Verify by loading from fresh parse
      const raw = localStorage.getItem('vacuum_entitlement_overlay');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!);
      expect(parsed.transfers.ent_001.toTeam).toBe('BOS');
    });

    it('supports multiple transfers', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');
      applyVacuumTransfer('ent_002', 'BOS', 'LAL');

      const envelope = loadVacuumOverlay();
      expect(Object.keys(envelope.transfers)).toHaveLength(2);
    });

    it('overwrites previous transfer for same entitlementId', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');
      applyVacuumTransfer('ent_001', 'BOS', 'MIA');

      const envelope = loadVacuumOverlay();
      expect(envelope.transfers.ent_001.fromTeam).toBe('BOS');
      expect(envelope.transfers.ent_001.toTeam).toBe('MIA');
    });
  });

  // ── removeTransfer ──

  describe('removeTransfer', () => {
    it('removes an existing transfer', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');
      removeTransfer('ent_001');

      const envelope = loadVacuumOverlay();
      expect(envelope.transfers).not.toHaveProperty('ent_001');
    });

    it('is a no-op for non-existent transfer', () => {
      removeTransfer('ent_999');
      const envelope = loadVacuumOverlay();
      expect(Object.keys(envelope.transfers)).toHaveLength(0);
    });
  });

  // ── getTransfersForTeam ──

  describe('getTransfersForTeam', () => {
    it('returns transfers in and out for a team', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');
      applyVacuumTransfer('ent_002', 'BOS', 'LAL');
      applyVacuumTransfer('ent_003', 'MIA', 'LAL');

      const { transfersIn, transfersOut } = getTransfersForTeam('LAL');
      expect(transfersIn).toEqual(['ent_002', 'ent_003']);
      expect(transfersOut).toEqual(['ent_001']);
    });

    it('returns empty arrays when no transfers for team', () => {
      applyVacuumTransfer('ent_001', 'BOS', 'MIA');

      const { transfersIn, transfersOut } = getTransfersForTeam('LAL');
      expect(transfersIn).toEqual([]);
      expect(transfersOut).toEqual([]);
    });

    it('returns empty arrays when no transfers at all', () => {
      const { transfersIn, transfersOut } = getTransfersForTeam('LAL');
      expect(transfersIn).toEqual([]);
      expect(transfersOut).toEqual([]);
    });
  });

  // ── hasTransfer ──

  describe('hasTransfer', () => {
    it('returns true for existing transfer', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');
      expect(hasTransfer('ent_001')).toBe(true);
    });

    it('returns false for non-existent transfer', () => {
      expect(hasTransfer('ent_001')).toBe(false);
    });
  });

  // ── getTransfer ──

  describe('getTransfer', () => {
    it('returns transfer record for existing transfer', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');

      const record = getTransfer('ent_001');
      expect(record).toEqual({
        entitlementId: 'ent_001',
        fromTeam: 'LAL',
        toTeam: 'BOS',
      });
    });

    it('returns null for non-existent transfer', () => {
      expect(getTransfer('ent_999')).toBeNull();
    });
  });

  // ── Integration with hasVacuumOverlay ──

  describe('hasVacuumOverlay integration', () => {
    it('returns true when only transfers exist (no edits/creates)', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');
      expect(hasVacuumOverlay()).toBe(true);
    });

    it('returns false after clearing', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');
      clearVacuumOverlay();
      expect(hasVacuumOverlay()).toBe(false);
    });
  });

  // ── Backward compatibility ──

  describe('backward compatibility', () => {
    it('loads envelope without transfers field gracefully', () => {
      // Simulate pre-TM-PICKS-E1 envelope without transfers
      localStorage.setItem(
        'vacuum_entitlement_overlay',
        JSON.stringify({
          version: 1,
          overlays: { BOS: { edits: {}, creates: {} } },
          _updatedAt: '2026-01-01T00:00:00.000Z',
        })
      );

      const envelope = loadVacuumOverlay();
      expect(envelope.transfers).toEqual({});
    });

    it('handles transfers alongside existing edits/creates', () => {
      applyVacuumTransfer('ent_001', 'LAL', 'BOS');

      const envelope = loadVacuumOverlay();
      expect(envelope.transfers).toHaveProperty('ent_001');
      expect(envelope.overlays).toEqual({});
    });
  });
});
