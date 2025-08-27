// src/features/profile/GradeArchivePanel.jsx

import React, { useState, useEffect } from 'react';
import { getPlayerGradeHistory, archivePlayerGrades, compareGrades } from '@/utils/gradeArchiving';
import { getCurrentSeason, getSeasonDisplayName } from '@/utils/seasonManagement';

const GradeArchivePanel = ({ player, currentGrades }) => {
  const [gradeHistory, setGradeHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [isArchiving, setIsArchiving] = useState(false);

  // Load grade history on component mount
  useEffect(() => {
    if (player?.id) {
      loadGradeHistory();
    }
  }, [player?.id]);

  const loadGradeHistory = async () => {
    setIsLoading(true);
    try {
      const history = await getPlayerGradeHistory(player.id);
      setGradeHistory(history);
    } catch (error) {
      console.error('Error loading grade history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleArchiveGrades = async (reason = 'manual_save') => {
    setIsArchiving(true);
    try {
      const success = await archivePlayerGrades(player.id, currentGrades, null, reason);
      if (success) {
        // Reload history to show the new archive
        await loadGradeHistory();
        alert('Player grades archived successfully!');
      } else {
        alert('Failed to archive player grades. Please try again.');
      }
    } catch (error) {
      console.error('Error archiving grades:', error);
      alert('Error archiving grades: ' + error.message);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleCompareGrades = async (historyId) => {
    setIsLoading(true);
    try {
      const comparisonData = await compareGrades(player.id, historyId, 'current');
      setComparison(comparisonData);
      setSelectedHistoryItem(historyId);
    } catch (error) {
      console.error('Error comparing grades:', error);
      alert('Error comparing grades: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getGradeChangeColor = (oldGrade, newGrade) => {
    const gradeValues = { 'A+': 10, 'A': 9, 'A-': 8, 'B+': 7, 'B': 6, 'B-': 5, 'C+': 4, 'C': 3, 'C-': 2, 'D+': 1, 'D': 0 };
    const oldValue = gradeValues[oldGrade] || 0;
    const newValue = gradeValues[newGrade] || 0;
    
    if (newValue > oldValue) return 'text-green-600';
    if (newValue < oldValue) return 'text-red-600';
    return 'text-gray-600';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Grade History</h3>
        <div className="space-x-2">
          <button
            onClick={() => handleArchiveGrades('manual_save')}
            disabled={isArchiving}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isArchiving ? 'Archiving...' : 'Archive Current Grades'}
          </button>
          <button
            onClick={loadGradeHistory}
            disabled={isLoading}
            className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade History List */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Archived Grades</h4>
          {gradeHistory.length === 0 ? (
            <p className="text-gray-500 text-sm">No archived grades found. Archive current grades to start tracking changes.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {gradeHistory.map((item) => (
                <div 
                  key={item.id} 
                  className={`p-3 border rounded-md cursor-pointer transition-colors ${
                    selectedHistoryItem === item.id ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                  onClick={() => handleCompareGrades(item.id)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-sm">
                        Season {getSeasonDisplayName(item.season)} - {item.overall_grade || 'No Grade'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDate(item.archived_date)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {item.bio_snapshot?.team} | {item.reason}
                      </div>
                    </div>
                    {item.stats_snapshot && (
                      <div className="text-xs text-gray-500 text-right">
                        {item.stats_snapshot.PPG ? `${item.stats_snapshot.PPG} PPG` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comparison View */}
        <div>
          <h4 className="font-medium text-gray-700 mb-3">Comparison</h4>
          {!comparison ? (
            <p className="text-gray-500 text-sm">Select an archived grade to compare with current grades.</p>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h5 className="font-medium text-sm mb-2">Overall Grade Change</h5>
                <div className="flex items-center space-x-2">
                  <span className="text-sm">{comparison.overall_grade.from}</span>
                  <span className="text-gray-400">→</span>
                  <span className={`text-sm font-medium ${getGradeChangeColor(comparison.overall_grade.from, comparison.overall_grade.to)}`}>
                    {comparison.overall_grade.to}
                  </span>
                  {comparison.overall_grade.changed && (
                    <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">Changed</span>
                  )}
                </div>
              </div>

              {/* Trait Changes */}
              {Object.keys(comparison.changes.traits).length > 0 && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h5 className="font-medium text-sm mb-2">Trait Changes</h5>
                  <div className="space-y-1">
                    {Object.entries(comparison.changes.traits).map(([trait, change]) => (
                      <div key={trait} className="flex justify-between text-sm">
                        <span className="font-medium">{trait}:</span>
                        <span>
                          {change.from} → <span className={getGradeChangeColor(change.from, change.to)}>{change.to}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Role Changes */}
              {Object.keys(comparison.changes.roles).length > 0 && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h5 className="font-medium text-sm mb-2">Role Changes</h5>
                  <div className="space-y-1">
                    {Object.entries(comparison.changes.roles).map(([role, change]) => (
                      <div key={role} className="flex justify-between text-sm">
                        <span className="font-medium">{role}:</span>
                        <span>
                          {change.from} → <span className={getGradeChangeColor(change.from, change.to)}>{change.to}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Badge Changes */}
              {comparison.changes.badges.hasChanges && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h5 className="font-medium text-sm mb-2">Badge Changes</h5>
                  {comparison.changes.badges.added.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-green-600">Added:</span>
                      <div className="text-xs text-green-700">
                        {comparison.changes.badges.added.join(', ')}
                      </div>
                    </div>
                  )}
                  {comparison.changes.badges.removed.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-red-600">Removed:</span>
                      <div className="text-xs text-red-700">
                        {comparison.changes.badges.removed.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GradeArchivePanel;