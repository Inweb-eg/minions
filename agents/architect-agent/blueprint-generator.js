/**
 * Minions - Blueprint Generator
 * =============================
 * Creates system architecture blueprints from requirements.
 * Generates comprehensive system designs including components,
 * layers, boundaries, and architectural patterns.
 */

import EventEmitter from 'events';

// Architectural Patterns
const ArchitecturalPatterns = {
  LAYERED: 'layered',
  MICROSERVICES: 'microservices',
  MODULAR_MONOLITH: 'modular-monolith',
  EVENT_DRIVEN: 'event-driven',
  CLEAN_ARCHITECTURE: 'clean-architecture'
};

// Component Types
const ComponentTypes = {
  BACKEND: 'backend',
  FRONTEND_WEB: 'frontend-web',
  FRONTEND_MOBILE: 'frontend-mobile',
  DATABASE: 'database',
  CACHE: 'cache',
  MESSAGE_QUEUE: 'message-queue',
  API_GATEWAY: 'api-gateway',
  AUTH_SERVICE: 'auth-service'
};

// Layer Definitions
const SystemLayers = {
  PRESENTATION: { name: 'Presentation', order: 1 },
  APPLICATION: { name: 'Application', order: 2 },
  DOMAIN: { name: 'Domain', order: 3 },
  INFRASTRUCTURE: { name: 'Infrastructure', order: 4 },
  DATA: { name: 'Data', order: 5 }
};

