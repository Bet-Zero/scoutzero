/**
 * Firebase Cloud Functions Entry Point
 *
 * Exports all callable functions for the ScoutZero application.
 * 
 * ## Deployment
 * Deploy all functions: `npm run deploy`
 * Deploy specific function: `firebase deploy --only functions:purgeArchitectWorld`
 * 
 * ## Local Development
 * Set VITE_USE_FUNCTIONS_EMULATOR='true' in client .env
 * Start emulator: `npm run serve` (from functions/ directory)
 * 
 * ## Available Functions
 * - purgeArchitectWorld: Permanently delete a world and all subcollections
 *
 * @module functions
 */

// Export architect functions
export { purgeArchitectWorld } from './architect/purgeWorld';
