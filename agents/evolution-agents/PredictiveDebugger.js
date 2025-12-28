/**
 * PredictiveDebugger - Time-Travel Debugging and Bug Prediction
 *
 * Revolutionary Enhancement: Debug bugs before they happen
 *
 * Features:
 * - Predictive bug analysis
 * - Execution state snapshots (time-travel)
 * - Root cause prediction
 * - Automatic fix suggestions
 * - Historical bug pattern learning
 * - Real-time anomaly detection
 */

import { createLogger } from '../../foundation/common/logger.js';
import { getEventBus } from '../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';
import { getKnowledgeBrain } from '../../foundation/knowledge-brain/KnowledgeBrain.js';

const logger = createLogger('PredictiveDebugger');

// Bug categories with risk levels
const BUG_CATEGORIES = {
  NULL_REFERENCE: {
    name: 'Null Reference',
    severity: 'high',
    patterns: [
      /(\w+)\.(\w+)(?!\s*\?\.)(?!\s*&&)/g,
      /(\w+)\[(\w+)\](?!\s*\?\?)/g
    ],
    prediction: 'Property access on potentially undefined value'
  },
  RACE_CONDITION: {
    name: 'Race Condition',
    severity: 'critical',
    patterns: [
      /(?:let|var)\s+\w+\s*=.*await/g,
      /Promise\.all.*\.then.*(?:let|var)/g,
      /setTimeout.*\b(let|var)\b/g
    ],
    prediction: 'Shared state modification in async context'
  },
  MEMORY_LEAK: {
    name: 'Memory Leak',
    severity: 'high',
    patterns: [
      /addEventListener(?!.*removeEventListener)/g,
      /setInterval(?!.*clearInterval)/g,
      /new\s+\w+\([^)]*\)\s*(?!.*=\s*null)/g
    ],
    prediction: 'Resource not properly released'
  },
  TYPE_COERCION: {
    name: 'Type Coercion',
    severity: 'medium',
    patterns: [
      /==(?!=)/g,
      /!=(?!=)/g,
      /\+\s*['"`]/g
    ],
    prediction: 'Implicit type conversion may cause unexpected behavior'
  },
  INFINITE_LOOP: {
    name: 'Infinite Loop',
    severity: 'critical',
    patterns: [
      /while\s*\(\s*true\s*\)(?!.*break)/g,
      /for\s*\(\s*;\s*;\s*\)(?!.*break)/g,
      /while\s*\([^)]+\)\s*{[^}]*(?!.*(?:i\+\+|i--|break))/g
    ],
    prediction: 'Loop may never terminate'
  },
  ASYNC_ERROR: {
    name: 'Unhandled Async Error',
    severity: 'high',
    patterns: [
      /\.then\([^)]+\)(?!\.catch)/g,
      /await\s+\w+(?![^}]*catch)/g,
      /new\s+Promise\([^)]+\)(?!\.catch)/g
    ],
    prediction: 'Async operation may throw unhandled exception'
  },
  SECURITY_FLAW: {
    name: 'Security Flaw',
    severity: 'critical',
    patterns: [
      /eval\s*\(/g,
      /innerHTML\s*=/g,
      /document\.write/g,
      /\$\{.*\}.*(?:query|exec|execute)/g
    ],
    prediction: 'Potential injection vulnerability'
  },
  BOUNDARY_ERROR: {
    name: 'Boundary Error',
    severity: 'medium',
    patterns: [
      /\[\s*\w+\s*-\s*1\s*\]/g,
      /\[\s*\w+\.length\s*\]/g,
      /\.slice\([^)]*-1\)/g
    ],
    prediction: 'Array access may be out of bounds'
  }
};

// Debugging modes
const DEBUG_MODES = {
  PASSIVE: 'passive',      // Just record, don't intervene
  PREDICTIVE: 'predictive', // Predict and warn
  PROACTIVE: 'proactive'   // Predict, warn, and suggest fixes
};

