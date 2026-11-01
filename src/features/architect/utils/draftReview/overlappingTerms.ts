import { DraftOverlappingPoolProgramZ } from '@/schemas/draftOverlappingPool';
import {
  canonicalStringify,
  sha256Digest,
} from '../contractSource/deterministicDigest';

/** Reviewed source-linked terms only. Private source bytes are not bundled.
 * Positions, elections and outcomes are deliberately excluded from this pin.
 * This grants no production authority or certification of observed NBA inputs.
 */
export const OVERLAPPING_TERMS_SHA256 =
  'sha256:6856c1d73e9fd6cc1be33feb3d15f3a132f7fe4c3773e858f433c83fb0ca32ed';

export async function requireAdmittedOverlappingTerms(input: unknown) {
  const program = DraftOverlappingPoolProgramZ.parse(input);
  const digest = await sha256Digest(
    canonicalStringify({ ...program, result: null })
  );
  if (digest !== OVERLAPPING_TERMS_SHA256)
    throw new Error(
      'Overlapping governing terms differ from the reviewed source-linked program.'
    );
  return program;
}
