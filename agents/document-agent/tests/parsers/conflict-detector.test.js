import { describe, test, expect, beforeEach } from '@jest/globals';
import ConflictDetector, { getConflictDetector } from '../../parsers/code-parser/conflict-detector.js';

describe('ConflictDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new ConflictDetector();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(detector).toBeDefined();
      expect(detector.logger).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getConflictDetector();
      const instance2 = getConflictDetector();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Route Conflicts', () => {
    test('should detect no conflict when both deleted same route', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          { method: 'GET', path: '/api/users', operation: 'delete' }
        ]
      };
      const changeSet2 = {
        routes: [
          { method: 'GET', path: '/api/users', operation: 'delete' }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.resolved.length).toBe(1);
      expect(conflicts.resolved[0].type).toBe('route_both_deleted');
      expect(conflicts.conflicts.length).toBe(0);
    });

    test('should auto-merge when both added identical route', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            middleware: [],
            operation: 'add'
          }
        ]
      };
      const changeSet2 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            middleware: [],
            operation: 'add'
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.autoMergeable.length).toBe(1);
      expect(conflicts.autoMergeable[0].type).toBe('route_duplicate_add');
      expect(conflicts.conflicts.length).toBe(0);
    });

    test('should detect conflict when handlers changed differently', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            operation: 'modify'
          }
        ]
      };
      const changeSet2 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getUsers',
            operation: 'modify'
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.conflicts.length).toBe(1);
      expect(conflicts.conflicts[0].type).toBe('route_handler_conflict');
      expect(conflicts.conflicts[0].severity).toBe('conflict');
    });

    test('should auto-merge compatible middleware changes', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            middleware: ['auth'],
            operation: 'modify'
          }
        ]
      };
      const changeSet2 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            middleware: ['auth', 'validate'],
            operation: 'modify'
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.autoMergeable.length).toBe(1);
      expect(conflicts.autoMergeable[0].type).toBe('route_middleware_mergeable');
      expect(conflicts.autoMergeable[0].mergedResult).toEqual(['auth', 'validate']);
    });

    test('should require review for incompatible middleware changes', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            middleware: ['auth', 'rateLimit'],
            operation: 'modify'
          }
        ]
      };
      const changeSet2 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            middleware: ['validate', 'cache'],
            operation: 'modify'
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.requiresReview.length).toBe(1);
      expect(conflicts.requiresReview[0].type).toBe('route_middleware_conflict');
    });

    test('should detect conflict when one adds and one deletes', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            handler: 'getAllUsers',
            operation: 'add'
          }
        ]
      };
      const changeSet2 = {
        routes: [
          {
            method: 'GET',
            path: '/api/users',
            operation: 'delete'
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.conflicts.length).toBe(1);
      expect(conflicts.conflicts[0].type).toBe('route_add_delete_conflict');
    });
  });

  describe('Model Conflicts', () => {
    test('should detect no conflict when both deleted same model', () => {
      const baseState = {};
      const changeSet1 = {
        models: [
          { name: 'UserSchema', operation: 'delete' }
        ]
      };
      const changeSet2 = {
        models: [
          { name: 'UserSchema', operation: 'delete' }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.resolved.length).toBe(1);
      expect(conflicts.resolved[0].type).toBe('model_both_deleted');
    });

    test('should detect conflict when one adds and one deletes model', () => {
      const baseState = {};
      const changeSet1 = {
        models: [
          { name: 'UserSchema', operation: 'add' }
        ]
      };
      const changeSet2 = {
        models: [
          { name: 'UserSchema', operation: 'delete' }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.conflicts.length).toBe(1);
      expect(conflicts.conflicts[0].type).toBe('model_add_delete_conflict');
    });
  });

  describe('Field Conflicts', () => {
    test('should detect field type conflict', () => {
      const baseState = {};
      const changeSet1 = {
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [
              { name: 'age', type: 'String', required: false }
            ]
          }
        ]
      };
      const changeSet2 = {
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.conflicts.length).toBe(1);
      expect(conflicts.conflicts[0].type).toBe('field_type_conflict');
      expect(conflicts.conflicts[0].field).toBe('age');
    });

    test('should require review for required status conflict', () => {
      const baseState = {};
      const changeSet1 = {
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [
              { name: 'age', type: 'Number', required: true }
            ]
          }
        ]
      };
      const changeSet2 = {
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.requiresReview.length).toBe(1);
      expect(conflicts.requiresReview[0].type).toBe('field_required_conflict');
    });
  });

  describe('Controller Conflicts', () => {
    test('should detect controller signature conflict', () => {
      const baseState = {};
      const changeSet1 = {
        controllers: [
          {
            name: 'getAllUsers',
            params: ['req', 'res'],
            operation: 'modify'
          }
        ]
      };
      const changeSet2 = {
        controllers: [
          {
            name: 'getAllUsers',
            params: ['req', 'res', 'next'],
            operation: 'modify'
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.conflicts.length).toBe(1);
      expect(conflicts.conflicts[0].type).toBe('controller_signature_conflict');
    });
  });

  describe('Service Conflicts', () => {
    test('should detect service signature conflict', () => {
      const baseState = {};
      const changeSet1 = {
        services: [
          {
            name: 'findUsers',
            params: ['criteria'],
            operation: 'modify'
          }
        ]
      };
      const changeSet2 = {
        services: [
          {
            name: 'findUsers',
            params: ['criteria', 'options'],
            operation: 'modify'
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.conflicts.length).toBe(1);
      expect(conflicts.conflicts[0].type).toBe('service_signature_conflict');
    });
  });

  describe('Summary Calculation', () => {
    test('should calculate summary correctly', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', operation: 'modify' }
        ],
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [{ name: 'age', type: 'String', required: false }]
          }
        ]
      };
      const changeSet2 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', operation: 'modify' }
        ],
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [{ name: 'age', type: 'Number', required: true }]
          }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.summary.conflicts).toBe(2); // handler + type
      expect(conflicts.summary.requiresReview).toBe(1); // required status
      expect(conflicts.summary.total).toBe(3);
    });

    test('should handle empty change sets', () => {
      const baseState = {};
      const changeSet1 = { routes: [], models: [], controllers: [], services: [] };
      const changeSet2 = { routes: [], models: [], controllers: [], services: [] };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.summary.total).toBe(0);
      expect(conflicts.conflicts.length).toBe(0);
    });
  });

  describe('Conflict Resolution', () => {
    test('should auto-resolve mergeable conflicts', () => {
      const conflicts = {
        autoMergeable: [
          {
            type: 'route_middleware_mergeable',
            strategy: 'merge_middleware',
            mergedResult: ['auth', 'validate']
          },
          {
            type: 'route_duplicate_add',
            strategy: 'accept_one',
            changeSet1: { handler: 'getAllUsers' }
          }
        ],
        conflicts: [],
        requiresReview: []
      };

      const resolution = detector.resolve(conflicts);

      expect(resolution.resolved.length).toBe(2);
      expect(resolution.resolved[0].resolvedBy).toBe('auto');
      expect(resolution.requiresManual.length).toBe(0);
    });

    test('should mark conflicts as requiring manual intervention', () => {
      const conflicts = {
        autoMergeable: [],
        conflicts: [
          {
            type: 'route_handler_conflict',
            resolution: 'manual'
          }
        ],
        requiresReview: [
          {
            type: 'route_middleware_conflict',
            resolution: 'review'
          }
        ]
      };

      const resolution = detector.resolve(conflicts);

      expect(resolution.resolved.length).toBe(0);
      expect(resolution.requiresManual.length).toBe(2);
    });
  });

  describe('Multiple Change Sets', () => {
    test('should detect conflicts across three change sets', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', operation: 'modify' }
        ]
      };
      const changeSet2 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getUsers', operation: 'modify' }
        ]
      };
      const changeSet3 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'fetchUsers', operation: 'modify' }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2, changeSet3]);

      // Should detect conflicts between each pair: (1,2), (1,3), (2,3)
      expect(conflicts.conflicts.length).toBe(3);
    });
  });

  describe('Helper Methods', () => {
    test('should correctly identify same route', () => {
      const route1 = { method: 'GET', path: '/api/users' };
      const route2 = { method: 'GET', path: '/api/users' };
      const route3 = { method: 'POST', path: '/api/users' };

      expect(detector.isSameRoute(route1, route2)).toBe(true);
      expect(detector.isSameRoute(route1, route3)).toBe(false);
    });

    test('should correctly identify identical routes', () => {
      const route1 = {
        method: 'GET',
        path: '/api/users',
        handler: 'getAllUsers',
        middleware: ['auth']
      };
      const route2 = {
        method: 'GET',
        path: '/api/users',
        handler: 'getAllUsers',
        middleware: ['auth']
      };
      const route3 = {
        method: 'GET',
        path: '/api/users',
        handler: 'getUsers',
        middleware: ['auth']
      };

      expect(detector.routesAreIdentical(route1, route2)).toBe(true);
      expect(detector.routesAreIdentical(route1, route3)).toBe(false);
    });

    test('should correctly check middleware compatibility', () => {
      const middleware1 = ['auth'];
      const middleware2 = ['auth', 'validate'];
      const middleware3 = ['cache', 'compress'];

      expect(detector.middlewareChangesCompatible(middleware1, middleware2)).toBe(true);
      expect(detector.middlewareChangesCompatible(middleware1, middleware3)).toBe(false);
    });

    test('should correctly merge middleware', () => {
      const middleware1 = ['auth', 'validate'];
      const middleware2 = ['validate', 'rateLimit'];

      const merged = detector.mergeMiddleware(middleware1, middleware2);

      expect(merged).toEqual(['auth', 'validate', 'rateLimit']);
    });
  });

  describe('Complex Scenarios', () => {
    test('should handle mixed conflict types', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['auth'], operation: 'modify' },
          { method: 'POST', path: '/api/users', operation: 'delete' }
        ],
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [
              { name: 'email', type: 'String', required: true },
              { name: 'age', type: 'Number', required: false }
            ]
          }
        ],
        controllers: [
          { name: 'createUser', params: ['req', 'res'], operation: 'modify' }
        ]
      };
      const changeSet2 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', middleware: ['auth', 'validate'], operation: 'modify' },
          { method: 'POST', path: '/api/users', operation: 'delete' }
        ],
        models: [
          {
            name: 'UserSchema',
            operation: 'modify',
            fields: [
              { name: 'email', type: 'String', required: false },
              { name: 'age', type: 'String', required: false }
            ]
          }
        ],
        controllers: [
          { name: 'createUser', params: ['req', 'res', 'next'], operation: 'modify' }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      expect(conflicts.resolved.length).toBe(1); // both deleted POST route
      expect(conflicts.autoMergeable.length).toBe(1); // compatible middleware
      expect(conflicts.requiresReview.length).toBe(1); // required status change
      expect(conflicts.conflicts.length).toBe(2); // type conflict + signature conflict
    });
  });

  describe('Edge Cases', () => {
    test('should handle undefined properties', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', operation: 'modify' }
        ]
      };
      const changeSet2 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', operation: 'modify' }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1, changeSet2]);

      // Should not crash, middleware is undefined but handled
      expect(conflicts).toBeDefined();
    });

    test('should handle single change set', () => {
      const baseState = {};
      const changeSet1 = {
        routes: [
          { method: 'GET', path: '/api/users', handler: 'getAllUsers', operation: 'modify' }
        ]
      };

      const conflicts = detector.detect(baseState, [changeSet1]);

      // No conflicts when comparing with itself
      expect(conflicts.summary.total).toBe(0);
    });
  });
});
