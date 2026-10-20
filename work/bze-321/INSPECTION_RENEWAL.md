# Existing inspection connection renewal

This is the next protected prerequisite for PR #547, not source-publication
approval. The October 20 production refresh invalidated the old PHI before-image.
The ordinary reader cannot read the two draft records or production Rules.
The earlier inspector's decryption key is unavailable. The replacement key is
retained and verified in the existing owner-private completion Page.

The existing worker, known-path scope, service account and encrypted artifact
mechanism are reused. Relative to the previous PR head, only the worker's public
encryption recipient changes. Relative to the older approved inspection pin,
the worker also includes the PR's existing source-publication branch and
source-revision-aware inventory decoder; fresh review must cover that delta.
Inspection still selects its read-only account and inspection environment;
the publisher branch requires its separate protected identity.
The new immutable executor is
`ee71a8bbfb334178c8bb147efec48f468b52ad38`.
The source publisher remains
`85139f9f63afa8341b7bd599dc8d1b7bc7fac432`.
The release publisher remains
`7f2b815ce9a5deb3d7b99546dd9ee3c699a66cb2`.

## Required before dispatch

1. Exact candidate CI and independent public code review must pass. A code ACCEPT
   does not establish current source preconditions or private factual acceptance.
2. Renew only the existing inspector's two immutable-workflow trust assertions.
   The guarded command below preserves every other condition, including ordinary
   NBA maintenance. No role, account, permission, secret, environment or publisher
   trust is added.
3. Allow this cloud environment to download GitHub's encrypted Actions artifacts
   through its supported network configuration. The observed artifact endpoint
   redirects to `productionresultssa11.blob.core.windows.net`. The current
   environment denies that host; downloading via the GitHub connector creates a
   File Service reference that the executor's Sediment-only tool cannot import.
   Do not bypass the proxy. A harmless existing encrypted artifact must download
   successfully before dispatch. GitHub may select another artifact storage host;
   verify the returned location and configure only the supported required host.

The agent then changes the existing request from `none` to `inspect`, recovers
and decrypts the output, compares the exact three records and Rules, and prepares
the renewed exact installation/evidence package. Source-publication requests
remain inactive until their own private acceptance and protected approval.

## Guarded owner command

After the code review passes, the owner can run this in the existing project's
authenticated Google Cloud Shell. It reads the live provider, changes exactly
the two old inspector SHA references, rechecks the provider before mutation,
and verifies the result. An unexpected or concurrently changed condition stops.
This does not grant source-publication approval.

```bash
python3 - <<'PY'
import json
import re
import subprocess

project = 'scoutzero-bf1ae'
old = 'ede0e2be620aabd5c2d90c42f62a2b3737acda72'
new = 'ee71a8bbfb334178c8bb147efec48f468b52ad38'
worker = 'Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@'
args = ['--project=' + project, '--location=global',
        '--workload-identity-pool=scoutzero-bze321', '--format=json', '--quiet']

def command(action, *extra):
    completed = subprocess.run(
        ['gcloud', 'iam', 'workload-identity-pools', 'providers',
         action, 'github', *args, *extra],
        capture_output=True, text=True, check=True)
    return json.loads(completed.stdout) if completed.stdout.strip() else None

provider = command('describe')
assert provider['name'] == (
    'projects/105500121903/locations/global/'
    'workloadIdentityPools/scoutzero-bze321/providers/github')
assert not provider.get('disabled')
assert provider['oidc']['issuerUri'] == 'https://token.actions.githubusercontent.com'
condition = provider['attributeCondition']
assert 'draft-review-inspection' in condition
assert condition.count(old) == 2 and new not in condition
assert len(re.findall(
    r"assertion\.job_workflow_ref\s*==\s*(['\"])" +
    re.escape(worker + old) + r"\1", condition)) == 1
assert len(re.findall(
    r"assertion\.job_workflow_sha\s*==\s*(['\"])" +
    re.escape(old) + r"\1", condition)) == 1
replacement = condition.replace(old, new)
assert replacement.replace(new, old) == condition
assert command('describe') == provider, 'Provider changed; stop and recheck.'
command('update-oidc', '--attribute-condition=' + replacement)
after = command('describe')
assert after['attributeCondition'] == replacement
assert after['attributeMapping'] == provider['attributeMapping']
assert after['oidc'] == provider['oidc']
assert after.get('disabled') == provider.get('disabled')
print('BZE321_INSPECTION_TRUST_RENEWED: ' + new)
PY
```

Do not paste historical full-provider conditions over the current provider.
If any check fails, retain the error for the agent to diagnose; do not weaken the
guard, add a wildcard, approve a pending source run, or rotate unrelated secrets.
