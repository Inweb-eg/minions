/**
 * PerformanceAnalyzer - Performance Issues Detection
 *
 * Shared foundation module for performance analysis across all agents.
 *
 * Capabilities:
 * - N+1 query detection
 * - Missing database indexes
 * - Inefficient queries (SELECT *, no LIMIT)
 * - Missing caching opportunities
 * - Synchronous blocking operations
 */

import { BaseAnalyzer, SEVERITY, CATEGORY } from './BaseAnalyzer.js';

/**
 * PerformanceAnalyzer
 * Analyzes code for performance issues
 */
export class PerformanceAnalyzer extends BaseAnalyzer {
  constructor() {
    super('PerformanceAnalyzer');
  }

  /**
   * Analyze code for performance issues
   * @param {string} code - Source code to analyze
   * @param {Object} options - Analysis options
   * @returns {Object} Analysis results
   */
  async analyze(code, options = {}) {
    this.logger.info('Starting performance analysis');
    this.clearIssues();

    const parseResult = this.parseCode(code);

    if (!parseResult.success) {
      this.addIssue(this.createIssue({
        type: 'syntax_error',
        severity: SEVERITY.ERROR,
        message: 'Syntax error in code',
        location: parseResult.location,
        code: null,
        category: CATEGORY.BUG
      }));
      return this.formatResults();
    }

    const { ast } = parseResult;

    // Run performance checks
    this.detectNPlusOneQueries(ast);
    this.detectMissingIndexes(ast);
    this.detectInefficientQueries(ast);
    this.detectMissingCaching(ast);
    this.detectSynchronousBlocking(ast);

    this.logger.info(`Performance analysis complete: ${this.issues.length} issues found`);
    return this.formatResults();
  }

  /**
   * Detect N+1 query problems
   * @param {Object} ast - Abstract Syntax Tree
   */
  detectNPlusOneQueries(ast) {
    if (!ast) return;

    // Track loops with database queries inside
    this.traverseAST(ast, {
      ForStatement: (path) => this.checkLoopForQueries(path),
      ForOfStatement: (path) => this.checkLoopForQueries(path),
      ForInStatement: (path) => this.checkLoopForQueries(path),
      WhileStatement: (path) => this.checkLoopForQueries(path),
      DoWhileStatement: (path) => this.checkLoopForQueries(path)
    });

    // Track .map() and .forEach() with queries
    this.traverseAST(ast, {
      CallExpression: (path) => {
        const { node } = path;

        if (node.callee.type === 'MemberExpression') {
          const property = node.callee.property;

          if (property.name === 'map' || property.name === 'forEach') {
            // Check if callback contains database queries
            const callback = node.arguments[0];
            if (callback && (callback.type === 'ArrowFunctionExpression' || callback.type === 'FunctionExpression')) {
              if (this.containsDatabaseQuery(callback)) {
                this.addIssue(this.createIssue({
                  type: 'n_plus_one_query',
                  severity: SEVERITY.ERROR,
                  message: `Potential N+1 query: Database query inside .${property.name}() callback`,
                  location: node.loc,
                  code: property.name,
                  category: CATEGORY.PERFORMANCE,
                  suggestion: 'Use batch query or include related data in initial query'
                }));
              }
            }
          }
        }
      }
    });
  }

  /**
   * Check loop for database queries
   * @param {Object} path - AST path
   */
  checkLoopForQueries(path) {
    const { node } = path;

    // Traverse loop body to find database queries
    let hasQuery = false;

    const checkNode = (n) => {
      if (!n) return;

      if (n.type === 'CallExpression') {
        const code = this.getCallCode(n);
        if (this.isDatabaseQuery(code)) {
          hasQuery = true;
        }
      }

      // Check children
      if (n.body) {
        if (Array.isArray(n.body)) {
          n.body.forEach(checkNode);
        } else {
          checkNode(n.body);
        }
      }
    };

    checkNode(node.body);

    if (hasQuery) {
      this.addIssue(this.createIssue({
        type: 'n_plus_one_query',
        severity: SEVERITY.ERROR,
        message: 'Potential N+1 query: Database query inside loop',
        location: node.loc,
        code: node.type,
        category: CATEGORY.PERFORMANCE,
        suggestion: 'Move query outside loop or use batch query with IN clause'
      }));
    }
  }

