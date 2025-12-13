/**
 * Fix Suggestion Generator - Automated Fix Suggestions
 *
 * Phase 7.5: Report Generator
 * Generates automated fix suggestions for test failures and issues
 */

import { BaseReportGenerator, REPORT_FORMAT, REPORT_TYPE } from './base-report-generator.js';

/**
 * Fix confidence levels
 */
export const FIX_CONFIDENCE = {
  HIGH: 'high',       // 80-100% confidence
  MEDIUM: 'medium',   // 50-79% confidence
  LOW: 'low'          // <50% confidence
};

/**
 * Fix types
 */
export const FIX_TYPE = {
  CODE_CHANGE: 'code_change',
  TEST_UPDATE: 'test_update',
  CONFIGURATION: 'configuration',
  DEPENDENCY: 'dependency',
  REFACTOR: 'refactor'
};

/**
 * FixSuggestionGenerator
 * Generates automated fix suggestions
 */
export class FixSuggestionGenerator extends BaseReportGenerator {
  constructor() {
    super('FixSuggestionGenerator', REPORT_TYPE.FIX_SUGGESTION);
  }

  /**
   * Generate fix suggestions
   * @param {Object} data - Issue data
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated suggestions
   */
  async generate(data, options = {}) {
    this.logger.info('Generating fix suggestions...');

    try {
      const {
        failedTests = [],
        flakyTests = [],
        coverageGaps = [],
        performanceIssues = [],
        bugs = [],
        format = REPORT_FORMAT.HTML
      } = data;

      const reportData = this.processIssuesAndGenerateSuggestions(data);

      let content;
      let filePath;

      switch (format) {
        case REPORT_FORMAT.HTML:
          content = this.generateHTMLReport(reportData);
          filePath = options.outputPath || `./reports/fix-suggestions-${Date.now()}.html`;
          break;

        case REPORT_FORMAT.MARKDOWN:
          content = this.generateMarkdownReport(reportData);
          filePath = options.outputPath || `./reports/fix-suggestions-${Date.now()}.md`;
          break;

        case REPORT_FORMAT.JSON:
          content = this.toJSON(reportData);
          filePath = options.outputPath || `./reports/fix-suggestions-${Date.now()}.json`;
          break;

        default:
          content = this.generateTextReport(reportData);
          filePath = options.outputPath || `./reports/fix-suggestions-${Date.now()}.txt`;
      }

      if (!options.dryRun) {
        this.saveReport(content, filePath, format);
      }

      return {
        success: true,
        filePath,
        format,
        suggestions: reportData.suggestions,
        summary: reportData.summary
      };
    } catch (error) {
      this.logger.error(`Failed to generate fix suggestions: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Process issues and generate suggestions
   * @param {Object} data - Issue data
   * @returns {Object} Processed data with suggestions
   */
  processIssuesAndGenerateSuggestions(data) {
    const suggestions = [];

    // Generate suggestions for failed tests
    (data.failedTests || []).forEach(test => {
      const suggestion = this.generateSuggestionForFailedTest(test);
      if (suggestion) suggestions.push(suggestion);
    });

    // Generate suggestions for flaky tests
    (data.flakyTests || []).forEach(test => {
      const suggestion = this.generateSuggestionForFlakyTest(test);
      if (suggestion) suggestions.push(suggestion);
    });

    // Generate suggestions for coverage gaps
    (data.coverageGaps || []).forEach(gap => {
      const suggestion = this.generateSuggestionForCoverageGap(gap);
      if (suggestion) suggestions.push(suggestion);
    });

    // Generate suggestions for performance issues
    (data.performanceIssues || []).forEach(issue => {
      const suggestion = this.generateSuggestionForPerformanceIssue(issue);
      if (suggestion) suggestions.push(suggestion);
    });

    // Sort by confidence (high to low)
    const confidenceOrder = { high: 0, medium: 1, low: 2 };
    suggestions.sort((a, b) => confidenceOrder[a.confidence] - confidenceOrder[b.confidence]);

    const summary = {
      total: suggestions.length,
      byConfidence: {
        high: suggestions.filter(s => s.confidence === FIX_CONFIDENCE.HIGH).length,
        medium: suggestions.filter(s => s.confidence === FIX_CONFIDENCE.MEDIUM).length,
        low: suggestions.filter(s => s.confidence === FIX_CONFIDENCE.LOW).length
      },
      byType: this.groupByType(suggestions)
    };

    return {
      suggestions,
      summary,
      metadata: {
        generatedAt: new Date().toISOString(),
        generator: this.name
      }
    };
  }

  /**
   * Generate suggestion for failed test
   * @param {Object} test - Failed test
   * @returns {Object} Fix suggestion
   */
  generateSuggestionForFailedTest(test) {
    const error = test.error || '';
    const errorLower = error.toLowerCase();

    // Analyze error message
    let fixType = FIX_TYPE.TEST_UPDATE;
    let confidence = FIX_CONFIDENCE.MEDIUM;
    let steps = [];
    let codeExample = null;

    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      confidence = FIX_CONFIDENCE.HIGH;
      steps = [
        'Increase test timeout configuration',
        'Check for infinite loops or blocking operations',
        'Add proper async/await handling',
        'Consider mocking slow dependencies'
      ];
      codeExample = `// Increase timeout
test('slow test', async () => {
  // ... test code
}, 10000); // 10 second timeout`;
    } else if (errorLower.includes('undefined') || errorLower.includes('null')) {
      confidence = FIX_CONFIDENCE.HIGH;
      fixType = FIX_TYPE.CODE_CHANGE;
      steps = [
        'Add null/undefined checks',
        'Initialize variables properly',
        'Add optional chaining (?.) where appropriate',
        'Verify data is loaded before accessing'
      ];
      codeExample = `// Add null check
if (data && data.property) {
  // Use data.property
}

// Or use optional chaining
const value = data?.property?.nested;`;
    } else if (errorLower.includes('expected') && errorLower.includes('received')) {
      confidence = FIX_CONFIDENCE.HIGH;
      steps = [
        'Review expected vs actual values',
        'Update assertion to match actual behavior',
        'Verify test logic matches implementation',
        'Check for timing issues in async code'
      ];
    } else if (errorLower.includes('cannot find module') || errorLower.includes('module not found')) {
      confidence = FIX_CONFIDENCE.HIGH;
      fixType = FIX_TYPE.DEPENDENCY;
      steps = [
        'Install missing dependency: npm install <package>',
        'Verify import path is correct',
        'Check package.json for missing dependencies',
        'Clear node_modules and reinstall if needed'
      ];
    } else {
      steps = [
        'Review test error message carefully',
        'Debug test to identify root cause',
        'Verify test setup and teardown',
        'Check for environment-specific issues'
      ];
    }

    return {
      id: `FIX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      issue: `Failed test: ${test.name}`,
      type: fixType,
      confidence,
      priority: 'high',
      description: `Test "${test.name}" is failing`,
      errorDetails: error,
      suggestedFix: {
        steps,
        codeExample
      },
      affectedFiles: test.file ? [test.file] : [],
      estimatedEffort: this.estimateEffort(confidence, steps.length),
      verificationSteps: [
        'Run the test again',
        'Verify test passes consistently',
        'Check for side effects in other tests'
      ]
    };
  }

  /**
   * Generate suggestion for flaky test
   * @param {Object} test - Flaky test
   * @returns {Object} Fix suggestion
   */
  generateSuggestionForFlakyTest(test) {
    const pattern = test.pattern || 'unknown';
    let steps = [];
    let codeExample = null;

    switch (pattern) {
      case 'timing':
        steps = [
          'Replace hard-coded delays with proper waits',
          'Use waitFor() utilities for async operations',
          'Add explicit synchronization points',
          'Avoid race conditions in test setup'
        ];
        codeExample = `// Instead of setTimeout
await waitFor(() => {
  expect(element).toBeVisible();
});`;
        break;

      case 'environment':
        steps = [
          'Ensure proper test isolation',
          'Reset state between test runs',
          'Mock environment-specific dependencies',
          'Add setup/teardown hooks'
        ];
        codeExample = `beforeEach(() => {
  // Reset state
  jest.clearAllMocks();
  localStorage.clear();
});`;
        break;

      case 'order':
        steps = [
          'Remove dependencies between tests',
          'Ensure each test can run independently',
          'Reset global state in beforeEach',
          'Use unique test data for each test'
        ];
        break;

      default:
        steps = [
          'Add proper async/await handling',
          'Increase test stability with retries',
          'Mock external dependencies',
          'Review test for non-deterministic behavior'
        ];
    }

    return {
      id: `FIX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      issue: `Flaky test: ${test.test}`,
      type: FIX_TYPE.TEST_UPDATE,
      confidence: FIX_CONFIDENCE.MEDIUM,
      priority: 'medium',
      description: `Test "${test.test}" is flaky (${test.flakinessScore}/100 score)`,
      errorDetails: `Pattern: ${pattern}, Pass rate: ${test.passCount}/${test.totalAttempts}`,
      suggestedFix: {
        steps,
        codeExample
      },
      affectedFiles: [],
      estimatedEffort: 'medium',
      verificationSteps: [
        'Run test 10+ times to verify stability',
        'Check for consistent pass rate',
        'Monitor in CI/CD pipeline'
      ]
    };
  }

  /**
   * Generate suggestion for coverage gap
   * @param {Object} gap - Coverage gap
   * @returns {Object} Fix suggestion
   */
  generateSuggestionForCoverageGap(gap) {
    const gapType = gap.type || '';
    let steps = [];
    let codeExample = null;

    if (gapType.includes('line')) {
      steps = [
        'Identify uncovered lines in the file',
        'Write tests for uncovered code paths',
        'Add edge case tests',
        'Test error handling paths'
      ];
      codeExample = `// Add test for uncovered line
test('handles error case', () => {
  expect(() => {
    functionThatThrows();
  }).toThrow('Expected error');
});`;
    } else if (gapType.includes('function')) {
      steps = [
        'List all uncovered functions',
        'Write unit tests for each function',
        'Test with various input scenarios',
        'Verify return values and side effects'
      ];
    } else if (gapType.includes('branch')) {
      steps = [
        'Identify uncovered conditional branches',
        'Write tests for if/else branches',
        'Test switch case statements',
        'Cover ternary operator branches'
      ];
      codeExample = `// Test both branches
test('when condition is true', () => {
  expect(fn(true)).toBe('yes');
});

test('when condition is false', () => {
  expect(fn(false)).toBe('no');
});`;
    }

    return {
      id: `FIX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      issue: `Coverage gap: ${gap.file}`,
      type: FIX_TYPE.TEST_UPDATE,
      confidence: FIX_CONFIDENCE.HIGH,
      priority: gap.severity === 'critical' ? 'high' : 'medium',
      description: `${gapType.replace(/_/g, ' ')} in ${gap.file}`,
      errorDetails: `Coverage: ${gap.actual}%, Threshold: ${gap.threshold}%, Uncovered: ${gap.uncovered}`,
      suggestedFix: {
        steps,
        codeExample
      },
      affectedFiles: [gap.file],
      estimatedEffort: this.estimateEffortForCoverage(gap.uncovered),
      verificationSteps: [
        'Run coverage report',
        'Verify coverage meets threshold',
        'Ensure tests are meaningful, not just for coverage'
      ]
    };
  }

  /**
   * Generate suggestion for performance issue
   * @param {Object} issue - Performance issue
   * @returns {Object} Fix suggestion
   */
  generateSuggestionForPerformanceIssue(issue) {
    const steps = [
      'Profile the test to identify bottlenecks',
      'Optimize test setup/teardown',
      'Use mocks instead of real dependencies',
      'Parallelize independent test operations',
      'Consider splitting slow test into smaller units'
    ];

    const codeExample = `// Mock slow dependency
jest.mock('./slowService', () => ({
  fetchData: jest.fn(() => Promise.resolve(mockData))
}));`;

    return {
      id: `FIX-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      issue: `Slow test: ${issue.test || issue.suite}`,
      type: FIX_TYPE.REFACTOR,
      confidence: FIX_CONFIDENCE.MEDIUM,
      priority: 'low',
      description: `Test is slower than threshold`,
      errorDetails: `Duration: ${issue.duration}ms, Threshold: ${issue.threshold}ms`,
      suggestedFix: {
        steps,
        codeExample
      },
      affectedFiles: [],
      estimatedEffort: 'medium',
      verificationSteps: [
        'Run test and measure duration',
        'Verify duration is under threshold',
        'Ensure test still validates correctly'
      ]
    };
  }

  /**
   * Group suggestions by type
   * @param {Array} suggestions - Suggestions
   * @returns {Object} Grouped suggestions
   */
  groupByType(suggestions) {
    const grouped = {};

    suggestions.forEach(s => {
      if (!grouped[s.type]) {
        grouped[s.type] = 0;
      }
      grouped[s.type]++;
    });

    return grouped;
  }

  /**
   * Estimate effort
   * @param {string} confidence - Confidence level
   * @param {number} stepCount - Number of steps
   * @returns {string} Effort estimate
   */
  estimateEffort(confidence, stepCount) {
    if (confidence === FIX_CONFIDENCE.HIGH && stepCount <= 2) return 'low';
    if (confidence === FIX_CONFIDENCE.HIGH && stepCount <= 4) return 'medium';
    return 'high';
  }

  /**
   * Estimate effort for coverage
   * @param {number} uncovered - Uncovered count
   * @returns {string} Effort estimate
   */
  estimateEffortForCoverage(uncovered) {
    if (uncovered < 10) return 'low';
    if (uncovered < 50) return 'medium';
    return 'high';
  }

  /**
   * Generate HTML report
   * @param {Object} data - Processed data
   * @returns {string} HTML report
   */
  generateHTMLReport(data) {
    const { suggestions, summary } = data;

    const content = `
      ${this.generateSummarySection(summary)}
      ${this.generateSuggestionsSection(suggestions)}
    `;

    return this.generateHTMLTemplate('Fix Suggestions', content);
  }

  /**
   * Generate summary section
   * @param {Object} summary - Summary
   * @returns {string} HTML section
   */
  generateSummarySection(summary) {
    return `
      <section class="summary">
        <h2>Fix Suggestions Summary</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0;">
          ${this.generateMetricCard('Total Suggestions', summary.total)}
          ${this.generateMetricCard('High Confidence', summary.byConfidence.high, { color: '#2ecc71' })}
          ${this.generateMetricCard('Medium Confidence', summary.byConfidence.medium, { color: '#f39c12' })}
          ${this.generateMetricCard('Low Confidence', summary.byConfidence.low, { color: '#95a5a6' })}
        </div>
      </section>
    `;
  }

  /**
   * Generate suggestions section
   * @param {Array} suggestions - Suggestions
   * @returns {string} HTML section
   */
  generateSuggestionsSection(suggestions) {
    const suggestionItems = suggestions.map((sug, index) => {
      const confidenceColor = sug.confidence === 'high' ? '#2ecc71' :
                              sug.confidence === 'medium' ? '#f39c12' : '#95a5a6';

      return `
        <div class="suggestion-item" style="background: #fff; border-left: 4px solid ${confidenceColor}; padding: 20px; margin: 15px 0; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
            <h3 style="margin: 0; color: #2c3e50;">${index + 1}. ${this.escapeHTML(sug.issue)}</h3>
            <div style="text-align: right;">
              <span style="background: ${confidenceColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 0.85em; font-weight: 600; text-transform: uppercase;">${sug.confidence}</span>
            </div>
          </div>

          <div style="color: #666; margin-bottom: 10px;">
            ${this.escapeHTML(sug.description)}
          </div>

          ${sug.errorDetails ? `
            <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin: 10px 0; font-family: monospace; font-size: 0.85em;">
              ${this.escapeHTML(sug.errorDetails)}
            </div>
          ` : ''}

          <div style="margin: 15px 0;">
            <h4 style="color: #2c3e50; margin: 10px 0;">Suggested Fix:</h4>
            <ol style="margin: 5px 0 5px 20px; line-height: 1.8;">
              ${sug.suggestedFix.steps.map(step => `<li>${this.escapeHTML(step)}</li>`).join('')}
            </ol>
          </div>

          ${sug.suggestedFix.codeExample ? `
            <div style="margin: 15px 0;">
              <h4 style="color: #2c3e50; margin: 10px 0;">Code Example:</h4>
              <pre style="background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 4px; overflow-x: auto;">${this.escapeHTML(sug.suggestedFix.codeExample)}</pre>
            </div>
          ` : ''}

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #e0e0e0;">
            <div>
              <span style="color: #777; font-size: 0.85em;">Type:</span>
              <strong>${sug.type.replace(/_/g, ' ')}</strong>
            </div>
            <div>
              <span style="color: #777; font-size: 0.85em;">Priority:</span>
              <strong>${sug.priority}</strong>
            </div>
            <div>
              <span style="color: #777; font-size: 0.85em;">Effort:</span>
              <strong>${sug.estimatedEffort}</strong>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <section class="suggestions">
        <h2>Fix Suggestions (${suggestions.length})</h2>
        ${suggestionItems}
      </section>
    `;
  }

  /**
   * Generate markdown report
   * @param {Object} data - Processed data
   * @returns {string} Markdown report
   */
  generateMarkdownReport(data) {
    const { suggestions, summary } = data;

    const content = `
## Fix Suggestions Summary

- **Total:** ${summary.total}
- **High Confidence:** ${summary.byConfidence.high}
- **Medium Confidence:** ${summary.byConfidence.medium}
- **Low Confidence:** ${summary.byConfidence.low}

## Suggestions

${suggestions.map((sug, i) => `
### ${i + 1}. ${sug.issue}

**Confidence:** ${sug.confidence} | **Priority:** ${sug.priority} | **Type:** ${sug.type} | **Effort:** ${sug.estimatedEffort}

${sug.description}

${sug.errorDetails ? `**Error Details:** \`${sug.errorDetails}\`` : ''}

**Suggested Fix:**

${sug.suggestedFix.steps.map((step, j) => `${j + 1}. ${step}`).join('\n')}

${sug.suggestedFix.codeExample ? `
**Code Example:**

\`\`\`javascript
${sug.suggestedFix.codeExample}
\`\`\`
` : ''}
`).join('\n---\n')}
`;

    return this.generateMarkdownDocument('Fix Suggestions', content);
  }

  /**
   * Generate text report
   * @param {Object} data - Processed data
   * @returns {string} Text report
   */
  generateTextReport(data) {
    const { suggestions, summary } = data;

    const lines = [
      '='.repeat(60),
      'FIX SUGGESTIONS',
      '='.repeat(60),
      '',
      'SUMMARY',
      '-'.repeat(60),
      `Total:          ${summary.total}`,
      `High Confidence: ${summary.byConfidence.high}`,
      `Medium:         ${summary.byConfidence.medium}`,
      `Low:            ${summary.byConfidence.low}`,
      '',
      'SUGGESTIONS',
      '-'.repeat(60)
    ];

    suggestions.forEach((sug, i) => {
      lines.push('');
      lines.push(`${i + 1}. ${sug.issue} [${sug.confidence.toUpperCase()}]`);
      lines.push(`   ${sug.description}`);
      lines.push(`   Type: ${sug.type} | Priority: ${sug.priority} | Effort: ${sug.estimatedEffort}`);
      lines.push('   Steps:');
      sug.suggestedFix.steps.forEach((step, j) => {
        lines.push(`     ${j + 1}. ${step}`);
      });
    });

    lines.push('', '='.repeat(60), `Generated: ${new Date().toLocaleString()}`);

    return lines.join('\n');
  }
}

/**
 * Get singleton instance
 */
let generatorInstance = null;

export function getFixSuggestionGenerator() {
  if (!generatorInstance) {
    generatorInstance = new FixSuggestionGenerator();
  }
  return generatorInstance;
}
