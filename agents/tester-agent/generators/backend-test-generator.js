/**
 * Backend Test Generator - Jest Test Generation
 *
 * Phase 7.2: Intelligent Test Generators
 * Generates Jest tests for Node.js/Express backend code
 */

import { BaseTestGenerator, TEST_TYPE, EDGE_CASE } from './base-test-generator.js';
import * as path from 'path';
import * as t from '@babel/types';

/**
 * BackendTestGenerator
 * Generates Jest tests for backend code
 */
export class BackendTestGenerator extends BaseTestGenerator {
  constructor() {
    super('BackendTestGenerator', 'backend');
  }

  /**
   * Generate tests for source file
   * @param {string} sourceFile - Source file path
   * @param {Object} options - Generation options
   * @returns {Object} Generated test info
   */
  async generateTests(sourceFile, options = {}) {
    this.logger.info(`Generating tests for: ${sourceFile}`);

    const content = this.readFile(sourceFile);
    if (!content) {
      return { success: false, error: 'Failed to read source file' };
    }

    const ast = this.parseCode(content, sourceFile);
    if (!ast) {
      return { success: false, error: 'Failed to parse source file' };
    }

    // Extract functions to test
    const functions = this.extractFunctions(ast);
    this.logger.info(`Found ${functions.length} functions to test`);

    if (functions.length === 0) {
      return { success: false, error: 'No testable functions found' };
    }

    // Generate test file
    const testContent = this.generateTestFile(sourceFile, functions, options);

    // Determine test file path
    const testFilePath = this.getTestFilePath(sourceFile, options);

    // Write test file
    if (options.dryRun) {
      this.logger.info('Dry run - test file not written');
      return {
        success: true,
        testFilePath,
        testContent,
        functionsCount: functions.length
      };
    }

    this.writeFile(testFilePath, testContent);

    this.generatedTests.push({
      sourceFile,
      testFile: testFilePath,
      functionsCount: functions.length,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      testFilePath,
      functionsCount: functions.length
    };
  }

  /**
   * Generate complete test file content
   * @param {string} sourceFile - Source file path
   * @param {Array} functions - Functions to test
   * @param {Object} options - Generation options
   * @returns {string} Test file content
   */
  generateTestFile(sourceFile, functions, options = {}) {
    const lines = [];
    const fileName = path.basename(sourceFile, path.extname(sourceFile));
    const relativePath = path.relative(path.dirname(this.getTestFilePath(sourceFile, options)), sourceFile);

    // Imports
    lines.push("import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';");

    // Import functions from source
    const exportedFunctions = functions.filter(f => f.exported);
    if (exportedFunctions.length > 0) {
      const imports = exportedFunctions.map(f => f.name).join(', ');
      lines.push(`import { ${imports} } from '${relativePath}';`);
    }

    lines.push('');

    // Test suite
    lines.push(`describe('${fileName}', () => {`);

    // Generate tests for each function
    functions.forEach(func => {
      if (func.exported || options.includePrivate) {
        lines.push(this.generateFunctionTests(func, options));
      }
    });

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate tests for a function
   * @param {Object} func - Function info
   * @param {Object} options - Generation options
   * @returns {string} Test code
   */
  generateFunctionTests(func, options = {}) {
    const lines = [];

    lines.push(`  describe('${func.name}', () => {`);

    // Happy path test
    lines.push(this.generateHappyPathTest(func));

    // Edge case tests
    if (options.includeEdgeCases !== false) {
      func.params.forEach((param, index) => {
        const paramType = this.inferParamType(param);
        const edgeCases = this.generateEdgeCases(paramType);

        edgeCases.forEach(edge => {
          lines.push(this.generateEdgeCaseTest(func, param, index, edge));
        });
      });
    }

    // Error path tests
    if (options.includeErrorPaths !== false) {
      const paths = this.detectUncoveredPaths(func.node);
      const errorPaths = paths.filter(p => p.type === 'catch');

      if (errorPaths.length > 0) {
        lines.push(this.generateErrorTest(func));
      }
    }

    // Async tests
    if (func.async) {
      lines.push(this.generateAsyncTest(func));
    }

    lines.push('  });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate happy path test
   * @param {Object} func - Function info
   * @returns {string} Test code
   */
  generateHappyPathTest(func) {
    const lines = [];

    lines.push(`    it('should work correctly with valid inputs', ${func.async ? 'async ' : ''}() => {`);

    // Generate mock parameters
    const mockParams = func.params.map(param => {
      const type = this.inferParamType(param);
      return this.generateMockValue(type);
    }).join(', ');

    // Call function
    if (func.async) {
      lines.push(`      const result = await ${func.name}(${mockParams});`);
    } else {
      lines.push(`      const result = ${func.name}(${mockParams});`);
    }

    // Assert
    lines.push(`      expect(result).toBeDefined();`);
    lines.push(`      // TODO: Add specific assertions`);

    lines.push('    });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate edge case test
   * @param {Object} func - Function info
   * @param {string} param - Parameter name
   * @param {number} index - Parameter index
   * @param {Object} edge - Edge case info
   * @returns {string} Test code
   */
  generateEdgeCaseTest(func, param, index, edge) {
    const lines = [];

    lines.push(`    it('should handle ${edge.desc} for ${param}', ${func.async ? 'async ' : ''}() => {`);

    // Generate parameters with edge case
    const params = func.params.map((p, i) => {
      if (i === index) {
        return edge.value;
      }
      const type = this.inferParamType(p);
      return this.generateMockValue(type);
    }).join(', ');

    // Call function - may throw
    lines.push(`      try {`);
    if (func.async) {
      lines.push(`        const result = await ${func.name}(${params});`);
    } else {
      lines.push(`        const result = ${func.name}(${params});`);
    }
    lines.push(`        // TODO: Add assertions for edge case behavior`);
    lines.push(`      } catch (error) {`);
    lines.push(`        // Expected error for invalid input`);
    lines.push(`        expect(error).toBeDefined();`);
    lines.push(`      }`);

    lines.push('    });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate error path test
   * @param {Object} func - Function info
   * @returns {string} Test code
   */
  generateErrorTest(func) {
    const lines = [];

    lines.push(`    it('should handle errors gracefully', ${func.async ? 'async ' : ''}() => {`);

    // Generate parameters that cause error
    const mockParams = func.params.map(() => 'null').join(', ');

    lines.push(`      try {`);
    if (func.async) {
      lines.push(`        await ${func.name}(${mockParams});`);
    } else {
      lines.push(`        ${func.name}(${mockParams});`);
    }
    lines.push(`        // Should have thrown`);
    lines.push(`        expect(true).toBe(false);`);
    lines.push(`      } catch (error) {`);
    lines.push(`        expect(error).toBeDefined();`);
    lines.push(`      }`);

    lines.push('    });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate async-specific test
   * @param {Object} func - Function info
   * @returns {string} Test code
   */
  generateAsyncTest(func) {
    const lines = [];

    lines.push(`    it('should handle async operations correctly', async () => {`);

    const mockParams = func.params.map(param => {
      const type = this.inferParamType(param);
      return this.generateMockValue(type);
    }).join(', ');

    lines.push(`      const result = await ${func.name}(${mockParams});`);
    lines.push(`      expect(result).toBeDefined();`);
    lines.push(`      // TODO: Add async-specific assertions`);

    lines.push('    });');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get test file path for source file
   * @param {string} sourceFile - Source file path
   * @param {Object} options - Options
   * @returns {string} Test file path
   */
  getTestFilePath(sourceFile, options = {}) {
    const dir = path.dirname(sourceFile);
    const ext = path.extname(sourceFile);
    const basename = path.basename(sourceFile, ext);

    // Default: same directory with .test.js extension
    return path.join(dir, `${basename}.test${ext}`);
  }

  /**
   * Generate tests for Express route
   * @param {string} routeFile - Route file path
   * @param {Object} options - Generation options
   * @returns {Object} Generated test info
   */
  async generateRouteTests(routeFile, options = {}) {
    this.logger.info(`Generating route tests for: ${routeFile}`);

    const content = this.readFile(routeFile);
    if (!content) {
      return { success: false, error: 'Failed to read route file' };
    }

    const ast = this.parseCode(content, routeFile);
    if (!ast) {
      return { success: false, error: 'Failed to parse route file' };
    }

    // Extract routes
    const routes = this.extractRoutes(ast);
    this.logger.info(`Found ${routes.length} routes to test`);

    if (routes.length === 0) {
      return { success: false, error: 'No routes found' };
    }

    // Generate test content
    const testContent = this.generateRouteTestFile(routeFile, routes, options);

    const testFilePath = this.getTestFilePath(routeFile, options);

    if (!options.dryRun) {
      this.writeFile(testFilePath, testContent);
    }

    return {
      success: true,
      testFilePath,
      routesCount: routes.length
    };
  }

  /**
   * Extract routes from Express router
   * @param {Object} ast - AST
   * @returns {Array} Routes
   */
  extractRoutes(ast) {
    const routes = [];

    this.traverse(ast, {
      CallExpression: (path) => {
        const callee = path.node.callee;

        // Look for router.get, router.post, etc.
        if (callee.type === 'MemberExpression' &&
            callee.object.name === 'router' &&
            ['get', 'post', 'put', 'delete', 'patch'].includes(callee.property.name)) {

          const method = callee.property.name.toUpperCase();
          const routeArg = path.node.arguments[0];

          if (routeArg && routeArg.type === 'Literal') {
            routes.push({
              method,
              path: routeArg.value,
              line: path.node.loc?.start.line || 0
            });
          }
        }
      }
    });

    return routes;
  }

  /**
   * Generate route test file
   * @param {string} routeFile - Route file path
   * @param {Array} routes - Routes
   * @param {Object} options - Options
   * @returns {string} Test content
   */
  generateRouteTestFile(routeFile, routes, options = {}) {
    const lines = [];
    const fileName = path.basename(routeFile, path.extname(routeFile));

    // Imports
    lines.push("import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';");
    lines.push("import request from 'supertest';");
    lines.push("import app from '../app';  // Adjust import path");
    lines.push('');

    // Test suite
    lines.push(`describe('${fileName} routes', () => {`);

    routes.forEach(route => {
      lines.push(this.generateRouteTest(route));
    });

    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Generate test for single route
   * @param {Object} route - Route info
   * @returns {string} Test code
   */
  generateRouteTest(route) {
    const lines = [];
    const method = route.method.toLowerCase();

    lines.push(`  describe('${route.method} ${route.path}', () => {`);

    // Success test
    lines.push(`    it('should return 200 for valid request', async () => {`);
    lines.push(`      const response = await request(app)`);
    lines.push(`        .${method}('${route.path}')`);

    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      lines.push(`        .send({ /* TODO: Add request body */ })`);
    }

    lines.push(`        .expect(200);`);
    lines.push(``);
    lines.push(`      expect(response.body).toBeDefined();`);
    lines.push(`      // TODO: Add specific assertions`);
    lines.push('    });');
    lines.push('');

    // Error test
    lines.push(`    it('should handle invalid requests', async () => {`);
    lines.push(`      const response = await request(app)`);
    lines.push(`        .${method}('${route.path}')`);

    if (['POST', 'PUT', 'PATCH'].includes(route.method)) {
      lines.push(`        .send({ /* Invalid data */ })`);
    }

    lines.push(`        .expect(400);  // Or appropriate error code`);
    lines.push('    });');

    lines.push('  });');
    lines.push('');

    return lines.join('\n');
  }
}

/**
 * Get singleton instance
 */
let generatorInstance = null;

export function getBackendTestGenerator() {
  if (!generatorInstance) {
    generatorInstance = new BackendTestGenerator();
  }
  return generatorInstance;
}
