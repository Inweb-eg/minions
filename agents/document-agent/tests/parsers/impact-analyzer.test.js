import { describe, test, expect, beforeEach } from '@jest/globals';
import ImpactAnalyzer, { getImpactAnalyzer } from '../../parsers/code-parser/impact-analyzer.js';

describe('ImpactAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ImpactAnalyzer();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(analyzer).toBeDefined();
      expect(analyzer.logger).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getImpactAnalyzer();
      const instance2 = getImpactAnalyzer();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Route Impact Analysis', () => {
    test('should analyze removed route as critical', () => {
      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('critical');
      expect(impact.byCategory.api.length).toBe(1);
      expect(impact.byCategory.api[0].severity).toBe('critical');
      expect(impact.byCategory.api[0].requiresDeployment).toBe(true);
    });

    test('should analyze added route as low severity', () => {
      const changes = {
        additions: [
          {
            type: 'route_added',
            category: 'routes',
            newValue: { method: 'POST', path: '/api/users' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('low');
      expect(impact.byCategory.api.length).toBe(1);
      expect(impact.byCategory.api[0].severity).toBe('low');
      expect(impact.byCategory.api[0].requiresDocumentation).toBe(true);
    });

    test('should detect authentication removal as security risk', () => {
      const changes = {
        breaking: [
          {
            type: 'route_middleware_removed',
            category: 'routes',
            removed: ['authenticate'],
            newValue: { middleware: [] }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('critical');
      expect(impact.byCategory.security.length).toBe(1);
      expect(impact.byCategory.security[0].type).toBe('authentication_removed');
      expect(impact.byCategory.security[0].requiresSecurityReview).toBe(true);
      expect(impact.risks.length).toBe(1);
      expect(impact.risks[0].type).toBe('security_vulnerability');
    });
  });

  describe('Model Impact Analysis', () => {
    test('should analyze field removal as high severity', () => {
      const changes = {
        breaking: [
          {
            type: 'field_removed',
            category: 'models',
            model: 'UserSchema',
            field: 'email'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('high');
      expect(impact.overall.requiresMigration).toBe(true);
      expect(impact.byCategory.database.length).toBe(1);
      expect(impact.byCategory.database[0].severity).toBe('high');
      expect(impact.byCategory.database[0].requiresMigration).toBe(true);
      expect(impact.risks.length).toBe(1);
      expect(impact.risks[0].type).toBe('data_loss');
    });

    test('should analyze field type change as high severity', () => {
      const changes = {
        breaking: [
          {
            type: 'field_type_changed',
            category: 'models',
            model: 'UserSchema',
            field: 'age',
            oldValue: { type: 'String' },
            newValue: { type: 'Number' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('high');
      expect(impact.overall.requiresMigration).toBe(true);
      expect(impact.byCategory.database.length).toBe(1);
      expect(impact.byCategory.database[0].requiresValidation).toBe(true);
    });

    test('should analyze required field addition as high severity', () => {
      const changes = {
        breaking: [
          {
            type: 'required_field_added',
            category: 'models',
            model: 'UserSchema',
            field: 'password'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('high');
      expect(impact.overall.requiresMigration).toBe(true);
      expect(impact.byCategory.database.length).toBe(1);
      expect(impact.byCategory.database[0].requiresValidation).toBe(true);
    });

    test('should analyze model removal as critical', () => {
      const changes = {
        breaking: [
          {
            type: 'model_removed',
            category: 'models',
            oldValue: { name: 'UserSchema' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('critical');
      expect(impact.overall.requiresMigration).toBe(true);
      expect(impact.byCategory.database.length).toBe(1);
      expect(impact.byCategory.database[0].severity).toBe('critical');
      expect(impact.byCategory.database[0].requiresDowntime).toBe(true);
    });
  });

  describe('Controller Impact Analysis', () => {
    test('should analyze controller signature change', () => {
      const changes = {
        breaking: [
          {
            type: 'controller_signature_changed',
            category: 'controllers',
            name: 'getAllUsers'
          }
        ]
      };

      const codebase = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers' }
        ]
      };

      const impact = analyzer.analyze(changes, codebase);

      expect(impact.byCategory.dependencies.length).toBe(1);
      expect(impact.byCategory.dependencies[0].type).toBe('controller_signature_changed');
      expect(impact.byCategory.dependencies[0].affectedRoutes).toContain('GET /api/users');
    });

    test('should analyze controller removal', () => {
      const changes = {
        breaking: [
          {
            type: 'controller_removed',
            category: 'controllers',
            name: 'getAllUsers'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.byCategory.dependencies.length).toBe(1);
      expect(impact.byCategory.dependencies[0].type).toBe('controller_removed');
      expect(impact.byCategory.dependencies[0].severity).toBe('high');
    });
  });

  describe('Service Impact Analysis', () => {
    test('should analyze service signature change', () => {
      const changes = {
        breaking: [
          {
            type: 'service_signature_changed',
            category: 'services',
            service: 'findUsers'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.byCategory.dependencies.length).toBe(1);
      expect(impact.byCategory.dependencies[0].type).toBe('service_signature_changed');
      expect(impact.byCategory.dependencies[0].severity).toBe('medium');
    });

    test('should analyze service removal', () => {
      const changes = {
        breaking: [
          {
            type: 'service_removed',
            category: 'services',
            name: 'findUsers'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.byCategory.dependencies.length).toBe(1);
      expect(impact.byCategory.dependencies[0].type).toBe('service_removed');
      expect(impact.byCategory.dependencies[0].severity).toBe('high');
    });
  });

  describe('Overall Impact Calculation', () => {
    test('should calculate critical overall severity', () => {
      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('critical');
      expect(impact.overall.riskLevel).toBe('critical');
    });

    test('should calculate high overall severity', () => {
      const changes = {
        breaking: [
          {
            type: 'field_removed',
            category: 'models',
            model: 'UserSchema',
            field: 'email'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('high');
      expect(impact.overall.riskLevel).toBe('high');
    });

    test('should calculate medium overall severity', () => {
      const changes = {
        breaking: [
          {
            type: 'controller_signature_changed',
            category: 'controllers',
            name: 'getAllUsers'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('medium');
    });

    test('should calculate low overall severity', () => {
      const changes = {
        additions: [
          {
            type: 'route_added',
            category: 'routes',
            newValue: { method: 'POST', path: '/api/users' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('low');
    });

    test('should count affected components', () => {
      const changes = {
        breaking: [
          {
            type: 'field_removed',
            category: 'models',
            model: 'UserSchema',
            field: 'email'
          },
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.affectedComponents).toBeGreaterThan(0);
      expect(impact.affectedComponents.length).toBeGreaterThan(0);
    });
  });

  describe('Recommendations', () => {
    test('should provide critical recommendations', () => {
      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.recommendations.length).toBeGreaterThan(0);
      expect(impact.recommendations.some(r => r.includes('CRITICAL'))).toBe(true);
    });

    test('should provide migration recommendations', () => {
      const changes = {
        breaking: [
          {
            type: 'field_removed',
            category: 'models',
            model: 'UserSchema',
            field: 'email'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.recommendations.some(r => r.includes('migration'))).toBe(true);
    });

    test('should provide security recommendations', () => {
      const changes = {
        breaking: [
          {
            type: 'route_middleware_removed',
            category: 'routes',
            removed: ['authenticate']
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.recommendations.some(r => r.includes('security'))).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    test('should identify API breakage risk', () => {
      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.risks.length).toBe(1);
      expect(impact.risks[0].type).toBe('api_breakage');
      expect(impact.risks[0].severity).toBe('critical');
    });

    test('should identify data loss risk', () => {
      const changes = {
        breaking: [
          {
            type: 'field_removed',
            category: 'models',
            model: 'UserSchema',
            field: 'email'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.risks.length).toBe(1);
      expect(impact.risks[0].type).toBe('data_loss');
    });

    test('should identify security vulnerability risk', () => {
      const changes = {
        breaking: [
          {
            type: 'route_middleware_removed',
            category: 'routes',
            removed: ['authenticate']
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.risks.some(r => r.type === 'security_vulnerability')).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    test('should analyze multiple changes across categories', () => {
      const changes = {
        breaking: [
          {
            type: 'route_removed',
            category: 'routes',
            oldValue: { method: 'GET', path: '/api/users' }
          },
          {
            type: 'field_removed',
            category: 'models',
            model: 'UserSchema',
            field: 'email'
          },
          {
            type: 'route_middleware_removed',
            category: 'routes',
            removed: ['authenticate']
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('critical');
      expect(impact.byCategory.api.length).toBeGreaterThan(0);
      expect(impact.byCategory.database.length).toBeGreaterThan(0);
      expect(impact.byCategory.security.length).toBeGreaterThan(0);
      expect(impact.risks.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty changes', () => {
      const changes = {
        breaking: [],
        nonBreaking: [],
        additions: []
      };

      const impact = analyzer.analyze(changes);

      expect(impact.overall.severity).toBe('low');
      expect(impact.overall.affectedComponents).toBe(0);
    });

    test('should handle missing codebase', () => {
      const changes = {
        breaking: [
          {
            type: 'controller_signature_changed',
            category: 'controllers',
            name: 'getAllUsers'
          }
        ]
      };

      const impact = analyzer.analyze(changes);

      expect(impact).toBeDefined();
      expect(impact.overall).toBeDefined();
    });
  });
});
