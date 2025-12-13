/**
 * Minions - API Contract Manager
 * ==============================
 * Defines, manages, and enforces API contracts between system components.
 * Ensures Frontend and Backend agents agree on interfaces before implementation.
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';

// HTTP Methods
const HttpMethods = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE'
};

// Response Status Categories
const StatusCategories = {
  SUCCESS: [200, 201, 204],
  CLIENT_ERROR: [400, 401, 403, 404, 409, 422],
  SERVER_ERROR: [500, 502, 503]
};

class ApiContractManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    
    // Store contracts
    this.contracts = new Map();
    
    // Contract version tracking
    this.versions = new Map();
    
    // Breaking change history
    this.breakingChanges = [];
  }
  
  /**
   * Generate API contracts from blueprint
   */
  async generateContracts(blueprint) {
    const contracts = [];
    
    // Generate contracts for each bounded context
    const contexts = blueprint.boundaries?.contexts || [];
    
    for (const context of contexts) {
      const contract = await this._generateContextContract(context, blueprint);
      contracts.push(contract);
      this.contracts.set(contract.name, contract);
    }
    
    // Generate shared contracts
    const sharedContract = this._generateSharedContract(blueprint);
    contracts.push(sharedContract);
    this.contracts.set(sharedContract.name, sharedContract);
    
    // Generate authentication contract
    const authContract = this._generateAuthContract(blueprint);
    contracts.push(authContract);
    this.contracts.set(authContract.name, authContract);
    
    return contracts;
  }
  
  /**
   * Validate code against API contracts
   */
  async validateCompliance(filePath, content) {
    const violations = [];
    
    // Check if this is a route file
    if (this._isRouteFile(filePath)) {
      const routeViolations = await this._validateRoutes(filePath, content);
      violations.push(...routeViolations);
    }
    
    // Check if this is a service file making API calls
    if (this._isApiConsumer(filePath)) {
      const consumerViolations = await this._validateApiConsumer(filePath, content);
      violations.push(...consumerViolations);
    }
    
    // Check response structure compliance
    if (this._isControllerFile(filePath)) {
      const responseViolations = await this._validateResponseStructure(filePath, content);
      violations.push(...responseViolations);
    }
    
    return violations;
  }
  
  /**
   * Get contract for specific endpoint
   */
  getEndpointContract(path, method) {
    for (const [name, contract] of this.contracts) {
      const endpoint = contract.endpoints?.find(
        e => e.path === path && e.method === method
      );
      if (endpoint) {
        return { contract: name, endpoint };
      }
    }
    return null;
  }
  
  /**
   * Check if a change is breaking
   */
  async checkBreakingChange(oldContract, newContract) {
    const breakingChanges = [];
    
    // Check removed endpoints
    for (const oldEndpoint of oldContract.endpoints || []) {
      const exists = (newContract.endpoints || []).find(
        e => e.path === oldEndpoint.path && e.method === oldEndpoint.method
      );
      if (!exists) {
        breakingChanges.push({
          type: 'ENDPOINT_REMOVED',
          severity: 'BREAKING',
          endpoint: `${oldEndpoint.method} ${oldEndpoint.path}`,
          message: 'Endpoint was removed'
        });
      }
    }
    
    // Check changed request schemas
    for (const newEndpoint of newContract.endpoints || []) {
      const oldEndpoint = (oldContract.endpoints || []).find(
        e => e.path === newEndpoint.path && e.method === newEndpoint.method
      );
      
      if (oldEndpoint) {
        // Check required fields added
        const reqChanges = this._checkSchemaBreakingChanges(
          oldEndpoint.request?.body,
          newEndpoint.request?.body
        );
        breakingChanges.push(...reqChanges.map(c => ({
          ...c,
          endpoint: `${newEndpoint.method} ${newEndpoint.path}`
        })));
        
        // Check response structure changes
        const resChanges = this._checkResponseBreakingChanges(
          oldEndpoint.response,
          newEndpoint.response
        );
        breakingChanges.push(...resChanges.map(c => ({
          ...c,
          endpoint: `${newEndpoint.method} ${newEndpoint.path}`
        })));
      }
    }
    
    if (breakingChanges.length > 0) {
      this.breakingChanges.push({
        timestamp: new Date().toISOString(),
        contractName: newContract.name,
        changes: breakingChanges
      });
    }
    
    return {
      hasBreakingChanges: breakingChanges.length > 0,
      changes: breakingChanges
    };
  }
  
  /**
   * Generate OpenAPI specification from contracts
   */
  generateOpenApiSpec(contracts = null) {
    const contractsToUse = contracts || Array.from(this.contracts.values());
    
    const spec = {
      openapi: '3.0.3',
      info: {
        title: 'Minions API',
        description: 'Auto-generated API specification by Architect-Agent',
        version: '1.0.0'
      },
      servers: [
        { url: 'http://localhost:3000/api/v1', description: 'Development' },
        { url: 'https://api.minions.app/v1', description: 'Production' }
      ],
      paths: {},
      components: {
        schemas: {},
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT'
          }
        }
      },
      tags: []
    };
    
    // Add paths from all contracts
    for (const contract of contractsToUse) {
      // Add tag for this contract
      spec.tags.push({
        name: contract.name,
        description: contract.description
      });
      
      // Add endpoints
      for (const endpoint of contract.endpoints || []) {
        const pathKey = endpoint.path;
        if (!spec.paths[pathKey]) {
          spec.paths[pathKey] = {};
        }
        
        spec.paths[pathKey][endpoint.method.toLowerCase()] = {
          tags: [contract.name],
          summary: endpoint.summary,
          description: endpoint.description,
          operationId: endpoint.operationId,
          security: endpoint.auth ? [{ bearerAuth: [] }] : [],
          parameters: this._convertParameters(endpoint.request?.params, endpoint.request?.query),
          requestBody: this._convertRequestBody(endpoint.request?.body),
          responses: this._convertResponses(endpoint.response)
        };
      }
      
      // Add schemas
      for (const [schemaName, schema] of Object.entries(contract.schemas || {})) {
        spec.components.schemas[schemaName] = schema;
      }
    }
    
    return spec;
  }
  
  /**
   * Get contract version history
   */
  getVersionHistory(contractName) {
    return this.versions.get(contractName) || [];
  }
  
  /**
   * Get breaking changes history
   */
  getBreakingChanges() {
    return [...this.breakingChanges];
  }
  
  // ==================== Private Methods ====================
  
  async _generateContextContract(context, blueprint) {
    const contract = {
      name: context.name.replace(/\s+/g, ''),
      displayName: context.name,
      description: `API contract for ${context.name} context`,
      version: '1.0.0',
      owner: context.owner,
      baseUrl: `/api/v1/${context.name.toLowerCase().replace(/\s+/g, '-')}`,
      endpoints: [],
      schemas: {},
      events: []
    };
    
    // Generate endpoints based on entities
    for (const entity of context.entities || []) {
      const endpoints = this._generateCrudEndpoints(entity, contract.baseUrl);
      contract.endpoints.push(...endpoints);
      
      // Generate schemas
      const schemas = this._generateEntitySchemas(entity);
      Object.assign(contract.schemas, schemas);
    }
    
    // Add events based on boundaries
    if (context.boundaries?.exposes) {
      for (const service of context.boundaries.exposes) {
        contract.events.push({
          name: `${service}:updated`,
          payload: { entityId: 'string', changes: 'object' }
        });
      }
    }
    
    return contract;
  }
  
  _generateSharedContract(blueprint) {
    return {
      name: 'Shared',
      displayName: 'Shared APIs',
      description: 'Shared API contracts used across all contexts',
      version: '1.0.0',
      baseUrl: '/api/v1',
      endpoints: [
        {
          path: '/health',
          method: HttpMethods.GET,
          summary: 'Health Check',
          description: 'Check API health status',
          operationId: 'healthCheck',
          auth: false,
          request: {},
          response: {
            200: {
              description: 'API is healthy',
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                  timestamp: { type: 'string', format: 'date-time' },
                  version: { type: 'string' },
                  services: {
                    type: 'object',
                    properties: {
                      database: { type: 'string' },
                      redis: { type: 'string' },
                      external: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        {
          path: '/version',
          method: HttpMethods.GET,
          summary: 'API Version',
          description: 'Get current API version information',
          operationId: 'getVersion',
          auth: false,
          request: {},
          response: {
            200: {
              description: 'Version information',
              schema: {
                type: 'object',
                properties: {
                  version: { type: 'string' },
                  build: { type: 'string' },
                  environment: { type: 'string' }
                }
              }
            }
          }
        }
      ],
      schemas: {
        Error: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: {} },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer' },
                limit: { type: 'integer' },
                total: { type: 'integer' },
                totalPages: { type: 'integer' }
              }
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
          }
        }
      }
    };
  }
  
  _generateAuthContract(blueprint) {
    const security = blueprint.security || {};
    
    return {
      name: 'Authentication',
      displayName: 'Authentication APIs',
      description: 'Authentication and authorization endpoints',
      version: '1.0.0',
      baseUrl: '/api/v1/auth',
      endpoints: [
        {
          path: '/register',
          method: HttpMethods.POST,
          summary: 'Register User',
          description: 'Create a new user account',
          operationId: 'registerUser',
          auth: false,
          request: {
            body: {
              type: 'object',
              required: ['email', 'password', 'name'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string', minLength: 8 },
                name: { type: 'string', minLength: 2 },
                phone: { type: 'string' }
              }
            }
          },
          response: {
            201: {
              description: 'User registered successfully',
              schema: { $ref: '#/components/schemas/AuthResponse' }
            },
            400: {
              description: 'Validation error',
              schema: { $ref: '#/components/schemas/Error' }
            },
            409: {
              description: 'User already exists',
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        {
          path: '/login',
          method: HttpMethods.POST,
          summary: 'Login',
          description: 'Authenticate user and receive tokens',
          operationId: 'loginUser',
          auth: false,
          request: {
            body: {
              type: 'object',
              required: ['email', 'password'],
              properties: {
                email: { type: 'string', format: 'email' },
                password: { type: 'string' }
              }
            }
          },
          response: {
            200: {
              description: 'Login successful',
              schema: { $ref: '#/components/schemas/AuthResponse' }
            },
            401: {
              description: 'Invalid credentials',
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        {
          path: '/refresh',
          method: HttpMethods.POST,
          summary: 'Refresh Token',
          description: 'Get new access token using refresh token',
          operationId: 'refreshToken',
          auth: false,
          request: {
            body: {
              type: 'object',
              required: ['refreshToken'],
              properties: {
                refreshToken: { type: 'string' }
              }
            }
          },
          response: {
            200: {
              description: 'Token refreshed',
              schema: { $ref: '#/components/schemas/TokenResponse' }
            },
            401: {
              description: 'Invalid refresh token',
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        {
          path: '/logout',
          method: HttpMethods.POST,
          summary: 'Logout',
          description: 'Invalidate current session',
          operationId: 'logoutUser',
          auth: true,
          request: {},
          response: {
            200: {
              description: 'Logged out successfully',
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            }
          }
        },
        {
          path: '/me',
          method: HttpMethods.GET,
          summary: 'Get Current User',
          description: 'Get authenticated user profile',
          operationId: 'getCurrentUser',
          auth: true,
          request: {},
          response: {
            200: {
              description: 'Current user data',
              schema: { $ref: '#/components/schemas/User' }
            },
            401: {
              description: 'Unauthorized',
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        {
          path: '/password/forgot',
          method: HttpMethods.POST,
          summary: 'Forgot Password',
          description: 'Request password reset email',
          operationId: 'forgotPassword',
          auth: false,
          request: {
            body: {
              type: 'object',
              required: ['email'],
              properties: {
                email: { type: 'string', format: 'email' }
              }
            }
          },
          response: {
            200: {
              description: 'Reset email sent',
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            }
          }
        },
        {
          path: '/password/reset',
          method: HttpMethods.POST,
          summary: 'Reset Password',
          description: 'Reset password with token',
          operationId: 'resetPassword',
          auth: false,
          request: {
            body: {
              type: 'object',
              required: ['token', 'password'],
              properties: {
                token: { type: 'string' },
                password: { type: 'string', minLength: 8 }
              }
            }
          },
          response: {
            200: {
              description: 'Password reset successful',
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            },
            400: {
              description: 'Invalid or expired token',
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      ],
      schemas: {
        AuthResponse: {
          type: 'object',
          properties: {
            user: { $ref: '#/components/schemas/User' },
            tokens: { $ref: '#/components/schemas/TokenResponse' }
          }
        },
        TokenResponse: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'integer' }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            name: { type: 'string' },
            phone: { type: 'string' },
            role: { type: 'string', enum: ['user', 'driver', 'admin'] },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        }
      }
    };
  }
  
  _generateCrudEndpoints(entity, baseUrl) {
    const entityLower = entity.toLowerCase();
    const entityPlural = entityLower + 's';
    
    return [
      {
        path: `${baseUrl}/${entityPlural}`,
        method: HttpMethods.GET,
        summary: `List ${entity}s`,
        description: `Get paginated list of ${entityLower}s`,
        operationId: `list${entity}s`,
        auth: true,
        request: {
          query: {
            page: { type: 'integer', default: 1 },
            limit: { type: 'integer', default: 20 },
            sort: { type: 'string' },
            search: { type: 'string' }
          }
        },
        response: {
          200: {
            description: `List of ${entityLower}s`,
            schema: { $ref: '#/components/schemas/PaginatedResponse' }
          }
        }
      },
      {
        path: `${baseUrl}/${entityPlural}`,
        method: HttpMethods.POST,
        summary: `Create ${entity}`,
        description: `Create a new ${entityLower}`,
        operationId: `create${entity}`,
        auth: true,
        request: {
          body: { $ref: `#/components/schemas/${entity}Create` }
        },
        response: {
          201: {
            description: `${entity} created`,
            schema: { $ref: `#/components/schemas/${entity}` }
          },
          400: {
            description: 'Validation error',
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      {
        path: `${baseUrl}/${entityPlural}/{id}`,
        method: HttpMethods.GET,
        summary: `Get ${entity}`,
        description: `Get a single ${entityLower} by ID`,
        operationId: `get${entity}`,
        auth: true,
        request: {
          params: {
            id: { type: 'string', required: true }
          }
        },
        response: {
          200: {
            description: `${entity} details`,
            schema: { $ref: `#/components/schemas/${entity}` }
          },
          404: {
            description: `${entity} not found`,
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      {
        path: `${baseUrl}/${entityPlural}/{id}`,
        method: HttpMethods.PUT,
        summary: `Update ${entity}`,
        description: `Update an existing ${entityLower}`,
        operationId: `update${entity}`,
        auth: true,
        request: {
          params: {
            id: { type: 'string', required: true }
          },
          body: { $ref: `#/components/schemas/${entity}Update` }
        },
        response: {
          200: {
            description: `${entity} updated`,
            schema: { $ref: `#/components/schemas/${entity}` }
          },
          404: {
            description: `${entity} not found`,
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      },
      {
        path: `${baseUrl}/${entityPlural}/{id}`,
        method: HttpMethods.DELETE,
        summary: `Delete ${entity}`,
        description: `Delete a ${entityLower}`,
        operationId: `delete${entity}`,
        auth: true,
        request: {
          params: {
            id: { type: 'string', required: true }
          }
        },
        response: {
          200: {
            description: `${entity} deleted`,
            schema: { $ref: '#/components/schemas/SuccessResponse' }
          },
          404: {
            description: `${entity} not found`,
            schema: { $ref: '#/components/schemas/Error' }
          }
        }
      }
    ];
  }
  
  _generateEntitySchemas(entity) {
    return {
      [entity]: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      [`${entity}Create`]: {
        type: 'object',
        required: [],
        properties: {}
      },
      [`${entity}Update`]: {
        type: 'object',
        properties: {}
      }
    };
  }
  
  _isRouteFile(filePath) {
    return filePath.includes('/routes/') || 
           filePath.includes('\\routes\\') ||
           filePath.endsWith('.routes.js');
  }
  
  _isApiConsumer(filePath) {
    return (filePath.includes('/services/') && filePath.includes('api')) ||
           filePath.includes('ApiService') ||
           filePath.includes('apiClient');
  }
  
  _isControllerFile(filePath) {
    return filePath.includes('/controllers/') ||
           filePath.includes('\\controllers\\') ||
           filePath.endsWith('.controller.js');
  }
  
  async _validateRoutes(filePath, content) {
    const violations = [];
    
    // Check for versioned API paths
    if (!content.includes('/api/v') && content.includes('router.')) {
      violations.push({
        id: `CONTRACT-${Date.now()}`,
        type: 'CONTRACT_VIOLATION',
        severity: 'WARNING',
        message: 'API routes should be versioned (e.g., /api/v1/...)',
        filePath
      });
    }
    
    // Check for authentication middleware on protected routes
    const routePatterns = content.match(/router\.(get|post|put|patch|delete)\([^)]+\)/g) || [];
    for (const route of routePatterns) {
      if (!route.includes('auth') && !route.includes('public')) {
        // This is a simplified check - real implementation would be more sophisticated
      }
    }
    
    return violations;
  }
  
  async _validateApiConsumer(filePath, content) {
    const violations = [];
    
    // Check for hardcoded URLs
    if (content.match(/https?:\/\/[^'"]+/g)) {
      violations.push({
        id: `CONTRACT-${Date.now()}`,
        type: 'CONTRACT_VIOLATION',
        severity: 'WARNING',
        message: 'Avoid hardcoded URLs. Use configuration or environment variables.',
        filePath
      });
    }
    
    return violations;
  }
  
  async _validateResponseStructure(filePath, content) {
    const violations = [];
    
    // Check for inconsistent response structures
    if (content.includes('res.json') && !content.includes('res.status')) {
      violations.push({
        id: `CONTRACT-${Date.now()}`,
        type: 'CONTRACT_VIOLATION',
        severity: 'INFO',
        message: 'Consider using explicit status codes with responses',
        filePath
      });
    }
    
    return violations;
  }
  
  _checkSchemaBreakingChanges(oldSchema, newSchema) {
    const changes = [];
    
    if (!oldSchema || !newSchema) return changes;
    
    // Check for new required fields
    const oldRequired = oldSchema.required || [];
    const newRequired = newSchema.required || [];
    
    for (const field of newRequired) {
      if (!oldRequired.includes(field)) {
        changes.push({
          type: 'NEW_REQUIRED_FIELD',
          severity: 'BREAKING',
          field,
          message: `New required field '${field}' added to request schema`
        });
      }
    }
    
    // Check for removed fields
    const oldProps = Object.keys(oldSchema.properties || {});
    const newProps = Object.keys(newSchema.properties || {});
    
    for (const prop of oldProps) {
      if (!newProps.includes(prop)) {
        changes.push({
          type: 'FIELD_REMOVED',
          severity: 'BREAKING',
          field: prop,
          message: `Field '${prop}' was removed from schema`
        });
      }
    }
    
    return changes;
  }
  
  _checkResponseBreakingChanges(oldResponse, newResponse) {
    const changes = [];
    
    if (!oldResponse || !newResponse) return changes;
    
    // Check for removed success status codes
    const oldStatuses = Object.keys(oldResponse);
    const newStatuses = Object.keys(newResponse);
    
    for (const status of oldStatuses) {
      if (StatusCategories.SUCCESS.includes(parseInt(status))) {
        if (!newStatuses.includes(status)) {
          changes.push({
            type: 'SUCCESS_STATUS_REMOVED',
            severity: 'BREAKING',
            status,
            message: `Success status code ${status} was removed`
          });
        }
      }
    }
    
    return changes;
  }
  
  _convertParameters(params, query) {
    const parameters = [];
    
    if (params) {
      for (const [name, schema] of Object.entries(params)) {
        parameters.push({
          name,
          in: 'path',
          required: schema.required !== false,
          schema: { type: schema.type || 'string' }
        });
      }
    }
    
    if (query) {
      for (const [name, schema] of Object.entries(query)) {
        parameters.push({
          name,
          in: 'query',
          required: schema.required === true,
          schema: { type: schema.type || 'string', default: schema.default }
        });
      }
    }
    
    return parameters.length > 0 ? parameters : undefined;
  }
  
  _convertRequestBody(body) {
    if (!body) return undefined;
    
    return {
      required: true,
      content: {
        'application/json': {
          schema: body
        }
      }
    };
  }
  
  _convertResponses(responses) {
    const converted = {};
    
    for (const [status, response] of Object.entries(responses || {})) {
      converted[status] = {
        description: response.description,
        content: response.schema ? {
          'application/json': {
            schema: response.schema
          }
        } : undefined
      };
    }
    
    return converted;
  }
}

export { ApiContractManager, HttpMethods, StatusCategories };
export default ApiContractManager;
