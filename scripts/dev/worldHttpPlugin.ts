/** Loopback proof uses the same HTTP adapter as the Vercel entry point. */
import type { Plugin } from 'vite';
import { serveArchitectWorld } from '../../server/architectWorld';

export function worldHttpProofPlugin(): Plugin {
  return {
    name: 'world-http-emulator',
    configureServer(server) {
      if (process.env.SCOUTZERO_WORLD_LOCAL_PROOF !== 'true') return;
      server.middlewares.use('/api/architect/world', (req, res) => {
        void serveArchitectWorld(req, res);
      });
    },
  };
}
