import { createLogger } from '../../../../foundation/common/logger.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

const logger = createLogger('OpenAPIUpdater');

/**
 * OpenAPIUpdater - Automatically updates OpenAPI specifications from code changes
 *
 * Features:
 * - Auto-generate OpenAPI 3.0 specs from parsed code
 * - Update existing specs with code changes
 * - Maintain version compatibility
 * - Add/remove/update endpoints
 * - Update schemas and models
 * - Handle breaking changes with version bumps
 * - Generate request/response schemas
 * - Update security definitions
 *
 * Follows OpenAPI 3.0 specification
 */
class OpenAPIUpdater {
  constructor() {
    this.logger = createLogger('OpenAPIUpdater');
    this.cache = getDocumentCache();
  }

  /**
   * Initialize the updater
   */
  async initialize() {
    if (!this.cache.initialized) {
      await this.cache.initialize();
    }
    this.logger.info('OpenAPIUpdater initialized');
  }

  /**
   * Generate OpenAPI spec from parsed code
   *
   * @param {Object} parsedCode - Parsed backend code structure
   * @param {Object} options - Generation options
   * @returns {Object} OpenAPI 3.0 specification
   */
  generate(parsedCode, options = {}) {
    this.logger.info('Generating OpenAPI specification...');

    const spec = {
      openapi: '3.0.0',
      info: {
        title: options.title || 'API Documentation',
        version: options.version || '1.0.0',
        description: options.description || 'Auto-generated API documentation'
      },
      servers: options.servers || [
        { url: 'http://localhost:3000', description: 'Development server' }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {}
      }
    };

    // Generate paths from routes
    this.generatePaths(parsedCode.routes || [], spec);

    // Generate schemas from models
    this.generateSchemas(parsedCode.models || [], spec);

    // Generate security schemes from middleware
    this.generateSecuritySchemes(parsedCode.middleware || [], spec);

    this.logger.info(
      `Generated OpenAPI spec with ${Object.keys(spec.paths).length} paths, ` +
      `${Object.keys(spec.components.schemas).length} schemas`
    );

    return spec;
  }

  /**
   * Update existing OpenAPI spec with code changes
   *
   * @param {Object} existingSpec - Current OpenAPI specification
   * @param {Object} changes - Changes from BreakingChangeDetector
   * @param {Object} parsedCode - Current parsed code structure
   * @returns {Object} Updated OpenAPI specification
   */
  update(existingSpec, changes, parsedCode) {
    this.logger.info('Updating OpenAPI specification...');

    const updatedSpec = JSON.parse(JSON.stringify(existingSpec)); // Deep clone

    // Apply route changes
    this.applyRouteChanges(changes, parsedCode, updatedSpec);

    // Apply model changes
    this.applyModelChanges(changes, parsedCode, updatedSpec);

    // Update version if breaking changes
    if (changes.breaking && changes.breaking.length > 0) {
      updatedSpec.info.version = this.bumpVersion(existingSpec.info.version, 'major');
    } else if (changes.additions && changes.additions.length > 0) {
      updatedSpec.info.version = this.bumpVersion(existingSpec.info.version, 'minor');
    } else {
      updatedSpec.info.version = this.bumpVersion(existingSpec.info.version, 'patch');
    }

    this.logger.info(
      `Updated OpenAPI spec to version ${updatedSpec.info.version}`
    );

    return updatedSpec;
  }

