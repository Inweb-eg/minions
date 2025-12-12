/**
 * CodeReviewer - AI-powered code review skill
 *
 * Analyzes code for:
 * - Code quality issues (complexity, duplication, style)
 * - Best practices violations
 * - Potential bugs and anti-patterns
 * - Security concerns
 * - Performance issues
 */

import fs from 'fs';
import path from 'path';
import { getEventBus } from '../../../../agents/foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../../agents/foundation/event-bus/eventTypes.js';
import { createLogger } from '../../../../agents/foundation/common/logger.js';

const logger = createLogger('CodeReviewer');

export class CodeReviewer {
  constructor(options = {}) {
    this.options = {
      maxFileSize: 100000, // 100KB
      maxComplexity: 10,
      maxFunctionLength: 50,
      maxFileLength: 500,
      enableSecurityChecks: true,
      enablePerformanceChecks: true,
      enableStyleChecks: true,
      ...options
    };

    this.eventBus = null;
    this.initialized = false;

    // Review rules categorized by type
    this.rules = {
      quality: [
        { name: 'long-function', check: this.checkLongFunction.bind(this) },
        { name: 'high-complexity', check: this.checkComplexity.bind(this) },
        { name: 'deep-nesting', check: this.checkDeepNesting.bind(this) },
        { name: 'duplicate-code', check: this.checkDuplicateCode.bind(this) },
        { name: 'dead-code', check: this.checkDeadCode.bind(this) },
        { name: 'magic-numbers', check: this.checkMagicNumbers.bind(this) }
      ],
      security: [
        { name: 'hardcoded-secrets', check: this.checkHardcodedSecrets.bind(this) },
        { name: 'sql-injection', check: this.checkSQLInjection.bind(this) },
        { name: 'xss-vulnerability', check: this.checkXSSVulnerability.bind(this) },
        { name: 'unsafe-regex', check: this.checkUnsafeRegex.bind(this) },
        { name: 'eval-usage', check: this.checkEvalUsage.bind(this) },
        { name: 'prototype-pollution', check: this.checkPrototypePollution.bind(this) }
      ],
      performance: [
        { name: 'n-plus-one', check: this.checkNPlusOneQuery.bind(this) },
        { name: 'memory-leak', check: this.checkMemoryLeak.bind(this) },
        { name: 'sync-in-async', check: this.checkSyncInAsync.bind(this) },
        { name: 'unoptimized-loop', check: this.checkUnoptimizedLoop.bind(this) }
      ],
      style: [
        { name: 'inconsistent-naming', check: this.checkInconsistentNaming.bind(this) },
        { name: 'missing-jsdoc', check: this.checkMissingJSDoc.bind(this) },
        { name: 'console-log', check: this.checkConsoleLog.bind(this) },
        { name: 'todo-fixme', check: this.checkTodoFixme.bind(this) }
      ]
    };
  }

  async initialize() {
    if (this.initialized) return;

    logger.info('Initializing CodeReviewer skill...');
    this.eventBus = getEventBus();

    if (this.eventBus) {
      // Subscribe to code generation events
      this.eventBus.subscribe(EventTypes.CODE_GENERATED, 'code-reviewer', async (data) => {
        try {
          if (data.files && data.files.length > 0) {
            await this.reviewFiles(data.files);
          }
        } catch (error) {
          logger.error('Error handling CODE_GENERATED event:', error);
        }
      });

      this.eventBus.subscribe(EventTypes.REVIEW_REQUESTED, 'code-reviewer', async (data) => {
        try {
          const result = await this.review(data);
          this.eventBus.publish(EventTypes.REVIEW_COMPLETED, result);
        } catch (error) {
          logger.error('Error handling REVIEW_REQUESTED event:', error);
          this.eventBus.publish(EventTypes.REVIEW_COMPLETED, {
            success: false,
            error: error.message
          });
        }
      });

      // Publish skill ready event
      this.eventBus.publish(EventTypes.SKILL_READY, {
        skill: 'code-reviewer',
        timestamp: new Date().toISOString()
      });
    }

    this.initialized = true;
    logger.info('CodeReviewer initialized');
  }

