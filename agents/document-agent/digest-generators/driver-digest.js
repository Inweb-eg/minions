import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('DriverDigest');

/**
 * DriverDigest - Generates Flutter driver app code generation instructions
 *
 * Takes parsed documentation from:
 * - Flutter Parser (screens, widgets, models, services)
 * - API Parser (endpoints for API integration)
 * - Feature Parser (user stories, requirements)
 *
 * Generates:
 * - Flutter driver screen implementations
 * - Driver-specific widgets (ride acceptance, navigation, earnings)
 * - Provider/state management setup
 * - API service clients for driver operations
 * - Model classes with JSON serialization
 * - Navigation/routing configuration
 */
class DriverDigest {
  constructor() {
    this.logger = createLogger('DriverDigest');
  }

  /**
   * Generate complete driver app digest from parsed documentation
   *
   * @param {Object} params - Parsed documentation
   * @param {Object} params.flutter - Parsed Flutter documentation
   * @param {Object} params.api - Parsed API documentation
   * @param {Object} params.features - Parsed feature documentation
   * @returns {Object} Flutter driver app code generation digest
   */
  generate({ flutter, api, features }) {
    this.logger.info('Generating driver app digest...');

    const digest = {
      platform: 'flutter',
      app: 'driver',
      generatedAt: new Date().toISOString(),

      // Code generation instructions
      screens: [],
      widgets: [],
      models: [],
      services: [],
      providers: [],
      routes: [],

      // Configuration
      packages: new Set(),
      assets: [],
      permissions: [],

      // Implementation guidance
      stateManagement: {},
      navigation: {},
      apiIntegration: {},
      realtimeFeatures: {},
      bestPractices: []
    };

    // Process Flutter documentation
    if (flutter) {
      this.processFlutter(flutter, digest);
    }

    // Process API documentation
    if (api) {
      this.processAPI(api, digest);
    }

    // Process feature documentation
    if (features) {
      this.processFeatures(features, digest);
    }

    // Add driver-specific requirements
    this.addDriverSpecificRequirements(digest);

    // Convert Sets to Arrays
    digest.packages = Array.from(digest.packages);

    this.logger.info(
      `Generated driver app digest: ${digest.screens.length} screens, ` +
      `${digest.widgets.length} widgets, ${digest.models.length} models`
    );

    return digest;
  }

  /**
   * Process Flutter documentation
   */
  processFlutter(flutter, digest) {
    // Process screens with driver-specific enhancements
    if (flutter.screens) {
      for (const screen of flutter.screens) {
        const driverScreen = {
          name: screen.name,
          file: `lib/screens/${this.toSnakeCase(screen.name)}.dart`,
          type: screen.widgetType || 'stateful',
          route: screen.route,
          description: screen.description,
          widgets: screen.widgets || [],
          stateManagement: screen.stateManagement,
          implementation: this.generateScreenImplementation(screen)
        };

        // Add driver-specific features
        if (this.isDriverSpecificScreen(screen.name)) {
          driverScreen.driverFeatures = this.getDriverFeatures(screen.name);
        }

        digest.screens.push(driverScreen);
      }
    }

    // Process widgets
    if (flutter.widgets) {
      for (const widget of flutter.widgets) {
        digest.widgets.push({
          name: widget.name,
          file: `lib/widgets/${this.toSnakeCase(widget.name)}.dart`,
          type: widget.type,
          description: widget.description,
          properties: widget.properties || [],
          implementation: this.generateWidgetImplementation(widget)
        });
      }
    }

    // Process models
    if (flutter.models) {
      for (const model of flutter.models) {
        digest.models.push({
          name: model.name,
          file: `lib/models/${this.toSnakeCase(model.name)}.dart`,
          fields: model.fields || [],
          implementation: this.generateModelImplementation(model)
        });
      }
    }

    // Process services with driver-specific services
    if (flutter.services) {
      for (const service of flutter.services) {
        digest.services.push({
          name: service.name,
          file: `lib/services/${this.toSnakeCase(service.name)}.dart`,
          type: service.type,
          methods: service.methods || [],
          implementation: this.generateServiceImplementation(service)
        });
      }
    }

    // Process routes
    if (flutter.routes) {
      digest.routes = flutter.routes.map(r => ({
        path: r.path,
        screen: r.screen,
        implementation: `GoRoute(path: '${r.path}', builder: (context, state) => ${r.screen}())`
      }));
    }

    // Extract state management pattern
    if (flutter.stateManagement?.primary) {
      digest.stateManagement.pattern = flutter.stateManagement.primary;
      digest.packages.add(flutter.stateManagement.primary);
    }

    // Extract navigation pattern
    if (flutter.stateManagement?.navigation) {
      digest.navigation.library = flutter.stateManagement.navigation;
      digest.packages.add(flutter.stateManagement.navigation.replace(/_/g, '-'));
    }

    // Add packages
    if (flutter.packages) {
      for (const pkg of flutter.packages) {
        if (pkg.name && pkg.name !== 'flutter') {
          digest.packages.add(pkg.name);
        }
      }
    }

    // Extract permissions - drivers need more location permissions
    if (flutter.platformFeatures) {
      for (const feature of flutter.platformFeatures) {
        if (feature.toLowerCase().includes('location') || feature.toLowerCase().includes('gps')) {
          digest.permissions.push('location');
          digest.permissions.push('location_always'); // Background location for drivers
        }
        if (feature.toLowerCase().includes('notification')) {
          digest.permissions.push('notifications');
        }
        if (feature.toLowerCase().includes('camera')) {
          digest.permissions.push('camera');
        }
      }
    }
  }

