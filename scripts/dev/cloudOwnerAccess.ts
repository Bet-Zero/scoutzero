/** Run once by the project owner in Google Cloud Shell; preview is the default. */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CLOUD_DATA_PROJECT as PROJECT, CLOUD_DATA_PROJECT_NUMBER as NUMBER, CLOUD_DATA_ACCOUNT_ID as ACCOUNT_ID,
  CLOUD_DATA_ACCOUNT as ACCOUNT, CLOUD_DATA_POOL as POOL, CLOUD_DATA_PROVIDER as PROVIDER, CLOUD_DATA_BUCKET as BUCKET,
  CLOUD_DATA_SOURCE_ROLE as SOURCE_ROLE, CLOUD_DATA_RECOVERY_ROLE as RECOVERY_ROLE,
  CLOUD_DATA_SOURCE_PERMISSIONS as READ_PERMISSIONS, CLOUD_DATA_RECOVERY_PERMISSIONS as RECOVERY_PERMISSIONS,
  CLOUD_DATA_ADDITIONAL_HOSTS,
} from './cloudAccessPolicy.ts';

export type TrustDetails = { issuer: string; audience: string; subject: string };
export function validateTrust(details: TrustDetails) {
  const issuer = new URL(details.issuer);
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.port || issuer.search || issuer.hash ||
      !details.audience || /[\s,]/.test(details.audience) || details.audience.length > 512 ||
      !/^[A-Za-z0-9_:/.@~=-]{1,127}$/.test(details.subject)) throw new Error('Use the exact non-secret Issuer, Audience and Subject displayed by the environment Google connection; unsupported values fail closed');
}
export function cloudOwnerScope(details?: TrustDetails) {
  if (details) validateTrust(details);
  return { project: PROJECT, projectNumber: NUMBER, account: ACCOUNT, pool: POOL, provider: PROVIDER,
    bucket: BUCKET, sourcePermissions: READ_PERMISSIONS, bucketOnlyPermissions: RECOVERY_PERMISSIONS,
    additionalAllowedHosts: CLOUD_DATA_ADDITIONAL_HOSTS, trust: details || 'Required from Advanced > OIDC; never guessed',
    createsServiceAccountKey: false, writesProductionDatabase: false, changesRules: false, changesBilling: false,
    boundary: 'Separate keyless source reader/private recovery identity. Existing draft-pick identities, trust and publishers are untouched.' };
}
type Runner = (args: string[]) => any;
function equalPermissions(actual: string[], expected: string[]) { return JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort()); }
export async function configureCloudOwnerAccess(details: TrustDetails, run: Runner, fetcher: typeof fetch = fetch) {
  validateTrust(details);
  const projectArgs = ['--project=' + PROJECT, '--format=json', '--quiet'];
  const invoke = (args: string[]) => run([...args, ...projectArgs]);
  const find = (args: string[]) => { try { return invoke(args); } catch (error) { if ((error as Error).message === 'NOT_FOUND') return null; throw error; } };
  const project = invoke(['projects', 'describe', PROJECT]);
  if (String(project.projectNumber) !== NUMBER || project.projectId !== PROJECT) throw new Error('Owner setup project identity mismatch');
  // These are the existing provider/service APIs needed by keyless reads and
  // recovery. No new project, billing account, writer role or app rule change.
  invoke(['services', 'enable', 'iam.googleapis.com', 'iamcredentials.googleapis.com', 'sts.googleapis.com', 'cloudresourcemanager.googleapis.com', 'storage.googleapis.com', 'firebasestorage.googleapis.com']);
  function role(id: string, permissions: string[]) {
    const existing = find(['iam', 'roles', 'describe', id]);
    if (existing) {
      if (existing.deleted || existing.stage === 'DISABLED' || !equalPermissions(existing.includedPermissions || [], permissions)) throw new Error('Existing cloud role differs from the reviewed scope; it was not modified');
    } else invoke(['iam', 'roles', 'create', id, '--title=ScoutZero cloud ' + id, '--permissions=' + permissions.join(','), '--stage=GA']);
  }
  role(SOURCE_ROLE, READ_PERMISSIONS); role(RECOVERY_ROLE, RECOVERY_PERMISSIONS);
  const serviceAccount = find(['iam', 'service-accounts', 'describe', ACCOUNT]);
  if (!serviceAccount) invoke(['iam', 'service-accounts', 'create', ACCOUNT_ID, '--display-name=ScoutZero cloud source reads and private recovery']);
  else if (serviceAccount.disabled) throw new Error('Existing cloud reader is disabled');
  const sourceRole = 'projects/' + PROJECT + '/roles/' + SOURCE_ROLE;
  const principal = 'principal://iam.googleapis.com/projects/' + NUMBER + '/locations/global/workloadIdentityPools/' + POOL + '/subject/' + details.subject;
  const policy = invoke(['projects', 'get-iam-policy', PROJECT]);
  if ((policy.bindings || []).some((b: any) => b.members?.includes('serviceAccount:' + ACCOUNT) && b.role !== sourceRole)) throw new Error('Cloud reader already has an unexpected project role; owner review is required');
  const accountPolicy = invoke(['iam', 'service-accounts', 'get-iam-policy', ACCOUNT]);
  if ((accountPolicy.bindings || []).some((b: any) => b.role !== 'roles/iam.workloadIdentityUser' || b.condition ||
      b.members?.some((member: string) => member !== principal))) throw new Error('Cloud reader has unexpected impersonation trust; no existing trust was changed');
  const database = invoke(['firestore', 'databases', 'describe', '--database=(default)']);
  const locationId = database.locationId;
  if (typeof locationId !== 'string' || !/^[a-z0-9-]+$/.test(locationId)) throw new Error('Could not determine the existing database location');
  const location = locationId.startsWith('nam') ? 'US' : locationId.startsWith('eur') ? 'EU' : locationId.toUpperCase();
  let bucket = find(['storage', 'buckets', 'describe', 'gs://' + BUCKET]);
  if (!bucket) {
    invoke(['storage', 'buckets', 'create', 'gs://' + BUCKET, '--location=' + location, '--default-storage-class=STANDARD', '--uniform-bucket-level-access', '--public-access-prevention']);
    bucket = invoke(['storage', 'buckets', 'describe', 'gs://' + BUCKET]);
  }
  // gcloud storage uses snake_case output for describe; the REST uploader uses
  // Google's camelCase JSON. Accept only the equivalent explicitly private form.
  if (String(bucket.projectNumber || bucket.project_number) !== NUMBER ||
      (bucket.iamConfiguration?.publicAccessPrevention || bucket.public_access_prevention) !== 'enforced' ||
      !(bucket.iamConfiguration?.uniformBucketLevelAccess?.enabled === true || bucket.uniform_bucket_level_access === true)) throw new Error('Recovery bucket is not private in the expected project; app storage was not changed');
  const token = run(['auth', 'print-access-token']);
  const firebase = await fetcher('https://firebasestorage.googleapis.com/v1beta/projects/' + NUMBER + '/buckets/' + BUCKET,
    { redirect: 'error', headers: { Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(30000) });
  if (firebase.status !== 404 || (await firebase.json()).error?.status !== 'NOT_FOUND') throw new Error('Recovery bucket must not be Firebase-registered; no app storage rules were changed');
  const pool = find(['iam', 'workload-identity-pools', 'describe', POOL, '--location=global']);
  if (pool?.disabled || (pool?.state && pool.state !== 'ACTIVE')) throw new Error('Existing cloud identity pool is unavailable');
  if (!pool) invoke(['iam', 'workload-identity-pools', 'create', POOL, '--location=global', '--display-name=ScoutZero Codex cloud data']);
  const condition = 'assertion.sub == ' + JSON.stringify(details.subject);
  const providerArgs = ['--workload-identity-pool=' + POOL, '--location=global'];
  const providers = invoke(['iam', 'workload-identity-pools', 'providers', 'list', ...providerArgs]);
  if (!Array.isArray(providers) || providers.some((p: any) => p.name?.split('/').pop() !== PROVIDER)) throw new Error('Cloud pool contains other provider trust; no existing trust was changed');
  const provider = find(['iam', 'workload-identity-pools', 'providers', 'describe', PROVIDER, ...providerArgs]);
  if (provider) {
    if (provider.disabled || provider.oidc?.issuerUri !== details.issuer || !equalPermissions(provider.oidc?.allowedAudiences || [], [details.audience]) ||
        provider.attributeMapping?.['google.subject'] !== 'assertion.sub' || provider.attributeCondition !== condition) throw new Error('Existing cloud provider trust differs; no existing trust was changed');
  } else invoke(['iam', 'workload-identity-pools', 'providers', 'create-oidc', PROVIDER, ...providerArgs,
    '--issuer-uri=' + details.issuer, '--allowed-audiences=' + details.audience, '--attribute-mapping=google.subject=assertion.sub', '--attribute-condition=' + condition]);
  invoke(['projects', 'add-iam-policy-binding', PROJECT, '--member=serviceAccount:' + ACCOUNT, '--role=' + sourceRole, '--condition=None']);
  invoke(['storage', 'buckets', 'add-iam-policy-binding', 'gs://' + BUCKET, '--member=serviceAccount:' + ACCOUNT,
    '--role=projects/' + PROJECT + '/roles/' + RECOVERY_ROLE, '--condition=None']);
  invoke(['iam', 'service-accounts', 'add-iam-policy-binding', ACCOUNT,
    '--member=' + principal,
    '--role=roles/iam.workloadIdentityUser', '--condition=None']);
  return { ...cloudOwnerScope(details), configured: true, verificationStillRequired: ['Actual source GET/LIST and denied database write permission', 'Private remote backup/readback', 'Fresh-session restore without current workspace data'] };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const option = (name: string) => process.argv.find((a) => a.startsWith('--' + name + '='))?.slice(name.length + 3);
  try {
    const values = [option('issuer'), option('audience'), option('subject')];
    const details = values.every(Boolean) ? { issuer: values[0]!, audience: values[1]!, subject: values[2]! } : undefined;
    if (!process.argv.includes('--apply')) console.log(JSON.stringify(cloudOwnerScope(details), null, 2));
    else {
      if (!details || !process.argv.includes('--approve-source-read-and-private-recovery')) throw new Error('Owner apply requires the displayed trust values and --approve-source-read-and-private-recovery');
      const run: Runner = (args) => {
        try {
          const output = execFileSync('gcloud', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
          return args[0] === 'auth' ? output : output ? JSON.parse(output) : {};
        } catch (error) {
          if (/NOT_FOUND|not found|does not exist/i.test(String((error as any).stderr))) throw new Error('NOT_FOUND');
          throw new Error('Owner Google operation failed: ' + args.slice(0, 3).join(' ') + '. No credential or raw API output is printed.');
        }
      };
      console.log(JSON.stringify(await configureCloudOwnerAccess(details, run), null, 2));
    }
  } catch (error) { console.error(error instanceof SyntaxError ? 'Invalid owner setup response' : error instanceof Error ? error.message : 'Owner setup failed'); process.exitCode = 1; }
}
