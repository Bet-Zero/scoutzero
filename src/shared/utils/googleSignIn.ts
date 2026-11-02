/**
 * FILE: src/shared/utils/googleSignIn.ts
 * PURPOSE: Optional Google sign-in on top of the automatic anonymous session: upgrades the guest in place so its saves keep their owner ID
 * OWNERSHIP: Shared: auth
 *
 * HISTORY:
 *  - 2026-11-02: Created
 *
 * LINKS:
 *  - Used in: src/core/layout/AccountMenu.tsx; session: src/shared/hooks/useAuth.ts
 */
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { getAnonymousUser } from '@/shared/hooks/useAuth';

export type GoogleSignInResult =
  // The guest became this Google account: same ID, every save carries over
  | { kind: 'linked' }
  // The Google account already belonged to another session (e.g. another
  // device). We switched to it; this guest's saves stay with the old guest ID.
  | { kind: 'switched' }
  // There was no guest session to upgrade
  | { kind: 'signedIn' }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

const errorCode = (error: unknown): string =>
  typeof error === 'object' && error && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';

const CANCELLED = new Set([
  'auth/popup-closed-by-user',
  'auth/cancelled-popup-request',
  'auth/user-cancelled',
]);

const friendlyError = (code: string): string => {
  switch (code) {
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in window. Allow popups for this site and try again.';
    case 'auth/unauthorized-domain':
      return "Google sign-in isn't allowed on this site address yet (add it to Firebase's authorized domains).";
    case 'auth/operation-not-allowed':
      return "Google sign-in isn't turned on in Firebase yet.";
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Google sign-in failed. Please try again.';
  }
};

const googleProvider = () => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
};

export const signInWithGoogle = async ({
  confirmSwitch = () => true,
}: {
  // Asked before leaving a guest session whose saves won't carry over
  confirmSwitch?: () => boolean;
} = {}): Promise<GoogleSignInResult> => {
  const current = auth.currentUser;
  try {
    if (current?.isAnonymous) {
      try {
        // Firebase refreshes this same user object (isAnonymous, profile);
        // no auth-state event fires because the ID does not change.
        await linkWithPopup(current, googleProvider());
        return { kind: 'linked' };
      } catch (error) {
        if (errorCode(error) !== 'auth/credential-already-in-use') throw error;
        const credential = GoogleAuthProvider.credentialFromError(
          error as Parameters<typeof GoogleAuthProvider.credentialFromError>[0]
        );
        if (!credential) throw error;
        if (!confirmSwitch()) return { kind: 'cancelled' };
        await signInWithCredential(auth, credential);
        return { kind: 'switched' };
      }
    }
    await signInWithPopup(auth, googleProvider());
    return { kind: 'signedIn' };
  } catch (error) {
    const code = errorCode(error);
    if (CANCELLED.has(code)) return { kind: 'cancelled' };
    console.warn('🔐 Google sign-in failed:', code || error);
    return { kind: 'error', message: friendlyError(code) };
  }
};

// Back to a fresh guest session, so the site keeps working signed out.
// Only a failed sign-out throws; a failed guest session leaves the visitor
// signed out with the sign-in control still available.
export const signOutOfGoogle = async (): Promise<void> => {
  await signOut(auth);
  try {
    await getAnonymousUser();
  } catch (error) {
    console.warn('🔐 Guest session after sign-out failed:', error);
  }
};

export const isGoogleUser = <
  T extends { isAnonymous: boolean; providerData: { providerId: string }[] },
>(
  user: T | null
): user is T =>
  !!user &&
  !user.isAnonymous &&
  user.providerData.some((p) => p.providerId === GoogleAuthProvider.PROVIDER_ID);
