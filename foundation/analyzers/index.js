/**
 * Foundation Analyzers - Shared Code Analysis Modules
 *
 * Central export point for all shared analyzer classes.
 * Import from here to avoid duplication across agents.
 *
 * Usage:
 *   import { BaseAnalyzer, SecurityScanner, PerformanceAnalyzer } from '../foundation/analyzers/index.js';
 *   import { getSecurityScanner, getPerformanceAnalyzer, getASTParser } from '../foundation/analyzers/index.js';
 *   import { SEVERITY, CATEGORY } from '../foundation/analyzers/index.js';
 */

// Base class and constants
export {
  BaseAnalyzer,
  getBaseAnalyzer,
  SEVERITY,
  CATEGORY,
  CODEBASE
} from './BaseAnalyzer.js';

// Security scanning (AST-based)
export {
  SecurityScanner,
  getSecurityScanner
} from './SecurityScanner.js';

// Performance analysis
export {
  PerformanceAnalyzer,
  getPerformanceAnalyzer
} from './PerformanceAnalyzer.js';

// AST Parser (re-export from parsers module)
export {
  ASTParser,
  getASTParser
} from '../parsers/ASTParser.js';

// Default exports for convenience
import { BaseAnalyzer, SEVERITY, CATEGORY } from './BaseAnalyzer.js';
import { SecurityScanner, getSecurityScanner } from './SecurityScanner.js';
import { PerformanceAnalyzer, getPerformanceAnalyzer } from './PerformanceAnalyzer.js';
import { ASTParser, getASTParser } from '../parsers/ASTParser.js';

export default {
  BaseAnalyzer,
  SecurityScanner,
  PerformanceAnalyzer,
  ASTParser,
  getSecurityScanner,
  getPerformanceAnalyzer,
  getASTParser,
  SEVERITY,
  CATEGORY
};
