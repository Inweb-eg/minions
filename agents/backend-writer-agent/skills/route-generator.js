/**
 * RouteGenerator - Express Route Code Generation Skill
 *
 * Generates Express routes:
 * - RESTful endpoints (GET, POST, PUT, DELETE)
 * - Middleware integration
 * - Validation integration
 * - Controller integration
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * HTTP methods
 */
export const HTTP_METHOD = {
  GET: 'get',
  POST: 'post',
  PUT: 'put',
  PATCH: 'patch',
  DELETE: 'delete'
};

/**
 * Route types
 */
export const ROUTE_TYPE = {
  CRUD: 'crud',
  CUSTOM: 'custom',
  AUTH: 'auth',
  RESOURCE: 'resource'
};

/**
 * RouteGenerator Skill
 */
export class RouteGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('RouteGenerator', {
      language: LANGUAGE.JAVASCRIPT,
      ...options
    });

    this.useTypeScript = options.useTypeScript || false;
    this.registerTemplates();
  }

  registerTemplates() {
    // CRUD routes template
    this.registerTemplate('crud', (data) => `
const express = require('express');
const router = express.Router();
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' routes'}
 * Base path: ${data.basePath || '/' + this.toKebabCase(data.name)}
 */

${this.generateMiddlewareUse(data)}

// GET ${data.basePath || '/' + this.toKebabCase(data.name)} - List all ${this.toPlural(data.name)}
router.get('/',${this.generateRouteMiddleware(data, 'list')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.getAll);

// GET ${data.basePath || '/' + this.toKebabCase(data.name)}/:id - Get single ${data.name}
router.get('/:id',${this.generateRouteMiddleware(data, 'get')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.getById);

// POST ${data.basePath || '/' + this.toKebabCase(data.name)} - Create new ${data.name}
router.post('/',${this.generateRouteMiddleware(data, 'create')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.create);

// PUT ${data.basePath || '/' + this.toKebabCase(data.name)}/:id - Update ${data.name}
router.put('/:id',${this.generateRouteMiddleware(data, 'update')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.update);

// DELETE ${data.basePath || '/' + this.toKebabCase(data.name)}/:id - Delete ${data.name}
router.delete('/:id',${this.generateRouteMiddleware(data, 'delete')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.delete);

module.exports = router;
`.trim());

    // Custom routes template
    this.registerTemplate('custom', (data) => `
const express = require('express');
const router = express.Router();
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' routes'}
 * Base path: ${data.basePath || '/' + this.toKebabCase(data.name)}
 */

${this.generateMiddlewareUse(data)}

${this.generateCustomRoutes(data)}

module.exports = router;
`.trim());

    // Auth routes template
    this.registerTemplate('auth', (data) => `
const express = require('express');
const router = express.Router();
${this.generateImports(data)}

/**
 * Authentication routes
 */

${this.generateMiddlewareUse(data)}

// POST /auth/register - Register new user
router.post('/register',
  ${data.validatorName || 'authValidator'}.register,
  ${data.controllerName || 'authController'}.register
);

// POST /auth/login - Login user
router.post('/login',
  ${data.validatorName || 'authValidator'}.login,
  ${data.controllerName || 'authController'}.login
);

// POST /auth/logout - Logout user
router.post('/logout',
  ${data.authMiddleware || 'authenticate'},
  ${data.controllerName || 'authController'}.logout
);

// POST /auth/refresh - Refresh token
router.post('/refresh',
  ${data.controllerName || 'authController'}.refreshToken
);

// POST /auth/forgot-password - Request password reset
router.post('/forgot-password',
  ${data.validatorName || 'authValidator'}.forgotPassword,
  ${data.controllerName || 'authController'}.forgotPassword
);

// POST /auth/reset-password - Reset password
router.post('/reset-password',
  ${data.validatorName || 'authValidator'}.resetPassword,
  ${data.controllerName || 'authController'}.resetPassword
);

${data.includeOtp ? `
// POST /auth/send-otp - Send OTP
router.post('/send-otp',
  ${data.validatorName || 'authValidator'}.sendOtp,
  ${data.controllerName || 'authController'}.sendOtp
);

// POST /auth/verify-otp - Verify OTP
router.post('/verify-otp',
  ${data.validatorName || 'authValidator'}.verifyOtp,
  ${data.controllerName || 'authController'}.verifyOtp
);
` : ''}

module.exports = router;
`.trim());

    // Resource routes template (nested resources)
    this.registerTemplate('resource', (data) => `
const express = require('express');
const router = express.Router({ mergeParams: true });
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' routes'}
 * Base path: ${data.parentPath || ''}/${data.basePath || this.toKebabCase(data.name)}
 * Parent: ${data.parentResource || 'N/A'}
 */

${this.generateMiddlewareUse(data)}

// GET /:${data.parentParam || 'parentId'}/${this.toKebabCase(data.name)} - List all ${this.toPlural(data.name)}
router.get('/',${this.generateRouteMiddleware(data, 'list')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.getAll);

// GET /:${data.parentParam || 'parentId'}/${this.toKebabCase(data.name)}/:id - Get single ${data.name}
router.get('/:id',${this.generateRouteMiddleware(data, 'get')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.getById);

// POST /:${data.parentParam || 'parentId'}/${this.toKebabCase(data.name)} - Create new ${data.name}
router.post('/',${this.generateRouteMiddleware(data, 'create')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.create);

// PUT /:${data.parentParam || 'parentId'}/${this.toKebabCase(data.name)}/:id - Update ${data.name}
router.put('/:id',${this.generateRouteMiddleware(data, 'update')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.update);

// DELETE /:${data.parentParam || 'parentId'}/${this.toKebabCase(data.name)}/:id - Delete ${data.name}
router.delete('/:id',${this.generateRouteMiddleware(data, 'delete')} ${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.delete);

module.exports = router;
`.trim());

    // Routes index template
    this.registerTemplate('index', (data) => `
const express = require('express');
const router = express.Router();

${(data.routes || []).map(route => `const ${this.toCamelCase(route.name)}Routes = require('./${this.toKebabCase(route.name)}.routes');`).join('\n')}

/**
 * API Routes
 */

${(data.routes || []).map(route => `router.use('${route.basePath || '/' + this.toKebabCase(route.name)}', ${this.toCamelCase(route.name)}Routes);`).join('\n')}

module.exports = router;
`.trim());
  }

  /**
   * Generate imports
   */
  generateImports(data) {
    const imports = [];

    if (data.controller) {
      imports.push(`const ${data.controllerName || this.toCamelCase(data.name) + 'Controller'} = require('${data.controllerPath || '../controllers/' + this.toKebabCase(data.name) + '.controller'}');`);
    }

    if (data.validator) {
      imports.push(`const ${data.validatorName || this.toCamelCase(data.name) + 'Validator'} = require('${data.validatorPath || '../validators/' + this.toKebabCase(data.name) + '.validator'}');`);
    }

    if (data.middleware) {
      data.middleware.forEach(m => {
        if (typeof m === 'string') {
          imports.push(`const { ${m} } = require('${data.middlewarePath || '../middleware'}');`);
        } else {
          imports.push(`const { ${m.name} } = require('${m.path || '../middleware'}');`);
        }
      });
    }

    if (data.authMiddleware) {
      imports.push(`const { ${data.authMiddleware} } = require('${data.authMiddlewarePath || '../middleware/auth.middleware'}');`);
    }

    return imports.join('\n');
  }

  /**
   * Generate middleware use statements
   */
  generateMiddlewareUse(data) {
    if (!data.globalMiddleware || data.globalMiddleware.length === 0) return '';

    return data.globalMiddleware.map(m => {
      if (typeof m === 'string') {
        return `router.use(${m});`;
      }
      return `router.use(${m.name});`;
    }).join('\n');
  }

  /**
   * Generate route-specific middleware
   */
  generateRouteMiddleware(data, action) {
    const middleware = [];

    // Auth middleware
    if (data.protected !== false && data.authMiddleware) {
      middleware.push(data.authMiddleware);
    }

    // Validation middleware
    if (data.validator) {
      const validatorName = data.validatorName || this.toCamelCase(data.name) + 'Validator';
      if (action === 'create') {
        middleware.push(`${validatorName}.create`);
      } else if (action === 'update') {
        middleware.push(`${validatorName}.update`);
      }
    }

    // Custom middleware for action
    if (data.routeMiddleware && data.routeMiddleware[action]) {
      middleware.push(...data.routeMiddleware[action]);
    }

    if (middleware.length === 0) return '';
    return ' ' + middleware.join(', ') + ',';
  }

  /**
   * Generate custom routes
   */
  generateCustomRoutes(data) {
    const routes = data.routes || [];
    if (routes.length === 0) return '// Add custom routes here';

    return routes.map(route => {
      const method = route.method || HTTP_METHOD.GET;
      const path = route.path || '/';
      const middleware = route.middleware ? route.middleware.join(', ') + ', ' : '';
      const handler = route.handler || `${data.controllerName || this.toCamelCase(data.name) + 'Controller'}.${route.action || 'handle'}`;
      const comment = route.description ? `// ${route.description}\n` : '';

      return `${comment}router.${method}('${path}', ${middleware}${handler});`;
    }).join('\n\n');
  }

  /**
   * Generate routes
   * @param {Object} spec - Route specification
   * @returns {Promise<Object>} Generation result
   */
  async generate(spec) {
    this.startRun();

    try {
      // Validate spec
      const validation = this.validateSpec(spec, {
        required: ['name'],
        properties: {
          name: { type: 'string' },
          type: { type: 'string', enum: Object.values(ROUTE_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || ROUTE_TYPE.CRUD;

      // Build output path
      const fileName = this.toKebabCase(spec.name) + '.routes.js';
      const outputPath = spec.outputPath || `src/routes/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.BACKEND_ROUTE_GENERATED, {
          name: spec.name,
          type: templateName,
          path: result.path
        });
      }

      this.completeRun();
      return result;
    } catch (error) {
      this.failRun(error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Generate routes index file
   * @param {Object} spec - Routes index specification
   * @returns {Promise<Object>} Generation result
   */
  async generateIndex(spec) {
    const outputPath = spec.outputPath || 'src/routes/index.js';
    return await this.generateAndWrite(spec, 'index', outputPath, {
      overwrite: spec.overwrite || false
    });
  }

  /**
   * Convert to kebab-case
   */
  toKebabCase(str) {
    return str.replace(/([A-Z])/g, (match, p1, offset) => {
      return (offset > 0 ? '-' : '') + p1.toLowerCase();
    }).replace(/^-/, '');
  }

  /**
   * Convert to camelCase
   */
  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
  }

  /**
   * Convert to plural (simple)
   */
  toPlural(str) {
    if (str.endsWith('y')) {
      return str.slice(0, -1) + 'ies';
    }
    if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) {
      return str + 'es';
    }
    return str + 's';
  }
}

// Singleton getter
let instance = null;

export function getRouteGenerator(options = {}) {
  if (!instance) {
    instance = new RouteGenerator(options);
  }
  return instance;
}

export default RouteGenerator;
