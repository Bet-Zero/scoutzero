/** A credential-free REST client only for the SDK's fixed loopback demo channel. */
export function configureCloudEmulatorTransport(env: NodeJS.ProcessEnv, configure: () => void) {
  if (env.FUNCTIONS_EMULATOR !== 'true' || env.GCLOUD_PROJECT !== 'demo-architect-review' ||
      env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8082' || env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099') return;
  configure();
}

configureCloudEmulatorTransport(process.env, () => {
  // The managed worker's ambient ADC can try the real metadata service even
  // for an emulator. Give only this fixed local client the emulator's reserved
  // owner marker; it is not a Google credential or service-account key.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const admin = require('firebase-admin') as typeof import('firebase-admin');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { GoogleAuth, OAuth2Client } = require('google-auth-library') as typeof import('google-auth-library');
  const local = new OAuth2Client();
  const marker = () => ({ access_token: 'owner', expiry_date: Date.now() + 3600000 });
  local.setCredentials(marker());
  local.refreshHandler = async () => marker();
  if (!admin.apps.length) admin.initializeApp();
  admin.firestore().settings({ preferRest: true, host: '127.0.0.1:8082', ssl: false,
    ...{ auth: new GoogleAuth({ projectId: 'demo-architect-review', authClient: local }) } });
  console.info('[cloud] Fixed local demo Firestore channel configured');
});