  /**
   * Process API documentation for driver service generation
   */
  processAPI(api, digest) {
    if (!api.endpoints) return;

    // Group endpoints by resource
    const endpointsByResource = this.groupEndpointsByResource(api.endpoints);

    for (const [resource, endpoints] of Object.entries(endpointsByResource)) {
      // Check if service already exists
      if (!digest.services.find(s => s.name.toLowerCase().includes(resource))) {
        digest.services.push({
          name: `${this.capitalize(resource)}ApiService`,
          file: `lib/services/${resource}_api_service.dart`,
          type: 'api',
          methods: endpoints.map(e => ({
            name: this.getMethodName(e),
            httpMethod: e.method,
            endpoint: e.path,
            description: e.description || e.summary,
            parameters: e.parameters || [],
            requestBody: e.requestBody,
            returnType: this.getReturnType(resource, e),
            implementation: this.generateApiMethodImplementation(e, resource)
          }))
        });
      }
    }

    // Generate models from API schemas
    if (api.models) {
      for (const model of api.models) {
        if (!digest.models.find(m => m.name === model.name)) {
          digest.models.push({
            name: model.name,
            file: `lib/models/${this.toSnakeCase(model.name)}.dart`,
            fields: this.convertSchemaToFields(model),
            implementation: this.generateModelFromAPISchema(model)
          });
        }
      }
    }

    // Add HTTP package
    digest.packages.add('http');
  }

  /**
   * Process feature documentation
   */
  processFeatures(features, digest) {
    // Extract driver-specific stories
    if (features.userStories) {
      for (const story of features.userStories) {
        if (story.role?.toLowerCase().includes('driver')) {
          digest.bestPractices.push({
            userStory: `As a ${story.role}, ${story.action}`,
            benefit: story.benefit,
            screen: this.inferScreenFromStory(story)
          });
        }
      }
    }

    // Extract requirements for implementation notes
    if (features.requirements) {
      digest.bestPractices.push(
        ...features.requirements.map(req => ({
          requirement: req,
          category: 'implementation'
        }))
      );
    }
  }

  /**
   * Add driver-specific requirements
   */
  addDriverSpecificRequirements(digest) {
    // Location services - critical for drivers
    if (!digest.permissions.includes('location')) {
      digest.permissions.push('location');
    }
    if (!digest.permissions.includes('location_always')) {
      digest.permissions.push('location_always');
    }

    // Add map packages
    digest.packages.add('google_maps_flutter');
    digest.packages.add('geolocator');

    // Add real-time communication
    digest.packages.add('socket_io_client');

    // Real-time features guidance
    digest.realtimeFeatures = {
      rideRequests: 'WebSocket connection for incoming ride requests',
      locationTracking: 'Continuous GPS tracking during active rides',
      statusUpdates: 'Real-time status updates (online/offline/busy)',
      implementation: this.generateRealtimeImplementation()
    };

    // Driver-specific best practices
    digest.bestPractices.push({
      category: 'performance',
      practice: 'Optimize battery usage for background location tracking',
      implementation: 'Use geofencing and adaptive location update intervals'
    });

    digest.bestPractices.push({
      category: 'ux',
      practice: 'Always show driver status clearly',
      implementation: 'Prominent online/offline toggle with visual feedback'
    });
  }

