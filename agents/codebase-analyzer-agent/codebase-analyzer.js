/**
 * Codebase Analyzer - Main Integration Module
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Orchestrates all analyzers for system-wide codebase analysis
 *
 * Plan Reference: Phase 6.5.5 - Integration & Reporting
 * - Integrates all 5 analyzers
 * - Generates executive dashboards
 * - Provides real-time health monitoring
 * - Alerts on critical issues
 */

import { getDependencyMapper } from './analyzers/dependency-mapper.js';
import { getAPIContractValidator } from './analyzers/api-contract-validator.js';
import { getTechnicalDebtAnalyzer } from './analyzers/technical-debt-analyzer.js';
import { createLogger } from './utils/logger.js';
// Use codebase-level wrappers that adapt foundation analyzers
import { getCodebaseSecurityScanner } from './analyzers/codebase-security-scanner.js';
import { getCodebasePerformanceAnalyzer } from './analyzers/codebase-performance-analyzer.js';
import * as path from 'path';
import * as fs from 'fs';

/**
 * CodebaseAnalyzer - Main orchestrator
 */
export class CodebaseAnalyzer {
  constructor() {
    this.logger = createLogger('Main');
    this.analyzers = {
      dependency: getDependencyMapper(),
      apiContract: getAPIContractValidator(),
      security: getCodebaseSecurityScanner(),
      technicalDebt: getTechnicalDebtAnalyzer(),
      performance: getCodebasePerformanceAnalyzer()
    };
    // Configurable codebase paths - users can customize via configure()
    this.codebaseConfig = null;
  }

  /**
   * Configure codebase paths for analysis
   * @param {Object} config - Codebase configuration
   * @param {Object} config.codebases - Map of codebase name to path config
   * @example
   * analyzer.configure({
   *   codebases: {
   *     backend: { path: './backend', marker: 'package.json' },
   *     frontend: { path: './frontend', marker: 'package.json' },
   *     mobile: { path: './mobile', marker: 'pubspec.yaml' }
   *   }
   * });
   */
  configure(config) {
    this.codebaseConfig = config;
    this.logger.info('Codebase analyzer configured with custom paths');
  }

