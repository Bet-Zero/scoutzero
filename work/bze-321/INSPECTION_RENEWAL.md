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
3. Prove encrypted-artifact recovery through the existing private Linear handoff
   described below before dispatch. The owner already published the requested
   network setting; the executor still receives HTTP 403 for the listed Azure
   host. Do not request more domains, unrestricted networking or a proxy bypass.
   A GitHub connector File Service reference alone does not prove executor ingress.

## Verified private return route — October 21

The selected route is **GitHub Actions ZIP → owner browser → attachment on the
existing private BZE-321 issue → Linear `get_attachment(format="content")` →
local exact-byte recovery**. The owner-browser leg was previously exercised in
BZE-325; it is not an automated connector-to-Linear transfer. No new account,
service, network setting or Google change is required. Keep the key separate;
never upload plaintext inspection output, key material or bearer links to GitHub.

Actual executor recovery of BZE-325 attachment
`79834543-393b-4403-ad7e-19d5a7103978` returned the original 19,047-byte ZIP.
Its SHA-256 is
`5bef4aee710fc7e1c247cc2313ab60e4fd24161f3d5e0d231216f6f855510c8c`,
equal to GitHub artifact `12159454027`'s live `digest`. Its sole member is
`nba-private-review.cms`; CMS parsing succeeds. This verifies original encrypted
bytes, not decryption or new factual acceptance of that historical report.

A harmless control encrypted with the immutable inspector's public certificate
was uploaded as private attachment `23222351-5f6e-4e63-a349-6a5f00cf442c`.
Two independent attachment reads each recovered the exact 799-byte ZIP, SHA-256
`337684f2528af9ff86c04946a2a0bbff038749b0f156e0ed957e371f38241ead`.
Both decrypted with the privately recovered renewed key to the exact original
control, SHA-256
`369351a29cb3b3a2113d329b08a3005bcb891c50aa25ee32195a67494d2832d9`.
An unrelated key was rejected. The control contains no private source data.
This control tests the private attachment ingress/decryption leg; it was not
downloaded from Actions. The separately recovered BZE-325 original binds that
leg to a previously exercised Actions browser handoff. Neither establishes a
direct GitHub connector-to-executor or connector-to-Linear path.

For every fresh inspection/report:

1. Identify the exact run, attempt, immutable worker and expected artifact name.
   Read the artifact metadata/digest from GitHub before recovery. Preserve the
   existing protected owner approval; do not approve it as the author.
2. If direct transfer is still unavailable, ask for one file action: download
   that run's encrypted ZIP and attach it to this same private Linear issue.
   Do not ask for the key, decryption, account settings or a public upload.
3. Fetch the new attachment with `format="content"`; decode its returned base64
   mechanically, without printing or copying it through model-visible text.
   Compare the exact ZIP size and SHA-256 with GitHub metadata. Reject unexpected
   archive members, paths, symlinks or unbounded expansion before extraction.
4. Decrypt the sole expected CMS member privately. For inspection, compare the
   complete plaintext SHA-256 with the immutable worker's `evidenceSha256` log.
   Verify capture/run identity and exact requested source/Rules scope. For private
   review, additionally check candidate/input identities, execution outcome,
   denials and complete verdict; failure is never ACCEPT.
5. Record only non-sensitive integrity/status receipts publicly. Retain decrypted
   records and Rules privately; keep the key until all required outputs have
   been recovered. Repeat the harmless preflight if the recipient or ingress
   mechanism changes. A missing/mismatched artifact fails closed.

The successful original-byte recovery and repeated harmless decryption above
replace the shell-only download prerequisite; they do not waive it without
equivalent transport proof. No executable worker, permission or approval changes.
Google renewal was reportedly completed: verify it with the actual protected
read-only inspection. Do not repeat the historical command below unless an actual
Google failure establishes a need for a diagnosed repair.

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