  /**
   * Review code (file path, content, or diff)
   */
  async review(input) {
    const startTime = Date.now();
    let code, filePath, language;

    if (typeof input === 'string') {
      // Could be file path or code content
      if (fs.existsSync(input)) {
        filePath = input;
        code = fs.readFileSync(input, 'utf-8');
        language = this.detectLanguage(filePath);
      } else {
        code = input;
        language = this.detectLanguageFromContent(code);
      }
    } else {
      filePath = input.file || input.path;
      code = input.content || input.code;
      language = input.language || this.detectLanguage(filePath);

      if (!code && filePath && fs.existsSync(filePath)) {
        code = fs.readFileSync(filePath, 'utf-8');
      }
    }

    if (!code) {
      return { success: false, error: 'No code to review' };
    }

    logger.info(`Reviewing ${filePath || 'code'} (${language})`);

    const issues = [];
    const lines = code.split('\n');

    // Run all applicable rules
    for (const [category, categoryRules] of Object.entries(this.rules)) {
      if (category === 'security' && !this.options.enableSecurityChecks) continue;
      if (category === 'performance' && !this.options.enablePerformanceChecks) continue;
      if (category === 'style' && !this.options.enableStyleChecks) continue;

      for (const rule of categoryRules) {
        try {
          const ruleIssues = await rule.check(code, lines, language, filePath);
          if (ruleIssues && ruleIssues.length > 0) {
            issues.push(...ruleIssues.map(issue => ({
              ...issue,
              rule: rule.name,
              category,
              file: filePath
            })));
          }
        } catch (error) {
          logger.warn(`Rule ${rule.name} failed: ${error.message}`);
        }
      }
    }

    // Sort by severity
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    const result = {
      success: true,
      file: filePath,
      language,
      issues,
      summary: this.generateSummary(issues),
      metrics: this.calculateMetrics(code, lines, issues),
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Publish quality score event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.QUALITY_SCORED, {
        file: filePath,
        score: result.metrics.qualityScore,
        issues: issues.length
      });
    }

