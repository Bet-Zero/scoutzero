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
import {
  readArchitectContract,
  readArchitectNumber,
  readArchitectPlayer,
  readArchitectRecord,
  readArchitectString,
  type ArchitectBoundaryContract,
  type ArchitectBoundaryRecord,
} from '@/features/architect/utils/architectFirestoreBoundary';

/** Bio structure for player data (matches LocalBio from useArchitectActions) */
interface LocalBio extends ArchitectBoundaryRecord {
  playerId?: string;
  displayName?: string;
  position?: string;
  age?: number;
}

/** Local contract structure (matches LocalContract from useArchitectActions) */
interface LocalContract extends ArchitectBoundaryContract {
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
}

export interface ArchitectBasePlayerData extends ArchitectBoundaryRecord {
  id: string;
  player_id: string;
  name?: string;
  displayName?: string;
  position: string;
  age: number | null;
  contract: LocalContract | null;
  bio: LocalBio;
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
): Promise<ArchitectBasePlayerData | null> {
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

  const loaded = readArchitectPlayer(
    playerSnap.data(),
    `architect_basePlayers/${playerId}`,
    playerId
  );
  const bio: LocalBio = readArchitectRecord(loaded.bio) ?? {};
  const loadedPlayerId = loaded.playerId ?? playerId;
  const displayName = loaded.displayName ?? fallbackName;
  const contract = readArchitectContract(
    loaded.contract,
    `architect_basePlayers/${playerId}.contract`
  );

  // Assemble player data object matching the structure used in useArchitectActions
  return {
    ...loaded,
    id: loadedPlayerId,
    player_id: loadedPlayerId,
    name: displayName,
    displayName,
    position: readArchitectString(bio.position) ?? '',
    age: readArchitectNumber(bio.age),
    contract,
    bio,
  };
}