class BlueprintGenerator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    
    // Blueprint templates for common patterns
    this.templates = this._initializeTemplates();
    
    // Rules for validation
    this.architecturalRules = this._initializeRules();
  }
  
  /**
   * Generate a complete system blueprint from requirements
   */
  async generate({ requirements, techStack, existingBlueprint }) {
    const blueprint = {
      id: `BP-${Date.now()}`,
      version: existingBlueprint ? this._incrementVersion(existingBlueprint.version) : '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      
      // Metadata
      metadata: {
        projectName: requirements.projectName || 'Minions Project',
        description: requirements.description || '',
        generatedBy: 'Architect-Agent',
        basedOn: existingBlueprint?.id || null
      },
      
      // Architecture Pattern
      pattern: this._selectPattern(requirements),
      
      // System Components
      components: await this._generateComponents(requirements, techStack),
      
      // System Layers
      layers: this._defineLayers(requirements),
      
      // Boundaries & Modules
      boundaries: this._defineBoundaries(requirements),
      
      // Data Flow
      dataFlow: this._defineDataFlow(requirements),
      
      // Security Architecture
      security: this._defineSecurityArchitecture(requirements),
      
      // Scalability Considerations
      scalability: this._defineScalabilityStrategy(requirements),
      
      // Cross-Cutting Concerns
      crossCutting: this._defineCrossCuttingConcerns(requirements),
      
      // Architectural Rules
      rules: this._generateArchitecturalRules(requirements),
      
      // Technology Stack Reference
      techStack
    };
    
    // Validate the generated blueprint
    const validation = this._validateBlueprint(blueprint);
    if (!validation.valid) {
      this.emit('warning', { 
        type: 'BLUEPRINT_VALIDATION',
        issues: validation.issues 
      });
    }
    
    return blueprint;
  }
  
  /**
   * Validate code against blueprint rules
   */
  async validateAgainstBlueprint(filePath, content, blueprint) {
    const violations = [];
    
    // Determine which component this file belongs to
    const component = this._identifyComponent(filePath, blueprint);
    if (!component) {
      return violations; // Can't validate unknown components
    }
    
    // Check layer violations
    const layerViolations = this._checkLayerViolations(filePath, content, blueprint, component);
    violations.push(...layerViolations);
    
    // Check boundary violations
    const boundaryViolations = this._checkBoundaryViolations(filePath, content, blueprint, component);
    violations.push(...boundaryViolations);
    
    // Check pattern compliance
    const patternViolations = this._checkPatternCompliance(filePath, content, blueprint);
    violations.push(...patternViolations);
    
    // Check dependency direction
    const dependencyViolations = this._checkDependencyDirection(filePath, content, blueprint, component);
    violations.push(...dependencyViolations);
    
    return violations;
  }
  
  /**
   * Update existing blueprint with new requirements
   */
  async updateBlueprint(existingBlueprint, newRequirements) {
    const updatedBlueprint = {
      ...existingBlueprint,
      version: this._incrementVersion(existingBlueprint.version),
      updatedAt: new Date().toISOString(),
      metadata: {
        ...existingBlueprint.metadata,
        previousVersion: existingBlueprint.version
      }
    };
    
    // Merge new requirements
    if (newRequirements.features) {
      updatedBlueprint.components = await this._mergeComponents(
        existingBlueprint.components,
        newRequirements
      );
    }
    
    return updatedBlueprint;
  }
  
  // ==================== Private Methods ====================
  
  _selectPattern(requirements) {
    // Analyze requirements to select best pattern
    const factors = {
      teamSize: requirements.teamSize || 'small',
      scalabilityNeeds: requirements.scalability || 'moderate',
      deploymentFrequency: requirements.deploymentFrequency || 'weekly',
      complexity: this._assessComplexity(requirements)
    };
    
    // Decision logic
    if (factors.scalabilityNeeds === 'high' && factors.teamSize === 'large') {
      return {
        primary: ArchitecturalPatterns.MICROSERVICES,
        secondary: ArchitecturalPatterns.EVENT_DRIVEN,
        rationale: 'High scalability needs with large team support microservices'
      };
    }
    
    if (factors.complexity === 'high') {
      return {
        primary: ArchitecturalPatterns.CLEAN_ARCHITECTURE,
        secondary: ArchitecturalPatterns.MODULAR_MONOLITH,
        rationale: 'Complex domain benefits from clean architecture separation'
      };
    }
    
    // Default for most projects
    return {
      primary: ArchitecturalPatterns.MODULAR_MONOLITH,
      secondary: ArchitecturalPatterns.LAYERED,
      rationale: 'Modular monolith provides good balance of simplicity and maintainability'
    };
  }
  
  async _generateComponents(requirements, techStack) {
    const components = {
      backend: null,
      admin: null,
      mobile: {
        users: null,
        drivers: null
      },
      shared: null,
      infrastructure: null
    };
    
    // Backend Component
    components.backend = {
      type: ComponentTypes.BACKEND,
      name: 'Backend API',
      technology: techStack.backend,
      structure: {
        entryPoint: 'src/index.js',
        routes: 'src/routes/',
        controllers: 'src/controllers/',
        services: 'src/services/',
        models: 'src/models/',
        middleware: 'src/middleware/',
        utils: 'src/utils/',
        config: 'src/config/'
      },
      features: this._extractBackendFeatures(requirements),
      authentication: {
        strategy: 'JWT',
        provider: 'local',
        tokenExpiry: '24h',
        refreshToken: true
      },
      database: {
        type: techStack.database?.type || 'mongodb',
        orm: techStack.database?.orm || 'mongoose',
        migrations: true
      },
      api: {
        style: 'REST',
        versioning: 'url', // /api/v1/
        documentation: 'swagger'
      }
    };
    
    // Admin Dashboard Component
    components.admin = {
      type: ComponentTypes.FRONTEND_WEB,
      name: 'Admin Dashboard',
      technology: techStack.admin,
      structure: {
        entryPoint: 'src/index.jsx',
        pages: 'src/pages/',
        components: 'src/components/',
        hooks: 'src/hooks/',
        services: 'src/services/',
        store: 'src/store/',
        utils: 'src/utils/',
        styles: 'src/styles/'
      },
      stateManagement: {
        library: 'redux-toolkit',
        pattern: 'slices',
        middleware: ['thunk']
      },
      routing: {
        library: 'react-router-dom',
        authGuards: true
      },
      features: this._extractAdminFeatures(requirements)
    };
    
    // Mobile Users App
    components.mobile.users = {
      type: ComponentTypes.FRONTEND_MOBILE,
      name: 'Users App',
      technology: techStack.mobile,
      structure: {
        entryPoint: 'lib/main.dart',
        screens: 'lib/screens/',
        widgets: 'lib/widgets/',
        providers: 'lib/providers/',
        services: 'lib/services/',
        models: 'lib/models/',
        utils: 'lib/utils/'
      },
      stateManagement: {
        library: 'provider',
        pattern: 'changeNotifier'
      },
      features: this._extractUsersFeatures(requirements)
    };
    
    // Mobile Drivers App
    components.mobile.drivers = {
      type: ComponentTypes.FRONTEND_MOBILE,
      name: 'Drivers App',
      technology: techStack.mobile,
      structure: {
        entryPoint: 'lib/main.dart',
        screens: 'lib/screens/',
        widgets: 'lib/widgets/',
        providers: 'lib/providers/',
        services: 'lib/services/',
        models: 'lib/models/',
        utils: 'lib/utils/'
      },
      stateManagement: {
        library: 'provider',
        pattern: 'changeNotifier'
      },
      features: this._extractDriversFeatures(requirements)
    };
    
    // Shared/Common Code
    components.shared = {
      name: 'Shared Libraries',
      packages: {
        'api-client': 'Shared API client for all frontends',
        'common-types': 'Shared TypeScript/Dart types',
        'validation': 'Shared validation rules',
        'constants': 'Shared constants and enums'
      }
    };
    
    // Infrastructure
    components.infrastructure = {
      docker: {
        backend: 'Dockerfile.backend',
        admin: 'Dockerfile.admin',
        compose: 'docker-compose.yml'
      },
      ci_cd: {
        provider: 'github-actions',
        pipelines: ['test', 'build', 'deploy']
      },
      monitoring: {
        logging: 'winston',
        metrics: 'prometheus',
        tracing: 'opentelemetry'
      }
    };
    
    return components;
  }
  
  _defineLayers(requirements) {
    return {
      presentation: {
        ...SystemLayers.PRESENTATION,
        components: ['Admin Dashboard', 'Users App', 'Drivers App'],
        responsibilities: [
          'User interface rendering',
          'User input handling',
          'View state management',
          'API consumption'
        ],
        allowedDependencies: ['application']
      },
      application: {
        ...SystemLayers.APPLICATION,
        components: ['Backend API - Controllers', 'Backend API - Services'],
        responsibilities: [
          'Business logic orchestration',
          'Transaction management',
          'Authorization enforcement',
          'DTO transformations'
        ],
        allowedDependencies: ['domain', 'infrastructure']
      },
      domain: {
        ...SystemLayers.DOMAIN,
        components: ['Backend API - Models', 'Backend API - Business Rules'],
        responsibilities: [
          'Core business entities',
          'Business rules and validations',
          'Domain events',
          'Value objects'
        ],
        allowedDependencies: [] // Domain has no dependencies
      },
      infrastructure: {
        ...SystemLayers.INFRASTRUCTURE,
        components: ['Database', 'External Services', 'Message Queue'],
        responsibilities: [
          'Data persistence',
          'External API integration',
          'Caching',
          'File storage'
        ],
        allowedDependencies: ['domain']
      }
    };
  }
  
  _defineBoundaries(requirements) {
    return {
      contexts: [
        {
          name: 'User Management',
          owner: 'Backend-Agent',
          entities: ['User', 'Profile', 'Authentication'],
          boundaries: {
            exposes: ['UserService', 'AuthService'],
            consumes: []
          }
        },
        {
          name: 'Ride Management',
          owner: 'Backend-Agent',
          entities: ['Ride', 'Route', 'Pricing'],
          boundaries: {
            exposes: ['RideService', 'PricingService'],
            consumes: ['UserService', 'DriverService']
          }
        },
        {
          name: 'Driver Management',
          owner: 'Backend-Agent',
          entities: ['Driver', 'Vehicle', 'Availability'],
          boundaries: {
            exposes: ['DriverService', 'VehicleService'],
            consumes: ['UserService']
          }
        },
        {
          name: 'Payment Processing',
          owner: 'Backend-Agent',
          entities: ['Payment', 'Transaction', 'Refund'],
          boundaries: {
            exposes: ['PaymentService'],
            consumes: ['UserService', 'RideService']
          }
        },
        {
          name: 'Notifications',
          owner: 'Backend-Agent',
          entities: ['Notification', 'Template', 'Channel'],
          boundaries: {
            exposes: ['NotificationService'],
            consumes: ['UserService', 'DriverService']
          }
        }
      ],
      rules: [
        {
          id: 'BOUNDARY-001',
          rule: 'Contexts may only communicate through exposed services',
          severity: 'ERROR'
        },
        {
          id: 'BOUNDARY-002',
          rule: 'Direct database access across contexts is forbidden',
          severity: 'ERROR'
        },
        {
          id: 'BOUNDARY-003',
          rule: 'Shared types must be defined in common package',
          severity: 'WARNING'
        }
      ]
    };
  }
  
  _defineDataFlow(requirements) {
    return {
      patterns: [
        {
          name: 'Request-Response',
          description: 'Standard synchronous API calls',
          usage: ['REST endpoints', 'GraphQL queries']
        },
        {
          name: 'Event-Driven',
          description: 'Asynchronous event publishing',
          usage: ['Notifications', 'Analytics', 'Audit logging']
        },
        {
          name: 'Real-Time',
          description: 'WebSocket connections for live updates',
          usage: ['Ride tracking', 'Chat', 'Status updates']
        }
      ],
      flows: [
        {
          name: 'User Authentication Flow',
          steps: [
            { from: 'Mobile App', to: 'API Gateway', action: 'Login Request' },
            { from: 'API Gateway', to: 'Auth Service', action: 'Validate Credentials' },
            { from: 'Auth Service', to: 'Database', action: 'Query User' },
            { from: 'Auth Service', to: 'API Gateway', action: 'Return JWT' },
            { from: 'API Gateway', to: 'Mobile App', action: 'Login Response' }
          ]
        },
        {
          name: 'Ride Booking Flow',
          steps: [
            { from: 'Users App', to: 'Backend', action: 'Request Ride' },
            { from: 'Backend', to: 'Pricing Service', action: 'Calculate Price' },
            { from: 'Backend', to: 'Driver Service', action: 'Find Nearby Drivers' },
            { from: 'Backend', to: 'Notification Service', action: 'Notify Drivers' },
            { from: 'Drivers App', to: 'Backend', action: 'Accept Ride' },
            { from: 'Backend', to: 'Users App', action: 'Ride Confirmed (WebSocket)' }
          ]
        }
      ]
    };
  }
  
  _defineSecurityArchitecture(requirements) {
    return {
      authentication: {
        method: 'JWT',
        storage: 'httpOnly cookies (web), secure storage (mobile)',
        expiry: {
          accessToken: '15m',
          refreshToken: '7d'
        },
        mfa: {
          enabled: true,
          methods: ['sms', 'totp']
        }
      },
      authorization: {
        model: 'RBAC',
        roles: ['user', 'driver', 'admin', 'super_admin'],
        permissions: {
          user: ['read:own_profile', 'create:ride', 'read:own_rides'],
          driver: ['read:own_profile', 'accept:ride', 'update:ride_status'],
          admin: ['read:all_users', 'read:all_rides', 'manage:drivers'],
          super_admin: ['*']
        }
      },
      dataProtection: {
        encryption: {
          atRest: 'AES-256',
          inTransit: 'TLS 1.3'
        },
        pii: {
          fields: ['email', 'phone', 'address', 'payment_info'],
          handling: 'encrypted, access-logged'
        }
      },
      apiSecurity: {
        rateLimiting: {
          enabled: true,
          limits: {
            anonymous: '100/hour',
            authenticated: '1000/hour',
            admin: '5000/hour'
          }
        },
        cors: {
          origins: ['admin.domain.com', 'localhost:3000'],
          methods: ['GET', 'POST', 'PUT', 'DELETE'],
          credentials: true
        },
        headers: [
          'X-Content-Type-Options: nosniff',
          'X-Frame-Options: DENY',
          'Content-Security-Policy: default-src self'
        ]
      }
    };
  }
  
  _defineScalabilityStrategy(requirements) {
    return {
      horizontal: {
        backend: {
          strategy: 'stateless',
          minInstances: 2,
          maxInstances: 10,
          scalingMetric: 'cpu',
          threshold: 70
        },
        database: {
          strategy: 'replica-set',
          readReplicas: 2
        }
      },
      vertical: {
        recommendations: {
          backend: { cpu: '2 cores', memory: '4GB' },
          database: { cpu: '4 cores', memory: '8GB' }
        }
      },
      caching: {
        strategy: 'cache-aside',
        provider: 'redis',
        ttl: {
          userSessions: '24h',
          rideData: '5m',
          staticData: '1h'
        }
      },
      loadBalancing: {
        strategy: 'round-robin',
        healthCheck: '/health',
        stickySession: false
      }
    };
  }
  
  _defineCrossCuttingConcerns(requirements) {
    return {
      logging: {
        library: 'winston',
        levels: ['error', 'warn', 'info', 'debug'],
        format: 'json',
        transports: ['console', 'file', 'cloudwatch'],
        correlation: {
          enabled: true,
          header: 'X-Correlation-ID'
        }
      },
      errorHandling: {
        strategy: 'centralized',
        middleware: 'errorHandler.js',
        reporting: {
          service: 'sentry',
          environments: ['production', 'staging']
        }
      },
      validation: {
        library: 'joi',
        location: 'middleware',
        sanitization: true
      },
      monitoring: {
        metrics: {
          library: 'prom-client',
          endpoint: '/metrics'
        },
        healthCheck: {
          endpoint: '/health',
          checks: ['database', 'redis', 'external-apis']
        },
        alerting: {
          provider: 'pagerduty',
          thresholds: {
            errorRate: '5%',
            latencyP99: '2s',
            availability: '99.9%'
          }
        }
      },
      documentation: {
        api: {
          format: 'openapi-3.0',
          generator: 'swagger-jsdoc',
          ui: 'swagger-ui-express'
        },
        code: {
          format: 'jsdoc',
          generator: 'documentation.js'
        }
      }
    };
  }
  
  _generateArchitecturalRules(requirements) {
    return [
      {
        id: 'RULE-001',
        name: 'Layer Dependency Direction',
        description: 'Dependencies must flow downward: Presentation → Application → Domain ← Infrastructure',
        severity: 'ERROR',
        pattern: 'layer-dependency'
      },
      {
        id: 'RULE-002',
        name: 'No Direct Database Access from Controllers',
        description: 'Controllers must use services, never access database directly',
        severity: 'ERROR',
        pattern: 'controller-no-db'
      },
      {
        id: 'RULE-003',
        name: 'API Versioning Required',
        description: 'All API routes must be versioned (/api/v1/...)',
        severity: 'WARNING',
        pattern: 'api-versioning'
      },
      {
        id: 'RULE-004',
        name: 'Service Isolation',
        description: 'Services should not directly call other services; use events for cross-service communication',
        severity: 'WARNING',
        pattern: 'service-isolation'
      },
      {
        id: 'RULE-005',
        name: 'Model Validation',
        description: 'All models must have validation schemas',
        severity: 'ERROR',
        pattern: 'model-validation'
      },
      {
        id: 'RULE-006',
        name: 'Error Handling',
        description: 'All async operations must have proper error handling',
        severity: 'ERROR',
        pattern: 'error-handling'
      },
      {
        id: 'RULE-007',
        name: 'Authentication Required',
        description: 'All non-public routes must require authentication',
        severity: 'ERROR',
        pattern: 'auth-required'
      },
      {
        id: 'RULE-008',
        name: 'Input Sanitization',
        description: 'All user inputs must be sanitized before processing',
        severity: 'ERROR',
        pattern: 'input-sanitization'
      }
    ];
  }
  
  _validateBlueprint(blueprint) {
    const issues = [];
    
    // Check required sections
    const requiredSections = ['components', 'layers', 'security', 'dataFlow'];
    for (const section of requiredSections) {
      if (!blueprint[section]) {
        issues.push({ severity: 'ERROR', message: `Missing required section: ${section}` });
      }
    }
    
    // Check component completeness
    if (blueprint.components) {
      if (!blueprint.components.backend) {
        issues.push({ severity: 'ERROR', message: 'Backend component is required' });
      }
    }
    
    return {
      valid: issues.filter(i => i.severity === 'ERROR').length === 0,
      issues
    };
  }
  
  _identifyComponent(filePath, blueprint) {
    if (filePath.includes('/backend/') || filePath.includes('\\backend\\')) {
      return 'backend';
    }
    if (filePath.includes('/admin/') || filePath.includes('\\admin\\')) {
      return 'admin';
    }
    if (filePath.includes('/users-app/') || filePath.includes('\\users-app\\')) {
      return 'mobile.users';
    }
    if (filePath.includes('/drivers-app/') || filePath.includes('\\drivers-app\\')) {
      return 'mobile.drivers';
    }
    return null;
  }
  
  _checkLayerViolations(filePath, content, blueprint, component) {
    const violations = [];
    
    // Check if controller imports from database directly
    if (filePath.includes('/controllers/')) {
      if (content.includes('mongoose.model') || content.includes('require(\'../models')) {
        violations.push({
          id: `LAYER-${Date.now()}`,
          type: 'LAYER_VIOLATION',
          severity: 'ERROR',
          message: 'Controller should not import models directly. Use services instead.',
          rule: 'RULE-002',
          filePath,
          line: this._findLineNumber(content, 'models')
        });
      }
    }
    
    return violations;
  }
  
  _checkBoundaryViolations(filePath, content, blueprint, component) {
    const violations = [];
    
    // Check for cross-context direct database access
    const contexts = blueprint.boundaries?.contexts || [];
    for (const context of contexts) {
      // Implementation would check for imports across contexts
    }
    
    return violations;
  }
  
  _checkPatternCompliance(filePath, content, blueprint) {
    const violations = [];
    
    // Check for async/await error handling
    if (content.includes('async ') && !content.includes('try') && !content.includes('catch')) {
      violations.push({
        id: `PATTERN-${Date.now()}`,
        type: 'PATTERN_VIOLATION',
        severity: 'WARNING',
        message: 'Async function without try-catch error handling',
        rule: 'RULE-006',
        filePath
      });
    }
    
    return violations;
  }
  
  _checkDependencyDirection(filePath, content, blueprint, component) {
    const violations = [];
    
    // Infrastructure should not import from Presentation
    if (filePath.includes('/infrastructure/') || filePath.includes('/services/')) {
      if (content.includes('require(\'../controllers') || content.includes('from \'../controllers')) {
        violations.push({
          id: `DEP-${Date.now()}`,
          type: 'DEPENDENCY_VIOLATION',
          severity: 'ERROR',
          message: 'Service/Infrastructure layer cannot depend on Controllers (Presentation)',
          rule: 'RULE-001',
          filePath
        });
      }
    }
    
    return violations;
  }
  
  _extractBackendFeatures(requirements) {
    return requirements.features?.backend || [
      'User authentication & authorization',
      'CRUD operations for core entities',
      'Real-time communication (WebSocket)',
      'File upload handling',
      'Payment integration',
      'Push notifications'
    ];
  }
  
  _extractAdminFeatures(requirements) {
    return requirements.features?.admin || [
      'Dashboard with analytics',
      'User management',
      'Driver management',
      'Ride monitoring',
      'Reports & exports',
      'Settings & configuration'
    ];
  }
  
  _extractUsersFeatures(requirements) {
    return requirements.features?.users || [
      'User registration & login',
      'Profile management',
      'Ride booking',
      'Real-time tracking',
      'Payment methods',
      'Ride history',
      'Ratings & reviews'
    ];
  }
  
  _extractDriversFeatures(requirements) {
    return requirements.features?.drivers || [
      'Driver registration & verification',
      'Availability toggle',
      'Ride requests',
      'Navigation integration',
      'Earnings dashboard',
      'Document management'
    ];
  }
  
  _assessComplexity(requirements) {
    const features = requirements.features || {};
    const totalFeatures = Object.values(features).flat().length;
    
    if (totalFeatures > 50) return 'high';
    if (totalFeatures > 20) return 'medium';
    return 'low';
  }
  
  _incrementVersion(version) {
    const parts = version.split('.').map(Number);
    parts[2]++; // Increment patch version
    return parts.join('.');
  }
  
  _findLineNumber(content, searchTerm) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchTerm)) {
        return i + 1;
      }
    }
    return null;
  }
  
  _initializeTemplates() {
    return {
      [ArchitecturalPatterns.LAYERED]: {
        layers: ['presentation', 'business', 'data'],
        rules: ['strict-layer-access']
      },
      [ArchitecturalPatterns.CLEAN_ARCHITECTURE]: {
        layers: ['entities', 'use-cases', 'interface-adapters', 'frameworks'],
        rules: ['dependency-inversion', 'interface-segregation']
      }
    };
  }
  
  _initializeRules() {
    return {
      'layer-dependency': (filePath, content) => {
        // Rule implementation
      },
      'controller-no-db': (filePath, content) => {
        return filePath.includes('controller') && content.includes('mongoose');
      }
    };
  }
}

export { BlueprintGenerator, ArchitecturalPatterns, ComponentTypes, SystemLayers };
export default BlueprintGenerator;