  /**
   * Check if screen is driver-specific
   */
  isDriverSpecificScreen(screenName) {
    const driverScreens = [
      'ride', 'accept', 'navigation', 'earnings',
      'availability', 'dispatch', 'route'
    ];

    const nameLower = screenName.toLowerCase();
    return driverScreens.some(ds => nameLower.includes(ds));
  }

  /**
   * Get driver-specific features for screen
   */
  getDriverFeatures(screenName) {
    const nameLower = screenName.toLowerCase();

    if (nameLower.includes('ride') || nameLower.includes('accept')) {
      return {
        realtime: true,
        features: ['Ride request notification', 'Accept/Reject actions', 'Timer countdown']
      };
    }

    if (nameLower.includes('navigation') || nameLower.includes('route')) {
      return {
        realtime: true,
        features: ['Turn-by-turn navigation', 'ETA updates', 'Traffic integration']
      };
    }

    if (nameLower.includes('earnings')) {
      return {
        realtime: false,
        features: ['Daily/weekly earnings', 'Trip history', 'Payment breakdown']
      };
    }

    return null;
  }

  /**
   * Generate screen implementation guidance
   */
  generateScreenImplementation(screen) {
    return {
      widgetTree: this.generateWidgetTree(screen),
      stateVariables: this.generateStateVariables(screen),
      methods: this.generateScreenMethods(screen),
      lifecycle: screen.widgetType === 'stateful' ? ['initState', 'dispose'] : [],
      example: this.generateScreenExample(screen)
    };
  }

  /**
   * Generate widget tree structure
   */
  generateWidgetTree(screen) {
    const nameLower = screen.name.toLowerCase();

    if (nameLower.includes('navigation') || nameLower.includes('map')) {
      return {
        root: 'Scaffold',
        body: 'GoogleMap',
        overlay: ['NavigationOverlay', 'StatusBar']
      };
    }

    return {
      root: 'Scaffold',
      appBar: 'AppBar',
      body: screen.widgets && screen.widgets.length > 0 ? 'Column' : 'Container',
      children: screen.widgets || []
    };
  }

  /**
   * Generate state variables for screen
   */
  generateStateVariables(screen) {
    const variables = [];
    const nameLower = screen.name.toLowerCase();

    if (screen.stateManagement === 'provider') {
      variables.push({ name: 'provider', type: 'Provider', required: true });
    }

    if (nameLower.includes('ride') || nameLower.includes('accept')) {
      variables.push({ name: 'currentRide', type: 'Ride?', required: false });
      variables.push({ name: 'timer', type: 'int', initial: '30' });
    }

    if (nameLower.includes('navigation') || nameLower.includes('map')) {
      variables.push({ name: 'mapController', type: 'GoogleMapController?', required: false });
      variables.push({ name: 'currentLocation', type: 'LatLng', required: true });
      variables.push({ name: 'destination', type: 'LatLng', required: true });
    }

    if (nameLower.includes('earnings')) {
      variables.push({ name: 'earnings', type: 'List<Earning>', required: true });
      variables.push({ name: 'totalEarnings', type: 'double', initial: '0.0' });
    }

    if (nameLower.includes('list')) {
      variables.push({ name: 'items', type: 'List', required: true });
      variables.push({ name: 'isLoading', type: 'bool', initial: 'true' });
    }

    return variables;
  }

  /**
   * Generate screen methods
   */
  generateScreenMethods(screen) {
    const methods = [];
    const nameLower = screen.name.toLowerCase();

    if (nameLower.includes('ride') || nameLower.includes('accept')) {
      methods.push({ name: 'acceptRide', returnType: 'Future<void>' });
      methods.push({ name: 'rejectRide', returnType: 'Future<void>' });
      methods.push({ name: 'startTimer', returnType: 'void' });
    }

    if (nameLower.includes('navigation')) {
      methods.push({ name: 'startNavigation', returnType: 'Future<void>' });
      methods.push({ name: 'updateLocation', returnType: 'void' });
      methods.push({ name: 'completeRide', returnType: 'Future<void>' });
    }

    if (nameLower.includes('earnings')) {
      methods.push({ name: 'fetchEarnings', returnType: 'Future<void>' });
      methods.push({ name: 'calculateTotal', returnType: 'double' });
    }

    if (nameLower.includes('list')) {
      methods.push({ name: 'fetchData', returnType: 'Future<void>' });
      methods.push({ name: 'refreshData', returnType: 'Future<void>' });
    }

    return methods;
  }

