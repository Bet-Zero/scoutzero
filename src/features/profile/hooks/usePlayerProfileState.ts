/**
 * FILE: src/features/profile/hooks/usePlayerProfileState.ts
 * PURPOSE: Consolidated evaluation state for the Player Profile page.
 * Manages all scouting evaluation fields (traits, roles, blurbs, etc.)
 * and exposes a consistent API with automatic dirty-state tracking.
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  type Dispatch,
  type MouseEvent,
  type SetStateAction,
} from 'react';
import {
  enrichPlayerData,
  type EnrichablePlayerData,
  type EnrichedPlayerData,
  type PlayerSubRoles,
} from '@/features/roster/utils/enrichPlayerData';
import { normalizeBlurbs } from '@/shared/utils/blurbs';
import type { Blurbs } from '@/shared/utils/blurbs';
import {
  createEmptyVideoExamples,
  normalizeVideoExampleList,
  normalizeVideoExamples,
} from '@/shared/utils/videoExamples';
import type { NormalizedVideoExamples } from '@/shared/utils/videoExamples';
import {
  getBlurbValue,
  getVideoExamplesForKey,
  setVideoExamplesForKey,
  setBlurbForKey,
  type ProfileDetailKey,
} from '@/features/profile/utils/profileHelpers';
import { DEFAULT_TRAITS } from '@/constants/scoutingConstants';

export type ProfileRoles = {
  offense1: string;
  offense2: string;
  defense1: string;
  defense2: string;
};

export type ModalSavePayload = {
  blurbs: Blurbs;
  videoExamples: NormalizedVideoExamples;
  hasChanges: boolean;
};

export type UsePlayerProfileStateResult = {
  player: EnrichedPlayerData<EnrichablePlayerData> | null;
  traits: Record<string, number>;
  roles: ProfileRoles;
  twoWay: number;
  shootingProfile: string;
  subRoles: PlayerSubRoles;
  badges: string[];
  editedBlurbs: Blurbs;
  videoExamples: NormalizedVideoExamples;
  overallGrade: number | null;
  hasChanges: boolean;
  setHasChanges: Dispatch<SetStateAction<boolean>>;
  handleTraitChange: (
    event: MouseEvent<HTMLElement>,
    trait: string
  ) => void;
  handleRoleChange: (key: keyof ProfileRoles, value: string) => void;
  handleTwoWayChange: (value: number) => void;
  handleSetSubRoles: (value: SetStateAction<PlayerSubRoles>) => void;
  handleSetBadges: (value: SetStateAction<string[]>) => void;
  handleSetShootingProfile: (value: string) => void;
  handleSetOverallGrade: (value: number | null) => void;
  handleBlurbChange: (key: ProfileDetailKey, value: string) => void;
  handleVideoExamplesChange: (key: ProfileDetailKey, list: unknown) => void;
  buildModalSavePayload: (
    key: ProfileDetailKey,
    value: string,
    list: unknown
  ) => ModalSavePayload;
  commitSavedModalDraft: (
    payload: Partial<ModalSavePayload> | null | undefined
  ) => void;
};

const DEFAULT_ROLES: ProfileRoles = {
  offense1: '',
  offense2: '',
  defense1: '',
  defense2: '',
};

const DEFAULT_BLURBS: Blurbs = {
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: '',
  twoWayMeter: '',
  overall: '',
};

const createDefaultSubRoles = (): PlayerSubRoles => ({
  offense: [],
  defense: [],
});

const areVideoListsEqual = (currentList: unknown, nextList: unknown): boolean =>
  JSON.stringify(normalizeVideoExampleList(currentList)) ===
  JSON.stringify(normalizeVideoExampleList(nextList));

/**
 * Manages all player evaluation state with automatic dirty-tracking.
 */
