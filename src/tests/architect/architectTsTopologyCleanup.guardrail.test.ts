/**
 * FILE: src/tests/architect/architectTsTopologyCleanup.guardrail.test.ts
 * PURPOSE: Guardrail coverage for the Architect shared-barrel TS topology cleanup pass.
 * OWNERSHIP: Feature: architect
 *
 * HISTORY:
 *  - 2026-03-20: Added filesystem and resolver-target proof for the shared filters/contracts barrel cleanup.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { createServer, type ViteDevServer } from 'vite';

const repoRoot = path.resolve(__dirname, '../../..');
const filtersRoot = path.join(repoRoot, 'src/shared/components/ui/filters');
const contractsRoot = path.join(repoRoot, 'src/shared/utils/contracts');

const callerCases = [
  {
    label: 'FreeAgencyFilterBar',
    importerRelativePath:
      'src/features/architect/freeAgency/FreeAgentPool/FreeAgencyFilterBar.tsx',
    specifier: '@/shared/components/ui/filters',
    expectedAuthorityRelativePath:
      'src/shared/components/ui/filters/index.ts',
  },
  {
    label: 'TradeExportCapture',
    importerRelativePath:
      'src/features/architect/tradeMachine/TradeExportCapture.tsx',
    specifier: '@/shared/utils/contracts',
    expectedAuthorityRelativePath: 'src/shared/utils/contracts/index.ts',
  },
] as const;

const barrelCases = [
  {
    label: 'shared filters barrel',
    authorityPath: path.join(filtersRoot, 'index.ts'),
    shimPath: path.join(filtersRoot, 'index.js'),
    expectedShimSource: "export * from './index.ts';",
  },
  {
    label: 'shared contracts barrel',
    authorityPath: path.join(contractsRoot, 'index.ts'),
    shimPath: path.join(contractsRoot, 'index.js'),
    expectedShimSource: "export * from './index.ts';",
  },
] as const;

const configPath = ts.findConfigFile(repoRoot, ts.sys.fileExists, 'tsconfig.json');

if (!configPath) {
  throw new Error('Could not find tsconfig.json for topology cleanup guardrail');
}

const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  repoRoot
);
const compilerHost = ts.createCompilerHost(parsedConfig.options, true);

let viteServer: ViteDevServer | null = null;

function normalizeRelative(filePath: string) {
  return filePath.replaceAll(path.sep, '/');
}

function stripQuerySuffix(filePath: string) {
  return filePath.split('?')[0];
}

function relativeFromRepo(filePath: string) {
  return normalizeRelative(path.relative(repoRoot, filePath));
}

function resolveWithTypeScript(specifier: string, importerRelativePath: string) {
  const importerAbsolutePath = path.join(repoRoot, importerRelativePath);
  const resolved = ts.resolveModuleName(
    specifier,
    importerAbsolutePath,
    parsedConfig.options,
    compilerHost
  ).resolvedModule;

  return resolved?.resolvedFileName
    ? relativeFromRepo(stripQuerySuffix(resolved.resolvedFileName))
    : null;
}

async function resolveWithVite(specifier: string, importerRelativePath: string) {
  if (!viteServer) {
    throw new Error('Vite dev server was not initialized');
  }

  const importerAbsolutePath = path.join(repoRoot, importerRelativePath);
  const resolved = await viteServer.pluginContainer.resolveId(
    specifier,
    importerAbsolutePath
  );

  return resolved?.id ? relativeFromRepo(stripQuerySuffix(resolved.id)) : null;
}

beforeAll(async () => {
  viteServer = await createServer({
    configFile: path.join(repoRoot, 'vite.config.js'),
    logLevel: 'silent',
    server: {
      middlewareMode: true,
    },
  });
}, 15000);

afterAll(async () => {
  await viteServer?.close();
});

describe('Architect TS topology cleanup guardrails', () => {
  for (const barrelCase of barrelCases) {
    it(`keeps ${barrelCase.label} backed by a TS authority`, () => {
      expect(fs.existsSync(barrelCase.authorityPath)).toBe(true);
    });

    it(`confirms ${barrelCase.label} legacy index.js shim has been deleted`, () => {
      expect(fs.existsSync(barrelCase.shimPath)).toBe(false);
    });
  }

  for (const callerCase of callerCases) {
    it(`resolves ${callerCase.label} through the TS authority in TypeScript`, () => {
      expect(
        resolveWithTypeScript(callerCase.specifier, callerCase.importerRelativePath)
      ).toBe(callerCase.expectedAuthorityRelativePath);
    });

    it(
      `resolves ${callerCase.label} through the TS authority in Vite`,
      async () => {
        expect(
          await resolveWithVite(
            callerCase.specifier,
            callerCase.importerRelativePath
          )
        ).toBe(callerCase.expectedAuthorityRelativePath);
      },
      15000
    );
  }
});
