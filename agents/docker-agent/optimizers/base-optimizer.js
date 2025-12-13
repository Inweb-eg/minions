/**
 * BaseOptimizer - Abstract Base Class for Docker Optimizers
 *
 * Phase 8.4: Optimizers & Security
 * Base class for all Docker optimization mechanisms
 */

import { createLogger } from '../utils/logger.js';

/**
 * Optimization level
 */
export const OPTIMIZATION_LEVEL = {
  MINIMAL: 'minimal',       // Basic optimizations
  MODERATE: 'moderate',     // Standard optimizations
  AGGRESSIVE: 'aggressive'  // Maximum optimizations
};

/**
 * Optimization category
 */
export const OPTIMIZATION_CATEGORY = {
  SIZE: 'size',             // Reduce image size
  LAYERS: 'layers',         // Optimize layer count
  BUILD: 'build',           // Improve build performance
  SECURITY: 'security',     // Security improvements
  RUNTIME: 'runtime'        // Runtime performance
};

/**
 * BaseOptimizer
 * Abstract base class for all optimizers
 */
export class BaseOptimizer {
  constructor(name, type) {
    if (this.constructor === BaseOptimizer) {
      throw new Error('BaseOptimizer is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.optimizationHistory = [];
  }

  /**
   * Optimize (must be implemented by subclasses)
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimization result
   */
  async optimize(options = {}) {
    throw new Error('optimize() must be implemented by subclass');
  }

  /**
   * Analyze (must be implemented by subclasses)
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(options = {}) {
    throw new Error('analyze() must be implemented by subclass');
  }

  /**
   * Create optimization recommendation
   * @param {Object} recommendationData - Recommendation data
   * @returns {Object} Optimization recommendation
   */
  createRecommendation(recommendationData) {
    const {
      category = OPTIMIZATION_CATEGORY.SIZE,
      level = OPTIMIZATION_LEVEL.MODERATE,
      description,
      impact,
      effort,
      savings = null,
      implementation = null
    } = recommendationData;

    return {
      category,
      level,
      description,
      impact,
      effort,
      savings,
      implementation,
      optimizer: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Create optimization result
   * @param {Object} resultData - Result data
   * @returns {Object} Optimization result
   */
  createResult(resultData) {
    const {
      success,
      recommendations = [],
      applied = [],
      skipped = [],
      metadata = {}
    } = resultData;

    return {
      success,
      recommendations,
      applied,
      skipped,
      metadata,
      optimizer: this.name,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate potential savings
   * @param {number} before - Before value
   * @param {number} after - After value
   * @returns {Object} Savings calculation
   */
  calculateSavings(before, after) {
    const absolute = before - after;
    const percentage = before > 0 ? ((absolute / before) * 100) : 0;

    return {
      absolute,
      percentage: percentage.toFixed(2),
      before,
      after
    };
  }

  /**
   * Estimate impact
   * @param {number} savingsPercent - Savings percentage
   * @returns {string} Impact level
   */
  estimateImpact(savingsPercent) {
    if (savingsPercent >= 50) {
      return 'high';
    } else if (savingsPercent >= 20) {
      return 'medium';
    } else if (savingsPercent >= 5) {
      return 'low';
    }
    return 'minimal';
  }

  /**
   * Estimate effort
   * @param {number} complexity - Complexity score (0-100)
   * @returns {string} Effort level
   */
  estimateEffort(complexity) {
    if (complexity >= 70) {
      return 'high';
    } else if (complexity >= 40) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Record optimization in history
   * @param {Object} result - Optimization result
   */
  recordOptimization(result) {
    this.optimizationHistory.push({
      ...result,
      timestamp: new Date().toISOString()
    });

    // Keep only last 50 optimizations
    if (this.optimizationHistory.length > 50) {
      this.optimizationHistory = this.optimizationHistory.slice(-50);
    }
  }

  /**
   * Get optimization history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered history
   */
  getHistory(filter = {}) {
    let history = [...this.optimizationHistory];

    if (filter.success !== undefined) {
      history = history.filter(o => o.success === filter.success);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(o => new Date(o.timestamp) >= since);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Clear optimization history
   */
  clearHistory() {
    this.optimizationHistory = [];
    this.logger.info('Optimization history cleared');
  }

  /**
   * Get optimization statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    const total = this.optimizationHistory.length;
    const successful = this.optimizationHistory.filter(o => o.success).length;
    const failed = total - successful;

    const totalRecommendations = this.optimizationHistory.reduce(
      (sum, o) => sum + (o.recommendations?.length || 0), 0
    );

    const totalApplied = this.optimizationHistory.reduce(
      (sum, o) => sum + (o.applied?.length || 0), 0
    );

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
      totalRecommendations,
      totalApplied,
      applicationRate: totalRecommendations > 0
        ? ((totalApplied / totalRecommendations) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Prioritize recommendations
   * @param {Array} recommendations - Recommendations to prioritize
   * @returns {Array} Sorted recommendations
   */
  prioritizeRecommendations(recommendations) {
    const impactWeight = { high: 3, medium: 2, low: 1, minimal: 0 };
    const effortWeight = { low: 3, medium: 2, high: 1 };

    return recommendations.sort((a, b) => {
      const scoreA = (impactWeight[a.impact] || 0) * (effortWeight[a.effort] || 1);
      const scoreB = (impactWeight[b.impact] || 0) * (effortWeight[b.effort] || 1);
      return scoreB - scoreA;
    });
  }

  /**
   * Filter recommendations by level
   * @param {Array} recommendations - Recommendations
   * @param {string} level - Optimization level
   * @returns {Array} Filtered recommendations
   */
  filterByLevel(recommendations, level) {
    const levels = {
      minimal: ['minimal'],
      moderate: ['minimal', 'moderate'],
      aggressive: ['minimal', 'moderate', 'aggressive']
    };

    const allowedLevels = levels[level] || levels.moderate;
    return recommendations.filter(r => allowedLevels.includes(r.level));
  }

  /**
   * Generate optimization report
   * @param {Object} result - Optimization result
   * @returns {string} Formatted report
   */
  generateReport(result) {
    const lines = [];

    lines.push(`Optimization Report - ${this.name}`);
    lines.push('='.repeat(50));
    lines.push(`Status: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Timestamp: ${result.timestamp}`);
    lines.push('');

    if (result.recommendations.length > 0) {
      lines.push(`Recommendations: ${result.recommendations.length}`);
      result.recommendations.forEach((rec, index) => {
        lines.push(`  ${index + 1}. [${rec.category}] ${rec.description}`);
        lines.push(`     Impact: ${rec.impact} | Effort: ${rec.effort}`);
        if (rec.savings) {
          lines.push(`     Savings: ${rec.savings}`);
        }
      });
      lines.push('');
    }

    if (result.applied.length > 0) {
      lines.push(`Applied: ${result.applied.length}`);
      result.applied.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item}`);
      });
      lines.push('');
    }

    if (result.skipped.length > 0) {
      lines.push(`Skipped: ${result.skipped.length}`);
      result.skipped.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item}`);
      });
      lines.push('');
    }

    if (Object.keys(result.metadata).length > 0) {
      lines.push('Metadata:');
      Object.entries(result.metadata).forEach(([key, value]) => {
        lines.push(`  ${key}: ${value}`);
      });
    }

    return lines.join('\n');
  }
}
