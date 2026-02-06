/**
 * FILE: src/shared/hooks/useAuth.js
 * PURPOSE: React hook to access Firebase Auth current user and userId
 * OWNERSHIP: Shared utility hook
 *
 * HISTORY:
 *  - 2025-12-12: Created auth hook for multi-user support in Architect dashboard
 *  - 2025-12-26: Added dev-only auto anonymous sign-in for local emulator use
 *  - 2026-02-05: E4 — Enable anonymous auth in all environments (ownership scoping)
 *
 * LINKS:
 *  - Plan: plans/gm-dashboard-userid/plan.md
 */
import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

/**
 * Hook to get the current authenticated user and userId.
 * Automatically signs in anonymously if no user exists (all environments).
 * Uses a ref guard to prevent repeated sign-in attempts.
 * @returns {Object} { user: Firebase User | null, userId: string | null, loading: boolean }
 */
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasAttemptedSignIn = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else if (!hasAttemptedSignIn.current) {
        // E4: Auto sign-in anonymously in all environments (one attempt per mount)
        hasAttemptedSignIn.current = true;
        signInAnonymously(auth)
          .then((cred) => {
            console.log('🔐 Anonymous sign-in successful:', cred.user.uid);
            // onAuthStateChanged will fire again with the new user
          })
          .catch((err) => {
            console.warn('🔐 Anonymous sign-in failed:', err);
            setUser(null);
            setLoading(false);
          });
      } else {
        // Sign-in was already attempted and failed or user signed out
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return {
    user,
    userId: user?.uid || null,
    loading,
  };
};

export { useAuth };