  /**
   * Run complete codebase analysis
   * @param {Object} options - Analysis options
   * @returns {Object} Complete analysis results
   */
  async analyze(options = {}) {
    this.logger.info('🚀 Starting comprehensive codebase analysis');

    const startTime = Date.now();

    // Use provided base path or current working directory
    const basePath = options.basePath || process.cwd();

    // Resolve codebase paths
    const codebasePaths = this.resolveCodebasePaths(basePath);

    this.logger.info('Codebase paths:', codebasePaths);

    // If no codebases found, return early with empty results
    if (Object.keys(codebasePaths).length === 0) {
      this.logger.warn('No codebases found to analyze - returning empty results');
      return {
        timestamp: new Date().toISOString(),
        codebasePaths: {},
        analyzers: {},
        dashboard: { overview: { totalIssues: 0, criticalIssues: 0, highIssues: 0, mediumIssues: 0, lowIssues: 0 }, byAnalyzer: {}, byCodebase: {}, byCategory: {}, metrics: {} },
        healthScore: { overall: 100, security: 100, performance: 100, apiContract: 100, dependency: 100, technicalDebt: 100, grade: 'A' },
        criticalIssues: [],
        recommendations: [],
        summary: { healthScore: { overall: 100, grade: 'A', status: 'No codebases to analyze' }, issuesSummary: { total: 0, critical: 0, high: 0, actionRequired: 0 }, topConcerns: [], techDebt: { hours: '0', cost: '$0' }, security: { score: 100, vulnerabilities: 0 }, performance: { score: 100, issues: 0 } },
        analysisTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
      };
    }

    // Run all analyzers
    const results = {
      timestamp: new Date().toISOString(),
      codebasePaths,
      analyzers: {}
    };

    try {
      // Run analyzers sequentially with individual error handling
      // This allows partial results even if some analyzers fail

      this.logger.info('📦 Running Dependency Mapper...');
      try {
        results.analyzers.dependency = await this.analyzers.dependency.analyze(codebasePaths, options);
      } catch (err) {
        this.logger.warn('Dependency Mapper failed:', err.message);
        results.analyzers.dependency = { success: false, error: err.message, issues: [], counts: {} };
      }

      this.logger.info('🔌 Running API Contract Validator...');
      try {
        results.analyzers.apiContract = await this.analyzers.apiContract.analyze(codebasePaths, options);
      } catch (err) {
        this.logger.warn('API Contract Validator failed:', err.message);
        results.analyzers.apiContract = { success: false, error: err.message, issues: [], counts: {} };
      }

      this.logger.info('🔒 Running Security Scanner...');
      try {
        results.analyzers.security = await this.analyzers.security.analyze(codebasePaths, options);
      } catch (err) {
        this.logger.warn('Security Scanner failed:', err.message);
        results.analyzers.security = { success: false, error: err.message, issues: [], counts: {} };
      }

      this.logger.info('💳 Running Technical Debt Analyzer...');
      try {
        results.analyzers.technicalDebt = await this.analyzers.technicalDebt.analyze(codebasePaths, options);
      } catch (err) {
        this.logger.warn('Technical Debt Analyzer failed:', err.message);
        results.analyzers.technicalDebt = { success: false, error: err.message, issues: [], counts: {} };
      }

      this.logger.info('⚡ Running Performance Analyzer...');
      try {
        results.analyzers.performance = await this.analyzers.performance.analyze(codebasePaths, options);
      } catch (err) {
        this.logger.warn('Performance Analyzer failed:', err.message);
        results.analyzers.performance = { success: false, error: err.message, issues: [], counts: {} };
      }

      // Generate aggregated reports
      results.dashboard = this.generateDashboard(results);
      results.healthScore = this.calculateHealthScore(results);
      results.criticalIssues = this.extractCriticalIssues(results);
      results.recommendations = this.generateRecommendations(results);
      results.summary = this.generateExecutiveSummary(results);

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      results.analysisTime = `${duration}s`;

      this.logger.info(`✅ Analysis complete in ${duration}s`);
      this.logger.info(`📊 Health Score: ${results.healthScore.overall}/100`);
      this.logger.info(`⚠️  Critical Issues: ${results.criticalIssues.length}`);

      // Alert on critical issues
      if (results.criticalIssues.length > 0) {
        this.alertCriticalIssues(results.criticalIssues);
      }

      return results;

    } catch (error) {
      this.logger.error('Analysis failed:', error);
      // Return empty results instead of throwing when codebases don't exist
      if (Object.keys(codebasePaths).length === 0) {
        this.logger.warn('No codebases to analyze - returning empty results');
        return {
          timestamp: new Date().toISOString(),
          codebasePaths: {},
          analyzers: {},
          dashboard: this.generateDashboard({ analyzers: {} }),
          healthScore: { overall: 100, grade: 'A' },
          criticalIssues: [],
          recommendations: [],
          summary: { healthScore: { overall: 100, grade: 'A', status: 'No codebases to analyze' } },
          analysisTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
        };
      }
      throw error;
    }
  }

