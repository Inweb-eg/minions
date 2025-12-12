/**
 * TestFailureAnalyzer - Parses test output and extracts failure information
 *
 * Supports multiple test frameworks:
 * - Jest (JavaScript/TypeScript)
 * - Flutter Test (Dart)
 * - Pytest (Python)
 */

import { createLogger } from '../../../../agents/foundation/common/logger.js';

const logger = createLogger('TestFailureAnalyzer');

export class TestFailureAnalyzer {
  constructor() {
    this.parsers = {
      jest: this.parseJestOutput.bind(this),
      flutter: this.parseFlutterOutput.bind(this),
      pytest: this.parsePytestOutput.bind(this),
      generic: this.parseGenericOutput.bind(this)
    };
  }

  /**
   * Analyze test output and extract failure details
   * @param {string} testOutput - Raw test output
   * @param {string} framework - Test framework (jest, flutter, pytest, or auto)
   * @returns {Object} Analyzed failure information
   */
  analyze(testOutput, framework = 'auto') {
    logger.info(`Analyzing test output (framework: ${framework})`);

    // Auto-detect framework if not specified
    if (framework === 'auto') {
      framework = this.detectFramework(testOutput);
      logger.info(`Auto-detected framework: ${framework}`);
    }

    const parser = this.parsers[framework] || this.parsers.generic;
    const failures = parser(testOutput);

    const result = {
      framework,
      totalFailures: failures.length,
      failures,
      summary: this.generateSummary(failures),
      timestamp: new Date().toISOString()
    };

    logger.info(`Found ${failures.length} test failures`);
    return result;
  }

  /**
   * Detect test framework from output
   */
  detectFramework(output) {
    if (output.includes('FAIL') && (output.includes('jest') || output.includes('Test Suites:'))) {
      return 'jest';
    }
    if (output.includes('flutter test') || output.includes('package:test/')) {
      return 'flutter';
    }
    if (output.includes('pytest') || output.includes('FAILED') && output.includes('::')) {
      return 'pytest';
    }
    return 'generic';
  }

