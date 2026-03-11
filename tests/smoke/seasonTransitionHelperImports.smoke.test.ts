import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const utilsRoot = path.resolve(__dirname, '../../src/features/architect/utils');

describe('season-transition helper import compatibility', () => {
  it('resolves tpeLifecycle via extensionless and explicit .js imports', async () => {
    const extensionless = await import('@/features/architect/utils/tpeLifecycle');
    const withJs = await import('@/features/architect/utils/tpeLifecycle.js');

    expect(extensionless.processTradeExceptions).toBeTypeOf('function');
    expect(extensionless.getTpeExpiryISO).toBeTypeOf('function');
    expect(withJs.processTradeExceptions).toBe(
      extensionless.processTradeExceptions
    );
    expect(withJs.getTpeExpiryISO).toBe(extensionless.getTpeExpiryISO);
  });

  it('resolves exception lifecycle via barrel, extensionless, and explicit .js imports', async () => {
    const barrel = await import('@/features/architect/utils/exceptions');
    const extensionless = await import(
      '@/features/architect/utils/exceptions/exceptionLifecycle'
    );
    const withJs = await import(
      '@/features/architect/utils/exceptions/exceptionLifecycle.js'
    );

    expect(barrel.resetTeamNonTpeExceptionsForNewSeason).toBeTypeOf('function');
    expect(barrel.validateNonTpeExceptionsForYear).toBeTypeOf('function');
    expect(Array.isArray(barrel.NON_TPE_EXCEPTION_TYPES)).toBe(true);

    expect(extensionless.resetTeamNonTpeExceptionsForNewSeason).toBe(
      barrel.resetTeamNonTpeExceptionsForNewSeason
    );
    expect(withJs.validateNonTpeExceptionsForYear).toBe(
      extensionless.validateNonTpeExceptionsForYear
    );
    expect(withJs.NON_TPE_EXCEPTION_TYPES).toBe(
      extensionless.NON_TPE_EXCEPTION_TYPES
    );
  });

  it('resolves seasonManagerProjection via extensionless and explicit .js imports', async () => {
    const extensionless = await import(
      '@/features/architect/utils/entitlements/seasonManagerProjection'
    );
    const withJs = await import(
      '@/features/architect/utils/entitlements/seasonManagerProjection.js'
    );

    expect(extensionless.projectEntitlementsToSeasonManagerView).toBeTypeOf(
      'function'
    );
    expect(extensionless.__test__selectDraftPicksSource).toBeTypeOf('function');
    expect(extensionless.logDerivedPicksCreation).toBeTypeOf('function');

    expect(withJs.projectEntitlementsToSeasonManagerView).toBe(
      extensionless.projectEntitlementsToSeasonManagerView
    );
    expect(withJs.__test__selectDraftPicksSource).toBe(
      extensionless.__test__selectDraftPicksSource
    );
    expect(withJs.logDerivedPicksCreation).toBe(
      extensionless.logDerivedPicksCreation
    );
  });

  it('kept js files remain pure compatibility shims', () => {
    const tpeShim = fs.readFileSync(
      path.join(utilsRoot, 'tpeLifecycle.js'),
      'utf8'
    );
    const exceptionShim = fs.readFileSync(
      path.join(utilsRoot, 'exceptions/exceptionLifecycle.js'),
      'utf8'
    );
    const projectionShim = fs.readFileSync(
      path.join(utilsRoot, 'entitlements/seasonManagerProjection.js'),
      'utf8'
    );

    expect(tpeShim).toContain("export * from './tpeLifecycle.ts';");
    expect(tpeShim).not.toContain('console.warn');
    expect(tpeShim).not.toContain('new Date(');

    expect(exceptionShim).toContain("export * from './exceptionLifecycle.ts';");
    expect(exceptionShim).not.toContain('getCapRulesForYear');
    expect(exceptionShim).not.toContain('Object.freeze([');

    expect(projectionShim).toContain(
      "export * from './seasonManagerProjection.ts';"
    );
    expect(projectionShim).not.toContain('function parseTeamFromPickId');
    expect(projectionShim).not.toContain('_projectedAt');
  });
});
