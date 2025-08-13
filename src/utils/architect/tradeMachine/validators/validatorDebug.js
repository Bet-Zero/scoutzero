import debug from '@/utils/architect/tradeMachine/tradeDebug.js';

/**
 * Debug utility for trade validators
 * Provides consistent logging and validation tracking
 */
export const validatorDebug = {
  enabled: false,
  logs: [],

  logValidation(type, team, result) {
    if (!this.enabled) return;

    const log = {
      type,
      timestamp: new Date().toISOString(),
      teamName: team.team?.teamName || team.teamId || 'Unknown Team',
      result,
    };

    this.logs.push(log);
    console.log(`[${type} Validation]`, log);
  },

  clear() {
    this.logs = [];
  },

  getLog() {
    return this.logs;
  },

  enable() {
    this.enabled = true;
  },

  disable() {
    this.enabled = false;
  },
};