  /**
   * Detect missing database indexes
   * @param {Object} ast - Abstract Syntax Tree
   */
  detectMissingIndexes(ast) {
    if (!ast) return;

    this.traverseAST(ast, {
      CallExpression: (path) => {
        const { node } = path;
        const code = this.getCallCode(node);

        // Check for queries with WHERE clauses
        if (this.isDatabaseQuery(code)) {
          // Check if query has WHERE but model doesn't define indexes
          if (code.includes('WHERE') || code.includes('where')) {
            // Extract field names from WHERE clause
            const fields = this.extractWhereFields(code);

            if (fields.length > 0) {
              this.addIssue(this.createIssue({
                type: 'missing_index',
                severity: SEVERITY.WARNING,
                message: `Query uses WHERE clause. Ensure indexes exist for: ${fields.join(', ')}`,
                location: node.loc,
                code: fields.join(', '),
                category: CATEGORY.PERFORMANCE,
                suggestion: 'Add database indexes for frequently queried fields'
              }));
            }
          }

          // Check for queries with JOIN
          if (code.includes('JOIN') || code.includes('join')) {
            this.addIssue(this.createIssue({
              type: 'join_without_index',
              severity: SEVERITY.WARNING,
              message: 'JOIN operation detected. Ensure foreign keys are indexed',
              location: node.loc,
              code: 'JOIN',
              category: CATEGORY.PERFORMANCE,
              suggestion: 'Add indexes on foreign key columns'
            }));
          }
        }
      }
    });
  }

  /**
   * Detect inefficient queries
   * @param {Object} ast - Abstract Syntax Tree
   */
  detectInefficientQueries(ast) {
    if (!ast) return;

    this.traverseAST(ast, {
      CallExpression: (path) => {
        const { node } = path;
        const code = this.getCallCode(node);

        // Detect SELECT *
        if (code.includes('SELECT *') || code.includes('select *')) {
          this.addIssue(this.createIssue({
            type: 'select_all',
            severity: SEVERITY.WARNING,
            message: 'SELECT * queries are inefficient. Select only needed columns',
            location: node.loc,
            code: 'SELECT *',
            category: CATEGORY.PERFORMANCE,
            fixable: true,
            suggestion: 'Specify exact columns instead of SELECT *'
          }));
        }

        // Detect queries without LIMIT
        if (this.isDatabaseQuery(code) && !code.includes('LIMIT') && !code.includes('limit')) {
          if (code.includes('findAll') || code.includes('find(') || code.includes('SELECT')) {
            this.addIssue(this.createIssue({
              type: 'query_without_limit',
              severity: SEVERITY.WARNING,
              message: 'Query without LIMIT can return large result sets',
              location: node.loc,
              code: 'missing LIMIT',
              category: CATEGORY.PERFORMANCE,
              suggestion: 'Add LIMIT clause or pagination'
            }));
          }
        }
      }
    });
  }

  /**
   * Detect missing caching opportunities
   * @param {Object} ast - Abstract Syntax Tree
   */
  detectMissingCaching(ast) {
    if (!ast) return;

    // Track repeated identical queries
    const queries = [];

    this.traverseAST(ast, {
      CallExpression: (path) => {
        const { node } = path;
        const code = this.getCallCode(node);

        if (this.isDatabaseQuery(code)) {
          queries.push({ code, node, path });
        }
      }
    });

    // Check for duplicate queries
    const seen = new Map();
    queries.forEach(({ code, node }) => {
      const normalized = code.trim();
      if (seen.has(normalized)) {
        this.addIssue(this.createIssue({
          type: 'repeated_query',
          severity: SEVERITY.WARNING,
          message: 'Repeated database query detected. Consider caching',
          location: node.loc,
          code: 'repeated query',
          category: CATEGORY.PERFORMANCE,
          suggestion: 'Cache query results or execute once and reuse'
        }));
      } else {
        seen.set(normalized, true);
      }
    });
  }

