/**
 * Auto-Fixer Skill - Main Entry Point
 *
 * A skill that automatically analyzes test failures and generates/applies fixes.
 *
 * Components:
 * - TestFailureAnalyzer - Parses test output (Jest, Flutter, Pytest)
 * - FixGenerator - Generates fixes using patterns and AI
 * - FixApplier - Applies fixes with backup and rollback
 * - AutoFixer - Main orchestrator with EventBus integration
 *
 * Usage:
 *   import { getAutoFixer } from './skills/auto-fixer/index.js';
 *
 *   const fixer = getAutoFixer();
 *   await fixer.initialize();
 *
 *   // Auto-fixer will now respond to TESTS_FAILED events
 *   // Or manually trigger:
 *   const result = await fixer.handleTestFailure({
 *     testOutput: '... test output ...',
 *     platform: 'backend'
 *   });
 */

import AutoFixer, { getAutoFixer } from './AutoFixer.js';
import TestFailureAnalyzer, { getTestFailureAnalyzer } from './TestFailureAnalyzer.js';
import FixGenerator, { getFixGenerator } from './FixGenerator.js';
import FixApplier, { getFixApplier } from './FixApplier.js';

export {
  AutoFixer,
  getAutoFixer,
  TestFailureAnalyzer,
  getTestFailureAnalyzer,
  FixGenerator,
  getFixGenerator,
  FixApplier,
  getFixApplier
};

export default getAutoFixer;
