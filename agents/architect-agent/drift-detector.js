/**
 * Minions - Drift Detector
 * ========================
 * Monitors code for architectural drift and violations.
 * Detects unauthorized dependencies, layer violations, and pattern deviations.
 */

import EventEmitter from 'events';
import path from 'path';

// Drift Categories
const DriftCategories = {
  DEPENDENCY: 'dependency',
  LAYER: 'layer',
  PATTERN: 'pattern',
  NAMING: 'naming',
  STRUCTURE: 'structure',
  SECURITY: 'security'
};

// Severity Levels
const Severity = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

// Common anti-patterns to detect
const AntiPatterns = {
  GOD_OBJECT: {
    name: 'God Object',
    description: 'Class/module with too many responsibilities',
    detection: (content) => {
      const methodCount = (content.match(/\bfunction\b|\basync\b\s+\w+\s*\(|=>\s*{/g) || []).length;
      return methodCount > 20;
    },
    severity: Severity.WARNING
  },
  CIRCULAR_DEPENDENCY: {
    name: 'Circular Dependency',
    description: 'Modules that depend on each other',
    detection: null, // Requires dependency graph analysis
    severity: Severity.ERROR
  },
  HARDCODED_CONFIG: {
    name: 'Hardcoded Configuration',
    description: 'Configuration values hardcoded in source',
    detection: (content) => {
      const patterns = [
        /['"]localhost:\d+['"]/,
        /['"]mongodb:\/\/[^'"]+['"]/,
        /['"]redis:\/\/[^'"]+['"]/,
        /password\s*[:=]\s*['"][^'"]+['"]/i,
        /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/i
      ];
      return patterns.some(p => p.test(content));
    },
    severity: Severity.ERROR
  },
  MISSING_ERROR_HANDLING: {
    name: 'Missing Error Handling',
    description: 'Async operations without try-catch',
    detection: (content) => {
      const hasAsync = content.includes('async ');
      const hasTryCatch = content.includes('try {') || content.includes('try{');
      const hasCatch = content.includes('.catch(');
      return hasAsync && !hasTryCatch && !hasCatch;
    },
    severity: Severity.WARNING
  },
  DIRECT_DB_IN_CONTROLLER: {
    name: 'Direct Database in Controller',
    description: 'Controller accessing database directly',
    detection: (content, filePath) => {
      if (!filePath.includes('controller')) return false;
      return content.includes('mongoose.') || 
             content.includes('.findOne(') || 
             content.includes('.find(') ||
             content.includes('.save()') ||
             content.includes('prisma.');
    },
    severity: Severity.ERROR
  },
  BUSINESS_LOGIC_IN_ROUTE: {
    name: 'Business Logic in Route',
    description: 'Route handler containing business logic',
    detection: (content, filePath) => {
      if (!filePath.includes('route')) return false;
      // Check for significant logic in route handlers
      const handlers = content.match(/\(req,\s*res[^)]*\)\s*=>\s*{[^}]{200,}}/g);
      return handlers && handlers.length > 0;
    },
    severity: Severity.WARNING
  },
  MIXED_CONCERNS: {
    name: 'Mixed Concerns',
    description: 'Single file mixing multiple layers',
    detection: (content) => {
      let concerns = 0;
      if (content.includes('router.') || content.includes('app.get')) concerns++;
      if (content.includes('mongoose.') || content.includes('prisma.')) concerns++;
      if (content.includes('res.json') || content.includes('res.send')) concerns++;
      if (content.includes('new Schema(') || content.includes('model(')) concerns++;
      return concerns >= 3;
    },
    severity: Severity.WARNING
  },
  SQL_INJECTION_RISK: {
    name: 'SQL Injection Risk',
    description: 'Potentially unsafe SQL query construction',
    detection: (content) => {
      const patterns = [
        /query\s*\(\s*['"`].*\$\{/,
        /query\s*\(\s*['"`].*\+\s*\w+/,
        /execute\s*\(\s*['"`].*\$\{/
      ];
      return patterns.some(p => p.test(content));
    },
    severity: Severity.CRITICAL
  },
  CONSOLE_IN_PRODUCTION: {
    name: 'Console Statements',
    description: 'Console.log in production code',
    detection: (content, filePath) => {
      if (filePath.includes('test') || filePath.includes('spec')) return false;
      return /console\.(log|info|warn|error)\(/.test(content);
    },
    severity: Severity.INFO
  }
};

// Layer Rules
const LayerRules = {
  'controllers': {
    canImport: ['services', 'middleware', 'utils', 'config', 'validators'],
    cannotImport: ['models', 'repositories', 'database']
  },
  'services': {
    canImport: ['models', 'repositories', 'utils', 'config', 'external'],
    cannotImport: ['controllers', 'routes', 'middleware']
  },
  'models': {
    canImport: ['utils', 'config'],
    cannotImport: ['controllers', 'services', 'routes', 'middleware']
  },
  'routes': {
    canImport: ['controllers', 'middleware', 'validators'],
    cannotImport: ['services', 'models', 'repositories']
  },
  'middleware': {
    canImport: ['services', 'utils', 'config'],
    cannotImport: ['controllers', 'routes']
  }
};

// Naming Convention Rules
const NamingRules = {
  controllers: {
    filePattern: /^[a-z]+(-[a-z]+)*\.controller\.(js|ts)$/,
    classPattern: /^[A-Z][a-zA-Z]*Controller$/
  },
  services: {
    filePattern: /^[a-z]+(-[a-z]+)*\.service\.(js|ts)$/,
    classPattern: /^[A-Z][a-zA-Z]*Service$/
  },
  models: {
    filePattern: /^[a-z]+(-[a-z]+)*\.model\.(js|ts)$/,
    classPattern: /^[A-Z][a-zA-Z]*$/
  },
  routes: {
    filePattern: /^[a-z]+(-[a-z]+)*\.routes?\.(js|ts)$/
  },
  middleware: {
    filePattern: /^[a-z]+(-[a-z]+)*\.middleware\.(js|ts)$/
  }
};

class DriftDetector extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    
    // Drift history
    this.driftHistory = [];
    
    // Baseline metrics
    this.baseline = null;
    
    // Current drift score
    this.currentDriftScore = 0;
    
    // Suppressed warnings
    this.suppressedPatterns = new Set();
  }
  
  /**
   * Check for architectural drift in a file
   */
  async checkDrift(filePath, content) {
    const results = {
      filePath,
      timestamp: new Date().toISOString(),
      driftScore: 0,
      issues: [],
      details: {}
    };
    
    // Check anti-patterns
    const antiPatternIssues = this._checkAntiPatterns(filePath, content);
    results.issues.push(...antiPatternIssues);
    
    // Check layer violations
    const layerIssues = this._checkLayerViolations(filePath, content);
    results.issues.push(...layerIssues);
    
    // Check naming conventions
    const namingIssues = this._checkNamingConventions(filePath, content);
    results.issues.push(...namingIssues);
    
    // Check structural issues
    const structuralIssues = this._checkStructuralIssues(filePath, content);
    results.issues.push(...structuralIssues);
    
    // Calculate drift score
    results.driftScore = this._calculateDriftScore(results.issues);
    results.details = {
      antiPatterns: antiPatternIssues.length,
      layerViolations: layerIssues.length,
      namingIssues: namingIssues.length,
      structuralIssues: structuralIssues.length
    };
    
    // Store in history
    this.driftHistory.push(results);
    
    // Emit event if drift is critical
    if (results.driftScore > 0.5) {
      this.emit('drift:critical', results);
    }
    
    return results;
  }
  
  /**
   * Analyze entire codebase for drift
   */
  async analyzeCodebase(files) {
    const analysis = {
      timestamp: new Date().toISOString(),
      totalFiles: files.length,
      filesWithIssues: 0,
      totalIssues: 0,
      issuesByCategory: {},
      issuesBySeverity: {},
      overallDriftScore: 0,
      hotspots: [],
      recommendations: []
    };
    
    for (const file of files) {
      const result = await this.checkDrift(file.path, file.content);
      
      if (result.issues.length > 0) {
        analysis.filesWithIssues++;
        analysis.totalIssues += result.issues.length;
        
        // Track hotspots
        if (result.issues.length > 3) {
          analysis.hotspots.push({
            file: file.path,
            issueCount: result.issues.length,
            driftScore: result.driftScore
          });
        }
        
        // Categorize issues
        for (const issue of result.issues) {
          analysis.issuesByCategory[issue.category] = 
            (analysis.issuesByCategory[issue.category] || 0) + 1;
          analysis.issuesBySeverity[issue.severity] = 
            (analysis.issuesBySeverity[issue.severity] || 0) + 1;
        }
      }
    }
    
    // Calculate overall drift score
    analysis.overallDriftScore = analysis.filesWithIssues / Math.max(files.length, 1);
    
    // Sort hotspots
    analysis.hotspots.sort((a, b) => b.driftScore - a.driftScore);
    analysis.hotspots = analysis.hotspots.slice(0, 10);
    
    // Generate recommendations
    analysis.recommendations = this._generateRecommendations(analysis);
    
    return analysis;
  }
  
  /**
   * Set baseline for drift comparison
   */
  setBaseline(analysis) {
    this.baseline = {
      timestamp: new Date().toISOString(),
      metrics: {
        totalIssues: analysis.totalIssues,
        driftScore: analysis.overallDriftScore,
        issuesByCategory: { ...analysis.issuesByCategory }
      }
    };
  }
  
  /**
   * Compare current state to baseline
   */
  compareToBaseline(currentAnalysis) {
    if (!this.baseline) {
      return { hasBaseline: false };
    }
    
    const comparison = {
      hasBaseline: true,
      baselineTimestamp: this.baseline.timestamp,
      changes: {
        totalIssues: currentAnalysis.totalIssues - this.baseline.metrics.totalIssues,
        driftScore: currentAnalysis.overallDriftScore - this.baseline.metrics.driftScore
      },
      trend: 'stable',
      categoryChanges: {}
    };
    
    // Determine trend
    if (comparison.changes.driftScore > 0.05) {
      comparison.trend = 'worsening';
    } else if (comparison.changes.driftScore < -0.05) {
      comparison.trend = 'improving';
    }
    
    // Category-level comparison
    for (const category of Object.keys(DriftCategories)) {
      const current = currentAnalysis.issuesByCategory[category] || 0;
      const baseline = this.baseline.metrics.issuesByCategory[category] || 0;
      comparison.categoryChanges[category] = current - baseline;
    }
    
    return comparison;
  }
  
  /**
   * Suppress specific patterns (mark as intentional)
   */
  suppressPattern(patternName, reason) {
    this.suppressedPatterns.add(patternName);
    return { suppressed: patternName, reason };
  }
  
  /**
   * Get drift history
   */
  getHistory(options = {}) {
    let history = [...this.driftHistory];
    
    if (options.since) {
      history = history.filter(h => new Date(h.timestamp) > new Date(options.since));
    }
    
    if (options.filePath) {
      history = history.filter(h => h.filePath.includes(options.filePath));
    }
    
    if (options.minScore) {
      history = history.filter(h => h.driftScore >= options.minScore);
    }
    
    return history;
  }
  
  /**
   * Clear drift history
   */
  clearHistory() {
    this.driftHistory = [];
  }
  
  // ==================== Private Methods ====================
  
  _checkAntiPatterns(filePath, content) {
    const issues = [];
    
    for (const [name, pattern] of Object.entries(AntiPatterns)) {
      if (this.suppressedPatterns.has(name)) continue;
      if (!pattern.detection) continue;
      
      try {
        if (pattern.detection(content, filePath)) {
          issues.push({
            id: `AP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category: DriftCategories.PATTERN,
            type: name,
            name: pattern.name,
            description: pattern.description,
            severity: pattern.severity,
            filePath,
            suggestion: this._getSuggestion(name)
          });
        }
      } catch (error) {
        // Pattern detection failed, skip
      }
    }
    
    return issues;
  }
  
  _checkLayerViolations(filePath, content) {
    const issues = [];
    
    // Determine which layer this file belongs to
    const layer = this._identifyLayer(filePath);
    if (!layer || !LayerRules[layer]) return issues;
    
    const rules = LayerRules[layer];
    
    // Extract imports
    const imports = this._extractImports(content);
    
    for (const imp of imports) {
      const importedLayer = this._identifyLayer(imp);
      
      if (importedLayer && rules.cannotImport.includes(importedLayer)) {
        issues.push({
          id: `LV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category: DriftCategories.LAYER,
          type: 'FORBIDDEN_IMPORT',
          severity: Severity.ERROR,
          filePath,
          description: `${layer} should not import from ${importedLayer}`,
          import: imp,
          suggestion: `Move this logic to an appropriate layer or use dependency injection`
        });
      }
    }
    
    return issues;
  }
  
  _checkNamingConventions(filePath, content) {
    const issues = [];
    
    const layer = this._identifyLayer(filePath);
    if (!layer || !NamingRules[layer]) return issues;
    
    const rules = NamingRules[layer];
    const fileName = path.basename(filePath);
    
    // Check file naming
    if (rules.filePattern && !rules.filePattern.test(fileName)) {
      issues.push({
        id: `NC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: DriftCategories.NAMING,
        type: 'FILE_NAMING',
        severity: Severity.WARNING,
        filePath,
        description: `File name '${fileName}' doesn't follow ${layer} naming convention`,
        suggestion: `Rename to match pattern: ${rules.filePattern}`
      });
    }
    
    // Check class naming
    if (rules.classPattern) {
      const classes = content.match(/class\s+(\w+)/g) || [];
      for (const classMatch of classes) {
        const className = classMatch.replace('class ', '');
        if (!rules.classPattern.test(className)) {
          issues.push({
            id: `NC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            category: DriftCategories.NAMING,
            type: 'CLASS_NAMING',
            severity: Severity.INFO,
            filePath,
            description: `Class '${className}' doesn't follow ${layer} naming convention`,
            suggestion: `Rename to match pattern: ${rules.classPattern}`
          });
        }
      }
    }
    
    return issues;
  }
  
  _checkStructuralIssues(filePath, content) {
    const issues = [];
    
    // Check file size
    const lines = content.split('\n').length;
    if (lines > 500) {
      issues.push({
        id: `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: DriftCategories.STRUCTURE,
        type: 'FILE_TOO_LARGE',
        severity: Severity.WARNING,
        filePath,
        description: `File has ${lines} lines, consider splitting`,
        suggestion: 'Break down into smaller, focused modules'
      });
    }
    
    // Check function count
    const functionCount = (content.match(/function\s+\w+|const\s+\w+\s*=\s*(async\s*)?\(/g) || []).length;
    if (functionCount > 15) {
      issues.push({
        id: `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        category: DriftCategories.STRUCTURE,
        type: 'TOO_MANY_FUNCTIONS',
        severity: Severity.INFO,
        filePath,
        description: `File has ${functionCount} functions, may indicate mixed responsibilities`,
        suggestion: 'Consider extracting related functions into separate modules'
      });
    }
    
    // Check for missing exports
    if (!content.includes('module.exports') && !content.includes('export ')) {
      if (!filePath.includes('test') && !filePath.includes('spec') && !filePath.includes('index')) {
        issues.push({
          id: `ST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          category: DriftCategories.STRUCTURE,
          type: 'NO_EXPORTS',
          severity: Severity.INFO,
          filePath,
          description: 'File has no exports, may be dead code',
          suggestion: 'Export public API or remove if unused'
        });
      }
    }
    
    return issues;
  }
  
  _identifyLayer(filePath) {
    const normalizedPath = filePath.toLowerCase();
    
    if (normalizedPath.includes('/controllers/') || normalizedPath.includes('.controller.')) {
      return 'controllers';
    }
    if (normalizedPath.includes('/services/') || normalizedPath.includes('.service.')) {
      return 'services';
    }
    if (normalizedPath.includes('/models/') || normalizedPath.includes('.model.')) {
      return 'models';
    }
    if (normalizedPath.includes('/routes/') || normalizedPath.includes('.route')) {
      return 'routes';
    }
    if (normalizedPath.includes('/middleware/') || normalizedPath.includes('.middleware.')) {
      return 'middleware';
    }
    
    return null;
  }
  
  _extractImports(content) {
    const imports = [];
    
    // CommonJS requires
    const requireMatches = content.match(/require\(['"]([^'"]+)['"]\)/g) || [];
    for (const match of requireMatches) {
      const path = match.match(/['"]([^'"]+)['"]/)?.[1];
      if (path) imports.push(path);
    }
    
    // ES6 imports
    const importMatches = content.match(/from\s+['"]([^'"]+)['"]/g) || [];
    for (const match of importMatches) {
      const path = match.match(/['"]([^'"]+)['"]/)?.[1];
      if (path) imports.push(path);
    }
    
    return imports;
  }
  
  _calculateDriftScore(issues) {
    if (issues.length === 0) return 0;
    
    const weights = {
      [Severity.CRITICAL]: 0.4,
      [Severity.ERROR]: 0.25,
      [Severity.WARNING]: 0.1,
      [Severity.INFO]: 0.02
    };
    
    let score = 0;
    for (const issue of issues) {
      score += weights[issue.severity] || 0.05;
    }
    
    return Math.min(score, 1); // Cap at 1.0
  }
  
  _getSuggestion(patternName) {
    const suggestions = {
      'GOD_OBJECT': 'Split into smaller classes with single responsibility',
      'HARDCODED_CONFIG': 'Move to environment variables or config files',
      'MISSING_ERROR_HANDLING': 'Wrap async operations in try-catch blocks',
      'DIRECT_DB_IN_CONTROLLER': 'Use service layer for database operations',
      'BUSINESS_LOGIC_IN_ROUTE': 'Move logic to controller and service layers',
      'MIXED_CONCERNS': 'Separate into distinct files by concern',
      'SQL_INJECTION_RISK': 'Use parameterized queries or ORM methods',
      'CONSOLE_IN_PRODUCTION': 'Use proper logging library (winston, pino)'
    };
    
    return suggestions[patternName] || 'Review and refactor';
  }
  
  _generateRecommendations(analysis) {
    const recommendations = [];
    
    // Based on most common issues
    if ((analysis.issuesByCategory[DriftCategories.LAYER] || 0) > 5) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Architecture',
        recommendation: 'Review layer boundaries and enforce dependency direction rules',
        impact: 'Reduces coupling and improves maintainability'
      });
    }
    
    if ((analysis.issuesBySeverity[Severity.CRITICAL] || 0) > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Security',
        recommendation: 'Address critical security issues immediately',
        impact: 'Prevents potential security vulnerabilities'
      });
    }
    
    if ((analysis.issuesByCategory[DriftCategories.PATTERN] || 0) > 10) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Code Quality',
        recommendation: 'Conduct refactoring sprint to address anti-patterns',
        impact: 'Improves code quality and reduces technical debt'
      });
    }
    
    if (analysis.hotspots.length > 3) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Hotspots',
        recommendation: `Focus on top ${Math.min(5, analysis.hotspots.length)} hotspot files`,
        impact: 'Maximum improvement with focused effort'
      });
    }
    
    return recommendations;
  }
}

export { DriftDetector, DriftCategories };
export default DriftDetector;
