/**
 * FILE: src/tests/architect/gmWorldSupportFamily.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E103 GM world-support TS authorities and JSX shims.
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
import * as DeleteWorldModalJsxModule from '../../features/architect/GMDashboard/components/DeleteWorldModal.jsx';
import * as WorldTimeControlsJsxModule from '../../features/architect/GMDashboard/components/WorldTimeControls.jsx';
import * as DraftPositionsInputJsxModule from '../../features/architect/GMDashboard/components/DraftPositionsInput.jsx';

describe('E103 GM world-support family compatibility guardrails', () => {
  const srcRoot = path.resolve(
    __dirname,
    '../../features/architect/GMDashboard/components'
  );
  const readAuthoritySource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8');
  const shimExpectations = [
    [
      'DeleteWorldModal.jsx',
      "export { DeleteWorldModal } from './DeleteWorldModal.tsx';",
    ],
    [
      'WorldTimeControls.jsx',
      "export { WorldTimeControls } from './WorldTimeControls.tsx';",
    ],
    [
      'DraftPositionsInput.jsx',
      "export { default, DraftPositionsInput } from './DraftPositionsInput.tsx';",
    ],
  ] as const;

  shimExpectations.forEach(([relativePath, expectedSource]) => {
    it(`${relativePath} remains a pure compatibility shim`, () => {
      const shimPath = path.join(srcRoot, relativePath);
      const source = fs.readFileSync(shimPath, 'utf-8').trim();

      expect(source).toBe(expectedSource);
    });
  });

  it('DeleteWorldModal preserves a named-only export shape across extensionless and JSX shim imports', () => {
    expect(Object.keys(DeleteWorldModalModule)).toEqual(['DeleteWorldModal']);
    expect(Object.keys(DeleteWorldModalJsxModule)).toEqual([
      'DeleteWorldModal',
    ]);
    expect('default' in DeleteWorldModalModule).toBe(false);
    expect('default' in DeleteWorldModalJsxModule).toBe(false);
    expect(DeleteWorldModalJsxModule.DeleteWorldModal).toBe(
      DeleteWorldModalModule.DeleteWorldModal
    );
  });

  it('WorldTimeControls preserves a named-only export shape across extensionless and JSX shim imports', () => {
    expect(Object.keys(WorldTimeControlsModule)).toEqual(['WorldTimeControls']);
    expect(Object.keys(WorldTimeControlsJsxModule)).toEqual([
      'WorldTimeControls',
    ]);
    expect('default' in WorldTimeControlsModule).toBe(false);
    expect('default' in WorldTimeControlsJsxModule).toBe(false);
    expect(WorldTimeControlsJsxModule.WorldTimeControls).toBe(
      WorldTimeControlsModule.WorldTimeControls
    );
  });

  it('DraftPositionsInput preserves default and named exports across extensionless and JSX shim imports', () => {
    expect(Object.keys(DraftPositionsInputModule).sort()).toEqual([
      'DraftPositionsInput',
      'default',
    ]);
    expect(Object.keys(DraftPositionsInputJsxModule).sort()).toEqual([
      'DraftPositionsInput',
      'default',
    ]);
    expect(DraftPositionsInputModule.default).toBe(DraftPositionsInput);
    expect(DraftPositionsInputModule.DraftPositionsInput).toBe(
      NamedDraftPositionsInput
    );
    expect(DraftPositionsInputJsxModule.default).toBe(DraftPositionsInput);
    expect(DraftPositionsInputJsxModule.DraftPositionsInput).toBe(
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

    expect(draftPositionsInputSource).toContain(
      'export function DraftPositionsInput'
    );
    expect(draftPositionsInputSource).toContain(
      'DraftPositionsInput.propTypes = {'
    );
    expect(draftPositionsInputSource).toContain('worldId: PropTypes.string');
    expect(draftPositionsInputSource).toContain(
      'currentYear: PropTypes.number.isRequired'
    );
    expect(draftPositionsInputSource).toContain(
      'worldSeason: PropTypes.string'
    );
    expect(draftPositionsInputSource).toContain(
      'export default DraftPositionsInput;'
    );
  });
});
