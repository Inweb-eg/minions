/**
 * Technical Debt Analyzer - System-Wide Technical Debt Detection
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Quantifies technical debt across all 4 codebases
 *
 * Plan Reference: Phase 6.5.3 - Technical Debt Analyzer
 * - Dead code detector (unused exports, functions)
 * - Code complexity analyzer (cyclomatic complexity)
 * - Technical debt quantification (hours + dollars)
 * - TODO/FIXME extractor with prioritization
 */

import { BaseAnalyzer, SEVERITY, CATEGORY, CODEBASE } from './base-analyzer.js';
import * as path from 'path';

/**
 * TechnicalDebtAnalyzer
 * Detects and quantifies technical debt across all codebases
 */
export class TechnicalDebtAnalyzer extends BaseAnalyzer {
  constructor() {
    super('TechnicalDebtAnalyzer');
    this.exportedSymbols = new Map(); // Track all exports
    this.importedSymbols = new Map(); // Track all imports
    this.definedFunctions = new Map(); // Track all function definitions
    this.calledFunctions = new Set(); // Track all function calls
    this.todos = [];
    this.complexityThresholds = {
      low: 10,
      medium: 20,
      high: 30
    };
    // Cost estimation (industry averages)
    this.hourlyRate = 75; // $/hour
    this.debtCosts = {
      dead_code: 2, // hours to remove
      high_complexity: 8, // hours to refactor
      medium_complexity: 4,
      todo_critical: 16,
      todo_high: 8,
      todo_medium: 4,
      todo_low: 2,
      duplicate_code: 6
    };
  }

