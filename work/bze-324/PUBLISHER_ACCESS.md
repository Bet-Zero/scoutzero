# BZE-324 ordinary publisher access

Status: implementation prepared; **not yet live-verified**. Gate A remains open.
No production NBA plan is registered. Do not connect a personal Google identity
to Codex. Do not change BZE-321 service accounts, protected environments, workflow
pins, Rules, data or existing provider clauses.

## What is reused and isolated

The existing pool/provider is
`projects/105500121903/locations/global/workloadIdentityPools/scoutzero-bze321/providers/github`.
Only its keyless pattern is reused. Ordinary maintenance uses its own service
account `scoutzero-nba-maintenance@scoutzero-bf1ae.iam.gserviceaccount.com`,
custom role `scoutzeroNbaMaintenancePublisher` and protected GitHub environment
`nba-maintenance-publication`. The role has exactly `datastore.entities.get`,
`datastore.entities.create` and `datastore.entities.update`. Those permissions
are database-wide; the immutable executor enforces ordinary-only paths/fields.
There is no list, delete, Rules, Storage or administrator grant.

The additional federation clause pins repository/owner IDs, main, manual dispatch,
caller workflow, protected environment and exact immutable worker SHA. The
service account grants `roles/iam.workloadIdentityUser` only to this pool's exact
ordinary environment principal. That lets GitHub exchange its identity for this
one service account; it grants no identity to the Codex cloud environment.
Tokens last 600 seconds. Existing draft trust clauses stay unchanged.

## Necessary owner configuration

The GitHub integration attempted the authorized environment configuration and
received HTTP 403, `Resource not accessible by integration`. It cannot set this
repository administration control. Codex also has no Google administration
identity, by owner choice. These are permission boundaries, not missing NBA data.

Two administration surfaces are involved; neither requires credentials in chat.
Batch them in one sitting after this exact worker is reviewed and landed.