  /**
   * Resolve paths to codebases
   * Filters out paths that don't exist or don't have expected structure
   * @param {string} basePath - Base project path
   * @returns {Object} Paths to existing codebases
   */
  resolveCodebasePaths(basePath) {
    // Use configured paths if available, otherwise auto-detect
    let pathConfigs;

    if (this.codebaseConfig?.codebases) {
      // Use user-provided configuration
      pathConfigs = {};
      for (const [key, config] of Object.entries(this.codebaseConfig.codebases)) {
        const configPath = config.path.startsWith('/')
          ? config.path
          : path.join(basePath, config.path);
        pathConfigs[key] = { path: configPath, marker: config.marker || 'package.json' };
      }
    } else {
      // Auto-detect common project structures
      pathConfigs = this.autoDetectCodebases(basePath);
    }

    // Filter to only valid paths (exist and have marker file)
    const existingPaths = {};
    for (const [key, config] of Object.entries(pathConfigs)) {
      try {
        const dirExists = fs.existsSync(config.path);
        const markerExists = fs.existsSync(path.join(config.path, config.marker));

        if (dirExists && markerExists) {
          existingPaths[key] = config.path;
        } else if (dirExists) {
          this.logger.debug(`Skipping ${key}: directory exists but missing ${config.marker}`);
        } else {
          this.logger.debug(`Skipping ${key}: directory does not exist`);
        }
      } catch {
        this.logger.debug(`Skipping inaccessible path: ${config.path}`);
      }
    }

    if (Object.keys(existingPaths).length === 0) {
      this.logger.warn('No valid codebases found. Analysis will return empty results.');
      this.logger.info('Tip: Use analyzer.configure({ codebases: {...} }) to specify your project structure');
    }

    return existingPaths;
  }

  /**
   * Auto-detect common project structures
   * @param {string} basePath - Base project path
   * @returns {Object} Detected path configurations
   */
  autoDetectCodebases(basePath) {
    const detected = {};

    // Common monorepo patterns
    const patterns = [
      // Node.js projects
      { name: 'backend', dirs: ['backend', 'server', 'api', 'src'], marker: 'package.json' },
      { name: 'frontend', dirs: ['frontend', 'client', 'web', 'app'], marker: 'package.json' },
      // Flutter projects
      { name: 'mobile', dirs: ['mobile', 'app', 'flutter'], marker: 'pubspec.yaml' },
      // Admin dashboards
      { name: 'admin', dirs: ['admin', 'admin-dashboard', 'dashboard'], marker: 'package.json' },
      // Additional common patterns
      { name: 'packages', dirs: ['packages'], marker: 'package.json' },
      { name: 'libs', dirs: ['libs', 'lib'], marker: 'package.json' }
    ];

    for (const pattern of patterns) {
      for (const dir of pattern.dirs) {
        const fullPath = path.join(basePath, dir);
        if (fs.existsSync(fullPath) && fs.existsSync(path.join(fullPath, pattern.marker))) {
          detected[pattern.name] = { path: fullPath, marker: pattern.marker };
          break; // Found this pattern, move to next
        }
      }
    }

    return detected;
  }

  /**
   * Generate executive dashboard
   * @param {Object} results - Analysis results
   * @returns {Object} Dashboard data
   */
  generateDashboard(results) {
    const dashboard = {
      overview: {
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      },
      byAnalyzer: {},
      byCodebase: {
        backend: { issues: 0, critical: 0, high: 0 },
        'users-app': { issues: 0, critical: 0, high: 0 },
        'drivers-app': { issues: 0, critical: 0, high: 0 },
        'admin-dashboard': { issues: 0, critical: 0, high: 0 }
      },
      byCategory: {},
      metrics: {}
    };

    // Aggregate from all analyzers
    Object.entries(results.analyzers).forEach(([analyzerName, analyzerResult]) => {
      if (!analyzerResult.success) return;

      // By analyzer
      dashboard.byAnalyzer[analyzerName] = {
        totalIssues: analyzerResult.counts?.total || 0,
        critical: analyzerResult.counts?.critical || 0,
        high: analyzerResult.counts?.high || 0,
        medium: analyzerResult.counts?.medium || 0,
        low: analyzerResult.counts?.low || 0
      };

      // Overall totals
      dashboard.overview.totalIssues += analyzerResult.counts?.total || 0;
      dashboard.overview.criticalIssues += analyzerResult.counts?.critical || 0;
      dashboard.overview.highIssues += analyzerResult.counts?.high || 0;
      dashboard.overview.mediumIssues += analyzerResult.counts?.medium || 0;
      dashboard.overview.lowIssues += analyzerResult.counts?.low || 0;

      // By codebase
      analyzerResult.issues?.forEach(issue => {
        const codebase = issue.codebase || 'unknown';
        if (dashboard.byCodebase[codebase]) {
          dashboard.byCodebase[codebase].issues++;
          if (issue.severity === 'critical') dashboard.byCodebase[codebase].critical++;
          if (issue.severity === 'high') dashboard.byCodebase[codebase].high++;
        }

        // By category
        const category = issue.category || 'other';
        if (!dashboard.byCategory[category]) {
          dashboard.byCategory[category] = { count: 0, critical: 0, high: 0 };
        }
        dashboard.byCategory[category].count++;
        if (issue.severity === 'critical') dashboard.byCategory[category].critical++;
        if (issue.severity === 'high') dashboard.byCategory[category].high++;
      });

      // Collect metrics
      if (analyzerResult.metrics) {
        dashboard.metrics[analyzerName] = analyzerResult.metrics;
      }
    });

    return dashboard;
  }

