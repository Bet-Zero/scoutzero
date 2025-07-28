import { afterEach } from 'vitest';
import { tradeDebug } from '../src/utils/architect/tradeMachine/tradeValidator.js';

tradeDebug.enabled = true;

afterEach((context) => {
  context.onTestFailed(() => {
    console.log('--- Debug Output ---');
    console.log(tradeDebug.flushToUI().join('\n'));
  });
  tradeDebug.logs = [];
  tradeDebug.records = [];
});
