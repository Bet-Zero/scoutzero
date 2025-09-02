/**
 * Automated Data Pipeline Dashboard
 * Monitors and controls the automated NBA data collection system
 */

import React, { useState, useEffect } from 'react';
import { dataOrchestrator } from '@/services/dataOrchestrator';
import { scheduler } from '@/services/scheduler';

export default function DataPipelineDashboard() {
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [schedulerStatus, setSchedulerStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [manualTrigger, setManualTrigger] = useState(false);

  useEffect(() => {
    loadStatus();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStatus = async () => {
    try {
      const [pipeline, schedule] = await Promise.all([
        dataOrchestrator.getStatus(),
        scheduler.getStatus()
      ]);
      
      setPipelineStatus(pipeline);
      setSchedulerStatus(schedule);
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load status:', error);
      setIsLoading(false);
    }
  };

  const triggerManualUpdate = async (type = 'full') => {
    setManualTrigger(true);
    try {
      if (type === 'full') {
        await dataOrchestrator.triggerManualRun('dashboard_manual_trigger');
      } else {
        await scheduler.triggerNow('mainPipeline');
      }
      
      // Refresh status after trigger
      setTimeout(loadStatus, 2000);
    } catch (error) {
      console.error('Manual trigger failed:', error);
    } finally {
      setManualTrigger(false);
    }
  };

  const toggleScheduler = () => {
    if (schedulerStatus?.active) {
      scheduler.stop();
    } else {
      scheduler.start();
    }
    setTimeout(loadStatus, 1000);
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          🤖 Automated Data Pipeline
        </h2>
        <p className="text-gray-600">
          Real-time monitoring and control of the automated NBA data collection system
        </p>
      </div>

      {/* Pipeline Status */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center">
          <span className={`w-3 h-3 rounded-full mr-3 ${
            pipelineStatus?.isRunning ? 'bg-blue-500 animate-pulse' : 
            pipelineStatus?.lastRun?.status === 'success' ? 'bg-green-500' : 'bg-gray-400'
          }`}></span>
          Pipeline Status
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Status</div>
            <div className="text-lg font-semibold">
              {pipelineStatus?.isRunning ? (
                <span className="text-blue-600">🔄 Running</span>
              ) : (
                <span className="text-green-600">✅ Ready</span>
              )}
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Total Runs</div>
            <div className="text-lg font-semibold">{pipelineStatus?.stats?.totalRuns || 0}</div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm text-gray-600">Success Rate</div>
            <div className="text-lg font-semibold">
              {pipelineStatus?.stats?.totalRuns > 0 ? (
                Math.round((pipelineStatus.stats.successfulRuns / pipelineStatus.stats.totalRuns) * 100) + '%'
              ) : 'N/A'}
            </div>
          </div>
        </div>

        {pipelineStatus?.lastRun && (
          <div className="border-t pt-4">
            <h4 className="font-medium mb-2">Last Run Details</h4>
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div className="grid grid-cols-2 gap-2">
                <span>Started:</span> 
                <span>{new Date(pipelineStatus.lastRun.startTime).toLocaleString()}</span>
                
                <span>Status:</span> 
                <span className={pipelineStatus.lastRun.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                  {pipelineStatus.lastRun.status}
                </span>
                
                {pipelineStatus.lastRun.duration && (
                  <>
                    <span>Duration:</span>
                    <span>{Math.round(pipelineStatus.lastRun.duration / 1000)}s</span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Scheduler Status */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4 flex items-center justify-between">
          <span className="flex items-center">
            <span className={`w-3 h-3 rounded-full mr-3 ${
              schedulerStatus?.active ? 'bg-green-500' : 'bg-red-500'
            }`}></span>
            Automated Scheduler
          </span>
          
          <button
            onClick={toggleScheduler}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              schedulerStatus?.active 
                ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {schedulerStatus?.active ? 'Stop' : 'Start'} Scheduler
          </button>
        </h3>

        <div className="space-y-3">
          {schedulerStatus?.schedules && Object.entries(schedulerStatus.schedules).map(([name, schedule]) => (
            <div key={name} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
              <div>
                <div className="font-medium">{name}</div>
                <div className="text-sm text-gray-600">{schedule.description}</div>
              </div>
              <div className="text-right">
                <div className={`text-sm ${schedule.enabled ? 'text-green-600' : 'text-gray-400'}`}>
                  {schedule.enabled ? '✅ Enabled' : '❌ Disabled'}
                </div>
                <div className="text-xs text-gray-500">
                  Every {schedule.interval / (60 * 60 * 1000)}h
                </div>
              </div>
            </div>
          ))}
        </div>

        {schedulerStatus?.nextRuns && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Next Scheduled Runs</h4>
            <div className="text-sm text-blue-800 space-y-1">
              {Object.entries(schedulerStatus.nextRuns).map(([name, time]) => (
                <div key={name}>
                  <strong>{name}:</strong> {
                    time === 'Disabled' || time === 'Never run' ? time : 
                    new Date(time).toLocaleString()
                  }
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual Controls */}
      <div className="bg-white p-6 rounded-lg border shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Manual Controls</h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Full Data Pipeline</div>
              <div className="text-sm text-gray-600">
                Complete player discovery, stats, and roster updates
              </div>
            </div>
            <button
              onClick={() => triggerManualUpdate('full')}
              disabled={manualTrigger || pipelineStatus?.isRunning}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {manualTrigger ? 'Triggering...' : 'Run Now'}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Quick Stats Update</div>
              <div className="text-sm text-gray-600">
                Lightweight stats refresh only
              </div>
            </div>
            <button
              onClick={() => triggerManualUpdate('stats')}
              disabled={manualTrigger || pipelineStatus?.isRunning}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              Update Stats
            </button>
          </div>
        </div>

        {pipelineStatus?.isRunning && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-yellow-800">
              ⏳ Pipeline is currently running. Manual triggers are disabled until completion.
            </div>
          </div>
        )}
      </div>

      {/* Recent Errors */}
      {pipelineStatus?.stats?.errors?.length > 0 && (
        <div className="bg-red-50 p-6 rounded-lg border border-red-200">
          <h3 className="text-lg font-semibold text-red-900 mb-4">Recent Errors</h3>
          <div className="space-y-2">
            {pipelineStatus.stats.errors.slice(-3).map((error, index) => (
              <div key={index} className="text-sm text-red-800 bg-red-100 p-2 rounded">
                <div className="font-medium">{error.timestamp}</div>
                <div>{error.error}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* System Info */}
      <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <strong>System:</strong> Automated NBA Data Pipeline v2.0
          </div>
          <div>
            <strong>Replaces:</strong> Manual Python scripts (19 files)
          </div>
          <div>
            <strong>Data Sources:</strong> NBA Stats API, Official NBA Data
          </div>
          <div>
            <strong>Update Frequency:</strong> Every 6 hours (configurable)
          </div>
        </div>
      </div>
    </div>
  );
}