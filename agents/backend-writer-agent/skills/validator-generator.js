/**
 * ValidatorGenerator - Validation Schema Code Generation Skill
 *
 * Generates validation schemas:
 * - Joi schemas
 * - Zod schemas
 * - Request validation
 * - Custom validators
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * Validator library types
 */
export const VALIDATOR_LIB = {
  JOI: 'joi',
  ZOD: 'zod'
};

/**
 * Common field types
 */
export const FIELD_TYPE = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATE: 'date',
  EMAIL: 'email',
  URL: 'url',
  UUID: 'uuid',
  OBJECT_ID: 'objectId',
  ARRAY: 'array',
  OBJECT: 'object',
  ENUM: 'enum',
  PHONE: 'phone',
  PASSWORD: 'password'
};

/**
 * ValidatorGenerator Skill
 */
export class ValidatorGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ValidatorGenerator', {
      language: LANGUAGE.JAVASCRIPT,
      ...options
    });

    this.defaultLib = options.validatorLib || VALIDATOR_LIB.JOI;
    this.registerTemplates();
  }

  registerTemplates() {
    // Joi validator template
    this.registerTemplate('joi', (data) => `
const Joi = require('joi');

/**
 * ${data.description || data.name + ' Validation Schemas'}
 */

${this.generateJoiCommonSchemas(data)}

${this.generateJoiSchemas(data)}

module.exports = {
  ${this.generateJoiExports(data)}
};
`.trim());

    // Zod validator template
    this.registerTemplate('zod', (data) => `
const { z } = require('zod');

/**
 * ${data.description || data.name + ' Validation Schemas'}
 */

${this.generateZodCommonSchemas(data)}

${this.generateZodSchemas(data)}

module.exports = {
  ${this.generateZodExports(data)}
};
`.trim());

    // CRUD validator template (Joi)
    this.registerTemplate('joiCrud', (data) => `
const Joi = require('joi');

/**
 * ${data.name} Validation Schemas
 */

// Common ObjectId validation
const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');

// Pagination schema
const paginationSchema = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string().valid(${(data.sortFields || ['createdAt', 'updatedAt']).map(f => `'${f}', '-${f}'`).join(', ')}),
  ${data.searchField ? `search: Joi.string().max(100),` : ''}
};

/**
 * Create ${data.name} validation
 */
const create = {
  body: Joi.object({
${this.generateJoiFields(data.fields, 'create')}
  })
};

/**
 * Update ${data.name} validation
 */
const update = {
  params: Joi.object({
    id: objectId.required()
  }),
  body: Joi.object({
${this.generateJoiFields(data.fields, 'update')}
  })
};

/**
 * Get ${data.name} by ID validation
 */
const getById = {
  params: Joi.object({
    id: objectId.required()
  })
};

/**
 * Get all ${this.toPlural(data.name)} validation
 */
const getAll = {
  query: Joi.object({
    ...paginationSchema,
${this.generateJoiFilterFields(data.filterFields || data.fields)}
  })
};

/**
 * Delete ${data.name} validation
 */
const deleteById = {
  params: Joi.object({
    id: objectId.required()
  })
};

${data.customValidations || ''}

module.exports = {
  create,
  update,
  getById,
  getAll,
  delete: deleteById,
  ${data.customExports || ''}
};
`.trim());

    // Auth validator template
    this.registerTemplate('joiAuth', (data) => `
const Joi = require('joi');

/**
 * Authentication Validation Schemas
 */

// Password requirements
const passwordSchema = Joi.string()
  .min(${data.minPasswordLength || 8})
  .max(128)
  ${data.requireUppercase ? `.regex(/[A-Z]/).message('Password must contain at least one uppercase letter')` : ''}
  ${data.requireLowercase ? `.regex(/[a-z]/).message('Password must contain at least one lowercase letter')` : ''}
  ${data.requireNumber ? `.regex(/[0-9]/).message('Password must contain at least one number')` : ''}
  ${data.requireSpecial ? `.regex(/[!@#$%^&*(),.?":{}|<>]/).message('Password must contain at least one special character')` : ''};

// Email schema
const emailSchema = Joi.string()
  .email()
  .lowercase()
  .trim()
  .max(255);

// Phone schema
const phoneSchema = Joi.string()
  .pattern(/^\\+?[1-9]\\d{1,14}$/)
  .message('Invalid phone number format');

/**
 * Register validation
 */
const register = {
  body: Joi.object({
    ${data.registerFields ? this.generateJoiFieldsInline(data.registerFields) : `email: emailSchema.required(),
    password: passwordSchema.required(),
    name: Joi.string().min(2).max(100).required(),
    ${data.requirePhone ? 'phone: phoneSchema.required(),' : ''}`}
  })
};

/**
 * Login validation
 */
const login = {
  body: Joi.object({
    ${data.loginWithPhone ? `identifier: Joi.alternatives().try(emailSchema, phoneSchema).required(),` : `email: emailSchema.required(),`}
    password: Joi.string().required()
  })
};

/**
 * Forgot password validation
 */
const forgotPassword = {
  body: Joi.object({
    email: emailSchema.required()
  })
};

/**
 * Reset password validation
 */
const resetPassword = {
  body: Joi.object({
    token: Joi.string().required(),
    password: passwordSchema.required(),
    confirmPassword: Joi.string().valid(Joi.ref('password')).required()
      .messages({ 'any.only': 'Passwords must match' })
  })
};

/**
 * Change password validation
 */
const changePassword = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: passwordSchema.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'Passwords must match' })
  })
};

