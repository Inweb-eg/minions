import { describe, test, expect, beforeEach } from '@jest/globals';
import { getDigestValidator } from '../../validators/digest-validator.js';

describe('DigestValidator', () => {
  let validator;

  beforeEach(() => {
    validator = getDigestValidator();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(validator).toBeDefined();
      expect(validator.requiredFields).toBeDefined();
    });

    test('should get singleton instance', () => {
      const validator2 = getDigestValidator();
      expect(validator2).toBe(validator);
    });
  });

  describe('Backend Digest Validation', () => {
    test('should validate complete backend digest', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET', path: '/api/users', handler: 'getUsers' }
          ],
          controllers: [],
          models: [
            { name: 'User', fields: [{ name: 'email', type: 'String' }] }
          ],
          services: [],
          middleware: []
        },
        metadata: {
          version: '1.0.0',
          generatedAt: '2024-01-01'
        }
      };

      const result = validator.validate(digest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.score).toBeGreaterThan(70);
    });

    test('should detect missing platform', () => {
      const digest = {
        data: {
          routes: [],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        }
      };

      const result = validator.validate(digest);

      const platformError = result.errors.find(
        e => e.message.includes('Platform not specified')
      );
      expect(platformError).toBeDefined();
    });

    test('should detect missing required fields', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: []
          // Missing: controllers, models, services, middleware
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const schemaError = result.errors.find(
        e => e.type === 'schema' && e.message.includes('Missing required fields')
      );
      expect(schemaError).toBeDefined();
      expect(schemaError.fields).toContain('controllers');
      expect(schemaError.fields).toContain('models');
    });

    test('should warn about empty routes', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: { version: '1.0.0' }
      };

      const result = validator.validate(digest);

      const routeWarning = result.warnings.find(
        w => w.message.includes('No routes defined')
      );
      expect(routeWarning).toBeDefined();
    });

    test('should detect invalid route structure', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET' }, // Missing path
            { path: '/api/users' } // Missing method
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const routeErrors = result.errors.filter(
        e => e.type === 'completeness' && e.message.includes('missing method or path')
      );
      expect(routeErrors.length).toBeGreaterThan(0);
    });

    test('should warn about routes without handlers', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET', path: '/api/users' } // Missing handler
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const handlerWarning = result.warnings.find(
        w => w.message.includes('missing handler')
      );
      expect(handlerWarning).toBeDefined();
    });

    test('should detect invalid model structure', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [],
          controllers: [],
          models: [
            { /* no name */ },
            { name: 'User', fields: [] } // Empty fields
          ],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const modelError = result.errors.find(
        e => e.type === 'completeness' && e.message.includes('missing name')
      );
      expect(modelError).toBeDefined();

      const fieldsWarning = result.warnings.find(
        w => w.message.includes('has no fields')
      );
      expect(fieldsWarning).toBeDefined();
    });
  });

  describe('Frontend Digest Validation (User/Driver App)', () => {
    test('should validate complete frontend digest', () => {
      const digest = {
        platform: 'user-app',
        data: {
          screens: [
            { name: 'HomeScreen', route: '/home' }
          ],
          widgets: [
            { name: 'UserWidget' }
          ],
          models: [],
          navigation: { type: 'stack' },
          state: { provider: 'riverpod' }
        },
        metadata: {
          version: '1.0.0',
          generatedAt: '2024-01-01'
        }
      };

      const result = validator.validate(digest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about missing screens', () => {
      const digest = {
        platform: 'user-app',
        data: {
          screens: [],
          widgets: [],
          models: [],
          navigation: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const screenWarning = result.warnings.find(
        w => w.message.includes('No screens defined')
      );
      expect(screenWarning).toBeDefined();
    });

    test('should detect invalid screen structure', () => {
      const digest = {
        platform: 'user-app',
        data: {
          screens: [
            { /* missing name and route */ }
          ],
          widgets: [],
          models: [],
          navigation: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const screenError = result.errors.find(
        e => e.type === 'completeness' && e.message.includes('missing name and route')
      );
      expect(screenError).toBeDefined();
    });

    test('should suggest defining widgets', () => {
      const digest = {
        platform: 'driver-app',
        data: {
          screens: [{ name: 'MapScreen', route: '/map' }],
          widgets: [],
          models: [],
          navigation: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const widgetSuggestion = result.suggestions.find(
        s => s.message.includes('No widgets defined')
      );
      expect(widgetSuggestion).toBeDefined();
    });

    test('should warn about missing navigation', () => {
      const digest = {
        platform: 'user-app',
        data: {
          screens: [{ name: 'HomeScreen', route: '/home' }],
          widgets: [],
          models: [],
          state: {}
          // Missing navigation
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const navWarning = result.warnings.find(
        w => w.message.includes('No navigation structure defined')
      );
      expect(navWarning).toBeDefined();
    });

    test('should warn about missing state management', () => {
      const digest = {
        platform: 'user-app',
        data: {
          screens: [{ name: 'HomeScreen', route: '/home' }],
          widgets: [],
          models: [],
          navigation: {}
          // Missing state
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const stateWarning = result.warnings.find(
        w => w.message.includes('No state management defined')
      );
      expect(stateWarning).toBeDefined();
    });
  });

  describe('Admin Dashboard Digest Validation', () => {
    test('should validate complete admin dashboard digest', () => {
      const digest = {
        platform: 'admin-dashboard',
        data: {
          pages: [
            { name: 'Dashboard', route: '/' }
          ],
          components: [
            { name: 'UserTable' }
          ],
          hooks: [],
          api: { baseURL: '/api' },
          state: { library: 'zustand' }
        },
        metadata: {
          version: '1.0.0',
          generatedAt: '2024-01-01'
        }
      };

      const result = validator.validate(digest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should warn about missing pages', () => {
      const digest = {
        platform: 'admin-dashboard',
        data: {
          pages: [],
          components: [],
          hooks: [],
          api: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const pageWarning = result.warnings.find(
        w => w.message.includes('No pages defined')
      );
      expect(pageWarning).toBeDefined();
    });

    test('should suggest defining components', () => {
      const digest = {
        platform: 'admin-dashboard',
        data: {
          pages: [{ name: 'Dashboard', route: '/' }],
          components: [],
          hooks: [],
          api: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const componentSuggestion = result.suggestions.find(
        s => s.message.includes('No components defined')
      );
      expect(componentSuggestion).toBeDefined();
    });

    test('should warn about missing API integration', () => {
      const digest = {
        platform: 'admin-dashboard',
        data: {
          pages: [{ name: 'Dashboard', route: '/' }],
          components: [],
          hooks: [],
          state: {}
          // Missing api
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const apiWarning = result.warnings.find(
        w => w.message.includes('No API integration defined')
      );
      expect(apiWarning).toBeDefined();
    });
  });

  describe('Quality Validation', () => {
    test('should warn about low detail level', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET', path: '/api/users' }, // No description
            { method: 'POST', path: '/api/users' } // No description
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const detailWarning = result.warnings.find(
        w => w.type === 'quality' && w.message.includes('have descriptions')
      );
      expect(detailWarning).toBeDefined();
    });

    test('should suggest adding examples', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET', path: '/api/users', description: 'Get users' }
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const exampleSuggestion = result.suggestions.find(
        s => s.type === 'quality' && s.message.includes('No code examples')
      );
      expect(exampleSuggestion).toBeDefined();
    });

    test('should score highly for detailed digests', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            {
              method: 'GET',
              path: '/api/users',
              handler: 'getUsers',
              description: 'Retrieve list of users',
              example: 'GET /api/users?page=1'
            }
          ],
          controllers: [],
          models: [
            {
              name: 'User',
              fields: [
                { name: 'email', type: 'String', description: 'User email' }
              ],
              description: 'User model'
            }
          ],
          services: [],
          middleware: []
        },
        metadata: {
          version: '1.0.0',
          generatedAt: '2024-01-01'
        }
      };

      const result = validator.validate(digest);

      expect(result.score).toBeGreaterThan(80);
      expect(result.metrics.quality).toBeGreaterThan(80);
    });
  });

  describe('Consistency Validation', () => {
    test('should detect duplicate names', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET', path: '/api/users', handler: 'getUsers' },
            { method: 'POST', path: '/api/users', handler: 'getUsers' } // Duplicate handler
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const duplicateWarning = result.warnings.find(
        w => w.type === 'consistency' && w.message.includes('Duplicate')
      );
      expect(duplicateWarning).toBeDefined();
    });

    test('should detect naming convention issues', () => {
      const digest = {
        platform: 'user-app',
        data: {
          screens: [
            { name: 'home_screen', route: '/home' } // Should be PascalCase + Screen
          ],
          widgets: [
            { name: 'userwidget' } // Should be PascalCase + Widget
          ],
          models: [],
          navigation: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const namingSuggestion = result.suggestions.find(
        s => s.type === 'consistency' && s.message.includes('Naming convention')
      );
      expect(namingSuggestion).toBeDefined();
    });
  });

  describe('Platform-Specific Validation', () => {
    test('should detect REST convention issues in backend', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET', path: '/api/users/create', handler: 'createUser' } // GET with create
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const restWarning = result.warnings.find(
        w => w.type === 'platform' && w.message.includes("should not contain 'create'")
      );
      expect(restWarning).toBeDefined();
    });

    test('should suggest Widget suffix for Flutter widgets', () => {
      const digest = {
        platform: 'user-app',
        data: {
          screens: [],
          widgets: [
            { name: 'UserCard' } // Missing Widget suffix
          ],
          models: [],
          navigation: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const widgetSuggestion = result.suggestions.find(
        s => s.type === 'platform' && s.message.includes("end with 'Widget'")
      );
      expect(widgetSuggestion).toBeDefined();
    });

    test('should warn about non-PascalCase React components', () => {
      const digest = {
        platform: 'admin-dashboard',
        data: {
          pages: [],
          components: [
            { name: 'userTable' } // Should be PascalCase
          ],
          hooks: [],
          api: {},
          state: {}
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      const caseWarning = result.warnings.find(
        w => w.type === 'platform' && w.message.includes('should be PascalCase')
      );
      expect(caseWarning).toBeDefined();
    });
  });

  describe('Metrics Calculation', () => {
    test('should calculate completeness metric', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [{ method: 'GET', path: '/api/users', handler: 'getUsers' }],
          controllers: [],
          models: [{ name: 'User', fields: [{ name: 'email', type: 'String' }] }],
          services: [],
          middleware: []
        },
        metadata: { version: '1.0.0' }
      };

      const result = validator.validate(digest);

      expect(result.metrics.completeness).toBeGreaterThan(70);
    });

    test('should calculate quality metric', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            {
              method: 'GET',
              path: '/api/users',
              handler: 'getUsers',
              description: 'Get users',
              example: 'GET /api/users'
            }
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      expect(result.metrics.quality).toBeGreaterThan(70);
    });

    test('should calculate consistency metric', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET', path: '/api/users', handler: 'getUsers' },
            { method: 'POST', path: '/api/users', handler: 'createUser' }
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      expect(result.metrics.consistency).toBeGreaterThan(80);
    });

    test('should calculate implementability metric', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            {
              method: 'GET',
              path: '/api/users',
              handler: 'getUsers',
              description: 'Retrieve all users'
            }
          ],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      expect(result.metrics.implementability).toBeGreaterThan(0);
    });
  });

  describe('Score Calculation', () => {
    test('should calculate high score for quality digest', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            {
              method: 'GET',
              path: '/api/users',
              handler: 'getUsers',
              description: 'Get all users',
              example: 'GET /api/users?page=1'
            }
          ],
          controllers: [],
          models: [
            {
              name: 'User',
              fields: [
                { name: 'email', type: 'String', description: 'User email' }
              ],
              description: 'User model'
            }
          ],
          services: [],
          middleware: []
        },
        metadata: {
          version: '1.0.0',
          generatedAt: '2024-01-01'
        }
      };

      const result = validator.validate(digest);

      expect(result.score).toBeGreaterThan(80);
      expect(result.valid).toBe(true);
    });

    test('should calculate low score for poor digest', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [
            { method: 'GET' } // Invalid
          ],
          // Missing most required fields
        },
        metadata: {}
      };

      const result = validator.validate(digest);

      expect(result.score).toBeLessThan(60);
      expect(result.valid).toBe(false);
    });
  });

  describe('Cross-Platform Validation', () => {
    test('should validate consistency across platforms', () => {
      const digests = [
        {
          platform: 'backend',
          data: {
            routes: [],
            controllers: [],
            models: [
              { name: 'User' },
              { name: 'Post' }
            ],
            services: [],
            middleware: []
          }
        },
        {
          platform: 'user-app',
          data: {
            screens: [],
            widgets: [],
            models: [
              { name: 'User' }, // Exists in backend
              { name: 'Profile' } // Not in backend
            ],
            navigation: {},
            state: {}
          }
        }
      ];

      const result = validator.validateCrossPlatform(digests);

      expect(result).toBeDefined();
      const modelWarning = result.warnings.find(
        w => w.message.includes('Profile') && w.message.includes('not defined in backend')
      );
      expect(modelWarning).toBeDefined();
    });

    test('should pass when models are consistent', () => {
      const digests = [
        {
          platform: 'backend',
          data: {
            routes: [],
            controllers: [],
            models: [
              { name: 'User' },
              { name: 'Post' }
            ],
            services: [],
            middleware: []
          }
        },
        {
          platform: 'user-app',
          data: {
            screens: [],
            widgets: [],
            models: [
              { name: 'User' },
              { name: 'Post' }
            ],
            navigation: {},
            state: {}
          }
        }
      ];

      const result = validator.validateCrossPlatform(digests);

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    test('should handle missing backend digest', () => {
      const digests = [
        {
          platform: 'user-app',
          data: {
            screens: [],
            widgets: [],
            models: [{ name: 'User' }],
            navigation: {},
            state: {}
          }
        }
      ];

      const result = validator.validateCrossPlatform(digests);

      expect(result).toBeDefined();
      expect(result.warnings).toHaveLength(0); // No backend to compare with
    });
  });

  describe('Metadata Validation', () => {
    test('should warn about missing metadata', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        }
        // No metadata
      };

      const result = validator.validate(digest);

      const metadataWarning = result.warnings.find(
        w => w.message.includes('No metadata provided')
      );
      expect(metadataWarning).toBeDefined();
    });

    test('should warn about missing version', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {
          // No version
        }
      };

      const result = validator.validate(digest);

      const versionWarning = result.warnings.find(
        w => w.message.includes('No version specified')
      );
      expect(versionWarning).toBeDefined();
    });

    test('should warn about missing timestamp', () => {
      const digest = {
        platform: 'backend',
        data: {
          routes: [],
          controllers: [],
          models: [],
          services: [],
          middleware: []
        },
        metadata: {
          version: '1.0.0'
          // No timestamp
        }
      };

      const result = validator.validate(digest);

      const timestampWarning = result.warnings.find(
        w => w.message.includes('No generation timestamp')
      );
      expect(timestampWarning).toBeDefined();
    });
  });
});
