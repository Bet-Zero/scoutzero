import { afterEach } from 'vitest';
import debug from '@/utils/architect/tradeMachine/engine/tradeDebug.js';

debug.enabled = true;

afterEach((context) => {
  context.onTestFailed(() => {
    console.log('--- Debug Output ---');
    console.log(debug.flushToUI().join('\n'));
  });
  debug.logs = [];
  debug.records = [];
});
