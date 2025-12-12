/**
 * FILE: src/shared/hooks/useAuth.js
 * PURPOSE: React hook to access Firebase Auth current user and userId
 * OWNERSHIP: Shared utility hook
 *
 * HISTORY:
 *  - 2025-12-12: Created auth hook for multi-user support in Architect dashboard
 *
 * LINKS:
 *  - Plan: plans/gm-dashboard-userid/plan.md
 */
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

/**
 * Hook to get the current authenticated user and userId
 * @returns {Object} { user: Firebase User | null, userId: string | null, loading: boolean }
 */
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
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
