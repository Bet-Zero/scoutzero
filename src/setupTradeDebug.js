// src/setupTradeDebug.js
import tradeDebug from '@/utils/architect/tradeMachine/engine/tradeDebug.js';

// Enable the debugger in development environments for detailed logging
tradeDebug.enabled = process.env.NODE_ENV !== 'production';
