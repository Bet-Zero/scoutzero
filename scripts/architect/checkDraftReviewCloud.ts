import {
  inspectDraftReviewCloud,
  draftCloudFailureSummary,
} from './draftReviewCloudPreflight.js';

// No default credentials, local token discovery, emulator fallback or writer.
try {
  const result = await inspectDraftReviewCloud(
    process.env.SCOUTZERO_GCP_ACCESS_TOKEN ?? ''
  );
  console.log(JSON.stringify(result));
} catch (error) {
  // Fixed codes distinguish access, drift and integrity failures without raw
  // provider bodies, credential material or exception messages/stacks.
  console.error(JSON.stringify(draftCloudFailureSummary(error)));
  process.exitCode = 1;
}
