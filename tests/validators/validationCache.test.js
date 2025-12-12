import { describe, it, expect, beforeEach } from 'vitest';
import { validationCache } from '@/features/architect/utils/tradeMachine/cache/validationCache';

describe('Validation Cache', () => {
  beforeEach(() => {
    validationCache.clear();
  });

  describe('Salary Matching Cache', () => {
    it('should cache and retrieve salary matching results', () => {
      const mockTeam = {
        teamId: 'team1',
        salaryIn: 1000000,
        salaryOut: 900000,
      };
      const yearKey = '2025';
      const mockResult = { passed: true, violations: [] };

      validationCache.cacheSalaryMatch(mockTeam, yearKey, mockResult);
      const cached = validationCache.getCachedSalaryMatch(mockTeam, yearKey);

      expect(cached).toEqual(mockResult);
    });
  });

  describe('Apron Status Cache', () => {
    it('should cache and retrieve apron status', () => {
      const teamSalary = 150000000;
      const capSettings = { firstApron: 165000000, secondApron: 170000000 };
      const status = 'below';

      validationCache.cacheApronStatus(teamSalary, capSettings, status);
      const cached = validationCache.getCachedApronStatus(
        teamSalary,
        capSettings
      );

      expect(cached).toEqual(status);
    });
  });

  describe('TPE Validation Cache', () => {
    it('should cache and retrieve TPE validation results', () => {
      const tpe = { id: 'tpe1', remaining: 1000000 };
      const yearKey = '2025';
      const mockResult = { passed: true, violations: [] };

      validationCache.cacheTPEValidation(tpe, yearKey, mockResult);
      const cached = validationCache.getCachedTPEValidation(tpe, yearKey);

      expect(cached).toEqual(mockResult);
    });
  });

  describe('Hard Cap Status Cache', () => {
    it('should cache and retrieve hard cap status', () => {
      const team = { teamId: 'team1', hardCapped: true };
      const projectedSalary = 175000000;
      const mockResult = { passed: false, violations: ['Hard cap exceeded'] };

      validationCache.cacheHardCapStatus(team, projectedSalary, mockResult);
      const cached = validationCache.getCachedHardCapStatus(
        team,
        projectedSalary
      );

      expect(cached).toEqual(mockResult);
    });
  });

  describe('Cache Invalidation', () => {
    it('should clear all caches', () => {
      const mockTeam = {
        teamId: 'team1',
        salaryIn: 1000000,
        salaryOut: 900000,
      };
      const mockResult = { passed: true, violations: [] };

      validationCache.cacheSalaryMatch(mockTeam, '2025', mockResult);
      validationCache.cacheApronStatus(
        150000000,
        { firstApron: 165000000, secondApron: 170000000 },
        'below'
      );
      validationCache.cacheTPEValidation(
        { id: 'tpe1', remaining: 1000000 },
        '2025',
        mockResult
      );
      validationCache.cacheHardCapStatus(
        { teamId: 'team1', hardCapped: true },
        175000000,
        mockResult
      );

      validationCache.clear();

      expect(
        validationCache.getCachedSalaryMatch(mockTeam, '2025')
      ).toBeUndefined();
      expect(
        validationCache.getCachedApronStatus(150000000, {
          firstApron: 165000000,
          secondApron: 170000000,
        })
      ).toBeUndefined();
      expect(
        validationCache.getCachedTPEValidation(
          { id: 'tpe1', remaining: 1000000 },
          '2025'
        )
      ).toBeUndefined();
      expect(
        validationCache.getCachedHardCapStatus(
          { teamId: 'team1', hardCapped: true },
          175000000
        )
      ).toBeUndefined();
    });
  });
});
