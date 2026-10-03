/** Same pinned, supported season inputs for client review and server recomputation. */
import { SyntheticDraftMutationSourceV2Z } from '@/schemas/draftPickReviewMutation';
import { SyntheticDraftSeasonSourceZ } from '@/schemas/draftReviewSeason';
import {
  canonicalStringify,
  sha256Digest,
} from '../contractSource/deterministicDigest';
import { loadDraftPickRelease } from '../draftPickRelease';
import { resolveSeasonAdvanceAuthority } from '../seasonManager.authority';
import { buildSyntheticFreezeEvents } from './seasonEvidence';
import { SYNTHETIC_DRAFT_SEASON_PIN as pin } from './seasonFixturePin';

export async function validateSyntheticSeasonInputs(args: {
  worldId: string;
  metadata: Record<string, unknown>;
  teams: Record<string, Record<string, unknown>>;
  entitlements: Record<string, unknown>;
  eventCount: number;
}) {
  const { worldId, metadata, teams, entitlements } = args;
  if (
    metadata.parentWorldId != null ||
    metadata.draftReviewSeasonReleaseId !== pin.release.id ||
    metadata.draftReviewReleaseId !== pin.release.id ||
    typeof metadata.draftReviewReleaseText !== 'string'
  )
    throw new Error('No separately pinned synthetic lifecycle world.');
  const result = resolveSeasonAdvanceAuthority({
    worldId,
    worldSeason:
      typeof metadata.currentSeason === 'string'
        ? metadata.currentSeason
        : null,
    worldAsOfDate:
      typeof metadata.asOfDate === 'string' ? metadata.asOfDate : null,
  });
  if (result.status !== 'complete')
    throw new Error('Governed season authority is unavailable.');
  const authority = result.authority;
  const loaded = await loadDraftPickRelease(
    metadata.draftReviewReleaseText,
    pin,
    'retained-baseline'
  );
  const getArtifact = async (id: string) => {
    const artifact = loaded.foundation.retainedArtifacts.find(
      (a) => a.id === id
    );
    if (
      !artifact ||
      (await sha256Digest(canonicalStringify(artifact.content))) !==
        `sha256:${artifact.sha256}`
    )
      throw new Error('Synthetic lifecycle artifact integrity failed.');
    return artifact.content;
  };
  const source = SyntheticDraftMutationSourceV2Z.parse(
    await getArtifact('synthetic-mutation-source')
  );
  const lifecycle = SyntheticDraftSeasonSourceZ.parse(
    await getArtifact('synthetic-season-source')
  );
  if (
    metadata.currentSeason !== lifecycle.fromSeason ||
    metadata.asOfDate !== lifecycle.closeDate ||
    authority.toSeason !== source.seasonId ||
    Date.parse(source.asOf) !== Date.parse(lifecycle.effectiveAt)
  )
    throw new Error('Synthetic lifecycle release, season or date changed.');
  if (
    canonicalStringify(Object.keys(teams).sort()) !==
      canonicalStringify(Object.keys(source.teamEntitlementIds).sort()) ||
    canonicalStringify(Object.keys(entitlements).sort()) !==
      canonicalStringify(Object.keys(source.entitlements).sort()) ||
    args.eventCount !== 0 ||
    Number(metadata.actionCount ?? 0) !== 0
  )
    throw new Error(
      'Synthetic lifecycle requires the complete untouched fixture inventory.'
    );
  const measurements: Record<string, unknown> = {};
  for (const [id, team] of Object.entries(teams)) {
    if (
      canonicalStringify(team.entitlementIds) !==
      canonicalStringify(source.teamEntitlementIds[id])
    )
      throw new Error('Synthetic lifecycle ownership inventory changed.');
    measurements[id] = (
      team.salaryBookInputs as Record<string, unknown> | undefined
    )?.seasonCloseApronMeasurement;
    if (
      !Array.isArray(team.roster) ||
      !Array.isArray(team.players) ||
      team.roster.length !== team.players.length ||
      team.players.length !== 18
    )
      throw new Error('Incomplete embedded synthetic roster.');
  }
  for (const [id, value] of Object.entries(entitlements))
    if (
      canonicalStringify(value) !== canonicalStringify(source.entitlements[id])
    )
      throw new Error(
        'Synthetic lifecycle original-pick identity or terms changed.'
      );
  const freezeEvents = buildSyntheticFreezeEvents({
    source: lifecycle,
    measurements,
    worldId,
    releaseId: pin.release.id,
    releaseSha256: pin.payloadSha256,
    effectiveAt: authority.transitionEffectiveAt,
  });
  return { authority, freezeEvents };
}
