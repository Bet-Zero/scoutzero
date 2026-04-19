import { afterEach } from 'vitest';
import debug from '@/features/architect/utils/tradeMachine/engine/tradeDebug';

debug.enabled = true;

afterEach((context) => {
  context.onTestFailed(() => {
    console.log('--- Debug Output ---');
    console.log(debug.flushToUI().join('\n'));
  });
  debug.logs = [];
  debug.records = [];
});
