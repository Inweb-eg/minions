/**
 * Codebase Analyzer - Integration Tests
 *
 * Phase 6.5: Codebase Analyzer Agent
 * Tests main orchestrator and analyzer integration
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { CodebaseAnalyzer, getCodebaseAnalyzer } from '../codebase-analyzer.js';
import { SEVERITY, CATEGORY, CODEBASE } from '../analyzers/base-analyzer.js';

describe('CodebaseAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new CodebaseAnalyzer();
  });

  describe('Initialization', () => {
    it('should create analyzer instance', () => {
      expect(analyzer).toBeInstanceOf(CodebaseAnalyzer);
    });

    it('should have all 5 analyzers', () => {
      expect(analyzer.analyzers).toHaveProperty('dependency');
      expect(analyzer.analyzers).toHaveProperty('apiContract');
      expect(analyzer.analyzers).toHaveProperty('security');
      expect(analyzer.analyzers).toHaveProperty('technicalDebt');
      expect(analyzer.analyzers).toHaveProperty('performance');
    });

    it('should return singleton instance', () => {
      const instance1 = getCodebaseAnalyzer();
      const instance2 = getCodebaseAnalyzer();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Path Resolution', () => {
    it('should resolve codebase paths correctly', () => {
      const basePath = '/test/project';
      const paths = analyzer.resolveCodebasePaths(basePath);

      expect(paths).toEqual({
        backend: '/test/project/backend',
        usersApp: '/test/project/users-app',
        driversApp: '/test/project/drivers-app',
        adminDashboard: '/test/project/admin-dashboard'
      });
    });
  });

  describe('Health Score Calculation', () => {
    it('should calculate health score with no issues', () => {
      const mockResults = {
        analyzers: {
          security: { metrics: { security_score: 100 }, counts: {} },
          performance: { metrics: { performance_score: 100 }, counts: {} },
          apiContract: { counts: {} },
          dependency: { counts: {} },
          technicalDebt: { metrics: { total_debt_hours: '0' }, counts: {} }
        }
      };

      const healthScore = analyzer.calculateHealthScore(mockResults);

      expect(healthScore.overall).toBeGreaterThanOrEqual(95);
      expect(healthScore.grade).toBe('A');
      expect(healthScore.security).toBe(100);
      expect(healthScore.performance).toBe(100);
    });

    it('should calculate health score with critical issues', () => {
      const mockResults = {
        analyzers: {
          security: { metrics: { security_score: 50 }, counts: { critical: 5 } },
          performance: { metrics: { performance_score: 60 }, counts: {} },
          apiContract: { counts: { critical: 3, high: 5 } },
          dependency: { counts: {} },
          technicalDebt: { metrics: { total_debt_hours: '100' }, counts: {} }
        }
      };

      const healthScore = analyzer.calculateHealthScore(mockResults);

      expect(healthScore.overall).toBeLessThan(70);
      expect(healthScore.grade).not.toBe('A');
    });
  });

  describe('Score to Grade Conversion', () => {
    it('should convert score to correct grade', () => {
      expect(analyzer.scoreToGrade(95)).toBe('A');
      expect(analyzer.scoreToGrade(85)).toBe('B');
      expect(analyzer.scoreToGrade(75)).toBe('C');
      expect(analyzer.scoreToGrade(65)).toBe('D');
      expect(analyzer.scoreToGrade(50)).toBe('F');
    });
  });

  describe('Critical Issues Extraction', () => {
    it('should extract critical and high severity issues', () => {
      const mockResults = {
        analyzers: {
          security: {
            success: true,
            issues: [
              { severity: 'critical', type: 'sql_injection', message: 'SQL injection' },
              { severity: 'high', type: 'xss', message: 'XSS vulnerability' },
              { severity: 'medium', type: 'other', message: 'Medium issue' }
            ]
          },
          performance: {
            success: true,
            issues: [
              { severity: 'critical', type: 'n_plus_one', message: 'N+1 query' }
            ]
          }
        }
      };

      const critical = analyzer.extractCriticalIssues(mockResults);

      expect(critical).toHaveLength(3);
      expect(critical[0].severity).toBe('critical');
      expect(critical[2].severity).toBe('high');
    });

    it('should sort critical issues by severity', () => {
      const mockResults = {
        analyzers: {
          security: {
            success: true,
            issues: [
              { severity: 'high', type: 'xss', message: 'XSS' },
              { severity: 'critical', type: 'sql_injection', message: 'SQL' }
            ]
          }
        }
      };

      const critical = analyzer.extractCriticalIssues(mockResults);

      expect(critical[0].severity).toBe('critical');
      expect(critical[1].severity).toBe('high');
    });
  });

  describe('Dashboard Generation', () => {
    it('should generate dashboard with correct totals', () => {
      const mockResults = {
        analyzers: {
          security: {
            success: true,
            counts: { total: 10, critical: 2, high: 3, medium: 3, low: 2 },
            issues: [
              { severity: 'critical', codebase: 'backend', category: 'security' },
              { severity: 'high', codebase: 'backend', category: 'security' }
            ],
            metrics: { security_score: 70 }
          },
          performance: {
            success: true,
            counts: { total: 5, critical: 0, high: 1, medium: 2, low: 2 },
            issues: [
              { severity: 'high', codebase: 'admin-dashboard', category: 'performance' }
            ],
            metrics: { performance_score: 80 }
          }
        }
      };

      const dashboard = analyzer.generateDashboard(mockResults);

      expect(dashboard.overview.totalIssues).toBe(15);
      expect(dashboard.overview.criticalIssues).toBe(2);
      expect(dashboard.overview.highIssues).toBe(4);
      expect(dashboard.byAnalyzer.security.totalIssues).toBe(10);
      expect(dashboard.byAnalyzer.performance.totalIssues).toBe(5);
      expect(dashboard.byCodebase.backend.critical).toBe(1);
      expect(dashboard.byCategory.security.count).toBe(2);
    });
  });

  describe('Recommendations Generation', () => {
    it('should recommend security fixes for low security score', () => {
      const mockResults = {
        healthScore: { security: 50, performance: 80, apiContract: 90, dependency: 90, technicalDebt: 90 },
        analyzers: {
          apiContract: { counts: {} },
          technicalDebt: { metrics: {} },
          dependency: { issues: [] }
        }
      };

      const recommendations = analyzer.generateRecommendations(mockResults);

      const securityRec = recommendations.find(r => r.category === 'security');
      expect(securityRec).toBeDefined();
      expect(securityRec.priority).toBe('critical');
    });

    it('should recommend performance optimization', () => {
      const mockResults = {
        healthScore: { security: 90, performance: 50, apiContract: 90, dependency: 90, technicalDebt: 90 },
        analyzers: {
          apiContract: { counts: {} },
          technicalDebt: { metrics: {} },
          dependency: { issues: [] }
        }
      };

      const recommendations = analyzer.generateRecommendations(mockResults);

      const perfRec = recommendations.find(r => r.category === 'performance');
      expect(perfRec).toBeDefined();
      expect(perfRec.priority).toBe('high');
    });
  });

  describe('Executive Summary', () => {
    it('should generate correct executive summary', () => {
      const mockResults = {
        dashboard: {
          overview: {
            totalIssues: 20,
            criticalIssues: 3,
            highIssues: 5,
            mediumIssues: 7,
            lowIssues: 5
          }
        },
        healthScore: {
          overall: 75,
          grade: 'C',
          security: 70,
          performance: 80
        },
        analyzers: {
          technicalDebt: {
            metrics: { total_debt_hours: '50', total_debt_cost: '$3750' },
            counts: { total: 10 }
          },
          security: { counts: { total: 8 } },
          performance: { counts: { total: 5 } }
        }
      };

      const summary = analyzer.generateExecutiveSummary(mockResults);

      expect(summary.healthScore.overall).toBe(75);
      expect(summary.healthScore.grade).toBe('C');
      expect(summary.healthScore.status).toBe('Healthy');
      expect(summary.issuesSummary.total).toBe(20);
      expect(summary.issuesSummary.actionRequired).toBe(8);
      expect(summary.techDebt.hours).toBe('50');
      expect(summary.techDebt.cost).toBe('$3750');
    });
  });

  describe('Manager Report', () => {
    it('should generate manager-compatible report', () => {
      const mockResults = {
        healthScore: { overall: 85 },
        summary: { healthScore: { status: 'Healthy' } },
        criticalIssues: [],
        recommendations: [],
        timestamp: '2025-01-01T00:00:00.000Z'
      };

      const report = analyzer.generateManagerReport(mockResults);

      expect(report.agentName).toBe('codebase-analyzer');
      expect(report.status).toBe('success');
      expect(report.healthScore).toBeDefined();
      expect(report.timestamp).toBe('2025-01-01T00:00:00.000Z');
    });

    it('should set warning status for low health score', () => {
      const mockResults = {
        healthScore: { overall: 65 },
        summary: { healthScore: { status: 'Needs Attention' } },
        criticalIssues: [],
        recommendations: [],
        timestamp: '2025-01-01T00:00:00.000Z'
      };

      const report = analyzer.generateManagerReport(mockResults);

      expect(report.status).toBe('warning');
    });
  });

  describe('Constants Export', () => {
    it('should export SEVERITY constants', () => {
      expect(SEVERITY.CRITICAL).toBe('critical');
      expect(SEVERITY.HIGH).toBe('high');
      expect(SEVERITY.MEDIUM).toBe('medium');
      expect(SEVERITY.LOW).toBe('low');
      expect(SEVERITY.INFO).toBe('info');
    });

    it('should export CATEGORY constants', () => {
      expect(CATEGORY.SECURITY).toBe('security');
      expect(CATEGORY.PERFORMANCE).toBe('performance');
      expect(CATEGORY.TECHNICAL_DEBT).toBe('technical-debt');
      expect(CATEGORY.DEPENDENCY).toBe('dependency');
      expect(CATEGORY.API_CONTRACT).toBe('api-contract');
    });

    it('should export CODEBASE constants', () => {
      expect(CODEBASE.BACKEND).toBe('backend');
      expect(CODEBASE.USERS_APP).toBe('users-app');
      expect(CODEBASE.DRIVERS_APP).toBe('drivers-app');
      expect(CODEBASE.ADMIN_DASHBOARD).toBe('admin-dashboard');
    });
  });
});
