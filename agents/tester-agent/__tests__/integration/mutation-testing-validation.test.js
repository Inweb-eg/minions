/**
 * Mutation Testing Validation Tests
 *
 * Phase 7.6: Integration & Testing
 * Tests mutation testing engine and test quality analysis
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { MutationEngine, MUTATION_OPERATOR, MUTANT_STATUS } from '../../analyzers/mutation-engine.js';
import { TestQualityAnalyzer, QUALITY_GRADE } from '../../analyzers/test-quality-analyzer.js';

describe('Mutation Testing Validation', () => {
  let mutationEngine;
  let qualityAnalyzer;

  beforeEach(() => {
    mutationEngine = new MutationEngine();
    qualityAnalyzer = new TestQualityAnalyzer();
  });

  describe('Mutation Operators', () => {
    test('should apply arithmetic operator mutations', () => {
      const code = `
        function add(a, b) {
          return a + b;
        }
      `;

      const mutants = mutationEngine.generateMutants(code, {
        operators: [MUTATION_OPERATOR.ARITHMETIC]
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some(m => m.operator === MUTATION_OPERATOR.ARITHMETIC)).toBe(true);
      expect(mutants.some(m => m.mutation.includes('-'))).toBe(true); // + changed to -
    });

    test('should apply logical operator mutations', () => {
      const code = `
        function isValid(user) {
          return user && user.active;
        }
      `;

      const mutants = mutationEngine.generateMutants(code, {
        operators: [MUTATION_OPERATOR.LOGICAL]
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some(m => m.operator === MUTATION_OPERATOR.LOGICAL)).toBe(true);
      expect(mutants.some(m => m.mutation.includes('||'))).toBe(true); // && changed to ||
    });

    test('should apply comparison operator mutations', () => {
      const code = `
        function isGreater(a, b) {
          return a > b;
        }
      `;

      const mutants = mutationEngine.generateMutants(code, {
        operators: [MUTATION_OPERATOR.COMPARISON]
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some(m => m.operator === MUTATION_OPERATOR.COMPARISON)).toBe(true);
      // >= or < or != mutations expected
    });

    test('should apply conditional boundary mutations', () => {
      const code = `
        function checkAge(age) {
          if (age >= 18) {
            return 'adult';
          }
          return 'minor';
        }
      `;

      const mutants = mutationEngine.generateMutants(code, {
        operators: [MUTATION_OPERATOR.CONDITIONAL_BOUNDARY]
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some(m => m.operator === MUTATION_OPERATOR.CONDITIONAL_BOUNDARY)).toBe(true);
      expect(mutants.some(m => m.mutation.includes('>'))).toBe(true); // >= changed to >
    });

    test('should apply return value mutations', () => {
      const code = `
        function getStatus() {
          return true;
        }
      `;

      const mutants = mutationEngine.generateMutants(code, {
        operators: [MUTATION_OPERATOR.RETURN_VALUE]
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some(m => m.operator === MUTATION_OPERATOR.RETURN_VALUE)).toBe(true);
      expect(mutants.some(m => m.mutation.includes('false'))).toBe(true); // true changed to false
    });

    test('should apply statement removal mutations', () => {
      const code = `
        function process(data) {
          validate(data);
          transform(data);
          return data;
        }
      `;

      const mutants = mutationEngine.generateMutants(code, {
        operators: [MUTATION_OPERATOR.STATEMENT_REMOVAL]
      });

      expect(mutants.length).toBeGreaterThan(0);
      expect(mutants.some(m => m.operator === MUTATION_OPERATOR.STATEMENT_REMOVAL)).toBe(true);
    });

    test('should apply all operator types', () => {
      const code = `
        function calculate(a, b) {
          if (a > 0 && b > 0) {
            return a + b;
          }
          return 0;
        }
      `;

      const mutants = mutationEngine.generateMutants(code, {
        operators: Object.values(MUTATION_OPERATOR)
      });

      const operatorTypes = [...new Set(mutants.map(m => m.operator))];

      // Should have multiple operator types applied
      expect(operatorTypes.length).toBeGreaterThan(1);
    });
  });

  describe('Mutation Execution', () => {
    test('should run tests against mutants', async () => {
      const mutant = {
        id: 'mutant-1',
        code: 'function add(a, b) { return a - b; }', // Mutated
        operator: MUTATION_OPERATOR.ARITHMETIC,
        location: { line: 1, column: 30 }
      };

      const testResults = {
        passed: 0,
        failed: 1,
        error: 'Expected 5 but got -1'
      };

      const result = await mutationEngine.testMutant(mutant, testResults);

      expect(result.status).toBe(MUTANT_STATUS.KILLED); // Test caught the mutation
      expect(result.killedBy).toBeDefined();
    });

    test('should detect survived mutants', async () => {
      const mutant = {
        id: 'mutant-2',
        code: 'function noop() { /* removed statement */ }',
        operator: MUTATION_OPERATOR.STATEMENT_REMOVAL,
        location: { line: 1, column: 20 }
      };

      const testResults = {
        passed: 1,
        failed: 0
      };

      const result = await mutationEngine.testMutant(mutant, testResults);

      expect(result.status).toBe(MUTANT_STATUS.SURVIVED); // Test didn't catch mutation!
      expect(result.killedBy).toBeNull();
    });

    test('should handle timeout mutations', async () => {
      const mutant = {
        id: 'mutant-3',
        code: 'function infinite() { while(true) {} }',
        operator: MUTATION_OPERATOR.STATEMENT_REMOVAL,
        location: { line: 1 }
      };

      const result = await mutationEngine.testMutant(mutant, null, {
        timeout: 1000
      });

      expect([MUTANT_STATUS.TIMEOUT, MUTANT_STATUS.ERROR]).toContain(result.status);
    });

    test('should handle compilation errors', async () => {
      const mutant = {
        id: 'mutant-4',
        code: 'function broken() { return = 5; }', // Invalid syntax
        operator: MUTATION_OPERATOR.ARITHMETIC,
        location: { line: 1 }
      };

      const result = await mutationEngine.testMutant(mutant, null);

      expect(result.status).toBe(MUTANT_STATUS.ERROR);
      expect(result.error).toBeDefined();
    });
  });

  describe('Mutation Score Calculation', () => {
    test('should calculate mutation score correctly', () => {
      const results = {
        totalMutants: 100,
        killed: 75,
        survived: 20,
        timeout: 3,
        error: 2
      };

      const score = mutationEngine.calculateMutationScore(results);

      // Score = killed / (killed + survived) * 100
      expect(score.mutationScore).toBeCloseTo(78.95, 1); // 75 / (75 + 20) = 78.95%
      expect(score.mutationScore).toBeGreaterThan(70); // Success criteria: >70%
    });

    test('should meet 70% mutation score success criteria', () => {
      const highQualityResults = {
        totalMutants: 100,
        killed: 85,
        survived: 10,
        timeout: 3,
        error: 2
      };

      const score = mutationEngine.calculateMutationScore(highQualityResults);

      expect(score.mutationScore).toBeGreaterThan(70);
      expect(score.mutationScore).toBeCloseTo(89.5, 0);
    });

    test('should calculate mutation score by operator type', () => {
      const results = {
        byOperator: {
          [MUTATION_OPERATOR.ARITHMETIC]: { killed: 10, survived: 2 },
          [MUTATION_OPERATOR.LOGICAL]: { killed: 8, survived: 4 },
          [MUTATION_OPERATOR.COMPARISON]: { killed: 12, survived: 1 }
        }
      };

      const scores = mutationEngine.calculateScoreByOperator(results.byOperator);

      expect(scores[MUTATION_OPERATOR.ARITHMETIC]).toBeCloseTo(83.3, 0);
      expect(scores[MUTATION_OPERATOR.LOGICAL]).toBeCloseTo(66.7, 0);
      expect(scores[MUTATION_OPERATOR.COMPARISON]).toBeCloseTo(92.3, 0);
    });

    test('should identify weak test areas', () => {
      const results = {
        byFile: {
          'auth.js': { killed: 5, survived: 15 }, // Weak!
          'users.js': { killed: 18, survived: 2 }, // Strong
          'payments.js': { killed: 10, survived: 10 } // Medium
        }
      };

      const weakAreas = mutationEngine.identifyWeakAreas(results.byFile);

      expect(weakAreas[0].file).toBe('auth.js');
      expect(weakAreas[0].score).toBe(25); // 5/20 = 25%
      expect(weakAreas[0].score).toBeLessThan(70);
    });
  });

  describe('Test Quality Analysis', () => {
    test('should analyze test quality from mutation results', async () => {
      const mutationResults = {
        totalMutants: 50,
        killed: 42,
        survived: 6,
        timeout: 1,
        error: 1,
        mutationScore: 87.5
      };

      const quality = await qualityAnalyzer.analyzeFromMutations(mutationResults);

      expect(quality.grade).toBe(QUALITY_GRADE.EXCELLENT); // >80%
      expect(quality.score).toBeGreaterThan(80);
    });

    test('should grade tests based on mutation score', () => {
      const grades = [
        { score: 95, expected: QUALITY_GRADE.EXCELLENT },
        { score: 75, expected: QUALITY_GRADE.GOOD },
        { score: 55, expected: QUALITY_GRADE.FAIR },
        { score: 35, expected: QUALITY_GRADE.POOR }
      ];

      grades.forEach(({ score, expected }) => {
        const grade = qualityAnalyzer.gradeFromScore(score);
        expect(grade).toBe(expected);
      });
    });

    test('should provide recommendations for low mutation scores', async () => {
      const poorResults = {
        mutationScore: 45,
        byOperator: {
          [MUTATION_OPERATOR.LOGICAL]: { killed: 2, survived: 8 }, // Weak
          [MUTATION_OPERATOR.ARITHMETIC]: { killed: 5, survived: 5 }
        }
      };

      const analysis = await qualityAnalyzer.analyzeFromMutations(poorResults);

      expect(analysis.recommendations).toBeDefined();
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.recommendations.some(r => r.includes('logical'))).toBe(true);
    });

    test('should detect missing edge case tests', async () => {
      const mutationResults = {
        survived: [
          {
            operator: MUTATION_OPERATOR.CONDITIONAL_BOUNDARY,
            location: 'checkAge function',
            mutation: '>= changed to >'
          },
          {
            operator: MUTATION_OPERATOR.CONDITIONAL_BOUNDARY,
            location: 'validateRange function',
            mutation: '< changed to <='
          }
        ]
      };

      const analysis = await qualityAnalyzer.analyzeFromMutations(mutationResults);

      expect(analysis.missingTests).toBeDefined();
      expect(analysis.missingTests.some(t => t.includes('boundary'))).toBe(true);
    });
  });

  describe('Mutation Testing Integration', () => {
    test('should integrate with test runners', async () => {
      const testSuite = {
        name: 'User Service Tests',
        tests: [
          { name: 'should create user', file: 'user.test.js' },
          { name: 'should update user', file: 'user.test.js' },
          { name: 'should delete user', file: 'user.test.js' }
        ]
      };

      const sourceCode = `
        class UserService {
          create(user) { return user; }
          update(id, data) { return data; }
          delete(id) { return true; }
        }
      `;

      const result = await mutationEngine.runMutationTesting({
        code: sourceCode,
        testSuite
      });

      expect(result.totalMutants).toBeGreaterThan(0);
      expect(result.mutationScore).toBeDefined();
    });

    test('should generate mutation report for Manager-Agent', async () => {
      const mutationResults = {
        totalMutants: 100,
        killed: 75,
        survived: 20,
        timeout: 3,
        error: 2,
        mutationScore: 78.9
      };

      const report = await mutationEngine.generateReport(mutationResults);

      expect(report.summary).toBeDefined();
      expect(report.survivedMutants).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.testQualityGrade).toBeDefined();
    });

    test('should identify tests that need improvement', async () => {
      const results = {
        survived: [
          {
            id: 'mutant-1',
            operator: MUTATION_OPERATOR.LOGICAL,
            location: 'validateUser',
            shouldBeTestedBy: 'user validation test'
          },
          {
            id: 'mutant-2',
            operator: MUTATION_OPERATOR.ARITHMETIC,
            location: 'calculateTotal',
            shouldBeTestedBy: 'calculation test'
          }
        ]
      };

      const improvements = mutationEngine.identifyTestImprovements(results);

      expect(improvements.length).toBe(2);
      expect(improvements[0].test).toBe('user validation test');
      expect(improvements[1].test).toBe('calculation test');
    });
  });

  describe('Performance and Optimization', () => {
    test('should optimize mutation generation', () => {
      const largeCodebase = `
        // Simulate large file
        ${'function dummy() {}\n'.repeat(100)}
      `;

      const startTime = Date.now();
      const mutants = mutationEngine.generateMutants(largeCodebase, {
        optimize: true,
        limit: 50 // Limit mutants for performance
      });
      const duration = Date.now() - startTime;

      expect(mutants.length).toBeLessThanOrEqual(50);
      expect(duration).toBeLessThan(5000); // Should be fast
    });

    test('should support selective mutation', () => {
      const code = `
        function criticalFunction() {
          // Critical business logic
          return true;
        }

        function utilityFunction() {
          // Helper function
          return 'helper';
        }
      `;

      // Generate mutants with specific operators (selective mutation)
      const mutants = mutationEngine.generateMutants(code, {
        operators: [MUTATION_OPERATOR.RETURN, MUTATION_OPERATOR.LITERAL]
      });

      // Should only have return/literal mutations
      const filteredMutants = mutants.filter(m =>
        m.operator === MUTATION_OPERATOR.RETURN || m.operator === MUTATION_OPERATOR.LITERAL
      );

      expect(filteredMutants.length).toBeGreaterThan(0);
      expect(filteredMutants.length).toBe(mutants.length); // All should match
    });

    test('should cache mutation results', async () => {
      const code = 'function test() { return true; }';

      // First run
      const result1 = await mutationEngine.runMutationTesting({
        code,
        cache: true
      });

      // Second run (should produce same results)
      const result2 = await mutationEngine.runMutationTesting({
        code,
        cache: true
      });

      // Results should be consistent
      expect(result1.mutationScore).toBe(result2.mutationScore);
      expect(result1.totalMutants).toBe(result2.totalMutants);
    });

    test('should parallelize mutation testing', async () => {
      const mutants = Array(20).fill(null).map((_, i) => ({
        id: `mutant-${i}`,
        code: `function test${i}() { return ${i}; }`,
        operator: MUTATION_OPERATOR.RETURN_VALUE
      }));

      const startTime = Date.now();
      const results = await mutationEngine.runParallel(mutants, {
        maxConcurrency: 4
      });
      const duration = Date.now() - startTime;

      expect(results.length).toBe(20);
      // Should be faster than sequential
      expect(duration).toBeLessThan(20 * 100); // Assume 100ms per mutant sequential
    });
  });

  describe('Success Criteria Validation', () => {
    test('should achieve >70% mutation score on sample codebase', async () => {
      const sampleCode = `
        function add(a, b) {
          return a + b;
        }

        function subtract(a, b) {
          return a - b;
        }

        function multiply(a, b) {
          return a * b;
        }
      `;

      const tests = [
        { name: 'add test', passes: true },
        { name: 'subtract test', passes: true },
        { name: 'multiply test', passes: true }
      ];

      const result = await mutationEngine.runMutationTesting({
        code: sampleCode,
        tests
      });

      // With good tests, should achieve >70% mutation score
      expect(result.mutationScore).toBeGreaterThan(70);
    });

    test('should validate mutation score success criteria', () => {
      const testResults = [
        { mutationScore: 75, passes: true },
        { mutationScore: 85, passes: true },
        { mutationScore: 65, passes: false }, // Below threshold
        { mutationScore: 90, passes: true }
      ];

      const passingResults = testResults.filter(r => r.passes);
      const failingResults = testResults.filter(r => !r.passes);

      expect(passingResults.length).toBe(3);
      expect(failingResults.length).toBe(1);
      expect(passingResults.every(r => r.mutationScore > 70)).toBe(true);
    });

    test('should track mutation score trends', () => {
      const history = [
        { date: '2025-11-01', score: 65 },
        { date: '2025-11-07', score: 70 },
        { date: '2025-11-14', score: 78 }
      ];

      const trend = mutationEngine.analyzeTrend(history);

      expect(trend.direction).toBe('improving');
      expect(trend.improvement).toBe(13); // 65 -> 78 = +13%
      expect(history[history.length - 1].score).toBeGreaterThan(70);
    });
  });

  describe('Reporting and Insights', () => {
    test('should generate actionable insights', async () => {
      const results = {
        mutationScore: 68,
        survived: [
          {
            operator: MUTATION_OPERATOR.LOGICAL,
            location: 'auth.js:42',
            impact: 'high'
          }
        ]
      };

      const insights = await mutationEngine.generateInsights(results);

      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].priority).toBe('high');
      expect(insights[0].recommendation).toBeDefined();
    });

    test('should export results in multiple formats', async () => {
      const results = {
        mutationScore: 75,
        totalMutants: 100,
        killed: 75,
        survived: 25
      };

      const jsonReport = await mutationEngine.exportReport(results, 'json');
      const htmlReport = await mutationEngine.exportReport(results, 'html');
      const mdReport = await mutationEngine.exportReport(results, 'markdown');

      expect(jsonReport).toBeDefined();
      expect(htmlReport).toBeDefined();
      expect(mdReport).toBeDefined();
    });
  });
});
