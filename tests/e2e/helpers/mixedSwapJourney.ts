import { type Page } from '@playwright/test';
import { getReviewAdminDb } from './architectReviewWorld';
import { SWAP_PLAYERS, mixedSwapRoutes } from '../fixtures/mixedSwapWorld';

export async function prepareMixedSwap(
  page: Page,
  uid: string,
  worldId: string,
  ids: string[],
  mode = '',
  threeTeam = false
) {
  const root = getReviewAdminDb().doc(`architect_worlds/${worldId}`);
  const routes = mixedSwapRoutes(threeTeam);
  const teams = await Promise.all(
    routes.map(
      async (r) => (await root.collection('teams').doc(r.from).get()).data()!
    )
  );
  const picks = await Promise.all(
    ids.map(async (id) => ({
      id,
      ...(await root.collection('entitlements').doc(id).get()).data(),
    }))
  );
  return page.evaluate(
    async ({ uid, worldId, picks, teams, mode, ordinary, routes }) => {
      const termsPath =
        '/src/features/architect/utils/entitlements/entitlementTerms.ts';
      const previewPath =
        '/src/features/architect/utils/draftReview/simulationPreview.ts';
      const { decorateEntitlementForTrade } = await import(termsPath);
      const { previewRetainedDraftSimulation } = await import(previewPath);
      const args: any = {
        userId: uid,
        worldId,
        mutationType: 'executeTrade',
        seasonId: '2025-26',
        operationId: `mixed_swap_${crypto.randomUUID()}`,
        payload: {
          asOfDate: '2026-06-05',
          tradeCtx: {
            source: 'tradeMachine',
            worldId,
            yearKey: 2026,
            asOfDate: '2026-06-05',
          },
          teams: routes.map(({ from: teamCode, to }, i) => {
            const p = ordinary[i];
            const outgoing = picks
              .filter((p: any) => p.holderTeam === teamCode)
              .map((p) => ({
                ...decorateEntitlementForTrade(p),
                id: p.id,
                entitlementId: p.id,
                toTeamId: i ? 'WAS' : 'MIA',
              }));
            return {
              teamCode,
              sends: [{ id: p.id, playerId: p.id, tradeTo: to }],
              picksOut: [],
              outgoingEntitlements: outgoing,
              entitlementsOut: outgoing,
              cashSent: 0,
              cashToTeamId: null,
              salaryMatchingElection: {
                version: 1,
                path: 'ROOM',
                postAssignmentApronTeamSalary:
                  teams[i].totals.apronTeamSalary -
                  ordinary[i].salary +
                  ordinary[routes.findIndex((r) => r.to === teamCode)].salary,
                tradedPlayerPreTradeSalaries: { [p.id]: p.matching },
              },
            };
          }),
        },
      };
      if (mode === 'incomplete')
        args.payload.teams[0].salaryMatchingElection = null;
      if (mode === 'cash') args.payload.teams[0].cashSent = 1;
      if (mode === 'forged-terms')
        args.payload.teams[0].entitlementsOut[0].poolUnderlyingPickIds = [];
      if (mode === 'forged-contract')
        args.payload.teams[0].sends[0].contract = { salariesByYear: [] };
      if (mode === 'incoming')
        args.payload.teams[1].receives = [{ id: 'unlisted' }];
      if (mode === 'wrong-salary')
        args.payload.teams[0].salaryMatchingElection
          .tradedPlayerPreTradeSalaries[ordinary[0].id]++;
      const third = args.payload.teams[2];
      if (mode === 'duplicate-team') third.teamCode = 'WAS';
      if (mode === 'fourth-team')
        args.payload.teams.push({ ...third, teamCode: 'ORL' });
      if (mode === 'missing-destination') delete third.sends[0].tradeTo;
      if (mode === 'conflicting-destination') third.sends[0].toTeamId = 'MIA';
      if (mode === 'self-destination') third.sends[0].tradeTo = 'PHX';
      if (mode === 'outside-destination') third.sends[0].tradeTo = 'ORL';
      if (mode === 'neutral-third') {
        third.sends = [];
        third.salaryMatchingElection.tradedPlayerPreTradeSalaries = {};
        args.payload.teams[1].sends[0].tradeTo = 'WAS';
      }
      if (mode === 'incomplete-third') third.salaryMatchingElection = null;
      if (mode === 'forged-third-contract')
        third.sends[0].contract = { salariesByYear: [] };
      if (mode === 'wrong-receiver')
        args.payload.teams[0].entitlementsOut[0].toTeamId = 'PHX';
      let result;
      try {
        result = await previewRetainedDraftSimulation(args);
      } catch (e) {
        result = {
          status: 'error',
          reason: e instanceof Error ? e.message : String(e),
        };
      }
      Reflect.set(window, '__mixedSwap', { args, result });
      return result.status === 'prepared'
        ? {
            status: result.status,
            legal: result.preview.legal,
            details: result.details,
            reason: result.preview.reason,
          }
        : result;
    },
    {
      uid,
      worldId,
      picks,
      teams,
      mode,
      ordinary: routes.map((r) => SWAP_PLAYERS[r.from]),
      routes,
    }
  );
}
export async function applyMixedSwap(page: Page, mode = '') {
  return page.evaluate(async (mode) => {
    const modulePath = '/src/features/architect/utils/mutationPipeline.ts';
    const { applyWorldMutation } = await import(modulePath);
    const { args, result } = Reflect.get(window, '__mixedSwap');
    return applyWorldMutation({
      ...args,
      ...(mode === 'changed'
        ? { payload: { ...args.payload, asOfDate: '2026-06-06' } }
        : {}),
      draftReviewAuthority:
        mode === 'forged' ? { ...result.authority } : result.authority,
    });
  }, mode);
}
