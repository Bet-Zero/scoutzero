/**
 * FILE: src/tests/architect/offseason.devGate.guardrail.test.ts
 * PURPOSE: Guardrail ensuring single-team OffseasonTab is DEV+localStorage gated
 *          and does not display misleading persistence success language.
 * OWNERSHIP: Test suite — OFFSEASON_E1
 *
 * HISTORY:
 *  - 2026-03-03: OFFSEASON_E1 — Created guardrail for DEV-gated single-team offseason preview.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const offseasonSectionPath = path.resolve(
  process.cwd(),
  'src/features/architect/GMDashboard/sections/OffseasonSection.jsx'
);

const offseasonTabPath = path.resolve(
  process.cwd(),
  'src/features/architect/offseason/OffseasonTab/OffseasonTab.tsx'
);

const offseasonTabShimPath = path.resolve(
  process.cwd(),
  'src/features/architect/offseason/OffseasonTab/OffseasonTab.jsx'
);

const optionManagerShimPath = path.resolve(
  process.cwd(),
  'src/features/architect/offseason/OffseasonTab/OptionManager.jsx'
);

describe('OFFSEASON_E1: Single-team offseason DEV-gate guardrails', () => {
  describe('OffseasonSection — DEV + localStorage gate', () => {
    const source = fs.readFileSync(offseasonSectionPath, 'utf-8');

    it('gates OffseasonTab behind import.meta.env.DEV', () => {
      expect(source).toContain('import.meta.env.DEV');
    });

    it('gates OffseasonTab behind hz.dev.offseasonPreview localStorage flag', () => {
      expect(source).toContain(
        "window.localStorage?.getItem(DEV_OFFSEASON_PREVIEW_FLAG) === 'true'"
      );
    });

    it('renders OffseasonTab only when showDevPreview is true', () => {
      expect(source).toContain('{showDevPreview && (');
    });

    it('exports the DEV flag constant for test discoverability', () => {
      expect(source).toContain(
        "export const DEV_OFFSEASON_PREVIEW_FLAG = 'hz.dev.offseasonPreview'"
      );
    });

    it('includes preview-only warning banner', () => {
      expect(source).toContain(
        'Preview only — does not persist. Changes will be lost on refresh.'
      );
    });

    it('does NOT render OffseasonTab unconditionally', () => {
      // Count occurrences of <OffseasonTab — should only appear inside showDevPreview gate
      const unconditionalPattern = /^\s*<OffseasonTab/gm;
      const matches = source.match(unconditionalPattern) || [];
      // Exactly one occurrence (inside the gated block)
      expect(matches.length).toBe(1);
    });
  });

  describe('OffseasonTab — no misleading persistence language', () => {
    const source = fs.readFileSync(offseasonTabPath, 'utf-8');

    it('does NOT claim "Offseason Complete"', () => {
      expect(source).not.toContain('Offseason Complete');
    });

    it('uses preview-only completion language', () => {
      expect(source).toContain('Preview computed — not saved');
    });

    it('directs users to World Season Advance for persistence', () => {
      expect(source).toContain('Use World Season Advance to persist');
    });

    it('labels the advance button as preview', () => {
      expect(source).toContain('Preview Advance to');
    });
  });

  describe('Offseason preview JSX compatibility shims', () => {
    const offseasonTabShimSource = fs.readFileSync(offseasonTabShimPath, 'utf-8');
    const optionManagerShimSource = fs.readFileSync(optionManagerShimPath, 'utf-8');

    it('keeps OffseasonTab.jsx as a shim-only default re-export', () => {
      expect(offseasonTabShimSource).toContain(
        "export { default } from './OffseasonTab.tsx';"
      );
    });

    it('keeps OffseasonTab.jsx free of preview business logic', () => {
      expect(offseasonTabShimSource).not.toContain('runOffseason(');
      expect(offseasonTabShimSource).not.toContain('useState(');
    });

    it('keeps OptionManager.jsx as a shim-only default re-export', () => {
      expect(optionManagerShimSource).toContain(
        "export { default } from './OptionManager.tsx';"
      );
    });

    it('keeps OptionManager.jsx free of option-collection business logic', () => {
      expect(optionManagerShimSource).not.toContain('useEffect(');
      expect(optionManagerShimSource).not.toContain('toSeasonCode(');
    });
  });
});
