/**
 * PatternRecognitionEngine - Automatic pattern discovery and learning
 *
 * Revolutionary Enhancement: Learn from all projects to predict and optimize
 *
 * Features:
 * - Automatic pattern extraction from code
 * - Bug pattern recognition
 * - Performance pattern detection
 * - Security vulnerability patterns
 * - Best practice template generation
 * - Cross-project learning
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain, KNOWLEDGE_TYPES, QUALITY_LEVELS } from './KnowledgeBrain.js';

const logger = createLogger('PatternRecognitionEngine');

// Pattern categories
const PATTERN_CATEGORIES = {
  ARCHITECTURAL: 'architectural',
  CODE_SMELL: 'code_smell',
  BUG: 'bug',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  BEST_PRACTICE: 'best_practice',
  ANTI_PATTERN: 'anti_pattern',
  REFACTORING: 'refactoring'
};

// Built-in pattern detectors
const PATTERN_DETECTORS = {
  // Architectural patterns
  architectural: [
    {
      name: 'Singleton Pattern',
      detect: (code) => /let\s+instance\s*=\s*null[\s\S]*?if\s*\(\s*!instance\s*\)/i.test(code),
      description: 'Singleton factory pattern for shared instances',
      recommendation: 'Use for services that should have only one instance'
    },
    {
      name: 'Repository Pattern',
      detect: (code) => /class\s+\w*Repository[\s\S]*?(?:findBy|findAll|save|delete)/i.test(code),
      description: 'Data access layer abstraction',
      recommendation: 'Use to decouple business logic from data access'
    },
    {
      name: 'Factory Pattern',
      detect: (code) => /(?:create|make|build)\w+\s*\([^)]*\)\s*{[\s\S]*?return\s+new\s+\w+/i.test(code),
      description: 'Object creation abstraction',
      recommendation: 'Use when object creation logic is complex'
    },
    {
      name: 'Event-Driven Architecture',
      detect: (code) => /(?:eventBus|emitter|publish|subscribe|on\s*\(|emit\s*\()/i.test(code),
      description: 'Decoupled communication via events',
      recommendation: 'Use for loosely coupled component communication'
    },
    {
      name: 'Middleware Pattern',
      detect: (code) => /(?:app\.use|router\.use|next\s*\(\s*\))/i.test(code),
      description: 'Chain of responsibility for request processing',
      recommendation: 'Use for cross-cutting concerns like logging, auth'
    }
  ],

  // Code smell patterns
  codeSmell: [
    {
      name: 'Long Method',
      detect: (code) => {
        const methods = code.match(/(?:function|async\s+function|\w+\s*\([^)]*\)\s*{)[^}]*}/g) || [];
        return methods.some(m => m.split('\n').length > 50);
      },
      description: 'Methods that are too long and do too much',
      recommendation: 'Extract into smaller, focused methods',
      severity: 'medium'
    },
    {
      name: 'Magic Numbers',
      detect: (code) => /(?<![.\d])\d{2,}(?![.\d])/.test(code) && !/(?:port|timeout|version)/i.test(code),
      description: 'Hardcoded numbers without explanation',
      recommendation: 'Extract to named constants',
      severity: 'low'
    },
    {
      name: 'Deeply Nested Code',
      detect: (code) => {
        const lines = code.split('\n');
        return lines.some(line => {
          const indent = line.match(/^\s*/)[0].length;
          return indent > 20 && /[{(]/.test(line);
        });
      },
      description: 'Too many levels of nesting',
      recommendation: 'Use early returns, extract methods',
      severity: 'medium'
    },
    {
      name: 'God Object',
      detect: (code) => {
        const methodCount = (code.match(/(?:async\s+)?(?:function|\w+\s*\([^)]*\)\s*{)/g) || []).length;
        return methodCount > 20;
      },
      description: 'Class/module with too many responsibilities',
      recommendation: 'Split into smaller, focused modules',
      severity: 'high'
    },
    {
      name: 'Dead Code',
      detect: (code) => /\/\/\s*TODO|FIXME|HACK|XXX|deprecated/i.test(code),
      description: 'Commented or unused code',
      recommendation: 'Remove dead code, use version control',
      severity: 'low'
    }
  ],

  // Bug patterns
  bug: [
    {
      name: 'Missing Await',
      detect: (code) => {
        // Check for promise-returning calls without await
        return /(?<!await\s)(?:\.then\(|new\s+Promise|async\s+)/.test(code) &&
               !/await\s/.test(code);
      },
      description: 'Async function called without await',
      recommendation: 'Add await before async calls',
      severity: 'high'
    },
    {
      name: 'Uncaught Promise Rejection',
      detect: (code) => /\.catch\s*\(\s*\)/.test(code) || (/Promise/.test(code) && !/\.catch|try\s*{/.test(code)),
      description: 'Promises without error handling',
      recommendation: 'Add .catch() or try/catch around async calls',
      severity: 'high'
    },
    {
      name: 'Null Reference Risk',
      detect: (code) => /\?\.|\.?\[\w+\]/.test(code) && !/\?\./.test(code.slice(0, 100)),
      description: 'Accessing properties without null checks',
      recommendation: 'Use optional chaining (?.) or explicit null checks',
      severity: 'medium'
    },
    {
      name: 'Race Condition Risk',
      detect: (code) => /Promise\.all\[.*,.*\].*(?:state|count|total)/i.test(code),
      description: 'Parallel operations modifying shared state',
      recommendation: 'Use proper synchronization or atomic operations',
      severity: 'high'
    }
  ],

  // Performance patterns
  performance: [
    {
      name: 'N+1 Query',
      detect: (code) => /for\s*\([^)]+\)\s*{[^}]*(?:await|\.find|\.query)/i.test(code),
      description: 'Database query inside loop',
      recommendation: 'Use batch queries or eager loading',
      severity: 'high'
    },
    {
      name: 'Missing Memoization',
      detect: (code) => {
        const expensive = /(?:map|filter|reduce|sort)\([^)]*\)/g;
        return (code.match(expensive) || []).length > 3;
      },
      description: 'Repeated expensive operations',
      recommendation: 'Use useMemo/useCallback or manual caching',
      severity: 'medium'
    },
    {
      name: 'Synchronous File I/O',
      detect: (code) => /readFileSync|writeFileSync|existsSync/i.test(code),
      description: 'Blocking file operations',
      recommendation: 'Use async versions (readFile, writeFile)',
      severity: 'medium'
    },
    {
      name: 'Large Object Serialization',
      detect: (code) => /JSON\.stringify\([^)]{50,}\)/i.test(code),
      description: 'Serializing large objects',
      recommendation: 'Stream large data, paginate results',
      severity: 'medium'
    }
  ],

  // Security patterns
  security: [
    {
      name: 'SQL Injection Risk',
      detect: (code) => /`SELECT[\s\S]*\$\{/.test(code) || /query\s*\(\s*['"`].*\+/.test(code),
      description: 'SQL query with string concatenation',
      recommendation: 'Use parameterized queries',
      severity: 'critical'
    },
    {
      name: 'Hardcoded Secrets',
      detect: (code) => /(?:password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{5,}/i.test(code),
      description: 'Secrets hardcoded in source',
      recommendation: 'Use environment variables or secret manager',
      severity: 'critical'
    },
    {
      name: 'XSS Vulnerability',
      detect: (code) => /innerHTML\s*=|dangerouslySetInnerHTML|v-html/i.test(code),
      description: 'Directly setting HTML content',
      recommendation: 'Sanitize user input, use textContent',
      severity: 'high'
    },
    {
      name: 'Insecure Random',
      detect: (code) => /Math\.random\s*\(\s*\).*(?:token|id|secret|password)/i.test(code),
      description: 'Using Math.random for security-sensitive values',
      recommendation: 'Use crypto.randomBytes or crypto.randomUUID',
      severity: 'high'
    },
    {
      name: 'Missing Input Validation',
      detect: (code) => /req\.(?:body|query|params)\.\w+/.test(code) && !/(?:validate|schema|check)/i.test(code),
      description: 'Using request data without validation',
      recommendation: 'Validate all input with Joi/Zod/etc',
      severity: 'high'
    }
  ],

  // Best practice patterns
  bestPractice: [
    {
      name: 'Error Boundary',
      detect: (code) => /componentDidCatch|ErrorBoundary|onErrorCaptured/i.test(code),
      description: 'Error handling for UI components',
      recommendation: 'Wrap critical components in error boundaries',
      isPositive: true
    },
    {
      name: 'Structured Logging',
      detect: (code) => /logger\.\w+\s*\(\s*['"][^'"]*['"]\s*,\s*\{/i.test(code),
      description: 'Logging with structured metadata',
      recommendation: 'Include relevant context in log messages',
      isPositive: true
    },
    {
      name: 'Dependency Injection',
      detect: (code) => /constructor\s*\([^)]*(?:Service|Repository|Client)[^)]*\)/i.test(code),
      description: 'Dependencies injected through constructor',
      recommendation: 'Use DI for testability and flexibility',
      isPositive: true
    },
    {
      name: 'Graceful Shutdown',
      detect: (code) => /process\.on\s*\(\s*['"](?:SIGTERM|SIGINT)['"]/i.test(code),
      description: 'Handling shutdown signals properly',
      recommendation: 'Clean up resources on shutdown',
      isPositive: true
    }
  ]
};

class PatternRecognitionEngine {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.initialized = false;

    // Configuration
    this.config = {
      enableAutoLearn: options.enableAutoLearn ?? true,
      minConfidence: options.minConfidence || 0.7,
      customDetectors: options.customDetectors || []
    };

    // Custom learned patterns
    this.learnedPatterns = new Map();

    // Statistics
    this.stats = {
      analyzed: 0,
      patternsDetected: 0,
      byCategory: {}
    };

    // Initialize category counters
    Object.values(PATTERN_CATEGORIES).forEach(cat => {
      this.stats.byCategory[cat] = 0;
    });
  }

  /**
   * Initialize the engine
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.knowledgeBrain = getKnowledgeBrain();
      await this.knowledgeBrain.initialize();
    } catch (error) {
      this.logger.warn('Dependencies not fully available');
    }

    // Load learned patterns from knowledge brain
    if (this.knowledgeBrain) {
      await this.loadLearnedPatterns();
    }

    this.initialized = true;
    this.logger.info('PatternRecognitionEngine initialized', {
      builtInPatterns: this.countBuiltInPatterns(),
      learnedPatterns: this.learnedPatterns.size
    });
  }

  /**
   * Count built-in patterns
   */
  countBuiltInPatterns() {
    return Object.values(PATTERN_DETECTORS)
      .reduce((sum, patterns) => sum + patterns.length, 0);
  }

  /**
   * Load learned patterns from knowledge brain
   */
  async loadLearnedPatterns() {
    const patterns = await this.knowledgeBrain.recall({
      type: KNOWLEDGE_TYPES.CODE_PATTERN,
      limit: 100
    });

    for (const pattern of patterns) {
      if (pattern.content?.detector) {
        this.learnedPatterns.set(pattern.id, pattern);
      }
    }

    this.logger.debug(`Loaded ${patterns.length} learned patterns`);
  }

  /**
   * Analyze code for patterns
   * @param {string} code The code to analyze
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} Detected patterns
   */
  async detectPatterns(code, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      categories = Object.values(PATTERN_CATEGORIES),
      includePositive = true,
      minSeverity = 'low'
    } = options;

    this.stats.analyzed++;
    const results = {
      patterns: [],
      summary: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {}
      },
      recommendations: []
    };

    const severityOrder = ['low', 'medium', 'high', 'critical'];
    const minSeverityIndex = severityOrder.indexOf(minSeverity);

    // Run built-in detectors
    for (const [category, detectors] of Object.entries(PATTERN_DETECTORS)) {
      if (!this.mapCategoryToPatternCategory(category, categories)) continue;

      for (const detector of detectors) {
        try {
          if (detector.detect(code)) {
            const severity = detector.severity || 'medium';
            const severityIndex = severityOrder.indexOf(severity);

            // Skip if below minimum severity (unless positive pattern)
            if (!detector.isPositive && severityIndex < minSeverityIndex) continue;

            // Skip positive patterns if not requested
            if (detector.isPositive && !includePositive) continue;

            const pattern = {
              name: detector.name,
              category,
              description: detector.description,
              recommendation: detector.recommendation,
              severity,
              isPositive: detector.isPositive || false,
              confidence: 0.9
            };

            results.patterns.push(pattern);
            results.summary.total++;

            if (severity && results.summary.bySeverity[severity] !== undefined) {
              results.summary.bySeverity[severity]++;
            }

            if (!results.summary.byCategory[category]) {
              results.summary.byCategory[category] = 0;
            }
            results.summary.byCategory[category]++;

            this.stats.patternsDetected++;
            this.stats.byCategory[category] = (this.stats.byCategory[category] || 0) + 1;

            if (detector.recommendation && !detector.isPositive) {
              results.recommendations.push({
                pattern: detector.name,
                action: detector.recommendation,
                priority: severity === 'critical' ? 'immediate' :
                         severity === 'high' ? 'high' : 'normal'
              });
            }
          }
        } catch (error) {
          this.logger.debug(`Detector ${detector.name} failed`, { error: error.message });
        }
      }
    }

    // Run custom/learned detectors
    for (const [id, pattern] of this.learnedPatterns) {
      try {
        const detector = new Function('code', pattern.content.detector);
        if (detector(code)) {
          results.patterns.push({
            name: pattern.content.name,
            category: pattern.content.category || 'custom',
            description: pattern.content.description,
            recommendation: pattern.content.recommendation,
            severity: pattern.content.severity || 'medium',
            confidence: 0.7,
            learned: true
          });
          results.summary.total++;
        }
      } catch (error) {
        // Skip invalid learned patterns
      }
    }

    // Sort recommendations by priority
    results.recommendations.sort((a, b) => {
      const priorityOrder = { immediate: 0, high: 1, normal: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Store patterns for learning if enabled
    if (this.config.enableAutoLearn && this.knowledgeBrain) {
      await this.learnFromAnalysis(code, results);
    }

    return results;
  }

  /**
   * Map category name to pattern category
   */
  mapCategoryToPatternCategory(detectorCategory, requestedCategories) {
    const mapping = {
      architectural: PATTERN_CATEGORIES.ARCHITECTURAL,
      codeSmell: PATTERN_CATEGORIES.CODE_SMELL,
      bug: PATTERN_CATEGORIES.BUG,
      performance: PATTERN_CATEGORIES.PERFORMANCE,
      security: PATTERN_CATEGORIES.SECURITY,
      bestPractice: PATTERN_CATEGORIES.BEST_PRACTICE
    };

    const mappedCategory = mapping[detectorCategory];
    return requestedCategories.includes(mappedCategory);
  }

  /**
   * Learn from analysis results
   */
  async learnFromAnalysis(code, results) {
    // Extract and store interesting patterns
    for (const pattern of results.patterns) {
      if (pattern.isPositive || pattern.severity === 'critical') {
        await this.knowledgeBrain.learn({
          type: KNOWLEDGE_TYPES.CODE_PATTERN,
          content: {
            name: pattern.name,
            category: pattern.category,
            codeSnippet: this.extractRelevantSnippet(code, pattern),
            description: pattern.description
          },
          tags: [pattern.category, pattern.severity || 'pattern'],
          quality: QUALITY_LEVELS.COMMUNITY
        });
      }
    }
  }

  /**
   * Extract relevant code snippet for a pattern
   */
  extractRelevantSnippet(code, pattern) {
    // Get a context window around the pattern
    const lines = code.split('\n');
    const maxLines = 20;

    if (lines.length <= maxLines) {
      return code;
    }

    // Try to find the relevant section
    const patternKeywords = pattern.name.toLowerCase().split(' ');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toLowerCase();
      if (patternKeywords.some(kw => line.includes(kw))) {
        const start = Math.max(0, i - 5);
        const end = Math.min(lines.length, i + 15);
        return lines.slice(start, end).join('\n');
      }
    }

    return lines.slice(0, maxLines).join('\n');
  }

  /**
   * Find patterns in codebase
   * @param {Object} codebase Map of file paths to code content
   * @returns {Promise<Object>} Patterns found across codebase
   */
  async analyzeCodebase(codebase) {
    const results = {
      files: {},
      aggregate: {
        total: 0,
        bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
        byCategory: {},
        topPatterns: []
      },
      recommendations: []
    };

    const patternCounts = new Map();

    for (const [filePath, code] of Object.entries(codebase)) {
      const fileResults = await this.detectPatterns(code);
      results.files[filePath] = fileResults;

      // Aggregate
      results.aggregate.total += fileResults.summary.total;

      for (const [severity, count] of Object.entries(fileResults.summary.bySeverity)) {
        results.aggregate.bySeverity[severity] += count;
      }

      for (const [category, count] of Object.entries(fileResults.summary.byCategory)) {
        results.aggregate.byCategory[category] =
          (results.aggregate.byCategory[category] || 0) + count;
      }

      // Track pattern frequency
      for (const pattern of fileResults.patterns) {
        const count = patternCounts.get(pattern.name) || 0;
        patternCounts.set(pattern.name, count + 1);
      }

      // Collect recommendations
      for (const rec of fileResults.recommendations) {
        const existingRec = results.recommendations.find(r => r.pattern === rec.pattern);
        if (existingRec) {
          existingRec.files = existingRec.files || [];
          existingRec.files.push(filePath);
        } else {
          results.recommendations.push({
            ...rec,
            files: [filePath]
          });
        }
      }
    }

    // Calculate top patterns
    results.aggregate.topPatterns = Array.from(patternCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return results;
  }

  /**
   * Generate templates from positive patterns
   */
  async generateTemplates(code) {
    const patterns = await this.detectPatterns(code, { includePositive: true });
    const templates = [];

    for (const pattern of patterns.patterns.filter(p => p.isPositive)) {
      const snippet = this.extractRelevantSnippet(code, pattern);

      templates.push({
        name: `${pattern.name} Template`,
        category: pattern.category,
        description: pattern.description,
        template: this.templatize(snippet),
        usage: pattern.recommendation
      });
    }

    return templates;
  }

  /**
   * Convert code to template
   */
  templatize(code) {
    return code
      // Replace specific names with placeholders
      .replace(/class\s+(\w+)/g, 'class ${ClassName}')
      .replace(/function\s+(\w+)/g, 'function ${functionName}')
      .replace(/const\s+(\w+)\s*=/g, 'const ${variableName} =')
      // Keep structure but mark customizable parts
      .replace(/'[^']+'/g, "'${value}'")
      .replace(/"[^"]+"/g, '"${value}"');
  }

  /**
   * Learn a new pattern
   */
  async learnPattern(pattern) {
    const {
      name,
      detector, // Function or string
      category = PATTERN_CATEGORIES.BEST_PRACTICE,
      description = '',
      recommendation = '',
      severity = 'medium'
    } = pattern;

    // Validate detector
    if (typeof detector === 'string') {
      try {
        new Function('code', detector);
      } catch (error) {
        throw new Error(`Invalid detector function: ${error.message}`);
      }
    }

    const patternData = {
      name,
      detector: typeof detector === 'string' ? detector : detector.toString(),
      category,
      description,
      recommendation,
      severity
    };

    // Store in knowledge brain
    if (this.knowledgeBrain) {
      const item = await this.knowledgeBrain.learn({
        type: KNOWLEDGE_TYPES.CODE_PATTERN,
        content: patternData,
        tags: [category, 'learned-pattern'],
        quality: QUALITY_LEVELS.COMMUNITY
      });

      this.learnedPatterns.set(item.id, item);
      this.logger.info('Learned new pattern', { name });

      return item;
    }

    return patternData;
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      builtInPatterns: this.countBuiltInPatterns(),
      learnedPatterns: this.learnedPatterns.size
    };
  }

  /**
   * Get all available pattern names
   */
  getAvailablePatterns() {
    const patterns = {};

    for (const [category, detectors] of Object.entries(PATTERN_DETECTORS)) {
      patterns[category] = detectors.map(d => ({
        name: d.name,
        description: d.description,
        severity: d.severity,
        isPositive: d.isPositive
      }));
    }

    patterns.learned = Array.from(this.learnedPatterns.values()).map(p => ({
      name: p.content.name,
      description: p.content.description,
      category: p.content.category
    }));

    return patterns;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of PatternRecognitionEngine
 * @returns {PatternRecognitionEngine}
 */
export function getPatternRecognitionEngine(options = {}) {
  if (!instance) {
    instance = new PatternRecognitionEngine(options);
  }
  return instance;
}

export { PatternRecognitionEngine, PATTERN_CATEGORIES, PATTERN_DETECTORS };
export default PatternRecognitionEngine;
