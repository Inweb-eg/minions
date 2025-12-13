/**
 * TestGenerator - Automatic test generation skill
 *
 * Generates tests for:
 * - JavaScript/TypeScript (Jest)
 * - Flutter/Dart (flutter_test)
 * - Python (pytest)
 *
 * Supports:
 * - Unit tests
 * - Integration tests
 * - Edge case detection
 * - Mock generation
 */

import fs from 'fs';
import path from 'path';
import { getEventBus } from '../../../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';
import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('TestGenerator');

export class TestGenerator {
  constructor(options = {}) {
    this.options = {
      testFramework: 'jest',
      outputDir: '__tests__',
      generateMocks: true,
      includeEdgeCases: true,
      includeIntegrationTests: false,
      ...options
    };

    this.eventBus = null;
    this.initialized = false;

    // Templates for different languages/frameworks
    this.templates = {
      jest: {
        file: this.generateJestFile.bind(this),
        test: this.generateJestTest.bind(this),
        mock: this.generateJestMock.bind(this)
      },
      flutter: {
        file: this.generateFlutterFile.bind(this),
        test: this.generateFlutterTest.bind(this),
        mock: this.generateFlutterMock.bind(this)
      },
      pytest: {
        file: this.generatePytestFile.bind(this),
        test: this.generatePytestTest.bind(this),
        mock: this.generatePytestMock.bind(this)
      }
    };
  }

  async initialize() {
    if (this.initialized) return;

    logger.info('Initializing TestGenerator skill...');
    this.eventBus = getEventBus();

    if (this.eventBus) {
      this.eventBus.subscribe(EventTypes.CODE_GENERATED, 'test-generator', async (data) => {
        try {
          if (data.generateTests) {
            await this.generateForFiles(data.files);
          }
        } catch (error) {
          logger.error('Error handling CODE_GENERATED event:', error);
        }
      });

      this.eventBus.subscribe(EventTypes.GENERATE_TESTS, 'test-generator', async (data) => {
        try {
          const result = await this.generate(data);
          this.eventBus.publish(EventTypes.TESTS_GENERATED, result);
        } catch (error) {
          logger.error('Error handling GENERATE_TESTS event:', error);
          this.eventBus.publish(EventTypes.TESTS_GENERATED, {
            success: false,
            error: error.message
          });
        }
      });

      // Publish skill ready event
      this.eventBus.publish(EventTypes.SKILL_READY, {
        skill: 'test-generator',
        timestamp: new Date().toISOString()
      });
    }

    this.initialized = true;
    logger.info('TestGenerator initialized');
  }

  /**
   * Generate tests for code
   */
  async generate(input) {
    let code, filePath, language, framework;

    if (typeof input === 'string') {
      if (fs.existsSync(input)) {
        filePath = input;
        code = fs.readFileSync(input, 'utf-8');
      } else {
        code = input;
      }
    } else {
      filePath = input.file || input.path;
      code = input.content || input.code;
      language = input.language;
      framework = input.framework;

      if (!code && filePath && fs.existsSync(filePath)) {
        code = fs.readFileSync(filePath, 'utf-8');
      }
    }

    if (!code) {
      return { success: false, error: 'No code to generate tests for' };
    }

    // Detect language and framework
    language = language || this.detectLanguage(filePath);
    framework = framework || this.getFrameworkForLanguage(language);

    logger.info(`Generating ${framework} tests for ${filePath || 'code'}`);

    // Parse code to extract testable elements
    const parsed = this.parseCode(code, language);

    // Generate tests
    const template = this.templates[framework] || this.templates.jest;
    const tests = [];

    for (const fn of parsed.functions) {
      const test = await template.test(fn, parsed, this.options);
      tests.push(test);

      // Generate edge case tests
      if (this.options.includeEdgeCases) {
        const edgeCases = this.generateEdgeCases(fn, language);
        tests.push(...edgeCases.map(ec => template.test({ ...fn, edgeCase: ec }, parsed, this.options)));
      }
    }

    // Generate mocks if needed
    let mocks = [];
    if (this.options.generateMocks && parsed.imports.length > 0) {
      mocks = parsed.imports.map(imp => template.mock(imp, parsed));
    }

    // Assemble test file
    const testFile = template.file({
      sourceFile: filePath,
      tests,
      mocks,
      imports: parsed.imports,
      className: parsed.className
    });

    const testFilePath = this.getTestFilePath(filePath, framework);

    return {
      success: true,
      sourceFile: filePath,
      testFile: testFilePath,
      content: testFile,
      testsGenerated: tests.length,
      functions: parsed.functions.map(f => f.name),
      language,
      framework
    };
  }