  /**
   * Calculate overall health score
   * @param {Object} results - Analysis results
   * @returns {Object} Health scores
   */
  calculateHealthScore(results) {
    const scores = {
      security: results.analyzers.security?.metrics?.security_score || 50,
      performance: results.analyzers.performance?.metrics?.performance_score || 50,
      apiContract: 100, // Start at 100, deduct for issues
      dependency: 100,
      technicalDebt: 100
    };

    // Deduct points for API contract issues
    const apiIssues = results.analyzers.apiContract?.counts || {};
    const apiDeduction = (apiIssues.critical || 0) * 20 + (apiIssues.high || 0) * 10 + (apiIssues.medium || 0) * 5;
    scores.apiContract -= apiDeduction;
    scores.apiContract = Math.max(0, scores.apiContract);

    // Deduct points for dependency issues
    const depIssues = results.analyzers.dependency?.counts || {};
    const depDeduction = (depIssues.critical || 0) * 20 + (depIssues.high || 0) * 10 + (depIssues.medium || 0) * 5;
    scores.dependency -= depDeduction;
    scores.dependency = Math.max(0, scores.dependency);

    // Technical debt score based on cost
    const debtHoursStr = results.analyzers.technicalDebt?.metrics?.total_debt_hours || '0';
    const debtHours = parseFloat(debtHoursStr);
    if (!isNaN(debtHours)) {
      scores.technicalDebt = Math.max(0, 100 - (debtHours / 10)); // 1 point per 10 hours
    }

    // Calculate overall score (weighted average)
    const weights = {
      security: 0.3,      // 30% weight (most important)
      performance: 0.25,  // 25% weight
      apiContract: 0.2,   // 20% weight
      dependency: 0.15,   // 15% weight
      technicalDebt: 0.1  // 10% weight
    };

    let overall = 0;
    Object.entries(weights).forEach(([key, weight]) => {
      const score = scores[key] || 0;
      overall += score * weight;
    });

    return {
      overall: Math.round(overall),
      security: Math.round(scores.security),
      performance: Math.round(scores.performance),
      apiContract: Math.round(scores.apiContract),
      dependency: Math.round(scores.dependency),
      technicalDebt: Math.round(scores.technicalDebt),
      grade: this.scoreToGrade(overall)
    };
  }

  /**
   * Convert score to letter grade
   * @param {number} score - Numeric score (0-100)
   * @returns {string} Letter grade
   */
  scoreToGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  /**
   * Extract critical issues
   * @param {Object} results - Analysis results
   * @returns {Array} Critical issues
   */
  extractCriticalIssues(results) {
    const critical = [];

    Object.entries(results.analyzers).forEach(([analyzerName, analyzerResult]) => {
      if (!analyzerResult.success) return;

      analyzerResult.issues?.forEach(issue => {
        if (issue.severity === 'critical' || issue.severity === 'high') {
          critical.push({
            ...issue,
            analyzer: analyzerName
          });
        }
      });
    });

    // Sort by severity
    critical.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return critical;
  }

