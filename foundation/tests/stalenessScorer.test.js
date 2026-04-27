import { jest } from '@jest/globals';
import {
  ageDays,
  freshnessFactor,
  stalenessWarning,
  applyFreshnessScoring,
  formatAge
} from '../knowledge-brain/StalenessScorer.js';

const MS_PER_DAY = 86_400_000;

describe('StalenessScorer', () => {
  describe('ageDays', () => {
    it('should return 0 for current timestamp', () => {
      expect(ageDays(Date.now())).toBe(0);
    });

    it('should return 1 for yesterday', () => {
      expect(ageDays(Date.now() - MS_PER_DAY)).toBe(1);
    });

    it('should return 7 for a week ago', () => {
      expect(ageDays(Date.now() - 7 * MS_PER_DAY)).toBe(7);
    });

    it('should floor-round (not ceiling)', () => {
      // 1.5 days ago should return 1
      expect(ageDays(Date.now() - 1.5 * MS_PER_DAY)).toBe(1);
    });

    it('should clamp negative to 0 (future timestamps)', () => {
      expect(ageDays(Date.now() + MS_PER_DAY)).toBe(0);
    });
  });

  describe('freshnessFactor', () => {
    it('should return 1.0 for today', () => {
      expect(freshnessFactor(Date.now())).toBe(1.0);
    });

    it('should return 1.0 for items within threshold', () => {
      expect(freshnessFactor(Date.now() - MS_PER_DAY)).toBe(1.0); // 1 day = still fresh
    });

    it('should decay for items beyond threshold', () => {
      const factor = freshnessFactor(Date.now() - 2 * MS_PER_DAY);
      expect(factor).toBeGreaterThan(0);
      expect(factor).toBeLessThan(1.0);
    });

    it('should decay more for older items', () => {
      const factor2d = freshnessFactor(Date.now() - 2 * MS_PER_DAY);
      const factor30d = freshnessFactor(Date.now() - 30 * MS_PER_DAY);
      expect(factor2d).toBeGreaterThan(factor30d);
    });

    it('should use logarithmic decay (not linear)', () => {
      // 2 days: 1/(1+log2(2)) = 1/(1+1) = 0.5
      const factor = freshnessFactor(Date.now() - 2 * MS_PER_DAY);
      expect(factor).toBeCloseTo(0.5, 1);
    });

    it('should support custom threshold', () => {
      // 3 days old but threshold is 7 = still fresh
      expect(freshnessFactor(Date.now() - 3 * MS_PER_DAY, 7)).toBe(1.0);
    });
  });

  describe('stalenessWarning', () => {
    it('should return empty for fresh items', () => {
      expect(stalenessWarning(Date.now())).toBe('');
      expect(stalenessWarning(Date.now() - MS_PER_DAY)).toBe('');
    });

    it('should return warning for stale items', () => {
      const warning = stalenessWarning(Date.now() - 5 * MS_PER_DAY);
      expect(warning).toContain('STALE');
      expect(warning).toContain('5 days old');
      expect(warning).toContain('Verify');
    });

    it('should include age in days', () => {
      const warning = stalenessWarning(Date.now() - 30 * MS_PER_DAY);
      expect(warning).toContain('30 days old');
    });
  });

  describe('applyFreshnessScoring', () => {
    it('should sort by freshness-weighted score', () => {
      const oldItem = {
        id: 'old', content: 'old fix',
        similarity: 0.9, createdAt: Date.now() - 30 * MS_PER_DAY,
        lastAccessed: Date.now() - 30 * MS_PER_DAY
      };
      const newItem = {
        id: 'new', content: 'new fix',
        similarity: 0.8, createdAt: Date.now() - 0.5 * MS_PER_DAY,
        lastAccessed: Date.now() - 0.5 * MS_PER_DAY
      };

      const results = applyFreshnessScoring([oldItem, newItem]);

      // New item should rank higher despite lower similarity
      expect(results[0].id).toBe('new');
      expect(results[1].id).toBe('old');
    });

    it('should add freshness metadata to results', () => {
      const item = {
        id: 'test', similarity: 0.5,
        createdAt: Date.now() - 5 * MS_PER_DAY,
        lastAccessed: Date.now() - 5 * MS_PER_DAY
      };

      const [result] = applyFreshnessScoring([item]);
      expect(result._freshness).toBeLessThan(1.0);
      expect(result._ageDays).toBe(5);
      expect(result._weightedScore).toBeDefined();
      expect(result._stalenessWarning).toContain('STALE');
    });

    it('should not add warnings for fresh items', () => {
      const item = {
        id: 'fresh', similarity: 0.9,
        createdAt: Date.now(), lastAccessed: Date.now()
      };

      const [result] = applyFreshnessScoring([item]);
      expect(result._stalenessWarning).toBe('');
      expect(result._freshness).toBe(1.0);
    });

    it('should filter by minimum freshness', () => {
      const old = {
        id: 'ancient', similarity: 0.9,
        createdAt: Date.now() - 365 * MS_PER_DAY,
        lastAccessed: Date.now() - 365 * MS_PER_DAY
      };
      const fresh = {
        id: 'new', similarity: 0.5,
        createdAt: Date.now(), lastAccessed: Date.now()
      };

      const results = applyFreshnessScoring([old, fresh], { minFreshness: 0.2 });
      // Ancient item's freshness is ~0.1 (1/(1+log2(365))), below 0.2 threshold
      expect(results.some(r => r.id === 'ancient')).toBe(false);
      expect(results.some(r => r.id === 'new')).toBe(true);
    });

    it('should prefer lastAccessed over createdAt', () => {
      const item = {
        id: 'test', similarity: 0.5,
        createdAt: Date.now() - 30 * MS_PER_DAY,
        lastAccessed: Date.now() // Recently accessed
      };

      const [result] = applyFreshnessScoring([item]);
      expect(result._freshness).toBe(1.0); // Fresh because lastAccessed is today
    });
  });

  describe('formatAge', () => {
    it('should format today', () => {
      expect(formatAge(0)).toBe('today');
    });

    it('should format yesterday', () => {
      expect(formatAge(1)).toBe('yesterday');
    });

    it('should format days', () => {
      expect(formatAge(5)).toBe('5 days ago');
    });

    it('should format weeks', () => {
      expect(formatAge(14)).toBe('2 weeks ago');
    });

    it('should format months', () => {
      expect(formatAge(60)).toBe('2 months ago');
    });

    it('should format years', () => {
      expect(formatAge(400)).toBe('1 years ago');
    });
  });
});
