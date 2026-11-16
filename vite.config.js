import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { realDraftReviewPlugin } from './scripts/review/realDraftReviewPlugin';
import { worldHttpProofPlugin } from './scripts/dev/worldHttpPlugin';

export default defineConfig({
  plugins: [react(), realDraftReviewPlugin(), worldHttpProofPlugin()],
  server: {
    watch: { ignored: ['**/.scoutzero-dev/**', '**/.scoutzero-dev-tools/**'] },
    fs: {
      deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**',
        '**/.scoutzero-dev/**', '**/.scoutzero-dev-tools/**', '**/work/zero-billing/**'],
    },
  },
  resolve: {
    alias: [
      {
        find: '@hello-pangea/dnd',
        replacement: path.resolve(
          __dirname,
          'node_modules/@hello-pangea/dnd/dist/index.js'
        ),
      },
      {
        find: /^@\//,
        replacement: `${path.resolve(__dirname, './src')}/`,
      },
    ],
  },
});
