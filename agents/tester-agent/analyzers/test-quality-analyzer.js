/**
 * Test Quality Analyzer - Overall Test Suite Quality Assessment
 *
 * Phase 7.3: Advanced Test Analyzers
 * Aggregates metrics from all analyzers to assess overall test quality
 */

import { BaseAnalyzer, ANALYSIS_STATUS, SEVERITY } from './base-analyzer.js';

/**
 * Quality grades
 */
export const QUALITY_GRADE = {
  A: 'A',  // Excellent (90-100)
  B: 'B',  // Good (80-89)
  C: 'C',  // Fair (70-79)
  D: 'D',  // Poor (60-69)
  F: 'F'   // Failing (<60)
};

/**
 * Quality metrics
 */
export const QUALITY_METRIC = {
  COVERAGE: 'coverage',
  MUTATION_SCORE: 'mutation_score',
  FLAKINESS: 'flakiness',
  PERFORMANCE: 'performance',
  REGRESSION_RATE: 'regression_rate',
  MAINTAINABILITY: 'maintainability'
};

/**
 * TestQualityAnalyzer
 * Analyzes overall test suite quality
 */
export class TestQualityAnalyzer extends BaseAnalyzer {
  constructor() {
    super('TestQualityAnalyzer', 'quality');
    this.metrics = {};
    this.overallScore = 0;
    this.grade = null;
  }

