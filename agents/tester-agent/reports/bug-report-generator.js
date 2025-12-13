/**
 * Bug Report Generator - Bug Reports for Manager-Agent
 *
 * Phase 7.5: Report Generator
 * Generates bug reports for Manager-Agent integration
 */

import { BaseReportGenerator, REPORT_FORMAT, REPORT_TYPE } from './base-report-generator.js';

/**
 * Bug severity levels
 */
export const BUG_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

/**
 * Bug Report Generator
 * Generates bug reports for Manager-Agent
 */
export class BugReportGenerator extends BaseReportGenerator {
  constructor() {
    super('BugReportGenerator', REPORT_TYPE.BUG);
  }

  /**
   * Generate bug report
   * @param {Object} data - Bug data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated report
   */
  async generate(data, options = {}) {
    this.logger.info('Generating bug report...');

    try {
      const {
        failedTests = [],
        flakyTests = [],
        regressions = [],
        coverageGaps = [],
        performanceIssues = [],
        format = REPORT_FORMAT.JSON // Default to JSON for Manager-Agent
      } = data;

      const reportData = this.processBugData(data);

      let content;
      let filePath;

      switch (format) {
        case REPORT_FORMAT.HTML:
          content = this.generateHTMLReport(reportData);
          filePath = options.outputPath || `./reports/bug-report-${Date.now()}.html`;
          break;

        case REPORT_FORMAT.MARKDOWN:
          content = this.generateMarkdownReport(reportData);
          filePath = options.outputPath || `./reports/bug-report-${Date.now()}.md`;
          break;

        case REPORT_FORMAT.JSON:
          content = this.toJSON(reportData);
          filePath = options.outputPath || `./reports/bug-report-${Date.now()}.json`;
          break;

        default:
          content = this.generateTextReport(reportData);
          filePath = options.outputPath || `./reports/bug-report-${Date.now()}.txt`;
      }

      if (!options.dryRun) {
        this.saveReport(content, filePath, format);
      }

      return {
        success: true,
        filePath,
        format,
        bugs: reportData.bugs,
        summary: reportData.summary
      };
    } catch (error) {
      this.logger.error(`Failed to generate bug report: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process bug data
   * @param {Object} data - Bug data
   * @returns {Object} Processed data
   */
  processBugData(data) {
    const {
      failedTests = [],
      flakyTests = [],
      regressions = [],
      coverageGaps = [],
      performanceIssues = []
    } = data;

    const bugs = [];

    // Convert failed tests to bugs
    failedTests.forEach((test, index) => {
      bugs.push(this.createBugFromFailedTest(test, index + 1));
    });

    // Convert flaky tests to bugs
    flakyTests.forEach((test, index) => {
      bugs.push(this.createBugFromFlakyTest(test, bugs.length + 1));
    });

    // Convert regressions to bugs
    regressions.forEach((regression, index) => {
      bugs.push(this.createBugFromRegression(regression, bugs.length + 1));
    });

    // Convert coverage gaps to bugs
    coverageGaps.filter(g => g.severity === 'critical' || g.severity === 'high').forEach((gap, index) => {
      bugs.push(this.createBugFromCoverageGap(gap, bugs.length + 1));
    });

    // Convert performance issues to bugs
    performanceIssues.forEach((issue, index) => {
      bugs.push(this.createBugFromPerformanceIssue(issue, bugs.length + 1));
    });

    const summary = {
      total: bugs.length,
      bySeverity: {
        critical: bugs.filter(b => b.severity === BUG_SEVERITY.CRITICAL).length,
        high: bugs.filter(b => b.severity === BUG_SEVERITY.HIGH).length,
        medium: bugs.filter(b => b.severity === BUG_SEVERITY.MEDIUM).length,
        low: bugs.filter(b => b.severity === BUG_SEVERITY.LOW).length
      },
      byType: this.groupBugsByType(bugs)
    };

    return {
      bugs,
      summary,
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: this.name,
        version: '1.0.0'
      }
    };
  }

  /**
   * Create bug from failed test
   * @param {Object} test - Failed test
   * @param {number} id - Bug ID
   * @returns {Object} Bug
   */
  createBugFromFailedTest(test, id) {
    return {
      id: `BUG-${id}`,
      type: 'test_failure',
      severity: BUG_SEVERITY.HIGH,
      title: `Test Failure: ${test.name}`,
      description: `Test "${test.name}" is failing`,
      details: {
        testName: test.name,
        suite: test.suite || null,
        file: test.file || null,
        error: test.error || null,
        duration: test.duration || 0
      },
      impact: 'Test suite is failing, blocking deployment',
      reproducible: true,
      status: 'open',
      assignedTo: null,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create bug from flaky test
   * @param {Object} test - Flaky test
   * @param {number} id - Bug ID
   * @returns {Object} Bug
   */
  createBugFromFlakyTest(test, id) {
    return {
      id: `BUG-${id}`,
      type: 'flaky_test',
      severity: BUG_SEVERITY.MEDIUM,
      title: `Flaky Test: ${test.test}`,
      description: `Test "${test.test}" is flaky (${test.passCount}/${test.totalAttempts} passed)`,
      details: {
        testName: test.test,
        passCount: test.passCount,
        failCount: test.failCount,
        totalAttempts: test.totalAttempts,
        flakinessScore: test.flakinessScore || 0,
        pattern: test.pattern || 'unknown',
        recommendation: test.recommendation || null
      },
      impact: 'Test reliability is compromised, causing false positives/negatives',
      reproducible: false,
      status: 'open',
      assignedTo: null,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create bug from regression
   * @param {Object} regression - Regression
   * @param {number} id - Bug ID
   * @returns {Object} Bug
   */
  createBugFromRegression(regression, id) {
    const severity = regression.type === 'newly_failing' ? BUG_SEVERITY.CRITICAL :
                    regression.type === 'performance' ? BUG_SEVERITY.MEDIUM :
                    BUG_SEVERITY.HIGH;

    return {
      id: `BUG-${id}`,
      type: 'regression',
      severity,
      title: `Regression: ${regression.test || regression.metric}`,
      description: `Regression detected in ${regression.test || regression.metric}`,
      details: {
        regressionType: regression.type,
        test: regression.test || null,
        metric: regression.metric || null,
        previousValue: regression.previousValue || regression.previousStatus,
        currentValue: regression.currentValue || regression.currentStatus,
        firstDetected: regression.firstFailedAt || regression.timestamp
      },
      impact: regression.type === 'newly_failing' ?
        'Previously passing test is now failing' :
        'Performance degradation detected',
      reproducible: true,
      status: 'open',
      assignedTo: null,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create bug from coverage gap
   * @param {Object} gap - Coverage gap
   * @param {number} id - Bug ID
   * @returns {Object} Bug
   */
  createBugFromCoverageGap(gap, id) {
    return {
      id: `BUG-${id}`,
      type: 'coverage_gap',
      severity: gap.severity === 'critical' ? BUG_SEVERITY.CRITICAL : BUG_SEVERITY.HIGH,
      title: `Coverage Gap: ${gap.file}`,
      description: `${gap.type.replace(/_/g, ' ')} in ${gap.file}`,
      details: {
        file: gap.file,
        gapType: gap.type,
        actual: gap.actual,
        threshold: gap.threshold,
        uncovered: gap.uncovered
      },
      impact: 'Insufficient test coverage, potential bugs may go undetected',
      reproducible: true,
      status: 'open',
      assignedTo: null,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Create bug from performance issue
   * @param {Object} issue - Performance issue
   * @param {number} id - Bug ID
   * @returns {Object} Bug
   */
  createBugFromPerformanceIssue(issue, id) {
    return {
      id: `BUG-${id}`,
      type: 'performance_issue',
      severity: BUG_SEVERITY.MEDIUM,
      title: `Performance Issue: ${issue.test || issue.suite}`,
      description: `${issue.type} detected`,
      details: {
        issueType: issue.type,
        test: issue.test || null,
        suite: issue.suite || null,
        duration: issue.duration || null,
        threshold: issue.threshold || null,
        slowdownFactor: issue.slowdownFactor || null
      },
      impact: 'Test execution time is excessive, slowing down CI/CD pipeline',
      reproducible: true,
      status: 'open',
      assignedTo: null,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Group bugs by type
   * @param {Array} bugs - Bugs
   * @returns {Object} Grouped bugs
   */
  groupBugsByType(bugs) {
    const grouped = {};

    bugs.forEach(bug => {
      if (!grouped[bug.type]) {
        grouped[bug.type] = 0;
      }
      grouped[bug.type]++;
    });

    return grouped;
  }

  /**
   * Generate HTML report
   * @param {Object} data - Processed data
   * @returns {string} HTML report
   */
  generateHTMLReport(data) {
    const { bugs, summary } = data;

    const content = `
      ${this.generateSummarySection(summary)}
      ${this.generateBugsSection(bugs)}
    `;

    return this.generateHTMLTemplate('Bug Report', content);
  }

  /**
   * Generate summary section
   * @param {Object} summary - Summary
   * @returns {string} HTML section
   */
  generateSummarySection(summary) {
    return `
      <section class="summary">
        <h2>Bug Summary</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
          ${this.generateMetricCard('Total Bugs', summary.total, { color: summary.total > 0 ? '#e74c3c' : '#2ecc71' })}
          ${this.generateMetricCard('Critical', summary.bySeverity.critical, { color: '#c0392b' })}
          ${this.generateMetricCard('High', summary.bySeverity.high, { color: '#e74c3c' })}
          ${this.generateMetricCard('Medium', summary.bySeverity.medium, { color: '#f39c12' })}
          ${this.generateMetricCard('Low', summary.bySeverity.low, { color: '#3498db' })}
        </div>
        <h3>By Type</h3>
        <ul>
          ${Object.entries(summary.byType).map(([type, count]) =>
            `<li>${type.replace(/_/g, ' ')}: ${count}</li>`
          ).join('')}
        </ul>
      </section>
    `;
  }

  /**
   * Generate bugs section
   * @param {Array} bugs - Bugs
   * @returns {string} HTML section
   */
  generateBugsSection(bugs) {
    const bugItems = bugs.map(bug => {
      const severityClass = `severity-${bug.severity}`;
      const color = bug.severity === 'critical' ? '#c0392b' :
                   bug.severity === 'high' ? '#e74c3c' :
                   bug.severity === 'medium' ? '#f39c12' : '#3498db';

      return `
        <div class="bug-item" style="background: #fff; border-left: 4px solid ${color}; padding: 15px; margin: 15px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
              <h4 style="margin: 0; color: #2c3e50;">${this.escapeHTML(bug.id)}: ${this.escapeHTML(bug.title)}</h4>
              <div style="color: #666; font-size: 0.9em; margin-top: 5px;">${this.escapeHTML(bug.description)}</div>
            </div>
            <span class="${severityClass}" style="text-transform: uppercase; font-size: 0.8em; font-weight: 600; white-space: nowrap; margin-left: 10px;">${bug.severity}</span>
          </div>
          <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0;">
            <div style="font-size: 0.85em; color: #555;">
              <strong>Type:</strong> ${bug.type.replace(/_/g, ' ')} |
              <strong>Impact:</strong> ${this.escapeHTML(bug.impact)}
            </div>
          </div>
          <div style="font-size: 0.85em; color: #777;">
            <strong>Created:</strong> ${new Date(bug.createdAt).toLocaleString()} |
            <strong>Status:</strong> ${bug.status} |
            <strong>Reproducible:</strong> ${bug.reproducible ? 'Yes' : 'No'}
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="bugs">
        <h2>Bug Reports (${bugs.length})</h2>
        ${bugItems}
      </section>
    `;
  }

  /**
   * Generate markdown report
   * @param {Object} data - Processed data
   * @returns {string} Markdown report
   */
  generateMarkdownReport(data) {
    const { bugs, summary } = data;

    const content = `
## Bug Summary

- **Total Bugs:** ${summary.total}
- **Critical:** ${summary.bySeverity.critical}
- **High:** ${summary.bySeverity.high}
- **Medium:** ${summary.bySeverity.medium}
- **Low:** ${summary.bySeverity.low}

### By Type

${Object.entries(summary.byType).map(([type, count]) => `- ${type.replace(/_/g, ' ')}: ${count}`).join('\n')}

## Bug Reports

${bugs.map(bug => `
### ${bug.id}: ${bug.title}

**Severity:** ${bug.severity}
**Type:** ${bug.type}
**Status:** ${bug.status}
**Reproducible:** ${bug.reproducible ? 'Yes' : 'No'}

**Description:** ${bug.description}

**Impact:** ${bug.impact}

**Created:** ${new Date(bug.createdAt).toLocaleString()}
`).join('\n---\n')}
`;

    return this.generateMarkdownDocument('Bug Report', content);
  }

  /**
   * Generate text report
   * @param {Object} data - Processed data
   * @returns {string} Text report
   */
  generateTextReport(data) {
    const { bugs, summary } = data;

    const lines = [
      '='.repeat(60),
      'BUG REPORT',
      '='.repeat(60),
      '',
      'SUMMARY',
      '-'.repeat(60),
      `Total Bugs:  ${summary.total}`,
      `Critical:    ${summary.bySeverity.critical}`,
      `High:        ${summary.bySeverity.high}`,
      `Medium:      ${summary.bySeverity.medium}`,
      `Low:         ${summary.bySeverity.low}`,
      '',
      'BUGS',
      '-'.repeat(60)
    ];

    bugs.forEach((bug, index) => {
      lines.push('');
      lines.push(`${index + 1}. ${bug.id}: ${bug.title}`);
      lines.push(`   Severity: ${bug.severity.toUpperCase()}`);
      lines.push(`   Type: ${bug.type}`);
      lines.push(`   ${bug.description}`);
      lines.push(`   Impact: ${bug.impact}`);
    });

    lines.push('', '='.repeat(60), `Generated: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }
}

/**
 * Get singleton instance
 */
let generatorInstance = null;

export function getBugReportGenerator() {
  if (!generatorInstance) {
    generatorInstance = new BugReportGenerator();
  }
  return generatorInstance;
}