  /**
   * Detect synchronous blocking operations
   * @param {Object} ast - Abstract Syntax Tree
   */
  detectSynchronousBlocking(ast) {
    if (!ast) return;

    this.traverseAST(ast, {
      CallExpression: (path) => {
        const { node } = path;
        const code = this.getCallCode(node);

        // Detect synchronous file operations
        const syncPatterns = [
          'readFileSync', 'writeFileSync', 'readSync', 'writeSync',
          'statSync', 'readdirSync', 'mkdirSync', 'unlinkSync'
        ];

        syncPatterns.forEach(pattern => {
          if (code.includes(pattern)) {
            this.addIssue(this.createIssue({
              type: 'synchronous_operation',
              severity: SEVERITY.WARNING,
              message: `Synchronous operation '${pattern}' blocks the event loop`,
              location: node.loc,
              code: pattern,
              category: CATEGORY.PERFORMANCE,
              fixable: true,
              suggestion: `Use async version: ${pattern.replace('Sync', '')}`
            }));
          }
        });
      }
    });
  }

  /**
   * Check if node contains database query
   * @param {Object} node - AST node
   * @returns {boolean}
   */
  containsDatabaseQuery(node) {
    let hasQuery = false;

    const traverse = (n) => {
      if (!n || hasQuery) return;

      if (n.type === 'CallExpression') {
        const code = this.getCallCode(n);
        if (this.isDatabaseQuery(code)) {
          hasQuery = true;
          return;
        }
      }

      // Traverse children
      Object.keys(n).forEach(key => {
        if (key === 'loc' || key === 'type') return;
        const child = n[key];
        if (child && typeof child === 'object') {
          if (Array.isArray(child)) {
            child.forEach(traverse);
          } else {
            traverse(child);
          }
        }
      });
    };

    traverse(node);
    return hasQuery;
  }

  /**
   * Check if call is a database query
   * @param {string} code - Code string
   * @returns {boolean}
   */
  isDatabaseQuery(code) {
    const patterns = [
      'find', 'findOne', 'findAll', 'findById', 'findByPk',
      'create', 'update', 'delete', 'destroy',
      'query', 'execute', 'raw',
      'SELECT', 'INSERT', 'UPDATE', 'DELETE',
      'aggregate', 'count'
    ];

    return patterns.some(pattern => code.includes(pattern));
  }

  /**
   * Get code string from call expression
   * @param {Object} node - CallExpression node
   * @returns {string}
   */
  getCallCode(node) {
    try {
      // Simple string representation
      if (node.callee.type === 'MemberExpression') {
        const obj = node.callee.object.name || '';
        const prop = node.callee.property.name || '';
        return `${obj}.${prop}`;
      }
      if (node.callee.name) {
        return node.callee.name;
      }

      // Check arguments for SQL strings
      if (node.arguments && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (firstArg.type === 'StringLiteral' || firstArg.type === 'TemplateLiteral') {
          if (firstArg.value) return firstArg.value;
          if (firstArg.quasis) {
            return firstArg.quasis.map(q => q.value.raw).join('');
          }
        }
      }

      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Extract field names from WHERE clause
   * @param {string} query - Query string
   * @returns {Array} Field names
   */
  extractWhereFields(query) {
    const fields = [];

    // Simple pattern matching for common WHERE patterns
    const patterns = [
      /WHERE\s+(\w+)\s*=/gi,
      /where\s+(\w+)\s*=/gi,
      /WHERE\s+(\w+)\s+IN/gi,
      /where\s+(\w+)\s+in/gi
    ];

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(query)) !== null) {
        if (!fields.includes(match[1])) {
          fields.push(match[1]);
        }
      }
    });

    return fields;
  }
}

/**
 * Get singleton instance of PerformanceAnalyzer
 */
let analyzerInstance = null;

export function getPerformanceAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new PerformanceAnalyzer();
  }
  return analyzerInstance;
}

export default PerformanceAnalyzer;
