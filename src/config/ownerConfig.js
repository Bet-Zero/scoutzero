/**
 * FILE: src/config/ownerConfig.js
 * PURPOSE: Owner allowlist configuration for privileged actions (e.g., Firestore writes)
 * OWNERSHIP: Shared configuration
 *
 * DESCRIPTION:
 * Parses VITE_OWNER_UIDS environment variable to determine which user IDs
 * are allowed to perform owner-only actions such as saving ranker sessions
 * to Firestore.
 *
 * USAGE:
 * Import { isOwnerUid } and call with the current user's uid to check ownership.
 * Non-owners can still use local-only features; owners unlock Firestore save.
 */

/**
 * Parse comma-separated owner UIDs from environment variable.
 * @returns {Set<string>} Set of owner UIDs (empty if not configured)
 */
const parseOwnerUids = () => {
  const raw = import.meta.env?.VITE_OWNER_UIDS || '';
  if (!raw || typeof raw !== 'string') return new Set();

  return new Set(
    raw
      .split(',')
      .map((uid) => uid.trim())
      .filter(Boolean)
  );
};

/** Cached owner UIDs set */
const OWNER_UIDS = parseOwnerUids();

/**
 * Check if a user ID is in the owner allowlist.
 * @param {string|null|undefined} userId - The user's uid to check
 * @returns {boolean} True if the user is an owner
 */
export const isOwnerUid = (userId) => {
  if (!userId || typeof userId !== 'string') return false;
  return OWNER_UIDS.has(userId);
};

/**
 * Get the count of configured owner UIDs (for debugging).
 * @returns {number} Number of configured owners
 */
export const getOwnerCount = () => OWNER_UIDS.size;

export default { isOwnerUid, getOwnerCount };
