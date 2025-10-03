// Enhanced validation with comprehensive edge case checking
exports.validateTarget = function(target) {
  const errors = [];
  const warnings = [];
  
  if (!target || typeof target !== 'object') {
    return ['Target document is not an object'];
  }
  
  // Bio validation (required)
  if (!target.bio) {
    errors.push('bio section missing');
  } else {
    // Required bio fields
    if (typeof target.bio.displayName !== 'string' || target.bio.displayName.trim() === '') {
      errors.push('bio.displayName must be non-empty string');
    }
    if (typeof target.bio.position !== 'string' || target.bio.position.trim() === '') {
      errors.push('bio.position must be non-empty string');
    }
    if (typeof target.bio.age !== 'number' || target.bio.age < 18 || target.bio.age > 50) {
      errors.push('bio.age must be number between 18-50');
    }
    
    // Optional but important bio fields
    if (target.bio.height != null && (typeof target.bio.height !== 'number' || target.bio.height < 60 || target.bio.height > 96)) {
      errors.push('bio.height must be number in inches (60-96)');
    }
    if (target.bio.weight != null && (typeof target.bio.weight !== 'number' || target.bio.weight < 150 || target.bio.weight > 350)) {
      warnings.push('bio.weight unusual value (expected 150-350 lbs)');
    }
    
    // Display fields validation
    if (target.bio.display) {
      if (target.bio.display.yearsLeft != null && (typeof target.bio.display.yearsLeft !== 'number' || target.bio.display.yearsLeft < 0)) {
        errors.push('bio.display.yearsLeft must be non-negative number');
      }
      if (target.bio.display.freeAgentYear != null) {
        const year = target.bio.display.freeAgentYear;
        const currentYear = new Date().getFullYear();
        if (typeof year !== 'number' || year < currentYear - 1 || year > currentYear + 10) {
          warnings.push('bio.display.freeAgentYear unusual (expected within +/- 10 years)');
        }
      }
    }
  }
  
  // Evaluations validation (optional but important)
  if (target.evaluations) {
    const og = target.evaluations.overallGrade;
    if (og != null && (typeof og !== 'number' || og < 0 || og > 100)) {
      errors.push('evaluations.overallGrade must be 0-100');
    }
    
    // Validate traits if present
    if (target.evaluations.traits) {
      const traitNames = ['Shooting', 'Passing', 'Playmaking', 'Defense', 'Feel', 'Rebounding', 'IQ', 'Energy'];
      traitNames.forEach(trait => {
        const value = target.evaluations.traits[trait];
        if (value != null && (typeof value !== 'number' || value < 0 || value > 100)) {
          errors.push(`evaluations.traits.${trait} must be 0-100`);
        }
      });
    }
    
    // Validate shooting profile enum
    if (target.evaluations.shootingProfile) {
      const validProfiles = ['Elite', 'Plus', 'Capable', 'Willing', 'Hesitant', 'Non'];
      if (!validProfiles.includes(target.evaluations.shootingProfile)) {
        errors.push(`evaluations.shootingProfile must be one of: ${validProfiles.join(', ')}`);
      }
    }
    
    // Validate two-way rating
    if (target.evaluations.twoWay != null && (typeof target.evaluations.twoWay !== 'number' || target.evaluations.twoWay < 0 || target.evaluations.twoWay > 100)) {
      errors.push('evaluations.twoWay must be 0-100');
    }
  }
  
  // Contracts validation
  if (target.contracts) {
    const contractIds = Object.keys(target.contracts);
    
    // Check for multiple contracts (unusual)
    if (contractIds.length > 2) {
      warnings.push(`Player has ${contractIds.length} contracts (unusual)`);
    }
    
    contractIds.forEach(contractId => {
      const contract = target.contracts[contractId];
      
      if (contract.contractValue != null && typeof contract.contractValue !== 'number') {
        errors.push(`contracts.${contractId}.contractValue must be number`);
      }
      if (contract.averageAnnualValue != null && typeof contract.averageAnnualValue !== 'number') {
        errors.push(`contracts.${contractId}.averageAnnualValue must be number`);
      }
      
      // Validate salary years array
      if (contract.salariesByYear) {
        if (!Array.isArray(contract.salariesByYear)) {
          errors.push(`contracts.${contractId}.salariesByYear must be array`);
        } else {
          contract.salariesByYear.forEach((yearData, index) => {
            if (!yearData.year || typeof yearData.year !== 'number') {
              errors.push(`contracts.${contractId}.salariesByYear[${index}].year missing or invalid`);
            }
            if (yearData.salary != null && typeof yearData.salary !== 'number') {
              errors.push(`contracts.${contractId}.salariesByYear[${index}].salary must be number`);
            }
          });
        }
      }
      
      // Validate options array
      if (contract.options && !Array.isArray(contract.options)) {
        errors.push(`contracts.${contractId}.options must be array`);
      }
    });
  }
  
  // Seasons validation
  if (target.seasons) {
    const seasonIds = Object.keys(target.seasons);
    
    if (seasonIds.length === 0) {
      warnings.push('No season data present');
    }
    
    seasonIds.forEach(seasonId => {
      const season = target.seasons[seasonId];
      
      // Validate stats if present
      if (season.stats) {
        const percentageStats = ['FG%', '3PT%', '2PT%', 'FT%', 'eFG%'];
        percentageStats.forEach(stat => {
          const value = season.stats[stat];
          if (value != null) {
            if (typeof value !== 'number') {
              errors.push(`seasons.${seasonId}.stats.${stat} must be number`);
            } else if (value < 0 || value > 1) {
              errors.push(`seasons.${seasonId}.stats.${stat} must be decimal 0-1 (not percentage)`);
            }
          }
        });
        
        // Validate counting stats
        const countingStats = ['PTS', 'AST', 'REB', 'STL', 'BLK', 'TOV', 'GP', 'GS', 'MIN'];
        countingStats.forEach(stat => {
          const value = season.stats[stat];
          if (value != null && (typeof value !== 'number' || value < 0)) {
            errors.push(`seasons.${seasonId}.stats.${stat} must be non-negative number`);
          }
        });
      }
      
      // Validate contract view
      if (season.contractView) {
        if (season.contractView.salary != null && typeof season.contractView.salary !== 'number') {
          errors.push(`seasons.${seasonId}.contractView.salary must be number`);
        }
        if (!season.contractView.contractId) {
          warnings.push(`seasons.${seasonId}.contractView.contractId missing`);
        }
      }
    });
  }
  
  // Return errors (warnings are just logged, not blocking)
  if (warnings.length > 0 && errors.length === 0) {
    // Log warnings but don't block
    console.log(`   ℹ️ Validation warnings: ${warnings.join('; ')}`);
  }
  
  return errors;
};

