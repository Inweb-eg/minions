/**
 * FixGenerator - Generates code fixes based on test failure analysis
 *
 * Uses pattern matching and code analysis to generate fixes.
 * Integrates with AI for complex fixes when simple patterns don't match.
 */

import fs from 'fs';
import path from 'path';
import { createLogger } from '../../../../agents/foundation/common/logger.js';

const logger = createLogger('FixGenerator');

export class FixGenerator {
  constructor(options = {}) {
    this.options = {
      maxContextLines: 50,
      enableAIFallback: true,
      ...options
    };

    // Common fix patterns for different error types
    this.fixPatterns = [
      {
        name: 'null-check',
        match: /Cannot read propert(?:y|ies) ['"]?(\w+)['"]? of (undefined|null)/i,
        fix: this.generateNullCheckFix.bind(this)
      },
      {
        name: 'undefined-variable',
        match: /(\w+) is not defined/i,
        fix: this.generateUndefinedVariableFix.bind(this)
      },
      {
        name: 'type-mismatch',
        match: /Expected[:\s]+(['"]?.+?['"]?)\s*(?:but )?[Rr]eceived[:\s]+(['"]?.+?['"]?)/,
        fix: this.generateTypeMismatchFix.bind(this)
      },
      {
        name: 'missing-function',
        match: /(\w+) is not a function/i,
        fix: this.generateMissingFunctionFix.bind(this)
      },
      {
        name: 'import-error',
        match: /Cannot find module ['"](.+?)['"]/i,
        fix: this.generateImportFix.bind(this)
      },
      {
        name: 'async-await',
        match: /await is only valid in async function/i,
        fix: this.generateAsyncFix.bind(this)
      },
      {
        name: 'missing-mock',
        match: /(?:mock|stub|spy).+not (?:called|invoked)/i,
        fix: this.generateMockFix.bind(this)
      },
      {
        name: 'assertion-value',
        match: /expect\(.+?\)\.(?:toBe|toEqual|toStrictEqual)\(.+?\)/,
        fix: this.generateAssertionFix.bind(this)
      }
    ];
  }

  /**
   * Generate a fix for a test failure
   * @param {Object} failure - Parsed failure from TestFailureAnalyzer
   * @param {string} sourceCode - The source code of the failing file
   * @returns {Object} Generated fix
   */
  async generateFix(failure, sourceCode = null) {
    logger.info(`Generating fix for: ${failure.testName}`);

    // Try to read source if not provided
    if (!sourceCode && failure.file) {
      try {
        const filePath = this.resolveFilePath(failure.file);
        if (fs.existsSync(filePath)) {
          sourceCode = fs.readFileSync(filePath, 'utf-8');
        }
      } catch (err) {
        logger.warn(`Could not read source file: ${failure.file}`);
      }
    }

    // Try pattern-based fixes first
    for (const pattern of this.fixPatterns) {
      const match = failure.error.match(pattern.match);
      if (match) {
        logger.info(`Matched pattern: ${pattern.name}`);
        const fix = await pattern.fix(failure, match, sourceCode);
        if (fix && fix.changes.length > 0) {
          return {
            ...fix,
            pattern: pattern.name,
            confidence: fix.confidence || 'medium'
          };
        }
      }
    }

    // If expected/received available, try direct value fix
    if (failure.expected && failure.received) {
      const fix = this.generateDirectValueFix(failure, sourceCode);
      if (fix) {
        return fix;
      }
    }

    // Fallback to AI-assisted fix generation
    if (this.options.enableAIFallback) {
      return this.generateAIAssistedFix(failure, sourceCode);
    }

    return {
      success: false,
      pattern: 'none',
      confidence: 'none',
      changes: [],
      message: 'No automatic fix available. Manual intervention required.',
      failure
    };
  }

  /**
   * Generate null check fix
   */
  async generateNullCheckFix(failure, match, sourceCode) {
    const property = match[1];
    const location = failure.location;

    if (!sourceCode || !location.line) {
      return { success: false, changes: [] };
    }

    const lines = sourceCode.split('\n');
    const lineIndex = location.line - 1;

    if (lineIndex >= 0 && lineIndex < lines.length) {
      const originalLine = lines[lineIndex];

      // Find the object being accessed
      const accessPattern = new RegExp(`(\\w+)\\.${property}`);
      const accessMatch = originalLine.match(accessPattern);

      if (accessMatch) {
        const objectName = accessMatch[1];
        const fixedLine = originalLine.replace(
          `${objectName}.${property}`,
          `${objectName}?.${property}`
        );

        return {
          success: true,
          changes: [{
            file: failure.file,
            line: location.line,
            original: originalLine,
            fixed: fixedLine,
            description: `Add optional chaining for ${objectName}.${property}`
          }],
          confidence: 'high',
          message: `Added null-safe access with optional chaining (?.) for ${objectName}.${property}`
        };
      }
    }

    return { success: false, changes: [] };
  }

  /**
   * Generate undefined variable fix
   */
  async generateUndefinedVariableFix(failure, match, sourceCode) {
    const variableName = match[1];

    // Check if it's a common import
    const commonImports = {
      'expect': "import { expect } from '@jest/globals';",
      'describe': "import { describe, it, expect } from '@jest/globals';",
      'test': "import { test, expect } from '@jest/globals';",
      'jest': "import { jest } from '@jest/globals';",
      'React': "import React from 'react';",
      'useState': "import { useState } from 'react';",
      'useEffect': "import { useEffect } from 'react';"
    };

    if (commonImports[variableName]) {
      return {
        success: true,
        changes: [{
          file: failure.file,
          line: 1,
          original: '',
          fixed: commonImports[variableName],
          description: `Add import for ${variableName}`,
          type: 'prepend'
        }],
        confidence: 'high',
        message: `Added missing import for ${variableName}`
      };
    }

    // Suggest variable declaration
    return {
      success: true,
      changes: [{
        file: failure.file,
        line: failure.location.line,
        original: '',
        fixed: `const ${variableName} = null; // TODO: Initialize properly`,
        description: `Declare ${variableName}`,
        type: 'prepend'
      }],
      confidence: 'low',
      message: `Added placeholder declaration for ${variableName}. Please verify and initialize properly.`
    };
  }

  /**
   * Generate type mismatch fix
   */
  async generateTypeMismatchFix(failure, match, sourceCode) {
    const expected = match[1].replace(/['"]/g, '');
    const received = match[2].replace(/['"]/g, '');

    // This is typically a code bug, not a test bug
    // Suggest updating the code to return expected value
    return {
      success: true,
      changes: [{
        file: failure.file,
        line: failure.location.line,
        description: `Value mismatch: expected "${expected}" but received "${received}"`,
        suggestion: `Review the code logic that produces "${received}" and fix it to return "${expected}"`
      }],
      confidence: 'medium',
      message: `Detected value mismatch. Expected "${expected}" but got "${received}". Check the source code logic.`,
      requiresManualReview: true
    };
  }

  /**
   * Generate missing function fix
   */
  async generateMissingFunctionFix(failure, match, sourceCode) {
    const functionName = match[1];

    // Check if it might be a method call on wrong type
    if (sourceCode) {
      const lines = sourceCode.split('\n');
      const lineIndex = (failure.location.line || 1) - 1;

      if (lineIndex >= 0 && lineIndex < lines.length) {
        const line = lines[lineIndex];

        // Check for common mistakes
        if (line.includes('.map(') && functionName === 'map') {
          return {
            success: true,
            changes: [{
              file: failure.file,
              line: failure.location.line,
              description: 'Array.map() called on non-array',
              suggestion: 'Ensure the variable is an array before calling .map(). Add: Array.isArray(variable) check or initialize as []'
            }],
            confidence: 'medium',
            message: '.map() was called on a non-array. Ensure the variable is properly initialized as an array.'
          };
        }
      }
    }

    return {
      success: true,
      changes: [{
        file: failure.file,
        line: failure.location.line,
        description: `Function ${functionName} is not defined`,
        suggestion: `Check if ${functionName} is imported correctly or define the function`
      }],
      confidence: 'low',
      message: `Function "${functionName}" is not defined. Check imports or add function definition.`
    };
  }

  /**
   * Generate import fix
   */
  async generateImportFix(failure, match, sourceCode) {
    const moduleName = match[1];

    // Check if it's a relative import that might be wrong
    if (moduleName.startsWith('.')) {
      return {
        success: true,
        changes: [{
          file: failure.file,
          line: 1,
          description: `Module not found: ${moduleName}`,
          suggestion: `Check the relative path. Current import: "${moduleName}". Verify the file exists at the specified path.`
        }],
        confidence: 'medium',
        message: `Module "${moduleName}" not found. Check the relative path.`
      };
    }

    // Suggest npm install for external packages
    return {
      success: true,
      changes: [{
        file: failure.file,
        line: 1,
        description: `Package not installed: ${moduleName}`,
        command: `npm install ${moduleName}`,
        suggestion: `Run: npm install ${moduleName}`
      }],
      confidence: 'high',
      message: `Package "${moduleName}" not installed. Run: npm install ${moduleName}`
    };
  }

  /**
   * Generate async/await fix
   */
  async generateAsyncFix(failure, match, sourceCode) {
    if (!sourceCode || !failure.location.line) {
      return { success: false, changes: [] };
    }

    const lines = sourceCode.split('\n');
    const lineIndex = failure.location.line - 1;

    // Find the function declaration above
    for (let i = lineIndex; i >= 0; i--) {
      const line = lines[i];
      const funcMatch = line.match(/(function\s+\w+\s*\(|const\s+\w+\s*=\s*(?:async\s*)?\(|=>\s*{)/);

      if (funcMatch) {
        if (!line.includes('async')) {
          const fixedLine = line.replace(
            /(function\s+)(\w+)/,
            'async $1$2'
          ).replace(
            /(const\s+\w+\s*=\s*)(\()/,
            '$1async $2'
          );

          return {
            success: true,
            changes: [{
              file: failure.file,
              line: i + 1,
              original: line,
              fixed: fixedLine,
              description: 'Add async keyword to function'
            }],
            confidence: 'high',
            message: 'Added async keyword to the function containing await'
          };
        }
        break;
      }
    }

    return { success: false, changes: [] };
  }

  /**
   * Generate mock fix
   */
  async generateMockFix(failure, match, sourceCode) {
    return {
      success: true,
      changes: [{
        file: failure.file,
        line: failure.location.line,
        description: 'Mock/stub not called as expected',
        suggestion: `Verify that:
1. The mock is set up before the function call
2. The function actually calls the mocked dependency
3. The mock path matches the import path exactly`
      }],
      confidence: 'low',
      message: 'Mock was not called. Check mock setup and function implementation.',
      requiresManualReview: true
    };
  }

  /**
   * Generate assertion fix
   */
  async generateAssertionFix(failure, match, sourceCode) {
    // This usually means the implementation is wrong, not the test
    return {
      success: true,
      changes: [{
        file: failure.file,
        line: failure.location.line,
        description: 'Assertion failed',
        suggestion: `The test expectation failed. Review:
1. Is the expected value correct?
2. Is the implementation returning the right value?
3. Are there any side effects affecting the result?`
      }],
      confidence: 'medium',
      message: 'Assertion failed. Review both test expectations and implementation logic.',
      requiresManualReview: true
    };
  }

  /**
   * Generate fix based on direct expected/received values
   */
  generateDirectValueFix(failure, sourceCode) {
    // If we know expected and received, we can sometimes trace the fix
    logger.info(`Attempting direct value fix: expected=${failure.expected}, received=${failure.received}`);

    return {
      success: true,
      changes: [{
        file: failure.file || failure.location?.file,
        line: failure.location?.line,
        description: `Value mismatch`,
        expected: failure.expected,
        received: failure.received,
        suggestion: `The code returned "${failure.received}" but the test expected "${failure.expected}".
Fix the source code to return the expected value.`
      }],
      confidence: 'medium',
      message: `Value mismatch detected. Code returns "${failure.received}" but should return "${failure.expected}".`,
      requiresManualReview: true
    };
  }

  /**
   * Generate AI-assisted fix (placeholder for Claude/LLM integration)
   */
  async generateAIAssistedFix(failure, sourceCode) {
    logger.info('Generating AI-assisted fix suggestion');

    // Build context for AI
    const context = {
      testName: failure.testName,
      error: failure.error,
      file: failure.file,
      location: failure.location,
      expected: failure.expected,
      received: failure.received,
      sourceSnippet: sourceCode ? this.extractSourceSnippet(sourceCode, failure.location.line) : null
    };

    // This would integrate with Claude API in production
    // For now, return a helpful suggestion
    return {
      success: true,
      pattern: 'ai-assisted',
      confidence: 'low',
      changes: [{
        file: failure.file,
        description: 'AI-assisted analysis',
        context,
        suggestion: `Complex fix required. Analyze the following:

Test: ${failure.testName}
Error: ${failure.error.substring(0, 200)}...
File: ${failure.file}:${failure.location.line}

Recommended approach:
1. Review the test expectations
2. Trace the code path that leads to this error
3. Identify the root cause
4. Apply targeted fix to the source code`
      }],
      message: 'Complex fix required. Manual review recommended with AI assistance.',
      requiresManualReview: true,
      aiContext: context
    };
  }

  /**
   * Extract source code snippet around a line
   */
  extractSourceSnippet(sourceCode, lineNumber, contextLines = 10) {
    const lines = sourceCode.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);

    return lines.slice(start, end).map((line, i) => {
      const num = start + i + 1;
      const marker = num === lineNumber ? '>>> ' : '    ';
      return `${marker}${num}: ${line}`;
    }).join('\n');
  }

  /**
   * Resolve file path to absolute path
   */
  resolveFilePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    return path.resolve(process.cwd(), filePath);
  }
}

// Singleton instance
let instance = null;

export function getFixGenerator(options) {
  if (!instance) {
    instance = new FixGenerator(options);
  }
  return instance;
}

export default FixGenerator;
