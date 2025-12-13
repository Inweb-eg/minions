import { describe, test, expect, beforeEach } from '@jest/globals';
import DriverDigest, { getDriverDigest } from '../../digest-generators/driver-digest.js';

describe('DriverDigest', () => {
  let digest;

  beforeEach(() => {
    digest = new DriverDigest();
  });

  describe('Initialization', () => {
    test('should create instance successfully', () => {
      expect(digest).toBeDefined();
      expect(digest.logger).toBeDefined();
    });

    test('should get singleton instance', () => {
      const instance1 = getDriverDigest();
      const instance2 = getDriverDigest();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Digest Generation', () => {
    test('should generate complete driver app digest', () => {
      const mockFlutter = {
        screens: [
          { name: 'RideAcceptanceScreen', widgetType: 'stateful', route: '/ride-accept' }
        ],
        widgets: [
          { name: 'RideCard', type: 'stateless' }
        ],
        models: [
          { name: 'Ride', fields: ['id: String', 'status: String'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result).toBeDefined();
      expect(result.platform).toBe('flutter');
      expect(result.app).toBe('driver');
      expect(result.screens).toBeDefined();
      expect(result.widgets).toBeDefined();
      expect(result.models).toBeDefined();
      expect(result.realtimeFeatures).toBeDefined();
    });

    test('should handle empty input', () => {
      const result = digest.generate({});

      expect(result).toBeDefined();
      expect(result.screens).toHaveLength(0);
      expect(result.widgets).toHaveLength(0);
    });
  });

  describe('Flutter Processing', () => {
    test('should process screens with driver features', () => {
      const mockFlutter = {
        screens: [
          {
            name: 'RideAcceptanceScreen',
            widgetType: 'stateful',
            route: '/ride-accept',
            description: 'Accept or reject ride requests'
          }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.screens).toHaveLength(1);
      expect(result.screens[0].name).toBe('RideAcceptanceScreen');
      expect(result.screens[0].driverFeatures).toBeDefined();
      expect(result.screens[0].driverFeatures.realtime).toBe(true);
    });

    test('should process widgets', () => {
      const mockFlutter = {
        widgets: [
          { name: 'RideRequestCard', type: 'stateless', properties: ['ride: Ride'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.widgets).toHaveLength(1);
      expect(result.widgets[0].name).toBe('RideRequestCard');
      expect(result.widgets[0].file).toContain('ride_request_card.dart');
    });

    test('should process models', () => {
      const mockFlutter = {
        models: [
          { name: 'Ride', fields: ['id: String', 'pickupLocation: String'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.models).toHaveLength(1);
      expect(result.models[0].name).toBe('Ride');
      expect(result.models[0].implementation).toBeDefined();
    });

    test('should process services', () => {
      const mockFlutter = {
        services: [
          { name: 'RideMatchingService', type: 'api', methods: ['acceptRide', 'rejectRide'] }
        ]
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.services).toHaveLength(1);
      expect(result.services[0].name).toBe('RideMatchingService');
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

    test('should extract permissions including location_always', () => {
      const mockFlutter = {
        platformFeatures: ['GPS and location services', 'Push notifications']
      };

      const result = digest.generate({ flutter: mockFlutter });

      expect(result.permissions).toContain('location');
      expect(result.permissions).toContain('location_always');
      expect(result.permissions).toContain('notifications');
    });
  });

  describe('Driver-Specific Features', () => {
    test('should identify driver-specific screens', () => {
      expect(digest.isDriverSpecificScreen('RideAcceptanceScreen')).toBe(true);
      expect(digest.isDriverSpecificScreen('NavigationScreen')).toBe(true);
      expect(digest.isDriverSpecificScreen('EarningsScreen')).toBe(true);
      expect(digest.isDriverSpecificScreen('ProfileScreen')).toBe(false);
    });

    test('should get driver features for ride screens', () => {
      const features = digest.getDriverFeatures('RideAcceptanceScreen');

      expect(features).toBeDefined();
      expect(features.realtime).toBe(true);
      expect(features.features).toContain('Accept/Reject actions');
    });

    test('should get driver features for navigation screens', () => {
      const features = digest.getDriverFeatures('NavigationScreen');

      expect(features).toBeDefined();
      expect(features.realtime).toBe(true);
      expect(features.features).toContain('Turn-by-turn navigation');
    });

    test('should get driver features for earnings screens', () => {
      const features = digest.getDriverFeatures('EarningsScreen');

      expect(features).toBeDefined();
      expect(features.realtime).toBe(false);
      expect(features.features).toContain('Daily/weekly earnings');
    });

    test('should add driver-specific requirements', () => {
      const result = digest.generate({});

      expect(result.permissions).toContain('location');
      expect(result.permissions).toContain('location_always');
      expect(result.packages).toContain('google_maps_flutter');
      expect(result.packages).toContain('geolocator');
      expect(result.packages).toContain('socket_io_client');
    });

    test('should generate realtime features', () => {
      const result = digest.generate({});

      expect(result.realtimeFeatures).toBeDefined();
      expect(result.realtimeFeatures.rideRequests).toBeDefined();
      expect(result.realtimeFeatures.locationTracking).toBeDefined();
      expect(result.realtimeFeatures.implementation).toBeDefined();
    });
  });

  describe('API Processing', () => {
    test('should generate API services from endpoints', () => {
      const mockAPI = {
        endpoints: [
          { path: '/api/rides', method: 'GET', summary: 'Get rides' }
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
      expect(digest.getMethodName({ method: 'GET', path: '/api/rides' }))
        .toBe('getAllRides');

      expect(digest.getMethodName({ method: 'GET', path: '/api/rides/:id' }))
        .toBe('getRidesById');

      expect(digest.getMethodName({ method: 'POST', path: '/api/rides' }))
        .toBe('createRides');

      expect(digest.getMethodName({ method: 'PUT', path: '/api/rides/:id' }))
        .toBe('updateRides');

      expect(digest.getMethodName({ method: 'DELETE', path: '/api/rides/:id' }))
        .toBe('deleteRides');
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
        name: 'RideAcceptanceScreen',
        widgetType: 'stateful',
        widgets: ['RideCard', 'ActionButtons']
      };

      const impl = digest.generateScreenImplementation(screen);

      expect(impl.widgetTree).toBeDefined();
      expect(impl.stateVariables).toBeDefined();
      expect(impl.methods).toBeDefined();
      expect(impl.example).toBeDefined();
    });

    test('should generate state variables for ride screens', () => {
      const screen = { name: 'RideAcceptanceScreen', widgetType: 'stateful' };

      const variables = digest.generateStateVariables(screen);

      expect(variables.some(v => v.name === 'currentRide')).toBe(true);
      expect(variables.some(v => v.name === 'timer')).toBe(true);
    });

    test('should generate state variables for navigation screens', () => {
      const screen = { name: 'NavigationScreen', widgetType: 'stateful' };

      const variables = digest.generateStateVariables(screen);

      expect(variables.some(v => v.name === 'mapController')).toBe(true);
      expect(variables.some(v => v.name === 'currentLocation')).toBe(true);
      expect(variables.some(v => v.name === 'destination')).toBe(true);
    });

    test('should generate state variables for earnings screens', () => {
      const screen = { name: 'EarningsScreen', widgetType: 'stateful' };

      const variables = digest.generateStateVariables(screen);

      expect(variables.some(v => v.name === 'earnings')).toBe(true);
      expect(variables.some(v => v.name === 'totalEarnings')).toBe(true);
    });

    test('should generate methods for ride screens', () => {
      const screen = { name: 'RideAcceptanceScreen', widgetType: 'stateful' };

      const methods = digest.generateScreenMethods(screen);

      expect(methods.some(m => m.name === 'acceptRide')).toBe(true);
      expect(methods.some(m => m.name === 'rejectRide')).toBe(true);
    });

    test('should generate methods for navigation screens', () => {
      const screen = { name: 'NavigationScreen', widgetType: 'stateful' };

      const methods = digest.generateScreenMethods(screen);

      expect(methods.some(m => m.name === 'startNavigation')).toBe(true);
      expect(methods.some(m => m.name === 'updateLocation')).toBe(true);
    });

    test('should generate widget tree for map screens', () => {
      const screen = { name: 'NavigationScreen', widgetType: 'stateful' };

      const tree = digest.generateWidgetTree(screen);

      expect(tree.body).toBe('GoogleMap');
      expect(tree.overlay).toBeDefined();
    });
  });

  describe('Widget Implementation', () => {
    test('should generate widget implementation', () => {
      const widget = {
        name: 'RideRequestCard',
        type: 'stateless',
        properties: ['ride: Ride', 'onAccept: Function']
      };

      const impl = digest.generateWidgetImplementation(widget);

      expect(impl.constructor).toBeDefined();
      expect(impl.example).toBeDefined();
    });
  });

  describe('Model Implementation', () => {
    test('should generate model implementation', () => {
      const model = {
        name: 'Ride',
        fields: ['id: String', 'status: String']
      };

      const impl = digest.generateModelImplementation(model);

      expect(impl.className).toBe('Ride');
      expect(impl.methods.some(m => m.includes('fromJson'))).toBe(true);
      expect(impl.methods.some(m => m.includes('toJson'))).toBe(true);
      expect(impl.example).toBeDefined();
    });

    test('should generate model from API schema', () => {
      const model = {
        name: 'Ride',
        properties: {
          id: { type: 'string' },
          driverId: { type: 'string' },
          status: { type: 'string' }
        },
        required: ['id', 'driverId']
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
        methods: ['acceptRide', 'rejectRide']
      };

      const impl = digest.generateServiceImplementation(service);

      expect(impl.className).toBe('RideService');
      expect(impl.singleton).toBe(true);
    });

    test('should determine service dependencies', () => {
      const apiService = { type: 'api' };
      const storageService = { type: 'storage' };
      const locationService = { type: 'location' };
      const navigationService = { type: 'navigation' };

      expect(digest.getServiceDependencies(apiService)).toContain('http.Client');
      expect(digest.getServiceDependencies(storageService)).toContain('SharedPreferences');
      expect(digest.getServiceDependencies(locationService)).toContain('Geolocator');
      expect(digest.getServiceDependencies(navigationService)).toContain('GoogleMapController');
    });
  });

  describe('Feature Processing', () => {
    test('should extract driver stories', () => {
      const mockFeatures = {
        userStories: [
          { role: 'driver', action: 'accept ride requests', benefit: 'earn money' }
        ]
      };

      const result = digest.generate({ features: mockFeatures });

      expect(result.bestPractices.length).toBeGreaterThan(0);
    });

    test('should infer screen from driver story', () => {
      expect(digest.inferScreenFromStory({
        action: 'accept ride requests'
      })).toBe('RideAcceptanceScreen');

      expect(digest.inferScreenFromStory({
        action: 'navigate to pickup'
      })).toBe('NavigationScreen');

      expect(digest.inferScreenFromStory({
        action: 'view my earnings'
      })).toBe('EarningsScreen');
    });
  });

  describe('Real-time Implementation', () => {
    test('should generate realtime implementation guidance', () => {
      const impl = digest.generateRealtimeImplementation();

      expect(impl.socketConnection).toBeDefined();
      expect(impl.events).toBeDefined();
      expect(impl.events.length).toBeGreaterThan(0);
      expect(impl.example).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    test('should convert to snake_case', () => {
      expect(digest.toSnakeCase('RideAcceptanceScreen')).toBe('ride_acceptance_screen');
      expect(digest.toSnakeCase('NavigationService')).toBe('navigation_service');
      expect(digest.toSnakeCase('APIService')).toBe('a_p_i_service');
    });

    test('should capitalize strings', () => {
      expect(digest.capitalize('ride')).toBe('Ride');
      expect(digest.capitalize('driver')).toBe('Driver');
      expect(digest.capitalize('')).toBe('');
    });

    test('should group endpoints by resource', () => {
      const endpoints = [
        { path: '/api/rides', method: 'GET' },
        { path: '/api/rides/:id', method: 'GET' },
        { path: '/api/drivers', method: 'POST' }
      ];

      const grouped = digest.groupEndpointsByResource(endpoints);

      expect(grouped.rides).toHaveLength(2);
      expect(grouped.drivers).toHaveLength(1);
    });
  });
});
