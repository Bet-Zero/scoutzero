// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { CapImpactTiles } from '@/features/architect/tradeMachine/CapImpactTiles';
import { SelectTeamCard } from '@/features/architect/tradeMachine/SelectTeamCard';
import { OutgoingPlayersList } from '@/features/architect/tradeMachine/OutgoingPlayersList';
import { TradePlayerRow } from '@/features/architect/tradeMachine/TradePlayerRow';
import EntitlementPicksList, {
  EntitlementPicksList as NamedEntitlementPicksList,
} from '@/features/architect/tradeMachine/EntitlementPicksList';
import { EntitlementPickRow } from '@/features/architect/tradeMachine/EntitlementPickRow';
import { TradeExceptionManager } from '@/features/architect/tradeMachine/TradeExceptionManager';

describe('E101 Trade Team Card leaf-family compatibility guardrails', () => {
  const srcRoot = path.resolve(__dirname, '../../features/architect/tradeMachine');
  const readAuthoritySource = (relativePath: string) =>
    fs.readFileSync(path.join(srcRoot, relativePath), 'utf-8');
  const CAP_IMPACT_TILES_AUTHORITY_SPECIFIER =
    '../../features/architect/tradeMachine/CapImpactTiles.tsx';
  const TRADE_PLAYER_ROW_AUTHORITY_SPECIFIER =
    '../../features/architect/tradeMachine/TradePlayerRow.tsx';
  const ENTITLEMENT_PICK_ROW_AUTHORITY_SPECIFIER =
    '../../features/architect/tradeMachine/EntitlementPickRow.tsx';
  const TRADE_EXCEPTION_MANAGER_AUTHORITY_SPECIFIER =
    '../../features/architect/tradeMachine/TradeExceptionManager.tsx';
  const SELECT_TEAM_CARD_AUTHORITY_SPECIFIER =
    '../../features/architect/tradeMachine/SelectTeamCard.tsx';
  const OUTGOING_PLAYERS_LIST_AUTHORITY_SPECIFIER =
    '../../features/architect/tradeMachine/OutgoingPlayersList.tsx';
  const ENTITLEMENT_PICKS_LIST_AUTHORITY_SPECIFIER =
    '../../features/architect/tradeMachine/EntitlementPicksList.tsx';

  it('deletes the retired pure leaf shims', () => {
    expect(fs.existsSync(path.join(srcRoot, 'CapImpactTiles.jsx'))).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, 'SelectTeamCard.jsx'))).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, 'OutgoingPlayersList.jsx'))).toBe(
      false
    );
    expect(fs.existsSync(path.join(srcRoot, 'TradePlayerRow.jsx'))).toBe(
      false
    );
    expect(fs.existsSync(path.join(srcRoot, 'EntitlementPickRow.jsx'))).toBe(
      false
    );
    expect(
      fs.existsSync(path.join(srcRoot, 'TradeExceptionManager.jsx'))
    ).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, 'EntitlementPicksList.jsx'))).toBe(
      false
    );
  });

  // updated: Wave 3 export-shape change — these are now named-only exports (see commits 10f5fed7, 692f4f8a)
  it('named-only leaf shims preserve extensionless and authority parity without defaults', async () => {
    const namedLeafCases = [
      {
        authorityPath: 'CapImpactTiles.tsx',
        exportName: 'CapImpactTiles' as const,
        loadExtensionless: () =>
          import('../../features/architect/tradeMachine/CapImpactTiles'),
        loadAuthority: () => import(CAP_IMPACT_TILES_AUTHORITY_SPECIFIER),
        importedValue: CapImpactTiles,
      },
      {
        authorityPath: 'TradePlayerRow.tsx',
        exportName: 'TradePlayerRow' as const,
        loadExtensionless: () =>
          import('../../features/architect/tradeMachine/TradePlayerRow'),
        loadAuthority: () => import(TRADE_PLAYER_ROW_AUTHORITY_SPECIFIER),
        importedValue: TradePlayerRow,
      },
      {
        authorityPath: 'EntitlementPickRow.tsx',
        exportName: 'EntitlementPickRow' as const,
        loadExtensionless: () =>
          import('../../features/architect/tradeMachine/EntitlementPickRow'),
        loadAuthority: () =>
          import(ENTITLEMENT_PICK_ROW_AUTHORITY_SPECIFIER),
        importedValue: EntitlementPickRow,
      },
      {
        authorityPath: 'TradeExceptionManager.tsx',
        exportName: 'TradeExceptionManager' as const,
        loadExtensionless: () =>
          import('../../features/architect/tradeMachine/TradeExceptionManager'),
        loadAuthority: () => import(TRADE_EXCEPTION_MANAGER_AUTHORITY_SPECIFIER),
        importedValue: TradeExceptionManager,
      },
    ];

    for (const { authorityPath, exportName, loadAuthority, loadExtensionless, importedValue } of namedLeafCases) {
      const authoritySource = readAuthoritySource(authorityPath);
      const extensionlessModule = await loadExtensionless() as Record<string, unknown>;
      const authorityModule = await loadAuthority() as Record<string, unknown>;

      expect(authoritySource).not.toContain('export default');
      expect(extensionlessModule[exportName]).toBe(importedValue);
      expect(authorityModule[exportName]).toBe(importedValue);
    }
  });

  it('named-only deleted shims preserve extensionless and authority parity without introducing defaults', async () => {
    const namedOnlyCases = [
      {
        authorityPath: 'SelectTeamCard.tsx',
        exportName: 'SelectTeamCard',
        loadExtensionless: () =>
          import('../../features/architect/tradeMachine/SelectTeamCard'),
        loadAuthority: () => import(SELECT_TEAM_CARD_AUTHORITY_SPECIFIER),
        importedNamed: SelectTeamCard,
      },
      {
        authorityPath: 'OutgoingPlayersList.tsx',
        exportName: 'OutgoingPlayersList',
        loadExtensionless: () =>
          import('../../features/architect/tradeMachine/OutgoingPlayersList'),
        loadAuthority: () =>
          import(OUTGOING_PLAYERS_LIST_AUTHORITY_SPECIFIER),
        importedNamed: OutgoingPlayersList,
      },
    ] as const;

    for (const {
      authorityPath,
      exportName,
      loadAuthority,
      loadExtensionless,
      importedNamed,
    } of namedOnlyCases) {
      const authoritySource = readAuthoritySource(authorityPath);
      const extensionlessModule = (await loadExtensionless()) as Record<
        string,
        unknown
      >;
      const authorityModule = (await loadAuthority()) as Record<string, unknown>;

      expect(authoritySource).toContain(`export const ${exportName}`);
      expect(authoritySource).not.toContain('export default');
      expect(Object.keys(extensionlessModule)).toEqual([exportName]);
      expect(Object.keys(authorityModule)).toEqual([exportName]);
      expect('default' in extensionlessModule).toBe(false);
      expect('default' in authorityModule).toBe(false);
      expect(extensionlessModule[exportName]).toBe(importedNamed);
      expect(authorityModule[exportName]).toBe(importedNamed);
    }
  });

  it('EntitlementPicksList preserves both default and named exports across extensionless and authority imports', async () => {
    const authoritySource = readAuthoritySource('EntitlementPicksList.tsx');
    const authorityModule = await import(
      ENTITLEMENT_PICKS_LIST_AUTHORITY_SPECIFIER
    );

    expect(authoritySource).toContain('export const EntitlementPicksList =');
    expect(authoritySource).toContain('export default EntitlementPicksList;');
    expect(Object.keys(authorityModule).sort()).toEqual([
      'EntitlementPicksList',
      'default',
    ]);
    expect(authorityModule.default).toBe(EntitlementPicksList);
    expect(authorityModule.EntitlementPicksList).toBe(
      NamedEntitlementPicksList
    );
  });
});
