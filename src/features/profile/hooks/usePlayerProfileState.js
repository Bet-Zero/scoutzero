/**
 * FILE: src/features/profile/hooks/usePlayerProfileState.js
 * PURPOSE: Consolidated evaluation state for the Player Profile page.
 * Manages all scouting evaluation fields (traits, roles, blurbs, etc.)
 * and exposes a consistent API with automatic dirty-state tracking.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { enrichPlayerData } from '@/features/roster/utils/enrichPlayerData';
import { normalizeBlurbs } from '@/shared/utils/blurbs';
import {
  createEmptyVideoExamples,
  normalizeVideoExamples,
} from '@/shared/utils/videoExamples';
import {
  setVideoExamplesForKey,
  setBlurbForKey,
} from '@/features/profile/utils/profileHelpers';
import { DEFAULT_TRAITS } from '@/constants/scoutingConstants';

const DEFAULT_ROLES = {
  offense1: '',
  offense2: '',
  defense1: '',
  defense2: '',
};

const DEFAULT_BLURBS = {
  traits: {},
  roles: {},
  subroles: {},
  shootingProfile: '',
  twoWayMeter: '',
  overall: '',
};

/**
 * Manages all player evaluation state with automatic dirty-tracking.
 * @param {Object} detailedPlayer - Full player object from usePlayerDetail
 * @param {string} selectedPlayer - Currently selected player ID
 * @param {string|null} openModal - Currently open modal key (gates Firestore sync)
 */
const usePlayerProfileState = (detailedPlayer, selectedPlayer, openModal) => {
  const [player, setPlayer] = useState(null);
  const [traits, setTraits] = useState(DEFAULT_TRAITS);
  const [roles, setRoles] = useState(DEFAULT_ROLES);
  const [twoWay, setTwoWay] = useState(50);
  const [shootingProfile, setShootingProfile] = useState('');
  const [subRoles, setSubRoles] = useState({ offense: [], defense: [] });
  const [badges, setBadges] = useState([]);
  const [editedBlurbs, setEditedBlurbs] = useState(DEFAULT_BLURBS);
  const [videoExamples, setVideoExamples] = useState(createEmptyVideoExamples());
  const [overallGrade, setOverallGrade] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const prevPlayerIdRef = useRef(null);

  // Centralized dirty-state helper
  const markDirty = useCallback(() => {
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
    setPlayer(data);
    setTraits(data.traits || { ...DEFAULT_TRAITS });
    setRoles({ ...DEFAULT_ROLES, ...(data.roles || {}) });
    setTwoWay(Number.isFinite(data.twoWay) ? data.twoWay : 50);
    setSubRoles(data.subRoles || { offense: [], defense: [] });
    setBadges(data.badges || []);
    setShootingProfile(data.shootingProfile ?? '');
    setEditedBlurbs(normalizeBlurbs(data.blurbs || DEFAULT_BLURBS));
    setVideoExamples(normalizeVideoExamples(data.videoExamples));
    setOverallGrade(data.overallGrade || null);
    setHasChanges(false);

    prevPlayerIdRef.current = selectedPlayer;
  }, [selectedPlayer, detailedPlayer, hasChanges, openModal]);

  // --- Handlers (all use markDirty for consistent dirty tracking) ---

  const handleTraitChange = useCallback((e, trait) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.round((clickX / rect.width) * 100);
    setTraits((prev) => ({ ...prev, [trait]: percentage }));
    markDirty();
  }, [markDirty]);

  const handleRoleChange = useCallback((key, value) => {
    setRoles((prev) => ({ ...prev, [key]: value }));
    markDirty();
  }, [markDirty]);

  const handleTwoWayChange = useCallback((value) => {
    setTwoWay(value);
    markDirty();
  }, [markDirty]);

  const handleSetSubRoles = useCallback((value) => {
    setSubRoles(typeof value === 'function' ? value : value);
    markDirty();
  }, [markDirty]);

  const handleSetBadges = useCallback((value) => {
    setBadges(typeof value === 'function' ? value : value);
    markDirty();
  }, [markDirty]);

  const handleSetShootingProfile = useCallback((value) => {
    setShootingProfile(value);
    markDirty();
  }, [markDirty]);

  const handleSetOverallGrade = useCallback((val) => {
    setOverallGrade(val);
    markDirty();
  }, [markDirty]);

  const handleBlurbChange = useCallback((key, value) => {
    setEditedBlurbs((prev) => setBlurbForKey(prev, key, value));
    markDirty();
  }, [markDirty]);

  const handleVideoExamplesChange = useCallback((key, list) => {
    setVideoExamples((prev) => setVideoExamplesForKey(prev, key, list));
    markDirty();
  }, [markDirty]);

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
  };
};

export default usePlayerProfileState;
