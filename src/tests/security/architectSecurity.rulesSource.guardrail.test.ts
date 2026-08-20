import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rulesPath = path.resolve(__dirname, '../../../firestore.rules');

function readRules(): string {
  expect(fs.existsSync(rulesPath)).toBe(true);
  return fs.readFileSync(rulesPath, 'utf8');
}

describe('Architect security rules source guardrails', () => {
  it('has no global allow true', () => {
    const rules = readRules();
    expect(rules).not.toMatch(/allow\s+read\s*,\s*write\s*:\s*if\s*true\s*;/);
  });

  it('includes fail-closed fallback deny', () => {
    const rules = readRules();
    expect(rules).toMatch(
      /match\s*\/\{document=\*\*\}\s*\{[\s\S]*allow\s+read\s*,\s*write\s*:\s*if\s*false\s*;/
    );
  });

  it('uses createdBy owner-gating for architect_worlds', () => {
    const rules = readRules();
    expect(rules).toMatch(/function\s+isWorldOwner\s*\(\s*worldId\s*\)/);
    expect(rules).toMatch(/function\s+isWorldMetadataOwner\s*\(\s*\)/);
    expect(rules).toMatch(/architect_worlds\/\$\(worldId\)/);
    expect(rules).toMatch(/\.data\.createdBy\s*==\s*request\.auth\.uid/);
    expect(rules).toMatch(
      /allow\s+get\s*,\s*list\s*:\s*if\s+isWorldMetadataOwner\(\)\s*;/
    );
    expect(rules).toMatch(/match\s+\/architect_worlds\/\{worldId\}/);
  });

  it('makes Offer Sheet authorization anchors create-once and owner-scoped', () => {
    const rules = readRules();
    expect(rules).toMatch(
      /match\s+\/offerSheetAuthorizations\/\{offerSheetId\}/
    );
    expect(rules).toMatch(
      /allow\s+create\s*:\s*if\s+isOpenForClientWorldWrites\(worldId\)/
    );
    expect(rules).toMatch(
      /request\.resource\.data\.pendingLifecycleDigest\.matches\('\^fnv1a64:\[0-9a-f\]\{16\}\$'\)/
    );
    expect(rules).toMatch(/allow\s+update\s*,\s*delete\s*:\s*if\s*false\s*;/);
  });

  it('explicitly denies writes to base collections and root teams', () => {
    const rules = readRules();
    const denyBlocks = [
      'architect_basePlayers',
      'architect_baseTeams',
      'architect_baseEntitlements',
      'architect_basePickRules',
      'teams',
    ];

    for (const collection of denyBlocks) {
      const block = new RegExp(
        `match\\s+\\/${collection}\\/\\{[^}]+\\}\\s*\\{[\\s\\S]*allow\\s+write\\s*:\\s*if\\s*false\\s*;`,
        'm'
      );
      expect(rules).toMatch(block);
    }
  });

  it('keeps lists and tierLists strict owner-only without auto-claim logic', () => {
    const rules = readRules();
    const listBlockMatch = rules.match(
      /match\s+\/lists\/\{listId\}\s*\{([\s\S]*?)\n\s*\}/m
    );
    const tierListBlockMatch = rules.match(
      /match\s+\/tierLists\/\{tierListId\}\s*\{([\s\S]*?)\n\s*\}/m
    );

    expect(listBlockMatch?.[1]).toBeTruthy();
    expect(tierListBlockMatch?.[1]).toBeTruthy();

    const listBlock = listBlockMatch?.[1] || '';
    const tierListBlock = tierListBlockMatch?.[1] || '';

    expect(listBlock).toMatch(
      /allow\s+create\s*:\s*if[\s\S]*request\.resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );
    expect(listBlock).toMatch(
      /allow\s+read\s*:\s*if[\s\S]*resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );
    expect(listBlock).toMatch(
      /allow\s+update\s*:\s*if[\s\S]*resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );
    expect(listBlock).toMatch(
      /allow\s+delete\s*:\s*if[\s\S]*resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );

    expect(tierListBlock).toMatch(
      /allow\s+create\s*:\s*if[\s\S]*request\.resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );
    expect(tierListBlock).toMatch(
      /allow\s+read\s*:\s*if[\s\S]*resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );
    expect(tierListBlock).toMatch(
      /allow\s+update\s*:\s*if[\s\S]*resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );
    expect(tierListBlock).toMatch(
      /allow\s+delete\s*:\s*if[\s\S]*resource\.data\.ownerUid\s*==\s*request\.auth\.uid/
    );

    expect(rules).not.toMatch(/!'ownerUid'\s+in\s+resource\.data/);
    expect(rules).not.toMatch(/!\('ownerUid'\s+in\s+resource\.data\)/);
    expect(rules).not.toMatch(/auto-claim/i);
  });
});
