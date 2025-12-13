import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('BackendDigest');

/**
 * BackendDigest - Generates backend code generation instructions from parsed documentation
 *
 * Takes parsed documentation from:
 * - API Parser (endpoints, models, security)
 * - Architecture Parser (layers, components, patterns)
 * - Feature Parser (requirements, business rules)
 *
 * Generates:
 * - Express.js route implementations
 * - Controller methods
 * - Service layer code
 * - Model definitions
 * - Middleware configurations
 * - Database schemas
 */
class BackendDigest {
  constructor() {
    this.logger = createLogger('BackendDigest');
  }

  /**
   * Generate complete backend digest from parsed documentation
   *
   * @param {Object} params - Parsed documentation
   * @param {Object} params.api - Parsed API documentation
   * @param {Object} params.architecture - Parsed architecture documentation
   * @param {Object} params.features - Parsed feature documentation
   * @returns {Object} Backend code generation digest
   */
  generate({ api, architecture, features }) {
    this.logger.info('Generating backend digest...');

    const digest = {
      platform: 'backend',
      framework: 'express',
      generatedAt: new Date().toISOString(),

      // Code generation instructions
      routes: [],
      controllers: [],
      services: [],
      models: [],
      middleware: [],
      validators: [],
      database: {},

      // Configuration
      dependencies: new Set(),
      environment: {},

      // Implementation guidance
      patterns: [],
      bestPractices: []
    };

    // Process API documentation
    if (api) {
      this.processAPI(api, digest);
    }

    // Process architecture documentation
    if (architecture) {
      this.processArchitecture(architecture, digest);
    }

    // Process feature documentation
    if (features) {
      this.processFeatures(features, digest);
    }

    // Convert Sets to Arrays for JSON serialization
    digest.dependencies = Array.from(digest.dependencies);

    this.logger.info(
      `Generated backend digest: ${digest.routes.length} routes, ` +
      `${digest.controllers.length} controllers, ${digest.models.length} models`
    );

    return digest;
  }

  /**
   * Process API documentation to generate routes and controllers
   */
  processAPI(api, digest) {
    if (!api.endpoints) return;

    // Group endpoints by resource
    const endpointsByResource = this.groupEndpointsByResource(api.endpoints);

    for (const [resource, endpoints] of Object.entries(endpointsByResource)) {
      // Generate route file
      digest.routes.push({
        resource,
        path: `/api/${resource}`,
        file: `routes/${resource}.routes.js`,
        endpoints: endpoints.map(e => ({
          method: e.method.toLowerCase(),
          path: e.path,
          handler: `${resource}Controller.${this.getHandlerName(e)}`,
          middleware: this.getMiddleware(e),
          validation: this.getValidation(e)
        }))
      });

      // Generate controller
      digest.controllers.push({
        name: `${this.capitalize(resource)}Controller`,
        file: `controllers/${resource}.controller.js`,
        methods: endpoints.map(e => ({
          name: this.getHandlerName(e),
          httpMethod: e.method,
          path: e.path,
          description: e.description || e.summary,
          parameters: e.parameters || [],
          requestBody: e.requestBody,
          responses: e.responses,
          implementation: this.generateControllerImplementation(e, resource)
        }))
      });

      // Generate service if needed
      const serviceMethods = this.extractServiceMethods(endpoints, resource);
      if (serviceMethods.length > 0) {
        digest.services.push({
          name: `${this.capitalize(resource)}Service`,
          file: `services/${resource}.service.js`,
          methods: serviceMethods
        });
      }
    }

    // Extract models from API schemas
    if (api.models) {
      for (const model of api.models) {
        digest.models.push({
          name: model.name,
          file: `models/${model.name}.model.js`,
          type: 'mongoose',
          schema: this.convertToMongooseSchema(model),
          validation: this.generateModelValidation(model)
        });
      }
    }

    // Add authentication middleware
    if (api.security && api.security.length > 0) {
      for (const scheme of api.security) {
        digest.middleware.push({
          name: `${scheme.name}Auth`,
          file: 'middleware/auth.middleware.js',
          type: scheme.type,
          description: scheme.description,
          implementation: this.generateAuthMiddleware(scheme)
        });
      }
    }

    // Add required dependencies
    digest.dependencies.add('express');
    if (digest.models.length > 0) {
      digest.dependencies.add('mongoose');
    }
  }

