/** Server-only exact PR #659 bytes. No network storage, client paths or latest aliases. */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import {
  TrustedContractReleaseRegistry,
  RETAINED_TRUSTED_CONTRACT_RELEASES,
  DEFAULT_TRUSTED_CONTRACT_RELEASE,
} from './trustedContractBaseline';
import { parseSimulationFinancialBaseline } from './simulationFinancialBaseline';
import { parseSimulationDraftBaseline } from './simulationDraftBaseline';

export const CURRENT_WORLD_PACKAGES = Object.freeze({
  financial: {
    filename: 'financial-current-v4.json',
    bytes: 14685658,
    sha256: '577df3452b1c54cfcd80d14d96f7b1adb35dff2c967bf386c7171190eee05419',
  },
  draft: {
    filename: 'draft-connected-v5.json',
    bytes: 831226,
    sha256: '43d725448133c416b93af0d82529cb3f6c6021a01be07a6030b493987ffbf331',
  },
});

export function verifyWorldPackageBytes(
  kind: keyof typeof CURRENT_WORLD_PACKAGES,
  bytes: Buffer
): Buffer {
  const pin = CURRENT_WORLD_PACKAGES[kind];
  if (
    bytes.length !== pin.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== pin.sha256
  )
    throw new Error('Private world package digest mismatch.');
  return bytes;
}

export function readPrivateWorldPackages(directory: string) {
  // Deployment assets must live under the directory already denied by Vite
  // and ignored by Git. They are never copied into public/ or dist/.
  const allowed = realpathSync(resolve('.scoutzero-dev')) + sep;
  const root = realpathSync(directory);
  if (!root.startsWith(allowed))
    throw new Error(
      'Private world package directory is outside the protected server assets.'
    );
  const read = (kind: keyof typeof CURRENT_WORLD_PACKAGES) => {
    const pin = CURRENT_WORLD_PACKAGES[kind];
    const file = realpathSync(join(root, pin.filename));
    if (!file.startsWith(root + sep) || statSync(file).size !== pin.bytes)
      throw new Error('Private world package size/path mismatch.');
    return verifyWorldPackageBytes(kind, readFileSync(file));
  };
  const financial = parseSimulationFinancialBaseline(read('financial'));
  const draft = parseSimulationDraftBaseline(read('draft'));
  return { financial, draft };
}

// Public historical artifact stays pinned; private current bytes never use this directory.
export const httpRetainedContractRegistry = new TrustedContractReleaseRegistry({
  releases: RETAINED_TRUSTED_CONTRACT_RELEASES,
  defaultRelease: DEFAULT_TRUSTED_CONTRACT_RELEASE,
  readArtifact: (descriptor) =>
    readFileSync(
      resolve('public/architect/contract-source-releases', descriptor.filename)
    ),
});
