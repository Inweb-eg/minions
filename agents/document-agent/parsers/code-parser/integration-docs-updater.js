import { createLogger } from '../../../../foundation/common/logger.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

const logger = createLogger('IntegrationDocsUpdater');

/**
 * IntegrationDocsUpdater - Automatically updates integration documentation
 *
 * Updates:
 * - API integration guides
 * - Authentication documentation
 * - Request/response examples
 * - Error handling guides
 * - SDK documentation
 * - Migration guides
 * - Deprecation notices
 *
 * Generates:
 * - Code examples for new endpoints
 * - Migration scripts for breaking changes
 * - Authentication flow updates
 * - Version-specific guides
 */
class IntegrationDocsUpdater {
  constructor() {
    this.logger = createLogger('IntegrationDocsUpdater');
    this.cache = getDocumentCache();
  }

  /**
   * Initialize the updater
   */
  async initialize() {
    if (!this.cache.initialized) {
      await this.cache.initialize();
    }
    this.logger.info('IntegrationDocsUpdater initialized');
  }

  /**
   * Update integration documentation based on changes
   *
   * @param {Object} existingDocs - Current integration documentation
   * @param {Object} changes - Changes from BreakingChangeDetector
   * @param {Object} parsedCode - Current parsed code structure
   * @param {Object} options - Update options
   * @returns {Object} Updated integration documentation
   */
  update(existingDocs, changes, parsedCode, options = {}) {
    this.logger.info('Updating integration documentation...');

    const updatedDocs = {
      ...existingDocs,
      lastUpdated: new Date().toISOString(),
      version: options.version || existingDocs.version || '1.0.0',
      sections: {
        ...existingDocs.sections
      },
      changes: [],
      migrations: [],
      deprecations: []
    };

    // Update API integration guides
    this.updateAPIGuides(changes, parsedCode, updatedDocs);

    // Update authentication documentation
    this.updateAuthDocs(changes, parsedCode, updatedDocs);

    // Generate migration guides for breaking changes
    this.generateMigrationGuides(changes, updatedDocs);

    // Add deprecation notices
    this.addDeprecationNotices(changes, updatedDocs);

    // Update code examples
    this.updateCodeExamples(changes, parsedCode, updatedDocs);

    this.logger.info(
      `Updated integration docs: ${updatedDocs.changes.length} changes, ` +
      `${updatedDocs.migrations.length} migrations`
    );

    return updatedDocs;
  }

  /**
   * Generate integration documentation from scratch
   *
   * @param {Object} parsedCode - Parsed backend code structure
   * @param {Object} options - Generation options
   * @returns {Object} Generated integration documentation
   */
  generate(parsedCode, options = {}) {
    this.logger.info('Generating integration documentation...');

    const docs = {
      title: options.title || 'API Integration Guide',
      version: options.version || '1.0.0',
      generatedAt: new Date().toISOString(),
      sections: {
        gettingStarted: this.generateGettingStarted(parsedCode),
        authentication: this.generateAuthSection(parsedCode),
        endpoints: this.generateEndpointsSection(parsedCode),
        models: this.generateModelsSection(parsedCode),
        errorHandling: this.generateErrorHandling(parsedCode),
        codeExamples: this.generateCodeExamples(parsedCode)
      },
      changes: [],
      migrations: [],
      deprecations: []
    };

    this.logger.info('Integration documentation generated');

    return docs;
  }

  /**
   * Update API integration guides
   */
  updateAPIGuides(changes, parsedCode, docs) {
    const routeChanges = [
      ...(changes.breaking || []).filter(c => c.category === 'routes'),
      ...(changes.additions || []).filter(c => c.category === 'routes')
    ];

    for (const change of routeChanges) {
      if (change.type === 'route_removed' && change.oldValue) {
        docs.changes.push({
          type: 'endpoint_removed',
          severity: 'breaking',
          endpoint: `${change.oldValue.method} ${change.oldValue.path}`,
          description: `The ${change.oldValue.method} ${change.oldValue.path} endpoint has been removed.`,
          action: 'Remove all calls to this endpoint',
          alternativeEndpoint: this.findAlternativeEndpoint(change.oldValue, parsedCode)
        });
      } else if (change.type === 'route_added' && change.newValue) {
        docs.changes.push({
          type: 'endpoint_added',
          severity: 'addition',
          endpoint: `${change.newValue.method} ${change.newValue.path}`,
          description: `New endpoint available: ${change.newValue.method} ${change.newValue.path}`,
          usage: this.generateEndpointUsage(change.newValue),
          codeExample: this.generateRequestExample(change.newValue)
        });
      }
    }
  }

