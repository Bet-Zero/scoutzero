/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PLAYERS_COLLECTION?: string;
  readonly VITE_ARCHITECT_BASE_PLAYERS_PATH?: string;
  readonly VITE_ARCHITECT_BASE_TEAMS_PATH?: string;
  readonly VITE_ARCHITECT_BASE_ENTITLEMENTS_PATH?: string;
  readonly VITE_ARCHITECT_WORLDS_COLLECTION?: string;
  readonly VITE_FIREBASE_API_KEY?: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string;
  readonly VITE_FIREBASE_PROJECT_ID?: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string;
  readonly VITE_FIREBASE_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
