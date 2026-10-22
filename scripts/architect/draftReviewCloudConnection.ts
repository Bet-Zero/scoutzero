/** One BZE-321 connection; public identifiers only, never credentials. */
export const DRAFT_CLOUD_PROJECT = 'scoutzero-bf1ae';
export const DRAFT_CLOUD_ACCOUNT = `scoutzero-draft-release@${DRAFT_CLOUD_PROJECT}.iam.gserviceaccount.com`;
export const DRAFT_CLOUD_POOL = 'scoutzero-bze321';
export const DRAFT_CLOUD_PROVIDER = 'github';
export const DRAFT_CLOUD_IDENTITY = Object.freeze({
  repository_id: '997820257',
  repository_owner_id: '205859440',
  repository: 'Bet-Zero/scoutzero',
  ref: 'refs/heads/feature/bze-321-hosted-draft-review',
  workflow_ref:
    'Bet-Zero/scoutzero/.github/workflows/draft-review-cloud.yml@refs/heads/feature/bze-321-hosted-draft-review',
  sub: 'repo:Bet-Zero/scoutzero:environment:Production',
  event_name: 'push',
});

export function draftCloudProvider(projectNumber: string): string {
  if (!/^[1-9][0-9]{5,19}$/.test(projectNumber))
    throw new Error('A verified Google Cloud project number is required.');
  return `projects/${projectNumber}/locations/global/workloadIdentityPools/${DRAFT_CLOUD_POOL}/providers/${DRAFT_CLOUD_PROVIDER}`;
}

/** Pure bootstrap input. An authorized administrator must apply it using IAM etags. */
export function draftCloudConnectionPlan(
  projectNumber: string,
  candidate: string
) {
  if (!/^[a-f0-9]{40}$/.test(candidate))
    throw new Error('An independently accepted exact candidate is required.');
  const provider = draftCloudProvider(projectNumber);
  const claims = { ...DRAFT_CLOUD_IDENTITY, sha: candidate };
  return {
    projectId: DRAFT_CLOUD_PROJECT,
    projectNumber,
    serviceAccount: DRAFT_CLOUD_ACCOUNT,
    poolId: DRAFT_CLOUD_POOL,
    provider: {
      name: provider,
      oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
      attributeMapping: {
        'google.subject': 'assertion.sub',
        'attribute.repository_id': 'assertion.repository_id',
      },
      attributeCondition: Object.entries(claims)
        .map(([key, value]) => `assertion.${key} == '${value}'`)
        .join(' && '),
    },
    // Only this principal may impersonate this account. Never grant project-wide
    // serviceAccountTokenCreator or broad Owner/Editor/Datastore User roles.
    accountBinding: {
      role: 'roles/iam.workloadIdentityUser',
      members: [
        `principalSet://iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${DRAFT_CLOUD_POOL}/attribute.repository_id/997820257`,
      ],
    },
    projectBinding: {
      role: `projects/${DRAFT_CLOUD_PROJECT}/roles/scoutzeroDraftRelease`,
      members: [`serviceAccount:${DRAFT_CLOUD_ACCOUNT}`],
    },
    projectRole: {
      roleId: 'scoutzeroDraftRelease',
      title: 'ScoutZero draft release inspection',
      stage: 'GA',
      includedPermissions: [
        'datastore.databases.getMetadata',
        'datastore.entities.get',
        'firebaserules.releases.get',
        'firebaserules.rulesets.get',
      ],
    },
    // Do not grant until the publisher has passed its own review and the
    // provider is pinned to that candidate. The first connection is read-only.
    publicationPermissions: [
      'datastore.entities.create',
      'firebaserules.releases.update',
      'firebaserules.rulesets.create',
      'firebaserules.rulesets.test',
    ],
  };
}