  /**
   * Update authentication documentation
   */
  updateAuthDocs(changes, parsedCode, docs) {
    const authChanges = changes.breaking?.filter(c =>
      c.type === 'route_middleware_removed' &&
      c.removed?.some(m => m.includes('auth'))
    ) || [];

    for (const change of authChanges) {
      docs.changes.push({
        type: 'authentication_changed',
        severity: 'critical',
        description: 'Authentication requirements have changed for some endpoints',
        affectedEndpoints: [change.route || 'unknown'],
        action: 'Review authentication requirements for affected endpoints'
      });
    }
  }

  /**
   * Generate migration guides
   */
  generateMigrationGuides(changes, docs) {
    if (changes.breaking && changes.breaking.length > 0) {
      const migration = {
        fromVersion: docs.version,
        toVersion: this.bumpVersion(docs.version, 'major'),
        breakingChanges: [],
        steps: []
      };

      for (const change of changes.breaking) {
        if (change.category === 'routes') {
          migration.breakingChanges.push({
            type: change.type,
            description: change.message,
            impact: change.impact
          });

          if (change.type === 'route_removed') {
            migration.steps.push({
              step: migration.steps.length + 1,
              description: `Remove calls to ${change.oldValue?.method} ${change.oldValue?.path}`,
              code: this.generateMigrationCode(change)
            });
          }
        } else if (change.category === 'models') {
          migration.breakingChanges.push({
            type: change.type,
            description: change.message,
            model: change.model,
            field: change.field
          });

          if (change.type === 'field_removed' || change.type === 'field_type_changed') {
            migration.steps.push({
              step: migration.steps.length + 1,
              description: `Update ${change.model} model references`,
              field: change.field,
              action: change.type === 'field_removed' ? 'Remove field usage' : 'Update field type'
            });
          }
        }
      }

      if (migration.breakingChanges.length > 0) {
        docs.migrations.push(migration);
      }
    }
  }

  /**
   * Add deprecation notices
   */
  addDeprecationNotices(changes, docs) {
    const deprecatable = [
      ...(changes.breaking || []).filter(c => c.type === 'route_removed')
    ];

    for (const change of deprecatable) {
      docs.deprecations.push({
        type: 'endpoint',
        endpoint: `${change.oldValue?.method} ${change.oldValue?.path}`,
        deprecatedIn: docs.version,
        removedIn: this.bumpVersion(docs.version, 'major'),
        reason: 'Endpoint removed in latest version',
        alternative: this.findAlternativeEndpoint(change.oldValue, {})
      });
    }
  }

  /**
   * Update code examples
   */
  updateCodeExamples(changes, parsedCode, docs) {
    if (!docs.sections) {
      docs.sections = {};
    }

    if (!docs.sections.codeExamples) {
      docs.sections.codeExamples = [];
    }

    // Add examples for new endpoints
    const newEndpoints = changes.additions?.filter(c =>
      c.category === 'routes' && c.type === 'route_added'
    ) || [];

    for (const change of newEndpoints) {
      docs.sections.codeExamples.push({
        endpoint: `${change.newValue.method} ${change.newValue.path}`,
        description: `Example usage for ${change.newValue.method} ${change.newValue.path}`,
        examples: {
          javascript: this.generateJavaScriptExample(change.newValue),
          curl: this.generateCurlExample(change.newValue),
          python: this.generatePythonExample(change.newValue)
        }
      });
    }
  }

