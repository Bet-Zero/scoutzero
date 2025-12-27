/**
 * FILE: src/shared/hooks/useAuth.js
 * PURPOSE: React hook to access Firebase Auth current user and userId
 * OWNERSHIP: Shared utility hook
 *
 * HISTORY:
 *  - 2025-12-12: Created auth hook for multi-user support in Architect dashboard
 *  - 2025-12-26: Added dev-only auto anonymous sign-in for local emulator use
 *
 * LINKS:
 *  - Plan: plans/gm-dashboard-userid/plan.md
 */
import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

/**
 * Hook to get the current authenticated user and userId
 * In DEV mode, automatically signs in anonymously if no user exists.
 * @returns {Object} { user: Firebase User | null, userId: string | null, loading: boolean }
 */
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        setLoading(false);
      } else if (import.meta.env.DEV) {
        // Auto sign-in anonymously in development
        signInAnonymously(auth)
          .then((cred) => {
            console.log('🔐 Dev: Anonymous sign-in successful:', cred.user.uid);
            setUser(cred.user);
            setLoading(false);
          })
          .catch((err) => {
            console.error('🔐 Dev: Anonymous sign-in failed:', err);
            setLoading(false);
          });
      } else {
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

