import {
  DRAFT_CLOUD_PROJECT,
  DRAFT_CLOUD_ACCOUNT,
} from './draftReviewCloudConnection.js';

export const INSPECTION_ENVIRONMENT = 'draft-review-inspection';
export const PUBLICATION_ENVIRONMENT = 'draft-review-publication';
export const PUBLICATION_ACCOUNT = `scoutzero-draft-publish@${DRAFT_CLOUD_PROJECT}.iam.gserviceaccount.com`;
export const INSPECTION_PERMISSIONS = Object.freeze([
  'datastore.databases.getMetadata',
  'datastore.entities.get',
  'firebaserules.releases.get',
  'firebaserules.rulesets.get',
]);
export const PUBLICATION_PERMISSIONS = Object.freeze([
  ...INSPECTION_PERMISSIONS,
  'datastore.entities.create',
  'firebaserules.releases.update',
  'firebaserules.rulesets.create',
  'firebaserules.rulesets.test',
]);

/** Proposed configuration only. No IAM mutation or automatic privilege upgrade. */
export function sustainableDraftConnectionPlan(
  workerSha: string,
  inspectionWorkerSha?: string
) {
  if (!/^[a-f0-9]{40}$/.test(workerSha))
    throw new Error('Immutable worker SHA required');
  const worker = `Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@${workerSha}`;
  const common = [
    "assertion.repository_id == '997820257'",
    "assertion.repository_owner_id == '205859440'",
    "assertion.repository == 'Bet-Zero/scoutzero'",
    "assertion.event_name == 'push'",
    "assertion.ref == 'refs/heads/feature/bze-321-hosted-draft-review'",
    `assertion.job_workflow_ref == '${worker}'`,
    `assertion.job_workflow_sha == '${workerSha}'`,
  ];
  const environmentCondition = [INSPECTION_ENVIRONMENT, PUBLICATION_ENVIRONMENT]
    .map(
      (name) =>
        `(assertion.environment == '${name}' && assertion.sub == 'repo:Bet-Zero/scoutzero:environment:${name}')`
    )
    .join(' || ');
  if (inspectionWorkerSha && !/^[a-f0-9]{40}$/.test(inspectionWorkerSha))
    throw new Error('Immutable inspection worker SHA required');
  const baselineCondition = `${common.join(' && ')} && (${environmentCondition})`;
  // This additive identity is inspection-only. It never moves publication trust.
  const inspectionCondition = inspectionWorkerSha
    ? [
        ...common.slice(0, 5),
        `assertion.job_workflow_ref == 'Bet-Zero/scoutzero/.github/workflows/draft-review-worker.yml@${inspectionWorkerSha}'`,
        `assertion.job_workflow_sha == '${inspectionWorkerSha}'`,
        `assertion.environment == '${INSPECTION_ENVIRONMENT}'`,
        `assertion.sub == 'repo:Bet-Zero/scoutzero:environment:${INSPECTION_ENVIRONMENT}'`,
      ].join(' && ')
    : null;
  const member = (environment: string) =>
    `principalSet://iam.googleapis.com/projects/105500121903/locations/global/workloadIdentityPools/scoutzero-bze321/attribute.environment/${environment}`;
  return {
    provider:
      'projects/105500121903/locations/global/workloadIdentityPools/scoutzero-bze321/providers/github',
    requiredApis: [
      'iamcredentials.googleapis.com',
      'sts.googleapis.com',
      'firestore.googleapis.com',
      'firebaserules.googleapis.com',
      'cloudresourcemanager.googleapis.com',
    ],
    attributeMapping: {
      'google.subject': 'assertion.sub',
      'attribute.repository_id': 'assertion.repository_id',
      'attribute.environment': 'assertion.environment',
    },
    attributeCondition: inspectionCondition
      ? `(${baselineCondition}) || (${inspectionCondition})`
      : baselineCondition,
    inspection: {
      account: DRAFT_CLOUD_ACCOUNT,
      member: member(INSPECTION_ENVIRONMENT),
      permissions: INSPECTION_PERMISSIONS,
    },
    publication: {
      account: PUBLICATION_ACCOUNT,
      member: member(PUBLICATION_ENVIRONMENT),
      permissions: PUBLICATION_PERMISSIONS,
      projectRoleId: 'scoutzeroDraftPublisher',
    },
    requiredGitHubProtection: {
      environments: [INSPECTION_ENVIRONMENT, PUBLICATION_ENVIRONMENT],
      reviewerUserId: 205859440,
      preventSelfReview: false,
      canAdminsBypass: false,
      branch: 'feature/bze-321-hosted-draft-review',
    },
  };
}
