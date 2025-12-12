/**
 * Skills Index - Entry Point for All Agent Skills
 *
 * This module exports all available skills for the agent system:
 * - BaseSkill: Base class for all skills to extend
 * - AutoFixer: Automatically fixes test failures
 * - CodeReviewer: Performs automated code reviews
 * - TestGenerator: Generates unit tests for code
 * - FileSecurityScanner: Scans for security vulnerabilities (file-based)
 * - DependencyAnalyzer: Analyzes project dependencies
 *
 * Note: FileSecurityScanner is distinct from foundation/SecurityScanner (AST-based)
 */

// Base Skill class (for extending)
import { BaseSkill, SEVERITY, CATEGORY, SKILL_STATUS, createSkillGetter } from './BaseSkill.js';

// Auto-Fixer Skill
import AutoFixer, { getAutoFixer } from './auto-fixer/index.js';
import { TestFailureAnalyzer, getTestFailureAnalyzer } from './auto-fixer/TestFailureAnalyzer.js';
import { FixGenerator, getFixGenerator } from './auto-fixer/FixGenerator.js';
import { FixApplier, getFixApplier } from './auto-fixer/FixApplier.js';

// Code Review Skill
import CodeReviewer, { getCodeReviewer } from './code-review/index.js';

// Test Generator Skill
import TestGenerator, { getTestGenerator } from './test-generator/index.js';

// Security Scanner Skill (File-based - distinct from foundation/SecurityScanner)
import FileSecurityScanner, { getFileSecurityScanner } from './security-scanner/index.js';
// Legacy exports for backward compatibility
import { SecurityScanner, getSecurityScanner } from './security-scanner/index.js';

// Dependency Analyzer Skill
import DependencyAnalyzer, { getDependencyAnalyzer } from './dependency-analyzer/index.js';

// Export all skills
export {
  // Base Skill (for extending)
  BaseSkill,
  SEVERITY,
  CATEGORY,
  SKILL_STATUS,
  createSkillGetter,

  // Auto-Fixer
  AutoFixer,
  getAutoFixer,
  TestFailureAnalyzer,
  getTestFailureAnalyzer,
  FixGenerator,
  getFixGenerator,
  FixApplier,
  getFixApplier,

  // Code Reviewer
  CodeReviewer,
  getCodeReviewer,

  // Test Generator
  TestGenerator,
  getTestGenerator,

  // Security Scanner (new name)
  FileSecurityScanner,
  getFileSecurityScanner,
  // Legacy exports (backward compatibility)
  SecurityScanner,
  getSecurityScanner,

  // Dependency Analyzer
  DependencyAnalyzer,
  getDependencyAnalyzer
};

// Default export with all skill factories
export default {
  getAutoFixer,
  getCodeReviewer,
  getTestGenerator,
  getFileSecurityScanner,
  getSecurityScanner, // Legacy
  getDependencyAnalyzer
};

/**
 * Initialize all skills
 * @returns {Promise<Object>} Object containing all initialized skills
 */
export async function initializeAllSkills() {
  const skills = {
    autoFixer: getAutoFixer(),
    codeReviewer: getCodeReviewer(),
    testGenerator: getTestGenerator(),
    securityScanner: getFileSecurityScanner(),
    dependencyAnalyzer: getDependencyAnalyzer()
  };

  await Promise.all([
    skills.autoFixer.initialize(),
    skills.codeReviewer.initialize(),
    skills.testGenerator.initialize(),
    skills.securityScanner.initialize(),
    skills.dependencyAnalyzer.initialize()
  ]);

  return skills;
}

/**
 * Get skill by name
 * @param {string} skillName - Name of the skill
 * @returns {Object|null} Skill instance or null
 */
export function getSkillByName(skillName) {
  const skillFactories = {
    'auto-fixer': getAutoFixer,
    'autofixer': getAutoFixer,
    'code-review': getCodeReviewer,
    'codereviewer': getCodeReviewer,
    'test-generator': getTestGenerator,
    'testgenerator': getTestGenerator,
    'security-scanner': getFileSecurityScanner,
    'securityscanner': getFileSecurityScanner,
    'file-security-scanner': getFileSecurityScanner,
    'filesecurityscanner': getFileSecurityScanner,
    'dependency-analyzer': getDependencyAnalyzer,
    'dependencyanalyzer': getDependencyAnalyzer
  };

  const factory = skillFactories[skillName.toLowerCase()];
  return factory ? factory() : null;
}

/**
 * List all available skills
 * @returns {Array<Object>} List of skill metadata
 */
export function listSkills() {
  return [
    {
      name: 'auto-fixer',
      description: 'Automatically analyzes test failures and generates fixes',
      capabilities: ['test-failure-analysis', 'fix-generation', 'fix-application', 'rollback']
    },
    {
      name: 'code-review',
      description: 'Performs automated code reviews with quality, security, and performance checks',
      capabilities: ['quality-analysis', 'security-review', 'performance-analysis', 'style-checks']
    },
    {
      name: 'test-generator',
      description: 'Generates unit tests for JavaScript, Dart, and Python code',
      capabilities: ['test-generation', 'edge-case-detection', 'mock-generation']
    },
    {
      name: 'file-security-scanner',
      description: 'Scans files for security vulnerabilities and secrets (file-based scanning)',
      capabilities: ['secret-detection', 'vulnerability-scanning', 'dependency-audit', 'config-scanning']
    },
    {
      name: 'dependency-analyzer',
      description: 'Analyzes project dependencies for issues and updates',
      capabilities: ['outdated-detection', 'security-audit', 'license-checking', 'circular-detection']
    }
  ];
}
