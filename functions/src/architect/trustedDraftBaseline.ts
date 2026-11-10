/** No deployed real draft source. A pinned test release can be used only locally. */
import { createHash } from 'node:crypto';
import fixture from './fixtures/governedDraftWorld.json';
import pin from './fixtures/governedDraftWorldPin.json';
import { canonicalStringify } from './trustedContractBaseline';

export function loadTrustedDraftBaseline() {
  const selected = process.env.SCOUTZERO_GOVERNED_DRAFT_FIXTURE;
  if (!selected) return null;
  if (
    process.env.FUNCTIONS_EMULATOR !== 'true' ||
    !(process.env.GCLOUD_PROJECT ?? '').startsWith('demo-') ||
    !/^127\.0\.0\.1:\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '') ||
    selected !== pin.releaseId
  )
    throw new Error(
      'The governed draft fixture requires the local demo emulator.'
    );
  const sha256 = createHash('sha256')
    .update(canonicalStringify(fixture))
    .digest('hex');
  if (
    sha256 !== pin.sha256 ||
    fixture.releaseId !== pin.releaseId ||
    fixture.classification !== 'software-fixture'
  )
    throw new Error('Governed draft fixture integrity failed.');
  return {
    baseline: fixture,
    metadata: {
      version: 1,
      ...pin,
      asOf: fixture.asOf,
      seasonId: fixture.seasonId,
    },
  };
}