  /**
   * Generate recommendations
   * @param {Object} results - Analysis results
   * @returns {Array} Prioritized recommendations
   */
  generateRecommendations(results) {
    const recommendations = [];

    // Security recommendations
    const securityScore = results.healthScore.security;
    if (securityScore < 70) {
      recommendations.push({
        priority: 'critical',
        category: 'security',
        title: 'Address Security Vulnerabilities',
        description: `Security score is ${securityScore}/100. Review and fix security issues immediately.`,
        impact: 'High risk of security breaches'
      });
    }

    // Performance recommendations
    const perfScore = results.healthScore.performance;
    if (perfScore < 70) {
      recommendations.push({
        priority: 'high',
        category: 'performance',
        title: 'Optimize Performance',
        description: `Performance score is ${perfScore}/100. Address performance bottlenecks.`,
        impact: 'Poor user experience and high server costs'
      });
    }

    // API contract recommendations
    const apiIssues = results.analyzers.apiContract?.counts?.high || 0;
    if (apiIssues > 0) {
      recommendations.push({
        priority: 'high',
        category: 'api-contract',
        title: 'Fix API Contract Mismatches',
        description: `${apiIssues} high-severity API contract issues detected.`,
        impact: 'API calls will fail at runtime'
      });
    }

    // Technical debt recommendations
    const debtCost = results.analyzers.technicalDebt?.metrics?.total_debt_cost || '$0';
    const debtHours = results.analyzers.technicalDebt?.metrics?.total_debt_hours || '0';
    if (parseFloat(debtHours) > 100) {
      recommendations.push({
        priority: 'medium',
        category: 'technical-debt',
        title: 'Reduce Technical Debt',
        description: `${debtHours} hours (${debtCost}) of technical debt identified.`,
        impact: 'Slower development and increased maintenance costs'
      });
    }

    // Dependency recommendations
    const versionMismatches = results.analyzers.dependency?.issues?.filter(i => i.type === 'version_mismatch').length || 0;
    if (versionMismatches > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'dependency',
        title: 'Align Dependency Versions',
        description: `${versionMismatches} version mismatches across codebases.`,
        impact: 'Potential compatibility issues'
      });
    }

    return recommendations;
  }

  /**
   * Generate executive summary
   * @param {Object} results - Analysis results
   * @returns {Object} Executive summary
   */
  generateExecutiveSummary(results) {
    const dashboard = results.dashboard;
    const healthScore = results.healthScore;

    return {
      healthScore: {
        overall: healthScore.overall,
        grade: healthScore.grade,
        status: healthScore.overall >= 70 ? 'Healthy' : healthScore.overall >= 50 ? 'Needs Attention' : 'Critical'
      },
      issuesSummary: {
        total: dashboard.overview.totalIssues,
        critical: dashboard.overview.criticalIssues,
        high: dashboard.overview.highIssues,
        actionRequired: dashboard.overview.criticalIssues + dashboard.overview.highIssues
      },
      topConcerns: this.identifyTopConcerns(results),
      techDebt: {
        hours: results.analyzers.technicalDebt?.metrics?.total_debt_hours || '0',
        cost: results.analyzers.technicalDebt?.metrics?.total_debt_cost || '$0'
      },
      security: {
        score: healthScore.security,
        vulnerabilities: results.analyzers.security?.counts?.total || 0
      },
      performance: {
        score: healthScore.performance,
        issues: results.analyzers.performance?.counts?.total || 0
      }
    };
  }

  /**
   * Identify top concerns
   * @param {Object} results - Analysis results
   * @returns {Array} Top concerns
   */
  identifyTopConcerns(results) {
    const concerns = [];

    // Check each analyzer for high-severity issues
    Object.entries(results.analyzers).forEach(([name, result]) => {
      if (result.counts?.critical > 0) {
        concerns.push({
          area: name,
          severity: 'critical',
          count: result.counts.critical
        });
      } else if (result.counts?.high > 5) {
        concerns.push({
          area: name,
          severity: 'high',
          count: result.counts.high
        });
      }
    });

    return concerns.slice(0, 5); // Top 5 concerns
  }

  /**
   * Alert on critical issues
   * @param {Array} criticalIssues - Critical issues
   */
  alertCriticalIssues(criticalIssues) {
    this.logger.warn('⚠️  CRITICAL ISSUES DETECTED:');
    criticalIssues.slice(0, 10).forEach((issue, index) => {
      this.logger.warn(`${index + 1}. [${issue.severity.toUpperCase()}] ${issue.message}`);
      this.logger.warn(`   📁 ${issue.file}:${issue.location?.line || 0}`);
      if (issue.suggestion) {
        this.logger.warn(`   💡 ${issue.suggestion}`);
      }
    });

    if (criticalIssues.length > 10) {
      this.logger.warn(`... and ${criticalIssues.length - 10} more critical issues`);
    }
  }

  /**
   * Generate report for Manager-Agent
   * @param {Object} results - Analysis results
   * @returns {Object} Manager-compatible report
   */
  generateManagerReport(results) {
    return {
      agentName: 'codebase-analyzer',
      status: results.healthScore.overall >= 70 ? 'success' : 'warning',
      summary: results.summary,
      healthScore: results.healthScore,
      criticalIssues: results.criticalIssues.length,
      recommendations: results.recommendations,
      timestamp: results.timestamp
    };
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getCodebaseAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new CodebaseAnalyzer();
  }
  return analyzerInstance;
}

