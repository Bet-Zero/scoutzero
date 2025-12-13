/**
 * FILE: src/features/architect/utils/loadArchitectBasePlayer.ts
 * PURPOSE: Data-layer utility to load player data from architect_basePlayers collection
 * OWNERSHIP: Feature: architect/utils
 *
 * HISTORY:
 *  - 2025-01-XX: Created - extracted Firestore read logic from useArchitectActions.ts (Phase 6)
 *
 * LINKS:
 *  - Plan: Phase 6 (Part 1) - Remove direct Firestore usage from UI-layer hooks
 */
import { getDoc } from 'firebase/firestore';
import { basePlayerRef } from '@/data/firestorePaths';

/** Bio structure for player data (matches LocalBio from useArchitectActions) */
interface LocalBio {
  playerId?: string;
  displayName?: string;
  position?: string;
  age?: number;
  [key: string]: unknown;
}

/** Local contract structure (matches LocalContract from useArchitectActions) */
interface LocalContract {
  salariesByYear?: unknown[];
  birdRights?: {
    status?: string;
    yearsOfService?: number;
    yearsWithTeam?: number;
    eligibleFor?: string[];
  };
  contractType?: string;
  isExtension?: boolean;
  isRookieScale?: boolean;
  signingTeam?: string;
  [key: string]: unknown;
}

/**
 * Loads a player from the architect_basePlayers collection
 *
 * @param playerId - The player ID to load (required)
 * @param fallbackName - Optional fallback name if displayName is not found in document
 * @returns Player data object with id, player_id, name, displayName, position, age, contract, bio, and all other fields from the document, or null if playerId is falsy or document doesn't exist
 * @throws Propagates Firestore errors to caller (caller should handle with try/catch)
 */
export async function loadArchitectBasePlayer(
  playerId: string,
  fallbackName?: string
): Promise<Record<string, unknown> | null> {
  // Return null if playerId is falsy
  if (!playerId) {
    return null;
  }

  // Load document from Firestore
  const playerSnap = await getDoc(basePlayerRef(playerId));

  // Return null if document doesn't exist
  if (!playerSnap.exists()) {
    return null;
  }

  // Get document data
  const loaded = playerSnap.data() as Record<string, unknown>;

  // Assemble player data object matching the structure used in useArchitectActions
  return {
    ...loaded,
    id: (loaded.playerId as string) || playerId,
    player_id: (loaded.playerId as string) || playerId,
    name: (loaded.displayName as string) || fallbackName,
    displayName: (loaded.displayName as string) || fallbackName,
    position: (loaded.bio as LocalBio)?.position || '',
    age: (loaded.bio as LocalBio)?.age || null,
    contract: (loaded.contract as LocalContract) || null,
    bio: (loaded.bio as LocalBio) || {},
  };
}
