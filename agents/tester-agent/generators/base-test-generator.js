/**
 * BaseTestGenerator - Abstract Base Class for Test Generators
 *
 * Phase 7.2: Intelligent Test Generators
 * Base class for platform-specific test generators
 *
 * All test generators (Backend, Flutter, React, API) extend this class
 */

import { createLogger } from '../utils/logger.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import generate from '@babel/generator';
import * as t from '@babel/types';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Test types for generation
 */
export const TEST_TYPE = {
  UNIT: 'unit',
  INTEGRATION: 'integration',
  E2E: 'e2e',
  COMPONENT: 'component',
  WIDGET: 'widget',
  API: 'api'
};

/**
 * Edge case types for generation
 */
export const EDGE_CASE = {
  NULL: 'null',
  UNDEFINED: 'undefined',
  EMPTY_STRING: 'empty_string',
  EMPTY_ARRAY: 'empty_array',
  EMPTY_OBJECT: 'empty_object',
  LARGE_NUMBER: 'large_number',
  NEGATIVE_NUMBER: 'negative_number',
  SPECIAL_CHARS: 'special_chars',
  LONG_STRING: 'long_string',
  BOUNDARY: 'boundary'
};

/**
 * BaseTestGenerator
 * Abstract base class for all test generators
 */
export class BaseTestGenerator {
  constructor(name, platform) {
    if (this.constructor === BaseTestGenerator) {
      throw new Error('BaseTestGenerator is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.platform = platform;
    this.logger = createLogger(name);
    this.generatedTests = [];
  }

  /**
   * Generate tests (must be implemented by subclasses)
   * @param {string} sourceFile - Source file to generate tests for
   * @param {Object} options - Generation options
   * @returns {Object} Generated test info
   */
  async generateTests(sourceFile, options = {}) {
    throw new Error('generateTests() must be implemented by subclass');
  }

  /**
   * Parse JavaScript/TypeScript code
   * @param {string} code - Source code
   * @param {string} filePath - File path for error reporting
   * @returns {Object} AST or null
   */
  parseCode(code, filePath = 'unknown') {
    try {
      return parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });
    } catch (error) {
      this.logger.warn(`Failed to parse ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Traverse AST
   * @param {Object} ast - AST to traverse
   * @param {Object} visitors - Visitor functions
   */
  traverse(ast, visitors) {
    if (!ast) return;

    const traverseFn = traverse.default || traverse;
    try {
      traverseFn(ast, visitors);
    } catch (error) {
      this.logger.error('Error traversing AST:', error);
    }
  }

  /**
   * Generate code from AST
   * @param {Object} ast - AST node
   * @returns {string} Generated code
   */
  generateCode(ast) {
    try {
      const generateFn = generate.default || generate;
      const result = generateFn(ast, {
        retainLines: false,
        compact: false,
        concise: false
      });
      return result.code;
    } catch (error) {
      this.logger.error('Error generating code:', error);
      return '';
    }
  }

  /**
   * Read file content
   * @param {string} filePath - Path to file
   * @returns {string|null} File content or null
   */
  readFile(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      this.logger.warn(`Failed to read file ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Write file content
   * @param {string} filePath - Path to file
   * @param {string} content - File content
   */
  writeFile(filePath, content) {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      this.logger.success(`Generated test: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to write file ${filePath}:`, error.message);
    }
  }

  /**
   * Extract functions from source code
   * @param {Object} ast - Source AST
   * @returns {Array} Function definitions
   */
  extractFunctions(ast) {
    const functions = [];

    this.traverse(ast, {
      FunctionDeclaration: (path) => {
        functions.push({
          type: 'function',
          name: path.node.id?.name,
          params: path.node.params.map(p => p.name || 'param'),
          async: path.node.async,
          exported: this.isExported(path),
          node: path.node
        });
      },
      ArrowFunctionExpression: (path) => {
        // Check if it's assigned to a variable
        if (path.parent.type === 'VariableDeclarator' && path.parent.id) {
          functions.push({
            type: 'arrow',
            name: path.parent.id.name,
            params: path.node.params.map(p => p.name || 'param'),
            async: path.node.async,
            exported: this.isExported(path.parentPath.parentPath),
            node: path.node
          });
        }
      },
      ClassMethod: (path) => {
        // Skip constructor
        if (path.node.kind === 'constructor') return;

        functions.push({
          type: 'method',
          name: path.node.key.name,
          params: path.node.params.map(p => p.name || 'param'),
          async: path.node.async,
          static: path.node.static,
          className: path.parent.id?.name,
          node: path.node
        });
      }
    });

    return functions;
  }

  /**
   * Check if node is exported
   * @param {Object} path - AST path
   * @returns {boolean} True if exported
   */
  isExported(path) {
    let current = path;
    while (current) {
      if (current.node.type === 'ExportNamedDeclaration' ||
          current.node.type === 'ExportDefaultDeclaration') {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  /**
   * Generate edge case test values
   * @param {string} paramType - Parameter type (string, number, array, object)
   * @returns {Array} Edge case values
   */
  generateEdgeCases(paramType) {
    const cases = [];

    switch (paramType) {
      case 'string':
        cases.push(
          { type: EDGE_CASE.NULL, value: 'null', desc: 'null value' },
          { type: EDGE_CASE.UNDEFINED, value: 'undefined', desc: 'undefined value' },
          { type: EDGE_CASE.EMPTY_STRING, value: '""', desc: 'empty string' },
          { type: EDGE_CASE.SPECIAL_CHARS, value: '"!@#$%^&*()"', desc: 'special characters' },
          { type: EDGE_CASE.LONG_STRING, value: '"a".repeat(10000)', desc: 'very long string' }
        );
        break;

      case 'number':
        cases.push(
          { type: EDGE_CASE.NULL, value: 'null', desc: 'null value' },
          { type: EDGE_CASE.UNDEFINED, value: 'undefined', desc: 'undefined value' },
          { type: EDGE_CASE.NEGATIVE_NUMBER, value: '-1', desc: 'negative number' },
          { type: EDGE_CASE.LARGE_NUMBER, value: 'Number.MAX_SAFE_INTEGER', desc: 'large number' },
          { type: EDGE_CASE.BOUNDARY, value: '0', desc: 'zero' }
        );
        break;

      case 'array':
        cases.push(
          { type: EDGE_CASE.NULL, value: 'null', desc: 'null value' },
          { type: EDGE_CASE.UNDEFINED, value: 'undefined', desc: 'undefined value' },
          { type: EDGE_CASE.EMPTY_ARRAY, value: '[]', desc: 'empty array' },
          { type: EDGE_CASE.LARGE_NUMBER, value: 'new Array(10000).fill(0)', desc: 'very large array' }
        );
        break;

      case 'object':
        cases.push(
          { type: EDGE_CASE.NULL, value: 'null', desc: 'null value' },
          { type: EDGE_CASE.UNDEFINED, value: 'undefined', desc: 'undefined value' },
          { type: EDGE_CASE.EMPTY_OBJECT, value: '{}', desc: 'empty object' }
        );
        break;

      default:
        cases.push(
          { type: EDGE_CASE.NULL, value: 'null', desc: 'null value' },
          { type: EDGE_CASE.UNDEFINED, value: 'undefined', desc: 'undefined value' }
        );
    }

    return cases;
  }

  /**
   * Infer parameter type from name
   * @param {string} paramName - Parameter name
   * @returns {string} Inferred type
   */
  inferParamType(paramName) {
    const lower = paramName.toLowerCase();

    if (lower.includes('id') || lower.includes('count') || lower.includes('num')) {
      return 'number';
    }
    if (lower.includes('name') || lower.includes('text') || lower.includes('str')) {
      return 'string';
    }
    if (lower.includes('list') || lower.includes('items') || lower.includes('arr')) {
      return 'array';
    }
    if (lower.includes('data') || lower.includes('obj') || lower.includes('config')) {
      return 'object';
    }
    if (lower.includes('flag') || lower.includes('is') || lower.includes('has')) {
      return 'boolean';
    }

    return 'any';
  }

  /**
   * Generate mock value for parameter
   * @param {string} paramType - Parameter type
   * @returns {string} Mock value code
   */
  generateMockValue(paramType) {
    switch (paramType) {
      case 'string':
        return '"test string"';
      case 'number':
        return '42';
      case 'boolean':
        return 'true';
      case 'array':
        return '[1, 2, 3]';
      case 'object':
        return '{ key: "value" }';
      default:
        return 'null';
    }
  }

  /**
   * Detect uncovered code paths in function
   * @param {Object} functionNode - Function AST node
   * @returns {Array} Uncovered paths
   */
  detectUncoveredPaths(functionNode) {
    const paths = [];

    this.traverse({ type: 'Program', body: [functionNode] }, {
      IfStatement: (path) => {
        // Both branches should be tested
        paths.push({
          type: 'if',
          line: path.node.loc?.start.line || 0,
          condition: 'true branch'
        });
        paths.push({
          type: 'if',
          line: path.node.loc?.start.line || 0,
          condition: 'false branch'
        });
      },
      SwitchCase: (path) => {
        if (path.node.test) {
          paths.push({
            type: 'switch',
            line: path.node.loc?.start.line || 0,
            condition: 'case branch'
          });
        } else {
          paths.push({
            type: 'switch',
            line: path.node.loc?.start.line || 0,
            condition: 'default branch'
          });
        }
      },
      ConditionalExpression: (path) => {
        paths.push({
          type: 'ternary',
          line: path.node.loc?.start.line || 0,
          condition: 'true branch'
        });
        paths.push({
          type: 'ternary',
          line: path.node.loc?.start.line || 0,
          condition: 'false branch'
        });
      },
      CatchClause: (path) => {
        paths.push({
          type: 'catch',
          line: path.node.loc?.start.line || 0,
          condition: 'error path'
        });
      }
    });

    return paths;
  }

  /**
   * Calculate complexity of function (for test prioritization)
   * @param {Object} functionNode - Function AST node
   * @returns {number} Complexity score
   */
  calculateComplexity(functionNode) {
    let complexity = 1;

    this.traverse({ type: 'Program', body: [functionNode] }, {
      IfStatement: () => complexity++,
      SwitchCase: () => complexity++,
      ForStatement: () => complexity++,
      WhileStatement: () => complexity++,
      ConditionalExpression: () => complexity++,
      LogicalExpression: () => complexity++,
      CatchClause: () => complexity++
    });

    return complexity;
  }

  /**
   * Get generated tests
   * @returns {Array} Generated test info
   */
  getGeneratedTests() {
    return this.generatedTests;
  }

  /**
   * Clear generated tests
   */
  clearGeneratedTests() {
    this.generatedTests = [];
  }
}
