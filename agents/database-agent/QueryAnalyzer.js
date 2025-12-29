/**
 * QueryAnalyzer
 * -------------
 * Analyzes database queries for performance issues and optimization opportunities.
 * Suggests indexes and provides optimization recommendations.
 *
 * @author Kareem Hussein
 * @company Inweb Software Solutions
 */

import EventEmitter from 'events';
import { createLogger } from '../../foundation/common/logger.js';

const logger = createLogger('QueryAnalyzer');

// Query patterns that may indicate performance issues
const PERFORMANCE_PATTERNS = {
  SELECT_STAR: /SELECT\s+\*/i,
  NO_INDEX_HINT: /SELECT(?!.*(?:USE|FORCE|IGNORE)\s+INDEX)/i,
  LIKE_LEADING_WILDCARD: /LIKE\s+['"]%/i,
  NEGATIVE_CONDITION: /\bNOT\s+IN\b|\bNOT\s+EXISTS\b|<>\s*|!=\s*/i,
  OR_CONDITIONS: /\bWHERE\b.*\bOR\b.*\bOR\b/i,
  FUNCTION_ON_COLUMN: /WHERE\s+\w+\s*\([^)]*\)\s*=/i,
  IMPLICIT_CONVERSION: /WHERE\s+\w+\s*=\s*['"][0-9]+['"]/i,
  LARGE_IN_CLAUSE: /IN\s*\([^)]{200,}\)/i,
  NO_LIMIT: /SELECT(?!.*\bLIMIT\b).*FROM/i,
  CARTESIAN_JOIN: /FROM\s+\w+\s*,\s*\w+/i
};

// Optimization suggestions for each pattern
const OPTIMIZATION_SUGGESTIONS = {
  SELECT_STAR: {
    severity: 'medium',
    message: 'Avoid SELECT * - specify only needed columns',
    recommendation: 'List specific columns to reduce data transfer and improve cache efficiency'
  },
  LIKE_LEADING_WILDCARD: {
    severity: 'high',
    message: 'Leading wildcard in LIKE prevents index usage',
    recommendation: 'Consider full-text search or restructure the query'
  },
  NEGATIVE_CONDITION: {
    severity: 'medium',
    message: 'Negative conditions may not use indexes efficiently',
    recommendation: 'Consider restructuring with positive conditions or EXISTS'
  },
  OR_CONDITIONS: {
    severity: 'medium',
    message: 'Multiple OR conditions can be slow',
    recommendation: 'Consider using UNION or restructuring with IN clause'
  },
  FUNCTION_ON_COLUMN: {
    severity: 'high',
    message: 'Function on column prevents index usage',
    recommendation: 'Store computed values or use expression indexes'
  },
  IMPLICIT_CONVERSION: {
    severity: 'medium',
    message: 'Implicit type conversion may affect performance',
    recommendation: 'Ensure data types match to avoid conversion overhead'
  },
  LARGE_IN_CLAUSE: {
    severity: 'medium',
    message: 'Large IN clause may be slow',
    recommendation: 'Consider using a temporary table or JOIN'
  },
  NO_LIMIT: {
    severity: 'low',
    message: 'Query may return large result set',
    recommendation: 'Add LIMIT clause to prevent memory issues'
  },
  CARTESIAN_JOIN: {
    severity: 'high',
    message: 'Possible cartesian join detected',
    recommendation: 'Use explicit JOIN syntax with ON clause'
  }
};

