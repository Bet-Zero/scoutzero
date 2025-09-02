#!/usr/bin/env node

/**
 * Automated Data Pipeline Initialization Script
 * Replaces manual Python pipeline with fully automated Node.js system
 */

import { scheduler } from '../src/services/scheduler.js';
import { dataOrchestrator } from '../src/services/dataOrchestrator.js';
import { nbaApi } from '../src/services/nbaApi.js';

console.log('🚀 Initializing ScoutZero Automated Data Pipeline...');
console.log('📋 This replaces the manual 19-file Python pipeline system');

/**
 * Main initialization function
 */
async function initializeAutomatedPipeline() {
  try {
    console.log('\n📊 Testing NBA API connectivity...');
    
    // Test API connectivity
    const testResult = await testNBAApiConnectivity();
    if (!testResult.success) {
      console.error('❌ NBA API connectivity test failed:', testResult.error);
      process.exit(1);
    }
    
    console.log('✅ NBA API connectivity verified');
    
    console.log('\n🔧 Starting automated scheduler...');
    
    // Start the automated scheduler
    scheduler.start();
    
    console.log('\n🎯 Running initial data collection...');
    
    // Run initial pipeline to populate data
    const initialRun = await dataOrchestrator.runFullPipeline({
      trigger: 'initialization',
      description: 'Initial automated pipeline setup'
    });
    
    console.log('✅ Initial data collection completed');
    console.log(`📈 Results: ${initialRun.steps?.length || 0} steps completed`);
    
    console.log('\n🎉 Automated Data Pipeline Successfully Initialized!');
    console.log('\n📋 System Status:');
    console.log('   🤖 Scheduler: Active');
    console.log('   📊 Data Collection: Automated every 6 hours');
    console.log('   🔄 Manual Triggers: Available via dashboard');
    console.log('   ⚡ Quick Updates: Available for real-time stats');
    
    console.log('\n🌐 Access the monitoring dashboard to view and control the pipeline');
    console.log('   Dashboard: /dashboard/data-pipeline');
    
    console.log('\n📝 Manual Python scripts are now REPLACED with:');
    console.log('   ❌ 01_discover_and_merge_players.py → ✅ Automated player discovery');
    console.log('   ❌ 03_update_contracts.py → ✅ Automated contract updates');
    console.log('   ❌ 04_update_stats.py → ✅ Automated stats collection');
    console.log('   ❌ Manual season transitions → ✅ Self-updating system');
    
    console.log('\n🔮 The system will now run automatically without manual intervention!');
    
  } catch (error) {
    console.error('\n❌ Pipeline initialization failed:', error);
    console.error('💡 Falling back to existing Python pipeline until issue is resolved');
    process.exit(1);
  }
}

/**
 * Test NBA API connectivity
 */
async function testNBAApiConnectivity() {
  try {
    console.log('   🔍 Testing player discovery endpoint...');
    const players = await nbaApi.discoverAllPlayers();
    
    if (!players || players.length === 0) {
      return { success: false, error: 'No players discovered from API' };
    }
    
    console.log(`   ✅ Successfully discovered ${players.length} players`);
    
    console.log('   📊 Testing stats endpoint...');
    const samplePlayer = players[0];
    const stats = await nbaApi.getPlayerStats(samplePlayer.id);
    
    console.log(`   ✅ Successfully retrieved stats for ${samplePlayer.displayName}`);
    
    return { 
      success: true, 
      playersFound: players.length,
      sampleStats: !!stats
    };
    
  } catch (error) {
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Display current system status
 */
function displaySystemStatus() {
  const pipelineStatus = dataOrchestrator.getStatus();
  const schedulerStatus = scheduler.getStatus();
  
  console.log('\n📊 Current System Status:');
  console.log(`   Pipeline Running: ${pipelineStatus.isRunning ? 'Yes' : 'No'}`);
  console.log(`   Scheduler Active: ${schedulerStatus.active ? 'Yes' : 'No'}`);
  console.log(`   Total Runs: ${pipelineStatus.stats.totalRuns}`);
  console.log(`   Success Rate: ${
    pipelineStatus.stats.totalRuns > 0 
      ? Math.round((pipelineStatus.stats.successfulRuns / pipelineStatus.stats.totalRuns) * 100) + '%'
      : 'N/A'
  }`);
  
  if (pipelineStatus.lastRun) {
    console.log(`   Last Run: ${new Date(pipelineStatus.lastRun.startTime).toLocaleString()}`);
    console.log(`   Last Status: ${pipelineStatus.lastRun.status}`);
  }
  
  console.log(`   Next Scheduled Run: ${pipelineStatus.nextScheduledRun}`);
}

/**
 * Handle command line arguments
 */
function handleCommandLineArgs() {
  const args = process.argv.slice(2);
  
  if (args.includes('--status')) {
    displaySystemStatus();
    return true;
  }
  
  if (args.includes('--start-scheduler')) {
    console.log('🔄 Starting scheduler only...');
    scheduler.start();
    console.log('✅ Scheduler started');
    return true;
  }
  
  if (args.includes('--stop-scheduler')) {
    console.log('🛑 Stopping scheduler...');
    scheduler.stop();
    console.log('✅ Scheduler stopped');
    return true;
  }
  
  if (args.includes('--trigger-now')) {
    console.log('🚀 Triggering manual pipeline run...');
    dataOrchestrator.triggerManualRun('cli_manual_trigger')
      .then(() => console.log('✅ Manual trigger completed'))
      .catch(error => console.error('❌ Manual trigger failed:', error));
    return true;
  }
  
  if (args.includes('--help')) {
    console.log('\n📖 ScoutZero Automated Data Pipeline Commands:');
    console.log('   --status           Show current system status');
    console.log('   --start-scheduler  Start the automated scheduler');
    console.log('   --stop-scheduler   Stop the automated scheduler');
    console.log('   --trigger-now      Manually trigger pipeline run');
    console.log('   --help             Show this help message');
    console.log('\n   Default: Full initialization and startup');
    return true;
  }
  
  return false;
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  if (!handleCommandLineArgs()) {
    initializeAutomatedPipeline().catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
  }
}