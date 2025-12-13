/**
 * Performance Report Generator - Performance Reports with Regressions
 *
 * Phase 7.5: Report Generator
 * Generates performance reports with regression analysis
 */

import { BaseReportGenerator, REPORT_FORMAT, REPORT_TYPE } from './base-report-generator.js';

/**
 * PerformanceReportGenerator
 * Generates performance reports with regressions
 */
export class PerformanceReportGenerator extends BaseReportGenerator {
  constructor() {
    super('PerformanceReportGenerator', REPORT_TYPE.PERFORMANCE);
  }

  /**
   * Generate performance report
   * @param {Object} data - Performance data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated report
   */
  async generate(data, options = {}) {
    this.logger.info('Generating performance report...');

    try {
      const {
        slowTests = [],
        slowSuites = [],
        outliers = [],
        testStats = {},
        regressions = [],
        trends = {},
        format = REPORT_FORMAT.HTML
      } = data;

      const reportData = this.processPerformanceData(data);

      let content;
      let filePath;

      switch (format) {
        case REPORT_FORMAT.HTML:
          content = this.generateHTMLReport(reportData);
          filePath = options.outputPath || `./reports/performance-report-${Date.now()}.html`;
          break;

        case REPORT_FORMAT.MARKDOWN:
          content = this.generateMarkdownReport(reportData);
          filePath = options.outputPath || `./reports/performance-report-${Date.now()}.md`;
          break;

        case REPORT_FORMAT.JSON:
          content = this.toJSON(reportData);
          filePath = options.outputPath || `./reports/performance-report-${Date.now()}.json`;
          break;

        default:
          content = this.generateTextReport(reportData);
          filePath = options.outputPath || `./reports/performance-report-${Date.now()}.txt`;
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
      this.logger.error(`Failed to generate performance report: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process performance data
   * @param {Object} data - Performance data
   * @returns {Object} Processed data
   */
  processPerformanceData(data) {
    const {
      slowTests = [],
      slowSuites = [],
      outliers = [],
      testStats = {},
      regressions = [],
      trends = {}
    } = data;

    return {
      summary: {
        totalTests: testStats.total || 0,
        avgDuration: testStats.avgDuration || 0,
        totalDuration: testStats.totalDuration || 0,
        slowTestsCount: slowTests.length,
        slowSuitesCount: slowSuites.length,
        outliersCount: outliers.length,
        regressionsCount: regressions.length
      },
      slowTests: slowTests.slice(0, 20), // Top 20
      slowSuites: slowSuites.slice(0, 10), // Top 10
      outliers: outliers.slice(0, 10),
      regressions: this.categorizeRegressions(regressions),
      trends: this.processTrends(trends),
      testStats
    };
  }

  /**
   * Categorize regressions by severity
   * @param {Array} regressions - Regressions
   * @returns {Object} Categorized regressions
   */
  categorizeRegressions(regressions) {
    const categorized = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      all: regressions
    };

    regressions.forEach(reg => {
      const severity = reg.severity || 'medium';
      if (categorized[severity]) {
        categorized[severity].push(reg);
      }
    });

    return categorized;
  }

  /**
   * Process trends
   * @param {Object} trends - Trends
   * @returns {Object} Processed trends
   */
  processTrends(trends) {
    const processed = {
      improving: [],
      degrading: [],
      stable: []
    };

    Object.entries(trends).forEach(([metric, trend]) => {
      const item = { metric, ...trend };

      if (trend.direction === 'improving') {
        processed.improving.push(item);
      } else if (trend.direction === 'degrading') {
        processed.degrading.push(item);
      } else {
        processed.stable.push(item);
      }
    });

    return processed;
  }

  /**
   * Generate HTML report
   * @param {Object} data - Processed data
   * @returns {string} HTML report
   */
  generateHTMLReport(data) {
    const { summary, slowTests, slowSuites, regressions, trends, outliers } = data;

    const content = `
      ${this.generateSummarySection(summary)}
      ${regressions.critical.length + regressions.high.length > 0 ? this.generateRegressionsSection(regressions) : ''}
      ${trends.degrading.length > 0 ? this.generateTrendsSection(trends) : ''}
      ${slowTests.length > 0 ? this.generateSlowTestsSection(slowTests) : ''}
      ${slowSuites.length > 0 ? this.generateSlowSuitesSection(slowSuites) : ''}
      ${outliers.length > 0 ? this.generateOutliersSection(outliers) : ''}
    `;

    return this.generateHTMLTemplate('Performance Report', content);
  }

  /**
   * Generate summary section
   * @param {Object} summary - Summary
   * @returns {string} HTML section
   */
  generateSummarySection(summary) {
    const avgColor = summary.avgDuration < 1000 ? '#2ecc71' :
                    summary.avgDuration < 3000 ? '#f39c12' : '#e74c3c';

    return `
      <section class="summary">
        <h2>Performance Summary</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
          ${this.generateMetricCard('Total Tests', this.formatNumber(summary.totalTests))}
          ${this.generateMetricCard('Average Duration', this.formatDuration(summary.avgDuration), { color: avgColor })}
          ${this.generateMetricCard('Total Duration', this.formatDuration(summary.totalDuration))}
          ${this.generateMetricCard('Slow Tests', summary.slowTestsCount, { color: summary.slowTestsCount > 0 ? '#e74c3c' : '#2ecc71' })}
          ${this.generateMetricCard('Regressions', summary.regressionsCount, { color: summary.regressionsCount > 0 ? '#e74c3c' : '#2ecc71' })}
          ${this.generateMetricCard('Outliers', summary.outliersCount, { color: summary.outliersCount > 0 ? '#f39c12' : '#2ecc71' })}
        </div>
      </section>
    `;
  }

  /**
   * Generate regressions section
   * @param {Object} regressions - Regressions
   * @returns {string} HTML section
   */
  generateRegressionsSection(regressions) {
    const criticalAndHigh = [...regressions.critical, ...regressions.high];

    const regItems = criticalAndHigh.map(reg => {
      const severityClass = `severity-${reg.severity}`;
      const color = reg.severity === 'critical' ? '#c0392b' :
                   reg.severity === 'high' ? '#e74c3c' : '#f39c12';

      return `
        <div class="regression-item" style="background: #fff5f5; border-left: 4px solid ${color}; padding: 15px; margin: 10px 0; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0; color: #2c3e50;">${this.escapeHTML(reg.metric)}</h4>
            <span class="${severityClass}" style="text-transform: uppercase; font-size: 0.8em; font-weight: 600;">${reg.severity}</span>
          </div>
          <div style="color: #666; font-size: 0.9em;">
            <div style="margin: 5px 0;"><strong>Previous:</strong> ${this.formatDuration(reg.previousValue)}</div>
            <div style="margin: 5px 0;"><strong>Current:</strong> ${this.formatDuration(reg.currentValue)}</div>
            <div style="margin: 5px 0; color: #e74c3c;"><strong>Increase:</strong> +${reg.percentIncrease}% (${reg.ratio.toFixed(2)}x slower)</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="regressions">
        <h2>Performance Regressions (${criticalAndHigh.length})</h2>
        <p style="color: #777; margin-bottom: 15px;">Critical and high severity performance regressions detected</p>
        ${regItems}
      </section>
    `;
  }

  /**
   * Generate trends section
   * @param {Object} trends - Trends
   * @returns {string} HTML section
   */
  generateTrendsSection(trends) {
    const degradingItems = trends.degrading.map(trend => {
      const changeColor = trend.changePercent > 0 ? '#e74c3c' : '#2ecc71';
      const arrow = trend.changePercent > 0 ? '↑' : '↓';

      return `
        <div style="background: #fff; padding: 12px; margin: 8px 0; border-radius: 4px; border-left: 3px solid ${changeColor};">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 600;">${this.escapeHTML(trend.metric)}</span>
            <span style="color: ${changeColor}; font-weight: 600;">${arrow} ${Math.abs(trend.changePercent).toFixed(1)}%</span>
          </div>
          <div style="color: #666; font-size: 0.85em; margin-top: 5px;">Direction: ${trend.direction}</div>
        </div>
      `;
    }).join('');

    return `
      <section class="trends">
        <h2>Performance Trends</h2>
        <h3 style="color: #e74c3c;">Degrading (${trends.degrading.length})</h3>
        ${degradingItems}
      </section>
    `;
  }

  /**
   * Generate slow tests section
   * @param {Array} slowTests - Slow tests
   * @returns {string} HTML section
   */
  generateSlowTestsSection(slowTests) {
    const rows = slowTests.map(test => [
      test.test,
      this.formatDuration(test.duration),
      this.formatDuration(test.threshold),
      `${test.slowdownFactor.toFixed(2)}x`,
      test.severity
    ]);

    return `
      <section class="slow-tests">
        <h2>Slow Tests (${slowTests.length})</h2>
        <p style="color: #777; margin-bottom: 15px;">Tests exceeding performance thresholds</p>
        ${this.generateTable(
          ['Test', 'Duration', 'Threshold', 'Factor', 'Severity'],
          rows
        )}
      </section>
    `;
  }

  /**
   * Generate slow suites section
   * @param {Array} slowSuites - Slow suites
   * @returns {string} HTML section
   */
  generateSlowSuitesSection(slowSuites) {
    const rows = slowSuites.map(suite => [
      suite.suite,
      suite.testCount || '-',
      this.formatDuration(suite.duration),
      this.formatDuration(suite.threshold),
      suite.severity
    ]);

    return `
      <section class="slow-suites">
        <h2>Slow Suites (${slowSuites.length})</h2>
        <p style="color: #777; margin-bottom: 15px;">Test suites exceeding performance thresholds</p>
        ${this.generateTable(
          ['Suite', 'Tests', 'Duration', 'Threshold', 'Severity'],
          rows
        )}
      </section>
    `;
  }

  /**
   * Generate outliers section
   * @param {Array} outliers - Outliers
   * @returns {string} HTML section
   */
  generateOutliersSection(outliers) {
    const rows = outliers.map(outlier => [
      outlier.test,
      this.formatDuration(outlier.duration),
      this.formatDuration(outlier.avgDuration),
      `${outlier.deviations.toFixed(2)}σ`
    ]);

    return `
      <section class="outliers">
        <h2>Performance Outliers (${outliers.length})</h2>
        <p style="color: #777; margin-bottom: 15px;">Tests significantly slower than average</p>
        ${this.generateTable(
          ['Test', 'Duration', 'Average', 'Std Dev'],
          rows
        )}
      </section>
    `;
  }

  /**
   * Generate markdown report
   * @param {Object} data - Processed data
   * @returns {string} Markdown report
   */
  generateMarkdownReport(data) {
    const { summary, slowTests, regressions, trends } = data;

    const content = `
## Performance Summary

- **Total Tests:** ${this.formatNumber(summary.totalTests)}
- **Average Duration:** ${this.formatDuration(summary.avgDuration)}
- **Total Duration:** ${this.formatDuration(summary.totalDuration)}
- **Slow Tests:** ${summary.slowTestsCount}
- **Regressions:** ${summary.regressionsCount}
- **Outliers:** ${summary.outliersCount}

${regressions.critical.length + regressions.high.length > 0 ? `
## Performance Regressions (${regressions.critical.length + regressions.high.length})

${[...regressions.critical, ...regressions.high].map(reg => `
### ${reg.metric} (${reg.severity})

- **Previous:** ${this.formatDuration(reg.previousValue)}
- **Current:** ${this.formatDuration(reg.currentValue)}
- **Increase:** +${reg.percentIncrease}% (${reg.ratio.toFixed(2)}x slower)
`).join('\n')}
` : ''}

${slowTests.length > 0 ? `
## Slow Tests (${slowTests.length})

| Test | Duration | Threshold | Factor | Severity |
|------|----------|-----------|--------|----------|
${slowTests.map(t => `| ${t.test} | ${this.formatDuration(t.duration)} | ${this.formatDuration(t.threshold)} | ${t.slowdownFactor.toFixed(2)}x | ${t.severity} |`).join('\n')}
` : ''}
`;

    return this.generateMarkdownDocument('Performance Report', content);
  }

  /**
   * Generate text report
   * @param {Object} data - Processed data
   * @returns {string} Text report
   */
  generateTextReport(data) {
    const { summary, slowTests, regressions } = data;

    const lines = [
      '='.repeat(60),
      'PERFORMANCE REPORT',
      '='.repeat(60),
      '',
      'SUMMARY',
      '-'.repeat(60),
      `Total Tests:     ${this.formatNumber(summary.totalTests)}`,
      `Avg Duration:    ${this.formatDuration(summary.avgDuration)}`,
      `Total Duration:  ${this.formatDuration(summary.totalDuration)}`,
      `Slow Tests:      ${summary.slowTestsCount}`,
      `Regressions:     ${summary.regressionsCount}`,
      `Outliers:        ${summary.outliersCount}`
    ];

    const criticalAndHigh = [...regressions.critical, ...regressions.high];
    if (criticalAndHigh.length > 0) {
      lines.push('', 'REGRESSIONS', '-'.repeat(60));
      criticalAndHigh.forEach(reg => {
        lines.push(`[${reg.severity.toUpperCase()}] ${reg.metric}`);
        lines.push(`  Previous: ${this.formatDuration(reg.previousValue)} → Current: ${this.formatDuration(reg.currentValue)} (+${reg.percentIncrease}%)`);
      });
    }

    if (slowTests.length > 0) {
      lines.push('', 'SLOW TESTS', '-'.repeat(60));
      slowTests.slice(0, 10).forEach(test => {
        lines.push(`${test.test}: ${this.formatDuration(test.duration)} (${test.slowdownFactor.toFixed(2)}x threshold)`);
      });
    }

    lines.push('', '='.repeat(60), `Generated: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }
}

/**
 * Get singleton instance
 */
let generatorInstance = null;

export function getPerformanceReportGenerator() {
  if (!generatorInstance) {
    generatorInstance = new PerformanceReportGenerator();
  }
  return generatorInstance;
}
