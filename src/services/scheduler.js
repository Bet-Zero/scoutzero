/**
 * Automated Scheduler Service
 * Replaces manual cron jobs and script execution with intelligent scheduling
 */

import { dataOrchestrator } from './dataOrchestrator.js';

/**
 * Scheduler Service Class
 * Manages automated execution of data pipeline
 */
export class SchedulerService {
  constructor() {
    this.intervals = new Map();
    this.isActive = false;
    this.schedules = {
      // Main data pipeline - every 6 hours
      mainPipeline: {
        interval: 6 * 60 * 60 * 1000, // 6 hours in ms
        lastRun: null,
        enabled: true,
        description: 'Full data pipeline execution'
      },
      // Quick stats update - every 30 minutes during games
      quickStats: {
        interval: 30 * 60 * 1000, // 30 minutes in ms
        lastRun: null,
        enabled: false, // Enable during game season
        description: 'Quick stats refresh during games'
      },
      // Contract updates - daily at 2 AM ET
      contracts: {
        interval: 24 * 60 * 60 * 1000, // 24 hours in ms
        lastRun: null,
        enabled: true,
        targetHour: 2, // 2 AM ET
        description: 'Daily contract updates'
      }
    };
  }

  /**
   * Start the automated scheduler
   */
  start() {
    if (this.isActive) {
      console.log('⏳ Scheduler already running');
      return;
    }

    console.log('🚀 Starting automated scheduler...');
    this.isActive = true;

    // Schedule main pipeline
    this.scheduleMainPipeline();

    // Schedule contract updates
    this.scheduleContractUpdates();

    // Schedule health checks
    this.scheduleHealthChecks();

    console.log('✅ Automated scheduler started');
    this.logScheduleStatus();
  }

  /**
   * Stop the automated scheduler
   */
  stop() {
    console.log('🛑 Stopping automated scheduler...');
    
    for (const [name, intervalId] of this.intervals) {
      clearInterval(intervalId);
      console.log(`📋 Cleared interval: ${name}`);
    }
    
    this.intervals.clear();
    this.isActive = false;
    
    console.log('✅ Scheduler stopped');
  }

  /**
   * Schedule main data pipeline execution
   */
  scheduleMainPipeline() {
    const schedule = this.schedules.mainPipeline;
    
    if (!schedule.enabled) {
      console.log('📋 Main pipeline scheduling disabled');
      return;
    }

    // Run immediately if never run, or if last run was > 6 hours ago
    const shouldRunNow = !schedule.lastRun || 
      (Date.now() - new Date(schedule.lastRun).getTime()) > schedule.interval;

    if (shouldRunNow) {
      console.log('🚀 Running main pipeline immediately...');
      this.runMainPipeline();
    }

    // Schedule recurring execution
    const intervalId = setInterval(() => {
      this.runMainPipeline();
    }, schedule.interval);

    this.intervals.set('mainPipeline', intervalId);
    
    console.log(`📅 Main pipeline scheduled every ${schedule.interval / (60 * 60 * 1000)} hours`);
  }

  /**
   * Schedule contract updates for specific time
   */
  scheduleContractUpdates() {
    const schedule = this.schedules.contracts;
    
    if (!schedule.enabled) {
      console.log('📋 Contract updates scheduling disabled');
      return;
    }

    // Calculate time until next 2 AM ET
    const now = new Date();
    const next2AM = new Date();
    next2AM.setHours(schedule.targetHour, 0, 0, 0);
    
    // If 2 AM already passed today, schedule for tomorrow
    if (next2AM <= now) {
      next2AM.setDate(next2AM.getDate() + 1);
    }

    const timeUntilNext = next2AM.getTime() - now.getTime();
    
    // Initial timeout to sync with 2 AM
    setTimeout(() => {
      this.runContractUpdates();
      
      // Then schedule daily interval
      const intervalId = setInterval(() => {
        this.runContractUpdates();
      }, schedule.interval);
      
      this.intervals.set('contracts', intervalId);
      
    }, timeUntilNext);

    console.log(`📅 Contract updates scheduled for ${next2AM.toLocaleString()} and daily thereafter`);
  }

  /**
   * Schedule periodic health checks
   */
  scheduleHealthChecks() {
    // Health check every 15 minutes
    const intervalId = setInterval(() => {
      this.performHealthCheck();
    }, 15 * 60 * 1000);

    this.intervals.set('healthCheck', intervalId);
    console.log('📅 Health checks scheduled every 15 minutes');
  }

  /**
   * Execute main data pipeline
   */
  async runMainPipeline() {
    try {
      console.log('🔄 Scheduled main pipeline execution starting...');
      
      const result = await dataOrchestrator.runFullPipeline({
        trigger: 'scheduled',
        scheduledAt: new Date().toISOString()
      });

      this.schedules.mainPipeline.lastRun = new Date().toISOString();
      
      console.log('✅ Scheduled main pipeline completed successfully');
      
      // Store execution results
      await this.recordExecution('mainPipeline', result);

    } catch (error) {
      console.error('❌ Scheduled main pipeline failed:', error);
      
      // Record failure and potentially alert
      await this.recordExecution('mainPipeline', {
        status: 'failed',
        error: error.message,
        timestamp: new Date().toISOString()
      });

      // Implement retry logic for critical failures
      await this.handlePipelineFailure(error);
    }
  }

  /**
   * Execute contract updates
   */
  async runContractUpdates() {
    try {
      console.log('💰 Scheduled contract updates starting...');
      
      // Run just the contract portion of the pipeline
      const result = await dataOrchestrator.executeStep('updateContracts', async () => {
        const contracts = await nbaApi.getPlayerContracts();
        await dataOrchestrator.syncContractsToFirestore(contracts);
        return { contractsUpdated: 0 };
      });

      this.schedules.contracts.lastRun = new Date().toISOString();
      
      console.log('✅ Scheduled contract updates completed');
      
      await this.recordExecution('contracts', result);

    } catch (error) {
      console.error('❌ Scheduled contract updates failed:', error);
      await this.recordExecution('contracts', {
        status: 'failed',
        error: error.message
      });
    }
  }

