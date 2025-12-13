import { describe, test, expect, beforeEach } from '@jest/globals';
import UserDigest, { getUserDigest } from '../../digest-generators/user-digest.js';

describe('UserDigest', () => {
  let digest;

  beforeEach(() => {
    digest = new UserDigest();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(digest).toBeDefined();
      expect(digest.logger).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getUserDigest();
      const instance2 = getUserDigest();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Digest Generation', () => {
    test('should generate complete user app digest', () => {
      const mockFlutter = {
        screens: [
          { name: 'HomeScreen', widgetType: 'stateful', route: '/home' }
        ],
        widgets: [
          { name: 'CustomButton', type: 'stateless' }
        ],
        models: [
          { name: 'User', fields: ['id: String', 'name: String'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result).toBeDefined();
      expect(result.platform).toBe('flutter');
      expect(result.app).toBe('user');
      expect(result.screens).toBeDefined();
      expect(result.widgets).toBeDefined();
      expect(result.models).toBeDefined();
    });

    test('should handle empty input', () => {
      const result = digest.generate({});

      expect(result).toBeDefined();
      expect(result.screens).toHaveLength(0);
      expect(result.widgets).toHaveLength(0);
    });
  });

  describe('Flutter Processing', () => {
    test('should process screens', () => {
      const mockFlutter = {
        screens: [
          {
            name: 'HomeScreen',
            widgetType: 'stateful',
            route: '/home',
            description: 'Main home screen'
          }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.screens).toHaveLength(1);
      expect(result.screens[0].name).toBe('HomeScreen');
      expect(result.screens[0].type).toBe('stateful');
      expect(result.screens[0].file).toContain('home_screen.dart');
    });

    test('should process widgets', () => {
      const mockFlutter = {
        widgets: [
          { name: 'CustomButton', type: 'stateless', properties: ['text: String'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].name).toBe('CustomButton');
      expect(result.widgets[0].file).toContain('custom_button.dart');
    });

    test('should process models', () => {
      const mockFlutter = {
        models: [
          { name: 'User', fields: ['id: String', 'email: String'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.models).toHaveLength(1);
      expect(result.models[0].name).toBe('User');
      expect(result.models[0].implementation).toBeDefined();
    });

    test('should process services', () => {
      const mockFlutter = {
        services: [
          { name: 'AuthService', type: 'authentication', methods: ['login', 'logout'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('AuthService');
    });

    test('should extract state management pattern', () => {
      const mockFlutter = {
        stateManagement: { primary: 'provider' }
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.stateManagement.pattern).toBe('provider');
      expect(result.packages).toContain('provider');
    });

    test('should extract navigation library', () => {
      const mockFlutter = {
        stateManagement: { navigation: 'go_router' }
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.navigation.library).toBe('go_router');
    });

    test('should extract permissions', () => {
      const mockFlutter = {
        platformFeatures: ['GPS and location services', 'Push notifications']
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.permissions).toContain('location');
      expect(result.permissions).toContain('notifications');
    });
  });

  describe('API Processing', () => {
    test('should generate API services from endpoints', () => {
      const mockAPI = {
        endpoints: [
          { path: '/api/users', method: 'GET', summary: 'Get users' }
        ]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.services.length).toBeGreaterThan(0);
      const apiService = result.services.find(s => s.type === 'api');
      expect(apiService).toBeDefined();
    });

    test('should generate models from API schemas', () => {
      const mockAPI = {
        models: [
          {
            name: 'Ride',
            properties: {
              id: { type: 'string' },
              status: { type: 'string' }
            },
            required: ['id']
          }
        ],
        endpoints: []
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.models).toHaveLength(1);
      expect(result.models[0].name).toBe('Ride');
    });

    test('should add http package', () => {
      const mockAPI = {
        endpoints: [{ path: '/api/test', method: 'GET' }]
      };

      const result = digest.generate({ api: mockAPI });

      expect(result.packages).toContain('http');
    });
  });

  describe('Method Name Generation', () => {
    test('should generate correct method names', () => {
      expect(digest.getMethodName({ method: 'GET', path: '/api/users' }))
        .toBe('getAllUsers');

      expect(digest.getMethodName({ method: 'GET', path: '/api/users/:id' }))
        .toBe('getUsersById');

      expect(digest.getMethodName({ method: 'POST', path: '/api/users' }))
        .toBe('createUsers');

      expect(digest.getMethodName({ method: 'PUT', path: '/api/users/:id' }))
        .toBe('updateUsers');

      expect(digest.getMethodName({ method: 'DELETE', path: '/api/users/:id' }))
        .toBe('deleteUsers');
    });
  });

  describe('Type Mapping', () => {
    test('should map types to Dart types', () => {
      expect(digest.mapTypeToDart('string')).toBe('String');
      expect(digest.mapTypeToDart('number')).toBe('double');
      expect(digest.mapTypeToDart('integer')).toBe('int');
      expect(digest.mapTypeToDart('boolean')).toBe('bool');
      expect(digest.mapTypeToDart('array')).toBe('List');
      expect(digest.mapTypeToDart('object')).toBe('Map<String, dynamic>');
    });
  });

  describe('Screen Implementation', () => {
    test('should generate screen implementation guidance', () => {
      const screen = {
        name: 'HomeScreen',
        widgetType: 'stateful',
        widgets: ['MapWidget', 'ListWidget']
      };

      const impl = digest.generateScreenImplementation(screen);

      expect(impl.widgetTree).toBeDefined();
      expect(impl.stateVariables).toBeDefined();
      expect(impl.methods).toBeDefined();
      expect(impl.example).toBeDefined();
    });

    test('should generate state variables for list screens', () => {
      const screen = { name: 'UserList', widgetType: 'stateful' };

      const variables = digest.generateStateVariables(screen);

      expect(variables.some(v => v.name === 'items')).toBe(true);
      expect(variables.some(v => v.name === 'isLoading')).toBe(true);
    });

    test('should generate methods for form screens', () => {
      const screen = { name: 'UserForm', widgetType: 'stateful' };

      const methods = digest.generateScreenMethods(screen);

      expect(methods.some(m => m.name === 'submitForm')).toBe(true);
      expect(methods.some(m => m.name === 'validateForm')).toBe(true);
    });
  });

  describe('Widget Implementation', () => {
    test('should generate widget implementation', () => {
      const widget = {
        name: 'CustomCard',
        type: 'stateless',
        properties: ['title: String', 'subtitle: String']
      };

      const impl = digest.generateWidgetImplementation(widget);

      expect(impl.constructor).toBeDefined();
      expect(impl.example).toBeDefined();
    });
  });

  describe('Model Implementation', () => {
    test('should generate model implementation', () => {
      const model = {
        name: 'User',
        fields: ['id: String', 'name: String']
      };

      const impl = digest.generateModelImplementation(model);

      expect(impl.className).toBe('User');
      expect(impl.methods.some(m => m.includes('fromJson'))).toBe(true);
      expect(impl.methods.some(m => m.includes('toJson'))).toBe(true);
      expect(impl.example).toBeDefined();
    });

    test('should generate model from API schema', () => {
      const model = {
        name: 'Ride',
        properties: {
          id: { type: 'string' },
          userId: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['id', 'userId']
      };

      const impl = digest.generateModelFromAPISchema(model);

      expect(impl.className).toBe('Ride');
      expect(impl.fields.length).toBeGreaterThan(0);
    });
  });

  describe('Service Implementation', () => {
    test('should generate service implementation', () => {
      const service = {
        name: 'RideService',
        type: 'api',
        methods: ['getRides', 'createRide']
      };

      const impl = digest.generateServiceImplementation(service);

      expect(impl.className).toBe('RideService');
      expect(impl.singleton).toBe(true);
    });

    test('should determine service dependencies', () => {
      const apiService = { type: 'api' };
      const storageService = { type: 'storage' };
      const locationService = { type: 'location' };

      expect(digest.getServiceDependencies(apiService)).toContain('http.Client');
      expect(digest.getServiceDependencies(storageService)).toContain('SharedPreferences');
      expect(digest.getServiceDependencies(locationService)).toContain('Geolocator');
    });
  });

  describe('Feature Processing', () => {
    test('should extract user stories', () => {
      const mockFeatures = {
        userStories: [
          { role: 'user', action: 'book a ride', benefit: 'travel' }
        ]
      };

      const result = digest.generate({ features: mockFeatures });

      expect(result.bestPractices.length).toBeGreaterThan(0);
    });
  });

  describe('Utility Methods', () => {
    test('should convert to snake_case', () => {
      expect(digest.toSnakeCase('HomeScreen')).toBe('home_screen');
      expect(digest.toSnakeCase('UserProfileWidget')).toBe('user_profile_widget');
      expect(digest.toSnakeCase('APIService')).toBe('a_p_i_service');
    });

    test('should capitalize strings', () => {
      expect(digest.capitalize('user')).toBe('User');
      expect(digest.capitalize('ride')).toBe('Ride');
      expect(digest.capitalize('')).toBe('');
    });

    test('should group endpoints by resource', () => {
      const endpoints = [
        { path: '/api/users', method: 'GET' },
        { path: '/api/users/:id', method: 'GET' },
        { path: '/api/rides', method: 'POST' }
      ];

      const grouped = digest.groupEndpointsByResource(endpoints);

      expect(grouped.users).toHaveLength(2);
      expect(grouped.rides).toHaveLength(1);
    });
  });
});