  /**
   * Generate tests for multiple files
   */
  async generateForFiles(files) {
    const results = [];

    for (const file of files) {
      try {
        const result = await this.generate(file);
        results.push(result);
      } catch (error) {
        results.push({ file, success: false, error: error.message });
      }
    }

    return {
      total: files.length,
      successful: results.filter(r => r.success).length,
      results
    };
  }

  /**
   * Parse code to extract testable elements
   */
  parseCode(code, language) {
    const parsed = {
      functions: [],
      classes: [],
      imports: [],
      exports: [],
      className: null
    };

    const lines = code.split('\n');

    // Extract imports
    const importPatterns = {
      javascript: [
        /import\s+(?:(\w+)|{\s*([^}]+)\s*})\s+from\s+['"]([^'"]+)['"]/g,
        /const\s+(?:(\w+)|{\s*([^}]+)\s*})\s*=\s*require\(['"]([^'"]+)['"]\)/g
      ],
      python: [/from\s+(\S+)\s+import\s+(.+)/g, /import\s+(\S+)/g],
      dart: [/import\s+['"]([^'"]+)['"]/g]
    };

    const patterns = importPatterns[language] || importPatterns.javascript;
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        parsed.imports.push({
          default: match[1],
          named: match[2]?.split(',').map(n => n.trim()),
          from: match[3] || match[1]
        });
      }
      pattern.lastIndex = 0;
    }

    // Extract functions
    const functionPatterns = {
      javascript: [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
        /(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/g,
        /(\w+)\s*\(([^)]*)\)\s*{/g
      ],
      python: [/def\s+(\w+)\s*\(([^)]*)\)/g],
      dart: [/(?:Future<\w+>|void|\w+)\s+(\w+)\s*\(([^)]*)\)/g]
    };

    const fnPatterns = functionPatterns[language] || functionPatterns.javascript;
    for (const pattern of fnPatterns) {
      let match;
      while ((match = pattern.exec(code)) !== null) {
        const name = match[1];
        const params = match[2];

        // Skip constructors, lifecycle methods, etc.
        if (['constructor', 'render', 'componentDidMount', 'useEffect'].includes(name)) continue;

        // Find function body to analyze return type
        const startIndex = match.index;
        const functionBody = this.extractFunctionBody(code, startIndex);

        parsed.functions.push({
          name,
          params: this.parseParameters(params, language),
          isAsync: code.substring(Math.max(0, match.index - 10), match.index).includes('async'),
          isExported: code.substring(Math.max(0, match.index - 10), match.index).includes('export'),
          returnType: this.inferReturnType(functionBody, language),
          body: functionBody
        });
      }
      pattern.lastIndex = 0;
    }

    // Extract class name
    const classMatch = code.match(/class\s+(\w+)/);
    if (classMatch) {
      parsed.className = classMatch[1];
    }

    return parsed;
  }

  extractFunctionBody(code, startIndex) {
    let depth = 0;
    let start = -1;
    let end = -1;

    for (let i = startIndex; i < code.length; i++) {
      if (code[i] === '{') {
        if (start === -1) start = i;
        depth++;
      }
      if (code[i] === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          end = i;
          break;
        }
      }
    }

    return start !== -1 && end !== -1 ? code.substring(start, end + 1) : '';
  }

  parseParameters(paramsStr, language) {
    if (!paramsStr || !paramsStr.trim()) return [];

    return paramsStr.split(',').map(p => {
      const parts = p.trim().split(/[:\s]+/);
      return {
        name: parts[0].replace(/[?=].*/g, ''),
        type: parts[1] || 'any',
        optional: p.includes('?') || p.includes('='),
        default: p.match(/=\s*(.+)/)?.[1]?.trim()
      };
    });
  }

  inferReturnType(body, language) {
    if (!body) return 'void';

    if (body.includes('return {')) return 'object';
    if (body.includes('return [')) return 'array';
    if (body.includes('return true') || body.includes('return false')) return 'boolean';
    if (/return\s+['"`]/.test(body)) return 'string';
    if (/return\s+\d/.test(body)) return 'number';
    if (body.includes('return null')) return 'null';
    if (body.includes('return')) return 'unknown';

    return 'void';
  }

  generateEdgeCases(fn, language) {
    const edgeCases = [];

    for (const param of fn.params) {
      // Null/undefined cases
      edgeCases.push({
        description: `with ${param.name} as null`,
        params: { [param.name]: null }
      });

      // Empty values
      if (param.type === 'string' || param.type === 'any') {
        edgeCases.push({
          description: `with empty ${param.name}`,
          params: { [param.name]: '' }
        });
      }

      if (param.type === 'array' || param.type === 'any') {
        edgeCases.push({
          description: `with empty array for ${param.name}`,
          params: { [param.name]: [] }
        });
      }

      if (param.type === 'number' || param.type === 'any') {
        edgeCases.push({
          description: `with zero for ${param.name}`,
          params: { [param.name]: 0 }
        });
        edgeCases.push({
          description: `with negative value for ${param.name}`,
          params: { [param.name]: -1 }
        });
      }
    }

    return edgeCases.slice(0, 5); // Limit edge cases
  }

  // ==================== Jest Templates ====================

  generateJestFile({ sourceFile, tests, mocks, imports, className }) {
    const sourceName = path.basename(sourceFile || 'module', path.extname(sourceFile || ''));
    const relativePath = sourceFile ? `./${path.relative(this.options.outputDir, sourceFile).replace(/\\/g, '/')}` : './module';

    let content = `/**
 * Tests for ${sourceName}
 * Auto-generated by TestGenerator
 */

`;

    // Add imports
    if (sourceFile) {
      content += `import { ${tests.map(t => t.functionName).filter(Boolean).join(', ')} } from '${relativePath.replace('.js', '')}';\n`;
    }

    // Add mocks
    if (mocks.length > 0) {
      content += '\n// Mocks\n';
      content += mocks.join('\n');
      content += '\n';
    }

    // Add describe block
    content += `\ndescribe('${className || sourceName}', () => {\n`;

    // Add beforeEach if needed
    if (mocks.length > 0) {
      content += `  beforeEach(() => {\n    jest.clearAllMocks();\n  });\n\n`;
    }

    // Add tests
    content += tests.map(t => t.code).join('\n\n');

    content += '\n});\n';

    return content;
  }

  generateJestTest(fn, parsed, options) {
    const { name, params, isAsync, returnType, edgeCase } = fn;

    let testDescription = edgeCase
      ? `should handle ${name} ${edgeCase.description}`
      : `should ${this.generateTestDescription(name, returnType)}`;

    let testParams = this.generateTestParams(params, edgeCase);
    let assertion = this.generateJestAssertion(returnType, edgeCase);

    let code = `  ${isAsync ? 'it' : 'test'}('${testDescription}', ${isAsync ? 'async ' : ''}() => {\n`;

    // Arrange
    code += `    // Arrange\n`;
    if (params.length > 0) {
      code += `    const ${params.map(p => `${p.name} = ${testParams[p.name]}`).join(', ')};\n`;
    }

    // Act
    code += `    // Act\n`;
    code += `    const result = ${isAsync ? 'await ' : ''}${name}(${params.map(p => p.name).join(', ')});\n`;

    // Assert
    code += `    // Assert\n`;
    code += `    ${assertion}\n`;

    code += `  });`;

    return { code, functionName: name };
  }

  generateJestMock(imp, parsed) {
    if (imp.from.startsWith('.')) {
      return `jest.mock('${imp.from}');`;
    }
    return `jest.mock('${imp.from}', () => ({\n  ${imp.named?.map(n => `${n}: jest.fn()`).join(',\n  ') || `default: jest.fn()`}\n}));`;
  }

  generateJestAssertion(returnType, edgeCase) {
    if (edgeCase && edgeCase.params) {
      const hasNull = Object.values(edgeCase.params).includes(null);
      if (hasNull) {
        return 'expect(result).toBeNull(); // or handle null case appropriately';
      }
    }

    switch (returnType) {
      case 'boolean': return 'expect(result).toBe(true); // TODO: verify expected value';
      case 'string': return "expect(typeof result).toBe('string');";
      case 'number': return "expect(typeof result).toBe('number');";
      case 'object': return 'expect(result).toBeInstanceOf(Object);';
      case 'array': return 'expect(Array.isArray(result)).toBe(true);';
      case 'void': return 'expect(result).toBeUndefined();';
      default: return 'expect(result).toBeDefined();';
    }
  }

  // ==================== Flutter Templates ====================

  generateFlutterFile({ sourceFile, tests, mocks, imports, className }) {
    const sourceName = path.basename(sourceFile || 'module', path.extname(sourceFile || ''));

    let content = `// Tests for ${sourceName}
// Auto-generated by TestGenerator

import 'package:flutter_test/flutter_test.dart';
`;

    if (sourceFile) {
      content += `import '${sourceFile.replace('.dart', '')}.dart';\n`;
    }

    if (mocks.length > 0) {
      content += `import 'package:mockito/mockito.dart';\n`;
      content += mocks.join('\n');
    }

    content += `\nvoid main() {\n`;
    content += `  group('${className || sourceName}', () {\n`;

    content += tests.map(t => t.code).join('\n\n');

    content += `\n  });\n}\n`;

    return content;
  }

  generateFlutterTest(fn, parsed, options) {
    const { name, params, isAsync, returnType, edgeCase } = fn;

    let testDescription = edgeCase
      ? `handles ${name} ${edgeCase.description}`
      : this.generateTestDescription(name, returnType);

    let testParams = this.generateTestParams(params, edgeCase);

    let code = `    test('${testDescription}', () ${isAsync ? 'async ' : ''}{\n`;

    // Arrange
    if (params.length > 0) {
      code += `      // Arrange\n`;
      code += `      ${params.map(p => `final ${p.name} = ${testParams[p.name]}`).join(';\n      ')};\n`;
    }

    // Act
    code += `      // Act\n`;
    code += `      final result = ${isAsync ? 'await ' : ''}${name}(${params.map(p => p.name).join(', ')});\n`;

    // Assert
    code += `      // Assert\n`;
    code += `      expect(result, isNotNull);\n`;

    code += `    });`;

    return { code, functionName: name };
  }

  generateFlutterMock(imp, parsed) {
    return `class Mock${imp.default || 'Service'} extends Mock implements ${imp.default || 'Service'} {}`;
  }

  // ==================== Pytest Templates ====================

  generatePytestFile({ sourceFile, tests, mocks, imports, className }) {
    const sourceName = path.basename(sourceFile || 'module', '.py');

    let content = `"""
Tests for ${sourceName}
Auto-generated by TestGenerator
"""

import pytest
`;

    if (sourceFile) {
      content += `from ${sourceName} import *\n`;
    }

    if (mocks.length > 0) {
      content += `from unittest.mock import Mock, patch\n`;
      content += mocks.join('\n');
    }

    content += `\n\nclass Test${className || this.toPascalCase(sourceName)}:\n`;

    content += tests.map(t => t.code).join('\n\n');

    return content;
  }

  generatePytestTest(fn, parsed, options) {
    const { name, params, isAsync, returnType, edgeCase } = fn;

    let testName = edgeCase
      ? `test_${name}_${edgeCase.description.replace(/\s+/g, '_')}`
      : `test_${name}`;

    let testParams = this.generateTestParams(params, edgeCase);

    let code = `    ${isAsync ? 'async ' : ''}def ${testName}(self):\n`;

    // Arrange
    if (params.length > 0) {
      code += `        # Arrange\n`;
      code += `        ${params.map(p => `${p.name} = ${this.toPythonValue(testParams[p.name])}`).join('\n        ')}\n`;
    }

    // Act
    code += `        # Act\n`;
    code += `        result = ${isAsync ? 'await ' : ''}${name}(${params.map(p => p.name).join(', ')})\n`;

    // Assert
    code += `        # Assert\n`;
    code += `        assert result is not None\n`;

    return { code, functionName: name };
  }

  generatePytestMock(imp, parsed) {
    return `@pytest.fixture\ndef mock_${imp.from.split('.').pop()}():\n    return Mock()`;
  }

  // ==================== Utilities ====================

  generateTestDescription(functionName, returnType) {
    // Convert camelCase to readable
    const readable = functionName.replace(/([A-Z])/g, ' $1').toLowerCase();

    if (functionName.startsWith('get')) return `return ${readable.replace('get ', '')}`;
    if (functionName.startsWith('is') || functionName.startsWith('has')) return `return correct boolean for ${readable}`;
    if (functionName.startsWith('create')) return `create ${readable.replace('create ', '')} successfully`;
    if (functionName.startsWith('update')) return `update ${readable.replace('update ', '')} successfully`;
    if (functionName.startsWith('delete')) return `delete ${readable.replace('delete ', '')} successfully`;
    if (functionName.startsWith('validate')) return `validate ${readable.replace('validate ', '')} correctly`;

    return `${readable} correctly`;
  }

  generateTestParams(params, edgeCase) {
    const values = {};

    for (const param of params) {
      if (edgeCase && edgeCase.params && param.name in edgeCase.params) {
        values[param.name] = JSON.stringify(edgeCase.params[param.name]);
        continue;
      }

      // Generate default test values based on type or name
      if (param.name.toLowerCase().includes('id')) {
        values[param.name] = "'test-id-123'";
      } else if (param.name.toLowerCase().includes('name')) {
        values[param.name] = "'Test Name'";
      } else if (param.name.toLowerCase().includes('email')) {
        values[param.name] = "'test@example.com'";
      } else if (param.type === 'number' || param.name.toLowerCase().includes('count') || param.name.toLowerCase().includes('amount')) {
        values[param.name] = '10';
      } else if (param.type === 'boolean') {
        values[param.name] = 'true';
      } else if (param.type === 'array') {
        values[param.name] = '[]';
      } else if (param.type === 'object') {
        values[param.name] = '{}';
      } else {
        values[param.name] = param.default || "'test-value'";
      }
    }

    return values;
  }

  toPythonValue(jsValue) {
    if (jsValue === 'null') return 'None';
    if (jsValue === 'true') return 'True';
    if (jsValue === 'false') return 'False';
    if (jsValue === '[]') return '[]';
    if (jsValue === '{}') return '{}';
    return jsValue;
  }

  toPascalCase(str) {
    return str.replace(/(^\w|_\w)/g, m => m.replace('_', '').toUpperCase());
  }

  detectLanguage(filePath) {
    if (!filePath) return 'javascript';
    const ext = path.extname(filePath).toLowerCase();
    const langMap = {
      '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript',
      '.ts': 'typescript', '.tsx': 'typescript',
      '.py': 'python',
      '.dart': 'dart'
    };
    return langMap[ext] || 'javascript';
  }

  getFrameworkForLanguage(language) {
    const frameworkMap = {
      javascript: 'jest',
      typescript: 'jest',
      python: 'pytest',
      dart: 'flutter'
    };
    return frameworkMap[language] || 'jest';
  }

  getTestFilePath(sourceFile, framework) {
    if (!sourceFile) return null;

    const dir = path.dirname(sourceFile);
    const name = path.basename(sourceFile, path.extname(sourceFile));
    const ext = path.extname(sourceFile);

    const patterns = {
      jest: `${dir}/${this.options.outputDir}/${name}.test${ext}`,
      pytest: `${dir}/tests/test_${name}.py`,
      flutter: `${dir}/test/${name}_test.dart`
    };

    return patterns[framework] || patterns.jest;
  }

  /**
   * Write generated test to file
   */
  async writeTestFile(result) {
    if (!result.success || !result.testFile) {
      return { success: false, error: 'No test file to write' };
    }

    const dir = path.dirname(result.testFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(result.testFile, result.content);
    logger.info(`Wrote test file: ${result.testFile}`);

    return { success: true, path: result.testFile };
  }

  getStatus() {
    return {
      initialized: this.initialized,
      frameworks: Object.keys(this.templates),
      options: this.options
    };
  }
}

let instance = null;

export function getTestGenerator(options) {
  if (!instance) {
    instance = new TestGenerator(options);
  }
  return instance;
}

export default TestGenerator;
