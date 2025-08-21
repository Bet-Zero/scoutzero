import { useState, useEffect, useCallback, useMemo } from 'react';
import debounce from 'lodash.debounce';
import { validateTrade } from '@/utils/architect/tradeMachine/engine/tradeValidator';

/**
 * Hook for real-time trade validation with debouncing
 * 
 * @param {Array} teams - Array of team objects with trade data
 * @param {Object} capProjections - Cap projections data
 * @param {number} currentYear - Current year for validation
 * @param {boolean} forceTrade - Whether to force trade through even if invalid
 * @returns {Object} Validation state and normalized results
 */
export function useRealtimeValidation(teams, capProjections, currentYear, forceTrade = false) {
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);

  // Create debounced validation function
  const debouncedValidate = useCallback(
    debounce(async (teamsData, capData, year) => {
      setIsValidating(true);
      try {
        // Filter teams that have actual team data
        const validTeams = teamsData.filter(t => t.team);
        
        if (validTeams.length === 0) {
          setValidationResult(null);
          return;
        }

        // For single team, create a minimal valid result
        if (validTeams.length === 1) {
          setValidationResult({
            legal: true,
            teamResults: [{
              teamId: validTeams[0].team.id,
              teamName: validTeams[0].team.name || validTeams[0].team.nickname,
              legal: true,
              violations: [],
              warnings: [],
            }],
            reason: 'Single team selected',
            performance: { validationTime: 0 },
          });
          return;
        }

        // Prepare team data for validation
        const formattedTeams = validTeams.map((t) => ({
          teamId: t.team.id, // Add explicit teamId
          team: t.team,
          sends: t.sends || [],
          picksOut: t.picksOut || [],
          hardCapped: t.team.hardCapped || false,
        }));

        console.log('🔍 About to validate with teams:', formattedTeams.map(t => ({ 
          teamId: t.teamId, 
          teamName: t.team.name || t.team.nickname,
          teamProps: Object.keys(t.team)
        })));

        const validation = validateTrade({
          teams: formattedTeams,
          capProjections: capData,
          currentYear: year,
        });

        console.log('✅ Validation returned:', {
          legal: validation.legal,
          teamResultsCount: validation.teamResults?.length,
          teamIds: validation.teamResults?.map(tr => tr.teamId)
        });

        setValidationResult(validation);
      } catch (error) {
        console.error('Validation error:', error);
        setValidationResult({
          legal: false,
          teamResults: [],
          reason: 'Validation error occurred',
          performance: { validationTime: 0 },
        });
      } finally {
        setIsValidating(false);
      }
    }, 500), // 500ms debounce
    []
  );

  // Trigger validation when teams data changes
  useEffect(() => {
    if (teams && capProjections && currentYear) {
      debouncedValidate(teams, capProjections, currentYear);
    }
    
    // Cleanup on unmount
    return () => {
      debouncedValidate.cancel();
    };
  }, [teams, capProjections, currentYear, debouncedValidate]);

  // Normalize validation result to match expected format
  const normalizedResult = useMemo(() => {
    if (!validationResult) {
      return {
        passed: true,
        warnings: [],
        violations: [],
        perTeam: {},
        details: null,
        overallLegal: true,
      };
    }

    const perTeam = {};
    const allWarnings = [];
    const allViolations = [];

    (validationResult.teamResults || []).forEach((teamResult) => {
      const teamId = teamResult.teamId;
      if (!teamId) return;

      const teamWarnings = teamResult.warnings || [];
      const teamViolations = teamResult.violations || [];
      
      perTeam[teamId] = {
        passed: teamResult.legal === true,
        warnings: teamWarnings,
        violations: teamViolations,
        teamName: teamResult.teamName || teamResult.team?.name,
      };

      allWarnings.push(...teamWarnings);
      allViolations.push(...teamViolations);
    });

    const passed = forceTrade ? true : (validationResult.legal === true && allViolations.length === 0);

    return {
      passed,
      warnings: allWarnings,
      violations: allViolations,
      perTeam,
      details: validationResult,
      overallLegal: validationResult.legal === true,
      isValidating,
    };
  }, [validationResult, forceTrade, isValidating]);

  // Get status for a specific team
  const getTeamStatus = useCallback((teamId) => {
    const hasTeamData = normalizedResult.perTeam[teamId];
    console.log(`🎯 getTeamStatus(${teamId}): ${hasTeamData ? 'FOUND' : 'NOT FOUND'} - perTeam keys: [${Object.keys(normalizedResult.perTeam).join(', ')}]`);
    
    if (!teamId || !normalizedResult.perTeam[teamId]) {
      return { status: 'unknown', icon: '❓', color: 'text-gray-400' };
    }

    const team = normalizedResult.perTeam[teamId];
    
    if (team.passed) {
      return { status: 'legal', icon: '✅', color: 'text-green-400' };
    } else if (team.warnings.length > 0 && team.violations.length === 0) {
      return { status: 'warning', icon: '⚠️', color: 'text-yellow-400' };
    } else {
      return { status: 'illegal', icon: '❌', color: 'text-red-400' };
    }
  }, [normalizedResult]);

  return {
    validationResult: normalizedResult,
    isValidating,
    getTeamStatus,
  };
}