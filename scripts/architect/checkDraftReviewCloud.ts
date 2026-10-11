import { inspectDraftReviewCloud } from './draftReviewCloudPreflight.js';

// No default credentials, local token discovery, emulator fallback or writer.
try {
  const result = await inspectDraftReviewCloud(
    process.env.SCOUTZERO_GCP_ACCESS_TOKEN ?? ''
  );
  console.log(JSON.stringify(result));
} catch {
  // Provider/SDK errors may include sensitive response details. Tests exercise
  // exact internal failure categories; hosted logs get only this safe summary.
  console.error(
    'Read-only Google Cloud preflight failed. No writes performed.'
  );
  process.exitCode = 1;
}
