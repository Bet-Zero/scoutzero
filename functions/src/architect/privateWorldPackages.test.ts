import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, rmdirSync } from 'node:fs';
import {
  CURRENT_WORLD_PACKAGES,
  verifyWorldPackageBytes,
  readPrivateWorldPackages,
} from './privateWorldPackages';

describe('private current world package protection', () => {
  const createdDirectory = !existsSync('.scoutzero-dev');
  beforeAll(() =>
    mkdirSync('.scoutzero-dev', { recursive: true, mode: 0o700 })
  );
  afterAll(() => {
    if (createdDirectory) rmdirSync('.scoutzero-dev');
  });
  it.each(['financial', 'draft'] as const)(
    'rejects wrong size and same-size tampered %s bytes',
    (kind) => {
      expect(() => verifyWorldPackageBytes(kind, Buffer.from('{}'))).toThrow(
        'digest mismatch'
      );
      expect(() =>
        verifyWorldPackageBytes(
          kind,
          Buffer.alloc(CURRENT_WORLD_PACKAGES[kind].bytes)
        )
      ).toThrow('digest mismatch');
    }
  );
  it('refuses a public package location', () => {
    expect(() =>
      readPrivateWorldPackages('../public/architect/contract-source-releases')
    ).toThrow('outside the protected server assets');
  });
});
