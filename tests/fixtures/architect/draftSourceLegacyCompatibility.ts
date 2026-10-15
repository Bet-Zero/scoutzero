/** Synthetic author probe for the existing exact-source archive runner. */
import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

if (
  process.env.SCOUTZERO_REVIEW_CANDIDATE !==
  '8f08d6cb71511db3b4f97790d2426e16c556ddce'
) {
  throw new Error(
    'This probe is qualified only for the inspected production-main source'
  );
}

const target = 'tests/architect/reviewerDraftSourceLegacy.test.ts';
writeFileSync(
  target,
  `
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { db } from '@/firebaseConfig';
import { seedMockData, createMockTeam } from '../helpers/architectTestHelpers';
import { resolveEntitlementsForTeamWithDb, resolveEntitlementWithDb } from '@/features/architect/utils/entitlements/entitlementResolver';
import { resolvePickRuleWithDb } from '@/features/architect/utils/entitlements/pickRulesResolver';
import { projectEntitlementToPickRow } from '@/features/architect/utils/entitlements/entitlementPickRowProjection';
import { projectEntitlementsToSeasonManagerView } from '@/features/architect/utils/entitlements/seasonManagerProjection';
import { buildProtectionLadder } from '@/features/architect/utils/entitlements/dare/protectionLadderFactory';
import { loadTeamCapSheet, getAllTeams } from '@/features/architect/utils/firebaseTeamPlanHelpers';
import { getTeam } from '@/features/architect/utils/teamLoader';

const id='synthetic-original', pickId='LAL_2030_1st', world='legacy-synthetic';
const definition={id,holderTeam:'LAL',kind:'pick_ownership',seasonYear:2030,round:1,underlyingPickId:pickId,description:'synthetic original',underlyingStatus:'encumbered'};
const revision=(fields,legacyExists=true)=>({schemaVersion:1,legacyExists,versions:{'1':fields}});
const before=createMockTeam({teamCode:'LAL',roster:[],entitlementIds:[]});
function installRevision() {
  seedMockData('architect_baseTeams/LAL',{...before,draftSourceRevisions:revision({entitlementIds:[id]})});
  seedMockData('architect_baseEntitlements/'+id,{...definition,draftSourceRevisions:revision({holderTeam:'BOS',description:'Unprotected'})});
  seedMockData('architect_basePickRules/'+pickId,{draftSourceRevisions:revision({pickId,seasonYear:2030,round:1,protections:[],source:'synthetic',updatedAtISO:'2030-01-01T00:00:00Z'},false)});
}
beforeEach(()=>{
  vi.useFakeTimers(); vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
  seedMockData('architect_worlds/'+world,{worldId:world,createdBy:'synthetic',parentWorldId:null,currentSeason:'2029-30'});
  seedMockData('architect_worlds/'+world+'/teams/LAL',{teamCode:'LAL',roster:[]});
  seedMockData('architect_baseTeams/LAL',before);
  seedMockData('architect_baseEntitlements/'+id,definition);
});
afterEach(()=>vi.useRealTimers());
it('old world and base membership remain unchanged after source revisions',async()=>{
  const previous=await resolveEntitlementsForTeamWithDb(db,world,'LAL');
  installRevision();
  expect(await resolveEntitlementsForTeamWithDb(db,world,'LAL')).toEqual(previous);
  expect(await resolveEntitlementsForTeamWithDb(db,null,'LAL')).toEqual([]);
  expect((await getTeam(world,'LAL')).entitlementIds).toEqual([]);
});
it('old pick display, season projection and protection ladder do not interpret the envelope as active terms',async()=>{
  const oldDefinition=await resolveEntitlementWithDb(db,null,id);
  expect(await resolvePickRuleWithDb(db,pickId)).toBeNull();
  const row=projectEntitlementToPickRow(oldDefinition,{teamCode:'LAL',pickRulesById:{}});
  const season=projectEntitlementsToSeasonManagerView({entitlements:[oldDefinition],teamCode:'LAL',pickRulesById:{}});
  const ladder=buildProtectionLadder(null,oldDefinition);
  installRevision();
  const afterDefinition=await resolveEntitlementWithDb(db,null,id);
  const rule=await resolvePickRuleWithDb(db,pickId);
  const rules={[pickId]:rule};
  expect(afterDefinition.holderTeam).toBe('LAL');
  expect(projectEntitlementToPickRow(afterDefinition,{teamCode:'LAL',pickRulesById:rules})).toEqual(row);
  expect(projectEntitlementsToSeasonManagerView({entitlements:[afterDefinition],teamCode:'LAL',pickRulesById:rules})).toEqual(season);
  expect(buildProtectionLadder(rule,afterDefinition)).toEqual(ladder);
});
it('old base-only dashboard readers tolerate the envelope without acquiring new membership',async()=>{
  const list=await getAllTeams();
  installRevision();
  const team=await loadTeamCapSheet('LAL');
  expect(team).not.toBeNull();
  expect(team.entitlementIds).toEqual([]);
  expect(await getAllTeams()).toEqual(list);
});
`
);
const result = spawnSync(
  'npm',
  ['run', 'test:node', '--', target, '--reporter=dot'],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: process.env,
  }
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
