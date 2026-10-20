/** One owner-reviewed scope: source reads and private recovery, never NBA publication. */
export const CLOUD_DATA_PROJECT = 'scoutzero-bf1ae';
export const CLOUD_DATA_PROJECT_NUMBER = '105500121903';
export const CLOUD_DATA_ACCOUNT_ID = 'scoutzero-cloud-data';
export const CLOUD_DATA_ACCOUNT = `${CLOUD_DATA_ACCOUNT_ID}@${CLOUD_DATA_PROJECT}.iam.gserviceaccount.com`;
export const CLOUD_DATA_POOL = 'scoutzero-cloud-dev';
export const CLOUD_DATA_PROVIDER = 'codex';
export const CLOUD_DATA_SOURCE_ROLE = 'scoutzeroCloudSourceReader';
export const CLOUD_DATA_RECOVERY_ROLE = 'scoutzeroCloudRecoveryObjects';
export const CLOUD_DATA_BUCKET = `${CLOUD_DATA_PROJECT}-cloud-recovery-${CLOUD_DATA_PROJECT_NUMBER}`;
export const CLOUD_DATA_SOURCE_PERMISSIONS = ['datastore.entities.get', 'datastore.entities.list', 'firebasestorage.buckets.get', 'resourcemanager.projects.get'];
export const CLOUD_DATA_RECOVERY_PERMISSIONS = ['storage.buckets.get', 'storage.objects.get', 'storage.objects.create'];
export const CLOUD_DATA_ADDITIONAL_HOSTS = ['salaryswish.com', 'www.salaryswish.com', 'stats.nba.com', 'www.nba.com', 'cdn.nba.com',
  'basketball.realgm.com', 'www.prosportstransactions.com', 'sts.googleapis.com', 'iamcredentials.googleapis.com',
  'oauth2.googleapis.com', 'iam.googleapis.com', 'cloudresourcemanager.googleapis.com', 'firebasestorage.googleapis.com'];
