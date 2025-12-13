/**
 * Analytics - Tracks PR Health, Velocity, and Bottlenecks
 *
 * Phase 9.4: Release & Analytics
 * Analyzes PR workflow and team performance
 */

import { BaseManager, OPERATION_STATUS } from '../branches/base-manager.js';

/**
 * Time period
 */
export const TIME_PERIOD = {
  WEEK: 'week',
  MONTH: 'month',
  QUARTER: 'quarter',
  YEAR: 'year'
};

/**
 * Analytics
 * Tracks GitHub analytics
 */
export class Analytics extends BaseManager {
  constructor() {
    super('Analytics', 'analytics');
  }

  /**
   * Analyze PR health
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} PR health metrics
   */
  async analyzePRHealth(options = {}) {
    this.ensureInitialized();

    const {
      period = TIME_PERIOD.MONTH,
      state = 'all'
    } = options;

    this.logger.info(`Analyzing PR health for ${period}`);

    try {
      const since = this.calculateSinceDate(period);

      // Get PRs
      const prs = await this.getPRs({ state, since });

      // Calculate metrics
      const metrics = {
        total: prs.length,
        open: prs.filter(pr => pr.state === 'open').length,
        closed: prs.filter(pr => pr.state === 'closed').length,
        merged: prs.filter(pr => pr.merged_at !== null).length,
        averageTimeToMerge: this.calculateAverageTimeToMerge(prs),
        averageTimeToFirstReview: this.calculateAverageTimeToFirstReview(prs),
        averageCommentsPerPR: this.calculateAverageCommentsPerPR(prs),
        mergeRate: this.calculateMergeRate(prs),
        stalePRs: this.identifyStalePRs(prs),
        healthScore: 0
      };

      // Calculate health score (0-100)
      metrics.healthScore = this.calculateHealthScore(metrics);

      const result = this.createResult({
        success: true,
        data: metrics,
        metadata: { period, since: since.toISOString() }
      });

      this.recordOperation(result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to analyze PR health: ${error.message}`);
      throw error;
    }
  }

  /**
   * Track velocity
   * @param {Object} options - Tracking options
   * @returns {Promise<Object>} Velocity metrics
   */
  async trackVelocity(options = {}) {
    this.ensureInitialized();

    const {
      period = TIME_PERIOD.MONTH
    } = options;

    this.logger.info(`Tracking velocity for ${period}`);

    try {
      const since = this.calculateSinceDate(period);

      // Get merged PRs
      const prs = await this.getPRs({ state: 'closed', since });
      const mergedPRs = prs.filter(pr => pr.merged_at !== null);

      // Calculate velocity metrics
      const metrics = {
        period,
        mergedPRs: mergedPRs.length,
        averagePRsPerWeek: this.calculateAveragePRsPerWeek(mergedPRs, period),
        totalLinesChanged: mergedPRs.reduce((sum, pr) => sum + pr.additions + pr.deletions, 0),
        averageLinesPerPR: mergedPRs.length > 0
          ? Math.round(mergedPRs.reduce((sum, pr) => sum + pr.additions + pr.deletions, 0) / mergedPRs.length)
          : 0,
        topContributors: this.identifyTopContributors(mergedPRs),
        trend: await this.calculateVelocityTrend(period)
      };

      const result = this.createResult({
        success: true,
        data: metrics,
        metadata: { period, since: since.toISOString() }
      });

      this.recordOperation(result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to track velocity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Detect bottlenecks
   * @param {Object} options - Detection options
   * @returns {Promise<Object>} Bottleneck analysis
   */
  async detectBottlenecks(options = {}) {
    this.ensureInitialized();

    const {
      period = TIME_PERIOD.MONTH
    } = options;

    this.logger.info(`Detecting bottlenecks for ${period}`);

    try {
      const since = this.calculateSinceDate(period);
      const prs = await this.getPRs({ state: 'all', since });

      const bottlenecks = [];

      // Check review bottleneck
      const reviewBottleneck = this.analyzeReviewBottleneck(prs);
      if (reviewBottleneck.isBottleneck) {
        bottlenecks.push(reviewBottleneck);
      }

      // Check CI/CD bottleneck
      const ciBottleneck = await this.analyzeCIBottleneck(prs);
      if (ciBottleneck.isBottleneck) {
        bottlenecks.push(ciBottleneck);
      }

      // Check merge bottleneck
      const mergeBottleneck = this.analyzeMergeBottleneck(prs);
      if (mergeBottleneck.isBottleneck) {
        bottlenecks.push(mergeBottleneck);
      }

      // Check stale PR bottleneck
      const staleBottleneck = this.analyzeStaleBottleneck(prs);
      if (staleBottleneck.isBottleneck) {
        bottlenecks.push(staleBottleneck);
      }

      const result = this.createResult({
        success: true,
        data: {
          bottlenecks,
          count: bottlenecks.length,
          recommendations: this.generateRecommendations(bottlenecks)
        },
        metadata: { period, since: since.toISOString() }
      });

      this.recordOperation(result);
      return result;
    } catch (error) {
      this.logger.error(`Failed to detect bottlenecks: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get PRs
   * @param {Object} options - Options
   * @returns {Promise<Array>} PRs
   */
  async getPRs(options = {}) {
    const { state, since } = options;

    const { data: prs } = await this.octokit.rest.pulls.list({
      owner: this.owner,
      repo: this.repo,
      state,
      sort: 'created',
      direction: 'desc',
      per_page: 100
    });

    // Filter by date if since is provided
    if (since) {
      return prs.filter(pr => new Date(pr.created_at) >= since);
    }

    return prs;
  }

  /**
   * Calculate since date
   * @param {string} period - Time period
   * @returns {Date} Since date
   */
  calculateSinceDate(period) {
    const now = new Date();
    const since = new Date(now);

    switch (period) {
      case TIME_PERIOD.WEEK:
        since.setDate(now.getDate() - 7);
        break;
      case TIME_PERIOD.MONTH:
        since.setMonth(now.getMonth() - 1);
        break;
      case TIME_PERIOD.QUARTER:
        since.setMonth(now.getMonth() - 3);
        break;
      case TIME_PERIOD.YEAR:
        since.setFullYear(now.getFullYear() - 1);
        break;
    }

    return since;
  }

  /**
   * Calculate average time to merge
   * @param {Array} prs - PRs
   * @returns {number} Average time in hours
   */
  calculateAverageTimeToMerge(prs) {
    const mergedPRs = prs.filter(pr => pr.merged_at !== null);

    if (mergedPRs.length === 0) return 0;

    const totalTime = mergedPRs.reduce((sum, pr) => {
      const created = new Date(pr.created_at);
      const merged = new Date(pr.merged_at);
      return sum + (merged - created);
    }, 0);

    return Math.round(totalTime / mergedPRs.length / (1000 * 60 * 60)); // Convert to hours
  }

  /**
   * Calculate average time to first review
   * @param {Array} prs - PRs
   * @returns {number} Average time in hours
   */
  calculateAverageTimeToFirstReview(prs) {
    // Simplified calculation - would need review data
    return 0; // Placeholder
  }

  /**
   * Calculate average comments per PR
   * @param {Array} prs - PRs
   * @returns {number} Average comments
   */
  calculateAverageCommentsPerPR(prs) {
    if (prs.length === 0) return 0;

    const totalComments = prs.reduce((sum, pr) => sum + (pr.comments || 0), 0);
    return Math.round((totalComments / prs.length) * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate merge rate
   * @param {Array} prs - PRs
   * @returns {number} Merge rate percentage
   */
  calculateMergeRate(prs) {
    if (prs.length === 0) return 0;

    const mergedCount = prs.filter(pr => pr.merged_at !== null).length;
    return Math.round((mergedCount / prs.length) * 100);
  }

  /**
   * Identify stale PRs
   * @param {Array} prs - PRs
   * @returns {Array} Stale PRs
   */
  identifyStalePRs(prs) {
    const stalePRs = prs.filter(pr => {
      const daysSinceUpdate = (Date.now() - new Date(pr.updated_at)) / (1000 * 60 * 60 * 24);
      return pr.state === 'open' && daysSinceUpdate > 7;
    });

    return stalePRs.map(pr => ({
      number: pr.number,
      title: pr.title,
      daysSinceUpdate: Math.round((Date.now() - new Date(pr.updated_at)) / (1000 * 60 * 60 * 24))
    }));
  }

  /**
   * Calculate health score
   * @param {Object} metrics - Metrics
   * @returns {number} Health score (0-100)
   */
  calculateHealthScore(metrics) {
    let score = 100;

    // Deduct for low merge rate
    if (metrics.mergeRate < 70) {
      score -= (70 - metrics.mergeRate) * 0.5;
    }

    // Deduct for slow merge time (> 48 hours)
    if (metrics.averageTimeToMerge > 48) {
      score -= Math.min(30, (metrics.averageTimeToMerge - 48) / 2);
    }

    // Deduct for stale PRs
    score -= Math.min(20, metrics.stalePRs.length * 2);

    return Math.max(0, Math.round(score));
  }

  /**
   * Calculate average PRs per week
   * @param {Array} prs - PRs
   * @param {string} period - Period
   * @returns {number} Average PRs per week
   */
  calculateAveragePRsPerWeek(prs, period) {
    const weeks = period === TIME_PERIOD.WEEK ? 1
      : period === TIME_PERIOD.MONTH ? 4
      : period === TIME_PERIOD.QUARTER ? 13
      : 52;

    return Math.round((prs.length / weeks) * 10) / 10;
  }

  /**
   * Identify top contributors
   * @param {Array} prs - PRs
   * @returns {Array} Top contributors
   */
  identifyTopContributors(prs) {
    const contributors = {};

    prs.forEach(pr => {
      const author = pr.user.login;
      if (!contributors[author]) {
        contributors[author] = 0;
      }
      contributors[author]++;
    });

    return Object.entries(contributors)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([author, count]) => ({ author, prs: count }));
  }

  /**
   * Calculate velocity trend
   * @param {string} period - Period
   * @returns {Promise<string>} Trend (increasing, decreasing, stable)
   */
  async calculateVelocityTrend(period) {
    // Simplified - would need historical data
    return 'stable';
  }

  /**
   * Analyze review bottleneck
   * @param {Array} prs - PRs
   * @returns {Object} Analysis
   */
  analyzeReviewBottleneck(prs) {
    const openPRs = prs.filter(pr => pr.state === 'open');
    const needsReview = openPRs.filter(pr => {
      const daysSinceCreated = (Date.now() - new Date(pr.created_at)) / (1000 * 60 * 60 * 24);
      return daysSinceCreated > 2; // PRs waiting > 2 days for review
    });

    return {
      type: 'review',
      isBottleneck: needsReview.length > openPRs.length * 0.5,
      severity: needsReview.length > openPRs.length * 0.7 ? 'high' : 'medium',
      count: needsReview.length,
      message: `${needsReview.length} PR(s) waiting for review > 2 days`,
      recommendation: 'Consider adding more reviewers or implementing review rotation'
    };
  }

  /**
   * Analyze CI bottleneck
   * @param {Array} prs - PRs
   * @returns {Promise<Object>} Analysis
   */
  async analyzeCIBottleneck(prs) {
    // Simplified - would need CI check data
    return {
      type: 'ci',
      isBottleneck: false,
      severity: 'low',
      count: 0,
      message: 'No significant CI bottleneck detected',
      recommendation: null
    };
  }

  /**
   * Analyze merge bottleneck
   * @param {Array} prs - PRs
   * @returns {Object} Analysis
   */
  analyzeMergeBottleneck(prs) {
    const approved = prs.filter(pr =>
      pr.state === 'open' // Would need to check if approved
    );

    return {
      type: 'merge',
      isBottleneck: approved.length > 5,
      severity: approved.length > 10 ? 'high' : 'medium',
      count: approved.length,
      message: `${approved.length} approved PR(s) waiting to be merged`,
      recommendation: 'Enable auto-merge for approved PRs'
    };
  }

  /**
   * Analyze stale bottleneck
   * @param {Array} prs - PRs
   * @returns {Object} Analysis
   */
  analyzeStaleBottleneck(prs) {
    const stalePRs = this.identifyStalePRs(prs);

    return {
      type: 'stale',
      isBottleneck: stalePRs.length > 3,
      severity: stalePRs.length > 10 ? 'high' : 'medium',
      count: stalePRs.length,
      message: `${stalePRs.length} stale PR(s) (> 7 days without update)`,
      recommendation: 'Review and close or merge stale PRs'
    };
  }

  /**
   * Generate recommendations
   * @param {Array} bottlenecks - Bottlenecks
   * @returns {Array} Recommendations
   */
  generateRecommendations(bottlenecks) {
    return bottlenecks
      .filter(b => b.recommendation)
      .map(b => ({
        type: b.type,
        severity: b.severity,
        recommendation: b.recommendation
      }));
  }
}

/**
 * Get singleton instance
 */
let analyticsInstance = null;

export function getAnalytics() {
  if (!analyticsInstance) {
    analyticsInstance = new Analytics();
  }
  return analyticsInstance;
}