  /**
   * Generate Getting Started section
   */
  generateGettingStarted(parsedCode) {
    return {
      title: 'Getting Started',
      content: [
        'This guide will help you integrate with our API.',
        'Follow these steps to get started:',
        '1. Obtain API credentials',
        '2. Make your first API call',
        '3. Handle responses and errors'
      ],
      baseURL: 'https://api.example.com',
      authentication: 'Bearer token required for most endpoints'
    };
  }

  /**
   * Generate Authentication section
   */
  generateAuthSection(parsedCode) {
    const hasAuth = (parsedCode.middleware || []).some(m =>
      m.name.includes('auth') || m.name.includes('authenticate')
    );

    if (!hasAuth) {
      return {
        title: 'Authentication',
        required: false,
        content: 'No authentication required'
      };
    }

    return {
      title: 'Authentication',
      required: true,
      type: 'Bearer Token',
      description: 'Most endpoints require authentication via Bearer token',
      example: {
        header: 'Authorization: Bearer YOUR_TOKEN_HERE'
      },
      obtainingToken: [
        '1. Register an account',
        '2. Login to receive a JWT token',
        '3. Include token in Authorization header'
      ]
    };
  }

  /**
   * Generate Endpoints section
   */
  generateEndpointsSection(parsedCode) {
    const endpoints = [];

    for (const route of parsedCode.routes || []) {
      endpoints.push({
        method: route.method,
        path: route.path,
        description: `${route.method} operation for ${route.path}`,
        requiresAuth: (route.middleware || []).some(m => m.includes('auth')),
        parameters: this.extractParameters(route.path),
        example: this.generateRequestExample(route)
      });
    }

    return {
      title: 'API Endpoints',
      baseURL: 'https://api.example.com',
      endpoints
    };
  }

  /**
   * Generate Models section
   */
  generateModelsSection(parsedCode) {
    const models = [];

    for (const model of parsedCode.models || []) {
      if (model.type === 'schema' && model.fields) {
        models.push({
          name: model.name.replace('Schema', ''),
          fields: model.fields.map(f => ({
            name: f.name,
            type: f.type,
            required: f.required || false,
            description: f.description || `${f.name} field`
          })),
          example: this.generateModelExample(model)
        });
      }
    }

    return {
      title: 'Data Models',
      models
    };
  }

  /**
   * Generate Error Handling section
   */
  generateErrorHandling(parsedCode) {
    return {
      title: 'Error Handling',
      commonErrors: [
        { code: 400, message: 'Bad Request', description: 'Invalid request parameters' },
        { code: 401, message: 'Unauthorized', description: 'Authentication required or failed' },
        { code: 404, message: 'Not Found', description: 'Resource not found' },
        { code: 500, message: 'Internal Server Error', description: 'Server error occurred' }
      ],
      errorFormat: {
        error: {
          code: 'ERROR_CODE',
          message: 'Human readable error message',
          details: {}
        }
      }
    };
  }

  /**
   * Generate code examples
   */
  generateCodeExamples(parsedCode) {
    const examples = [];

    // Generate example for first route
    const route = (parsedCode.routes || [])[0];
    if (route) {
      examples.push({
        endpoint: `${route.method} ${route.path}`,
        examples: {
          javascript: this.generateJavaScriptExample(route),
          curl: this.generateCurlExample(route),
          python: this.generatePythonExample(route)
        }
      });
    }

    return examples;
  }

  /**
   * Generate JavaScript example
   */
  generateJavaScriptExample(route) {
    const hasAuth = (route.middleware || []).some(m => m.includes('auth'));
    const method = route.method.toLowerCase();
    const requiresBody = ['post', 'put', 'patch'].includes(method);

    return `// ${route.method} ${route.path}
const response = await fetch('https://api.example.com${route.path}', {
  method: '${route.method}',${hasAuth ? `
  headers: {
    'Authorization': 'Bearer YOUR_TOKEN',
    'Content-Type': 'application/json'
  },` : ''}${requiresBody ? `
  body: JSON.stringify({
    // Request payload
  })` : ''}
});

const data = await response.json();
console.log(data);`;
  }

