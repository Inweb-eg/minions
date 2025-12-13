/**
 * Test Report Generator - Comprehensive Test Reports
 *
 * Phase 7.5: Report Generator
 * Generates comprehensive test execution reports
 */

import { BaseReportGenerator, REPORT_FORMAT, REPORT_TYPE } from './base-report-generator.js';

/**
 * TestReportGenerator
 * Generates comprehensive test execution reports
 */
export class TestReportGenerator extends BaseReportGenerator {
  constructor() {
    super('TestReportGenerator', REPORT_TYPE.TEST);
  }

  /**
   * Generate test report
   * @param {Object} data - Test data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated report
   */
  async generate(data, options = {}) {
    this.logger.info('Generating test report...');

    try {
      const {
        results,
        summary,
        platform = 'unknown',
        format = REPORT_FORMAT.HTML
      } = data;

      const reportData = this.processTestData(results, summary);

      let content;
      let filePath;

      switch (format) {
        case REPORT_FORMAT.HTML:
          content = this.generateHTMLReport(reportData, platform);
          filePath = options.outputPath || `./reports/test-report-${Date.now()}.html`;
          break;

        case REPORT_FORMAT.MARKDOWN:
          content = this.generateMarkdownReport(reportData, platform);
          filePath = options.outputPath || `./reports/test-report-${Date.now()}.md`;
          break;

        case REPORT_FORMAT.JSON:
          content = this.toJSON(reportData);
          filePath = options.outputPath || `./reports/test-report-${Date.now()}.json`;
          break;

        default:
          content = this.generateTextReport(reportData, platform);
          filePath = options.outputPath || `./reports/test-report-${Date.now()}.txt`;
      }

      if (!options.dryRun) {
        this.saveReport(content, filePath, format);
      }

      return {
        success: true,
        filePath,
        format,
        summary: reportData.summary
      };
    } catch (error) {
      this.logger.error(`Failed to generate test report: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process test data
   * @param {Array|Object} results - Test results
   * @param {Object} summary - Test summary
   * @returns {Object} Processed data
   */
  processTestData(results, summary) {
    const tests = Array.isArray(results) ? results : (results.tests || []);

    const processed = {
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.status === 'passed').length,
        failed: tests.filter(t => t.status === 'failed').length,
        skipped: tests.filter(t => t.status === 'skipped').length,
        duration: summary?.duration || tests.reduce((sum, t) => sum + (t.duration || 0), 0),
        ...summary
      },
      tests: tests.map(test => ({
        name: test.name || test.title || 'Unnamed test',
        status: test.status || 'unknown',
        duration: test.duration || 0,
        error: test.error || test.failureMessage || null,
        file: test.file || test.testFilePath || null,
        suite: test.suite || test.ancestorTitles?.[0] || null
      })),
      suites: this.groupTestsBySuite(tests),
      failedTests: tests.filter(t => t.status === 'failed'),
      slowTests: tests.filter(t => t.duration > 5000).sort((a, b) => b.duration - a.duration)
    };

    // Calculate pass rate
    processed.summary.passRate = processed.summary.total > 0
      ? (processed.summary.passed / processed.summary.total) * 100
      : 0;

    return processed;
  }

  /**
   * Group tests by suite
   * @param {Array} tests - Tests
   * @returns {Object} Grouped tests
   */
  groupTestsBySuite(tests) {
    const suites = {};

    tests.forEach(test => {
      const suiteName = test.suite || test.ancestorTitles?.[0] || 'Uncategorized';

      if (!suites[suiteName]) {
        suites[suiteName] = {
          name: suiteName,
          tests: [],
          passed: 0,
          failed: 0,
          skipped: 0,
          duration: 0
        };
      }

      suites[suiteName].tests.push(test);
      suites[suiteName].duration += test.duration || 0;

      if (test.status === 'passed') suites[suiteName].passed++;
      else if (test.status === 'failed') suites[suiteName].failed++;
      else if (test.status === 'skipped') suites[suiteName].skipped++;
    });

    return Object.values(suites);
  }

  /**
   * Generate HTML report
   * @param {Object} data - Processed data
   * @param {string} platform - Platform name
   * @returns {string} HTML report
   */
  generateHTMLReport(data, platform) {
    const { summary, tests, suites, failedTests, slowTests } = data;

    const content = `
      ${this.generateSummarySection(summary, platform)}
      ${this.generateSuiteSection(suites)}
      ${failedTests.length > 0 ? this.generateFailedTestsSection(failedTests) : ''}
      ${slowTests.length > 0 ? this.generateSlowTestsSection(slowTests) : ''}
      ${this.generateAllTestsSection(tests)}
    `;

    return this.generateHTMLTemplate(`Test Report - ${platform}`, content);
  }

  /**
   * Generate summary section
   * @param {Object} summary - Summary data
   * @param {string} platform - Platform
   * @returns {string} HTML section
   */
  generateSummarySection(summary, platform) {
    const passRateColor = summary.passRate >= 80 ? '#2ecc71' :
                          summary.passRate >= 60 ? '#f39c12' : '#e74c3c';

    return `
      <section class="summary">
        <h2>Test Summary - ${this.escapeHTML(platform)}</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
          ${this.generateMetricCard('Total Tests', summary.total)}
          ${this.generateMetricCard('Passed', summary.passed, { color: '#2ecc71' })}
          ${this.generateMetricCard('Failed', summary.failed, { color: '#e74c3c' })}
          ${this.generateMetricCard('Skipped', summary.skipped, { color: '#95a5a6' })}
          ${this.generateMetricCard('Duration', this.formatDuration(summary.duration))}
          ${this.generateMetricCard('Pass Rate', this.formatPercentage(summary.passRate), { color: passRateColor })}
        </div>
        ${this.generateProgressBar(summary.passRate, `${summary.passed}/${summary.total} tests passed`)}
      </section>
    `;
  }

  /**
   * Generate suite section
   * @param {Array} suites - Test suites
   * @returns {string} HTML section
   */
  generateSuiteSection(suites) {
    const rows = suites.map(suite => {
      const total = suite.tests.length;
      const passRate = total > 0 ? (suite.passed / total) * 100 : 0;
      const statusClass = suite.failed > 0 ? 'status-fail' : 'status-pass';

      return [
        suite.name,
        total,
        `<span class="status-pass">${suite.passed}</span>`,
        `<span class="status-fail">${suite.failed}</span>`,
        `<span class="status-skip">${suite.skipped}</span>`,
        this.formatDuration(suite.duration),
        `<span class="${statusClass}">${passRate.toFixed(1)}%</span>`
      ];
    });

    return `
      <section class="suites">
        <h2>Test Suites</h2>
        ${this.generateTable(
          ['Suite', 'Total', 'Passed', 'Failed', 'Skipped', 'Duration', 'Pass Rate'],
          rows
        )}
      </section>
    `;
  }

  /**
   * Generate failed tests section
   * @param {Array} failedTests - Failed tests
   * @returns {string} HTML section
   */
  generateFailedTestsSection(failedTests) {
    const testItems = failedTests.map(test => `
      <div class="failed-test" style="background: #fff5f5; border-left: 4px solid #e74c3c; padding: 15px; margin: 10px 0; border-radius: 4px;">
        <h4 style="color: #e74c3c; margin: 0 0 10px 0;">${this.escapeHTML(test.name)}</h4>
        <div style="color: #666; font-size: 0.9em; margin-bottom: 10px;">
          ${test.suite ? `Suite: ${this.escapeHTML(test.suite)} | ` : ''}
          Duration: ${this.formatDuration(test.duration)}
          ${test.file ? ` | File: ${this.escapeHTML(test.file)}` : ''}
        </div>
        ${test.error ? `
          <pre style="background: #2c3e50; color: #e74c3c; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.85em;">${this.escapeHTML(test.error)}</pre>
        ` : ''}
      </div>
    `).join('');

    return `
      <section class="failed-tests">
        <h2>Failed Tests (${failedTests.length})</h2>
        ${testItems}
      </section>
    `;
  }

  /**
   * Generate slow tests section
   * @param {Array} slowTests - Slow tests
   * @returns {string} HTML section
   */
  generateSlowTestsSection(slowTests) {
    const rows = slowTests.slice(0, 10).map(test => [
      test.name,
      test.suite || '-',
      this.formatDuration(test.duration),
      test.status
    ]);

    return `
      <section class="slow-tests">
        <h2>Slowest Tests (Top 10)</h2>
        <p style="color: #777; margin-bottom: 15px;">Tests taking longer than 5 seconds</p>
        ${this.generateTable(
          ['Test Name', 'Suite', 'Duration', 'Status'],
          rows
        )}
      </section>
    `;
  }

  /**
   * Generate all tests section
   * @param {Array} tests - All tests
   * @returns {string} HTML section
   */
  generateAllTestsSection(tests) {
    const rows = tests.map(test => {
      const statusClass = test.status === 'passed' ? 'status-pass' :
                         test.status === 'failed' ? 'status-fail' : 'status-skip';

      return [
        test.name,
        test.suite || '-',
        `<span class="${statusClass}">${test.status}</span>`,
        this.formatDuration(test.duration)
      ];
    });

    return `
      <section class="all-tests">
        <h2>All Tests (${tests.length})</h2>
        ${this.generateTable(
          ['Test Name', 'Suite', 'Status', 'Duration'],
          rows
        )}
      </section>
    `;
  }

  /**
   * Generate markdown report
   * @param {Object} data - Processed data
   * @param {string} platform - Platform
   * @returns {string} Markdown report
   */
  generateMarkdownReport(data, platform) {
    const { summary, suites, failedTests, slowTests } = data;

    const content = `
## Test Summary - ${platform}

- **Total Tests:** ${summary.total}
- **Passed:** ${summary.passed} ✅
- **Failed:** ${summary.failed} ❌
- **Skipped:** ${summary.skipped} ⏭️
- **Duration:** ${this.formatDuration(summary.duration)}
- **Pass Rate:** ${this.formatPercentage(summary.passRate)}

## Test Suites

| Suite | Total | Passed | Failed | Skipped | Duration | Pass Rate |
|-------|-------|--------|--------|---------|----------|-----------|
${suites.map(s => {
  const total = s.tests.length;
  const passRate = total > 0 ? (s.passed / total) * 100 : 0;
  return `| ${s.name} | ${total} | ${s.passed} | ${s.failed} | ${s.skipped} | ${this.formatDuration(s.duration)} | ${passRate.toFixed(1)}% |`;
}).join('\n')}

${failedTests.length > 0 ? `
## Failed Tests (${failedTests.length})

${failedTests.map(test => `
### ${test.name}

- **Suite:** ${test.suite || 'N/A'}
- **Duration:** ${this.formatDuration(test.duration)}
${test.file ? `- **File:** ${test.file}` : ''}

${test.error ? '```\n' + test.error + '\n```' : ''}
`).join('\n')}
` : ''}

${slowTests.length > 0 ? `
## Slowest Tests (Top 10)

| Test | Suite | Duration | Status |
|------|-------|----------|--------|
${slowTests.slice(0, 10).map(t => `| ${t.name} | ${t.suite || '-'} | ${this.formatDuration(t.duration)} | ${t.status} |`).join('\n')}
` : ''}
`;

    return this.generateMarkdownDocument(`Test Report - ${platform}`, content);
  }

  /**
   * Generate text report
   * @param {Object} data - Processed data
   * @param {string} platform - Platform
   * @returns {string} Text report
   */
  generateTextReport(data, platform) {
    const { summary, suites, failedTests } = data;

    const lines = [
      '='.repeat(60),
      `TEST REPORT - ${platform}`,
      '='.repeat(60),
      '',
      'SUMMARY',
      '-'.repeat(60),
      `Total Tests:  ${summary.total}`,
      `Passed:       ${summary.passed}`,
      `Failed:       ${summary.failed}`,
      `Skipped:      ${summary.skipped}`,
      `Duration:     ${this.formatDuration(summary.duration)}`,
      `Pass Rate:    ${this.formatPercentage(summary.passRate)}`,
      '',
      'SUITES',
      '-'.repeat(60)
    ];

    suites.forEach(suite => {
      const total = suite.tests.length;
      const passRate = total > 0 ? (suite.passed / total) * 100 : 0;
      lines.push(`${suite.name}: ${suite.passed}/${total} passed (${passRate.toFixed(1)}%)`);
    });

    if (failedTests.length > 0) {
      lines.push('', 'FAILED TESTS', '-'.repeat(60));
      failedTests.forEach(test => {
        lines.push(`- ${test.name}`);
        if (test.suite) lines.push(`  Suite: ${test.suite}`);
        if (test.error) lines.push(`  Error: ${test.error.split('\n')[0]}`);
      });
    }

    lines.push('', '='.repeat(60), `Generated: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }

  /**
   * Generate summary-only report
   * @param {Object} data - Test data
   * @returns {Object} Summary report
   */
  generateSummaryReport(data) {
    const processed = this.processTestData(data.results, data.summary);

    return {
      summary: processed.summary,
      suites: processed.suites.map(s => ({
        name: s.name,
        total: s.tests.length,
        passed: s.passed,
        failed: s.failed,
        passRate: s.tests.length > 0 ? (s.passed / s.tests.length) * 100 : 0
      })),
      failedCount: processed.failedTests.length,
      slowTestCount: processed.slowTests.length
    };
  }
}

/**
 * Get singleton instance
 */
let generatorInstance = null;

export function getTestReportGenerator() {
  if (!generatorInstance) {
    generatorInstance = new TestReportGenerator();
  }
  return generatorInstance;
}
