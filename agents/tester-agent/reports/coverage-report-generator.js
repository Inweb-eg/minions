/**
 * Coverage Report Generator - Coverage Reports with Recommendations
 *
 * Phase 7.5: Report Generator
 * Generates coverage reports with gap analysis and recommendations
 */

import { BaseReportGenerator, REPORT_FORMAT, REPORT_TYPE } from './base-report-generator.js';

/**
 * CoverageReportGenerator
 * Generates coverage reports with recommendations
 */
export class CoverageReportGenerator extends BaseReportGenerator {
  constructor() {
    super('CoverageReportGenerator', REPORT_TYPE.COVERAGE);
  }

  /**
   * Generate coverage report
   * @param {Object} data - Coverage data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated report
   */
  async generate(data, options = {}) {
    this.logger.info('Generating coverage report...');

    try {
      const {
        summary,
        gaps,
        recommendations,
        thresholds,
        format = REPORT_FORMAT.HTML
      } = data;

      const reportData = this.processCoverageData(data);

      let content;
      let filePath;

      switch (format) {
        case REPORT_FORMAT.HTML:
          content = this.generateHTMLReport(reportData);
          filePath = options.outputPath || `./reports/coverage-report-${Date.now()}.html`;
          break;

        case REPORT_FORMAT.MARKDOWN:
          content = this.generateMarkdownReport(reportData);
          filePath = options.outputPath || `./reports/coverage-report-${Date.now()}.md`;
          break;

        case REPORT_FORMAT.JSON:
          content = this.toJSON(reportData);
          filePath = options.outputPath || `./reports/coverage-report-${Date.now()}.json`;
          break;

        default:
          content = this.generateTextReport(reportData);
          filePath = options.outputPath || `./reports/coverage-report-${Date.now()}.txt`;
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
      this.logger.error(`Failed to generate coverage report: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process coverage data
   * @param {Object} data - Coverage data
   * @returns {Object} Processed data
   */
  processCoverageData(data) {
    const {
      summary = {},
      gaps = [],
      recommendations = [],
      thresholds = {}
    } = data;

    return {
      summary: {
        files: summary.files || 0,
        lines: summary.lines || { total: 0, covered: 0, pct: 0 },
        functions: summary.functions || { total: 0, covered: 0, pct: 0 },
        statements: summary.statements || { total: 0, covered: 0, pct: 0 },
        branches: summary.branches || { total: 0, covered: 0, pct: 0 }
      },
      thresholds: {
        lines: thresholds.LINES || 80,
        functions: thresholds.FUNCTIONS || 80,
        branches: thresholds.BRANCHES || 75,
        statements: thresholds.STATEMENTS || 80
      },
      gaps: this.categorizeGaps(gaps),
      recommendations: this.prioritizeRecommendations(recommendations),
      overall: this.calculateOverallCoverage(summary)
    };
  }

  /**
   * Categorize gaps by type
   * @param {Array} gaps - Coverage gaps
   * @returns {Object} Categorized gaps
   */
  categorizeGaps(gaps) {
    const categorized = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      byType: {}
    };

    gaps.forEach(gap => {
      // By severity
      const severity = gap.severity || 'medium';
      if (categorized[severity]) {
        categorized[severity].push(gap);
      }

      // By type
      const type = gap.type || 'unknown';
      if (!categorized.byType[type]) {
        categorized.byType[type] = [];
      }
      categorized.byType[type].push(gap);
    });

    return categorized;
  }

  /**
   * Prioritize recommendations
   * @param {Array} recommendations - Recommendations
   * @returns {Array} Prioritized recommendations
   */
  prioritizeRecommendations(recommendations) {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

    return recommendations.sort((a, b) => {
      return (priorityOrder[a.priority] || 5) - (priorityOrder[b.priority] || 5);
    });
  }

  /**
   * Calculate overall coverage
   * @param {Object} summary - Coverage summary
   * @returns {number} Overall coverage percentage
   */
  calculateOverallCoverage(summary) {
    if (!summary) return 0;

    const metrics = [
      summary.lines?.pct || 0,
      summary.functions?.pct || 0,
      summary.branches?.pct || 0,
      summary.statements?.pct || 0
    ];

    return metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
  }

  /**
   * Generate HTML report
   * @param {Object} data - Processed data
   * @returns {string} HTML report
   */
  generateHTMLReport(data) {
    const { summary, thresholds, gaps, recommendations, overall } = data;

    const content = `
      ${this.generateOverviewSection(summary, overall, thresholds)}
      ${this.generateMetricsSection(summary, thresholds)}
      ${gaps.critical.length + gaps.high.length > 0 ? this.generateGapsSection(gaps) : ''}
      ${this.generateRecommendationsSection(recommendations)}
    `;

    return this.generateHTMLTemplate('Coverage Report', content);
  }

  /**
   * Generate overview section
   * @param {Object} summary - Summary
   * @param {number} overall - Overall coverage
   * @param {Object} thresholds - Thresholds
   * @returns {string} HTML section
   */
  generateOverviewSection(summary, overall, thresholds) {
    const overallColor = overall >= 80 ? '#2ecc71' : overall >= 60 ? '#f39c12' : '#e74c3c';
    const status = overall >= 80 ? 'Excellent' : overall >= 60 ? 'Good' : 'Needs Improvement';

    return `
      <section class="overview">
        <h2>Coverage Overview</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
          ${this.generateMetricCard('Overall Coverage', this.formatPercentage(overall, 1), { color: overallColor, subtext: status })}
          ${this.generateMetricCard('Files Covered', summary.files)}
          ${this.generateMetricCard('Lines Coverage', this.formatPercentage(summary.lines.pct, 1), {
            color: this.getCoverageColor(summary.lines.pct, thresholds.lines),
            subtext: `${this.formatNumber(summary.lines.covered)}/${this.formatNumber(summary.lines.total)}`
          })}
          ${this.generateMetricCard('Functions Coverage', this.formatPercentage(summary.functions.pct, 1), {
            color: this.getCoverageColor(summary.functions.pct, thresholds.functions),
            subtext: `${this.formatNumber(summary.functions.covered)}/${this.formatNumber(summary.functions.total)}`
          })}
          ${this.generateMetricCard('Branches Coverage', this.formatPercentage(summary.branches.pct, 1), {
            color: this.getCoverageColor(summary.branches.pct, thresholds.branches),
            subtext: `${this.formatNumber(summary.branches.covered)}/${this.formatNumber(summary.branches.total)}`
          })}
        </div>
        ${this.generateProgressBar(overall, `${overall.toFixed(1)}% overall coverage`)}
      </section>
    `;
  }

  /**
   * Get coverage color based on threshold
   * @param {number} coverage - Coverage percentage
   * @param {number} threshold - Threshold
   * @returns {string} Color
   */
  getCoverageColor(coverage, threshold) {
    if (coverage >= threshold) return '#2ecc71';
    if (coverage >= threshold * 0.8) return '#f39c12';
    return '#e74c3c';
  }

  /**
   * Generate metrics section
   * @param {Object} summary - Summary
   * @param {Object} thresholds - Thresholds
   * @returns {string} HTML section
   */
  generateMetricsSection(summary, thresholds) {
    const metrics = [
      {
        name: 'Lines',
        coverage: summary.lines.pct,
        covered: summary.lines.covered,
        total: summary.lines.total,
        threshold: thresholds.lines
      },
      {
        name: 'Functions',
        coverage: summary.functions.pct,
        covered: summary.functions.covered,
        total: summary.functions.total,
        threshold: thresholds.functions
      },
      {
        name: 'Branches',
        coverage: summary.branches.pct,
        covered: summary.branches.covered,
        total: summary.branches.total,
        threshold: thresholds.branches
      },
      {
        name: 'Statements',
        coverage: summary.statements.pct,
        covered: summary.statements.covered,
        total: summary.statements.total,
        threshold: thresholds.statements
      }
    ];

    const rows = metrics.map(m => {
      const status = m.coverage >= m.threshold ? 'Pass' : 'Fail';
      const statusClass = m.coverage >= m.threshold ? 'status-pass' : 'status-fail';

      return [
        m.name,
        `${this.formatNumber(m.covered)}/${this.formatNumber(m.total)}`,
        this.formatPercentage(m.coverage, 2),
        this.formatPercentage(m.threshold, 0),
        `<span class="${statusClass}">${status}</span>`
      ];
    });

    return `
      <section class="metrics">
        <h2>Coverage Metrics</h2>
        ${this.generateTable(
          ['Metric', 'Covered/Total', 'Coverage', 'Threshold', 'Status'],
          rows
        )}
      </section>
    `;
  }

  /**
   * Generate gaps section
   * @param {Object} gaps - Coverage gaps
   * @returns {string} HTML section
   */
  generateGapsSection(gaps) {
    const criticalAndHigh = [...gaps.critical, ...gaps.high];

    const gapItems = criticalAndHigh.map(gap => {
      const severityClass = `severity-${gap.severity}`;
      const color = gap.severity === 'critical' ? '#c0392b' :
                   gap.severity === 'high' ? '#e74c3c' : '#f39c12';

      return `
        <div class="gap-item" style="background: #fff; border-left: 4px solid ${color}; padding: 15px; margin: 10px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0; color: #2c3e50;">${this.escapeHTML(gap.file)}</h4>
            <span class="${severityClass}" style="text-transform: uppercase; font-size: 0.8em; font-weight: 600;">${gap.severity}</span>
          </div>
          <div style="color: #666; font-size: 0.9em;">
            <strong>${gap.type.replace(/_/g, ' ')}:</strong>
            ${this.formatPercentage(gap.actual, 1)} (threshold: ${this.formatPercentage(gap.threshold, 0)})
            - ${gap.uncovered} uncovered
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="gaps">
        <h2>Coverage Gaps (${criticalAndHigh.length})</h2>
        <p style="color: #777; margin-bottom: 15px;">Critical and high severity coverage gaps requiring attention</p>
        ${gapItems}
      </section>
    `;
  }

  /**
   * Generate recommendations section
   * @param {Array} recommendations - Recommendations
   * @returns {string} HTML section
   */
  generateRecommendationsSection(recommendations) {
    const recItems = recommendations.slice(0, 10).map((rec, index) => {
      const priorityClass = `severity-${rec.priority}`;

      return `
        <div class="recommendation" style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="margin: 0; color: #2c3e50;">${index + 1}. ${this.escapeHTML(rec.file)}</h4>
            <span class="${priorityClass}" style="text-transform: uppercase; font-size: 0.8em; font-weight: 600;">${rec.priority}</span>
          </div>
          <div style="color: #666; font-size: 0.9em; margin-bottom: 10px;">
            <strong>Gaps:</strong> ${rec.gaps} | <strong>Priority:</strong> ${rec.priority}
          </div>
          <div style="background: white; padding: 10px; border-radius: 4px;">
            <strong>Actions:</strong>
            <ul style="margin: 5px 0 0 20px;">
              ${rec.actions.map(action => `<li>${this.escapeHTML(action.description)}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="recommendations">
        <h2>Recommendations (Top ${Math.min(10, recommendations.length)})</h2>
        <p style="color: #777; margin-bottom: 15px;">Prioritized actions to improve coverage</p>
        ${recItems}
      </section>
    `;
  }

  /**
   * Generate markdown report
   * @param {Object} data - Processed data
   * @returns {string} Markdown report
   */
  generateMarkdownReport(data) {
    const { summary, thresholds, gaps, recommendations, overall } = data;

    const content = `
## Coverage Overview

- **Overall Coverage:** ${this.formatPercentage(overall, 1)}
- **Files:** ${summary.files}

### Metrics

| Metric | Covered/Total | Coverage | Threshold | Status |
|--------|---------------|----------|-----------|--------|
| Lines | ${summary.lines.covered}/${summary.lines.total} | ${this.formatPercentage(summary.lines.pct)} | ${this.formatPercentage(thresholds.lines, 0)} | ${summary.lines.pct >= thresholds.lines ? '✅' : '❌'} |
| Functions | ${summary.functions.covered}/${summary.functions.total} | ${this.formatPercentage(summary.functions.pct)} | ${this.formatPercentage(thresholds.functions, 0)} | ${summary.functions.pct >= thresholds.functions ? '✅' : '❌'} |
| Branches | ${summary.branches.covered}/${summary.branches.total} | ${this.formatPercentage(summary.branches.pct)} | ${this.formatPercentage(thresholds.branches, 0)} | ${summary.branches.pct >= thresholds.branches ? '✅' : '❌'} |
| Statements | ${summary.statements.covered}/${summary.statements.total} | ${this.formatPercentage(summary.statements.pct)} | ${this.formatPercentage(thresholds.statements, 0)} | ${summary.statements.pct >= thresholds.statements ? '✅' : '❌'} |

${gaps.critical.length + gaps.high.length > 0 ? `
## Coverage Gaps (${gaps.critical.length + gaps.high.length})

${[...gaps.critical, ...gaps.high].map(gap => `
### ${gap.file} (${gap.severity})

- **Type:** ${gap.type.replace(/_/g, ' ')}
- **Actual:** ${this.formatPercentage(gap.actual)}
- **Threshold:** ${this.formatPercentage(gap.threshold)}
- **Uncovered:** ${gap.uncovered}
`).join('\n')}
` : ''}

## Recommendations (Top ${Math.min(10, recommendations.length)})

${recommendations.slice(0, 10).map((rec, i) => `
### ${i + 1}. ${rec.file} (${rec.priority})

**Gaps:** ${rec.gaps}

**Actions:**
${rec.actions.map(a => `- ${a.description}`).join('\n')}
`).join('\n')}
`;

    return this.generateMarkdownDocument('Coverage Report', content);
  }

  /**
   * Generate text report
   * @param {Object} data - Processed data
   * @returns {string} Text report
   */
  generateTextReport(data) {
    const { summary, thresholds, gaps, overall } = data;

    const lines = [
      '='.repeat(60),
      'COVERAGE REPORT',
      '='.repeat(60),
      '',
      'OVERVIEW',
      '-'.repeat(60),
      `Overall Coverage: ${this.formatPercentage(overall, 1)}`,
      `Files:            ${summary.files}`,
      '',
      'METRICS',
      '-'.repeat(60),
      `Lines:      ${this.formatPercentage(summary.lines.pct)} (${summary.lines.covered}/${summary.lines.total}) - Threshold: ${this.formatPercentage(thresholds.lines, 0)}`,
      `Functions:  ${this.formatPercentage(summary.functions.pct)} (${summary.functions.covered}/${summary.functions.total}) - Threshold: ${this.formatPercentage(thresholds.functions, 0)}`,
      `Branches:   ${this.formatPercentage(summary.branches.pct)} (${summary.branches.covered}/${summary.branches.total}) - Threshold: ${this.formatPercentage(thresholds.branches, 0)}`,
      `Statements: ${this.formatPercentage(summary.statements.pct)} (${summary.statements.covered}/${summary.statements.total}) - Threshold: ${this.formatPercentage(thresholds.statements, 0)}`
    ];

    const criticalAndHigh = [...gaps.critical, ...gaps.high];
    if (criticalAndHigh.length > 0) {
      lines.push('', 'COVERAGE GAPS', '-'.repeat(60));
      criticalAndHigh.forEach(gap => {
        lines.push(`[${gap.severity.toUpperCase()}] ${gap.file}`);
        lines.push(`  ${gap.type}: ${this.formatPercentage(gap.actual)} (threshold: ${this.formatPercentage(gap.threshold)})`);
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

export function getCoverageReportGenerator() {
  if (!generatorInstance) {
    generatorInstance = new CoverageReportGenerator();
  }
  return generatorInstance;
}