    return result;
  }

  /**
   * Review multiple files
   */
  async reviewFiles(files) {
    const results = [];

    for (const file of files) {
      const result = await this.review(file);
      results.push(result);
    }

    return {
      files: results,
      totalIssues: results.reduce((sum, r) => sum + r.issues.length, 0),
      summary: this.aggregateSummary(results)
    };
  }

  /**
   * Review git diff
   */
  async reviewDiff(diff) {
    const issues = [];
    const changedFiles = this.parseDiff(diff);

    for (const file of changedFiles) {
      if (file.additions.length > 0) {
        const fileIssues = await this.review({
          file: file.path,
          content: file.additions.join('\n')
        });
        issues.push(...fileIssues.issues);
      }
    }

    return {
      success: true,
      issues,
      changedFiles: changedFiles.length
    };
  }

  // ==================== Quality Checks ====================

  checkLongFunction(code, lines, language) {
    const issues = [];
    const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\(|(?:async\s+)?(?:\w+)\s*\([^)]*\)\s*(?:=>|{))/;

    let functionStarts = [];

    lines.forEach((line, index) => {
      // Use non-global regex to avoid lastIndex issues
      if (functionPattern.test(line)) {
        functionStarts.push(index);
      }
    });

    // Simple heuristic: count lines until closing brace at same indent
    for (const start of functionStarts) {
      let depth = 0;
      let functionLength = 0;
      let foundStart = false;

      for (let i = start; i < lines.length && i < start + 200; i++) {
        const line = lines[i];
        if (line.includes('{')) { depth++; foundStart = true; }
        if (line.includes('}')) depth--;
        functionLength++;

        if (foundStart && depth === 0) break;
      }

      if (functionLength > this.options.maxFunctionLength) {
        issues.push({
          severity: 'medium',
          line: start + 1,
          message: `Function is too long (${functionLength} lines). Consider breaking it down.`,
          suggestion: 'Extract sub-functions for better readability and maintainability.'
        });
      }
    }

    return issues;
  }

  checkComplexity(code, lines, language) {
    const issues = [];

    // Count decision points (if, else, for, while, switch, case, &&, ||, ?:)
    const complexityPatterns = [
      /\bif\s*\(/g, /\belse\b/g, /\bfor\s*\(/g, /\bwhile\s*\(/g,
      /\bswitch\s*\(/g, /\bcase\s+/g, /&&/g, /\|\|/g, /\?.*:/g
    ];

    let totalComplexity = 0;
    for (const pattern of complexityPatterns) {
      const matches = code.match(pattern);
      totalComplexity += matches ? matches.length : 0;
    }

    const linesOfCode = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
    const complexityPerLine = totalComplexity / Math.max(linesOfCode, 1);

    if (complexityPerLine > 0.3) {
      issues.push({
        severity: 'high',
        line: 1,
        message: `High cyclomatic complexity detected (${totalComplexity} decision points).`,
        suggestion: 'Simplify logic, extract methods, or use early returns.'
      });
    }

    return issues;
  }

  checkDeepNesting(code, lines, language) {
    const issues = [];
    const maxDepth = 4;

    lines.forEach((line, index) => {
      const indent = line.match(/^(\s*)/)[1].length;
      const depth = Math.floor(indent / 2); // Assuming 2-space indent

      if (depth > maxDepth && line.trim()) {
        issues.push({
          severity: 'medium',
          line: index + 1,
          message: `Deep nesting detected (level ${depth}).`,
          suggestion: 'Use early returns, extract functions, or flatten conditionals.'
        });
      }
    });

    // Deduplicate consecutive deep nesting warnings
    return issues.filter((issue, i, arr) =>
      i === 0 || Math.abs(issue.line - arr[i - 1].line) > 3
    );
  }

  checkDuplicateCode(code, lines, language) {
    const issues = [];
    const minDuplicateLines = 5;
    const seen = new Map();

    for (let i = 0; i < lines.length - minDuplicateLines; i++) {
      const block = lines.slice(i, i + minDuplicateLines)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('//'))
        .join('|');

      if (block.length > 50) { // Minimum meaningful block
        if (seen.has(block)) {
          issues.push({
            severity: 'low',
            line: i + 1,
            message: `Possible duplicate code (similar to line ${seen.get(block)}).`,
            suggestion: 'Consider extracting common code into a reusable function.'
          });
        } else {
          seen.set(block, i + 1);
        }
      }
    }

    return issues;
  }

  checkDeadCode(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      // Unreachable code after return/throw
      if (index > 0) {
        const prevLine = lines[index - 1].trim();
        const currLine = line.trim();

        if ((prevLine.startsWith('return ') || prevLine.startsWith('throw ')) &&
          currLine && !currLine.startsWith('}') && !currLine.startsWith('//')) {
          issues.push({
            severity: 'medium',
            line: index + 1,
            message: 'Potentially unreachable code after return/throw.',
            suggestion: 'Remove unreachable code or fix control flow.'
          });
        }
      }

      // Commented out code blocks
      if (line.trim().startsWith('//') && line.includes('(') && line.includes(')')) {
        issues.push({
          severity: 'info',
          line: index + 1,
          message: 'Commented-out code detected.',
          suggestion: 'Remove commented code or document why it\'s kept.'
        });
      }
    });

    return issues;
  }

  checkMagicNumbers(code, lines, language) {
    const issues = [];
    const magicNumberPattern = /[^a-zA-Z_\d](\d{2,})[^a-zA-Z_\d]/g;
    const allowedNumbers = ['0', '1', '2', '10', '100', '1000', '60', '24', '365'];

    lines.forEach((line, index) => {
      // Skip comments and imports
      if (line.trim().startsWith('//') || line.includes('import') || line.includes('require')) {
        return;
      }

      let match;
      while ((match = magicNumberPattern.exec(line)) !== null) {
        const num = match[1];
        if (!allowedNumbers.includes(num) && !/^\d{4}$/.test(num)) { // Allow years
          issues.push({
            severity: 'low',
            line: index + 1,
            message: `Magic number ${num} detected.`,
            suggestion: 'Extract to a named constant for clarity.'
          });
        }
      }
    });

    return issues.slice(0, 5); // Limit magic number warnings
  }

  // ==================== Security Checks ====================

  checkHardcodedSecrets(code, lines, language) {
    const issues = [];
    const secretPatterns = [
      { pattern: /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]+['"]/gi, type: 'password' },
      { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"][^'"]+['"]/gi, type: 'API key' },
      { pattern: /(?:secret|token)\s*[:=]\s*['"][^'"]{8,}['"]/gi, type: 'secret/token' },
      { pattern: /(?:aws|azure|gcp)[_-]?(?:key|secret|token)\s*[:=]\s*['"][^'"]+['"]/gi, type: 'cloud credential' },
      { pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, type: 'private key' },
      { pattern: /(?:bearer|authorization)\s*[:=]\s*['"][^'"]+['"]/gi, type: 'auth token' }
    ];

    lines.forEach((line, index) => {
      for (const { pattern, type } of secretPatterns) {
        if (pattern.test(line)) {
          issues.push({
            severity: 'critical',
            line: index + 1,
            message: `Potential hardcoded ${type} detected.`,
            suggestion: 'Use environment variables or a secrets manager.'
          });
        }
        pattern.lastIndex = 0; // Reset regex
      }
    });

    return issues;
  }

  checkSQLInjection(code, lines, language) {
    const issues = [];
    const sqlPatterns = [
      /(?:query|execute|raw)\s*\(\s*['"`].*\$\{/gi,
      /(?:query|execute|raw)\s*\(\s*['"`].*\+\s*\w+/gi,
      /\.query\s*\(\s*`[^`]*\$\{/gi
    ];

    lines.forEach((line, index) => {
      for (const pattern of sqlPatterns) {
        if (pattern.test(line)) {
          issues.push({
            severity: 'critical',
            line: index + 1,
            message: 'Potential SQL injection vulnerability (string interpolation in query).',
            suggestion: 'Use parameterized queries or an ORM.'
          });
        }
        pattern.lastIndex = 0;
      }
    });

    return issues;
  }

  checkXSSVulnerability(code, lines, language) {
    const issues = [];
    const xssPatterns = [
      /innerHTML\s*=\s*[^'"]/g,
      /dangerouslySetInnerHTML/g,
      /document\.write\s*\(/g,
      /\.html\s*\(\s*[^'"]/g
    ];

    lines.forEach((line, index) => {
      for (const pattern of xssPatterns) {
        if (pattern.test(line)) {
          issues.push({
            severity: 'high',
            line: index + 1,
            message: 'Potential XSS vulnerability (unsafe HTML manipulation).',
            suggestion: 'Sanitize user input or use safe DOM methods.'
          });
        }
        pattern.lastIndex = 0;
      }
    });

    return issues;
  }

  checkUnsafeRegex(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      // Check for catastrophic backtracking patterns
      if (/new RegExp\s*\(|\/.*\+.*\+.*\//.test(line)) {
        const regexMatch = line.match(/\/(.+?)\//);
        if (regexMatch) {
          const regex = regexMatch[1];
          // Simple heuristic for ReDoS
          if (/(\.\*|\.\+|\w\+){2,}/.test(regex)) {
            issues.push({
              severity: 'high',
              line: index + 1,
              message: 'Potentially unsafe regex (ReDoS vulnerability).',
              suggestion: 'Simplify regex or use bounded quantifiers.'
            });
          }
        }
      }
    });

    return issues;
  }

  checkEvalUsage(code, lines, language) {
    const issues = [];
    const evalPatterns = [/\beval\s*\(/g, /new Function\s*\(/g, /setTimeout\s*\(\s*['"`]/g];

    lines.forEach((line, index) => {
      for (const pattern of evalPatterns) {
        if (pattern.test(line)) {
          issues.push({
            severity: 'critical',
            line: index + 1,
            message: 'Dangerous eval() or similar usage detected.',
            suggestion: 'Avoid eval(). Use safer alternatives like JSON.parse() or explicit function calls.'
          });
        }
        pattern.lastIndex = 0;
      }
    });

    return issues;
  }

  checkPrototypePollution(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      if (/\[['"]__proto__['"]\]|\[['"]constructor['"]\]|\[['"]prototype['"]\]/.test(line)) {
        issues.push({
          severity: 'high',
          line: index + 1,
          message: 'Potential prototype pollution vulnerability.',
          suggestion: 'Validate object keys or use Object.create(null).'
        });
      }
    });

    return issues;
  }

  // ==================== Performance Checks ====================

  checkNPlusOneQuery(code, lines, language) {
    const issues = [];
    let inLoop = false;
    let loopStart = 0;

    lines.forEach((line, index) => {
      if (/\b(for|while|forEach|map)\s*\(/.test(line)) {
        inLoop = true;
        loopStart = index;
      }

      if (inLoop && /\.(find|findOne|findById|query|fetch|get)\s*\(/.test(line)) {
        issues.push({
          severity: 'high',
          line: index + 1,
          message: 'Potential N+1 query pattern (database query inside loop).',
          suggestion: 'Batch queries outside the loop or use eager loading.'
        });
      }

      if (line.includes('}') && inLoop) {
        inLoop = false;
      }
    });

    return issues;
  }

  checkMemoryLeak(code, lines, language) {
    const issues = [];
    let hasAddEventListener = false;
    let hasRemoveEventListener = false;
    let hasSetInterval = false;
    let hasClearInterval = false;

    code.split('\n').forEach((line, index) => {
      if (line.includes('addEventListener')) hasAddEventListener = true;
      if (line.includes('removeEventListener')) hasRemoveEventListener = true;
      if (line.includes('setInterval')) hasSetInterval = true;
      if (line.includes('clearInterval')) hasClearInterval = true;
    });

    if (hasAddEventListener && !hasRemoveEventListener) {
      issues.push({
        severity: 'medium',
        line: 1,
        message: 'Event listeners added but never removed (potential memory leak).',
        suggestion: 'Clean up event listeners in componentWillUnmount or useEffect cleanup.'
      });
    }

    if (hasSetInterval && !hasClearInterval) {
      issues.push({
        severity: 'medium',
        line: 1,
        message: 'setInterval used but never cleared (potential memory leak).',
        suggestion: 'Store interval ID and clear it when no longer needed.'
      });
    }

    return issues;
  }

  checkSyncInAsync(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      if (/\bfs\.(?:readFileSync|writeFileSync|appendFileSync|existsSync)\b/.test(line)) {
        issues.push({
          severity: 'medium',
          line: index + 1,
          message: 'Synchronous file operation in potentially async context.',
          suggestion: 'Use async versions (fs.promises) to avoid blocking.'
        });
      }
    });

    return issues;
  }

  checkUnoptimizedLoop(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      // Array length in loop condition
      if (/for\s*\([^;]+;\s*\w+\s*<\s*\w+\.length\s*;/.test(line)) {
        issues.push({
          severity: 'low',
          line: index + 1,
          message: 'Array length accessed on every iteration.',
          suggestion: 'Cache array length: for(let i = 0, len = arr.length; i < len; i++)'
        });
      }
    });

    return issues;
  }

  // ==================== Style Checks ====================

  checkInconsistentNaming(code, lines, language) {
    const issues = [];
    const camelCase = /^[a-z][a-zA-Z0-9]*$/;
    const PascalCase = /^[A-Z][a-zA-Z0-9]*$/;
    const SCREAMING_SNAKE = /^[A-Z][A-Z0-9_]*$/;

    // Check function/variable naming
    const varPattern = /(?:const|let|var)\s+(\w+)/g;
    let match;

    while ((match = varPattern.exec(code)) !== null) {
      const name = match[1];
      if (name.length > 2 && !camelCase.test(name) && !SCREAMING_SNAKE.test(name)) {
        // Find line number
        const lineNum = code.substring(0, match.index).split('\n').length;
        issues.push({
          severity: 'info',
          line: lineNum,
          message: `Variable "${name}" doesn't follow camelCase convention.`,
          suggestion: 'Use camelCase for variables and functions.'
        });
      }
    }

    return issues.slice(0, 5);
  }

  checkMissingJSDoc(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      // Check exported functions without JSDoc
      if (/export\s+(?:async\s+)?function\s+\w+/.test(line) ||
        /export\s+(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\(/.test(line)) {
        // Check if previous non-empty line has JSDoc
        let hasJSDoc = false;
        for (let i = index - 1; i >= 0 && i > index - 5; i--) {
          const prevLine = lines[i].trim();
          if (prevLine.includes('*/')) hasJSDoc = true;
          if (prevLine && !prevLine.startsWith('*') && !prevLine.startsWith('//')) break;
        }

        if (!hasJSDoc) {
          issues.push({
            severity: 'info',
            line: index + 1,
            message: 'Exported function missing JSDoc documentation.',
            suggestion: 'Add JSDoc comment describing parameters and return value.'
          });
        }
      }
    });

    return issues.slice(0, 3);
  }

  checkConsoleLog(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      if (/console\.(log|debug|info|warn|error)\s*\(/.test(line) &&
        !line.includes('// keep') && !line.includes('// DEBUG')) {
        issues.push({
          severity: 'low',
          line: index + 1,
          message: 'Console statement detected.',
          suggestion: 'Remove or replace with proper logging framework.'
        });
      }
    });

    return issues.slice(0, 5);
  }

  checkTodoFixme(code, lines, language) {
    const issues = [];

    lines.forEach((line, index) => {
      if (/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[:.]?/i.test(line)) {
        const match = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[:.]?\s*(.*)/i);
        issues.push({
          severity: 'info',
          line: index + 1,
          message: `${match[1].toUpperCase()}: ${match[2] || '(no description)'}`,
          suggestion: 'Address this item or create a tracking issue.'
        });
      }
    });

    return issues;
  }

  // ==================== Utilities ====================

  detectLanguage(filePath) {
    if (!filePath) return 'javascript';
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
      '.ts': 'typescript', '.tsx': 'typescript',
      '.py': 'python',
      '.dart': 'dart',
      '.java': 'java',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby'
    };
    return langMap[ext] || 'javascript';
  }

  detectLanguageFromContent(code) {
    if (code.includes('import React') || code.includes('from \'react\'')) return 'javascript';
    if (code.includes('def ') && code.includes(':')) return 'python';
    if (code.includes('void main') && code.includes('=>')) return 'dart';
    if (code.includes('package main') && code.includes('func ')) return 'go';
    return 'javascript';
  }

  parseDiff(diff) {
    const files = [];
    const filePattern = /^\+\+\+ b\/(.+)$/gm;
    const addPattern = /^\+(?!\+\+)(.*)$/gm;

    let match;
    while ((match = filePattern.exec(diff)) !== null) {
      files.push({ path: match[1], additions: [] });
    }

    // Simple: collect all additions
    while ((match = addPattern.exec(diff)) !== null) {
      if (files.length > 0) {
        files[files.length - 1].additions.push(match[1]);
      }
    }

    return files;
  }

  generateSummary(issues) {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    issues.forEach(i => counts[i.severity]++);

    const parts = [];
    if (counts.critical) parts.push(`${counts.critical} critical`);
    if (counts.high) parts.push(`${counts.high} high`);
    if (counts.medium) parts.push(`${counts.medium} medium`);
    if (counts.low) parts.push(`${counts.low} low`);
    if (counts.info) parts.push(`${counts.info} info`);

    return parts.length > 0
      ? `Found ${issues.length} issue(s): ${parts.join(', ')}`
      : 'No issues found';
  }

  aggregateSummary(results) {
    const total = results.reduce((sum, r) => sum + r.issues.length, 0);
    const avgScore = results.reduce((sum, r) => sum + r.metrics.qualityScore, 0) / results.length;

    return {
      filesReviewed: results.length,
      totalIssues: total,
      averageQualityScore: Math.round(avgScore)
    };
  }

  calculateMetrics(code, lines, issues = []) {
    const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
    const commentLines = lines.filter(l => l.trim().startsWith('//')).length;

    return {
      totalLines: lines.length,
      codeLines,
      commentLines,
      commentRatio: codeLines > 0 ? (commentLines / codeLines).toFixed(2) : 0,
      qualityScore: this.calculateQualityScore(code, lines, issues)
    };
  }

  calculateQualityScore(code, lines, existingIssues = null) {
    let score = 100;

    // Use existing issues if provided to avoid running rules twice
    const issues = existingIssues || [];

    issues.forEach(issue => {
      switch (issue.severity) {
        case 'critical': score -= 15; break;
        case 'high': score -= 10; break;
        case 'medium': score -= 5; break;
        case 'low': score -= 2; break;
        case 'info': score -= 1; break;
      }
    });

    return Math.max(0, Math.min(100, score));
  }

  getStatus() {
    return {
      initialized: this.initialized,
      rulesCount: Object.values(this.rules).flat().length,
      options: this.options
    };
  }
}

let instance = null;

export function getCodeReviewer(options) {
  if (!instance) {
    instance = new CodeReviewer(options);
  }
  return instance;
}

export default CodeReviewer;
