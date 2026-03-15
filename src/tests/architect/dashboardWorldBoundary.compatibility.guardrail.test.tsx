/**
 * FILE: src/tests/architect/dashboardWorldBoundary.compatibility.guardrail.test.tsx
 * PURPOSE: Guardrail coverage for the E109 dashboard/world TS authorities and JSX shims.
 * OWNERSHIP: Feature: architect/GMDashboard
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import GMDashboard from '@/features/architect/GMDashboard/GMDashboard';
import * as GMDashboardModule from '@/features/architect/GMDashboard/GMDashboard';
import { WorldSelector } from '@/features/architect/GMDashboard/components/WorldSelector';
import * as WorldSelectorModule from '@/features/architect/GMDashboard/components/WorldSelector';
import SeasonAdvanceModal, {
  SeasonAdvanceModal as NamedSeasonAdvanceModal,
} from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';
import * as SeasonAdvanceModalModule from '@/features/architect/GMDashboard/components/SeasonAdvanceModal';
import * as GMDashboardJsxModule from '../../features/architect/GMDashboard/GMDashboard.jsx';
import * as WorldSelectorJsxModule from '../../features/architect/GMDashboard/components/WorldSelector.jsx';
import * as SeasonAdvanceModalJsxModule from '../../features/architect/GMDashboard/components/SeasonAdvanceModal.jsx';

describe('E109 dashboard/world boundary compatibility guardrails', () => {
  const gmDashboardRoot = path.resolve(
    __dirname,
    '../../features/architect/GMDashboard'
  );
  const componentsRoot = path.join(gmDashboardRoot, 'components');
  const GMDASHBOARD_TSX_SPECIFIER =
    '../../features/architect/GMDashboard/GMDashboard.tsx';
  const WORLD_SELECTOR_TSX_SPECIFIER =
    '../../features/architect/GMDashboard/components/WorldSelector.tsx';
  const SEASON_ADVANCE_MODAL_TSX_SPECIFIER =
    '../../features/architect/GMDashboard/components/SeasonAdvanceModal.tsx';
  const readSource = (root: string, relativePath: string) =>
    fs.readFileSync(path.join(root, relativePath), 'utf-8');
  const shimExpectations = [
    ['GMDashboard.jsx', "export { default } from './GMDashboard.tsx';"],
    ['WorldSelector.jsx', "export { WorldSelector } from './WorldSelector.tsx';"],
    [
      'SeasonAdvanceModal.jsx',
      "export { default, SeasonAdvanceModal } from './SeasonAdvanceModal.tsx';",
    ],
  ] as const;

  it('keeps each JSX file as a pure compatibility shim', () => {
    const gmDashboardShim = readSource(gmDashboardRoot, shimExpectations[0][0]).trim();
    const worldSelectorShim = readSource(componentsRoot, shimExpectations[1][0]).trim();
    const seasonAdvanceModalShim = readSource(
      componentsRoot,
      shimExpectations[2][0]
    ).trim();

    expect(gmDashboardShim).toBe(shimExpectations[0][1]);
    expect(worldSelectorShim).toBe(shimExpectations[1][1]);
    expect(seasonAdvanceModalShim).toBe(shimExpectations[2][1]);
  });

  it('preserves GMDashboard default-only export parity across extensionless, JSX shim, and TSX authority imports', async () => {
    const GMDashboardTsxModule = await import(GMDASHBOARD_TSX_SPECIFIER);

    expect(Object.keys(GMDashboardModule)).toEqual(['default']);
    expect(Object.keys(GMDashboardJsxModule)).toEqual(['default']);
    expect(Object.keys(GMDashboardTsxModule)).toEqual(['default']);
    expect(GMDashboardModule.default).toBe(GMDashboard);
    expect(GMDashboardJsxModule.default).toBe(GMDashboard);
    expect(GMDashboardTsxModule.default).toBe(GMDashboard);
    expect('default' in GMDashboardModule).toBe(true);
    expect('default' in GMDashboardJsxModule).toBe(true);
    expect('default' in GMDashboardTsxModule).toBe(true);
  });

  it('preserves WorldSelector named-only export parity across extensionless, JSX shim, and TSX authority imports', async () => {
    const WorldSelectorTsxModule = await import(WORLD_SELECTOR_TSX_SPECIFIER);

    expect(Object.keys(WorldSelectorModule)).toEqual(['WorldSelector']);
    expect(Object.keys(WorldSelectorJsxModule)).toEqual(['WorldSelector']);
    expect(Object.keys(WorldSelectorTsxModule)).toEqual(['WorldSelector']);
    expect('default' in WorldSelectorModule).toBe(false);
    expect('default' in WorldSelectorJsxModule).toBe(false);
    expect('default' in WorldSelectorTsxModule).toBe(false);
    expect(WorldSelectorModule.WorldSelector).toBe(WorldSelector);
    expect(WorldSelectorJsxModule.WorldSelector).toBe(WorldSelector);
    expect(WorldSelectorTsxModule.WorldSelector).toBe(WorldSelector);
  });

  it('preserves SeasonAdvanceModal named-plus-default export parity across extensionless, JSX shim, and TSX authority imports', async () => {
    const SeasonAdvanceModalTsxModule = await import(
      SEASON_ADVANCE_MODAL_TSX_SPECIFIER
    );

    expect(Object.keys(SeasonAdvanceModalModule).sort()).toEqual([
      'SeasonAdvanceModal',
      'default',
    ]);
    expect(Object.keys(SeasonAdvanceModalJsxModule).sort()).toEqual([
      'SeasonAdvanceModal',
      'default',
    ]);
    expect(Object.keys(SeasonAdvanceModalTsxModule).sort()).toEqual([
      'SeasonAdvanceModal',
      'default',
    ]);
    expect(SeasonAdvanceModalModule.default).toBe(SeasonAdvanceModal);
    expect(SeasonAdvanceModalModule.SeasonAdvanceModal).toBe(
      NamedSeasonAdvanceModal
    );
    expect(SeasonAdvanceModalJsxModule.default).toBe(SeasonAdvanceModal);
    expect(SeasonAdvanceModalJsxModule.SeasonAdvanceModal).toBe(
      NamedSeasonAdvanceModal
    );
    expect(SeasonAdvanceModalTsxModule.default).toBe(SeasonAdvanceModal);
    expect(SeasonAdvanceModalTsxModule.SeasonAdvanceModal).toBe(
      NamedSeasonAdvanceModal
    );
  });

  it('keeps the TSX authorities on the expected export surfaces', () => {
    const gmDashboardSource = readSource(gmDashboardRoot, 'GMDashboard.tsx');
    const worldSelectorSource = readSource(componentsRoot, 'WorldSelector.tsx');
    const seasonAdvanceModalSource = readSource(
      componentsRoot,
      'SeasonAdvanceModal.tsx'
    );

    expect(gmDashboardSource).toContain('const GMDashboard = () => {');
    expect(gmDashboardSource).toContain('export default GMDashboard;');
    expect(gmDashboardSource).not.toContain('export const GMDashboard');

    expect(worldSelectorSource).toContain('export function WorldSelector(');
    expect(worldSelectorSource).not.toContain('export default WorldSelector');

    expect(seasonAdvanceModalSource).toContain(
      'export const SeasonAdvanceModal: SeasonAdvanceModalComponent = ({'
    );
    expect(seasonAdvanceModalSource).toContain('SeasonAdvanceModal.propTypes = {');
    expect(seasonAdvanceModalSource).toContain(
      'export default SeasonAdvanceModal;'
    );
  });
});
