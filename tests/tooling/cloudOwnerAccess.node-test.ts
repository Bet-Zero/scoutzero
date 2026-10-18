import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cloudOwnerScope, configureCloudOwnerAccess, validateTrust } from '../../scripts/dev/cloudOwnerAccess.js';
import * as policy from '../../scripts/dev/cloudAccessPolicy.js';

const trust = { issuer: 'https://issuer.example.invalid', audience: 'test-audience', subject: 'environment:test' };
function fixture(overrides: Record<string, any> = {}) {
  const calls: string[][] = [];
  const project = policy.CLOUD_DATA_PROJECT;
  const response: Record<string, any> = {
    'projects describe': { projectId: project, projectNumber: policy.CLOUD_DATA_PROJECT_NUMBER },
    'projects get-iam-policy': { bindings: [] },
    'firestore databases describe': { locationId: 'nam5' },
    'storage buckets describe': { project_number: policy.CLOUD_DATA_PROJECT_NUMBER, public_access_prevention: 'enforced', uniform_bucket_level_access: true },
    'auth print-access-token': 'SYNTHETIC_TEST_AUTH',
    ...overrides,
  };
  const run = (args: string[]) => {
    calls.push(args);
    const key = Object.keys(response).find((key) => args.slice(0, key.split(' ').length).join(' ') === key);
    if (key) return response[key];
    if (args.includes('describe')) throw new Error('NOT_FOUND');
    return {};
  };
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(String(url), 'https://firebasestorage.googleapis.com/v1beta/projects/105500121903/buckets/' + policy.CLOUD_DATA_BUCKET);
    assert.equal(init?.redirect, 'error');
    return Response.json({ error: { status: 'NOT_FOUND' } }, { status: 404 });
  };
  return { run, calls, fetcher };
}
test('owner preview has no credentials and the applied scope grants reads plus private immutable backup only', async () => {
  const preview = cloudOwnerScope(); assert.equal(preview.createsServiceAccountKey, false);
  const f = fixture(); const result = await configureCloudOwnerAccess(trust, f.run, f.fetcher);
  assert.equal(result.configured, true); assert.equal(result.writesProductionDatabase, false);
  const commands = f.calls.map((args) => args.join(' ')).join('\n');
  assert(commands.includes('--permissions=' + policy.CLOUD_DATA_SOURCE_PERMISSIONS.join(',')));
  assert(commands.includes('--permissions=' + policy.CLOUD_DATA_RECOVERY_PERMISSIONS.join(',')));
  assert(commands.includes('--attribute-condition=assertion.sub == "environment:test"'));
  assert(commands.includes('/subject/environment:test'));
  assert(!/datastore.entities.(create|update|delete)|storage.objects.delete|roles\/(owner|editor)|service-accounts keys|billing|bze-321/.test(commands));
  for (const args of f.calls.filter((args) => args[0] !== 'auth')) assert(args.includes('--project=' + policy.CLOUD_DATA_PROJECT));
  assert.deepEqual(policy.CLOUD_DATA_RECOVERY_PERMISSIONS, ['storage.buckets.get', 'storage.objects.get', 'storage.objects.create']);
});
test('owner setup rejects identity, private storage, existing broad grants and mismatched trust before granting access', async () => {
  for (const overrides of [
    { 'projects describe': { projectNumber: 'wrong', projectId: policy.CLOUD_DATA_PROJECT } },
    { 'projects get-iam-policy': { bindings: [{ role: 'roles/editor', members: ['serviceAccount:' + policy.CLOUD_DATA_ACCOUNT] }] } },
    { 'storage buckets describe': { project_number: policy.CLOUD_DATA_PROJECT_NUMBER, public_access_prevention: 'inherited', uniform_bucket_level_access: true } },
    { 'iam workload-identity-pools providers describe': { oidc: { issuerUri: 'https://wrong.example.invalid' } } },
    { 'iam roles describe': { includedPermissions: ['datastore.entities.update'] } },
  ]) {
    const f = fixture(overrides);
    await assert.rejects(() => configureCloudOwnerAccess(trust, f.run, f.fetcher));
    assert(!f.calls.some((args) => args.includes('add-iam-policy-binding')));
  }
  const f = fixture();
  await assert.rejects(() => configureCloudOwnerAccess(trust, f.run, async () => Response.json({ name: 'registered' })), /Firebase-registered/);
  assert(!f.calls.some((args) => args.includes('add-iam-policy-binding')));
  for (const details of [{ ...trust, issuer: 'http://issuer.example.invalid' }, { ...trust, subject: '*' }, { ...trust, audience: 'a,b' }]) assert.throws(() => validateTrust(details));
});
