import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { realDraftReviewPlugin } from './scripts/review/realDraftReviewPlugin';

export default defineConfig({
  plugins: [react(), realDraftReviewPlugin()],
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
