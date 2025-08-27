// src/components/shared/SeasonSelector.jsx

import React, { useState, useEffect } from 'react';
import { getAllSeasons, getCurrentSeason, getSeasonDisplayName, initializeSeason } from '@/utils/seasonManagement';

const SeasonSelector = ({ 
  selectedSeason, 
  onSeasonChange, 
  showCreateOption = false,
  className = "",
  disabled = false 
}) => {
  const [seasons, setSeasons] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newSeasonYear, setNewSeasonYear] = useState(getCurrentSeason() + 1);

  useEffect(() => {
    loadSeasons();
  }, []);

  const loadSeasons = async () => {
    setIsLoading(true);
    try {
      const seasonList = await getAllSeasons();
      setSeasons(seasonList);
      
      // If no season is selected, default to current season
      if (!selectedSeason && seasonList.length > 0) {
        const currentSeason = getCurrentSeason();
        const currentSeasonData = seasonList.find(s => s.season === currentSeason);
        if (currentSeasonData && onSeasonChange) {
          onSeasonChange(currentSeason);
        } else if (seasonList.length > 0 && onSeasonChange) {
          onSeasonChange(seasonList[0].season);
        }
      }
    } catch (error) {
      console.error('Error loading seasons:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSeason = async () => {
    setIsCreating(true);
    try {
      const success = await initializeSeason(newSeasonYear, {
        start_date: `${newSeasonYear - 1}-10-01`, // October start
        end_date: `${newSeasonYear}-06-30`, // June end
        trade_deadline: `${newSeasonYear}-02-08`, // Early February
        created_by: 'user'
      });
      
      if (success) {
        await loadSeasons();
        setShowCreateForm(false);
        onSeasonChange(newSeasonYear);
        alert(`Season ${getSeasonDisplayName(newSeasonYear)} created successfully!`);
      } else {
        alert('Failed to create season. Please try again.');
      }
    } catch (error) {
      console.error('Error creating season:', error);
      alert('Error creating season: ' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`animate-pulse bg-gray-200 rounded-md h-10 w-40 ${className}`}></div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <select
        value={selectedSeason || ''}
        onChange={(e) => onSeasonChange(parseInt(e.target.value))}
        disabled={disabled || isLoading}
        className="block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      >
        <option value="">Select Season</option>
        {seasons.map((season) => (
          <option key={season.season} value={season.season}>
            {season.display_name} ({season.status})
          </option>
        ))}
      </select>
      
      {showCreateOption && (
        <div className="mt-2">
          {!showCreateForm ? (
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Create New Season
            </button>
          ) : (
            <div className="border border-gray-200 rounded-md p-3 bg-gray-50">
              <div className="mb-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Season Year
                </label>
                <input
                  type="number"
                  value={newSeasonYear}
                  onChange={(e) => setNewSeasonYear(parseInt(e.target.value))}
                  min={2020}
                  max={2040}
                  className="block w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="text-xs text-gray-500 mt-1">
                  Season: {getSeasonDisplayName(newSeasonYear)}
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateSeason}
                  disabled={isCreating}
                  className="bg-blue-600 text-white px-3 py-1 text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
                <button
                  onClick={() => setShowCreateForm(false)}
                  className="bg-gray-300 text-gray-700 px-3 py-1 text-sm rounded-md hover:bg-gray-400"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SeasonSelector;