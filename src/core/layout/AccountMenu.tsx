/**
 * FILE: src/core/layout/AccountMenu.tsx
 * PURPOSE: Header control for optional Google sign-in: "Sign in" for guests; avatar menu (account ID, sign out) once signed in
 * OWNERSHIP: Core: layout
 *
 * HISTORY:
 *  - 2026-11-02: Created
 *
 * LINKS:
 *  - Used in: src/core/layout/SiteLayout.tsx; logic: src/shared/utils/googleSignIn.ts
 */
import React, { useEffect, useReducer, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { LogIn, LogOut, Copy } from 'lucide-react';
import { useAuth } from '@/shared/hooks/useAuth';
import {
  isGoogleUser,
  signInWithGoogle,
  signOutOfGoogle,
} from '@/shared/utils/googleSignIn';

export const AccountMenu = () => {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  // Linking upgrades the same user object without an auth-state event
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  if (loading || !user) return null;

  const handleSignIn = async () => {
    setBusy(true);
    const result = await signInWithGoogle();
    setBusy(false);
    rerender();
    if (result.kind === 'linked' || result.kind === 'signedIn') {
      toast.success('Signed in with Google');
    } else if (result.kind === 'switched') {
      toast.success(
        'Signed in. Anything saved on this device before signing in stays with the old guest session.',
        { duration: 7000 }
      );
    } else if (result.kind === 'error') {
      toast.error(result.message, { duration: 7000 });
    }
  };

  const handleSignOut = async () => {
    setOpen(false);
    setBusy(true);
    try {
      await signOutOfGoogle();
    } catch {
      toast.error('Sign out failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(user.uid);
      toast.success('Account ID copied');
    } catch {
      toast.error(`Couldn't copy. Your account ID is ${user.uid}`, { duration: 10000 });
    }
  };

  if (!isGoogleUser(user)) {
    return (
      <button
        type="button"
        onClick={handleSignIn}
        disabled={busy}
        aria-label="Sign in with Google"
        title="Sign in with Google"
        className="inline-flex items-center gap-1.5 hover:text-white disabled:opacity-50"
      >
        <LogIn size={15} />
        <span className="hidden sm:inline">{busy ? 'Signing in…' : 'Sign in'}</span>
      </button>
    );
  }

  const label = user.displayName || user.email || 'Account';

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={busy}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Account: ${label}`}
        className="flex items-center rounded-full ring-1 ring-white/15 hover:ring-white/40 disabled:opacity-50"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover"
          />
        ) : (
          <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white/10 text-white text-xs font-semibold flex items-center justify-center">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[#1c1c1c] border border-white/10 rounded shadow-lg text-sm text-white/80 p-2 z-[10000] whitespace-normal">
          <div className="px-2 pb-2 mb-1 border-b border-white/10">
            <p className="text-white truncate">{user.displayName || 'Signed in'}</p>
            {user.email && <p className="text-xs text-white/45 truncate">{user.email}</p>}
          </div>
          <button
            type="button"
            onClick={copyId}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] hover:text-white text-left"
          >
            <Copy size={14} />
            Copy account ID
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/[0.06] hover:text-white text-left"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
};