  /**
   * Parse Jest test output
   */
  parseJestOutput(output) {
    const failures = [];
    const lines = output.split('\n');

    let currentFile = null;
    let currentTest = null;
    let currentError = [];
    let inFailure = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match test file failures: "FAIL src/__tests__/user.test.js"
      const failMatch = line.match(/FAIL\s+(.+\.(?:js|ts|jsx|tsx))/);
      if (failMatch) {
        currentFile = failMatch[1].trim();
      }

      // Match specific test failure with ● character: "● UserService › should create user"
      const bulletMatch = line.match(/●\s+(.+)/);
      if (bulletMatch) {
        // Save previous test if exists
        if (currentTest && currentTest.testName) {
          currentTest.error = currentError.join('\n').trim();
          failures.push({ ...currentTest });
        }

        currentTest = {
          file: currentFile || '',
          testName: bulletMatch[1].trim(),
          error: '',
          expected: '',
          received: '',
          location: { line: 0, column: 0, file: '' }
        };
        inFailure = true;
        currentError = [];
        continue;
      }

      // Also match ✕ character failures
      const crossMatch = line.match(/✕\s+(.+?)(?:\s+\((\d+)\s*ms\))?$/);
      if (crossMatch) {
        if (currentTest && currentTest.testName) {
          currentTest.error = currentError.join('\n').trim();
          failures.push({ ...currentTest });
        }

        currentTest = {
          file: currentFile || '',
          testName: crossMatch[1].trim(),
          error: '',
          expected: '',
          received: '',
          location: { line: 0, column: 0, file: '' }
        };
        inFailure = true;
        currentError = [];
        continue;
      }

      // Collect error details
      if (inFailure && currentTest) {
        currentError.push(line);

        // Match expected/received in various formats
        // Format: Expected: "john" or Expected: "john"
        const expectedMatch = line.match(/Expected[:\s]+["']?(.+?)["']?\s*$/i);
        const receivedMatch = line.match(/Received[:\s]+["']?(.+?)["']?\s*$/i);
        if (expectedMatch && !currentTest.expected) {
          currentTest.expected = expectedMatch[1].replace(/["']/g, '').trim();
        }
        if (receivedMatch && !currentTest.received) {
          currentTest.received = receivedMatch[1].replace(/["']/g, '').trim();
        }

        // Match file location: "at Object.<anonymous> (src/test.js:17:23)"
        const locationMatch = line.match(/at\s+.+?\((.+?):(\d+):(\d+)\)/);
        if (locationMatch && currentTest.location.line === 0) {
          currentTest.location = {
            file: locationMatch[1],
            line: parseInt(locationMatch[2]),
            column: parseInt(locationMatch[3])
          };
        }

        // Also match inline location: "> 17 |     expect(user.name).toBe('john');"
        const inlineMatch = line.match(/>\s*(\d+)\s*\|/);
        if (inlineMatch && currentTest.location.line === 0) {
          currentTest.location.line = parseInt(inlineMatch[1]);
          currentTest.location.file = currentFile || '';
        }
      }

      // End detection: "Test Suites:" line or next FAIL
      if (line.includes('Test Suites:') || (line.match(/FAIL\s+/) && currentTest)) {
        if (currentTest && currentTest.testName) {
          currentTest.error = currentError.join('\n').trim();
          failures.push({ ...currentTest });
          currentTest = null;
          inFailure = false;
          currentError = [];
        }
      }
    }

    // Add last failure if pending
    if (currentTest && currentTest.testName) {
      currentTest.error = currentError.join('\n').trim();
      failures.push(currentTest);
    }

    return failures;
  }

  /**
   * Parse Flutter test output
   */
  parseFlutterOutput(output) {
    const failures = [];
    const lines = output.split('\n');

    let currentFailure = null;
    let collectingError = false;

    for (const line of lines) {
      // Match test failure start
      const failMatch = line.match(/^\s*✗\s+(.+)/);
      if (failMatch) {
        if (currentFailure) {
          failures.push(currentFailure);
        }
        currentFailure = {
          file: '',
          testName: failMatch[1].trim(),
          error: '',
          expected: '',
          received: '',
          location: { line: 0, column: 0 }
        };
        collectingError = true;
        continue;
      }

      // Match file location
      const locationMatch = line.match(/(\S+\.dart):(\d+):(\d+)/);
      if (locationMatch && currentFailure) {
        currentFailure.file = locationMatch[1];
        currentFailure.location = {
          file: locationMatch[1],
          line: parseInt(locationMatch[2]),
          column: parseInt(locationMatch[3])
        };
      }

      // Collect error text
      if (collectingError && currentFailure) {
        if (line.trim().startsWith('Expected:')) {
          currentFailure.expected = line.replace('Expected:', '').trim();
        } else if (line.trim().startsWith('Actual:')) {
          currentFailure.received = line.replace('Actual:', '').trim();
        } else if (line.trim()) {
          currentFailure.error += line + '\n';
        }
      }

      // End of failure block
      if (line.includes('══════════════════') && currentFailure) {
        currentFailure.error = currentFailure.error.trim();
        failures.push(currentFailure);
        currentFailure = null;
        collectingError = false;
      }
    }

    if (currentFailure) {
      failures.push(currentFailure);
    }

    return failures;
  }

  /**
   * Parse Pytest output
   */
  parsePytestOutput(output) {
    const failures = [];
    const lines = output.split('\n');

    let currentFailure = null;
    let collectingError = false;

    for (const line of lines) {
      // Match FAILED test
      const failMatch = line.match(/FAILED\s+(.+?)::(.+?)(?:\s+-|$)/);
      if (failMatch) {
        if (currentFailure) {
          failures.push(currentFailure);
        }
        currentFailure = {
          file: failMatch[1],
          testName: failMatch[2],
          error: '',
          expected: '',
          received: '',
          location: { line: 0, column: 0 }
        };
        collectingError = true;
        continue;
      }

      // Match assertion error with location
      const assertMatch = line.match(/(.+\.py):(\d+):\s*(.+)/);
      if (assertMatch && currentFailure) {
        currentFailure.location = {
          file: assertMatch[1],
          line: parseInt(assertMatch[2]),
          column: 0
        };
      }

      // Collect error text
      if (collectingError && currentFailure) {
        if (line.includes('AssertionError') || line.includes('assert')) {
          currentFailure.error += line + '\n';
        }
      }

      // End on separator
      if (line.startsWith('=') && line.endsWith('=') && currentFailure) {
        currentFailure.error = currentFailure.error.trim();
        failures.push(currentFailure);
        currentFailure = null;
        collectingError = false;
      }
    }

    if (currentFailure) {
      failures.push(currentFailure);
    }

    return failures;
  }

  /**
   * Parse generic test output
   */
  parseGenericOutput(output) {
    const failures = [];
    const lines = output.split('\n');

    // Look for common failure patterns
    const failurePatterns = [
      /(?:FAIL|FAILED|ERROR|✗)\s*[:\-]?\s*(.+)/i,
      /AssertionError:\s*(.+)/i,
      /Error:\s*(.+)/i
    ];

    const locationPatterns = [
      /(\S+\.\w+):(\d+)(?::(\d+))?/,
      /at\s+(\S+):(\d+):(\d+)/
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const pattern of failurePatterns) {
        const match = line.match(pattern);
        if (match) {
          const failure = {
            file: '',
            testName: match[1].trim().substring(0, 100),
            error: '',
            expected: '',
            received: '',
            location: { line: 0, column: 0 }
          };

          // Look for location in nearby lines
          for (let j = i; j < Math.min(i + 10, lines.length); j++) {
            for (const locPattern of locationPatterns) {
              const locMatch = lines[j].match(locPattern);
              if (locMatch) {
                failure.file = locMatch[1];
                failure.location = {
                  file: locMatch[1],
                  line: parseInt(locMatch[2]) || 0,
                  column: parseInt(locMatch[3]) || 0
                };
                break;
              }
            }
            if (failure.file) break;
          }

          // Collect error context
          const errorLines = [];
          for (let j = i; j < Math.min(i + 5, lines.length); j++) {
            if (lines[j].trim()) {
              errorLines.push(lines[j]);
            }
          }
          failure.error = errorLines.join('\n');

          failures.push(failure);
          break;
        }
      }
    }

    return failures;
  }

  /**
   * Generate human-readable summary
   */
  generateSummary(failures) {
    if (failures.length === 0) {
      return 'No test failures detected.';
    }

    const fileGroups = {};
    for (const failure of failures) {
      const file = failure.file || 'unknown';
      if (!fileGroups[file]) {
        fileGroups[file] = [];
      }
      fileGroups[file].push(failure.testName);
    }

    const lines = [`${failures.length} test failure(s) detected:`];
    for (const [file, tests] of Object.entries(fileGroups)) {
      lines.push(`  ${file}: ${tests.length} failure(s)`);
      for (const test of tests.slice(0, 3)) {
        lines.push(`    - ${test}`);
      }
      if (tests.length > 3) {
        lines.push(`    ... and ${tests.length - 3} more`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Extract the most likely cause of failure
   */
  extractRootCause(failure) {
    const causes = [];

    // Check for common error patterns
    if (failure.error.includes('undefined') || failure.error.includes('null')) {
      causes.push('Null/undefined reference');
    }
    if (failure.error.includes('not a function')) {
      causes.push('Method not found');
    }
    if (failure.error.includes('Cannot read property') || failure.error.includes('Cannot read properties')) {
      causes.push('Property access on undefined');
    }
    if (failure.expected && failure.received) {
      causes.push(`Value mismatch: expected "${failure.expected}" but got "${failure.received}"`);
    }
    if (failure.error.includes('timeout') || failure.error.includes('Timeout')) {
      causes.push('Test timeout');
    }
    if (failure.error.includes('ENOENT') || failure.error.includes('not found')) {
      causes.push('Missing file or resource');
    }
    if (failure.error.includes('syntax') || failure.error.includes('SyntaxError')) {
      causes.push('Syntax error');
    }
    if (failure.error.includes('import') || failure.error.includes('require')) {
      causes.push('Module import error');
    }

    return causes.length > 0 ? causes : ['Unknown cause - manual investigation required'];
  }
}

// Singleton instance
let instance = null;

export function getTestFailureAnalyzer() {
  if (!instance) {
    instance = new TestFailureAnalyzer();
  }
  return instance;
}

export default TestFailureAnalyzer;
