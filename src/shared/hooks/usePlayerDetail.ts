import { useState, useEffect } from 'react';
import { getDoc, getDocs } from 'firebase/firestore';
import type { z } from 'zod';
import {
  playerRef,
  contractsCol,
  seasonsCol,
  evalsCol,
} from '@/data/firestorePaths';
import {
  PlayerMainDocZ,
  ContractDocZ,
  SeasonDocZ,
  EvaluationDocZ,
} from '@/schemas/players_v2';
import type {
  PlayerV2,
  ContractDoc,
  SeasonDoc,
  EvaluationDoc,
} from '@/schemas/players_v2';

interface UsePlayerDetailResult {
  player: PlayerV2 | null;
  loading: boolean;
  error: string | null;
}

const formatSchemaIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
    .join('; ');

const parseFirestoreDoc = <T>(
  schema: z.ZodType<T>,
  data: unknown,
  label: string
): T => {
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    throw new Error(`${label} failed schema validation: ${formatSchemaIssues(parsed.error)}`);
  }

  return parsed.data;
};

/**
 * Hook for fetching full player details including subcollections.
 *
 * Fetches:
 * 1. Main player document (bio, etc.)
 * 2. All contract documents (in parallel)
 * 3. All season documents (in parallel)
 * 4. All evaluation documents (in parallel)
 *
 * Returns v2 schema structure directly — no legacy flattening.
 */
export const usePlayerDetail = (
  playerId: string | null | undefined
): UsePlayerDetailResult => {
  const [player, setPlayer] = useState<PlayerV2 | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playerId) {
      setPlayer(null);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchPlayerDetail = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Fetch main document
        const mainDocRef = playerRef(playerId);
        const mainDocSnap = await getDoc(mainDocRef);

        if (!mainDocSnap.exists()) {
          throw new Error(`Player ${playerId} not found`);
        }

        const mainDoc = parseFirestoreDoc(
          PlayerMainDocZ,
          mainDocSnap.data(),
          `players_v2/${playerId}`
        );

        // Step 2: Fetch all subcollections in parallel
        const [contractsSnap, seasonsSnap, evalsSnap] = await Promise.all([
          getDocs(contractsCol(playerId)),
          getDocs(seasonsCol(playerId)),
          getDocs(evalsCol(playerId)),
        ]);

        // Step 3: Convert subcollections to records
        const contracts: Record<string, ContractDoc> = {};
        contractsSnap.forEach((doc) => {
          // Filter out metadata fields like last_updated
          if (!doc.id.startsWith('last_')) {
            contracts[doc.id] = parseFirestoreDoc(
              ContractDocZ,
              doc.data(),
              `players_v2/${playerId}/contracts/${doc.id}`
            );
          }
        });

        const seasons: Record<string, SeasonDoc> = {};
        seasonsSnap.forEach((doc) => {
          seasons[doc.id] = parseFirestoreDoc(
            SeasonDocZ,
            doc.data(),
            `players_v2/${playerId}/seasons/${doc.id}`
          );
        });

        const evaluations: Record<string, EvaluationDoc> = {};
        evalsSnap.forEach((doc) => {
          evaluations[doc.id] = parseFirestoreDoc(
            EvaluationDocZ,
            doc.data(),
            `players_v2/${playerId}/evaluations/${doc.id}`
          );
        });

        // Step 4: Build v2 player structure with spread pattern for easier access
        const playerV2: PlayerV2 = {
          ...mainDoc,
          id: playerId,
          contracts: Object.keys(contracts).length > 0 ? contracts : undefined,
          seasons: Object.keys(seasons).length > 0 ? seasons : undefined,
          evaluations:
            Object.keys(evaluations).length > 0 ? evaluations : undefined,
        };

        if (isMounted) {
          setPlayer(playerV2);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching player detail:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    };

    fetchPlayerDetail();

    return () => {
      isMounted = false;
    };
  }, [playerId]);

  return { player, loading, error };
};