  /**
   * Generate paths from routes
   */
  generatePaths(routes, spec) {
    for (const route of routes) {
      const path = route.path;
      const method = route.method.toLowerCase();

      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }

      spec.paths[path][method] = {
        summary: `${route.method} ${path}`,
        description: route.description || `${route.method} operation for ${path}`,
        operationId: route.handler || `${method}${this.pathToOperationId(path)}`,
        tags: this.extractTags(path),
        parameters: this.generateParameters(path, route),
        responses: this.generateResponses(route),
        security: this.generateSecurity(route.middleware || [])
      };

      // Add request body for POST/PUT/PATCH
      if (['post', 'put', 'patch'].includes(method)) {
        spec.paths[path][method].requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {}
              }
            }
          }
        };
      }
    }
  }

  /**
   * Generate schemas from models
   */
  generateSchemas(models, spec) {
    for (const model of models) {
      if (model.type === 'schema' && model.fields) {
        const schemaName = model.name.replace('Schema', '');

        spec.components.schemas[schemaName] = {
          type: 'object',
          properties: {},
          required: []
        };

        for (const field of model.fields) {
          spec.components.schemas[schemaName].properties[field.name] = {
            type: this.mapMongooseTypeToOpenAPI(field.type),
            description: field.description || ''
          };

          if (field.required) {
            spec.components.schemas[schemaName].required.push(field.name);
          }
        }

        if (spec.components.schemas[schemaName].required.length === 0) {
          delete spec.components.schemas[schemaName].required;
        }
      }
    }
  }

  /**
   * Generate security schemes from middleware
   */
  generateSecuritySchemes(middleware, spec) {
    const hasAuth = middleware.some(m =>
      m.name.includes('auth') || m.name.includes('authenticate')
    );

    if (hasAuth) {
      spec.components.securitySchemes = {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      };
    }
  }

  /**
   * Apply route changes to spec
   */
  applyRouteChanges(changes, parsedCode, spec) {
    const routeChanges = [
      ...(changes.breaking || []).filter(c => c.category === 'routes'),
      ...(changes.nonBreaking || []).filter(c => c.category === 'routes'),
      ...(changes.additions || []).filter(c => c.category === 'routes')
    ];

    for (const change of routeChanges) {
      if (change.type === 'route_removed' && change.oldValue) {
        // Remove route from spec
        const path = change.oldValue.path;
        const method = change.oldValue.method.toLowerCase();

        if (spec.paths[path] && spec.paths[path][method]) {
          delete spec.paths[path][method];

          // Remove path if no methods left
          if (Object.keys(spec.paths[path]).length === 0) {
            delete spec.paths[path];
          }
        }
      } else if (change.type === 'route_added' && change.newValue) {
        // Add new route
        const route = change.newValue;
        this.generatePaths([route], spec);
      } else if (change.type === 'route_handler_changed' || change.type === 'route_middleware_added') {
        // Update existing route
        const routes = parsedCode.routes || [];
        const route = routes.find(r =>
          r.method === change.newValue?.method && r.path === change.newValue?.path
        );

        if (route) {
          this.generatePaths([route], spec);
        }
      }
    }
  }

  /**
   * Apply model changes to spec
   */
  applyModelChanges(changes, parsedCode, spec) {
    const modelChanges = [
      ...(changes.breaking || []).filter(c => c.category === 'models'),
      ...(changes.additions || []).filter(c => c.category === 'models')
    ];

    for (const change of modelChanges) {
      if (change.type === 'model_removed' && change.oldValue) {
        // Remove schema
        const schemaName = change.oldValue.name.replace('Schema', '');
        delete spec.components.schemas[schemaName];
      } else if (change.type === 'model_added' && change.newValue) {
        // Add new schema
        const model = change.newValue;
        if (model.type === 'schema') {
          this.generateSchemas([model], spec);
        }
      } else if (change.type === 'field_removed') {
        // Remove field from schema
        const schemaName = change.model.replace('Schema', '');
        if (spec.components.schemas[schemaName]) {
          delete spec.components.schemas[schemaName].properties[change.field];

          // Remove from required array
          const required = spec.components.schemas[schemaName].required || [];
          const index = required.indexOf(change.field);
          if (index > -1) {
            required.splice(index, 1);
          }
        }
      } else if (change.type === 'field_added' || change.type === 'required_field_added') {
        // Add field to schema
        const schemaName = change.model.replace('Schema', '');
        const models = parsedCode.models || [];
        const model = models.find(m => m.name === change.model);

        if (model && spec.components.schemas[schemaName]) {
          this.generateSchemas([model], spec);
        }
      } else if (change.type === 'field_type_changed') {
        // Update field type
        const schemaName = change.model.replace('Schema', '');
        if (spec.components.schemas[schemaName]?.properties[change.field]) {
          spec.components.schemas[schemaName].properties[change.field].type =
            this.mapMongooseTypeToOpenAPI(change.newValue.type);
        }
      }
    }
  }

  /**
   * Generate path parameters
   */
  generateParameters(path, route) {
    const parameters = [];
    const paramMatches = path.match(/:(\w+)/g);

    if (paramMatches) {
      for (const param of paramMatches) {
        const paramName = param.substring(1);
        parameters.push({
          name: paramName,
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${paramName} parameter`
        });
      }
    }

    return parameters;
  }

  /**
   * Generate response definitions
   */
  generateResponses(route) {
    return {
      '200': {
        description: 'Successful response',
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      },
      '400': {
        description: 'Bad request'
      },
      '401': {
        description: 'Unauthorized'
      },
      '404': {
        description: 'Not found'
      },
      '500': {
        description: 'Internal server error'
      }
    };
  }

  /**
   * Generate security requirements
   */
  generateSecurity(middleware) {
    const hasAuth = middleware.some(m =>
      m.includes('auth') || m.includes('authenticate')
    );

    return hasAuth ? [{ bearerAuth: [] }] : [];
  }

  /**
   * Extract tags from path
   */
  extractTags(path) {
    const parts = path.split('/').filter(p => p && !p.startsWith(':'));
    return parts.length > 0 ? [parts[0]] : ['default'];
  }

  /**
   * Convert path to operation ID
   */
  pathToOperationId(path) {
    return path
      .replace(/\//g, '_')
      .replace(/:/g, '')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Map Mongoose types to OpenAPI types
   */
  mapMongooseTypeToOpenAPI(mongooseType) {
    const typeMap = {
      String: 'string',
      Number: 'number',
      Integer: 'integer',
      Boolean: 'boolean',
      Date: 'string',
      ObjectId: 'string',
      Array: 'array',
      Object: 'object',
      Mixed: 'object'
    };

    return typeMap[mongooseType] || 'string';
  }

  /**
   * Bump semantic version
   */
  bumpVersion(version, type = 'patch') {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return version;

    let [, major, minor, patch] = match.map(Number);

    switch (type) {
      case 'major':
        major++;
        minor = 0;
        patch = 0;
        break;
      case 'minor':
        minor++;
        patch = 0;
        break;
      case 'patch':
      default:
        patch++;
        break;
    }

    return `${major}.${minor}.${patch}`;
  }

  /**
   * Validate OpenAPI specification
   */
  validate(spec) {
    const errors = [];

    if (!spec.openapi) {
      errors.push('Missing openapi version');
    }

    if (!spec.info || !spec.info.title || !spec.info.version) {
      errors.push('Missing required info fields');
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      errors.push('No paths defined');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Export spec to different formats
   */
  export(spec, format = 'json') {
    switch (format) {
      case 'json':
        return JSON.stringify(spec, null, 2);
      case 'yaml':
        // In real implementation, use yaml library
        return JSON.stringify(spec, null, 2);
      default:
        return JSON.stringify(spec, null, 2);
    }
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of OpenAPIUpdater
 * @returns {OpenAPIUpdater}
 */
export function getOpenAPIUpdater() {
  if (!instance) {
    instance = new OpenAPIUpdater();
  }
  return instance;
}

export { OpenAPIUpdater };
export default OpenAPIUpdater;
