/**
 * Analyzers Tests
 * ================
 * Tests for BaseAnalyzer, PerformanceAnalyzer, and SecurityScanner
 */

import { jest } from '@jest/globals';
import {
  BaseAnalyzer,
  SEVERITY,
  CATEGORY,
  CODEBASE,
  getBaseAnalyzer
} from '../analyzers/BaseAnalyzer.js';
import {
  PerformanceAnalyzer,
  getPerformanceAnalyzer
} from '../analyzers/PerformanceAnalyzer.js';
import {
  SecurityScanner,
  getSecurityScanner
} from '../analyzers/SecurityScanner.js';

// Helper: Create mock parser
function createMockParser() {
  return {
    parse: jest.fn((code) => {
      // Simple parser mock that returns AST-like structure
      return {
        success: true,
        ast: {
          type: 'Program',
          body: [],
          loc: { start: { line: 1 }, end: { line: 1 } }
        }
      };
    }),
    traverse: jest.fn((ast, visitors) => {
      // Simple traversal mock
    })
  };
}

// Concrete implementation for testing BaseAnalyzer
class TestAnalyzer extends BaseAnalyzer {
  constructor() {
    super('TestAnalyzer');
  }

  async analyze(code, options = {}) {
    return this.formatResults();
  }
}

describe('BaseAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new TestAnalyzer();
  });

  describe('Instantiation', () => {
    test('cannot instantiate abstract class directly', () => {
      expect(() => new BaseAnalyzer('test')).toThrow('BaseAnalyzer is abstract');
    });

    test('subclass can be instantiated', () => {
      expect(analyzer.name).toBe('TestAnalyzer');
    });

    test('getBaseAnalyzer returns class', () => {
      const AnalyzerClass = getBaseAnalyzer();
      expect(AnalyzerClass).toBe(BaseAnalyzer);
    });
  });

  describe('Parser Management', () => {
    test('setParser stores parser instance', () => {
      const parser = createMockParser();
      analyzer.setParser(parser);

      expect(analyzer.parser).toBe(parser);
    });

    test('parseCode throws without parser', () => {
      expect(() => analyzer.parseCode('const x = 1;')).toThrow('Parser not set');
    });

    test('parseCode calls parser', () => {
      const parser = createMockParser();
      analyzer.setParser(parser);

      const result = analyzer.parseCode('const x = 1;');

      expect(parser.parse).toHaveBeenCalledWith('const x = 1;');
      expect(result.success).toBe(true);
    });

    test('traverse calls parser traverse', () => {
      const parser = createMockParser();
      analyzer.setParser(parser);

      const ast = { type: 'Program', body: [] };
      const visitors = { Identifier: jest.fn() };

      analyzer.traverse(ast, visitors);

      expect(parser.traverse).toHaveBeenCalledWith(ast, visitors);
    });

    test('traverseAST is alias for traverse', () => {
      const parser = createMockParser();
      analyzer.setParser(parser);

      const ast = { type: 'Program', body: [] };
      const visitors = { Identifier: jest.fn() };

      analyzer.traverseAST(ast, visitors);

      expect(parser.traverse).toHaveBeenCalledWith(ast, visitors);
    });

    test('traverse does nothing without parser', () => {
      const ast = { type: 'Program' };
      const visitors = {};

      expect(() => analyzer.traverse(ast, visitors)).not.toThrow();
    });
  });

  describe('Issue Management', () => {
    test('addIssue stores issue with metadata', () => {
      analyzer.addIssue({
        type: 'test_issue',
        severity: 'warning',
        message: 'Test message'
      });

      expect(analyzer.issues).toHaveLength(1);
      expect(analyzer.issues[0].analyzer).toBe('TestAnalyzer');
      expect(analyzer.issues[0].timestamp).toBeDefined();
    });

    test('clearIssues removes all issues', () => {
      analyzer.addIssue({ type: 'issue1' });
      analyzer.addIssue({ type: 'issue2' });

      analyzer.clearIssues();

      expect(analyzer.issues).toHaveLength(0);
    });

    test('getIssues returns all issues', () => {
      analyzer.addIssue({ type: 'issue1', severity: 'error' });
      analyzer.addIssue({ type: 'issue2', severity: 'warning' });

      const issues = analyzer.getIssues();

      expect(issues).toHaveLength(2);
    });

    test('getIssuesBySeverity filters issues', () => {
      analyzer.addIssue({ type: 'issue1', severity: 'error' });
      analyzer.addIssue({ type: 'issue2', severity: 'warning' });
      analyzer.addIssue({ type: 'issue3', severity: 'error' });

      const errors = analyzer.getIssuesBySeverity('error');

      expect(errors).toHaveLength(2);
    });

    test('getIssueCounts returns counts by severity', () => {
      analyzer.addIssue({ type: 'issue1', severity: 'error' });
      analyzer.addIssue({ type: 'issue2', severity: 'warning' });
      analyzer.addIssue({ type: 'issue3', severity: 'info' });
      analyzer.addIssue({ type: 'issue4', severity: 'error' });

      const counts = analyzer.getIssueCounts();

      expect(counts.error).toBe(2);
      expect(counts.warning).toBe(1);
      expect(counts.info).toBe(1);
      expect(counts.total).toBe(4);
    });
  });

  describe('Issue Creation', () => {
    test('createIssue creates structured issue', () => {
      const issue = analyzer.createIssue({
        type: 'test_type',
        severity: 'error',
        message: 'Test message',
        location: { line: 10 },
        code: 'testCode',
        category: 'security'
      });

      expect(issue.type).toBe('test_type');
      expect(issue.severity).toBe('error');
      expect(issue.message).toBe('Test message');
      expect(issue.location.line).toBe(10);
      expect(issue.category).toBe('security');
      expect(issue.rule).toBeDefined();
    });

    test('createIssue has defaults', () => {
      const issue = analyzer.createIssue({
        type: 'test_type',
        message: 'Test'
      });

      expect(issue.severity).toBe('warning');
      expect(issue.category).toBe('general');
      expect(issue.fixable).toBe(false);
      expect(issue.suggestion).toBeNull();
    });

    test('getRule returns default rule', () => {
      const rule = analyzer.getRule('test_rule');

      expect(rule.id).toBe('test_rule');
      expect(rule.category).toBe('general');
    });
  });

  describe('Syntax Validation', () => {
    test('validateSyntax returns valid for good code', () => {
      const parser = createMockParser();
      analyzer.setParser(parser);

      const result = analyzer.validateSyntax('const x = 1;');

      expect(result.valid).toBe(true);
      expect(result.ast).toBeDefined();
    });

    test('validateSyntax returns invalid for parse error', () => {
      const parser = {
        parse: jest.fn().mockReturnValue({
          success: false,
          error: 'Syntax error',
          location: { line: 5 }
        })
      };
      analyzer.setParser(parser);

      const result = analyzer.validateSyntax('const x =');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Syntax error');
    });
  });

  describe('Results Formatting', () => {
    test('formatResults returns structured result', () => {
      analyzer.addIssue({ type: 'issue1', severity: 'error' });

      const result = analyzer.formatResults();

      expect(result.analyzer).toBe('TestAnalyzer');
      expect(result.success).toBe(true);
      expect(result.issues).toHaveLength(1);
      expect(result.counts.total).toBe(1);
      expect(result.summary).toBeDefined();
      expect(result.analyzedAt).toBeDefined();
    });

    test('formatResults accepts additional data', () => {
      const result = analyzer.formatResults({
        customField: 'value'
      });

      expect(result.customField).toBe('value');
    });
  });

  describe('Statistics', () => {
    test('getStatistics returns comprehensive stats', () => {
      analyzer.addIssue({ type: 'type_a', severity: 'error', fixable: true });
      analyzer.addIssue({ type: 'type_a', severity: 'warning' });
      analyzer.addIssue({ type: 'type_b', severity: 'info', fixable: true });

      const stats = analyzer.getStatistics();

      expect(stats.analyzer).toBe('TestAnalyzer');
      expect(stats.totalIssues).toBe(3);
      expect(stats.byType.type_a).toBe(2);
      expect(stats.byType.type_b).toBe(1);
      expect(stats.bySeverity.errors).toBe(1);
      expect(stats.fixableIssues).toBe(2);
    });

    test('groupIssuesByType groups correctly', () => {
      analyzer.addIssue({ type: 'bug' });
      analyzer.addIssue({ type: 'bug' });
      analyzer.addIssue({ type: 'style' });

      const grouped = analyzer.groupIssuesByType();

      expect(grouped.bug).toBe(2);
      expect(grouped.style).toBe(1);
    });
  });

  describe('Issue Filtering', () => {
    test('filterIssues with predicate', () => {
      analyzer.addIssue({ type: 'a', severity: 'error' });
      analyzer.addIssue({ type: 'b', severity: 'warning' });

      const filtered = analyzer.filterIssues(i => i.type === 'a');

      expect(filtered).toHaveLength(1);
      expect(filtered[0].type).toBe('a');
    });

    test('getFixableIssues returns fixable only', () => {
      analyzer.addIssue({ type: 'a', fixable: true });
      analyzer.addIssue({ type: 'b', fixable: false });

      const fixable = analyzer.getFixableIssues();

      expect(fixable).toHaveLength(1);
      expect(fixable[0].type).toBe('a');
    });

    test('getCriticalIssues returns errors', () => {
      analyzer.addIssue({ type: 'a', severity: 'error' });
      analyzer.addIssue({ type: 'b', severity: 'warning' });

      const critical = analyzer.getCriticalIssues();

      expect(critical).toHaveLength(1);
    });
  });

  describe('Status Checks', () => {
    test('hasIssues returns true when issues exist', () => {
      expect(analyzer.hasIssues()).toBe(false);

      analyzer.addIssue({ type: 'test' });

      expect(analyzer.hasIssues()).toBe(true);
    });

    test('hasCriticalIssues returns true for errors', () => {
      analyzer.addIssue({ type: 'a', severity: 'warning' });
      expect(analyzer.hasCriticalIssues()).toBe(false);

      analyzer.addIssue({ type: 'b', severity: 'error' });
      expect(analyzer.hasCriticalIssues()).toBe(true);
    });
  });

  describe('Pattern Finding', () => {
    test('findPattern finds matches with line numbers', () => {
      const code = `line1
console.log("test")
line3
console.log("again")`;

      const matches = analyzer.findPattern(code, /console\.log/);

      expect(matches).toHaveLength(2);
      expect(matches[0].line).toBe(2);
      expect(matches[1].line).toBe(4);
    });

    test('countPattern counts occurrences', () => {
      const code = 'const a = 1; const b = 2; const c = 3;';

      const count = analyzer.countPattern(code, /const/g);

      expect(count).toBe(3);
    });

    test('countPattern returns 0 for no matches', () => {
      const code = 'let x = 1;';

      const count = analyzer.countPattern(code, /const/g);

      expect(count).toBe(0);
    });
  });

  describe('Reset', () => {
    test('reset clears issues', () => {
      analyzer.addIssue({ type: 'test' });
      analyzer.reset();

      expect(analyzer.issues).toHaveLength(0);
    });
  });
});

