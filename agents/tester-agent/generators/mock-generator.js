/**
 * Mock Generator - Automatic Mock Generation
 *
 * Phase 7.2: Intelligent Test Generators
 * Generates mocks for dependencies, APIs, and data
 */

import { createLogger } from '../utils/logger.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Mock types
 */
export const MOCK_TYPE = {
  FUNCTION: 'function',
  API: 'api',
  DATABASE: 'database',
  MODULE: 'module',
  DATA: 'data'
};

/**
 * MockGenerator
 * Generates mocks for testing
 */
export class MockGenerator {
  constructor() {
    this.logger = createLogger('MockGenerator');
  }

  /**
   * Generate mock for function
   * @param {string} functionName - Function name
   * @param {Object} options - Mock options
   * @returns {string} Mock code
   */
  generateFunctionMock(functionName, options = {}) {
    const lines = [];

    if (options.returnValue !== undefined) {
      lines.push(`const ${functionName} = jest.fn(() => ${JSON.stringify(options.returnValue)});`);
    } else if (options.async) {
      lines.push(`const ${functionName} = jest.fn(async () => {`);
      lines.push(`  return { success: true, data: {} };`);
      lines.push(`});`);
    } else {
      lines.push(`const ${functionName} = jest.fn();`);
    }

    return lines.join('\n');
  }

  /**
   * Generate API mock
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Mock options
   * @returns {string} Mock code
   */
  generateAPIMock(endpoint, options = {}) {
    const lines = [];
    const method = options.method || 'get';
    const mockData = options.mockData || { data: [] };

    lines.push(`// Mock API: ${method.toUpperCase()} ${endpoint}`);
    lines.push(`nock('http://localhost:3000')`);
    lines.push(`  .${method}('${endpoint}')`);
    lines.push(`  .reply(200, ${JSON.stringify(mockData, null, 2)});`);

    return lines.join('\n');
  }

  /**
   * Generate database mock
   * @param {string} model - Model name
   * @param {Object} options - Mock options
   * @returns {string} Mock code
   */
  generateDatabaseMock(model, options = {}) {
    const lines = [];

    lines.push(`// Mock ${model} model`);
    lines.push(`jest.mock('../models/${model}', () => ({`);
    lines.push(`  find: jest.fn(() => Promise.resolve([])),`);
    lines.push(`  findById: jest.fn((id) => Promise.resolve({ _id: id })),`);
    lines.push(`  findOne: jest.fn(() => Promise.resolve(null)),`);
    lines.push(`  create: jest.fn((data) => Promise.resolve({ _id: 'mock-id', ...data })),`);
    lines.push(`  updateOne: jest.fn(() => Promise.resolve({ modifiedCount: 1 })),`);
    lines.push(`  deleteOne: jest.fn(() => Promise.resolve({ deletedCount: 1 }))`);
    lines.push(`}));`);

    return lines.join('\n');
  }

  /**
   * Generate module mock
   * @param {string} moduleName - Module name
   * @param {Object} exports - Module exports to mock
   * @returns {string} Mock code
   */
  generateModuleMock(moduleName, exports = {}) {
    const lines = [];

    lines.push(`// Mock ${moduleName} module`);
    lines.push(`jest.mock('${moduleName}', () => ({`);

    Object.entries(exports).forEach(([name, value], index, arr) => {
      const comma = index < arr.length - 1 ? ',' : '';
      if (typeof value === 'function') {
        lines.push(`  ${name}: jest.fn()${comma}`);
      } else {
        lines.push(`  ${name}: ${JSON.stringify(value)}${comma}`);
      }
    });

    lines.push(`}));`);

    return lines.join('\n');
  }

  /**
   * Generate test data
   * @param {string} dataType - Data type (user, product, etc.)
   * @param {Object} schema - Data schema
   * @returns {Object} Mock data
   */
  generateTestData(dataType, schema = {}) {
    const data = {};

    // Common patterns
    const patterns = {
      id: () => 'test-id-' + Math.random().toString(36).substr(2, 9),
      name: () => 'Test Name',
      email: () => 'test@example.com',
      password: () => 'Test123!@#',
      createdAt: () => new Date().toISOString(),
      updatedAt: () => new Date().toISOString(),
      boolean: () => true,
      number: () => 42,
      string: () => 'test string',
      array: () => [1, 2, 3],
      object: () => ({ key: 'value' })
    };

    // Generate based on schema
    Object.entries(schema).forEach(([field, type]) => {
      if (patterns[field]) {
        data[field] = patterns[field]();
      } else if (patterns[type]) {
        data[field] = patterns[type]();
      } else {
        data[field] = null;
      }
    });

    return data;
  }

