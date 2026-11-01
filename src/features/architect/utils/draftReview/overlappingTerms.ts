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

/** Stored events are not source authority by themselves. History and Compare
 * must authenticate this family's terms before displaying an allocation.
 */
export async function requireAdmittedOverlappingEvent(
  event: Record<string, unknown>
) {
  const metadata = event.metadata;
  if (!metadata || typeof metadata !== 'object') return;
  const trade = Reflect.get(metadata, 'draftReviewReceipt');
  if (
    trade?.assumptions?.nativeTrade?.program?.kind ===
    'native-overlapping-pool-v1'
  )
    await requireAdmittedOverlappingTerms(
      trade.assumptions.nativeTrade.program
    );
  const receipt = Reflect.get(metadata, 'swapDraftReceipt');
  if (!receipt || typeof receipt !== 'object') return;
  const before = Reflect.get(receipt, 'before');
  const after = Reflect.get(receipt, 'after');
  if ([before, after].some((p) => p?.kind === 'native-overlapping-pool-v1')) {
    await requireAdmittedOverlappingTerms(before);
    await requireAdmittedOverlappingTerms(after);
  }
}