  /**
   * Process architecture documentation
   */
  processArchitecture(architecture, digest) {
    // Extract patterns to implement
    if (architecture.patterns) {
      for (const pattern of architecture.patterns) {
        digest.patterns.push({
          name: pattern.name,
          context: pattern.context,
          implementation: this.getPatternImplementation(pattern.name)
        });
      }
    }

    // Extract technology stack
    if (architecture.technologies) {
      if (architecture.technologies.backend) {
        for (const tech of architecture.technologies.backend) {
          if (tech.name && tech.name !== 'Node.js' && tech.name !== 'Express') {
            digest.dependencies.add(tech.name.toLowerCase().replace(/\s+/g, '-'));
          }
        }
      }

      if (architecture.technologies.database) {
        for (const tech of architecture.technologies.database) {
          digest.database.type = tech.name.toLowerCase();
          digest.dependencies.add(tech.name === 'PostgreSQL' ? 'pg' : tech.name.toLowerCase());
        }
      }
    }

    // Extract components and map to services
    if (architecture.components) {
      for (const component of architecture.components) {
        if (component.type === 'service' && !digest.services.find(s => s.name === component.name)) {
          digest.services.push({
            name: component.name,
            file: `services/${component.name.toLowerCase()}.service.js`,
            description: component.description,
            responsibilities: component.responsibilities || [],
            methods: []
          });
        }
      }
    }
  }