  /**
   * Generate Express request mock
   * @param {Object} options - Request options
   * @returns {string} Mock code
   */
  generateExpressRequestMock(options = {}) {
    const lines = [];
    lines.push('const req = {');
    lines.push(`  body: ${JSON.stringify(options.body || {})},`);
    lines.push(`  query: ${JSON.stringify(options.query || {})},`);
    lines.push(`  params: ${JSON.stringify(options.params || {})},`);
    lines.push(`  headers: ${JSON.stringify(options.headers || {})},`);
    lines.push(`  user: ${options.user ? JSON.stringify(options.user) : 'null'},`);
    lines.push(`  method: '${options.method || 'GET'}',`);
    lines.push(`  url: '${options.url || '/'}',`);
    lines.push(`  get: jest.fn((header) => headers[header])`);
    lines.push('};');
    return lines.join('\n');
  }

  /**
   * Generate Express response mock
   * @returns {string} Mock code
   */
  generateExpressResponseMock() {
    const lines = [];
    lines.push('const res = {');
    lines.push('  status: jest.fn().mockReturnThis(),');
    lines.push('  json: jest.fn().mockReturnThis(),');
    lines.push('  send: jest.fn().mockReturnThis(),');
    lines.push('  render: jest.fn().mockReturnThis(),');
    lines.push('  redirect: jest.fn().mockReturnThis(),');
    lines.push('  cookie: jest.fn().mockReturnThis(),');
    lines.push('  clearCookie: jest.fn().mockReturnThis(),');
    lines.push('  set: jest.fn().mockReturnThis(),');
    lines.push('  get: jest.fn()');
    lines.push('};');
    return lines.join('\n');
  }

  /**
   * Generate fixtures file
   * @param {string} dataType - Data type
   * @param {number} count - Number of items
   * @param {Object} schema - Data schema
   * @returns {string} Fixtures code
   */
  generateFixtures(dataType, count = 5, schema = {}) {
    const lines = [];

    lines.push(`// Fixtures for ${dataType}`);
    lines.push(`export const ${dataType}Fixtures = [`);

    for (let i = 0; i < count; i++) {
      const data = this.generateTestData(dataType, schema);
      data.id = `${dataType}-${i + 1}`;
      lines.push(`  ${JSON.stringify(data, null, 2)}${i < count - 1 ? ',' : ''}`);
    }

    lines.push(`];`);

    return lines.join('\n');
  }

  /**
   * Generate mock factory
   * @param {string} entityName - Entity name
   * @param {Object} schema - Entity schema
   * @returns {string} Factory code
   */
  generateMockFactory(entityName, schema = {}) {
    const lines = [];

    lines.push(`// Factory for ${entityName}`);
    lines.push(`export function create${entityName}(overrides = {}) {`);
    lines.push(`  return {`);

    Object.entries(schema).forEach(([field, type]) => {
      let defaultValue;

      if (field === 'id') {
        defaultValue = `'test-id-' + Math.random().toString(36).substr(2, 9)`;
      } else if (type === 'string') {
        defaultValue = `'test ${field}'`;
      } else if (type === 'number') {
        defaultValue = '42';
      } else if (type === 'boolean') {
        defaultValue = 'true';
      } else if (type === 'Date') {
        defaultValue = 'new Date()';
      } else {
        defaultValue = 'null';
      }

      lines.push(`    ${field}: ${defaultValue},`);
    });

    lines.push(`    ...overrides`);
    lines.push(`  };`);
    lines.push(`}`);

    return lines.join('\n');
  }

  /**
   * Save mocks to file
   * @param {string} filePath - File path
   * @param {string} content - Mock content
   */
  saveMocks(filePath, content) {
    try {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, content, 'utf-8');
      this.logger.success(`Generated mocks: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to save mocks: ${error.message}`);
    }
  }
}

/**
 * Get singleton instance
 */
let generatorInstance = null;

export function getMockGenerator() {
  if (!generatorInstance) {
    generatorInstance = new MockGenerator();
  }
  return generatorInstance;
}