  /**
   * Generate screen code example
   */
  generateScreenExample(screen) {
    const widgetType = screen.widgetType === 'stateless' ? 'StatelessWidget' : 'StatefulWidget';

    return `
class ${screen.name} extends ${widgetType} {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('${screen.name}')),
      body: // Your implementation here
    );
  }
}`.trim();
  }

  /**
   * Generate widget implementation guidance
   */
  generateWidgetImplementation(widget) {
    return {
      properties: widget.properties || [],
      constructor: this.generateConstructor(widget),
      buildMethod: 'Implement build() method returning Widget tree',
      example: this.generateWidgetExample(widget)
    };
  }

  /**
   * Generate constructor parameters
   */
  generateConstructor(widget) {
    const params = [];

    if (widget.properties) {
      for (const prop of widget.properties) {
        const match = prop.match(/(\w+):\s*(\w+)/);
        if (match) {
          params.push({ name: match[1], type: match[2], required: true });
        }
      }
    }

    return params;
  }

  /**
   * Generate widget code example
   */
  generateWidgetExample(widget) {
    return `
class ${widget.name} extends ${widget.type === 'stateless' ? 'StatelessWidget' : 'StatefulWidget'} {
  const ${widget.name}({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Container(
      // Your implementation here
    );
  }
}`.trim();
  }

  /**
   * Generate model implementation
   */
  generateModelImplementation(model) {
    return {
      className: model.name,
      fields: model.fields || [],
      methods: [
        'fromJson - Deserialize from JSON',
        'toJson - Serialize to JSON',
        'copyWith - Create copy with modified fields'
      ],
      example: this.generateModelExample(model)
    };
  }

  /**
   * Generate model code example
   */
  generateModelExample(model) {
    const fields = model.fields?.slice(0, 3).map(f => {
      const match = f.match(/(\w+):\s*(\w+)/);
      return match ? `  final ${match[2]} ${match[1]};` : `  final String field;`;
    }).join('\n') || '  final String id;\n  final String name;';

    return `
class ${model.name} {
${fields}

  ${model.name}({required this.id, required this.name});

  factory ${model.name}.fromJson(Map<String, dynamic> json) {
    return ${model.name}(
      id: json['id'],
      name: json['name'],
    );
  }

  Map<String, dynamic> toJson() {
    return {'id': id, 'name': name};
  }
}`.trim();
  }

  /**
   * Generate service implementation
   */
  generateServiceImplementation(service) {
    return {
      className: service.name,
      singleton: true,
      methods: service.methods || [],
      dependencies: this.getServiceDependencies(service),
      example: service.type === 'api' ? this.generateApiServiceExample(service) : null
    };
  }

  /**
   * Get service dependencies
   */
  getServiceDependencies(service) {
    const deps = [];

    if (service.type === 'api') {
      deps.push('http.Client');
    }
    if (service.type === 'storage') {
      deps.push('SharedPreferences');
    }
    if (service.type === 'location') {
      deps.push('Geolocator');
    }
    if (service.type === 'navigation') {
      deps.push('GoogleMapController');
    }

    return deps;
  }

  /**
   * Generate API service example
   */
  generateApiServiceExample(service) {
    return `
class ${service.name} {
  final http.Client client;
  static const baseUrl = 'API_BASE_URL';

  ${service.name}({required this.client});

  Future<List<Model>> fetchData() async {
    final response = await client.get(Uri.parse('\$baseUrl/endpoint'));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data.map((json) => Model.fromJson(json)).toList();
    }
    throw Exception('Failed to load data');
  }
}`.trim();
  }

  /**
   * Generate real-time implementation guidance
   */
  generateRealtimeImplementation() {
    return {
      socketConnection: 'Establish WebSocket connection on app start',
      events: [
        'ride_request - New ride available',
        'ride_cancelled - Ride was cancelled',
        'status_update - Update driver status'
      ],
      example: `
// Initialize socket connection
final socket = io('wss://api.example.com', <String, dynamic>{
  'transports': ['websocket'],
  'autoConnect': false,
});

socket.on('ride_request', (data) {
  // Handle incoming ride request
  final ride = Ride.fromJson(data);
  showRideRequestDialog(ride);
});

socket.connect();`.trim()
    };
  }

