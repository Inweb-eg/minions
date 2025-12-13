/**
 * Codebase Analyzer Agent - Main Entry Point
 *
 * Phase 6.5: Codebase Analyzer Agent
 * System-wide deep analysis across all 4 codebases
 *
 * Exports:
 * - Main CodebaseAnalyzer orchestrator
 * - Individual analyzers
 * - Utilities
 */

export { CodebaseAnalyzer, getCodebaseAnalyzer, main } from './codebase-analyzer.js';

// Analyzers - Shared from foundation (raw single-file analyzers)
export { BaseAnalyzer, SEVERITY, CATEGORY, CODEBASE } from '../../foundation/analyzers/index.js';
export { SecurityScanner, getSecurityScanner } from '../../foundation/analyzers/index.js';
export { PerformanceAnalyzer, getPerformanceAnalyzer } from '../../foundation/analyzers/index.js';

// Codebase-level wrapper analyzers (adapt foundation to codebase paths)
export { CodebaseSecurityScanner, getCodebaseSecurityScanner } from './analyzers/codebase-security-scanner.js';
export { CodebasePerformanceAnalyzer, getCodebasePerformanceAnalyzer } from './analyzers/codebase-performance-analyzer.js';

// Agent-specific analyzers
export { DependencyMapper, getDependencyMapper } from './analyzers/dependency-mapper.js';
export { APIContractValidator, getAPIContractValidator } from './analyzers/api-contract-validator.js';
export { TechnicalDebtAnalyzer, getTechnicalDebtAnalyzer } from './analyzers/technical-debt-analyzer.js';

// Utilities
export { createLogger } from './utils/logger.js';
