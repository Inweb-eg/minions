/**
 * StalenessScorer
 * ----------------
 * Adds age-aware scoring and staleness warnings to knowledge recall.
 * Inspired by Claude Code's memoryAge.ts pattern.
 *
 * Designed as a wrapper/augmentation for KnowledgeBrain - does not modify the
 * original class. Instead, call scoredRecall() which wraps recall() with
 * freshness weighting and staleness warnings.
 *
 * Algorithm:
 * - Age in days = floor(elapsed_ms / 86_400_000)
 * - Freshness factor decays: 1.0 for <=1 day, then 1/(1 + log2(ageDays))
 * - Final score = relevanceScore * freshnessFactor
 * - Staleness warning injected for items >1 day old
 */

import { createLogger } from '../common/logger.js';

const logger = createLogger('StalenessScorer');

const MS_PER_DAY = 86_400_000;
const FRESH_THRESHOLD_DAYS = 1;

/**
 * Calculate age in days (floor-rounded, clamped to 0)
 * @param {number} timestampMs - Creation or last-modified time
 * @returns {number} Days elapsed (0 = today)
 */
export function ageDays(timestampMs) {
  return Math.max(0, Math.floor((Date.now() - timestampMs) / MS_PER_DAY));
}

/**
 * Calculate freshness factor (1.0 = fresh, decays toward 0)
 * Uses logarithmic decay: 1 / (1 + log2(ageDays))
 * - 0 days → 1.0
 * - 1 day  → 1.0 (within fresh threshold)
 * - 2 days → 0.5
 * - 4 days → 0.33
 * - 8 days → 0.25
 * - 30 days → 0.17
 *
 * @param {number} timestampMs
 * @param {number} freshThresholdDays - Days considered "fresh" (default 1)
 * @returns {number} Factor between 0 and 1
 */
export function freshnessFactor(timestampMs, freshThresholdDays = FRESH_THRESHOLD_DAYS) {
  const age = ageDays(timestampMs);
  if (age <= freshThresholdDays) return 1.0;
  return 1.0 / (1.0 + Math.log2(age));
}

/**
 * Generate a staleness warning for a knowledge item
 * Returns empty string for fresh items (<=threshold days)
 *
 * @param {number} timestampMs - createdAt or lastAccessed
 * @param {number} freshThresholdDays
 * @returns {string} Warning text or empty string
 */
export function stalenessWarning(timestampMs, freshThresholdDays = FRESH_THRESHOLD_DAYS) {
  const age = ageDays(timestampMs);
  if (age <= freshThresholdDays) return '';

  return `[STALE: ${age} days old] This knowledge is a point-in-time observation. ` +
    `Claims about code behavior or file locations may be outdated. ` +
    `Verify against current state before acting on it.`;
}

/**
 * Apply freshness scoring to knowledge recall results
 * Wraps KnowledgeBrain.recall() results with age-weighted scoring.
 *
 * @param {Array} results - Results from KnowledgeBrain.recall()
 * @param {object} options - { freshThresholdDays, minFreshness }
 * @returns {Array} Results re-sorted by freshness-weighted score, with warnings
 */
export function applyFreshnessScoring(results, options = {}) {
  const {
    freshThresholdDays = FRESH_THRESHOLD_DAYS,
    minFreshness = 0.0  // Set >0 to filter out very old items
  } = options;

  return results
    .map(item => {
      // Use lastAccessed if available, fall back to createdAt
      const timestamp = item.lastAccessed || item.createdAt || Date.now();
      const freshness = freshnessFactor(timestamp, freshThresholdDays);
      const relevance = item.similarity || (item.usefulness * 10 + item.accessCount) / 100 || 0.5;

      // Weighted score: relevance * freshness
      const weightedScore = relevance * freshness;

      // Staleness warning
      const warning = stalenessWarning(timestamp, freshThresholdDays);

      return {
        ...item,
        _freshness: freshness,
        _ageDays: ageDays(timestamp),
        _weightedScore: weightedScore,
        _stalenessWarning: warning
      };
    })
    .filter(item => item._freshness >= minFreshness)
    .sort((a, b) => b._weightedScore - a._weightedScore);
}

/**
 * Create a staleness-aware recall wrapper for a KnowledgeBrain instance
 *
 * Usage:
 *   const brain = getKnowledgeBrain();
 *   const scoredRecall = createScoredRecall(brain);
 *   const results = await scoredRecall('how to fix auth bug');
 *
 * @param {object} knowledgeBrain - KnowledgeBrain instance
 * @param {object} options - { freshThresholdDays, minFreshness }
 * @returns {Function} async (query) => results with freshness scoring
 */
export function createScoredRecall(knowledgeBrain, options = {}) {
  return async function scoredRecall(query) {
    const rawResults = await knowledgeBrain.recall(query);
    return applyFreshnessScoring(rawResults, options);
  };
}

/**
 * Utility: format age for display
 * @param {number} days
 * @returns {string}
 */
export function formatAge(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

export default {
  ageDays,
  freshnessFactor,
  stalenessWarning,
  applyFreshnessScoring,
  createScoredRecall,
  formatAge
};