export class QueryAnalyzer extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = config;
    this.projectPath = null;
    this.initialized = false;

    // Query statistics
    this.stats = {
      queriesAnalyzed: 0,
      slowQueriesDetected: 0,
      optimizationsFound: 0,
      indexesSuggested: 0
    };

    // Slow query threshold (ms)
    this.slowQueryThreshold = config.slowQueryThreshold || 1000;
  }

  /**
   * Initialize the query analyzer
   */
  async initialize() {
    this.initialized = true;
    logger.debug('QueryAnalyzer initialized');
  }

  /**
   * Set the project path
   * @param {string} projectPath - Path to project
   */
  async setProjectPath(projectPath) {
    this.projectPath = projectPath;
  }

  /**
   * Analyze a query for performance issues
   * @param {string} query - SQL query to analyze
   * @param {object} options - Analysis options
   */
  async analyze(query, options = {}) {
    this.stats.queriesAnalyzed++;

    const analysis = {
      query,
      timestamp: new Date().toISOString(),
      issues: [],
      recommendations: [],
      indexSuggestions: [],
      estimatedComplexity: 'low',
      isSlowQuery: false
    };

    // Parse and analyze query structure
    const parsed = this._parseQuery(query);
    analysis.parsed = parsed;

    // Check for performance patterns
    for (const [pattern, regex] of Object.entries(PERFORMANCE_PATTERNS)) {
      if (regex.test(query)) {
        const suggestion = OPTIMIZATION_SUGGESTIONS[pattern];
        if (suggestion) {
          analysis.issues.push({
            pattern,
            ...suggestion
          });
          this.stats.optimizationsFound++;
        }
      }
    }

    // Analyze query complexity
    analysis.estimatedComplexity = this._estimateComplexity(query, parsed);

    // Generate index suggestions
    analysis.indexSuggestions = this._suggestIndexesForQuery(query, parsed);
    this.stats.indexesSuggested += analysis.indexSuggestions.length;

    // Check if slow query
    if (options.executionTime && options.executionTime > this.slowQueryThreshold) {
      analysis.isSlowQuery = true;
      this.stats.slowQueriesDetected++;
      this.emit('slow_query', { query, executionTime: options.executionTime });
    }

    // Generate overall recommendations
    analysis.recommendations = this._generateRecommendations(analysis);

    return analysis;
  }

  /**
   * Parse a SQL query (basic implementation)
   */
  _parseQuery(query) {
    const parsed = {
      type: this._getQueryType(query),
      tables: [],
      columns: [],
      whereColumns: [],
      orderByColumns: [],
      groupByColumns: [],
      joins: [],
      hasSubquery: /\(\s*SELECT/i.test(query),
      hasAggregation: /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(query),
      hasGroupBy: /\bGROUP\s+BY\b/i.test(query),
      hasOrderBy: /\bORDER\s+BY\b/i.test(query),
      hasLimit: /\bLIMIT\b/i.test(query),
      hasDistinct: /\bDISTINCT\b/i.test(query)
    };

    // Extract tables
    const fromMatch = query.match(/\bFROM\s+(\w+)/i);
    if (fromMatch) {
      parsed.tables.push(fromMatch[1]);
    }

    // Extract joins
    const joinRegex = /\b(LEFT|RIGHT|INNER|OUTER|CROSS)?\s*JOIN\s+(\w+)/gi;
    let joinMatch;
    while ((joinMatch = joinRegex.exec(query)) !== null) {
      parsed.tables.push(joinMatch[2]);
      parsed.joins.push({
        type: joinMatch[1] || 'INNER',
        table: joinMatch[2]
      });
    }

    // Extract WHERE columns
    const whereMatch = query.match(/\bWHERE\s+(.+?)(?:GROUP BY|ORDER BY|LIMIT|$)/is);
    if (whereMatch) {
      const whereClause = whereMatch[1];
      const columnRegex = /(\w+)\s*(?:=|<|>|<=|>=|<>|!=|LIKE|IN|IS)/gi;
      let colMatch;
      while ((colMatch = columnRegex.exec(whereClause)) !== null) {
        if (!['AND', 'OR', 'NOT'].includes(colMatch[1].toUpperCase())) {
          parsed.whereColumns.push(colMatch[1]);
        }
      }
    }

    // Extract ORDER BY columns
    const orderMatch = query.match(/\bORDER\s+BY\s+(.+?)(?:LIMIT|$)/is);
    if (orderMatch) {
      const orderClause = orderMatch[1];
      const columns = orderClause.split(',').map(c => c.trim().split(/\s+/)[0]);
      parsed.orderByColumns = columns;
    }

    // Extract GROUP BY columns
    const groupMatch = query.match(/\bGROUP\s+BY\s+(.+?)(?:HAVING|ORDER BY|LIMIT|$)/is);
    if (groupMatch) {
      const groupClause = groupMatch[1];
      parsed.groupByColumns = groupClause.split(',').map(c => c.trim());
    }

    return parsed;
  }

  /**
   * Get query type
   */
  _getQueryType(query) {
    const normalized = query.trim().toUpperCase();
    if (normalized.startsWith('SELECT')) return 'SELECT';
    if (normalized.startsWith('INSERT')) return 'INSERT';
    if (normalized.startsWith('UPDATE')) return 'UPDATE';
    if (normalized.startsWith('DELETE')) return 'DELETE';
    if (normalized.startsWith('CREATE')) return 'CREATE';
    if (normalized.startsWith('ALTER')) return 'ALTER';
    if (normalized.startsWith('DROP')) return 'DROP';
    return 'UNKNOWN';
  }

  /**
   * Estimate query complexity
   */
  _estimateComplexity(query, parsed) {
    let score = 0;

    // Base complexity for query type
    if (parsed.type === 'SELECT') score += 1;
    if (parsed.type === 'UPDATE' || parsed.type === 'DELETE') score += 2;

    // Joins add complexity
    score += parsed.joins.length * 2;

    // Subqueries add significant complexity
    if (parsed.hasSubquery) score += 3;

    // Aggregations add complexity
    if (parsed.hasAggregation) score += 1;

    // GROUP BY adds complexity
    if (parsed.hasGroupBy) score += 2;

    // Distinct adds complexity
    if (parsed.hasDistinct) score += 1;

    // Multiple tables without proper joins
    if (parsed.tables.length > 1 && parsed.joins.length === 0) score += 5;

    if (score <= 2) return 'low';
    if (score <= 5) return 'medium';
    return 'high';
  }

  /**
   * Suggest indexes for a query
   */
  _suggestIndexesForQuery(query, parsed) {
    const suggestions = [];

    // Suggest index for WHERE columns
    for (const column of parsed.whereColumns) {
      if (parsed.tables[0]) {
        suggestions.push({
          table: parsed.tables[0],
          columns: [column],
          type: 'btree',
          reason: 'Column used in WHERE clause',
          priority: 'high'
        });
      }
    }

    // Suggest composite index for ORDER BY columns
    if (parsed.orderByColumns.length > 0 && parsed.tables[0]) {
      suggestions.push({
        table: parsed.tables[0],
        columns: parsed.orderByColumns,
        type: 'btree',
        reason: 'Columns used in ORDER BY',
        priority: 'medium'
      });
    }

    // Suggest covering index for common query patterns
    if (parsed.whereColumns.length > 0 && parsed.orderByColumns.length > 0) {
      const coveringColumns = [...new Set([...parsed.whereColumns, ...parsed.orderByColumns])];
      if (coveringColumns.length <= 4 && parsed.tables[0]) {
        suggestions.push({
          table: parsed.tables[0],
          columns: coveringColumns,
          type: 'btree',
          reason: 'Covering index for WHERE + ORDER BY',
          priority: 'high'
        });
      }
    }

    // Deduplicate suggestions
    return this._deduplicateIndexSuggestions(suggestions);
  }

  /**
   * Deduplicate index suggestions
   */
  _deduplicateIndexSuggestions(suggestions) {
    const seen = new Set();
    return suggestions.filter(s => {
      const key = `${s.table}:${s.columns.join(',')}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Generate overall recommendations
   */
  _generateRecommendations(analysis) {
    const recommendations = [];

    // High severity issues first
    const highSeverity = analysis.issues.filter(i => i.severity === 'high');
    if (highSeverity.length > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Critical Performance Issues',
        description: `Found ${highSeverity.length} high-severity issues`,
        actions: highSeverity.map(i => i.recommendation)
      });
    }

    // Index recommendations
    if (analysis.indexSuggestions.length > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Index Recommendations',
        description: 'Consider adding indexes to improve query performance',
        actions: analysis.indexSuggestions.map(s =>
          `CREATE INDEX ON ${s.table} (${s.columns.join(', ')}) -- ${s.reason}`
        )
      });
    }

    // Complexity warning
    if (analysis.estimatedComplexity === 'high') {
      recommendations.push({
        priority: 'medium',
        title: 'Query Complexity',
        description: 'Query has high complexity',
        actions: [
          'Consider breaking into multiple simpler queries',
          'Use CTEs (WITH clause) for better readability',
          'Review join strategy and order'
        ]
      });
    }

    return recommendations;
  }

  /**
   * Optimize a query
   * @param {string} query - Query to optimize
   */
  async optimize(query) {
    const analysis = await this.analyze(query);

    const optimization = {
      original: query,
      optimizedQuery: query,
      improvements: [],
      warnings: []
    };

    // Apply optimizations based on issues found
    let optimized = query;

    // Replace SELECT * with specific columns (placeholder)
    if (PERFORMANCE_PATTERNS.SELECT_STAR.test(query)) {
      optimization.improvements.push({
        type: 'column_specification',
        description: 'Replace SELECT * with specific columns',
        before: 'SELECT *',
        after: 'SELECT column1, column2, ...'
      });
    }

    // Add LIMIT if missing (for SELECT queries)
    if (analysis.parsed.type === 'SELECT' && !analysis.parsed.hasLimit) {
      if (!analysis.parsed.hasAggregation) {
        optimized = optimized.replace(/;?\s*$/, ' LIMIT 1000;');
        optimization.improvements.push({
          type: 'add_limit',
          description: 'Added LIMIT clause to prevent large result sets'
        });
      }
    }

    optimization.optimizedQuery = optimized;
    optimization.analysisResults = analysis;

    return optimization;
  }

  /**
   * Suggest indexes for a set of queries
   * @param {string[]} queries - Array of queries to analyze
   */
  async suggestIndexes(queries) {
    const allSuggestions = [];
    const columnUsage = new Map(); // table.column -> count

    for (const query of queries) {
      const analysis = await this.analyze(query);

      // Track column usage
      for (const column of analysis.parsed.whereColumns) {
        const table = analysis.parsed.tables[0];
        if (table) {
          const key = `${table}.${column}`;
          columnUsage.set(key, (columnUsage.get(key) || 0) + 1);
        }
      }

      allSuggestions.push(...analysis.indexSuggestions);
    }

    // Score and rank suggestions
    const ranked = this._rankIndexSuggestions(allSuggestions, columnUsage);

    return {
      suggestions: ranked.slice(0, 10), // Top 10 suggestions
      columnUsage: Object.fromEntries(columnUsage),
      totalQueriesAnalyzed: queries.length
    };
  }

  /**
   * Rank index suggestions by importance
   */
  _rankIndexSuggestions(suggestions, columnUsage) {
    const scored = suggestions.map(s => {
      let score = 0;

      // Priority score
      if (s.priority === 'high') score += 10;
      if (s.priority === 'medium') score += 5;
      if (s.priority === 'low') score += 1;

      // Usage frequency score
      for (const col of s.columns) {
        const key = `${s.table}.${col}`;
        score += (columnUsage.get(key) || 0) * 2;
      }

      // Penalize too many columns
      if (s.columns.length > 3) score -= 2;

      return { ...s, score };
    });

    return scored.sort((a, b) => b.score - a.score);
  }

  /**
   * Get analyzer statistics
   */
  async getStats() {
    return { ...this.stats };
  }
}

export default QueryAnalyzer;
