import {
  DRAFT_CLOUD_PROJECT,
  DRAFT_CLOUD_ACCOUNT,
} from './draftReviewCloudConnection.js';

export const INSPECTION_ENVIRONMENT = 'draft-review-inspection';
export const PUBLICATION_ENVIRONMENT = 'draft-review-publication';
export const PUBLICATION_ACCOUNT = `scoutzero-draft-publish@${DRAFT_CLOUD_PROJECT}.iam.gserviceaccount.com`;
export const RELEASE_OBJECT = 'bze321/approved-installation.json';
export const RELEASE_BUCKET = 'scoutzero-bf1ae.firebasestorage.app';
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
export function sustainableDraftConnectionPlan(workerSha: string) {
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
  const member = (environment: string) =>
    `principalSet://iam.googleapis.com/projects/105500121903/locations/global/workloadIdentityPools/scoutzero-bze321/attribute.environment/${environment}`;
  return {
    provider:
      'projects/105500121903/locations/global/workloadIdentityPools/scoutzero-bze321/providers/github',
    attributeMapping: {
      'google.subject': 'assertion.sub',
      'attribute.repository_id': 'assertion.repository_id',
      'attribute.environment': 'assertion.environment',
    },
    attributeCondition: `${common.join(' && ')} && (${environmentCondition})`,
    inspection: {
      account: DRAFT_CLOUD_ACCOUNT,
      member: member(INSPECTION_ENVIRONMENT),
      permissions: INSPECTION_PERMISSIONS,
      bucketMetadataPermission: 'storage.buckets.get',
      bucket: RELEASE_BUCKET,
    },
    publication: {
      account: PUBLICATION_ACCOUNT,
      member: member(PUBLICATION_ENVIRONMENT),
      permissions: PUBLICATION_PERMISSIONS,
    },
    // This additional bucket binding is object-read-only, not project storage access.
    storage: {
      permission: 'storage.objects.get',
      condition: `resource.name == 'projects/_/buckets/${RELEASE_BUCKET}/objects/${RELEASE_OBJECT}'`,
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
