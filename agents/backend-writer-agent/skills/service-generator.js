/**
 * ServiceGenerator - Backend Service Layer Code Generation Skill
 *
 * Generates service layer:
 * - Business logic services
 * - Repository pattern integration
 * - Transaction handling
 * - Error handling
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Service types
 */
export const SERVICE_TYPE = {
  CRUD: 'crud',
  CUSTOM: 'custom',
  AUTH: 'auth',
  EXTERNAL: 'external'
};

/**
 * ServiceGenerator Skill
 */
export class ServiceGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ServiceGenerator', {
      language: LANGUAGE.JAVASCRIPT,
      ...options
    });

    this.useRepository = options.useRepository ?? true;
    this.registerTemplates();
  }

  registerTemplates() {
    // CRUD service template
    this.registerTemplate('crud', (data) => `
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' Service'}
 * Handles business logic for ${data.name}
 */
class ${data.name}Service {
  ${this.useRepository ? `constructor() {
    this.repository = ${this.toCamelCase(data.name)}Repository;
  }` : ''}

  /**
   * Get all ${this.toPlural(data.name).toLowerCase()}
   * @param {Object} filter - Query filters
   * @param {Object} options - Query options (sort, limit, skip, populate)
   * @returns {Promise<Array>}
   */
  async getAll(filter = {}, options = {}) {
    ${this.useRepository ? `return this.repository.findAll(filter, options);` : `return ${data.name}.find(filter)
      .sort(options.sort || { createdAt: -1 })
      .limit(options.limit || 50)
      .skip(options.skip || 0)
      .populate(options.populate || '');`}
  }

  /**
   * Get ${data.name.toLowerCase()} by ID
   * @param {string} id - ${data.name} ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>}
   */
  async getById(id, options = {}) {
    ${this.useRepository ? `const doc = await this.repository.findById(id, options);` : `const doc = await ${data.name}.findById(id).populate(options.populate || '');`}

    if (!doc) {
      throw new NotFoundError('${data.name} not found');
    }

    return doc;
  }

  /**
   * Create new ${data.name.toLowerCase()}
   * @param {Object} data - ${data.name} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    ${data.validateBeforeCreate ? `await this.validate(data);` : ''}
    ${data.beforeCreate ? data.beforeCreate : ''}

    ${this.useRepository ? `const doc = await this.repository.create(data);` : `const doc = await ${data.name}.create(data);`}

    ${data.afterCreate ? data.afterCreate : ''}

    return doc;
  }

  /**
   * Update ${data.name.toLowerCase()} by ID
   * @param {string} id - ${data.name} ID
   * @param {Object} data - Update data
   * @returns {Promise<Object>}
   */
  async updateById(id, data) {
    ${data.validateBeforeUpdate ? `await this.validate(data, true);` : ''}
    ${data.beforeUpdate ? data.beforeUpdate : ''}

    ${this.useRepository ? `const doc = await this.repository.updateById(id, data);` : `const doc = await ${data.name}.findByIdAndUpdate(id, data, { new: true, runValidators: true });`}

    if (!doc) {
      throw new NotFoundError('${data.name} not found');
    }

    ${data.afterUpdate ? data.afterUpdate : ''}

    return doc;
  }

  /**
   * Delete ${data.name.toLowerCase()} by ID
   * @param {string} id - ${data.name} ID
   * @returns {Promise<Object>}
   */
  async deleteById(id) {
    ${data.beforeDelete ? data.beforeDelete : ''}

    ${this.useRepository ? `const doc = await this.repository.deleteById(id);` : `const doc = await ${data.name}.findByIdAndDelete(id);`}

    if (!doc) {
      throw new NotFoundError('${data.name} not found');
    }

    ${data.afterDelete ? data.afterDelete : ''}

    return doc;
  }

  /**
   * Count ${this.toPlural(data.name).toLowerCase()}
   * @param {Object} filter - Query filters
   * @returns {Promise<number>}
   */
  async count(filter = {}) {
    ${this.useRepository ? `return this.repository.count(filter);` : `return ${data.name}.countDocuments(filter);`}
  }

  /**
   * Check if ${data.name.toLowerCase()} exists
   * @param {Object} filter - Query filters
   * @returns {Promise<boolean>}
   */
  async exists(filter) {
    ${this.useRepository ? `return this.repository.exists(filter);` : `return ${data.name}.exists(filter);`}
  }

${data.customMethods ? data.customMethods : ''}
}

module.exports = {
  ${data.name}Service,
  ${this.toCamelCase(data.name)}Service: new ${data.name}Service()
};
`.trim());

    // Custom service template
    this.registerTemplate('custom', (data) => `
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' Service'}
 */
class ${data.name}Service {
  constructor(${data.dependencies ? data.dependencies.map(d => d.name).join(', ') : ''}) {
    ${data.dependencies ? data.dependencies.map(d => `this.${d.name} = ${d.name};`).join('\n    ') : ''}
  }

${this.generateCustomMethods(data)}
}

module.exports = {
  ${data.name}Service,
  ${this.toCamelCase(data.name)}Service: new ${data.name}Service(${data.dependencies ? data.dependencies.map(d => d.instance || d.name).join(', ') : ''})
};
`.trim());

    // Auth service template
    this.registerTemplate('auth', (data) => `
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
${this.generateImports(data)}

/**
 * Authentication Service
 */
class AuthService {
  constructor() {
    this.userRepository = ${data.userRepository || 'userRepository'};
    this.jwtSecret = process.env.JWT_SECRET || 'your-secret-key';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  /**
   * Register new user
   * @param {Object} userData - User registration data
   * @returns {Promise<Object>}
   */
  async register(userData) {
    // Check if user exists
    const existingUser = await this.userRepository.findOne({ email: userData.email });
    if (existingUser) {
      throw new ConflictError('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(userData.password, 12);

    // Create user
    const user = await this.userRepository.create({
      ...userData,
      password: hashedPassword
    });

    // Generate tokens
    const tokens = this.generateTokens(user);

    return {
      user: this.sanitizeUser(user),
      ...tokens
    };
  }

  /**
   * Login user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    // Find user
    const user = await this.userRepository.findOne({ email }).select('+password');
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials');
    }

    // Check if user is active
    if (user.status && user.status !== 'active') {
      throw new ForbiddenError('Account is not active');
    }

    // Generate tokens
    const tokens = this.generateTokens(user);

    // Update last login
    await this.userRepository.updateById(user._id, { lastLogin: new Date() });

    return {
      user: this.sanitizeUser(user),
      ...tokens
    };
  }

  /**
   * Logout user
   * @param {string} userId - User ID
   * @param {string} refreshToken - Refresh token to invalidate
   * @returns {Promise<void>}
   */
  async logout(userId, refreshToken) {
    // Invalidate refresh token (implement token blacklist if needed)
    // await this.tokenBlacklist.add(refreshToken);
    return { success: true };
  }

  /**
   * Refresh access token
   * @param {string} refreshToken - Refresh token
   * @returns {Promise<Object>}
   */
  async refreshToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshSecret);

      const user = await this.userRepository.findById(decoded.id);
      if (!user) {
        throw new UnauthorizedError('User not found');
      }

      const tokens = this.generateTokens(user);

      return {
        user: this.sanitizeUser(user),
        ...tokens
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }
  }

  /**
   * Generate JWT tokens
   * @param {Object} user - User object
   * @returns {Object}
   */
  generateTokens(user) {
    const accessToken = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn }
    );

    const refreshToken = jwt.sign(
      { id: user._id },
      this.refreshSecret,
      { expiresIn: this.refreshExpiresIn }
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify access token
   * @param {string} token - Access token
   * @returns {Object}
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  /**
   * Request password reset
   * @param {string} email - User email
   * @returns {Promise<Object>}
   */
  async forgotPassword(email) {
    const user = await this.userRepository.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return { message: 'If the email exists, a reset link will be sent' };
    }

    // Generate reset token
    const resetToken = jwt.sign(
      { id: user._id, purpose: 'password-reset' },
      this.jwtSecret,
      { expiresIn: '1h' }
    );

    // TODO: Send email with reset link
    // await emailService.sendPasswordReset(email, resetToken);

    return { message: 'If the email exists, a reset link will be sent', resetToken };
  }

  /**
   * Reset password
   * @param {string} token - Reset token
   * @param {string} newPassword - New password
   * @returns {Promise<Object>}
   */
  async resetPassword(token, newPassword) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);

      if (decoded.purpose !== 'password-reset') {
        throw new UnauthorizedError('Invalid reset token');
      }

      const hashedPassword = await bcrypt.hash(newPassword, 12);

      await this.userRepository.updateById(decoded.id, { password: hashedPassword });

      return { message: 'Password reset successful' };
    } catch (error) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }
  }

  /**
   * Change password
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>}
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.userRepository.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updateById(userId, { password: hashedPassword });

    return { message: 'Password changed successfully' };
  }

  /**
   * Remove sensitive fields from user
   * @param {Object} user - User object
   * @returns {Object}
   */
  sanitizeUser(user) {
    const { password, __v, ...sanitized } = user.toObject ? user.toObject() : user;
    return sanitized;
  }
}

module.exports = {
  AuthService,
  authService: new AuthService()
};
`.trim());

    // External API service template
    this.registerTemplate('external', (data) => `
const axios = require('axios');
${this.generateImports(data)}

/**
 * ${data.description || data.name + ' External API Service'}
 */
class ${data.name}Service {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.${data.envPrefix || data.name.toUpperCase()}_BASE_URL || '${data.baseUrl || 'https://api.example.com'}',
      timeout: ${data.timeout || 30000},
      headers: {
        'Content-Type': 'application/json',
        ${data.apiKeyHeader ? `'${data.apiKeyHeader}': process.env.${data.envPrefix || data.name.toUpperCase()}_API_KEY,` : ''}
      }
    });

    this.setupInterceptors();
  }

  /**
   * Setup request/response interceptors
   */
  setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token if available
        ${data.useAuth ? `const token = process.env.${data.envPrefix || data.name.toUpperCase()}_AUTH_TOKEN;
        if (token) {
          config.headers.Authorization = \`Bearer \${token}\`;
        }` : ''}
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        const message = error.response?.data?.message || error.message;
        console.error(\`${data.name}Service Error:\`, message);
        throw new ExternalServiceError('${data.name}', message);
      }
    );
  }

${this.generateExternalMethods(data)}
}

module.exports = {
  ${data.name}Service,
  ${this.toCamelCase(data.name)}Service: new ${data.name}Service()
};
`.trim());
  }

  /**
   * Generate imports
   */
  generateImports(data) {
    const imports = [];

    if (data.model) {
      imports.push(`const ${data.name} = require('${data.modelPath || '../models/' + data.name}');`);
    }

    if (this.useRepository && data.repository !== false) {
      imports.push(`const { ${this.toCamelCase(data.name)}Repository } = require('${data.repositoryPath || '../models/' + data.name}');`);
    }

    if (data.errors !== false) {
      imports.push(`const { NotFoundError, ConflictError, ValidationError, UnauthorizedError, ForbiddenError, ExternalServiceError } = require('${data.errorsPath || '../utils/errors'}');`);
    }

    if (data.imports) {
      imports.push(...data.imports);
    }

    return imports.join('\n');
  }

  /**
   * Generate custom methods
   */
  generateCustomMethods(data) {
    const methods = data.methods || [];
    if (methods.length === 0) {
      return `  /**
   * Example method
   */
  async exampleMethod() {
    // TODO: Implement
  }`;
    }

    return methods.map(method => {
      const params = method.params ? method.params.map(p => p.name || p).join(', ') : '';
      const isAsync = method.async !== false ? 'async ' : '';
      const jsdoc = this.generateMethodJSDoc(method);

      return `${jsdoc}
  ${isAsync}${method.name}(${params}) {
    ${method.body || '// TODO: Implement ' + method.name}
  }`;
    }).join('\n\n');
  }

  /**
   * Generate external API methods
   */
  generateExternalMethods(data) {
    const endpoints = data.endpoints || [];
    if (endpoints.length === 0) {
      return `  /**
   * Make GET request
   */
  async get(path, params = {}) {
    return this.client.get(path, { params });
  }

  /**
   * Make POST request
   */
  async post(path, data = {}) {
    return this.client.post(path, data);
  }`;
    }

    return endpoints.map(endpoint => {
      const method = endpoint.method || 'get';
      const params = endpoint.params ? endpoint.params.map(p => p.name || p).join(', ') : '';
      const jsdoc = this.generateMethodJSDoc(endpoint);

      let body;
      if (method === 'get' || method === 'delete') {
        body = `return this.client.${method}('${endpoint.path}'${endpoint.queryParams ? `, { params: { ${endpoint.queryParams.join(', ')} } }` : ''});`;
      } else {
        body = `return this.client.${method}('${endpoint.path}', ${endpoint.dataParam || 'data'});`;
      }

      return `${jsdoc}
  async ${endpoint.name}(${params}) {
    ${endpoint.body || body}
  }`;
    }).join('\n\n');
  }

  /**
   * Generate JSDoc for method
   */
  generateMethodJSDoc(method) {
    const lines = ['/**'];

    if (method.description) {
      lines.push(`   * ${method.description}`);
    }

    if (method.params && method.params.length > 0) {
      method.params.forEach(param => {
        const name = param.name || param;
        const type = param.type || 'any';
        const desc = param.description || '';
        lines.push(`   * @param {${type}} ${name} - ${desc}`);
      });
    }

    if (method.returns) {
      lines.push(`   * @returns {${method.returns.type || 'Promise'}} ${method.returns.description || ''}`);
    }

    lines.push('   */');
    return lines.join('\n');
  }

  /**
   * Generate a service
   * @param {Object} spec - Service specification
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
          type: { type: 'string', enum: Object.values(SERVICE_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const templateName = spec.type || SERVICE_TYPE.CRUD;

      // Build output path
      const fileName = this.toKebabCase(spec.name) + '.service.js';
      const outputPath = spec.outputPath || `src/services/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.BACKEND_SERVICE_GENERATED, {
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

export function getServiceGenerator(options = {}) {
  if (!instance) {
    instance = new ServiceGenerator(options);
  }
  return instance;
}

export default ServiceGenerator;
