/**
 * FILE: src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E103 GM world-support TS authorities after shim retirement.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import * as DeleteWorldModalModule from '@/features/architect/GMDashboard/components/DeleteWorldModal';
import * as WorldTimeControlsModule from '@/features/architect/GMDashboard/components/WorldTimeControls';
import DraftPositionsInput, * as DraftPositionsInputModule from '@/features/architect/GMDashboard/components/DraftPositionsInput';
import {
  DraftPositionsInput as NamedDraftPositionsInput,
} from '@/features/architect/GMDashboard/components/DraftPositionsInput';

describe('E103 GM world-support family compatibility guardrails', () => {
  const srcRoot = path.resolve(
    __dirname,
    '../../features/architect/GMDashboard/components'
  );
  const deleteWorldModalTsxSpecifier =
    '../../features/architect/GMDashboard/components/DeleteWorldModal.tsx';
  const worldTimeControlsTsxSpecifier =
    '../../features/architect/GMDashboard/components/WorldTimeControls.tsx';
  const draftPositionsInputTsxSpecifier =
    '../../features/architect/GMDashboard/components/DraftPositionsInput.tsx';
  const readAuthoritySource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8');

  it('deletes the retired DeleteWorldModal and WorldTimeControls shims', () => {
    expect(fs.existsSync(path.join(srcRoot, 'DeleteWorldModal.jsx'))).toBe(
      false
    );
    expect(fs.existsSync(path.join(srcRoot, 'WorldTimeControls.jsx'))).toBe(
      false
    );
  });

  it('deletes the retired DraftPositionsInput.jsx shim', () => {
    expect(fs.existsSync(path.join(srcRoot, 'DraftPositionsInput.jsx'))).toBe(
      false
    );
  });

  it('DeleteWorldModal preserves a named-only export shape across extensionless and TSX authority imports', async () => {
    const authorityModule = await import(deleteWorldModalTsxSpecifier);

    expect(Object.keys(DeleteWorldModalModule)).toEqual(['DeleteWorldModal']);
    expect(Object.keys(authorityModule)).toEqual(['DeleteWorldModal']);
    expect('default' in DeleteWorldModalModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
    expect(authorityModule.DeleteWorldModal).toBe(
      DeleteWorldModalModule.DeleteWorldModal
    );
  });

  it('WorldTimeControls preserves a named-only export shape across extensionless and TSX authority imports', async () => {
    const authorityModule = await import(worldTimeControlsTsxSpecifier);

    expect(Object.keys(WorldTimeControlsModule)).toEqual(['WorldTimeControls']);
    expect(Object.keys(authorityModule)).toEqual(['WorldTimeControls']);
    expect('default' in WorldTimeControlsModule).toBe(false);
    expect('default' in authorityModule).toBe(false);
    expect(authorityModule.WorldTimeControls).toBe(
      WorldTimeControlsModule.WorldTimeControls
    );
  });

  it('DraftPositionsInput preserves default and named exports across extensionless and TSX authority imports', async () => {
    const authorityModule = await import(draftPositionsInputTsxSpecifier);

    expect(Object.keys(DraftPositionsInputModule).sort()).toEqual([
      'DraftPositionsInput',
      'default',
    ]);
    expect(Object.keys(authorityModule).sort()).toEqual([
      'DraftPositionsInput',
      'default',
    ]);
    expect(DraftPositionsInputModule.default).toBe(DraftPositionsInput);
    expect(DraftPositionsInputModule.DraftPositionsInput).toBe(
      NamedDraftPositionsInput
    );
    expect(authorityModule.default).toBe(DraftPositionsInput);
    expect(authorityModule.DraftPositionsInput).toBe(
      NamedDraftPositionsInput
    );
  });

  it('TSX authorities preserve the expected export shapes and DraftPositionsInput propTypes surface', () => {
    const deleteWorldModalSource = readAuthoritySource('DeleteWorldModal.tsx');
    const worldTimeControlsSource = readAuthoritySource('WorldTimeControls.tsx');
    const draftPositionsInputSource =
      readAuthoritySource('DraftPositionsInput.tsx');

    expect(deleteWorldModalSource).toContain('export function DeleteWorldModal');
    expect(deleteWorldModalSource).not.toContain('export default');

    expect(worldTimeControlsSource).toContain(
      'export function WorldTimeControls'
    );
    expect(worldTimeControlsSource).not.toContain('export default');
    expect(worldTimeControlsSource).toContain('worldTimeOwner:');
    expect(worldTimeControlsSource).not.toContain(
      "from '@/features/architect/utils/worldManager'"
    );
    expect(worldTimeControlsSource).not.toContain('updateWorldMetadata(');
    expect(worldTimeControlsSource).not.toContain(
      'new Date().toISOString().slice(0, 10)'
    );
    expect(worldTimeControlsSource).toContain(
      'Set a world date to enable +1 Day.'
    );
    expect(worldTimeControlsSource).toContain(
      'const hasActiveWorld = Boolean(worldId);'
    );
    expect(worldTimeControlsSource).toContain(
      'const areControlsDisabled ='
    );
    expect(worldTimeControlsSource).not.toContain('if (!worldId) return null;');
    expect(worldTimeControlsSource).toContain('World-only');
    expect(worldTimeControlsSource).toContain(
      'Select a world to unlock world date and +1 Day.'
    );
    expect(worldTimeControlsSource).toContain(
      'Select a world to unlock +1 Day'
    );
    expect(worldTimeControlsSource).toContain('disabled={areControlsDisabled}');

    expect(draftPositionsInputSource).toContain(
      'export function DraftPositionsInput'
    );
    expect(draftPositionsInputSource).not.toContain(
      "from '@/features/architect/utils/worldManager'"
    );
    expect(draftPositionsInputSource).toContain(
      'DraftPositionsInput.propTypes = {'
    );
    expect(draftPositionsInputSource).toContain(
      'persistenceAuthority: PropTypes.shape({'
    );
    expect(draftPositionsInputSource).toContain(
      'loadCommittedDraftPositions: PropTypes.func.isRequired'
    );
    expect(draftPositionsInputSource).toContain(
      'saveCommittedDraftPositions: PropTypes.func.isRequired'
    );
    expect(draftPositionsInputSource).toContain(
      'clearCommittedDraftPositions: PropTypes.func.isRequired'
    );
    expect(draftPositionsInputSource).toContain(
      'validateDraftPositionsMap: PropTypes.func.isRequired'
    );
    expect(draftPositionsInputSource).toContain('worldId: PropTypes.string');
    expect(draftPositionsInputSource).toContain(
      'seasonAdvanceDraftContext: PropTypes.shape({'
    );
    expect(draftPositionsInputSource).toContain(
      'authoritativeSeason: PropTypes.string.isRequired'
    );
    expect(draftPositionsInputSource).toContain(
      'nextUsedDraftYear: PropTypes.number.isRequired'
    );
    expect(draftPositionsInputSource).toContain(
      'nextSeason: PropTypes.string.isRequired'
    );
    expect(draftPositionsInputSource).toContain(
      'Next-used Draft Year:'
    );
    expect(draftPositionsInputSource).toContain(
      'export default DraftPositionsInput;'
    );
  });
});