/**
 * CLI entry point
 */
export async function main() {
  const analyzer = getCodebaseAnalyzer();

  // Resolve project root from current working directory
  const projectRoot = process.cwd();

  try {
    const results = await analyzer.analyze({
      basePath: projectRoot
    });

    // Output results
    console.log('\n📊 === CODEBASE HEALTH REPORT ===\n');
    console.log(`Overall Health Score: ${results.healthScore.overall}/100 (${results.healthScore.grade})`);
    console.log(`Status: ${results.summary.healthScore.status}\n`);

    console.log('🔍 Analysis Breakdown:');
    console.log(`  Security:       ${results.healthScore.security}/100`);
    console.log(`  Performance:    ${results.healthScore.performance}/100`);
    console.log(`  API Contract:   ${results.healthScore.apiContract}/100`);
    console.log(`  Dependencies:   ${results.healthScore.dependency}/100`);
    console.log(`  Technical Debt: ${results.healthScore.technicalDebt}/100\n`);

    console.log('📈 Issues Summary:');
    console.log(`  Total Issues:    ${results.dashboard.overview.totalIssues}`);
    console.log(`  Critical:        ${results.dashboard.overview.criticalIssues}`);
    console.log(`  High:            ${results.dashboard.overview.highIssues}`);
    console.log(`  Medium:          ${results.dashboard.overview.mediumIssues}`);
    console.log(`  Low:             ${results.dashboard.overview.lowIssues}\n`);

    if (results.recommendations.length > 0) {
      console.log('💡 Top Recommendations:');
      results.recommendations.slice(0, 5).forEach((rec, i) => {
        console.log(`  ${i + 1}. [${rec.priority.toUpperCase()}] ${rec.title}`);
        console.log(`     ${rec.description}\n`);
      });
    }

    console.log(`⏱️  Analysis Time: ${results.analysisTime}\n`);

    // Exit with error code if critical issues found
    if (results.criticalIssues.length > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
