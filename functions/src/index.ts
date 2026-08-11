/**
 * Firebase Cloud Functions Entry Point
 *
 * Exports all callable functions for the ScoutZero application.
 *
 * ## Deployment
 * - Deploy all functions: `npm run deploy` (or `firebase deploy --only functions`)
 * - Deploy specific function: `firebase deploy --only functions:initializeArchitectWorld`
 * - Default region: us-central1 (Firebase default)
 *
 * ## Local Development
 * 1. Install Firebase CLI: `npm install -g firebase-tools`
 * 2. Login: `firebase login`
 * 3. Set client env var: `VITE_USE_FUNCTIONS_EMULATOR='true'` in .env
 * 4. Start emulator: `npm run serve` (from functions/ directory)
 * 5. Emulator runs on http://localhost:5001 by default
 * 6. Debug with: `firebase emulators:start --inspect-functions`
 *
 * ## Build Steps
 * - Compile TypeScript: `npm run build` (runs `tsc`)
 * - Output directory: `lib/` (configured in tsconfig.json)
 * - Clean build: `rm -rf lib && npm run build`
 *
 * ## Environment Variables
 * No environment variables are currently required for these functions.
 * Firebase Admin SDK uses Application Default Credentials in Cloud Functions.
 * For local development, ensure you have a Firebase project configured.
 *
 * ## Function Organization
 * - Architect functions: ./architect/ - World management operations
 *   - initializeArchitectWorld: Trusted governed world/baseline initialization
 *   - purgeArchitectWorld: Permanently delete a world and all subcollections
 *
 * ## Versioning
 * Functions use Firebase Functions v2 (onCall from firebase-functions/v2/https).
 * Breaking changes should be handled by creating new function names.
 *
 * @module functions
 */

// Export architect functions
export { purgeArchitectWorld } from './architect/purgeWorld';
export { initializeArchitectWorld } from './architect/initializeWorld';
