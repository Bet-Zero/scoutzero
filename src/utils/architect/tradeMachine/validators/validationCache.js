/**
 * Cache system for expensive trade validation calculations
 */

class ValidationCache {
  constructor() {
    this.clear();
  }

  clear() {
    this._cache = {
      salaryMatching: new Map(),
      apronStatus: new Map(),
      tpeValidations: new Map(),
      hardCapStatus: new Map(),
      rosterValidations: new Map(),
      stepienValidations: new Map(),
      cashValidations: new Map(),
    };
  }

  // Salary matching cache
  getCachedSalaryMatch(team, yearKey) {
    const key = this._getSalaryMatchKey(team, yearKey);
    return this._cache.salaryMatching.get(key);
  }

  cacheSalaryMatch(team, yearKey, result) {
    const key = this._getSalaryMatchKey(team, yearKey);
    this._cache.salaryMatching.set(key, result);
  }

  // Apron status cache
  getCachedApronStatus(teamSalary, capSettings) {
    const key = `${teamSalary}-${capSettings.firstApron}-${capSettings.secondApron}`;
    return this._cache.apronStatus.get(key);
  }

  cacheApronStatus(teamSalary, capSettings, status) {
    const key = `${teamSalary}-${capSettings.firstApron}-${capSettings.secondApron}`;
    this._cache.apronStatus.set(key, status);
  }

  // TPE validation cache
  getCachedTPEValidation(tpe, yearKey) {
    const key = this._getTPEValidationKey(tpe, yearKey);
    return this._cache.tpeValidations.get(key);
  }

  cacheTPEValidation(tpe, yearKey, result) {
    const key = this._getTPEValidationKey(tpe, yearKey);
    this._cache.tpeValidations.set(key, result);
  }

  // Hard cap status cache
  getCachedHardCapStatus(team, projectedSalary) {
    const key = this._getHardCapKey(team, projectedSalary);
    return this._cache.hardCapStatus.get(key);
  }

  cacheHardCapStatus(team, projectedSalary, result) {
    const key = this._getHardCapKey(team, projectedSalary);
    this._cache.hardCapStatus.set(key, result);
  }

  // Roster validation cache
  getCachedRosterValidation(cacheKey) {
    return this._cache.rosterValidations.get(cacheKey);
  }

  cacheRosterValidation(cacheKey, result) {
    this._cache.rosterValidations.set(cacheKey, result);
  }

  // Stepien validation cache
  getCachedStepienValidation(cacheKey) {
    return this._cache.stepienValidations.get(cacheKey);
  }

  cacheStepienValidation(cacheKey, result) {
    this._cache.stepienValidations.set(cacheKey, result);
  }

  // Cash validation cache
  getCachedCashValidation(cacheKey) {
    return this._cache.cashValidations?.get(cacheKey);
  }

  cacheCashValidation(cacheKey, result) {
    if (!this._cache.cashValidations) {
      this._cache.cashValidations = new Map();
    }
    this._cache.cashValidations.set(cacheKey, result);
  }

  // Private key generation methods
  _getSalaryMatchKey(team, yearKey) {
    return `${team.teamId}-${team.salaryIn}-${team.salaryOut}-${yearKey}`;
  }

  _getHardCapKey(team, projectedSalary) {
    return `${team.teamId}-${projectedSalary}-${team.hardCapped}`;
  }

  _getTPEValidationKey(tpe, yearKey) {
    return `${tpe.id}-${yearKey}-${tpe.expiryISO || ''}-${tpe.remaining || tpe.amount || 0}`;
  }
}

// Export singleton instance
export const validationCache = new ValidationCache();
