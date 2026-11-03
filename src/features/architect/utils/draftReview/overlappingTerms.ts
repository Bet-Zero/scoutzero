import { DraftOverlappingPoolProgramZ } from '@/schemas/draftOverlappingPool';
import {
  canonicalStringify,
  sha256Digest,
} from '../contractSource/deterministicDigest';

/** BZE-309: independently accepted replacement v2, owner-admitted for protected
 * saved-world use. Private source bytes and bindings are not bundled.
 * Positions, elections and outcomes are deliberately excluded from this pin.
 * This grants no production authority or certification of observed NBA inputs.
 */
export const OVERLAPPING_TERMS_SHA256 =
  'sha256:230f39b559b01398f753d810824f2e906a5c83a58616622cc7029569f7477ac8';

/** Retired input: authenticate saved history only, never admit a new operation.
 * Keep this identity even though the original external input is unavailable.
 */
export const HISTORICAL_OVERLAPPING_TERMS_SHA256 =
  'sha256:6856c1d73e9fd6cc1be33feb3d15f3a132f7fe4c3773e858f433c83fb0ca32ed';

export async function verifyStoredOverlappingTerms(input: unknown) {
  const program = DraftOverlappingPoolProgramZ.parse(input);
  const digest = await sha256Digest(
    canonicalStringify({ ...program, result: null })
  );
  if (
    digest !== OVERLAPPING_TERMS_SHA256 &&
    digest !== HISTORICAL_OVERLAPPING_TERMS_SHA256
  )
    throw new Error(
      'Overlapping governing terms differ from the reviewed source-linked program.'
    );
  return {
    program,
    historical: digest === HISTORICAL_OVERLAPPING_TERMS_SHA256,
  };
}

export async function requireAdmittedOverlappingTerms(input: unknown) {
  const verified = await verifyStoredOverlappingTerms(input);
  if (verified.historical)
    throw new Error(
      'This world retains historical overlapping terms. Its saved history is readable, but new operations require the admitted replacement program in a separate world.'
    );
  return verified.program;
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
    await verifyStoredOverlappingTerms(trade.assumptions.nativeTrade.program);
  const receipt = Reflect.get(metadata, 'swapDraftReceipt');
  if (!receipt || typeof receipt !== 'object') return;
  const before = Reflect.get(receipt, 'before');
  const after = Reflect.get(receipt, 'after');
  if ([before, after].some((p) => p?.kind === 'native-overlapping-pool-v1')) {
    const previous = await verifyStoredOverlappingTerms(before);
    const next = await verifyStoredOverlappingTerms(after);
    if (previous.historical !== next.historical)
      throw new Error('A saved resolution cannot change its governing terms.');
  }
}
