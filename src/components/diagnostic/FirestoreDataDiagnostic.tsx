import { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import {
  ARCHITECT_BASE_PLAYERS_PATH,
  ARCHITECT_BASE_TEAMS_PATH,
  PLAYERS_COLLECTION,
} from '@/constants/collections';
import { db } from '@/firebaseConfig';
import { useSimplePlayerData } from '@/shared/hooks/useSimplePlayerData';

type SubcollectionDiagnostic = {
  count: number;
  exists: boolean;
  error?: string;
};

type SeasonDiagnostic = {
  id: string;
  status: unknown;
  displayName: unknown;
  subcollections: Record<string, SubcollectionDiagnostic>;
};

type CollectionDiagnostic = {
  exists: boolean;
  count: number;
  error: string | null;
  label?: string;
  seasons?: SeasonDiagnostic[];
};

type DiagnosticsState = {
  collections: Record<string, CollectionDiagnostic>;
  loading: boolean;
  error: string | null;
};

type FallbackDiagnosticsState = {
  source: string | null;
  collectionsChecked: string[];
  fallbackUsed: boolean;
};

type CollectionCheck = {
  name: string;
  label: string;
};

type SeasonData = {
  status?: unknown;
  bio?: {
    displayName?: unknown;
  };
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Diagnostic component to help users understand their Firestore data structure
 * and troubleshoot missing player data issues
 */
export const FirestoreDataDiagnostic = () => {
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>({
    collections: {},
    loading: true,
    error: null,
  });

  const [fallbackDiagnostics, setFallbackDiagnostics] =
    useState<FallbackDiagnosticsState>({
    source: null,
    collectionsChecked: [],
    fallbackUsed: false,
  });

  // Use simplified data layer for main player data
  const {
    players,
    loading: playersLoading,
    error: playersError,
  } = useSimplePlayerData();

  useEffect(() => {
    const runDiagnostics = async () => {
      const results: DiagnosticsState = {
        collections: {},
        loading: false,
        error: null,
      };

      try {
        // Check main collections (new architecture)
        const collectionsToCheck: CollectionCheck[] = [
          { name: PLAYERS_COLLECTION, label: `${PLAYERS_COLLECTION} (active)` },
          {
            name: ARCHITECT_BASE_PLAYERS_PATH,
            label: `${ARCHITECT_BASE_PLAYERS_PATH} (active)`,
          },
          {
            name: ARCHITECT_BASE_TEAMS_PATH,
            label: `${ARCHITECT_BASE_TEAMS_PATH} (active)`,
          },
          { name: 'players', label: 'players (legacy - deprecated)' },
          { name: 'teams', label: 'teams (legacy - deprecated)' },
          { name: 'seasons', label: 'seasons (legacy - deprecated)' },
        ];

        for (const { name: collectionName, label } of collectionsToCheck) {
          try {
            const snap = await getDocs(collection(db, collectionName));
            results.collections[collectionName] = {
              exists: true,
              count: snap.size,
              error: null,
              label,
            };

            // For seasons, get detailed info
            if (collectionName === 'seasons' && snap.size > 0) {
              results.collections[collectionName].seasons = [];

              for (const doc of snap.docs) {
                const seasonData = doc.data() as SeasonData;
                const seasonInfo: SeasonDiagnostic = {
                  id: doc.id,
                  status: seasonData.status,
                  displayName: seasonData.bio?.displayName,
                  subcollections: {},
                };

                // Check subcollections
                const subcollections = [
                  'metadata',
                  'playerGrades',
                  'teamData',
                  'players',
                ];
                for (const subCollection of subcollections) {
                  try {
                    const subSnap = await getDocs(
                      collection(db, 'seasons', doc.id, subCollection)
                    );
                    seasonInfo.subcollections[subCollection] = {
                      count: subSnap.size,
                      exists: true,
                    };
                  } catch (e) {
                    seasonInfo.subcollections[subCollection] = {
                      count: 0,
                      exists: false,
                      error: getErrorMessage(e),
                    };
                  }
                }

                results.collections[collectionName].seasons.push(seasonInfo);
              }
            }
          } catch (error) {
            results.collections[collectionName] = {
              exists: false,
              count: 0,
              error: getErrorMessage(error),
            };
          }
        }

        setDiagnostics(results);
      } catch (error) {
        setDiagnostics({
          collections: {},
          loading: false,
          error: getErrorMessage(error),
        });
      }
    };

    const runFallbackDiagnostics = async () => {
      const fallbackDiag: FallbackDiagnosticsState = {
        source: '/players',
        collectionsChecked: ['/players'],
        fallbackUsed: false,
      };

      // If simple data hook failed, check fallback scenarios for diagnostic purposes
      if (playersError || players.length === 0) {
        const fallbackSources = [
          { path: '/seasons', description: 'Season-based collections' },
          {
            path: 'local:/public/players.json',
            description: 'Local JSON fallback',
          },
        ];

        for (const source of fallbackSources) {
          fallbackDiag.collectionsChecked.push(source.path);

          if (source.path.startsWith('local:')) {
            try {
              const response = await fetch('/players.json');
              if (response.ok) {
                const localData: unknown = await response.json();
                if (isRecord(localData) && Object.keys(localData).length > 0) {
                  fallbackDiag.source = source.path;
                  fallbackDiag.fallbackUsed = true;
                  break;
                }
              }
            } catch {
              // Local file not available
            }
          }
        }
      }

      setFallbackDiagnostics(fallbackDiag);
    };

    runDiagnostics();
    runFallbackDiagnostics();
  }, [players.length, playersError]);

  const getStatusColor = (exists: boolean, count: number): string => {
    if (!exists) return 'text-red-600';
    if (count === 0) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStatusIcon = (exists: boolean, count: number): string => {
    if (!exists) return '❌';
    if (count === 0) return '⚠️';
    return '✅';
  };

  if (diagnostics.loading || playersLoading) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <h3 className="text-lg font-semibold mb-4">
            🔍 Running Firestore Diagnostics...
          </h3>
          <div className="space-y-2">
            <div className="h-4 bg-gray-300 rounded w-3/4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2"></div>
            <div className="h-4 bg-gray-300 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 rounded-lg space-y-6">
      <h2 className="text-xl font-bold text-gray-900">
        🔍 Firestore Data Diagnostic
      </h2>

      {/* Player Data Status */}
      <div className="bg-white p-4 rounded border">
        <h3 className="text-lg font-semibold mb-3">Player Data Status</h3>
        <div className="space-y-2">
          <div
            className={`flex justify-between items-center ${getStatusColor(players.length > 0, players.length)}`}
          >
            <span>
              {getStatusIcon(players.length > 0, players.length)} Players Loaded
            </span>
            <span className="font-mono">{players.length} players</span>
          </div>
          {fallbackDiagnostics.source && (
            <div className="text-sm text-gray-600">
              <strong>Data Source:</strong> {fallbackDiagnostics.source}
              {fallbackDiagnostics.fallbackUsed && (
                <span className="text-orange-600"> (using fallback)</span>
              )}
            </div>
          )}
          {fallbackDiagnostics.collectionsChecked.length > 0 && (
            <div className="text-xs text-gray-500">
              <strong>Locations Checked:</strong>{' '}
              {fallbackDiagnostics.collectionsChecked.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Main Collections */}
      <div className="bg-white p-4 rounded border">
        <h3 className="text-lg font-semibold mb-3">Main Collections</h3>
        <div className="space-y-2">
          {Object.entries(diagnostics.collections).map(([name, info]) => (
            <div
              key={name}
              className={`flex justify-between items-center ${getStatusColor(info.exists, info.count)}`}
            >
              <span>
                {getStatusIcon(info.exists, info.count)} /{name}
                {info.label && (
                  <span className="text-xs text-gray-500 ml-2">
                    ({info.label})
                  </span>
                )}
              </span>
              <span className="font-mono">
                {info.exists
                  ? `${info.count} documents`
                  : `Error: ${info.error}`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Season Details */}
      {diagnostics.collections.seasons?.seasons && (
        <div className="bg-white p-4 rounded border">
          <h3 className="text-lg font-semibold mb-3">Season Collections</h3>
          {diagnostics.collections.seasons.seasons.map((season) => (
            <div key={season.id} className="mb-4 p-3 bg-gray-50 rounded">
              <div className="font-semibold text-gray-900">
                Season {season.id} ({String(season.displayName ?? '')}) -{' '}
                {String(season.status ?? '')}
              </div>
              <div className="mt-2 space-y-1">
                {Object.entries(season.subcollections).map(
                  ([subName, subInfo]) => (
                    <div
                      key={subName}
                      className={`text-sm flex justify-between ${getStatusColor(subInfo.exists, subInfo.count)}`}
                    >
                      <span>
                        {getStatusIcon(subInfo.exists, subInfo.count)} {subName}
                      </span>
                      <span className="font-mono">
                        {subInfo.exists ? `${subInfo.count} docs` : 'missing'}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendations */}
      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          💡 Recommendations
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          {players.length === 0 && (
            <div>
              ❗ <strong>No players found:</strong> Run season data population
              script or check Firebase credentials
            </div>
          )}

          {fallbackDiagnostics.fallbackUsed && (
            <div>
              ⚠️ <strong>Using fallback data:</strong> Consider populating
              Firestore with current season data
            </div>
          )}

          {diagnostics.collections.seasons?.count === 0 && (
            <div>
              📅 <strong>No seasons found:</strong> Run{' '}
              <code className="bg-blue-100 px-1 rounded">
                npm run season:create
              </code>{' '}
              to set up seasons
            </div>
          )}

          {diagnostics.collections.seasons?.seasons?.some(
            (s) => s.subcollections.players?.count === 0
          ) && (
            <div>
              👥 <strong>Season missing players:</strong> Run season data
              population to add player data to season collections
            </div>
          )}

          <div className="mt-3 p-2 bg-blue-100 rounded">
            <strong>Quick Fix Commands:</strong>
            <ul className="mt-1 space-y-1 text-xs font-mono">
              <li>• npm run season:transition (full setup)</li>
              <li>• npm run season:create (create season structure)</li>
              <li>• npm run season:validate (check data integrity)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

