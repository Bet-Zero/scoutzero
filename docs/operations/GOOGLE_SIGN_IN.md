# Google Sign-In and Owner Access

Every visitor is signed in automatically as an anonymous Firebase user
(`src/shared/hooks/useAuth.ts`). Google sign-in is optional and lives in the
site header (`src/core/layout/AccountMenu.tsx`).

## How sign-in behaves

- **Guest → Google:** signing in links Google to the current anonymous user.
  The account ID does not change, so everything that browser already saved
  (lists, tier lists, rosters, ranker sessions, GM worlds) stays accessible.
- **Google account already used elsewhere:** the browser switches to that
  Google account. Anything the guest session on this browser saved stays with
  the old guest ID and is not merged.
- **Sign out:** the browser starts a fresh anonymous guest session.
- Sign-in uses a popup. The redirect flow is unreliable when the site is not
  hosted on the Firebase auth domain.

Firestore rules are unchanged: user data is readable and writable only by the
`ownerUid` that created it.

## One-time Firebase setup

1. Firebase console → **Authentication → Sign-in method** → enable **Google**
   (pick a support email).
2. **Authentication → Settings → Authorized domains** → add every domain the
   site is served from (for example the production Vercel domain and any custom
   domain). Preview deployments need their domain added before sign-in works
   there; anonymous use works regardless.

## Owner access

Owner-only features (ranker saving, List Manager) check the signed-in ID
against `VITE_OWNER_UIDS` (`src/config/ownerConfig.ts`).

1. Sign in with Google on the site.
2. Open the avatar menu → **Copy account ID**.
3. Set `VITE_OWNER_UIDS` to that ID in the hosting environment variables
   (comma-separate several IDs) and redeploy; Vite bakes the value into the build.

The same ID then applies on every device where you sign in with that Google
account.
