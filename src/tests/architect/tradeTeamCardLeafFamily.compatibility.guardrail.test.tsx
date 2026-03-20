// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import CapImpactTiles from '@/features/architect/tradeMachine/CapImpactTiles';
import { SelectTeamCard } from '@/features/architect/tradeMachine/SelectTeamCard';
import { OutgoingPlayersList } from '@/features/architect/tradeMachine/OutgoingPlayersList';
import TradePlayerRow from '@/features/architect/tradeMachine/TradePlayerRow';
import EntitlementPicksList, {
  EntitlementPicksList as NamedEntitlementPicksList,
} from '@/features/architect/tradeMachine/EntitlementPicksList';
import EntitlementPickRow from '@/features/architect/tradeMachine/EntitlementPickRow';
import TradeExceptionManager from '@/features/architect/tradeMachine/TradeExceptionManager';
import * as CapImpactTilesJsxModule from '../../features/architect/tradeMachine/CapImpactTiles.jsx';
import * as SelectTeamCardJsxModule from '../../features/architect/tradeMachine/SelectTeamCard.jsx';
import * as OutgoingPlayersListJsxModule from '../../features/architect/tradeMachine/OutgoingPlayersList.jsx';
import * as TradePlayerRowJsxModule from '../../features/architect/tradeMachine/TradePlayerRow.jsx';
import * as EntitlementPicksListJsxModule from '../../features/architect/tradeMachine/EntitlementPicksList.jsx';
import * as EntitlementPickRowJsxModule from '../../features/architect/tradeMachine/EntitlementPickRow.jsx';
import * as TradeExceptionManagerJsxModule from '../../features/architect/tradeMachine/TradeExceptionManager.jsx';

describe('E101 Trade Team Card leaf-family compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect/tradeMachine');
  const readAuthoritySource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8');
  const shimExpectations = [
    ['CapImpactTiles.jsx', "export { default } from './CapImpactTiles.tsx';"],
    ['SelectTeamCard.jsx', "export { SelectTeamCard } from './SelectTeamCard.tsx';"],
    [
      'OutgoingPlayersList.jsx',
      "export { OutgoingPlayersList } from './OutgoingPlayersList.tsx';",
    ],
    ['TradePlayerRow.jsx', "export { default } from './TradePlayerRow.tsx';"],
    [
      'EntitlementPicksList.jsx',
      "export { default, EntitlementPicksList } from './EntitlementPicksList.tsx';",
    ],
    [
      'EntitlementPickRow.jsx',
      "export { default } from './EntitlementPickRow.tsx';",
    ],
    [
      'TradeExceptionManager.jsx',
      "export { default } from './TradeExceptionManager.tsx';",
    ],
  ] as const;

  shimExpectations.forEach(([relativePath, expectedSource]) => {
    it(`${relativePath} remains a pure compatibility shim`, () => {
      const shimPath = path.join(srcRoot, relativePath);
      const source = fs.readFileSync(shimPath, 'utf-8').trim();

      expect(source).toBe(expectedSource);
    });
  });

  it('default-only shims preserve only default exports and match their authorities', () => {
    const defaultOnlyPairs = [
      ['CapImpactTiles.tsx', CapImpactTilesJsxModule, CapImpactTiles],
      ['TradePlayerRow.tsx', TradePlayerRowJsxModule, TradePlayerRow],
      ['EntitlementPickRow.tsx', EntitlementPickRowJsxModule, EntitlementPickRow],
      [
        'TradeExceptionManager.tsx',
        TradeExceptionManagerJsxModule,
        TradeExceptionManager,
      ],
    ] as const;

    defaultOnlyPairs.forEach(([authorityPath, jsxModule, extensionlessDefault]) => {
      const authoritySource = readAuthoritySource(authorityPath);

      expect(authoritySource).toContain('export default');
      expect(Object.keys(jsxModule)).toEqual(['default']);
      expect(jsxModule.default).toBe(extensionlessDefault);
    });
  });

  it('named-only shims preserve named exports without introducing defaults', () => {
    const namedOnlyPairs = [
      ['SelectTeamCard.tsx', 'SelectTeamCard', SelectTeamCardJsxModule, SelectTeamCard],
      [
        'OutgoingPlayersList.tsx',
        'OutgoingPlayersList',
        OutgoingPlayersListJsxModule,
        OutgoingPlayersList,
      ],
    ] as const;

    namedOnlyPairs.forEach(
      ([authorityPath, exportName, jsxModule, extensionlessNamed]) => {
        const authoritySource = readAuthoritySource(authorityPath);
        const jsxModuleRecord = jsxModule as Record<string, unknown>;

        expect(authoritySource).toContain(`export const ${exportName}`);
        expect(authoritySource).not.toContain('export default');
        expect(Object.keys(jsxModuleRecord)).toEqual([exportName]);
        expect('default' in jsxModuleRecord).toBe(false);
        expect(jsxModuleRecord[exportName]).toBe(extensionlessNamed);
      }
    );
  });

  it('EntitlementPicksList preserves both default and named exports across authority and shim', () => {
    const authoritySource = readAuthoritySource('EntitlementPicksList.tsx');

    expect(authoritySource).toContain('export const EntitlementPicksList');
    expect(authoritySource).toContain('export default EntitlementPicksList;');
    expect(Object.keys(EntitlementPicksListJsxModule).sort()).toEqual([
      'EntitlementPicksList',
      'default',
    ]);
    expect(EntitlementPicksListJsxModule.default).toBe(EntitlementPicksList);
    expect(EntitlementPicksListJsxModule.EntitlementPicksList).toBe(
      NamedEntitlementPicksList
    );
  });
});
