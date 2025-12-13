import { describe, test, expect, beforeEach } from '@jest/globals';
import BreakingChangeDetector, { getBreakingChangeDetector } from '../../parsers/code-parser/breaking-change-detector.js';

describe('BreakingChangeDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new BreakingChangeDetector();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(detector).toBeDefined();
      expect(detector.logger).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getBreakingChangeDetector();
      const instance2 = getBreakingChangeDetector();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Route Changes', () => {
    test('should detect removed route as breaking', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] }
        ]
      };

      const newCode = {
        routes: []
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('route_removed');
      expect(changes.breaking[0].severity).toBe('breaking');
      expect(changes.breaking[0].category).toBe('routes');
      expect(changes.breaking[0].message).toContain('Route removed: GET /api/users');
    });

    test('should detect added route as addition', () => {
      const oldCode = {
        routes: []
      };

      const newCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.additions.length).toBe(1);
      expect(changes.additions[0].type).toBe('route_added');
      expect(changes.additions[0].severity).toBe('addition');
      expect(changes.additions[0].message).toContain('Route added: GET /api/users');
    });

    test('should detect route handler change as non-breaking', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] }
        ]
      };

      const newCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', middleware: [] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.nonBreaking.length).toBe(1);
      expect(changes.nonBreaking[0].type).toBe('route_handler_changed');
      expect(changes.nonBreaking[0].severity).toBe('non-breaking');
    });

    test('should detect removed middleware as breaking', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['authenticate', 'validate'] }
        ]
      };

      const newCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['validate'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('route_middleware_removed');
      expect(changes.breaking[0].removed).toContain('authenticate');
    });

    test('should detect added middleware as non-breaking', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['authenticate'] }
        ]
      };

      const newCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['authenticate', 'rateLimit'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.nonBreaking.length).toBe(1);
      expect(changes.nonBreaking[0].type).toBe('route_middleware_added');
      expect(changes.nonBreaking[0].added).toContain('rateLimit');
    });

    test('should handle multiple route changes', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] },
          { method: 'DELETE', path: '/api/users/:id', handler: 'deleteUser', middleware: [] }
        ]
      };

      const newCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] },
          { method: 'POST', path: '/api/users', handler: 'addUser', middleware: [] },
          { method: 'PUT', path: '/api/users/:id', handler: 'updateUser', middleware: [] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1); // DELETE route removed
      expect(changes.nonBreaking.length).toBe(1); // POST handler changed
      expect(changes.additions.length).toBe(1); // PUT route added
    });
  });

  describe('Model Changes', () => {
    test('should detect removed model as breaking', () => {
      const oldCode = {
        models: [
          { name: 'UserSchema', type: 'schema', fields: [] }
        ]
      };

      const newCode = {
        models: []
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('model_removed');
      expect(changes.breaking[0].message).toContain('Model removed: UserSchema');
    });

    test('should detect added model as addition', () => {
      const oldCode = {
        models: []
      };

      const newCode = {
        models: [
          { name: 'UserSchema', type: 'schema', fields: [] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.additions.length).toBe(1);
      expect(changes.additions[0].type).toBe('model_added');
    });

    test('should detect removed field as breaking', () => {
      const oldCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      const newCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'email', type: 'String', required: true }
            ]
          }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('field_removed');
      expect(changes.breaking[0].field).toBe('age');
    });

    test('should detect field type change as breaking', () => {
      const oldCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'age', type: 'String', required: false }
            ]
          }
        ]
      };

      const newCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('field_type_changed');
      expect(changes.breaking[0].message).toContain('String → Number');
    });

    test('should detect field made required as breaking', () => {
      const oldCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      const newCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'age', type: 'Number', required: true }
            ]
          }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('field_made_required');
      expect(changes.breaking[0].field).toBe('age');
    });

    test('should detect field made optional as non-breaking', () => {
      const oldCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'age', type: 'Number', required: true }
            ]
          }
        ]
      };

      const newCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.nonBreaking.length).toBe(1);
      expect(changes.nonBreaking[0].type).toBe('field_made_optional');
    });

    test('should detect required field added as breaking', () => {
      const oldCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true }
            ]
          }
        ]
      };

      const newCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'email', type: 'String', required: true }
            ]
          }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('required_field_added');
      expect(changes.breaking[0].field).toBe('email');
    });

    test('should detect optional field added as addition', () => {
      const oldCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true }
            ]
          }
        ]
      };

      const newCode = {
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.additions.length).toBe(1);
      expect(changes.additions[0].type).toBe('field_added');
      expect(changes.additions[0].field).toBe('age');
    });
  });

  describe('Controller Changes', () => {
    test('should detect removed controller as breaking', () => {
      const oldCode = {
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res'] }
        ]
      };

      const newCode = {
        controllers: []
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('controller_removed');
      expect(changes.breaking[0].message).toContain('Controller removed: getAllUsers');
    });

    test('should detect added controller as addition', () => {
      const oldCode = {
        controllers: []
      };

      const newCode = {
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.additions.length).toBe(1);
      expect(changes.additions[0].type).toBe('controller_added');
    });

    test('should detect controller signature change as breaking', () => {
      const oldCode = {
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res'] }
        ]
      };

      const newCode = {
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res', 'next'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('controller_signature_changed');
    });
  });

  describe('Service Changes', () => {
    test('should detect removed service as breaking', () => {
      const oldCode = {
        services: [
          { name: 'findUsersByCriteria', async: true, params: ['criteria'] }
        ]
      };

      const newCode = {
        services: []
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('service_removed');
      expect(changes.breaking[0].message).toContain('Service removed: findUsersByCriteria');
    });

    test('should detect added service as addition', () => {
      const oldCode = {
        services: []
      };

      const newCode = {
        services: [
          { name: 'findUsersByCriteria', async: true, params: ['criteria'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.additions.length).toBe(1);
      expect(changes.additions[0].type).toBe('service_added');
    });

    test('should detect service signature change as breaking', () => {
      const oldCode = {
        services: [
          { name: 'findUsersByCriteria', async: true, params: ['criteria'] }
        ]
      };

      const newCode = {
        services: [
          { name: 'findUsersByCriteria', async: true, params: ['criteria', 'options'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('service_signature_changed');
    });
  });

  describe('Summary Calculation', () => {
    test('should calculate summary correctly', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: [] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true }
            ]
          }
        ],
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res'] }
        ],
        services: []
      };

      const newCode = {
        routes: [
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'Number', required: true },
              { name: 'email', type: 'String', required: false }
            ]
          }
        ],
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res', 'next'] }
        ],
        services: [
          { name: 'findUsers', async: true, params: ['query'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.summary.breaking).toBe(3); // route removed, field type changed, controller signature changed
      expect(changes.summary.additions).toBe(3); // route added, service added, field added
      expect(changes.summary.total).toBe(changes.summary.breaking + changes.summary.nonBreaking + changes.summary.additions);
    });

    test('should handle empty code structures', () => {
      const oldCode = { routes: [], models: [], controllers: [], services: [] };
      const newCode = { routes: [], models: [], controllers: [], services: [] };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(0);
      expect(changes.nonBreaking.length).toBe(0);
      expect(changes.additions.length).toBe(0);
      expect(changes.summary.total).toBe(0);
    });
  });

  describe('Breaking Change Score', () => {
    test('should calculate breaking change score', () => {
      const changes = {
        breaking: [
          { type: 'route_removed' },
          { type: 'field_type_changed' },
          { type: 'model_removed' }
        ]
      };

      const score = detector.calculateScore(changes);

      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    test('should cap score at 100', () => {
      const changes = {
        breaking: Array(20).fill({ type: 'route_removed' })
      };

      const score = detector.calculateScore(changes);

      expect(score).toBe(100);
    });

    test('should return 0 for no breaking changes', () => {
      const changes = {
        breaking: []
      };

      const score = detector.calculateScore(changes);

      expect(score).toBe(0);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle multiple simultaneous changes', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['auth'] },
          { method: 'POST', path: '/api/users', handler: 'createUser', middleware: [] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ],
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res'] },
          { name: 'createUser', async: true, params: ['req', 'res'] }
        ],
        services: [
          { name: 'validateUser', async: false, params: ['user'] }
        ]
      };

      const newCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', middleware: ['auth', 'rateLimit'] },
          { method: 'PUT', path: '/api/users/:id', handler: 'updateUser', middleware: [] }
        ],
        models: [
          {
            name: 'UserSchema',
            type: 'schema',
            fields: [
              { name: 'name', type: 'String', required: true },
              { name: 'email', type: 'String', required: true },
              { name: 'phone', type: 'String', required: true }
            ]
          }
        ],
        controllers: [
          { name: 'getAllUsers', async: true, params: ['req', 'res'] },
          { name: 'updateUser', async: true, params: ['req', 'res'] }
        ],
        services: [
          { name: 'validateUser', async: true, params: ['user', 'options'] }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      // Verify all change types are detected
      expect(changes.breaking.length).toBeGreaterThan(0);
      expect(changes.nonBreaking.length).toBeGreaterThan(0);
      expect(changes.additions.length).toBeGreaterThan(0);

      // Verify summary is consistent
      expect(changes.summary.total).toBe(
        changes.breaking.length + changes.nonBreaking.length + changes.additions.length
      );
    });

    test('should handle mongoose model type (non-schema)', () => {
      const oldCode = {
        models: [
          { name: 'User', type: 'mongoose', variable: 'User' }
        ]
      };

      const newCode = {
        models: []
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(1);
      expect(changes.breaking[0].type).toBe('model_removed');
    });
  });

  describe('Edge Cases', () => {
    test('should handle missing optional properties', () => {
      const oldCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers' }
        ]
      };

      const newCode = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers' }
        ]
      };

      const changes = detector.detect(oldCode, newCode);

      expect(changes.summary.total).toBe(0);
    });

    test('should handle undefined arrays', () => {
      const oldCode = {};
      const newCode = {};

      const changes = detector.detect(oldCode, newCode);

      expect(changes.breaking.length).toBe(0);
      expect(changes.nonBreaking.length).toBe(0);
      expect(changes.additions.length).toBe(0);
    });
  });
});