${data.includeOtp ? `
/**
 * Send OTP validation
 */
const sendOtp = {
  body: Joi.object({
    ${data.otpViaPhone ? 'phone: phoneSchema.required()' : 'email: emailSchema.required()'}
  })
};

/**
 * Verify OTP validation
 */
const verifyOtp = {
  body: Joi.object({
    ${data.otpViaPhone ? 'phone: phoneSchema.required(),' : 'email: emailSchema.required(),'}
    otp: Joi.string().length(${data.otpLength || 6}).pattern(/^[0-9]+$/).required()
  })
};
` : ''}

/**
 * Refresh token validation
 */
const refreshToken = {
  body: Joi.object({
    refreshToken: Joi.string().required()
  })
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  refreshToken,
  ${data.includeOtp ? 'sendOtp,\n  verifyOtp,' : ''}
  passwordSchema,
  emailSchema,
  phoneSchema
};
`.trim());
  }

  /**
   * Generate Joi common schemas
   */
  generateJoiCommonSchemas(data) {
    if (!data.includeCommon) return '';

    return `
// Common schemas
const objectId = Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format');
const email = Joi.string().email().lowercase().trim();
const phone = Joi.string().pattern(/^\\+?[1-9]\\d{1,14}$/);
const uuid = Joi.string().uuid();
const pagination = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  sort: Joi.string()
};
`;
  }

  /**
   * Generate Joi schemas from spec
   */
  generateJoiSchemas(data) {
    const schemas = data.schemas || [];
    if (schemas.length === 0) return '';

    return schemas.map(schema => {
      return `
/**
 * ${schema.description || schema.name + ' schema'}
 */