  /**
   * Perform system health checks
   */
  async performHealthCheck() {
    const health = {
      timestamp: new Date().toISOString(),
      scheduler: {
        active: this.isActive,
        intervals: this.intervals.size,
        schedules: Object.keys(this.schedules).length
      },
      orchestrator: dataOrchestrator.getStatus(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage()
      }
    };

    // Check if pipeline is stuck
    if (health.orchestrator.isRunning) {
      const runningTime = Date.now() - new Date(health.orchestrator.lastRun?.startTime || Date.now()).getTime();
      const maxRunTime = 2 * 60 * 60 * 1000; // 2 hours max
      
      if (runningTime > maxRunTime) {
        console.warn('⚠️ Pipeline appears to be stuck - running for over 2 hours');
        // Could implement automatic restart logic here
      }
    }

    // Log health status periodically (every hour)
    const hourlyCheck = Math.floor(Date.now() / (60 * 60 * 1000));
    if (hourlyCheck % 4 === 0) { // Every 4th check (hourly if checking every 15 min)
      console.log('💓 System health check:', {
        active: health.scheduler.active,
        lastPipelineRun: health.orchestrator.lastRun?.startTime,
        totalRuns: health.orchestrator.stats.totalRuns,
        successRate: health.orchestrator.stats.totalRuns > 0 
          ? Math.round((health.orchestrator.stats.successfulRuns / health.orchestrator.stats.totalRuns) * 100) + '%'
          : 'N/A'
      });
    }

    return health;
  }

  /**
   * Handle pipeline failures with intelligent retry logic
   */
  async handlePipelineFailure(error) {
    const failures = this.schedules.mainPipeline.recentFailures || [];
    failures.push({
      timestamp: new Date().toISOString(),
      error: error.message
    });

    // Keep only last 5 failures
    this.schedules.mainPipeline.recentFailures = failures.slice(-5);

    // If multiple failures in short time, extend retry interval
    const recentFailures = failures.filter(f => 
      Date.now() - new Date(f.timestamp).getTime() < 60 * 60 * 1000 // 1 hour
    );

    if (recentFailures.length >= 3) {
      console.log('⚠️ Multiple recent failures - extending retry interval');
      
      // Retry in 1 hour instead of regular schedule
      setTimeout(() => {
        console.log('🔄 Retry attempt after failure cooldown');
        this.runMainPipeline();
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Record execution results for monitoring
   */
  async recordExecution(type, result) {
    try {
      // This would store execution history in Firestore for monitoring
      const execution = {
        type,
        timestamp: new Date().toISOString(),
        result,
        scheduler_info: {
          active: this.isActive,
          intervals: this.intervals.size
        }
      };

      // Store in Firestore for dashboard/monitoring
      console.log(`📝 Recording ${type} execution:`, {
        status: result.status || 'unknown',
        duration: result.duration || 0
      });

    } catch (error) {
      console.warn('⚠️ Failed to record execution:', error.message);
    }
  }

  /**
   * Get current schedule status
   */
  getStatus() {
    return {
      active: this.isActive,
      intervals: Array.from(this.intervals.keys()),
      schedules: this.schedules,
      nextRuns: this.getNextRuns()
    };
  }

  /**
   * Calculate next run times for all schedules
   */
  getNextRuns() {
    const nextRuns = {};
    
    for (const [name, schedule] of Object.entries(this.schedules)) {
      if (!schedule.enabled) {
        nextRuns[name] = 'Disabled';
        continue;
      }

      if (!schedule.lastRun) {
        nextRuns[name] = 'Never run';
        continue;
      }

      const lastRun = new Date(schedule.lastRun);
      const nextRun = new Date(lastRun.getTime() + schedule.interval);
      nextRuns[name] = nextRun.toISOString();
    }

    return nextRuns;
  }

  /**
   * Log current schedule status
   */
  logScheduleStatus() {
    console.log('📋 Current Schedule Status:');
    console.log(`   Active: ${this.isActive}`);
    console.log(`   Intervals: ${this.intervals.size}`);
    
    for (const [name, schedule] of Object.entries(this.schedules)) {
      const status = schedule.enabled ? '✅' : '❌';
      const interval = schedule.interval / (60 * 60 * 1000);
      console.log(`   ${status} ${name}: every ${interval}h - ${schedule.description}`);
    }
  }

  /**
   * Enable/disable specific schedules
   */
  toggleSchedule(scheduleName, enabled) {
    if (this.schedules[scheduleName]) {
      this.schedules[scheduleName].enabled = enabled;
      console.log(`📋 Schedule ${scheduleName} ${enabled ? 'enabled' : 'disabled'}`);
      
      if (enabled && this.isActive) {
        // Restart scheduling for this item
        if (scheduleName === 'mainPipeline') {
          this.scheduleMainPipeline();
        } else if (scheduleName === 'contracts') {
          this.scheduleContractUpdates();
        }
      }
    }
  }

  /**
   * Manual trigger with schedule override
   */
  async triggerNow(type = 'mainPipeline') {
    console.log(`🔄 Manual trigger: ${type}`);
    
    switch (type) {
      case 'mainPipeline':
        return await this.runMainPipeline();
      case 'contracts':
        return await this.runContractUpdates();
      default:
        throw new Error(`Unknown schedule type: ${type}`);
    }
  }
}

// Export singleton instance
export const scheduler = new SchedulerService();
export default scheduler;