  /**
   * Generate API method implementation
   */
  generateApiMethodImplementation(endpoint, resource) {
    const method = endpoint.method.toLowerCase();

    return {
      httpCall: `client.${method}(Uri.parse('\$baseUrl${endpoint.path}'))`,
      responseHandling: 'Check status code, deserialize JSON, handle errors',
      errorHandling: 'Throw appropriate exceptions for HTTP errors',
      example: `// ${method.toUpperCase()} ${endpoint.path}`
    };
  }

  /**
   * Group endpoints by resource
   */
  groupEndpointsByResource(endpoints) {
    const grouped = {};

    for (const endpoint of endpoints) {
      const match = endpoint.path.match(/\/api\/([^/]+)/);
      const resource = match ? match[1] : 'default';

      if (!grouped[resource]) {
        grouped[resource] = [];
      }
      grouped[resource].push(endpoint);
    }

    return grouped;
  }

  /**
   * Get method name from endpoint
   */
  getMethodName(endpoint) {
    const method = endpoint.method.toLowerCase();
    const parts = endpoint.path.split('/').filter(p => p && p !== 'api');
    const resource = parts[0];

    if (method === 'get' && endpoint.path.includes(':id')) {
      return `get${this.capitalize(resource)}ById`;
    } else if (method === 'get') {
      return `getAll${this.capitalize(resource)}`;
    } else if (method === 'post') {
      return `create${this.capitalize(resource)}`;
    } else if (method === 'put') {
      return `update${this.capitalize(resource)}`;
    } else if (method === 'delete') {
      return `delete${this.capitalize(resource)}`;
    }

    return `${method}${this.capitalize(resource)}`;
  }

  /**
   * Get return type for method
   */
  getReturnType(resource, endpoint) {
    const method = endpoint.method.toLowerCase();

    if (method === 'get' && !endpoint.path.includes(':id')) {
      return `Future<List<${this.capitalize(resource)}>>`;
    }

    return `Future<${this.capitalize(resource)}>`;
  }

  /**
   * Convert API schema to Dart fields
   */
  convertSchemaToFields(model) {
    const fields = [];

    if (model.properties) {
      for (const [name, prop] of Object.entries(model.properties)) {
        const dartType = this.mapTypeToDart(prop.type);
        const required = model.required?.includes(name);
        fields.push(`${name}: ${dartType}${required ? '' : '?'}`);
      }
    }

    return fields;
  }

  /**
   * Map OpenAPI type to Dart type
   */
  mapTypeToDart(type) {
    const typeMap = {
      'string': 'String',
      'number': 'double',
      'integer': 'int',
      'boolean': 'bool',
      'array': 'List',
      'object': 'Map<String, dynamic>'
    };

    return typeMap[type] || 'dynamic';
  }

  /**
   * Generate model from API schema
   */
  generateModelFromAPISchema(model) {
    return {
      className: model.name,
      fields: this.convertSchemaToFields(model),
      methods: ['fromJson', 'toJson', 'copyWith'],
      example: this.generateModelExample(model)
    };
  }

  /**
   * Infer screen from user story
   */
  inferScreenFromStory(story) {
    const action = story.action.toLowerCase();

    if (action.includes('accept') || action.includes('ride request')) return 'RideAcceptanceScreen';
    if (action.includes('navigate') || action.includes('directions')) return 'NavigationScreen';
    if (action.includes('earnings') || action.includes('payment')) return 'EarningsScreen';
    if (action.includes('online') || action.includes('availability')) return 'AvailabilityScreen';
    if (action.includes('history')) return 'RideHistoryScreen';
    if (action.includes('profile')) return 'ProfileScreen';

    return null;
  }

  /**
   * Convert string to snake_case
   */
  toSnakeCase(str) {
    return str
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, '')
      .replace(/\s+/g, '_');
  }

  /**
   * Capitalize string
   */
  capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of DriverDigest
 * @returns {DriverDigest}
 */
export function getDriverDigest() {
  if (!instance) {
    instance = new DriverDigest();
  }
  return instance;
}

export { DriverDigest };
export default DriverDigest;
