// src/setupTradeDebug.js
import { tradeDebug } from '@/utils/architect/tradeMachine/tradeValidator.js';

// Enable the debugger in development environments for detailed logging
tradeDebug.enabled = process.env.NODE_ENV !== 'production';