const ${schema.name} = ${schema.isMiddleware ? '{\n  body: ' : ''}Joi.object({
${this.generateJoiFields(schema.fields, schema.context)}
})${schema.isMiddleware ? '\n}' : ''};`;
    }).join('\n');
  }

  /**
   * Generate Joi fields
   */
  generateJoiFields(fields = [], context = 'create') {
    if (!fields || fields.length === 0) {
      return '    // Add fields here';
    }

    return fields.map(field => {
      let schema = this.fieldToJoi(field);

      // Handle required based on context
      if (context === 'update') {
        // All fields optional for update
        schema = schema.replace('.required()', '');
      } else if (field.required) {
        if (!schema.includes('.required()')) {
          schema += '.required()';
        }
      }

      return `    ${field.name}: ${schema}`;
    }).join(',\n');
  }

  /**
   * Generate Joi fields inline (for auth schemas)
   */
  generateJoiFieldsInline(fields = []) {
    return fields.map(field => {
      let schema = this.fieldToJoi(field);
      if (field.required && !schema.includes('.required()')) {
        schema += '.required()';
      }
      return `${field.name}: ${schema},`;
    }).join('\n    ');
  }

  /**
   * Generate Joi filter fields
   */
  generateJoiFilterFields(fields = []) {
    if (!fields || fields.length === 0) return '';

    return fields
      .filter(f => f.filterable !== false)
      .map(field => {
        let schema = this.fieldToJoi({ ...field, required: false });
        // Remove required for filters
        schema = schema.replace('.required()', '');
        return `    ${field.name}: ${schema}`;
      }).join(',\n');
  }

  /**
   * Convert field to Joi schema
   */
  fieldToJoi(field) {
    const type = field.type || FIELD_TYPE.STRING;

    let schema;

    switch (type) {
      case FIELD_TYPE.STRING:
        schema = 'Joi.string()';
        if (field.min) schema += `.min(${field.min})`;
        if (field.max) schema += `.max(${field.max})`;
        if (field.pattern) schema += `.pattern(${field.pattern})`;
        if (field.trim) schema += '.trim()';
        if (field.lowercase) schema += '.lowercase()';
        if (field.uppercase) schema += '.uppercase()';
        break;

      case FIELD_TYPE.NUMBER:
        schema = 'Joi.number()';
        if (field.integer) schema += '.integer()';
        if (field.min !== undefined) schema += `.min(${field.min})`;
        if (field.max !== undefined) schema += `.max(${field.max})`;
        if (field.positive) schema += '.positive()';
        break;

      case FIELD_TYPE.BOOLEAN:
        schema = 'Joi.boolean()';
        break;

      case FIELD_TYPE.DATE:
        schema = 'Joi.date()';
        if (field.iso) schema += '.iso()';
        break;

      case FIELD_TYPE.EMAIL:
        schema = 'Joi.string().email().lowercase().trim()';
        break;

      case FIELD_TYPE.URL:
        schema = 'Joi.string().uri()';
        break;

      case FIELD_TYPE.UUID:
        schema = 'Joi.string().uuid()';
        break;

      case FIELD_TYPE.OBJECT_ID:
        schema = "Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format')";
        break;

      case FIELD_TYPE.ARRAY:
        const itemSchema = field.items ? this.fieldToJoi(field.items) : 'Joi.any()';
        schema = `Joi.array().items(${itemSchema})`;
        if (field.min) schema += `.min(${field.min})`;
        if (field.max) schema += `.max(${field.max})`;
        break;

      case FIELD_TYPE.OBJECT:
        if (field.properties) {
          const props = Object.entries(field.properties)
            .map(([key, val]) => `${key}: ${this.fieldToJoi(val)}`)
            .join(', ');
          schema = `Joi.object({ ${props} })`;
        } else {
          schema = 'Joi.object()';
        }
        break;

      case FIELD_TYPE.ENUM:
        schema = `Joi.string().valid(${field.values.map(v => `'${v}'`).join(', ')})`;
        break;

      case FIELD_TYPE.PHONE:
        schema = "Joi.string().pattern(/^\\+?[1-9]\\d{1,14}$/).message('Invalid phone number')";
        break;

      case FIELD_TYPE.PASSWORD:
        schema = `Joi.string().min(${field.min || 8}).max(${field.max || 128})`;
        break;

      default:
        schema = 'Joi.any()';
    }

    // Add default value
    if (field.default !== undefined) {
      schema += `.default(${JSON.stringify(field.default)})`;
    }

    // Add custom messages
    if (field.message) {
      schema += `.messages({ 'any.required': '${field.message}' })`;
    }

    return schema;
  }

  /**
   * Generate Joi exports
   */
  generateJoiExports(data) {
    const exports = [];

    if (data.includeCommon) {
      exports.push('objectId', 'email', 'phone', 'uuid', 'pagination');
    }

    if (data.schemas) {
      exports.push(...data.schemas.map(s => s.name));
    }

    return exports.join(',\n  ');
  }

  /**
   * Generate Zod common schemas
   */
  generateZodCommonSchemas(data) {
    if (!data.includeCommon) return '';

    return `
// Common schemas
const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');
const email = z.string().email().toLowerCase().trim();
const phone = z.string().regex(/^\\+?[1-9]\\d{1,14}$/, 'Invalid phone number');
const uuid = z.string().uuid();
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional()
});
`;
  }

  /**
   * Generate Zod schemas
   */
  generateZodSchemas(data) {
    const schemas = data.schemas || [];
    if (schemas.length === 0) return '';

    return schemas.map(schema => {
      return `
/**
 * ${schema.description || schema.name + ' schema'}
 */