  /**
   * Generate cURL example
   */
  generateCurlExample(route) {
    const hasAuth = (route.middleware || []).some(m => m.includes('auth'));
    const method = route.method;
    const requiresBody = ['POST', 'PUT', 'PATCH'].includes(method);

    let curl = `curl -X ${method} https://api.example.com${route.path}`;

    if (hasAuth) {
      curl += ` \\\n  -H "Authorization: Bearer YOUR_TOKEN"`;
    }

    if (requiresBody) {
      curl += ` \\\n  -H "Content-Type: application/json" \\\n  -d '{"key": "value"}'`;
    }

    return curl;
  }

  /**
   * Generate Python example
   */
  generatePythonExample(route) {
    const hasAuth = (route.middleware || []).some(m => m.includes('auth'));
    const method = route.method.toLowerCase();
    const requiresBody = ['post', 'put', 'patch'].includes(method);

    return `import requests

url = 'https://api.example.com${route.path}'${hasAuth ? `
headers = {'Authorization': 'Bearer YOUR_TOKEN'}` : ''}${requiresBody ? `
data = {'key': 'value'}` : ''}

response = requests.${method}(url${hasAuth ? ', headers=headers' : ''}${requiresBody ? ', json=data' : ''})
print(response.json())`;
  }

  /**
   * Generate request example
   */
  generateRequestExample(route) {
    return {
      method: route.method,
      url: `https://api.example.com${route.path}`,
      headers: (route.middleware || []).some(m => m.includes('auth'))
        ? { 'Authorization': 'Bearer YOUR_TOKEN' }
        : {},
      body: ['POST', 'PUT', 'PATCH'].includes(route.method)
        ? { example: 'data' }
        : null
    };
  }

  /**
   * Generate endpoint usage description
   */
  generateEndpointUsage(route) {
    const method = route.method;
    const path = route.path;

    if (method === 'GET') return `Retrieve data from ${path}`;
    if (method === 'POST') return `Create new resource at ${path}`;
    if (method === 'PUT') return `Update resource at ${path}`;
    if (method === 'PATCH') return `Partially update resource at ${path}`;
    if (method === 'DELETE') return `Delete resource at ${path}`;

    return `${method} operation on ${path}`;
  }

  /**
   * Extract parameters from path
   */
  extractParameters(path) {
    const params = [];
    const matches = path.match(/:(\w+)/g);

    if (matches) {
      for (const match of matches) {
        params.push({
          name: match.substring(1),
          type: 'path',
          required: true,
          description: `${match.substring(1)} parameter`
        });
      }
    }

    return params;
  }

  /**
   * Generate model example
   */
  generateModelExample(model) {
    const example = {};

    for (const field of model.fields || []) {
      example[field.name] = this.getExampleValue(field.type);
    }

    return example;
  }

  /**
   * Get example value for type
   */
  getExampleValue(type) {
    const examples = {
      String: 'example string',
      Number: 123,
      Boolean: true,
      Date: '2024-01-01T00:00:00Z',
      ObjectId: '507f1f77bcf86cd799439011',
      Array: [],
      Object: {}
    };

    return examples[type] || 'example';
  }

  /**
   * Find alternative endpoint
   */
  findAlternativeEndpoint(oldRoute, parsedCode) {
    // In real implementation, use similarity matching
    return 'Check API documentation for alternative endpoints';
  }

  /**
   * Generate migration code
   */
  generateMigrationCode(change) {
    if (change.type === 'route_removed') {
      return `// Remove this code:
// fetch('${change.oldValue?.path}', { method: '${change.oldValue?.method}' })
// Replace with alternative endpoint`;
    }

    return '// Migration code';
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
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of IntegrationDocsUpdater
 * @returns {IntegrationDocsUpdater}
 */
export function getIntegrationDocsUpdater() {
  if (!instance) {
    instance = new IntegrationDocsUpdater();
  }
  return instance;
}

export { IntegrationDocsUpdater };
export default IntegrationDocsUpdater;