const usePlayerProfileState = (
  detailedPlayer: EnrichablePlayerData | null | undefined,
  selectedPlayer: string,
  openModal: ProfileDetailKey
): UsePlayerProfileStateResult => {
  const [player, setPlayer] = useState<EnrichedPlayerData<EnrichablePlayerData> | null>(null);
  const [traits, setTraits] = useState<Record<string, number>>(DEFAULT_TRAITS);
  const [roles, setRoles] = useState<ProfileRoles>(DEFAULT_ROLES);
  const [twoWay, setTwoWay] = useState<number>(50);
  const [shootingProfile, setShootingProfile] = useState<string>('');
  const [subRoles, setSubRoles] = useState<PlayerSubRoles>(
    createDefaultSubRoles
  );
  const [badges, setBadges] = useState<string[]>([]);
  const [editedBlurbs, setEditedBlurbs] = useState<Blurbs>(DEFAULT_BLURBS);
  const [videoExamples, setVideoExamples] = useState<NormalizedVideoExamples>(
    createEmptyVideoExamples
  );
  const [overallGrade, setOverallGrade] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const prevPlayerIdRef = useRef<string | null>(null);

  // Centralized dirty-state helper
  const markDirty = useCallback((): void => {
    setHasChanges(true);
  }, []);

  // Sync from Firestore when player changes or when no pending edits
  useEffect(() => {
    if (!selectedPlayer || !detailedPlayer) {
      setPlayer(null);
      prevPlayerIdRef.current = null;
      return;
    }

    const playerChanged = selectedPlayer !== prevPlayerIdRef.current;

    if (!playerChanged && (hasChanges || openModal)) {
      return;
    }

    const data = enrichPlayerData(detailedPlayer);
    if (!data) {
      setPlayer(null);
      return;
    }

    setPlayer(data);
    setTraits(data.traits || { ...DEFAULT_TRAITS });
    setRoles({ ...DEFAULT_ROLES, ...(data.primaryEvaluation.roles || {}) });
    setTwoWay(
      typeof data.twoWay === 'number' && Number.isFinite(data.twoWay)
        ? data.twoWay
        : 50
    );
    setSubRoles(data.subRoles || createDefaultSubRoles());
    setBadges(data.badges || []);
    setShootingProfile(data.shootingProfile ?? '');
    setEditedBlurbs(normalizeBlurbs(data.blurbs || DEFAULT_BLURBS));
    setVideoExamples(normalizeVideoExamples(data.videoExamples));
    setOverallGrade(data.overallGrade || null);
    setHasChanges(false);

    prevPlayerIdRef.current = selectedPlayer;
  }, [selectedPlayer, detailedPlayer, hasChanges, openModal]);

  // --- Handlers (all use markDirty for consistent dirty tracking) ---

  const handleTraitChange = useCallback((
    event: MouseEvent<HTMLElement>,
    trait: string
  ): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const percentage = Math.round((clickX / rect.width) * 100);
    setTraits((prev) => ({ ...prev, [trait]: percentage }));
    markDirty();
  }, [markDirty]);

  const handleRoleChange = useCallback((
    key: keyof ProfileRoles,
    value: string
  ): void => {
    setRoles((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }, [markDirty]);

  const handleTwoWayChange = useCallback((value: number): void => {
    setTwoWay(value);
    markDirty();
  }, [markDirty]);

  const handleSetSubRoles = useCallback((
    value: SetStateAction<PlayerSubRoles>
  ): void => {
    setSubRoles(value);
    markDirty();
  }, [markDirty]);

  const handleSetBadges = useCallback((
    value: SetStateAction<string[]>
  ): void => {
    setBadges(value);
    markDirty();
  }, [markDirty]);

  const handleSetShootingProfile = useCallback((value: string): void => {
    setShootingProfile(value);
    markDirty();
  }, [markDirty]);

  const handleSetOverallGrade = useCallback((value: number | null): void => {
    setOverallGrade(value);
    markDirty();
  }, [markDirty]);

  const handleBlurbChange = useCallback((
    key: ProfileDetailKey,
    value: string
  ): void => {
    setEditedBlurbs((prev) => setBlurbForKey(prev, key, value));
    markDirty();
  }, [markDirty]);

  const handleVideoExamplesChange = useCallback((
    key: ProfileDetailKey,
    list: unknown
  ): void => {
    setVideoExamples((prev) => setVideoExamplesForKey(prev, key, list));
    markDirty();
  }, [markDirty]);

  const buildModalSavePayload = useCallback((
    key: ProfileDetailKey,
    value: string,
    list: unknown
  ): ModalSavePayload => {
    const nextBlurbs = setBlurbForKey(editedBlurbs, key, value);
    const nextVideoExamples = setVideoExamplesForKey(videoExamples, key, list);

    return {
      blurbs: nextBlurbs,
      videoExamples: nextVideoExamples,
      hasChanges:
        getBlurbValue(editedBlurbs, key) !== value ||
        !areVideoListsEqual(getVideoExamplesForKey(videoExamples, key), list),
    };
  }, [editedBlurbs, videoExamples]);

  const commitSavedModalDraft = useCallback((
    payload: Partial<ModalSavePayload> | null | undefined
  ): void => {
    if (!payload) return;
    setEditedBlurbs(payload.blurbs || DEFAULT_BLURBS);
    setVideoExamples(payload.videoExamples || createEmptyVideoExamples());
  }, []);

  return {
    // Data
    player,
    traits,
    roles,
    twoWay,
    shootingProfile,
    subRoles,
    badges,
    editedBlurbs,
    videoExamples,
    overallGrade,
    hasChanges,
    setHasChanges,

    // Handlers
    handleTraitChange,
    handleRoleChange,
    handleTwoWayChange,
    handleSetSubRoles,
    handleSetBadges,
    handleSetShootingProfile,
    handleSetOverallGrade,
    handleBlurbChange,
    handleVideoExamplesChange,
    buildModalSavePayload,
    commitSavedModalDraft,
  };
};

export default usePlayerProfileState;