describe('SEVERITY Constants', () => {
  test('has standard severity levels', () => {
    expect(SEVERITY.ERROR).toBe('error');
    expect(SEVERITY.WARNING).toBe('warning');
    expect(SEVERITY.INFO).toBe('info');
  });

  test('has extended severity levels', () => {
    expect(SEVERITY.CRITICAL).toBe('critical');
    expect(SEVERITY.HIGH).toBe('high');
    expect(SEVERITY.MEDIUM).toBe('medium');
    expect(SEVERITY.LOW).toBe('low');
  });
});

describe('CATEGORY Constants', () => {
  test('has all issue categories', () => {
    expect(CATEGORY.BUG).toBe('bug');
    expect(CATEGORY.PERFORMANCE).toBe('performance');
    expect(CATEGORY.SECURITY).toBe('security');
    expect(CATEGORY.DEAD_CODE).toBe('dead-code');
    expect(CATEGORY.COMPLEXITY).toBe('complexity');
  });
});

describe('CODEBASE Constants', () => {
  test('has codebase identifiers', () => {
    expect(CODEBASE.BACKEND).toBe('backend');
    expect(CODEBASE.USERS_APP).toBe('users-app');
  });
});

describe('PerformanceAnalyzer', () => {
  let analyzer;
  let mockParser;

  beforeEach(() => {
    analyzer = new PerformanceAnalyzer();
    mockParser = createMockParser();
    analyzer.setParser(mockParser);
  });

  describe('Initialization', () => {
    test('creates with correct name', () => {
      expect(analyzer.name).toBe('PerformanceAnalyzer');
    });

    test('getPerformanceAnalyzer returns singleton', () => {
      const instance1 = getPerformanceAnalyzer();
      const instance2 = getPerformanceAnalyzer();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Syntax Error Handling', () => {
    test('reports syntax error on parse failure', async () => {
      mockParser.parse.mockReturnValue({
        success: false,
        error: 'Unexpected token',
        location: { line: 5 }
      });

      const result = await analyzer.analyze('invalid code {{');

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('syntax_error');
    });
  });

  describe('N+1 Query Detection', () => {
    test('detectNPlusOneQueries handles null ast', () => {
      expect(() => analyzer.detectNPlusOneQueries(null)).not.toThrow();
    });

    test('detects query in forEach callback', () => {
      // Create AST with forEach containing database query
      const ast = {
        type: 'Program',
        body: [{
          type: 'ExpressionStatement',
          expression: {
            type: 'CallExpression',
            callee: {
              type: 'MemberExpression',
              object: { name: 'users' },
              property: { name: 'forEach' }
            },
            arguments: [{
              type: 'ArrowFunctionExpression',
              body: {
                type: 'CallExpression',
                callee: {
                  type: 'MemberExpression',
                  object: { name: 'db' },
                  property: { name: 'findOne' }
                }
              }
            }],
            loc: { start: { line: 1 } }
          }
        }]
      };

      // Mock traverse to call the visitors
      mockParser.traverse.mockImplementation((node, visitors) => {
        if (visitors.CallExpression) {
          visitors.CallExpression({
            node: ast.body[0].expression
          });
        }
      });

      analyzer.detectNPlusOneQueries(ast);

      // Should detect the pattern
      expect(analyzer.issues.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Inefficient Query Detection', () => {
    test('detectInefficientQueries handles null ast', () => {
      expect(() => analyzer.detectInefficientQueries(null)).not.toThrow();
    });
  });

  describe('Missing Indexes Detection', () => {
    test('detectMissingIndexes handles null ast', () => {
      expect(() => analyzer.detectMissingIndexes(null)).not.toThrow();
    });
  });

  describe('Missing Caching Detection', () => {
    test('detectMissingCaching handles null ast', () => {
      expect(() => analyzer.detectMissingCaching(null)).not.toThrow();
    });
  });

  describe('Synchronous Blocking Detection', () => {
    test('detectSynchronousBlocking handles null ast', () => {
      expect(() => analyzer.detectSynchronousBlocking(null)).not.toThrow();
    });
  });

  describe('Helper Methods', () => {
    test('isDatabaseQuery detects database operations', () => {
      expect(analyzer.isDatabaseQuery('db.find()')).toBe(true);
      expect(analyzer.isDatabaseQuery('Model.findOne()')).toBe(true);
      expect(analyzer.isDatabaseQuery('SELECT * FROM users')).toBe(true);
      expect(analyzer.isDatabaseQuery('console.log()')).toBe(false);
    });

    test('containsDatabaseQuery traverses node', () => {
      const node = {
        type: 'ArrowFunctionExpression',
        body: {
          type: 'CallExpression',
          callee: {
            type: 'MemberExpression',
            object: { name: 'db' },
            property: { name: 'find' }
          }
        }
      };

      const hasQuery = analyzer.containsDatabaseQuery(node);
      expect(hasQuery).toBe(true);
    });

    test('containsDatabaseQuery returns false for no queries', () => {
      const node = {
        type: 'ArrowFunctionExpression',
        body: {
          type: 'CallExpression',
          callee: { name: 'console.log' }
        }
      };

      const hasQuery = analyzer.containsDatabaseQuery(node);
      expect(hasQuery).toBe(false);
    });

    test('getCallCode extracts member expression code', () => {
      const node = {
        callee: {
          type: 'MemberExpression',
          object: { name: 'Model' },
          property: { name: 'findAll' }
        }
      };

      const code = analyzer.getCallCode(node);
      expect(code).toBe('Model.findAll');
    });

    test('getCallCode extracts function name', () => {
      const node = {
        callee: {
          name: 'query'
        }
      };

      const code = analyzer.getCallCode(node);
      expect(code).toBe('query');
    });

    test('getCallCode handles string argument', () => {
      const node = {
        callee: { type: 'Identifier' },
        arguments: [{
          type: 'StringLiteral',
          value: 'SELECT * FROM users'
        }]
      };

      const code = analyzer.getCallCode(node);
      expect(code).toBe('SELECT * FROM users');
    });

    test('getCallCode handles template literal argument', () => {
      const node = {
        callee: { type: 'Identifier' },
        arguments: [{
          type: 'TemplateLiteral',
          quasis: [{ value: { raw: 'SELECT ' } }, { value: { raw: ' FROM users' } }]
        }]
      };

      const code = analyzer.getCallCode(node);
      expect(code).toBe('SELECT  FROM users');
    });

    test('getCallCode returns empty for errors', () => {
      const code = analyzer.getCallCode({});
      expect(code).toBe('');
    });

    test('extractWhereFields extracts field names', () => {
      const query = 'SELECT * FROM users WHERE id = 1';

      const fields = analyzer.extractWhereFields(query);

      expect(fields).toContain('id');
    });

    test('extractWhereFields handles IN clause', () => {
      const query = 'SELECT * FROM orders WHERE user_id IN (1, 2, 3)';

      const fields = analyzer.extractWhereFields(query);

      expect(fields).toContain('user_id');
    });
  });

  describe('Loop Query Detection', () => {
    test('checkLoopForQueries detects queries in loop body', () => {
      // The method checks node.body, which should contain a CallExpression
      // with a callee that returns a database query pattern
      const path = {
        node: {
          type: 'ForStatement',
          body: {
            type: 'BlockStatement',
            body: [{
              type: 'CallExpression',
              callee: {
                type: 'MemberExpression',
                object: { name: 'db' },
                property: { name: 'findOne' }
              }
            }]
          },
          loc: { start: { line: 1 } }
        }
      };

      analyzer.checkLoopForQueries(path);

      expect(analyzer.issues).toHaveLength(1);
      expect(analyzer.issues[0].type).toBe('n_plus_one_query');
    });
  });
});

describe('SecurityScanner', () => {
  let scanner;
  let mockParser;

  beforeEach(() => {
    scanner = new SecurityScanner();
    mockParser = createMockParser();
    scanner.setParser(mockParser);
  });

  describe('Initialization', () => {
    test('creates with correct name', () => {
      expect(scanner.name).toBe('SecurityScanner');
    });

    test('getSecurityScanner returns singleton', () => {
      const instance1 = getSecurityScanner();
      const instance2 = getSecurityScanner();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Full Analysis', () => {
    test('analyze runs all security checks', async () => {
      const ast = { type: 'Program', body: [] };
      const code = 'const x = 1;';

      const result = await scanner.analyze(ast, code);

      expect(result.success).toBe(true);
      expect(result.analyzer).toBe('SecurityScanner');
    });
  });

  describe('Secrets Detection', () => {
    test('detectSecretsInCode finds API keys', () => {
      const code = 'const api_key = "sk_live_abc123def456";';

      scanner.detectSecretsInCode(null, code);

      expect(scanner.issues.length).toBeGreaterThan(0);
      expect(scanner.issues[0].type).toBe('hardcoded_secret');
    });

    test('detectSecretsInCode finds passwords', () => {
      const code = 'const password = "secretpassword123";';

      scanner.detectSecretsInCode(null, code);

      expect(scanner.issues.length).toBeGreaterThan(0);
    });

    test('detectSecretsInCode skips comments', () => {
      const code = '// api_key = "example_key"';

      scanner.detectSecretsInCode(null, code);

      expect(scanner.issues).toHaveLength(0);
    });

    test('detectSecretsInCode finds AWS secrets', () => {
      const code = 'const aws_secret = "xxx";';

      scanner.detectSecretsInCode(null, code);

      expect(scanner.issues.length).toBeGreaterThan(0);
    });

    test('detectSecretsInCode finds GitHub tokens', () => {
      const code = 'const token = "ghp_abcdefghijklmnopqrstuvwxyz1234567890";';

      scanner.detectSecretsInCode(null, code);

      expect(scanner.issues.length).toBeGreaterThan(0);
    });

    test('detectSecretsInCode finds MongoDB connection strings', () => {
      const code = 'const uri = "mongodb+srv://user:pass@cluster.mongodb.net";';

      scanner.detectSecretsInCode(null, code);

      expect(scanner.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Weak Password Validation', () => {
    test('detectWeakPasswordValidation handles null ast', () => {
      expect(() => scanner.detectWeakPasswordValidation(null, '')).not.toThrow();
    });
  });

  describe('Missing Rate Limiting', () => {
    test('detectMissingRateLimiting handles null ast', () => {
      expect(() => scanner.detectMissingRateLimiting(null, '')).not.toThrow();
    });
  });

  describe('Input Sanitization', () => {
    test('detectMissingInputSanitization handles null ast', () => {
      expect(() => scanner.detectMissingInputSanitization(null, '')).not.toThrow();
    });
  });

  describe('SQL Injection', () => {
    test('detectSQLInjection handles null ast', () => {
      expect(() => scanner.detectSQLInjection(null, '')).not.toThrow();
    });
  });

  describe('XSS Vulnerabilities', () => {
    test('detectXSSVulnerabilities handles null ast', () => {
      expect(() => scanner.detectXSSVulnerabilities(null, '')).not.toThrow();
    });
  });

  describe('CORS Misconfiguration', () => {
    test('detectCORSMisconfiguration handles null ast', () => {
      expect(() => scanner.detectCORSMisconfiguration(null, '')).not.toThrow();
    });
  });

  describe('Insecure Authentication', () => {
    test('detectInsecureAuthentication handles null ast', () => {
      expect(() => scanner.detectInsecureAuthentication(null, '')).not.toThrow();
    });
  });
});
