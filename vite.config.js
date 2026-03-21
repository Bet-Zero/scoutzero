import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\/shared\/components\/ui\/filters$/,
        replacement: path.resolve(
          __dirname,
          './src/shared/components/ui/filters/index.ts'
        ),
      },
      {
        find: /^@\/shared\/utils\/contracts$/,
        replacement: path.resolve(
          __dirname,
          './src/shared/utils/contracts/index.ts'
        ),
      },
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
