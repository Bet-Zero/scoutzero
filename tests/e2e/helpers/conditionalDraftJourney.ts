import type { Page } from '@playwright/test';
import { getReviewAdminDb } from './architectReviewWorld';

export async function conditionalState(worldId: string) {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  return {
    metadata: (await root.get()).data(),
    children: await Promise.all(
      ['teams', 'entitlements', 'events', 'seasonHistory'].map(
        async (name) => ({
          name,
          docs: (await root.collection(name).get()).docs.map((d) => ({
            id: d.id,
            data: d.data(),
          })),
        })
      )
    ),
  };
}

export async function prepareConditionalTrade(
  page: Page,
  uid: string,
  worldId: string,
  outgoingIds: string[],
  teamCodes = ['TOR', 'MIA']
) {
  const docs = await Promise.all(
    outgoingIds.map(async (id) => ({
      id,
      ...(
        await getReviewAdminDb()
          .doc(`architect_worlds/${worldId}/entitlements/${id}`)
          .get()
      ).data(),
    }))
  );
  return page.evaluate(
    async ({ uid, worldId, docs, teamCodes }) => {
      const previewPath =
        '/src/features/architect/utils/draftReview/simulationPreview.ts';
      const termsPath =
        '/src/features/architect/utils/entitlements/entitlementTerms.ts';
      const { previewRetainedDraftSimulation } = await import(previewPath);
      const { decorateEntitlementForTrade } = await import(termsPath);
      const teams = teamCodes.map((teamCode) => {
        const outgoing = docs
          .filter((d) => Reflect.get(d, 'holderTeam') === teamCode)
          .map((d) => ({
            ...decorateEntitlementForTrade(d),
            entitlementId: d.id,
            id: d.id,
            toTeamId: teamCodes.find((t) => t !== teamCode),
          }));
        return {
          teamCode,
          sends: [],
          picksOut: [],
          outgoingEntitlements: outgoing,
          entitlementsOut: outgoing,
          salaryMatchingElection: null,
          cashSent: 0,
          cashToTeamId: null,
        };
      });
      const args = {
        userId: uid,
        worldId,
        mutationType: 'executeTrade',
        seasonId: '2025-26',
        operationId: `conditional_${crypto.randomUUID()}`,
        payload: {
          teams,
          asOfDate: '2026-06-05',
          tradeCtx: {
            source: 'tradeMachine',
            worldId,
            yearKey: 2026,
            asOfDate: '2026-06-05',
          },
        },
      };
      try {
        const result = await previewRetainedDraftSimulation(args);
        Reflect.set(window, '__conditionalTrade', { args, result });
        return result.status === 'prepared'
          ? {
              status: result.status,
              legal: result.preview.legal,
              reason: result.preview.reason,
            }
          : result;
      } catch (e) {
        return {
          status: 'error',
          reason: e instanceof Error ? e.message : String(e),
        };
      }
    },
    { uid, worldId, docs, teamCodes }
  );
}

export async function applyConditionalTrade(page: Page) {
  return page.evaluate(async () => {
    const modulePath = '/src/features/architect/utils/mutationPipeline.ts';
    const { applyWorldMutation } = await import(modulePath);
    const { args, result } = Reflect.get(window, '__conditionalTrade');
    return applyWorldMutation({
      ...args,
      draftReviewAuthority: result.authority,
    });
  });
}

export async function conditionalDraft(
  page: Page,
  worldId: string,
  request: {
    operationId: string;
    expectedRevision: number;
    draftYear: number;
    positions: Record<string, number>;
  }
) {
  return page.evaluate(
    async ({ worldId, request }) => {
      const modulePath = '/src/features/architect/utils/seasonManager.ts';
      const { advanceConditionalDraftInWorld } = await import(modulePath);
      try {
        return {
          success: true,
          result: await advanceConditionalDraftInWorld(worldId, request),
        };
      } catch (e) {
        return {
          success: false,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    },
    { worldId, request }
  );
}