1. Open [GitHub environment settings](https://github.com/Bet-Zero/scoutzero/settings/environments).
   Create/select **nba-maintenance-publication**. Under **Deployment protection
   rules**, require reviewer **Bet-Zero (GitHub user ID 205859440)**; leave
   prevent self-review off so the owner's manual dispatch can be approved.
   Turn **Allow administrators to bypass configured protection rules** off.
   Under **Deployment branches and tags**, select **Selected branches and tags**,
   add the **branch** `main`, and allow no other branch/tag. Save.
   This grants no Google or data permission; it makes every access/publication
   job wait for the owner and confines it to main.
2. Open [Google Cloud Console](https://console.cloud.google.com/home/dashboard?project=scoutzero-bf1ae).
   Confirm project **scoutzero-bf1ae**, click **Activate Cloud Shell** (`>_`, top
   right), then paste the reviewed block below. It runs under the owner's Console
   account, never in Codex. It creates the separate minimal publisher and adds
   one exact workflow trust clause. It never calls a Firestore data endpoint,
   creates a service-account key or changes a draft publisher's binding.

The block refuses an existing ordinary account with unexpected direct project
roles or user-managed keys, refuses a mismatched custom role/provider, preserves
all current mappings/condition clauses and prints only a public setup receipt.
Inherited organization/folder grants still need owner inspection; the actual
permission probe also rejects tested excessive privileges. Do not grant Owner,
Editor, Datastore User or Service Account Token Creator to this account.

```bash
python3 - <<'PY'
import json, subprocess
project = 'scoutzero-bf1ae'
number = '105500121903'
worker = '1436919fb20c8a5cc108e8eda9497874e54bd9c7'
if len(worker) != 40 or any(c not in '0123456789abcdef' for c in worker):
    raise SystemExit('Use the final reviewed worker pin; setup is not ready yet')
account = 'scoutzero-nba-maintenance@' + project + '.iam.gserviceaccount.com'
role_id = 'scoutzeroNbaMaintenancePublisher'
role = 'projects/' + project + '/roles/' + role_id
permissions = ['datastore.entities.create', 'datastore.entities.get', 'datastore.entities.update']
def run(*args, optional=False):
    result = subprocess.run(['gcloud', *args, '--project=' + project, '--format=json', '--quiet'], capture_output=True, text=True)
    if result.returncode:
        # Only a genuine missing resource permits creation. Authentication,
        # disabled API and permission errors must not be mistaken for absence.
        if optional and 'NOT_FOUND' in result.stderr:
            return None
        raise SystemExit('Google setup stopped at: ' + ' '.join(args[:3]) + '\n' + result.stderr)
    return json.loads(result.stdout) if result.stdout.strip() else None
if str(run('projects', 'describe', project)['projectNumber']) != number:
    raise SystemExit('Unexpected project identity')
provider_args = ['--location=global', '--workload-identity-pool=scoutzero-bze321']
provider = run('iam', 'workload-identity-pools', 'providers', 'describe', 'github', *provider_args)
if provider.get('disabled') or provider.get('oidc', {}).get('issuerUri') != 'https://token.actions.githubusercontent.com':
    raise SystemExit('Unexpected provider configuration')
for key, value in {'google.subject': 'assertion.sub', 'attribute.environment': 'assertion.environment', 'attribute.repository_id': 'assertion.repository_id'}.items():
    if provider.get('attributeMapping', {}).get(key) != value:
        raise SystemExit('Unexpected existing mapping; preserve and inspect it')
old_condition = provider.get('attributeCondition', '')
if not old_condition:
    raise SystemExit('Refuse to broaden an unqualified provider')
clause = " && ".join([
    "assertion.repository_id == '997820257'",
    "assertion.repository_owner_id == '205859440'",
    "assertion.repository == 'Bet-Zero/scoutzero'",
    "assertion.event_name == 'workflow_dispatch'",
    "assertion.ref == 'refs/heads/main'",
    "assertion.workflow_ref == 'Bet-Zero/scoutzero/.github/workflows/nba-maintenance.yml@refs/heads/main'",
    "assertion.job_workflow_ref == 'Bet-Zero/scoutzero/.github/workflows/nba-maintenance-worker.yml@" + worker + "'",
    "assertion.job_workflow_sha == '" + worker + "'",
    "assertion.environment == 'nba-maintenance-publication'",
    "assertion.sub == 'repo:Bet-Zero/scoutzero:environment:nba-maintenance-publication'",
])
if 'nba-maintenance-publication' in old_condition and clause not in old_condition:
    raise SystemExit('A different maintenance trust already exists; inspect before changing it')
existing_role = run('iam', 'roles', 'describe', role_id, optional=True)
if existing_role and (existing_role.get('deleted') or sorted(existing_role.get('includedPermissions', [])) != permissions):
    raise SystemExit('Existing ordinary role is not the exact minimal role')
policy = run('projects', 'get-iam-policy', project)
if any('serviceAccount:' + account in binding.get('members', []) and
       (binding['role'] != role or binding.get('condition')) for binding in policy.get('bindings', [])):
    raise SystemExit('Ordinary publisher has an unexpected direct role; inspect it')
service_account = run('iam', 'service-accounts', 'describe', account, optional=True)
if service_account:
    if service_account.get('disabled'):
        raise SystemExit('Ordinary publisher is disabled; inspect before changing it')
    keys = run('iam', 'service-accounts', 'keys', 'list', '--iam-account=' + account, '--managed-by=user')
    if keys:
        raise SystemExit('Ordinary publisher has user-managed keys; do not use it')
run('services', 'enable', 'iam.googleapis.com', 'iamcredentials.googleapis.com', 'sts.googleapis.com', 'cloudresourcemanager.googleapis.com')
if not service_account:
    run('iam', 'service-accounts', 'create', 'scoutzero-nba-maintenance', '--display-name=Protected ordinary NBA maintenance')
if not existing_role:
    run('iam', 'roles', 'create', role_id, '--title=Ordinary NBA maintenance publisher', '--stage=GA', '--permissions=' + ','.join(permissions))
run('projects', 'add-iam-policy-binding', project, '--member=serviceAccount:' + account, '--role=' + role, '--condition=None')
member = 'principalSet://iam.googleapis.com/projects/' + number + '/locations/global/workloadIdentityPools/scoutzero-bze321/attribute.environment/nba-maintenance-publication'
sa_policy = run('iam', 'service-accounts', 'get-iam-policy', account)
if any(binding.get('role') != 'roles/iam.workloadIdentityUser' or binding.get('condition') or
       binding.get('members') != [member] for binding in sa_policy.get('bindings', [])):
    raise SystemExit('Unexpected account impersonation binding; inspect before changing it')
run('iam', 'service-accounts', 'add-iam-policy-binding', account, '--member=' + member, '--role=roles/iam.workloadIdentityUser', '--condition=None')
if clause not in old_condition:
    latest = run('iam', 'workload-identity-pools', 'providers', 'describe', 'github', *provider_args)
    if latest.get('attributeCondition') != old_condition or latest.get('attributeMapping') != provider.get('attributeMapping'):
        raise SystemExit('Provider changed during setup; inspect and retry without overwriting it')
    run('iam', 'workload-identity-pools', 'providers', 'update-oidc', 'github', *provider_args, '--attribute-condition=(' + old_condition + ') || (' + clause + ')')
print(json.dumps({'project': project, 'account': account, 'permissions': permissions, 'workerSha': worker, 'productionDataChanged': False}))
PY
```

Do not run a draft installation or a maintenance `publish` operation as setup.
After configuration, Codex dispatches **access**, the owner approves that protected
job, and Codex verifies the actual Google exchange, permission results and fixed
read. A failed probe stays a blocker; a synthetic pass is not a deployment receipt.

## Private publication handoff is separately approved

No rehearsal archive or source body is uploaded to GitHub/CI. No new maintenance
passphrase exists in the environment yet. Before the first approved production
publication, Codex uses `maintenance:package` to create and verify the exact private
plan package. Any public ciphertext retention and separate private key handoff
need the package-specific approval described in the operating card. Install the
separate passphrase once under **Environment secrets → Add environment secret →
BZE324_MAINTENANCE_PASSPHRASE**. No Google credential goes in that secret.
The owner must not paste it into chat. Later plans use the same controlled
packaging route and remain separately reviewed/approved; key rotation is explicit.

The empty registry intentionally blocks all `publish` operations before Google
access. Read-only `access` needs no passphrase. Full Gate A closure requires the
landed code/review/CI plus actual bounded access verification; first data publication
and its exact private package remain Gate B, not an invented Gate A production test.
