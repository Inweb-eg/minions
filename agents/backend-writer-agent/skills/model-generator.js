/**
 * ModelGenerator - Backend Model Code Generation Skill
 *
 * Generates database models:
 * - Mongoose schemas
 * - Sequelize models
 * - Validation rules
 * - Indexes and virtuals
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';
import { EventTypes } from '../../../foundation/event-bus/eventTypes.js';

/**
 * ORM types
 */
export const ORM_TYPE = {
  MONGOOSE: 'mongoose',
  SEQUELIZE: 'sequelize'
};

/**
 * Field types for Mongoose
 */
export const MONGOOSE_TYPE = {
  STRING: 'String',
  NUMBER: 'Number',
  BOOLEAN: 'Boolean',
  DATE: 'Date',
  OBJECT_ID: 'Schema.Types.ObjectId',
  ARRAY: 'Array',
  MIXED: 'Schema.Types.Mixed',
  BUFFER: 'Buffer',
  DECIMAL: 'Schema.Types.Decimal128',
  MAP: 'Map'
};

/**
 * ModelGenerator Skill
 */
export class ModelGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('ModelGenerator', {
      language: LANGUAGE.JAVASCRIPT,
      ...options
    });

    this.defaultOrm = options.orm || ORM_TYPE.MONGOOSE;
    this.registerTemplates();
  }

  registerTemplates() {
    // Mongoose model template
    this.registerTemplate('mongoose', (data) => `
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
${data.imports || ''}

/**
 * ${data.description || data.name + ' Schema'}
 */
const ${this.toCamelCase(data.name)}Schema = new Schema({
${this.generateMongooseFields(data.fields)}
}${this.generateSchemaOptions(data)});

${this.generateIndexes(data)}

${this.generateVirtuals(data)}

${this.generateMethods(data)}

${this.generateStatics(data)}

${this.generateMiddleware(data)}

${this.generateToJSON(data)}

const ${data.name} = mongoose.model('${data.name}', ${this.toCamelCase(data.name)}Schema);

module.exports = ${data.name};
`.trim());

    // Sequelize model template
    this.registerTemplate('sequelize', (data) => `
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
${data.imports || ''}

/**
 * ${data.description || data.name + ' Model'}
 */
const ${data.name} = sequelize.define('${data.name}', {
${this.generateSequelizeFields(data.fields)}
}${this.generateSequelizeOptions(data)});

${this.generateAssociations(data)}

${this.generateSequelizeHooks(data)}

module.exports = ${data.name};
`.trim());

    // Model with repository pattern
    this.registerTemplate('mongooseWithRepo', (data) => `
const mongoose = require('mongoose');
const Schema = mongoose.Schema;
${data.imports || ''}

/**
 * ${data.description || data.name + ' Schema'}
 */
const ${this.toCamelCase(data.name)}Schema = new Schema({
${this.generateMongooseFields(data.fields)}
}${this.generateSchemaOptions(data)});

${this.generateIndexes(data)}

${this.generateVirtuals(data)}

${this.generateMethods(data)}

${this.generateStatics(data)}

${this.generateMiddleware(data)}

${this.generateToJSON(data)}

const ${data.name} = mongoose.model('${data.name}', ${this.toCamelCase(data.name)}Schema);

/**
 * ${data.name} Repository
 */
class ${data.name}Repository {
  /**
   * Find all ${this.toPlural(data.name).toLowerCase()}
   */
  async findAll(filter = {}, options = {}) {
    const query = ${data.name}.find(filter);

    if (options.sort) query.sort(options.sort);
    if (options.limit) query.limit(options.limit);
    if (options.skip) query.skip(options.skip);
    if (options.populate) query.populate(options.populate);

    return query.exec();
  }

  /**
   * Find by ID
   */
  async findById(id, options = {}) {
    const query = ${data.name}.findById(id);
    if (options.populate) query.populate(options.populate);
    return query.exec();
  }

  /**
   * Find one
   */
  async findOne(filter, options = {}) {
    const query = ${data.name}.findOne(filter);
    if (options.populate) query.populate(options.populate);
    return query.exec();
  }

  /**
   * Create
   */
  async create(data) {
    const doc = new ${data.name}(data);
    return doc.save();
  }

  /**
   * Update by ID
   */
  async updateById(id, data, options = { new: true }) {
    return ${data.name}.findByIdAndUpdate(id, data, options);
  }

  /**
   * Delete by ID
   */
  async deleteById(id) {
    return ${data.name}.findByIdAndDelete(id);
  }

  /**
   * Count documents
   */
  async count(filter = {}) {
    return ${data.name}.countDocuments(filter);
  }

  /**
   * Check if exists
   */
  async exists(filter) {
    return ${data.name}.exists(filter);
  }
}

module.exports = {
  ${data.name},
  ${data.name}Repository,
  ${this.toCamelCase(data.name)}Repository: new ${data.name}Repository()
};
`.trim());
  }

  /**
   * Generate Mongoose fields
   */
  generateMongooseFields(fields = []) {
    if (!fields || fields.length === 0) {
      return '  // Add fields here';
    }

    return fields.map(field => {
      const options = [];

      // Type
      if (field.ref) {
        options.push(`type: Schema.Types.ObjectId`);
        options.push(`ref: '${field.ref}'`);
      } else if (field.type === 'Array' && field.of) {
        if (field.ofRef) {
          options.push(`type: [{ type: Schema.Types.ObjectId, ref: '${field.ofRef}' }]`);
        } else {
          options.push(`type: [${field.of}]`);
        }
      } else if (field.enum) {
        options.push(`type: ${field.type || 'String'}`);
        options.push(`enum: [${field.enum.map(e => typeof e === 'string' ? `'${e}'` : e).join(', ')}]`);
      } else {
        options.push(`type: ${field.type || 'String'}`);
      }

      // Required
      if (field.required) {
        options.push(`required: ${typeof field.required === 'string' ? `[true, '${field.required}']` : 'true'}`);
      }

      // Default
      if (field.default !== undefined) {
        if (typeof field.default === 'string') {
          options.push(`default: '${field.default}'`);
        } else if (typeof field.default === 'function') {
          options.push(`default: ${field.default.toString()}`);
        } else {
          options.push(`default: ${JSON.stringify(field.default)}`);
        }
      }

      // Unique
      if (field.unique) {
        options.push(`unique: true`);
      }

      // Index
      if (field.index) {
        options.push(`index: true`);
      }

      // Trim (for strings)
      if (field.trim) {
        options.push(`trim: true`);
      }

      // Lowercase/Uppercase
      if (field.lowercase) {
        options.push(`lowercase: true`);
      }
      if (field.uppercase) {
        options.push(`uppercase: true`);
      }

      // Min/Max
      if (field.min !== undefined) {
        options.push(`min: ${field.min}`);
      }
      if (field.max !== undefined) {
        options.push(`max: ${field.max}`);
      }

      // MinLength/MaxLength
      if (field.minLength !== undefined) {
        options.push(`minlength: ${field.minLength}`);
      }
      if (field.maxLength !== undefined) {
        options.push(`maxlength: ${field.maxLength}`);
      }

      // Select
      if (field.select === false) {
        options.push(`select: false`);
      }

      // Immutable
      if (field.immutable) {
        options.push(`immutable: true`);
      }

      const optionsStr = options.join(',\n    ');
      return `  ${field.name}: {\n    ${optionsStr}\n  }`;
    }).join(',\n');
  }

  /**
   * Generate schema options
   */
  generateSchemaOptions(data) {
    const options = [];

    if (data.timestamps !== false) {
      options.push('timestamps: true');
    }

    if (data.collection) {
      options.push(`collection: '${data.collection}'`);
    }

    if (data.versionKey === false) {
      options.push('versionKey: false');
    }

    if (data.strict === false) {
      options.push('strict: false');
    }

    if (data.toJSON) {
      options.push('toJSON: { virtuals: true }');
    }

    if (data.toObject) {
      options.push('toObject: { virtuals: true }');
    }

    if (options.length === 0) {
      return ', { timestamps: true }';
    }

    return `, {\n  ${options.join(',\n  ')}\n}`;
  }

  /**
   * Generate indexes
   */
  generateIndexes(data) {
    if (!data.indexes || data.indexes.length === 0) return '';

    return data.indexes.map(index => {
      const fields = JSON.stringify(index.fields);
      const options = index.options ? `, ${JSON.stringify(index.options)}` : '';
      return `${this.toCamelCase(data.name)}Schema.index(${fields}${options});`;
    }).join('\n');
  }

  /**
   * Generate virtuals
   */
  generateVirtuals(data) {
    if (!data.virtuals || data.virtuals.length === 0) return '';

    return data.virtuals.map(virtual => {
      let code = `${this.toCamelCase(data.name)}Schema.virtual('${virtual.name}')`;

      if (virtual.ref) {
        // Populate virtual
        code += `\n  .get(function() {\n    return this._${virtual.name};\n  })`;
        code = `${this.toCamelCase(data.name)}Schema.virtual('${virtual.name}', {
  ref: '${virtual.ref}',
  localField: '${virtual.localField || '_id'}',
  foreignField: '${virtual.foreignField}'${virtual.justOne ? ',\n  justOne: true' : ''}
});`;
      } else {
        // Computed virtual
        code += `\n  .get(function() {\n    ${virtual.get || 'return null;'}\n  })`;
        if (virtual.set) {
          code += `\n  .set(function(value) {\n    ${virtual.set}\n  })`;
        }
      }

      return code;
    }).join('\n\n');
  }

  /**
   * Generate instance methods
   */
  generateMethods(data) {
    if (!data.methods || data.methods.length === 0) return '';

    return data.methods.map(method => {
      const params = method.params ? method.params.join(', ') : '';
      const isAsync = method.async !== false ? 'async ' : '';
      return `${this.toCamelCase(data.name)}Schema.methods.${method.name} = ${isAsync}function(${params}) {
  ${method.body || '// TODO: Implement ' + method.name}
};`;
    }).join('\n\n');
  }

  /**
   * Generate static methods
   */
  generateStatics(data) {
    if (!data.statics || data.statics.length === 0) return '';

    return data.statics.map(method => {
      const params = method.params ? method.params.join(', ') : '';
      const isAsync = method.async !== false ? 'async ' : '';
      return `${this.toCamelCase(data.name)}Schema.statics.${method.name} = ${isAsync}function(${params}) {
  ${method.body || '// TODO: Implement ' + method.name}
};`;
    }).join('\n\n');
  }

  /**
   * Generate middleware (pre/post hooks)
   */
  generateMiddleware(data) {
    if (!data.middleware || data.middleware.length === 0) return '';

    return data.middleware.map(hook => {
      const isAsync = hook.async !== false ? 'async ' : '';
      const next = hook.async === false ? 'next' : '';
      return `${this.toCamelCase(data.name)}Schema.${hook.type}('${hook.action}', ${isAsync}function(${next}) {
  ${hook.body || '// TODO: Implement hook'}
});`;
    }).join('\n\n');
  }

  /**
   * Generate toJSON transformation
   */
  generateToJSON(data) {
    if (!data.transformJSON) return '';

    return `${this.toCamelCase(data.name)}Schema.set('toJSON', {
  transform: function(doc, ret) {
    ${data.transformJSON}
    return ret;
  }
});`;
  }

  /**
   * Generate Sequelize fields
   */
  generateSequelizeFields(fields = []) {
    if (!fields || fields.length === 0) {
      return '  // Add fields here';
    }

    return fields.map(field => {
      const options = [];

      // Type
      options.push(`type: DataTypes.${this.toSequelizeType(field.type)}`);

      // AllowNull
      if (field.required) {
        options.push(`allowNull: false`);
      }

      // Default
      if (field.default !== undefined) {
        if (typeof field.default === 'string') {
          options.push(`defaultValue: '${field.default}'`);
        } else {
          options.push(`defaultValue: ${JSON.stringify(field.default)}`);
        }
      }

      // Unique
      if (field.unique) {
        options.push(`unique: true`);
      }

      // Primary Key
      if (field.primaryKey) {
        options.push(`primaryKey: true`);
      }

      // Auto Increment
      if (field.autoIncrement) {
        options.push(`autoIncrement: true`);
      }

      // References
      if (field.ref) {
        options.push(`references: {\n      model: '${field.ref}',\n      key: '${field.refKey || 'id'}'\n    }`);
      }

      // Validate
      if (field.validate) {
        options.push(`validate: ${JSON.stringify(field.validate)}`);
      }

      const optionsStr = options.join(',\n    ');
      return `  ${field.name}: {\n    ${optionsStr}\n  }`;
    }).join(',\n');
  }

  /**
   * Convert to Sequelize type
   */
  toSequelizeType(type) {
    const typeMap = {
      'String': 'STRING',
      'Number': 'INTEGER',
      'Boolean': 'BOOLEAN',
      'Date': 'DATE',
      'Float': 'FLOAT',
      'Double': 'DOUBLE',
      'Decimal': 'DECIMAL',
      'Text': 'TEXT',
      'JSON': 'JSON',
      'UUID': 'UUID',
      'BLOB': 'BLOB'
    };
    return typeMap[type] || 'STRING';
  }

  /**
   * Generate Sequelize options
   */
  generateSequelizeOptions(data) {
    const options = [];

    if (data.tableName) {
      options.push(`tableName: '${data.tableName}'`);
    }

    if (data.timestamps !== false) {
      options.push('timestamps: true');
    } else {
      options.push('timestamps: false');
    }

    if (data.paranoid) {
      options.push('paranoid: true');
    }

    if (data.underscored) {
      options.push('underscored: true');
    }

    if (options.length === 0) return '';

    return `, {\n  ${options.join(',\n  ')}\n}`;
  }

  /**
   * Generate associations
   */
  generateAssociations(data) {
    if (!data.associations || data.associations.length === 0) return '';

    return data.associations.map(assoc => {
      const options = assoc.options ? `, ${JSON.stringify(assoc.options)}` : '';
      return `${data.name}.${assoc.type}(${assoc.model}${options});`;
    }).join('\n');
  }

  /**
   * Generate Sequelize hooks
   */
  generateSequelizeHooks(data) {
    if (!data.hooks || data.hooks.length === 0) return '';

    return data.hooks.map(hook => {
      const isAsync = hook.async !== false ? 'async ' : '';
      return `${data.name}.addHook('${hook.type}', ${isAsync}(${hook.params || 'instance'}) => {
  ${hook.body || '// TODO: Implement hook'}
});`;
    }).join('\n\n');
  }

  /**
   * Generate a model
   * @param {Object} spec - Model specification
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
          orm: { type: 'string', enum: Object.values(ORM_TYPE) }
        }
      });

      if (!validation.valid) {
        this.failRun(new Error(validation.errors.join(', ')));
        return { success: false, errors: validation.errors };
      }

      // Determine template
      const orm = spec.orm || this.defaultOrm;
      let templateName = orm;
      if (spec.withRepository && orm === ORM_TYPE.MONGOOSE) {
        templateName = 'mongooseWithRepo';
      }

      // Build output path
      const fileName = spec.name + '.js';
      const outputPath = spec.outputPath || `src/models/${fileName}`;

      // Generate and write
      const result = await this.generateAndWrite(spec, templateName, outputPath, {
        overwrite: spec.overwrite || false
      });

      if (result.success) {
        this.publish(EventTypes.BACKEND_MODEL_GENERATED, {
          name: spec.name,
          orm,
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

export function getModelGenerator(options = {}) {
  if (!instance) {
    instance = new ModelGenerator(options);
  }
  return instance;
}

export default ModelGenerator;