  /**
   * Process feature documentation
   */
  processFeatures(features, digest) {
    // Extract business rules for validation
    if (features.businessRules) {
      for (const rule of features.businessRules) {
        digest.validators.push({
          name: this.getRuleValidatorName(rule),
          rule: rule,
          implementation: this.generateRuleValidator(rule)
        });
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
   * Group endpoints by resource
   */
  groupEndpointsByResource(endpoints) {
    const grouped = {};

    for (const endpoint of endpoints) {
      // Extract resource from path (e.g., /api/users -> users)
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
   * Generate handler name from endpoint
   */
  getHandlerName(endpoint) {
    const method = endpoint.method.toLowerCase();
    const pathParts = endpoint.path.split('/').filter(p => p && p !== 'api');

    // Handle parameterized paths
    const resource = pathParts[0];
    const hasParam = endpoint.path.includes(':id') || endpoint.path.includes('{id}');

    if (method === 'get' && hasParam) {
      return `get${this.capitalize(resource)}ById`;
    } else if (method === 'get') {
      return `getAll${this.capitalize(resource)}`;
    } else if (method === 'post') {
      return `create${this.capitalize(resource)}`;
    } else if (method === 'put' || method === 'patch') {
      return `update${this.capitalize(resource)}`;
    } else if (method === 'delete') {
      return `delete${this.capitalize(resource)}`;
    }

    return `${method}${this.capitalize(resource)}`;
  }

  /**
   * Get middleware for endpoint
   */
  getMiddleware(endpoint) {
    const middleware = [];

    // Add authentication if required
    if (endpoint.security && endpoint.security.length > 0) {
      middleware.push('authenticate');
    }

    // Add validation
    middleware.push('validate');

    return middleware;
  }

  /**
   * Get validation for endpoint
   */
  getValidation(endpoint) {
    const validation = {
      params: [],
      query: [],
      body: null
    };

    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        if (param.in === 'path') {
          validation.params.push({
            name: param.name,
            type: param.schema?.type || 'string',
            required: param.required
          });
        } else if (param.in === 'query') {
          validation.query.push({
            name: param.name,
            type: param.schema?.type || 'string',
            required: param.required
          });
        }
      }
    }

    if (endpoint.requestBody) {
      validation.body = endpoint.requestBody.schema;
    }

    return validation;
  }

  /**
   * Generate controller implementation guidance
   */
  generateControllerImplementation(endpoint, resource) {
    const method = endpoint.method.toLowerCase();
    const handlerName = this.getHandlerName(endpoint);

    return {
      steps: [
        'Extract parameters from request',
        `Call ${this.capitalize(resource)}Service.${handlerName}`,
        'Handle service response',
        'Return appropriate HTTP status and data',
        'Handle errors with proper error middleware'
      ],
      errorHandling: [
        'ValidationError -> 400',
        'NotFoundError -> 404',
        'AuthenticationError -> 401',
        'AuthorizationError -> 403',
        'ServerError -> 500'
      ],
      example: this.generateControllerExample(endpoint, resource, handlerName)
    };
  }

  /**
   * Generate controller code example
   */
  generateControllerExample(endpoint, resource, handlerName) {
    return `
async ${handlerName}(req, res, next) {
  try {
    const result = await ${this.capitalize(resource)}Service.${handlerName}(req.params, req.query, req.body);
    res.status(${endpoint.method === 'POST' ? '201' : '200'}).json(result);
  } catch (error) {
    next(error);
  }
}`.trim();
  }

  /**
   * Extract service methods from endpoints
   */
  extractServiceMethods(endpoints, resource) {
    return endpoints.map(e => ({
      name: this.getHandlerName(e),
      description: e.description || e.summary,
      parameters: this.extractMethodParameters(e),
      returnType: this.getReturnType(e),
      implementation: {
        steps: this.generateServiceSteps(e, resource),
        databaseOperations: this.getDatabaseOperations(e, resource)
      }
    }));
  }

  /**
   * Extract method parameters
   */
  extractMethodParameters(endpoint) {
    const params = [];

    if (endpoint.parameters) {
      for (const param of endpoint.parameters) {
        if (param.in === 'path' || param.in === 'query') {
          params.push({
            name: param.name,
            type: param.schema?.type || 'string',
            required: param.required
          });
        }
      }
    }

    if (endpoint.requestBody) {
      params.push({
        name: 'data',
        type: 'object',
        required: endpoint.requestBody.required
      });
    }

    return params;
  }

  /**
   * Get return type from responses
   */
  getReturnType(endpoint) {
    if (endpoint.responses && endpoint.responses['200']) {
      return endpoint.responses['200'].schema || 'object';
    }
    return 'object';
  }

  /**
   * Generate service implementation steps
   */
  generateServiceSteps(endpoint, resource) {
    const method = endpoint.method.toLowerCase();
    const steps = [];

    if (method === 'get' && endpoint.path.includes(':id')) {
      steps.push(`Find ${resource} by ID in database`);
      steps.push('Throw NotFoundError if not found');
      steps.push(`Return ${resource} data`);
    } else if (method === 'get') {
      steps.push(`Query all ${resource} from database`);
      steps.push('Apply pagination and filtering');
      steps.push(`Return ${resource} list with metadata`);
    } else if (method === 'post') {
      steps.push('Validate input data');
      steps.push(`Create new ${resource} in database`);
      steps.push(`Return created ${resource}`);
    } else if (method === 'put' || method === 'patch') {
      steps.push(`Find ${resource} by ID`);
      steps.push('Validate update data');
      steps.push(`Update ${resource} in database`);
      steps.push(`Return updated ${resource}`);
    } else if (method === 'delete') {
      steps.push(`Find ${resource} by ID`);
      steps.push(`Delete ${resource} from database`);
      steps.push('Return success response');
    }

    return steps;
  }

  /**
   * Get database operations
   */
  getDatabaseOperations(endpoint, resource) {
    const method = endpoint.method.toLowerCase();

    if (method === 'get' && endpoint.path.includes(':id')) {
      return [`${this.capitalize(resource)}.findById(id)`];
    } else if (method === 'get') {
      return [`${this.capitalize(resource)}.find(query).limit(limit).skip(offset)`];
    } else if (method === 'post') {
      return [`${this.capitalize(resource)}.create(data)`];
    } else if (method === 'put' || method === 'patch') {
      return [`${this.capitalize(resource)}.findByIdAndUpdate(id, data, { new: true })`];
    } else if (method === 'delete') {
      return [`${this.capitalize(resource)}.findByIdAndDelete(id)`];
    }

    return [];
  }

  /**
   * Convert API schema to Mongoose schema
   */
  convertToMongooseSchema(model) {
    const schema = {};

    if (model.properties) {
      for (const [name, prop] of Object.entries(model.properties)) {
        schema[name] = {
          type: this.mapTypeToMongoose(prop.type),
          required: model.required?.includes(name) || false,
          description: prop.description
        };
      }
    }

    return schema;
  }

  /**
   * Map OpenAPI type to Mongoose type
   */
  mapTypeToMongoose(type) {
    const typeMap = {
      'string': 'String',
      'number': 'Number',
      'integer': 'Number',
      'boolean': 'Boolean',
      'array': 'Array',
      'object': 'Object'
    };

    return typeMap[type] || 'Mixed';
  }

  /**
   * Generate model validation
   */
  generateModelValidation(model) {
    const validations = [];

    if (model.required) {
      validations.push({
        field: 'required',
        fields: model.required
      });
    }

    return validations;
  }

  /**
   * Generate authentication middleware
   */
  generateAuthMiddleware(scheme) {
    if (scheme.type === 'http' && scheme.scheme === 'bearer') {
      return {
        type: 'JWT',
        implementation: 'Verify JWT token from Authorization header',
        steps: [
          'Extract token from Authorization header',
          'Verify token using JWT library',
          'Attach user data to request object',
          'Call next() on success',
          'Return 401 on failure'
        ]
      };
    }

    return {
      type: scheme.type,
      implementation: 'Custom authentication logic needed'
    };
  }

  /**
   * Get pattern implementation guidance
   */
  getPatternImplementation(patternName) {
    const implementations = {
      'repository pattern': {
        description: 'Implement repository layer for data access abstraction',
        files: ['repositories/base.repository.js', 'repositories/*.repository.js'],
        example: 'Create repository classes that wrap database operations'
      },
      'singleton': {
        description: 'Use singleton pattern for shared services',
        example: 'Export single instance of database connection, logger, etc.'
      },
      'factory pattern': {
        description: 'Implement factory for creating model instances',
        example: 'Use factory functions for complex object creation'
      },
      'middleware pattern': {
        description: 'Express middleware for cross-cutting concerns',
        example: 'Authentication, logging, error handling as middleware'
      }
    };

    return implementations[patternName.toLowerCase()] || {
      description: `Implement ${patternName} pattern`,
      example: 'Follow standard pattern guidelines'
    };
  }

  /**
   * Get rule validator name
   */
  getRuleValidatorName(rule) {
    // Extract key words from rule to create validator name
    const words = rule.toLowerCase().match(/\b\w+\b/g) || [];
    return `validate${words.slice(0, 3).map(w => this.capitalize(w)).join('')}`;
  }

  /**
   * Generate rule validator
   */
  generateRuleValidator(rule) {
    return {
      rule: rule,
      implementation: 'Custom validation logic based on business rule',
      usage: 'Use in request validation middleware or service layer'
    };
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
 * Get singleton instance of BackendDigest
 * @returns {BackendDigest}
 */
export function getBackendDigest() {
  if (!instance) {
    instance = new BackendDigest();
  }
  return instance;
}

export { BackendDigest };
export default BackendDigest;
