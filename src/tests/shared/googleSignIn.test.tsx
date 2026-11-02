import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

type FakeUser = {
  uid: string;
  isAnonymous: boolean;
  providerData: { providerId: string }[];
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
  reload: () => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  auth: { currentUser: null as unknown },
  listeners: new Set<(user: unknown) => void>(),
  signInAnonymously: vi.fn(),
  linkWithPopup: vi.fn(),
  signInWithPopup: vi.fn(),
  signInWithCredential: vi.fn(),
  signOut: vi.fn(),
  credentialFromError: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('@/firebaseConfig', () => ({
  auth: { get currentUser() { return mocks.auth.currentUser; } },
}));
vi.mock('firebase/auth', () => {
  class GoogleAuthProvider {
    static PROVIDER_ID = 'google.com';
    static credentialFromError = mocks.credentialFromError;
    setCustomParameters() {}
  }
  return {
    GoogleAuthProvider,
    onAuthStateChanged: (_auth: unknown, listener: (user: unknown) => void) => {
      mocks.listeners.add(listener);
      return () => mocks.listeners.delete(listener);
    },
    signInAnonymously: mocks.signInAnonymously,
    linkWithPopup: mocks.linkWithPopup,
    signInWithPopup: mocks.signInWithPopup,
    signInWithCredential: mocks.signInWithCredential,
    signOut: mocks.signOut,
  };
});
vi.mock('react-hot-toast', () => ({
  default: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { isGoogleUser, signInWithGoogle, signOutOfGoogle } from '@/shared/utils/googleSignIn';
import { AccountMenu } from '@/core/layout/AccountMenu';

const guest = (uid = 'guest-1'): FakeUser => ({
  uid,
  isAnonymous: true,
  providerData: [],
  reload: vi.fn(async () => {}),
});
const authError = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  mocks.auth.currentUser = null;
  mocks.listeners.clear();
  for (const fn of [
    mocks.signInAnonymously, mocks.linkWithPopup, mocks.signInWithPopup,
    mocks.signInWithCredential, mocks.signOut, mocks.credentialFromError,
    mocks.toastSuccess, mocks.toastError,
  ]) fn.mockReset();
});
afterEach(cleanup);

describe('signInWithGoogle', () => {
  it('upgrades the guest in place so its ID (and saves) are kept', async () => {
    const user = guest();
    mocks.auth.currentUser = user;
    mocks.linkWithPopup.mockResolvedValue({ user });
    await expect(signInWithGoogle()).resolves.toEqual({ kind: 'linked' });
    expect(mocks.linkWithPopup).toHaveBeenCalledWith(user, expect.anything());
    expect(mocks.signInWithPopup).not.toHaveBeenCalled();
    expect(mocks.signInWithCredential).not.toHaveBeenCalled();
  });

  it('switches to the Google account when it already belongs to another session', async () => {
    mocks.auth.currentUser = guest();
    const error = authError('auth/credential-already-in-use');
    const credential = { providerId: 'google.com' };
    mocks.linkWithPopup.mockRejectedValue(error);
    mocks.credentialFromError.mockReturnValue(credential);
    mocks.signInWithCredential.mockResolvedValue({});
    await expect(signInWithGoogle()).resolves.toEqual({ kind: 'switched' });
    expect(mocks.credentialFromError).toHaveBeenCalledWith(error);
    expect(mocks.signInWithCredential).toHaveBeenCalledWith(expect.anything(), credential);
  });

  it('signs in directly when there is no guest session', async () => {
    mocks.signInWithPopup.mockResolvedValue({});
    await expect(signInWithGoogle()).resolves.toEqual({ kind: 'signedIn' });
    expect(mocks.linkWithPopup).not.toHaveBeenCalled();
  });

  it('treats a closed popup as a cancel, not an error', async () => {
    mocks.auth.currentUser = guest();
    mocks.linkWithPopup.mockRejectedValue(authError('auth/popup-closed-by-user'));
    await expect(signInWithGoogle()).resolves.toEqual({ kind: 'cancelled' });
  });

  it('explains setup errors in plain words', async () => {
    mocks.auth.currentUser = guest();
    mocks.linkWithPopup.mockRejectedValue(authError('auth/unauthorized-domain'));
    const result = await signInWithGoogle();
    expect(result.kind).toBe('error');
    expect(result.kind === 'error' && result.message).toMatch(/authorized domains/);
  });
});

describe('signOutOfGoogle', () => {
  it('signs out, then starts a fresh guest session', async () => {
    const order: string[] = [];
    mocks.signOut.mockImplementation(async () => {
      order.push('signOut');
      mocks.auth.currentUser = null;
    });
    mocks.signInAnonymously.mockImplementation(async () => {
      order.push('anonymous');
      return { user: guest('guest-2') };
    });
    await signOutOfGoogle();
    expect(order).toEqual(['signOut', 'anonymous']);
  });
});

describe('isGoogleUser', () => {
  it('is true only for a non-anonymous user with a Google provider', () => {
    expect(isGoogleUser(null)).toBe(false);
    expect(isGoogleUser(guest())).toBe(false);
    expect(isGoogleUser({ isAnonymous: false, providerData: [{ providerId: 'google.com' }] })).toBe(true);
  });
});

describe('AccountMenu', () => {
  const mount = (user: FakeUser) => {
    mocks.auth.currentUser = user;
    render(<AccountMenu />);
    act(() => mocks.listeners.forEach((listener) => listener(user)));
  };

  it('offers sign-in to guests and shows the avatar menu after linking', async () => {
    const user = guest();
    mocks.linkWithPopup.mockImplementation(async () => {
      Object.assign(user, {
        isAnonymous: false,
        providerData: [{ providerId: 'google.com' }],
        displayName: 'Test Person',
        email: 'test@example.com',
      });
      return { user };
    });
    mount(user);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    const account = await screen.findByRole('button', { name: 'Account: Test Person' });
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Signed in with Google');
    fireEvent.click(account);
    expect(screen.getByText('test@example.com')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Copy account ID/ })).toBeTruthy();
  });

  it('shows the plain-words error and stays signed out when sign-in fails', async () => {
    mocks.linkWithPopup.mockRejectedValue(authError('auth/operation-not-allowed'));
    mount(guest());
    fireEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastError.mock.calls[0][0]).toMatch(/turned on in Firebase/);
    expect(screen.getByRole('button', { name: 'Sign in with Google' })).toBeTruthy();
  });

  it('signs out from the avatar menu', async () => {
    mocks.signOut.mockResolvedValue(undefined);
    mocks.signInAnonymously.mockResolvedValue({ user: guest('guest-2') });
    mount({ ...guest('google-1'), isAnonymous: false, providerData: [{ providerId: 'google.com' }], displayName: 'Test Person' });
    fireEvent.click(screen.getByRole('button', { name: 'Account: Test Person' }));
    fireEvent.click(screen.getByRole('button', { name: /Sign out/ }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalledTimes(1));
  });
});