  /**
   * Analyze test suite quality
   * @param {Object} input - Analysis results from various analyzers
   * @param {Object} options - Options
   * @returns {Promise<Object>} Quality analysis result
   */
  async analyze(input, options = {}) {
    this.startAnalysis();

    try {
      const {
        coverageAnalysis,
        mutationAnalysis,
        flakinessAnalysis,
        performanceAnalysis,
        regressionAnalysis,
        testResults
      } = input;

      // Calculate individual metrics
      const metrics = {
        coverage: this.analyzeCoverageQuality(coverageAnalysis),
        mutationScore: this.analyzeMutationQuality(mutationAnalysis),
        flakiness: this.analyzeFlakinessQuality(flakinessAnalysis),
        performance: this.analyzePerformanceQuality(performanceAnalysis),
        regressionRate: this.analyzeRegressionQuality(regressionAnalysis),
        maintainability: this.analyzeMaintainability(testResults)
      };

      this.metrics = metrics;

      // Calculate overall score
      const overallScore = this.calculateOverallScore(metrics, options);
      const grade = this.calculateGrade(overallScore);

      // Identify strengths and weaknesses
      const strengths = this.identifyStrengths(metrics);
      const weaknesses = this.identifyWeaknesses(metrics);

      // Generate recommendations
      const recommendations = this.generateQualityRecommendations(metrics, weaknesses);

      // Calculate trend if historical data available
      const trend = options.historicalScores
        ? this.calculateTrend(options.historicalScores, overallScore)
        : null;

      const duration = this.endAnalysis();

      this.overallScore = overallScore;
      this.grade = grade;

      return {
        success: true,
        overallScore,
        grade,
        metrics,
        strengths,
        weaknesses,
        recommendations,
        trend,
        duration
      };
    } catch (error) {
      this.logger.error(`Quality analysis failed: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Analyze coverage quality
   * @param {Object} coverageAnalysis - Coverage analysis result
   * @returns {Object} Coverage metric
   */
  analyzeCoverageQuality(coverageAnalysis) {
    if (!coverageAnalysis || !coverageAnalysis.success) {
      return { score: 0, weight: 0.3, status: 'unavailable' };
    }

    const summary = coverageAnalysis.summary;
    const avgCoverage = (
      summary.lines.pct +
      summary.functions.pct +
      summary.branches.pct
    ) / 3;

    return {
      score: avgCoverage,
      weight: 0.3,
      details: {
        lines: summary.lines.pct,
        functions: summary.functions.pct,
        branches: summary.branches.pct,
        gaps: coverageAnalysis.gaps?.length || 0
      },
      status: avgCoverage >= 80 ? 'good' : avgCoverage >= 60 ? 'fair' : 'poor'
    };
  }

  /**
   * Analyze mutation quality
   * @param {Object} mutationAnalysis - Mutation analysis result
   * @returns {Object} Mutation metric
   */
  analyzeMutationQuality(mutationAnalysis) {
    if (!mutationAnalysis || !mutationAnalysis.success) {
      return { score: 0, weight: 0.25, status: 'unavailable' };
    }

    const mutationScore = mutationAnalysis.mutationScore || 0;

    return {
      score: mutationScore,
      weight: 0.25,
      details: {
        mutationScore,
        totalMutants: mutationAnalysis.mutants?.length || 0,
        killed: mutationAnalysis.report?.killed || 0,
        survived: mutationAnalysis.report?.survived || 0
      },
      status: mutationScore >= 70 ? 'good' : mutationScore >= 50 ? 'fair' : 'poor'
    };
  }

  /**
   * Analyze flakiness quality
   * @param {Object} flakinessAnalysis - Flakiness analysis result
   * @returns {Object} Flakiness metric
   */
  analyzeFlakinessQuality(flakinessAnalysis) {
    if (!flakinessAnalysis || !flakinessAnalysis.success) {
      return { score: 100, weight: 0.2, status: 'unavailable' };
    }

    const flakyCount = flakinessAnalysis.flakyTests?.length || 0;
    const totalAnalyzed = flakinessAnalysis.totalAnalyzed || 1;

    // Score based on flakiness rate (lower is better)
    const flakinessRate = (flakyCount / totalAnalyzed) * 100;
    const score = Math.max(0, 100 - flakinessRate * 10); // Penalize flakiness heavily

    return {
      score,
      weight: 0.2,
      details: {
        flakyTests: flakyCount,
        stableFailures: flakinessAnalysis.stableFailures?.length || 0,
        totalAnalyzed
      },
      status: flakyCount === 0 ? 'good' : flakyCount <= 2 ? 'fair' : 'poor'
    };
  }

  /**
   * Analyze performance quality
   * @param {Object} performanceAnalysis - Performance analysis result
   * @returns {Object} Performance metric
   */
  analyzePerformanceQuality(performanceAnalysis) {
    if (!performanceAnalysis || !performanceAnalysis.success) {
      return { score: 100, weight: 0.15, status: 'unavailable' };
    }

    const slowTests = performanceAnalysis.slowTests?.length || 0;
    const totalTests = performanceAnalysis.testStats?.total || 1;

    // Score based on slow test rate
    const slowRate = (slowTests / totalTests) * 100;
    const score = Math.max(0, 100 - slowRate * 5);

    return {
      score,
      weight: 0.15,
      details: {
        slowTests,
        avgDuration: performanceAnalysis.testStats?.avgDuration || 0,
        totalDuration: performanceAnalysis.testStats?.totalDuration || 0
      },
      status: slowTests === 0 ? 'good' : slowRate < 10 ? 'fair' : 'poor'
    };
  }

  /**
   * Analyze regression quality
   * @param {Object} regressionAnalysis - Regression analysis result
   * @returns {Object} Regression metric
   */
  analyzeRegressionQuality(regressionAnalysis) {
    if (!regressionAnalysis || !regressionAnalysis.success) {
      return { score: 100, weight: 0.1, status: 'unavailable' };
    }

    const regressions = regressionAnalysis.regressions?.length || 0;

    // Score based on regression count (fewer is better)
    const score = Math.max(0, 100 - regressions * 10);

    return {
      score,
      weight: 0.1,
      details: {
        regressions,
        trends: regressionAnalysis.trends
      },
      status: regressions === 0 ? 'good' : regressions <= 2 ? 'fair' : 'poor'
    };
  }

  /**
   * Analyze maintainability
   * @param {Object} testResults - Test results
   * @returns {Object} Maintainability metric
   */
  analyzeMaintainability(testResults) {
    if (!testResults) {
      return { score: 100, weight: 0.1, status: 'unavailable' };
    }

    // Simple heuristic based on test structure
    const totalTests = testResults.tests?.length || 0;
    const avgTestDuration = testResults.avgDuration || 0;

    // Good maintainability: many tests, fast execution
    let score = 100;

    if (totalTests < 10) score -= 20; // Too few tests
    if (avgTestDuration > 5000) score -= 20; // Tests too slow

    return {
      score: Math.max(0, score),
      weight: 0.1,
      details: {
        totalTests,
        avgTestDuration
      },
      status: score >= 80 ? 'good' : score >= 60 ? 'fair' : 'poor'
    };
  }

  /**
   * Calculate overall score
   * @param {Object} metrics - Individual metrics
   * @param {Object} options - Options
   * @returns {number} Overall score (0-100)
   */
  calculateOverallScore(metrics, options = {}) {
    let weightedSum = 0;
    let totalWeight = 0;

    Object.entries(metrics).forEach(([key, metric]) => {
      if (metric.status !== 'unavailable') {
        weightedSum += metric.score * metric.weight;
        totalWeight += metric.weight;
      }
    });

    if (totalWeight === 0) return 0;

    const score = weightedSum / totalWeight;
    return Math.round(score * 100) / 100;
  }

  /**
   * Calculate grade from score
   * @param {number} score - Overall score
   * @returns {string} Grade
   */
  calculateGrade(score) {
    if (score >= 90) return QUALITY_GRADE.A;
    if (score >= 80) return QUALITY_GRADE.B;
    if (score >= 70) return QUALITY_GRADE.C;
    if (score >= 60) return QUALITY_GRADE.D;
    return QUALITY_GRADE.F;
  }

  /**
   * Identify strengths
   * @param {Object} metrics - Metrics
   * @returns {Array} Strengths
   */
  identifyStrengths(metrics) {
    const strengths = [];

    Object.entries(metrics).forEach(([key, metric]) => {
      if (metric.status === 'good' && metric.score >= 85) {
        strengths.push({
          metric: key,
          score: metric.score,
          message: `Excellent ${key} (${metric.score.toFixed(1)}%)`
        });
      }
    });

    return strengths;
  }

  /**
   * Identify weaknesses
   * @param {Object} metrics - Metrics
   * @returns {Array} Weaknesses
   */
  identifyWeaknesses(metrics) {
    const weaknesses = [];

    Object.entries(metrics).forEach(([key, metric]) => {
      if (metric.status === 'poor' || metric.score < 60) {
        weaknesses.push({
          metric: key,
          score: metric.score,
          severity: metric.score < 40 ? SEVERITY.CRITICAL : SEVERITY.HIGH,
          message: `Poor ${key} (${metric.score.toFixed(1)}%)`,
          details: metric.details
        });
      } else if (metric.status === 'fair' || metric.score < 80) {
        weaknesses.push({
          metric: key,
          score: metric.score,
          severity: SEVERITY.MEDIUM,
          message: `Fair ${key} (${metric.score.toFixed(1)}%)`,
          details: metric.details
        });
      }
    });

    // Sort by severity and score
    return weaknesses.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity] || a.score - b.score;
    });
  }

  /**
   * Generate quality recommendations
   * @param {Object} metrics - Metrics
   * @param {Array} weaknesses - Weaknesses
   * @returns {Array} Recommendations
   */
  generateQualityRecommendations(metrics, weaknesses) {
    const recommendations = [];

    weaknesses.forEach(weakness => {
      const rec = {
        metric: weakness.metric,
        priority: weakness.severity,
        currentScore: weakness.score,
        actions: []
      };

      switch (weakness.metric) {
        case 'coverage':
          rec.actions.push('Increase test coverage to at least 80%');
          rec.actions.push('Focus on uncovered branches and functions');
          rec.actions.push('Use coverage reports to identify gaps');
          break;

        case 'mutationScore':
          rec.actions.push('Improve test assertions to catch mutations');
          rec.actions.push('Add edge case tests');
          rec.actions.push('Review survived mutants and write targeted tests');
          break;

        case 'flakiness':
          rec.actions.push('Fix or quarantine flaky tests');
          rec.actions.push('Use proper synchronization in async tests');
          rec.actions.push('Ensure test isolation');
          break;

        case 'performance':
          rec.actions.push('Optimize slow tests');
          rec.actions.push('Use mocks for external dependencies');
          rec.actions.push('Run tests in parallel');
          break;

        case 'regressionRate':
          rec.actions.push('Investigate and fix regression causes');
          rec.actions.push('Add regression tests');
          rec.actions.push('Improve CI/CD pipeline');
          break;

        case 'maintainability':
          rec.actions.push('Refactor complex tests');
          rec.actions.push('Add more unit tests');
          rec.actions.push('Improve test organization');
          break;
      }

      recommendations.push(rec);
    });

    return recommendations;
  }

  /**
   * Calculate trend
   * @param {Array} historicalScores - Historical scores
   * @param {number} currentScore - Current score
   * @returns {Object} Trend analysis
   */
  calculateTrend(historicalScores, currentScore) {
    if (!historicalScores || historicalScores.length === 0) {
      return { direction: 'stable', change: 0 };
    }

    const previousScore = historicalScores[historicalScores.length - 1];
    const change = currentScore - previousScore;
    const changePercent = (change / previousScore) * 100;

    let direction = 'stable';
    if (Math.abs(changePercent) >= 5) {
      direction = change > 0 ? 'improving' : 'declining';
    }

    return {
      direction,
      change,
      changePercent,
      previousScore,
      currentScore
    };
  }

  /**
   * Get quality summary
   * @returns {Object} Summary
   */
  getQualitySummary() {
    return {
      overallScore: this.overallScore,
      grade: this.grade,
      metrics: Object.entries(this.metrics).map(([key, value]) => ({
        name: key,
        score: value.score,
        status: value.status
      }))
    };
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getTestQualityAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new TestQualityAnalyzer();
  }
  return analyzerInstance;
}