// Additional validation for edge cases
exports.validateEdgeCases = function(target, playerId) {
  const issues = [];
  
  // Check for rookie (no draft info)
  if (target.bio && !target.bio.draft) {
    issues.push({
      type: 'rookie',
      severity: 'info',
      message: 'No draft info - possible rookie or undrafted player'
    });
  }
  
  // Check for free agent
  if (target.bio?.display?.freeAgentYear) {
    const currentYear = new Date().getFullYear();
    if (target.bio.display.freeAgentYear <= currentYear) {
      issues.push({
        type: 'free_agent',
        severity: 'warning',
        message: `Free agent in ${target.bio.display.freeAgentYear} - verify contract data`
      });
    }
  }
  
  // Check for complex contract (options)
  if (target.contracts) {
    Object.keys(target.contracts).forEach(contractId => {
      const contract = target.contracts[contractId];
      if (contract.options && contract.options.length > 0) {
        issues.push({
          type: 'complex_contract',
          severity: 'info',
          message: `Contract has ${contract.options.length} option(s) - verify accuracy`
        });
      }
      if (contract.incentives && (contract.incentives.likely > 0 || contract.incentives.unlikely > 0)) {
        issues.push({
          type: 'incentives',
          severity: 'info',
          message: 'Contract has incentives - verify amounts'
        });
      }
    });
  }
  
  // Check for international player (non-US nationality)
  if (target.bio?.nationality && target.bio.nationality !== 'United States') {
    issues.push({
      type: 'international',
      severity: 'info',
      message: `International player (${target.bio.nationality})`
    });
  }
  
  // Check for recent trade (multiple team IDs in same season)
  if (target.seasons) {
    Object.keys(target.seasons).forEach(seasonId => {
      const season = target.seasons[seasonId];
      if (season.team && target.bio?.display?.teamId && season.team !== target.bio.display.teamId) {
        issues.push({
          type: 'traded',
          severity: 'warning',
          message: `Team mismatch: bio shows ${target.bio.display.teamId}, ${seasonId} shows ${season.team} - possible trade`
        });
      }
    });
  }
  
  return issues;
};