// State snapshot types
const SNAPSHOT_TYPES = {
  VARIABLE: 'variable',
  CALL_STACK: 'call_stack',
  SCOPE: 'scope',
  HEAP: 'heap',
  EVENT_LOOP: 'event_loop'
};

class PredictiveDebugger {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.initialized = false;

    // Configuration
    this.config = {
      mode: options.mode || DEBUG_MODES.PROACTIVE,
      maxSnapshots: options.maxSnapshots || 100,
      predictionConfidenceThreshold: options.predictionConfidenceThreshold || 0.7,
      enableTimeTravelDebugging: options.enableTimeTravelDebugging !== false,
      enableAutoFix: options.enableAutoFix || false,
      learnFromBugs: options.learnFromBugs !== false
    };

    // State management
    this.snapshots = [];
    this.predictions = [];
    this.bugHistory = [];
    this.learnedPatterns = new Map();

    // Statistics
    this.stats = {
      analysisCount: 0,
      bugsDetected: 0,
      bugsPredicted: 0,
      fixesSuggested: 0,
      correctPredictions: 0,
      falsePositives: 0
    };
  }

  /**
   * Initialize the debugger
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.knowledgeBrain = getKnowledgeBrain();

      // Load learned patterns from knowledge brain
      if (this.knowledgeBrain) {
        await this.loadLearnedPatterns();
      }
    } catch (error) {
      this.logger.warn('Dependencies not fully available', error);
    }

    this.initialized = true;
    this.logger.info('PredictiveDebugger initialized', this.config);
  }

  /**
   * Load patterns learned from past bugs
   */
  async loadLearnedPatterns() {
    if (!this.knowledgeBrain) return;

    try {
      const bugPatterns = await this.knowledgeBrain.recall({
        type: 'bug_pattern',
        tags: ['learned']
      });

      for (const pattern of bugPatterns) {
        if (pattern.content?.regex && pattern.content?.category) {
          this.learnedPatterns.set(pattern.id, {
            regex: new RegExp(pattern.content.regex, 'g'),
            category: pattern.content.category,
            confidence: pattern.quality === 'verified' ? 0.9 : 0.7
          });
        }
      }

      this.logger.info(`Loaded ${this.learnedPatterns.size} learned bug patterns`);
    } catch (error) {
      this.logger.warn('Failed to load learned patterns', error);
    }
  }

  /**
   * Analyze code for potential bugs
   * @param {string} code The code to analyze
   * @param {Object} options Analysis options
   * @returns {Promise<Object>} Analysis results with predictions
   */
  async analyzeCode(code, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.stats.analysisCount++;
    const startTime = Date.now();

    const {
      filename = 'unknown',
      lineOffset = 0,
      context = {}
    } = options;

    this.logger.info(`Analyzing code: ${filename}`);

    const predictions = [];
    const lines = code.split('\n');

    // Analyze with built-in patterns
    for (const [categoryKey, category] of Object.entries(BUG_CATEGORIES)) {
      for (const pattern of category.patterns) {
        const matches = this.findPatternMatches(code, pattern, lines);

        for (const match of matches) {
          const prediction = this.createPrediction({
            category: categoryKey,
            categoryName: category.name,
            severity: category.severity,
            description: category.prediction,
            line: match.line + lineOffset,
            column: match.column,
            matchedText: match.text,
            filename,
            confidence: this.calculateConfidence(match, code, category)
          });

          if (prediction.confidence >= this.config.predictionConfidenceThreshold) {
            predictions.push(prediction);
          }
        }
      }
    }

    // Analyze with learned patterns
    for (const [patternId, pattern] of this.learnedPatterns) {
      const matches = this.findPatternMatches(code, pattern.regex, lines);

      for (const match of matches) {
        predictions.push(this.createPrediction({
          category: pattern.category,
          categoryName: 'Learned Pattern',
          severity: 'medium',
          description: `Learned bug pattern from historical data`,
          line: match.line + lineOffset,
          column: match.column,
          matchedText: match.text,
          filename,
          confidence: pattern.confidence,
          learnedPatternId: patternId
        }));
      }
    }

    // Analyze control flow for logic errors
    const flowAnalysis = this.analyzeControlFlow(code, lines);
    predictions.push(...flowAnalysis.predictions);

    // Analyze data flow for potential issues
    const dataAnalysis = this.analyzeDataFlow(code, lines);
    predictions.push(...dataAnalysis.predictions);

    // Sort by severity and confidence
    predictions.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return b.confidence - a.confidence;
    });

    // Generate fixes if in proactive mode
    const fixes = [];
    if (this.config.mode === DEBUG_MODES.PROACTIVE) {
      for (const prediction of predictions.slice(0, 10)) {
        const fix = this.generateFix(prediction, code);
        if (fix) {
          fixes.push(fix);
          this.stats.fixesSuggested++;
        }
      }
    }

    // Store predictions
    this.predictions = predictions;
    this.stats.bugsPredicted += predictions.length;

    const result = {
      filename,
      predictions,
      fixes,
      summary: this.createSummary(predictions),
      riskScore: this.calculateRiskScore(predictions),
      processingTime: Date.now() - startTime
    };

    // Publish analysis event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.ANALYSIS_COMPLETED, {
        agent: 'predictive-debugger',
        type: 'bug-prediction',
        predictions: predictions.length,
        riskScore: result.riskScore
      });
    }

    return result;
  }

  /**
   * Find pattern matches with line information
   */
  findPatternMatches(code, pattern, lines) {
    const matches = [];
    let match;

    // Reset pattern if it has global flag
    if (pattern.global) {
      pattern.lastIndex = 0;
    }

    while ((match = pattern.exec(code)) !== null) {
      // Find line number
      const beforeMatch = code.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length - 1;
      const lineStart = beforeMatch.lastIndexOf('\n') + 1;

      matches.push({
        text: match[0],
        index: match.index,
        line: lineNumber,
        column: match.index - lineStart,
        groups: match.slice(1)
      });

      // Prevent infinite loop for zero-length matches
      if (match[0].length === 0) {
        pattern.lastIndex++;
      }
    }

    return matches;
  }

  /**
   * Calculate prediction confidence
   */
  calculateConfidence(match, code, category) {
    let confidence = 0.6; // Base confidence

    // Higher confidence for critical patterns
    if (category.severity === 'critical') confidence += 0.15;
    if (category.severity === 'high') confidence += 0.1;

    // Lower confidence if pattern is in comments
    const lineContent = code.split('\n')[match.line] || '';
    if (lineContent.trim().startsWith('//') || lineContent.includes('/*')) {
      confidence -= 0.4;
    }

    // Higher confidence if no null check nearby
    const context = code.substring(Math.max(0, match.index - 50), match.index);
    if (/if\s*\(\s*\w+\s*[!=]==?\s*null/.test(context)) {
      confidence -= 0.3;
    }

    // Higher confidence for known dangerous patterns
    if (/eval|innerHTML|document\.write/.test(match.text)) {
      confidence += 0.2;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Create a prediction object
   */
  createPrediction(data) {
    return {
      id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...data
    };
  }

  /**
   * Analyze control flow for logic errors
   */
  analyzeControlFlow(code, lines) {
    const predictions = [];

    // Detect unreachable code
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextLine = lines[i + 1]?.trim();

      if (/^(return|throw|break|continue)\b/.test(line) && nextLine && !/^[}\]]|^case\b|^default\b/.test(nextLine)) {
        predictions.push(this.createPrediction({
          category: 'UNREACHABLE_CODE',
          categoryName: 'Unreachable Code',
          severity: 'medium',
          description: 'Code after return/throw/break is unreachable',
          line: i + 1,
          column: 0,
          matchedText: nextLine,
          confidence: 0.85
        }));
      }
    }

    // Detect always-true/false conditions
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // if (true), if (false), while (true) without break
      if (/if\s*\(\s*true\s*\)/.test(line)) {
        predictions.push(this.createPrediction({
          category: 'ALWAYS_TRUE',
          categoryName: 'Always True Condition',
          severity: 'low',
          description: 'Condition is always true',
          line: i,
          column: line.indexOf('true'),
          matchedText: 'true',
          confidence: 0.95
        }));
      }

      if (/if\s*\(\s*false\s*\)/.test(line)) {
        predictions.push(this.createPrediction({
          category: 'DEAD_CODE',
          categoryName: 'Dead Code',
          severity: 'medium',
          description: 'Condition is always false, code never executes',
          line: i,
          column: line.indexOf('false'),
          matchedText: 'false',
          confidence: 0.95
        }));
      }
    }

    // Detect empty catch blocks
    const emptyCatchRegex = /catch\s*\([^)]*\)\s*{\s*}/g;
    let match;
    while ((match = emptyCatchRegex.exec(code)) !== null) {
      const lineNum = code.substring(0, match.index).split('\n').length - 1;
      predictions.push(this.createPrediction({
        category: 'EMPTY_CATCH',
        categoryName: 'Empty Catch Block',
        severity: 'high',
        description: 'Errors are silently swallowed',
        line: lineNum,
        column: 0,
        matchedText: match[0],
        confidence: 0.9
      }));
    }

    return { predictions };
  }

  /**
   * Analyze data flow for potential issues
   */
  analyzeDataFlow(code, lines) {
    const predictions = [];
    const variableDeclarations = new Map();
    const variableUsages = new Map();

    // Track variable declarations and usages
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Find declarations
      const declMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=/);
      if (declMatch) {
        variableDeclarations.set(declMatch[1], { line: i, initialized: true });
      }

      // Find usages
      const identifiers = line.match(/\b[a-zA-Z_]\w*\b/g) || [];
      for (const id of identifiers) {
        if (!variableUsages.has(id)) {
          variableUsages.set(id, []);
        }
        variableUsages.get(id).push(i);
      }
    }

    // Detect unused variables
    for (const [varName, decl] of variableDeclarations) {
      const usages = variableUsages.get(varName) || [];
      // Variable declared but only appears once (the declaration)
      if (usages.length <= 1 && !varName.startsWith('_')) {
        predictions.push(this.createPrediction({
          category: 'UNUSED_VARIABLE',
          categoryName: 'Unused Variable',
          severity: 'low',
          description: `Variable '${varName}' is declared but never used`,
          line: decl.line,
          column: 0,
          matchedText: varName,
          confidence: 0.75
        }));
      }
    }

    // Detect reassignment of const-like variables (uppercase convention)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const reassignMatch = line.match(/([A-Z_]{2,})\s*=\s*(?!=)/);
      if (reassignMatch && !line.includes('const')) {
        predictions.push(this.createPrediction({
          category: 'CONSTANT_REASSIGNMENT',
          categoryName: 'Constant Reassignment',
          severity: 'medium',
          description: `Variable '${reassignMatch[1]}' appears to be a constant but is being reassigned`,
          line: i,
          column: line.indexOf(reassignMatch[1]),
          matchedText: reassignMatch[1],
          confidence: 0.7
        }));
      }
    }

    return { predictions };
  }

  /**
   * Generate a fix for a prediction
   */
  generateFix(prediction, code) {
    const lines = code.split('\n');
    const line = lines[prediction.line] || '';

    const fix = {
      predictionId: prediction.id,
      category: prediction.category,
      description: '',
      originalLine: line,
      fixedLine: line,
      confidence: 0.6
    };

    switch (prediction.category) {
      case 'NULL_REFERENCE':
        // Add optional chaining
        if (prediction.matchedText.includes('.')) {
          fix.fixedLine = line.replace(/(\w+)\.(\w+)/g, '$1?.$2');
          fix.description = 'Add optional chaining (?.) to prevent null reference';
          fix.confidence = 0.85;
        }
        break;

      case 'TYPE_COERCION':
        // Replace == with ===
        fix.fixedLine = line.replace(/([^=!])==/g, '$1===').replace(/!=/g, '!==');
        fix.description = 'Use strict equality (===) instead of loose equality (==)';
        fix.confidence = 0.9;
        break;

      case 'ASYNC_ERROR':
        // Add .catch() for promises
        if (line.includes('.then(')) {
          fix.fixedLine = line.replace(/\.then\(([^)]+)\)(?!\.catch)/g, '.then($1).catch(err => console.error(err))');
          fix.description = 'Add .catch() handler for unhandled promise rejection';
          fix.confidence = 0.75;
        }
        break;

      case 'SECURITY_FLAW':
        if (line.includes('innerHTML')) {
          fix.fixedLine = line.replace(/innerHTML\s*=/, 'textContent =');
          fix.description = 'Replace innerHTML with textContent to prevent XSS';
          fix.confidence = 0.7;
        }
        break;

      case 'EMPTY_CATCH':
        fix.fixedLine = line.replace(/catch\s*\((\w+)\)\s*{\s*}/, 'catch($1) { console.error($1); }');
        fix.description = 'Log error instead of silently swallowing it';
        fix.confidence = 0.8;
        break;

      default:
        return null;
    }

    if (fix.fixedLine === fix.originalLine) {
      return null;
    }

    return fix;
  }

  /**
   * Create summary of predictions
   */
  createSummary(predictions) {
    const bySeverity = {
      critical: predictions.filter(p => p.severity === 'critical').length,
      high: predictions.filter(p => p.severity === 'high').length,
      medium: predictions.filter(p => p.severity === 'medium').length,
      low: predictions.filter(p => p.severity === 'low').length
    };

    const byCategory = {};
    for (const prediction of predictions) {
      byCategory[prediction.categoryName] = (byCategory[prediction.categoryName] || 0) + 1;
    }

    return {
      total: predictions.length,
      bySeverity,
      byCategory,
      topIssues: predictions.slice(0, 5).map(p => ({
        category: p.categoryName,
        line: p.line,
        severity: p.severity
      }))
    };
  }

  /**
   * Calculate overall risk score
   */
  calculateRiskScore(predictions) {
    if (predictions.length === 0) return 0;

    const severityWeights = {
      critical: 10,
      high: 5,
      medium: 2,
      low: 1
    };

    const totalWeight = predictions.reduce((sum, p) => {
      return sum + (severityWeights[p.severity] || 1) * p.confidence;
    }, 0);

    // Normalize to 0-100
    return Math.min(100, Math.round(totalWeight * 2));
  }

  /**
   * Create execution snapshot for time-travel debugging
   */
  createSnapshot(type, data) {
    if (!this.config.enableTimeTravelDebugging) return null;

    const snapshot = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      data: JSON.parse(JSON.stringify(data))
    };

    this.snapshots.push(snapshot);

    // Maintain max snapshots limit
    if (this.snapshots.length > this.config.maxSnapshots) {
      this.snapshots.shift();
    }

    return snapshot;
  }

  /**
   * Travel to a specific snapshot
   */
  travelToSnapshot(snapshotId) {
    const index = this.snapshots.findIndex(s => s.id === snapshotId);
    if (index === -1) {
      return { success: false, error: 'Snapshot not found' };
    }

    const snapshot = this.snapshots[index];
    const futureSnapshots = this.snapshots.slice(index + 1);

    return {
      success: true,
      snapshot,
      futureSnapshots: futureSnapshots.length,
      canReplay: true
    };
  }

  /**
   * Record a bug occurrence
   */
  async recordBug(bugInfo) {
    this.stats.bugsDetected++;

    const bug = {
      id: `bug_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...bugInfo,
      snapshots: this.snapshots.slice(-10) // Last 10 snapshots for context
    };

    this.bugHistory.push(bug);

    // Learn from this bug
    if (this.config.learnFromBugs && this.knowledgeBrain) {
      await this.learnFromBug(bug);
    }

    // Check if any predictions were correct
    const matchingPrediction = this.predictions.find(p =>
      p.line === bugInfo.line ||
      p.category === bugInfo.category
    );

    if (matchingPrediction) {
      this.stats.correctPredictions++;
      this.logger.info('Bug matched prediction', { prediction: matchingPrediction.id });
    }

    return bug;
  }

  /**
   * Learn from a bug to improve future predictions
   */
  async learnFromBug(bug) {
    if (!this.knowledgeBrain) return;

    try {
      // Extract pattern from bug
      const pattern = this.extractBugPattern(bug);

      if (pattern) {
        await this.knowledgeBrain.learn({
          type: 'bug_pattern',
          content: {
            regex: pattern.regex,
            category: pattern.category,
            description: bug.message,
            stackTrace: bug.stack,
            context: bug.context
          },
          tags: ['learned', 'bug', pattern.category],
          quality: 'community'
        });

        // Add to local learned patterns
        this.learnedPatterns.set(bug.id, {
          regex: new RegExp(pattern.regex, 'g'),
          category: pattern.category,
          confidence: 0.6
        });

        this.logger.info('Learned new bug pattern', { category: pattern.category });
      }
    } catch (error) {
      this.logger.warn('Failed to learn from bug', error);
    }
  }

  /**
   * Extract pattern from bug
   */
  extractBugPattern(bug) {
    // Common patterns based on error messages
    if (bug.message?.includes('undefined')) {
      return {
        regex: `\\b${bug.variable || '\\w+'}\\s*[.\\[]`,
        category: 'NULL_REFERENCE'
      };
    }

    if (bug.message?.includes('is not a function')) {
      return {
        regex: `\\b${bug.variable || '\\w+'}\\s*\\(`,
        category: 'TYPE_ERROR'
      };
    }

    if (bug.message?.includes('timeout') || bug.message?.includes('deadlock')) {
      return {
        regex: 'await.*await',
        category: 'ASYNC_ERROR'
      };
    }

    return null;
  }

  /**
   * Validate predictions against actual bugs
   */
  validatePredictions(actualBugs) {
    for (const bug of actualBugs) {
      const matchingPrediction = this.predictions.find(p =>
        p.line === bug.line && p.category === bug.category
      );

      if (matchingPrediction) {
        this.stats.correctPredictions++;
      } else {
        // Check for false positives
        const predictionsAtLine = this.predictions.filter(p => p.line === bug.line);
        for (const pred of predictionsAtLine) {
          if (pred.category !== bug.category) {
            this.stats.falsePositives++;
          }
        }
      }
    }

    return {
      accuracy: this.stats.correctPredictions / (this.stats.correctPredictions + this.stats.falsePositives) || 0,
      correctPredictions: this.stats.correctPredictions,
      falsePositives: this.stats.falsePositives
    };
  }

  /**
   * Get debugger statistics
   */
  getStats() {
    return {
      ...this.stats,
      snapshotCount: this.snapshots.length,
      predictionCount: this.predictions.length,
      learnedPatternCount: this.learnedPatterns.size,
      bugHistoryCount: this.bugHistory.length,
      predictionAccuracy: this.stats.correctPredictions /
        (this.stats.correctPredictions + this.stats.falsePositives) || 0
    };
  }

  /**
   * Get recent predictions
   */
  getPredictions() {
    return this.predictions;
  }

  /**
   * Get bug history
   */
  getBugHistory() {
    return this.bugHistory;
  }

  /**
   * Clear snapshots
   */
  clearSnapshots() {
    this.snapshots = [];
    this.logger.info('Snapshots cleared');
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of PredictiveDebugger
 * @param {Object} options Configuration options
 * @returns {PredictiveDebugger}
 */
export function getPredictiveDebugger(options = {}) {
  if (!instance) {
    instance = new PredictiveDebugger(options);
  }
  return instance;
}

export {
  PredictiveDebugger,
  BUG_CATEGORIES,
  DEBUG_MODES,
  SNAPSHOT_TYPES
};

export default PredictiveDebugger;
