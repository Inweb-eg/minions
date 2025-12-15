/**
 * ControllerGenerator - Express Controller Code Generation Skill
 *
 * Generates Express controllers:
 * - CRUD controllers
 * - Custom action handlers
 * - Response formatting
 * - Error handling
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Controller types
 */
export const CONTROLLER_TYPE = {
  CRUD: 'crud',
  CUSTOM: 'custom',
  AUTH: 'auth',
  RESOURCE: 'resource'
};

/**
 * ControllerGenerator Skill
 */
export class ControllerGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ControllerGenerator', {
      language: LANGUAGE.JAVASCRIPT,
      ...options
    });

    this.useService = options.useService ?? true;
    this.registerTemplates();
  }

  registerTemplates() {
    // CRUD controller template
    this.registerTemplate('crud', (data) => `
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' Controller'}
 */
class ${data.name}Controller {
  ${this.useService && data.service !== false ? `constructor() {
    this.service = ${this.toCamelCase(data.name)}Service;
  }` : ''}

  /**
   * Get all ${this.toPlural(data.name).toLowerCase()}
   * @route GET ${data.basePath || '/' + this.toKebabCase(data.name)}
   */
  getAll = async (req, res, next) => {
    try {
      const { page = 1, limit = 20, sort, ...filters } = req.query;

      const options = {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: sort || { createdAt: -1 },
        ${data.defaultPopulate ? `populate: '${data.defaultPopulate}'` : ''}
      };

      ${this.useService ? `const items = await this.service.getAll(filters, options);
      const total = await this.service.count(filters);` : `const items = await ${data.name}.find(filters)
        .sort(options.sort)
        .skip(options.skip)
        .limit(options.limit);
      const total = await ${data.name}.countDocuments(filters);`}

      res.json({
        success: true,
        data: items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get ${data.name.toLowerCase()} by ID
   * @route GET ${data.basePath || '/' + this.toKebabCase(data.name)}/:id
   */
  getById = async (req, res, next) => {
    try {
      ${this.useService ? `const item = await this.service.getById(req.params.id, {
        ${data.defaultPopulate ? `populate: '${data.defaultPopulate}'` : ''}
      });` : `const item = await ${data.name}.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: '${data.name} not found'
        });
      }`}

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create new ${data.name.toLowerCase()}
   * @route POST ${data.basePath || '/' + this.toKebabCase(data.name)}
   */
  create = async (req, res, next) => {
    try {
      ${data.addCreatedBy ? `const data = { ...req.body, createdBy: req.user._id };` : 'const data = req.body;'}

      ${this.useService ? `const item = await this.service.create(data);` : `const item = await ${data.name}.create(data);`}

      res.status(201).json({
        success: true,
        data: item,
        message: '${data.name} created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update ${data.name.toLowerCase()} by ID
   * @route PUT ${data.basePath || '/' + this.toKebabCase(data.name)}/:id
   */
  update = async (req, res, next) => {
    try {
      ${data.addUpdatedBy ? `const data = { ...req.body, updatedBy: req.user._id };` : 'const data = req.body;'}

      ${this.useService ? `const item = await this.service.updateById(req.params.id, data);` : `const item = await ${data.name}.findByIdAndUpdate(
        req.params.id,
        data,
        { new: true, runValidators: true }
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          error: '${data.name} not found'
        });
      }`}

      res.json({
        success: true,
        data: item,
        message: '${data.name} updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete ${data.name.toLowerCase()} by ID
   * @route DELETE ${data.basePath || '/' + this.toKebabCase(data.name)}/:id
   */
  delete = async (req, res, next) => {
    try {
      ${this.useService ? `await this.service.deleteById(req.params.id);` : `const item = await ${data.name}.findByIdAndDelete(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: '${data.name} not found'
        });
      }`}

      res.json({
        success: true,
        message: '${data.name} deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

${data.customMethods || ''}
}

module.exports = {
  ${data.name}Controller,
  ${this.toCamelCase(data.name)}Controller: new ${data.name}Controller()
};
`.trim());

    // Custom controller template
    this.registerTemplate('custom', (data) => `
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' Controller'}
 */
class ${data.name}Controller {
  ${data.dependencies ? `constructor(${data.dependencies.map(d => d.name).join(', ')}) {
    ${data.dependencies.map(d => `this.${d.name} = ${d.name};`).join('\n    ')}
  }` : ''}

${this.generateCustomActions(data)}
}

module.exports = {
  ${data.name}Controller,
  ${this.toCamelCase(data.name)}Controller: new ${data.name}Controller(${data.dependencies ? data.dependencies.map(d => d.instance || d.name).join(', ') : ''})
};
`.trim());

    // Auth controller template
    this.registerTemplate('auth', (data) => `
${this.generateImports(data)}

/**
 * Authentication Controller
 */
class AuthController {
  constructor() {
    this.authService = ${data.authService || 'authService'};
  }

  /**
   * Register new user
   * @route POST /auth/register
   */
  register = async (req, res, next) => {
    try {
      const result = await this.authService.register(req.body);

      res.status(201).json({
        success: true,
        data: result,
        message: 'Registration successful'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Login user
   * @route POST /auth/login
   */
  login = async (req, res, next) => {
    try {
      const { email, password, identifier } = req.body;

      const result = await this.authService.login(
        identifier || email,
        password
      );

      ${data.setCookie ? `// Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });` : ''}

      res.json({
        success: true,
        data: result,
        message: 'Login successful'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Logout user
   * @route POST /auth/logout
   */
  logout = async (req, res, next) => {
    try {
      const refreshToken = ${data.setCookie ? "req.cookies.refreshToken || req.body.refreshToken" : "req.body.refreshToken"};

      await this.authService.logout(req.user._id, refreshToken);

      ${data.setCookie ? `// Clear refresh token cookie
      res.clearCookie('refreshToken');` : ''}

      res.json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Refresh access token
   * @route POST /auth/refresh
   */
  refreshToken = async (req, res, next) => {
    try {
      const refreshToken = ${data.setCookie ? "req.cookies.refreshToken || req.body.refreshToken" : "req.body.refreshToken"};

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'Refresh token required'
        });
      }

      const result = await this.authService.refreshToken(refreshToken);

      ${data.setCookie ? `// Update refresh token cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });` : ''}

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Request password reset
   * @route POST /auth/forgot-password
   */
  forgotPassword = async (req, res, next) => {
    try {
      const result = await this.authService.forgotPassword(req.body.email);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Reset password
   * @route POST /auth/reset-password
   */
  resetPassword = async (req, res, next) => {
    try {
      const { token, password } = req.body;

      const result = await this.authService.resetPassword(token, password);

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Change password
   * @route POST /auth/change-password
   */
  changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;

      const result = await this.authService.changePassword(
        req.user._id,
        currentPassword,
        newPassword
      );

      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get current user profile
   * @route GET /auth/me
   */
  getProfile = async (req, res, next) => {
    try {
      res.json({
        success: true,
        data: req.user
      });
    } catch (error) {
      next(error);
    }
  };

${data.includeOtp ? `
  /**
   * Send OTP
   * @route POST /auth/send-otp
   */
  sendOtp = async (req, res, next) => {
    try {
      const result = await this.authService.sendOtp(req.body);

      res.json({
        success: true,
        message: 'OTP sent successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Verify OTP
   * @route POST /auth/verify-otp
   */
  verifyOtp = async (req, res, next) => {
    try {
      const result = await this.authService.verifyOtp(req.body);

      res.json({
        success: true,
        data: result,
        message: 'OTP verified successfully'
      });
    } catch (error) {
      next(error);
    }
  };
` : ''}
}

module.exports = {
  AuthController,
  authController: new AuthController()
};
`.trim());

    // Resource controller template (nested resources)
    this.registerTemplate('resource', (data) => `
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' Controller'}
 * Handles nested resource for ${data.parentResource || 'parent'}
 */
class ${data.name}Controller {
  ${this.useService && data.service !== false ? `constructor() {
    this.service = ${this.toCamelCase(data.name)}Service;
  }` : ''}

  /**
   * Get all ${this.toPlural(data.name).toLowerCase()} for parent
   * @route GET /${data.parentPath || ':parentId'}/${this.toKebabCase(data.name)}
   */
  getAll = async (req, res, next) => {
    try {
      const parentId = req.params.${data.parentParam || 'parentId'};
      const { page = 1, limit = 20, sort } = req.query;

      const filter = { ${data.parentField || 'parentId'}: parentId };

      const options = {
        skip: (page - 1) * limit,
        limit: parseInt(limit),
        sort: sort || { createdAt: -1 }
      };

      ${this.useService ? `const items = await this.service.getAll(filter, options);
      const total = await this.service.count(filter);` : `const items = await ${data.name}.find(filter)
        .sort(options.sort)
        .skip(options.skip)
        .limit(options.limit);
      const total = await ${data.name}.countDocuments(filter);`}

      res.json({
        success: true,
        data: items,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get ${data.name.toLowerCase()} by ID
   * @route GET /${data.parentPath || ':parentId'}/${this.toKebabCase(data.name)}/:id
   */
  getById = async (req, res, next) => {
    try {
      ${this.useService ? `const item = await this.service.getById(req.params.id);` : `const item = await ${data.name}.findById(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: '${data.name} not found'
        });
      }`}

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create new ${data.name.toLowerCase()}
   * @route POST /${data.parentPath || ':parentId'}/${this.toKebabCase(data.name)}
   */
  create = async (req, res, next) => {
    try {
      const parentId = req.params.${data.parentParam || 'parentId'};
      const data = {
        ...req.body,
        ${data.parentField || 'parentId'}: parentId
        ${data.addCreatedBy ? ', createdBy: req.user._id' : ''}
      };

      ${this.useService ? `const item = await this.service.create(data);` : `const item = await ${data.name}.create(data);`}

      res.status(201).json({
        success: true,
        data: item,
        message: '${data.name} created successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update ${data.name.toLowerCase()} by ID
   * @route PUT /${data.parentPath || ':parentId'}/${this.toKebabCase(data.name)}/:id
   */
  update = async (req, res, next) => {
    try {
      ${this.useService ? `const item = await this.service.updateById(req.params.id, req.body);` : `const item = await ${data.name}.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );

      if (!item) {
        return res.status(404).json({
          success: false,
          error: '${data.name} not found'
        });
      }`}

      res.json({
        success: true,
        data: item,
        message: '${data.name} updated successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete ${data.name.toLowerCase()} by ID
   * @route DELETE /${data.parentPath || ':parentId'}/${this.toKebabCase(data.name)}/:id
   */
  delete = async (req, res, next) => {
    try {
      ${this.useService ? `await this.service.deleteById(req.params.id);` : `const item = await ${data.name}.findByIdAndDelete(req.params.id);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: '${data.name} not found'
        });
      }`}

      res.json({
        success: true,
        message: '${data.name} deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = {
  ${data.name}Controller,
  ${this.toCamelCase(data.name)}Controller: new ${data.name}Controller()
};
`.trim());
  }

  /**
   * Generate imports
   */
  generateImports(data) {
    const imports = [];

    if (this.useService && data.service !== false) {
      imports.push(`const { ${this.toCamelCase(data.name)}Service } = require('${data.servicePath || '../services/' + this.toKebabCase(data.name) + '.service'}');`);
    }

    if (!this.useService || data.service === false) {
      imports.push(`const ${data.name} = require('${data.modelPath || '../models/' + data.name}');`);
    }

    if (data.authService) {
      imports.push(`const { ${data.authService} } = require('${data.authServicePath || '../services/auth.service'}');`);
    }

    if (data.imports) {
      imports.push(...data.imports);
    }

    return imports.join('\n');
  }

  /**
   * Generate custom actions
   */
  generateCustomActions(data) {
    const actions = data.actions || [];
    if (actions.length === 0) {
      return `  /**
   * Example action
   */
  exampleAction = async (req, res, next) => {
    try {
      // TODO: Implement
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };`;
    }

    return actions.map(action => {
      const jsdoc = this.generateActionJSDoc(action);
      return `${jsdoc}
  ${action.name} = async (req, res, next) => {
    try {
      ${action.body || '// TODO: Implement ' + action.name + '\n      res.json({ success: true });'}
    } catch (error) {
      next(error);
    }
  };`;
    }).join('\n\n');
  }

  /**
   * Generate JSDoc for action
   */
  generateActionJSDoc(action) {
    const lines = ['  /**'];

    if (action.description) {
      lines.push(`   * ${action.description}`);
    }

    if (action.route) {
      lines.push(`   * @route ${action.method || 'GET'} ${action.route}`);
    }

    if (action.params) {
      action.params.forEach(param => {
        lines.push(`   * @param {${param.type || 'any'}} ${param.name} - ${param.description || ''}`);
      });
    }

    lines.push('   */');
    return lines.join('\n');
  }

  /**
   * Generate a controller
   * @param {Object} spec - Controller specification
   * @returns {Promise<Object>} Generation result
   */
  async generate(spec) {
    this.startRun();

    try {
      // Validate spec
      const validation = this.validateSpec(spec, {
        required: ['name'],
        properties: {
          name: { type: 'string', pattern: '^[A-Z][a-zA-Z0-9]*$' },
          type: { type: 'string', enum: Object.values(CONTROLLER_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || CONTROLLER_TYPE.CRUD;

      // Build output path
      const fileName = this.toKebabCase(spec.name) + '.controller.js';
      const outputPath = spec.outputPath || `src/controllers/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.BACKEND_CONTROLLER_GENERATED, {
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
   * Convert to camelCase
   */
  toCamelCase(str) {
    return str.charAt(0).toLowerCase() + str.slice(1);
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
   * Convert to plural
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

export function getControllerGenerator(options = {}) {
  if (!instance) {
    instance = new ControllerGenerator(options);
  }
  return instance;
}

export default ControllerGenerator;
