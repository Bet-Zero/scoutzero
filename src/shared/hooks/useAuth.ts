import { useState, useEffect, useRef } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { auth } from '@/firebaseConfig';

interface UseAuthResult {
  user: User | null;
  userId: string | null;
  loading: boolean;
}

const useAuth = (): UseAuthResult => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const hasAttemptedSignIn = useRef<boolean>(false);

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
            // onAuthStateChanged should fire again, but keep the UI from
            // staying in a loading state if the follow-up callback is delayed.
            setUser(cred.user);
            setLoading(false);
          })
          .catch((err: unknown) => {
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
    userId: user?.uid ?? null,
    loading,
  };
};

export { useAuth };