  /**
   * Analyze technical debt across all codebases
   * @param {Object} codebasePaths - Paths to all codebases
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  async analyze(codebasePaths, options = {}) {
    this.logger.info('Starting technical debt analysis');
    this.clearIssues();

    // Phase 1: Collect symbols and complexity
    await this.analyzeBackend(codebasePaths.backend);
    await this.analyzeAdminDashboard(codebasePaths.adminDashboard);
    await this.analyzeFlutterApp(codebasePaths.usersApp, CODEBASE.USERS_APP);
    await this.analyzeFlutterApp(codebasePaths.driversApp, CODEBASE.DRIVERS_APP);

    // Phase 2: Detect issues
    this.detectDeadCode();
    this.extractTodos();
    this.calculateTechnicalDebt();

    // Generate metrics
    this.generateMetrics();

    this.logger.info(`Technical debt analysis complete: ${this.issues.length} issues found`);
    return this.formatResults({
      totalDebtHours: this.metrics.total_debt_hours,
      totalDebtCost: this.metrics.total_debt_cost,
      todos: this.todos
    });
  }

  /**
   * Analyze Backend codebase
   * @param {string} backendPath - Path to backend
   */
  async analyzeBackend(backendPath) {
    this.logger.debug('Analyzing backend for technical debt');

    const jsFiles = this.findFiles(backendPath, /\.js$/);

    jsFiles.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      const ast = this.parseCode(content, file);
      if (!ast) return;

      // Track exports
      this.trackExports(file, ast, CODEBASE.BACKEND);

      // Track imports
      this.trackImports(file, ast, CODEBASE.BACKEND);

      // Track function definitions and calls
      this.trackFunctions(file, ast, CODEBASE.BACKEND);

      // Analyze complexity
      this.analyzeComplexity(file, ast, content, CODEBASE.BACKEND);

      // Extract TODOs
      this.extractTodosFromFile(file, content, CODEBASE.BACKEND);
    });

    this.addMetric('backend_files_analyzed', jsFiles.length);
  }

  /**
   * Analyze Admin Dashboard
   * @param {string} adminPath - Path to admin dashboard
   */
  async analyzeAdminDashboard(adminPath) {
    this.logger.debug('Analyzing admin dashboard for technical debt');

    const files = this.findFiles(adminPath, /\.(js|jsx|ts|tsx)$/);

    files.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      const ast = this.parseCode(content, file);
      if (!ast) return;

      this.trackExports(file, ast, CODEBASE.ADMIN_DASHBOARD);
      this.trackImports(file, ast, CODEBASE.ADMIN_DASHBOARD);
      this.trackFunctions(file, ast, CODEBASE.ADMIN_DASHBOARD);
      this.analyzeComplexity(file, ast, content, CODEBASE.ADMIN_DASHBOARD);
      this.extractTodosFromFile(file, content, CODEBASE.ADMIN_DASHBOARD);
    });

    this.addMetric('admin_files_analyzed', files.length);
  }

  /**
   * Analyze Flutter app
   * @param {string} appPath - Path to Flutter app
   * @param {string} codebase - Codebase identifier
   */
  async analyzeFlutterApp(appPath, codebase) {
    this.logger.debug(`Analyzing ${codebase} for technical debt`);

    const dartFiles = this.findFiles(appPath, /\.dart$/);

    dartFiles.forEach(file => {
      const content = this.readFile(file);
      if (!content) return;

      // Pattern-based analysis for Dart
      this.trackDartExports(file, content, codebase);
      this.trackDartImports(file, content, codebase);
      this.analyzeDartComplexity(file, content, codebase);
      this.extractTodosFromFile(file, content, codebase);
    });

    this.addMetric(`${codebase}_files_analyzed`, dartFiles.length);
  }

  /**
   * Track exported symbols
   * @param {string} file - File path
   * @param {Object} ast - AST
   * @param {string} codebase - Codebase identifier
   */
  trackExports(file, ast, codebase) {
    this.traverse(ast, {
      ExportNamedDeclaration: (path) => {
        if (path.node.declaration) {
          // export function foo() {}
          // export class Bar {}
          // export const baz = 1;
          if (path.node.declaration.type === 'FunctionDeclaration' ||
              path.node.declaration.type === 'ClassDeclaration') {
            const name = path.node.declaration.id?.name;
            if (name) {
              this.exportedSymbols.set(`${codebase}:${file}:${name}`, {
                file,
                name,
                type: path.node.declaration.type,
                line: path.node.loc?.start.line || 0,
                codebase
              });
            }
          } else if (path.node.declaration.type === 'VariableDeclaration') {
            path.node.declaration.declarations.forEach(decl => {
              const name = decl.id?.name;
              if (name) {
                this.exportedSymbols.set(`${codebase}:${file}:${name}`, {
                  file,
                  name,
                  type: 'VariableDeclaration',
                  line: path.node.loc?.start.line || 0,
                  codebase
                });
              }
            });
          }
        } else if (path.node.specifiers) {
          // export { foo, bar };
          path.node.specifiers.forEach(spec => {
            const name = spec.exported?.name;
            if (name) {
              this.exportedSymbols.set(`${codebase}:${file}:${name}`, {
                file,
                name,
                type: 'ExportSpecifier',
                line: path.node.loc?.start.line || 0,
                codebase
              });
            }
          });
        }
      },
      ExportDefaultDeclaration: (path) => {
        // export default Component;
        const name = path.node.declaration.id?.name || path.node.declaration.name || 'default';
        this.exportedSymbols.set(`${codebase}:${file}:${name}`, {
          file,
          name,
          type: 'ExportDefaultDeclaration',
          line: path.node.loc?.start.line || 0,
          codebase
        });
      }
    });
  }

  /**
   * Track imported symbols
   * @param {string} file - File path
   * @param {Object} ast - AST
   * @param {string} codebase - Codebase identifier
   */
  trackImports(file, ast, codebase) {
    this.traverse(ast, {
      ImportDeclaration: (path) => {
        path.node.specifiers.forEach(spec => {
          let importedName = null;
          if (spec.type === 'ImportDefaultSpecifier') {
            importedName = 'default';
          } else if (spec.type === 'ImportSpecifier') {
            importedName = spec.imported?.name;
          }

          if (importedName) {
            const key = `${codebase}:${importedName}`;
            if (!this.importedSymbols.has(key)) {
              this.importedSymbols.set(key, []);
            }
            this.importedSymbols.get(key).push({
              file,
              name: importedName,
              source: path.node.source.value,
              line: path.node.loc?.start.line || 0
            });
          }
        });
      }
    });
  }

  /**
   * Track function definitions and calls
   * @param {string} file - File path
   * @param {Object} ast - AST
   * @param {string} codebase - Codebase identifier
   */
  trackFunctions(file, ast, codebase) {
    this.traverse(ast, {
      FunctionDeclaration: (path) => {
        const name = path.node.id?.name;
        if (name) {
          this.definedFunctions.set(`${codebase}:${file}:${name}`, {
            file,
            name,
            line: path.node.loc?.start.line || 0,
            codebase
          });
        }
      },
      CallExpression: (path) => {
        const callee = path.node.callee;
        let funcName = null;

        if (callee.type === 'Identifier') {
          funcName = callee.name;
        } else if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier') {
          funcName = callee.property.name;
        }

        if (funcName) {
          this.calledFunctions.add(`${codebase}:${funcName}`);
        }
      }
    });
  }

  /**
   * Track Dart exports
   * @param {string} file - File path
   * @param {string} content - File content
   * @param {string} codebase - Codebase identifier
   */
  trackDartExports(file, content, codebase) {
    // Pattern for Dart exports: class ClassName, Widget widgetName()
    const classPattern = /^class\s+(\w+)/gm;
    const functionPattern = /^(?:Widget|Future|void|int|String|bool|double)\s+(\w+)\s*\(/gm;

    let match;
    while ((match = classPattern.exec(content)) !== null) {
      const name = match[1];
      this.exportedSymbols.set(`${codebase}:${file}:${name}`, {
        file,
        name,
        type: 'DartClass',
        line: this.getLineNumber(content, match.index),
        codebase
      });
    }

    while ((match = functionPattern.exec(content)) !== null) {
      const name = match[1];
      if (!name.startsWith('_')) { // Public function
        this.exportedSymbols.set(`${codebase}:${file}:${name}`, {
          file,
          name,
          type: 'DartFunction',
          line: this.getLineNumber(content, match.index),
          codebase
        });
      }
    }
  }

  /**
   * Track Dart imports
   * @param {string} file - File path
   * @param {string} content - File content
   * @param {string} codebase - Codebase identifier
   */
  trackDartImports(file, content, codebase) {
    const importPattern = /import\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importPattern.exec(content)) !== null) {
      const source = match[1];
      const key = `${codebase}:${path.basename(source, '.dart')}`;

      if (!this.importedSymbols.has(key)) {
        this.importedSymbols.set(key, []);
      }

      this.importedSymbols.get(key).push({
        file,
        source,
        line: this.getLineNumber(content, match.index)
      });
    }
  }

  /**
   * Analyze code complexity
   * @param {string} file - File path
   * @param {Object} ast - AST
   * @param {string} content - File content
   * @param {string} codebase - Codebase identifier
   */
  analyzeComplexity(file, ast, content, codebase) {
    this.traverse(ast, {
      FunctionDeclaration: (path) => {
        const complexity = this.calculateCyclomaticComplexity(path.node);
        const name = path.node.id?.name || 'anonymous';

        this.reportComplexity(file, name, complexity, path.node.loc?.start.line || 0, codebase);
      },
      FunctionExpression: (path) => {
        const complexity = this.calculateCyclomaticComplexity(path.node);
        const name = 'anonymous function';

        this.reportComplexity(file, name, complexity, path.node.loc?.start.line || 0, codebase);
      },
      ArrowFunctionExpression: (path) => {
        const complexity = this.calculateCyclomaticComplexity(path.node);
        const name = 'arrow function';

        this.reportComplexity(file, name, complexity, path.node.loc?.start.line || 0, codebase);
      }
    });
  }

  /**
   * Analyze Dart code complexity
   * @param {string} file - File path
   * @param {string} content - File content
   * @param {string} codebase - Codebase identifier
   */
  analyzeDartComplexity(file, content, codebase) {
    // Simple heuristic for Dart complexity
    // Count control flow statements: if, for, while, switch, catch
    const lines = content.split('\n');
    let currentFunction = null;
    let braceDepth = 0;
    let functionComplexity = 0;
    let functionStartLine = 0;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Detect function start
      if (/^(?:Widget|Future|void|int|String|bool|double)\s+(\w+)\s*\(/.test(trimmed)) {
        if (currentFunction) {
          // Report previous function
          this.reportComplexity(file, currentFunction, functionComplexity, functionStartLine, codebase);
        }
        currentFunction = trimmed.match(/\s+(\w+)\s*\(/)[1];
        functionStartLine = index + 1;
        functionComplexity = 1; // Base complexity
        braceDepth = 0;
      }

      // Track braces
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      // Count complexity contributors
      if (currentFunction && braceDepth > 0) {
        if (/\bif\b|\bfor\b|\bwhile\b|\bswitch\b|\bcatch\b|\b&&\b|\b\|\|\b/.test(trimmed)) {
          functionComplexity++;
        }
      }

      // Function end
      if (currentFunction && braceDepth === 0 && trimmed === '}') {
        this.reportComplexity(file, currentFunction, functionComplexity, functionStartLine, codebase);
        currentFunction = null;
      }
    });
  }

  /**
   * Calculate cyclomatic complexity
   * @param {Object} node - Function node
   * @returns {number} Complexity score
   */
  calculateCyclomaticComplexity(node) {
    let complexity = 1; // Base complexity

    this.traverse({ type: 'Program', body: [node] }, {
      IfStatement: () => complexity++,
      ForStatement: () => complexity++,
      WhileStatement: () => complexity++,
      DoWhileStatement: () => complexity++,
      SwitchCase: (path) => {
        if (path.node.test) complexity++; // Don't count default case
      },
      CatchClause: () => complexity++,
      ConditionalExpression: () => complexity++, // Ternary
      LogicalExpression: (path) => {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      }
    });

    return complexity;
  }

  /**
   * Report complexity issue if threshold exceeded
   * @param {string} file - File path
   * @param {string} funcName - Function name
   * @param {number} complexity - Complexity score
   * @param {number} line - Line number
   * @param {string} codebase - Codebase identifier
   */
  reportComplexity(file, funcName, complexity, line, codebase) {
    let severity = null;
    let type = null;

    if (complexity > this.complexityThresholds.high) {
      severity = SEVERITY.HIGH;
      type = 'high_complexity';
    } else if (complexity > this.complexityThresholds.medium) {
      severity = SEVERITY.MEDIUM;
      type = 'medium_complexity';
    } else if (complexity > this.complexityThresholds.low) {
      severity = SEVERITY.LOW;
      type = 'low_complexity';
    }

    if (severity) {
      this.addIssue(this.createIssue({
        type,
        severity,
        message: `High complexity in function "${funcName}": ${complexity}`,
        codebase,
        file,
        code: funcName,
        location: { line, column: 0 },
        suggestion: `Refactor to reduce complexity (current: ${complexity}, recommended: < ${this.complexityThresholds.low})`,
        impact: `Difficult to maintain and test`,
        fixable: false
      }));
    }
  }

  /**
   * Extract TODOs and FIXMEs from file
   * @param {string} file - File path
   * @param {string} content - File content
   * @param {string} codebase - Codebase identifier
   */
  extractTodosFromFile(file, content, codebase) {
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const todoMatch = line.match(/\/\/\s*(TODO|FIXME|HACK|XXX|BUG)(?:\(([^)]+)\))?:\s*(.+)/i);

      if (todoMatch) {
        const [, type, author, message] = todoMatch;
        const priority = this.categorizeTodoPriority(type, message);

        const todo = {
          type: type.toUpperCase(),
          message: message.trim(),
          author: author || 'unknown',
          priority,
          file,
          line: index + 1,
          codebase
        };

        this.todos.push(todo);

        // Create issue for high-priority TODOs
        if (priority === 'critical' || priority === 'high') {
          this.addIssue(this.createIssue({
            type: `todo_${priority}`,
            severity: priority === 'critical' ? SEVERITY.HIGH : SEVERITY.MEDIUM,
            message: `${type}: ${message}`,
            codebase,
            file,
            code: line.trim(),
            location: { line: index + 1, column: 0 },
            suggestion: 'Address this TODO/FIXME',
            fixable: false
          }));
        }
      }
    });
  }

  /**
   * Categorize TODO priority based on keywords
   * @param {string} type - TODO type
   * @param {string} message - TODO message
   * @returns {string} Priority level
   */
  categorizeTodoPriority(type, message) {
    const lowerMessage = message.toLowerCase();

    // Critical keywords
    if (type === 'BUG' || type === 'FIXME' ||
        lowerMessage.includes('security') ||
        lowerMessage.includes('critical') ||
        lowerMessage.includes('urgent') ||
        lowerMessage.includes('asap')) {
      return 'critical';
    }

    // High priority keywords
    if (lowerMessage.includes('important') ||
        lowerMessage.includes('must') ||
        lowerMessage.includes('required') ||
        lowerMessage.includes('broken')) {
      return 'high';
    }

    // Medium priority keywords
    if (lowerMessage.includes('should') ||
        lowerMessage.includes('improve') ||
        lowerMessage.includes('optimize')) {
      return 'medium';
    }

    // Default to low
    return 'low';
  }

  /**
   * Detect dead code (unused exports)
   */
  detectDeadCode() {
    this.logger.debug('Detecting dead code');

    this.exportedSymbols.forEach((exported, key) => {
      const [codebase, file, name] = key.split(':');

      // Check if this symbol is imported anywhere
      const importKey = `${codebase}:${name}`;
      const isImported = this.importedSymbols.has(importKey);

      // Check if this function is called
      const callKey = `${codebase}:${name}`;
      const isCalled = this.calledFunctions.has(callKey);

      // Heuristics for dead code
      // 1. Not imported by anyone
      // 2. Not called by anyone (for functions)
      // 3. Not a default export (may be entry point)
      // 4. Not in test files

      const isTest = file.includes('.test.') || file.includes('.spec.');
      const isDefaultExport = exported.type === 'ExportDefaultDeclaration';
      const isEntryPoint = file.includes('index.js') || file.includes('main.dart') || file.includes('App.jsx');

      if (!isImported && !isCalled && !isDefaultExport && !isTest && !isEntryPoint) {
        this.addIssue(this.createIssue({
          type: 'dead_code',
          severity: SEVERITY.LOW,
          message: `Unused export: "${name}" is never imported or used`,
          codebase,
          file: path.relative(process.cwd(), exported.file),
          code: name,
          location: { line: exported.line, column: 0 },
          suggestion: `Remove unused export or make it internal`,
          fixable: true,
          impact: 'Increases bundle size and maintenance cost'
        }));
      }
    });
  }

  /**
   * Calculate total technical debt
   */
  calculateTechnicalDebt() {
    this.logger.debug('Calculating technical debt');

    let totalHours = 0;

    // Sum up debt from each issue type
    this.issues.forEach(issue => {
      const hours = this.debtCosts[issue.type] || 1;
      totalHours += hours;
    });

    const totalCost = totalHours * this.hourlyRate;

    this.addMetric('total_debt_hours', totalHours.toFixed(1));
    this.addMetric('total_debt_cost', `$${totalCost.toFixed(2)}`);

    // Breakdown by category
    const debtByCategory = {};
    this.issues.forEach(issue => {
      const category = issue.category || 'other';
      if (!debtByCategory[category]) {
        debtByCategory[category] = { hours: 0, cost: 0, count: 0 };
      }
      const hours = this.debtCosts[issue.type] || 1;
      debtByCategory[category].hours += hours;
      debtByCategory[category].cost += hours * this.hourlyRate;
      debtByCategory[category].count += 1;
    });

    this.addMetric('debt_by_category', debtByCategory);
  }

  /**
   * Generate technical debt metrics
   */
  generateMetrics() {
    this.addMetric('total_exports', this.exportedSymbols.size);
    this.addMetric('total_imports', this.importedSymbols.size);
    this.addMetric('total_todos', this.todos.length);

    // TODO breakdown by priority
    const todosByPriority = {
      critical: this.todos.filter(t => t.priority === 'critical').length,
      high: this.todos.filter(t => t.priority === 'high').length,
      medium: this.todos.filter(t => t.priority === 'medium').length,
      low: this.todos.filter(t => t.priority === 'low').length
    };
    this.addMetric('todos_by_priority', todosByPriority);

    // Complexity breakdown
    const highComplexity = this.issues.filter(i => i.type === 'high_complexity').length;
    const mediumComplexity = this.issues.filter(i => i.type === 'medium_complexity').length;
    this.addMetric('high_complexity_functions', highComplexity);
    this.addMetric('medium_complexity_functions', mediumComplexity);

    // Dead code
    const deadCode = this.issues.filter(i => i.type === 'dead_code').length;
    this.addMetric('dead_code_count', deadCode);
  }

  /**
   * Get line number from string index
   * @param {string} content - File content
   * @param {number} index - String index
   * @returns {number} Line number
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Get category for issue type
   * @param {string} type - Issue type
   * @returns {string} Category
   */
  getCategory(type) {
    if (type.includes('complexity')) {
      return CATEGORY.COMPLEXITY;
    }
    if (type.includes('todo') || type === 'dead_code') {
      return CATEGORY.TECHNICAL_DEBT;
    }
    return CATEGORY.TECHNICAL_DEBT;
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getTechnicalDebtAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new TechnicalDebtAnalyzer();
  }
  return analyzerInstance;
}
