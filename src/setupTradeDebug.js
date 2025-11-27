// src/setupTradeDebug.js
import tradeDebug from '@/features/architect/utils/tradeMachine/engine/tradeDebug.js';

// Enable the debugger in development environments for detailed logging
tradeDebug.enabled = process.env.NODE_ENV !== 'production';