const ${schema.name} = z.object({
${this.generateZodFields(schema.fields)}
});`;
    }).join('\n');
  }

  /**
   * Generate Zod fields
   */
  generateZodFields(fields = []) {
    if (!fields || fields.length === 0) {
      return '  // Add fields here';
    }

    return fields.map(field => {
      const schema = this.fieldToZod(field);
      return `  ${field.name}: ${schema}`;
    }).join(',\n');
  }

  /**
   * Convert field to Zod schema
   */
  fieldToZod(field) {
    const type = field.type || FIELD_TYPE.STRING;
    let schema;

    switch (type) {
      case FIELD_TYPE.STRING:
        schema = 'z.string()';
        if (field.min) schema += `.min(${field.min})`;
        if (field.max) schema += `.max(${field.max})`;
        if (field.pattern) schema += `.regex(${field.pattern})`;
        if (field.trim) schema += '.trim()';
        if (field.lowercase) schema += '.toLowerCase()';
        break;

      case FIELD_TYPE.NUMBER:
        schema = field.integer ? 'z.number().int()' : 'z.number()';
        if (field.min !== undefined) schema += `.min(${field.min})`;
        if (field.max !== undefined) schema += `.max(${field.max})`;
        if (field.positive) schema += '.positive()';
        break;

      case FIELD_TYPE.BOOLEAN:
        schema = 'z.boolean()';
        break;

      case FIELD_TYPE.DATE:
        schema = 'z.coerce.date()';
        break;

      case FIELD_TYPE.EMAIL:
        schema = 'z.string().email().toLowerCase().trim()';
        break;

      case FIELD_TYPE.URL:
        schema = 'z.string().url()';
        break;

      case FIELD_TYPE.UUID:
        schema = 'z.string().uuid()';
        break;

      case FIELD_TYPE.OBJECT_ID:
        schema = "z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format')";
        break;

      case FIELD_TYPE.ARRAY:
        const itemSchema = field.items ? this.fieldToZod(field.items) : 'z.any()';
        schema = `z.array(${itemSchema})`;
        if (field.min) schema += `.min(${field.min})`;
        if (field.max) schema += `.max(${field.max})`;
        break;

      case FIELD_TYPE.OBJECT:
        if (field.properties) {
          const props = Object.entries(field.properties)
            .map(([key, val]) => `${key}: ${this.fieldToZod(val)}`)
            .join(', ');
          schema = `z.object({ ${props} })`;
        } else {
          schema = 'z.record(z.any())';
        }
        break;

      case FIELD_TYPE.ENUM:
        schema = `z.enum([${field.values.map(v => `'${v}'`).join(', ')}])`;
        break;

      case FIELD_TYPE.PHONE:
        schema = "z.string().regex(/^\\+?[1-9]\\d{1,14}$/, 'Invalid phone number')";
        break;

      case FIELD_TYPE.PASSWORD:
        schema = `z.string().min(${field.min || 8}).max(${field.max || 128})`;
        break;

      default:
        schema = 'z.any()';
    }

    // Handle optional
    if (!field.required) {
      schema += '.optional()';
    }

    // Add default value
    if (field.default !== undefined) {
      schema += `.default(${JSON.stringify(field.default)})`;
    }

    return schema;
  }

  /**
   * Generate Zod exports
   */
  generateZodExports(data) {
    const exports = [];

    if (data.includeCommon) {
      exports.push('objectId', 'email', 'phone', 'uuid', 'pagination');
    }

    if (data.schemas) {
      exports.push(...data.schemas.map(s => s.name));
    }

    return exports.join(',\n  ');
  }

  /**
   * Generate a validator
   * @param {Object} spec - Validator specification
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
          lib: { type: 'string', enum: Object.values(VALIDATOR_LIB) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      let templateName = spec.lib || this.defaultLib;
      if (spec.type === 'crud') {
        templateName = 'joiCrud';
      } else if (spec.type === 'auth') {
        templateName = 'joiAuth';
      }

      // Build output path
      const fileName = this.toKebabCase(spec.name) + '.validator.js';
      const outputPath = spec.outputPath || `src/validators/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.BACKEND_VALIDATOR_GENERATED, {
          name: spec.name,
          lib: spec.lib || this.defaultLib,
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

export function getValidatorGenerator(options = {}) {
  if (!instance) {
    instance = new ValidatorGenerator(options);
  }
  return instance;
}

export default ValidatorGenerator;
