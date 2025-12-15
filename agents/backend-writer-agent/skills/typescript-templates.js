/**
 * TypeScript Templates for Backend Writer
 *
 * Provides TypeScript versions of all backend templates.
 * Used when typescript: true is configured.
 */

/**
 * TypeScript Route Template (CRUD)
 */
export const routeCrudTemplate = (data) => `
import { Router, Request, Response, NextFunction } from 'express';
${generateTsImports(data)}

const router = Router();

/**
 * ${data.description || data.name + ' routes'}
 * Base path: ${data.basePath || '/' + toKebabCase(data.name)}
 */

${generateTsMiddlewareUse(data)}

// GET ${data.basePath || '/' + toKebabCase(data.name)} - List all ${toPlural(data.name)}
router.get(
  '/',
  ${generateTsRouteMiddleware(data, 'list')}
  ${data.controllerName || toCamelCase(data.name) + 'Controller'}.getAll
);

// GET ${data.basePath || '/' + toKebabCase(data.name)}/:id - Get single ${data.name}
router.get(
  '/:id',
  ${generateTsRouteMiddleware(data, 'get')}
  ${data.controllerName || toCamelCase(data.name) + 'Controller'}.getById
);

// POST ${data.basePath || '/' + toKebabCase(data.name)} - Create new ${data.name}
router.post(
  '/',
  ${generateTsRouteMiddleware(data, 'create')}
  ${data.controllerName || toCamelCase(data.name) + 'Controller'}.create
);

// PUT ${data.basePath || '/' + toKebabCase(data.name)}/:id - Update ${data.name}
router.put(
  '/:id',
  ${generateTsRouteMiddleware(data, 'update')}
  ${data.controllerName || toCamelCase(data.name) + 'Controller'}.update
);

// DELETE ${data.basePath || '/' + toKebabCase(data.name)}/:id - Delete ${data.name}
router.delete(
  '/:id',
  ${generateTsRouteMiddleware(data, 'delete')}
  ${data.controllerName || toCamelCase(data.name) + 'Controller'}.delete
);

export default router;
`.trim();

/**
 * TypeScript Model Template (Mongoose)
 */
export const modelMongooseTemplate = (data) => `
import mongoose, { Schema, Document, Model } from 'mongoose';
${data.useBcrypt ? "import bcrypt from 'bcryptjs';" : ''}
${data.useJwt ? "import jwt from 'jsonwebtoken';" : ''}

/**
 * ${data.name} interface
 */
export interface I${data.name} {
${(data.fields || []).map(f => `  ${f.name}${f.required ? '' : '?'}: ${mongooseTypeToTs(f.type)}${f.isArray ? '[]' : ''};`).join('\n')}
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * ${data.name} document interface
 */
export interface I${data.name}Document extends I${data.name}, Document {
${(data.methods || []).map(m => `  ${m.name}(${m.params || ''}): ${m.returnType || 'Promise<void>'};`).join('\n')}
}

/**
 * ${data.name} model interface
 */
export interface I${data.name}Model extends Model<I${data.name}Document> {
${(data.statics || []).map(s => `  ${s.name}(${s.params || ''}): ${s.returnType || 'Promise<any>'};`).join('\n')}
}

/**
 * ${data.name} Schema
 */
const ${toCamelCase(data.name)}Schema = new Schema<I${data.name}Document>(
  {
${(data.fields || []).map(f => generateTsMongooseField(f)).join('\n')}
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc: Document, ret: Record<string, unknown>) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        ${data.hidePassword ? "delete ret.password;" : ''}
        return ret;
      },
    },
  }
);

// Indexes
${(data.indexes || []).map(idx => `${toCamelCase(data.name)}Schema.index(${JSON.stringify(idx.fields)}${idx.options ? ', ' + JSON.stringify(idx.options) : ''});`).join('\n')}

// Pre-save middleware
${toCamelCase(data.name)}Schema.pre('save', async function(next) {
${data.hashPassword ? `
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 10);
  }
` : ''}
  next();
});

// Instance methods
${(data.methods || []).map(m => `
${toCamelCase(data.name)}Schema.methods.${m.name} = ${m.async ? 'async ' : ''}function(${m.params || ''})${m.returnType ? ': ' + m.returnType : ''} {
  ${m.body || '// TODO: Implement'}
};
`).join('\n')}

// Static methods
${(data.statics || []).map(s => `
${toCamelCase(data.name)}Schema.statics.${s.name} = ${s.async ? 'async ' : ''}function(${s.params || ''})${s.returnType ? ': ' + s.returnType : ''} {
  ${s.body || '// TODO: Implement'}
};
`).join('\n')}

const ${data.name} = mongoose.model<I${data.name}Document, I${data.name}Model>('${data.name}', ${toCamelCase(data.name)}Schema);

export default ${data.name};
`.trim();

/**
 * TypeScript Service Template
 */
export const serviceTemplate = (data) => `
import ${data.name} from '${data.modelPath || '../models/' + data.name}';
${data.useRepository ? `import { ${toCamelCase(data.name)}Repository } from '${data.repositoryPath || '../repositories/' + toKebabCase(data.name) + '.repository'}';` : ''}
${data.imports?.map(i => `import ${i.name} from '${i.path}';`).join('\n') || ''}

/**
 * ${data.name} Service
 *
 * ${data.description || 'Business logic for ' + data.name}
 */
export class ${data.name}Service {
  ${data.useRepository ? `private repository: ${toCamelCase(data.name)}Repository;` : ''}

  constructor(${data.useRepository ? `repository?: ${toCamelCase(data.name)}Repository` : ''}) {
    ${data.useRepository ? `this.repository = repository || new ${toCamelCase(data.name)}Repository();` : ''}
  }

  /**
   * Find all ${toPlural(data.name.toLowerCase())}
   */
  async findAll(options: { page?: number; limit?: number; filter?: Record<string, unknown> } = {}): Promise<any[]> {
    const { page = 1, limit = 10, filter = {} } = options;
    ${data.useRepository
      ? 'return this.repository.findAll({ page, limit, filter });'
      : `return ${data.name}.find(filter).skip((page - 1) * limit).limit(limit);`
    }
  }

  /**
   * Find ${data.name.toLowerCase()} by ID
   */
  async findById(id: string): Promise<any | null> {
    ${data.useRepository
      ? 'return this.repository.findById(id);'
      : `return ${data.name}.findById(id);`
    }
  }

  /**
   * Create new ${data.name.toLowerCase()}
   */
  async create(data: Record<string, unknown>): Promise<any> {
    ${data.useRepository
      ? 'return this.repository.create(data);'
      : `const doc = new ${data.name}(data);\n    return doc.save();`
    }
  }

  /**
   * Update ${data.name.toLowerCase()} by ID
   */
  async update(id: string, data: Record<string, unknown>): Promise<any | null> {
    ${data.useRepository
      ? 'return this.repository.update(id, data);'
      : `return ${data.name}.findByIdAndUpdate(id, data, { new: true, runValidators: true });`
    }
  }

  /**
   * Delete ${data.name.toLowerCase()} by ID
   */
  async delete(id: string): Promise<boolean> {
    ${data.useRepository
      ? 'return this.repository.delete(id);'
      : `const result = await ${data.name}.findByIdAndDelete(id);\n    return !!result;`
    }
  }

${(data.customMethods || []).map(m => `
  /**
   * ${m.description || m.name}
   */
  async ${m.name}(${m.params || ''}): Promise<${m.returnType || 'any'}> {
    ${m.body || '// TODO: Implement'}
  }
`).join('\n')}
}

export const ${toCamelCase(data.name)}Service = new ${data.name}Service();
export default ${data.name}Service;
`.trim();

/**
 * TypeScript Controller Template
 */
export const controllerTemplate = (data) => `
import { Request, Response, NextFunction } from 'express';
import { ${data.serviceName || data.name + 'Service'} } from '${data.servicePath || '../services/' + toKebabCase(data.name) + '.service'}';
${data.imports?.map(i => `import ${i.name} from '${i.path}';`).join('\n') || ''}

/**
 * ${data.name} Controller
 *
 * ${data.description || 'Request handlers for ' + data.name}
 */
export class ${data.name}Controller {
  private service: ${data.serviceName || data.name + 'Service'};

  constructor(service?: ${data.serviceName || data.name + 'Service'}) {
    this.service = service || ${toCamelCase(data.serviceName || data.name + 'Service')};

    // Bind methods
    this.getAll = this.getAll.bind(this);
    this.getById = this.getById.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
  }

  /**
   * Get all ${toPlural(data.name.toLowerCase())}
   */
  async getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10, ...filter } = req.query;
      const items = await this.service.findAll({
        page: Number(page),
        limit: Number(limit),
        filter
      });
      res.json({ success: true, data: items });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get ${data.name.toLowerCase()} by ID
   */
  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const item = await this.service.findById(id);

      if (!item) {
        res.status(404).json({ success: false, message: '${data.name} not found' });
        return;
      }

      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create new ${data.name.toLowerCase()}
   */
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const item = await this.service.create(req.body);
      res.status(201).json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update ${data.name.toLowerCase()} by ID
   */
  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const item = await this.service.update(id, req.body);

      if (!item) {
        res.status(404).json({ success: false, message: '${data.name} not found' });
        return;
      }

      res.json({ success: true, data: item });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete ${data.name.toLowerCase()} by ID
   */
  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = await this.service.delete(id);

      if (!deleted) {
        res.status(404).json({ success: false, message: '${data.name} not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }

${(data.customMethods || []).map(m => `
  /**
   * ${m.description || m.name}
   */
  async ${m.name}(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      ${m.body || '// TODO: Implement'}
    } catch (error) {
      next(error);
    }
  }
`).join('\n')}
}

export const ${toCamelCase(data.name)}Controller = new ${data.name}Controller();
export default ${data.name}Controller;
`.trim();

/**
 * TypeScript Middleware Template
 */
export const middlewareAuthTemplate = (data) => `
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
${data.userModel ? `import ${data.userModel} from '${data.userModelPath || '../models/' + data.userModel}';` : ''}

interface JwtPayload {
  userId: string;
  role?: string;
  [key: string]: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * ${data.name || 'Auth'} Middleware
 *
 * ${data.description || 'JWT authentication middleware'}
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Verify token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || '${data.jwtSecret || 'your-secret-key'}'
    ) as JwtPayload;

    // Attach user to request
    req.user = decoded;

    ${data.fetchUser ? `
    // Optionally fetch full user
    if (decoded.userId) {
      const user = await ${data.userModel}.findById(decoded.userId);
      if (!user) {
        res.status(401).json({ success: false, message: 'User not found' });
        return;
      }
      req.user = { ...decoded, ...user.toObject() };
    }
    ` : ''}

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, message: 'Token expired' });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }
    next(error);
  }
};

/**
 * Authorize by role
 */
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!roles.includes(req.user.role || '')) {
      res.status(403).json({ success: false, message: 'Not authorized' });
      return;
    }

    next();
  };
};

export default { authenticate, authorize };
`.trim();

/**
 * TypeScript Validator Template (Joi)
 */
export const validatorJoiTemplate = (data) => `
import Joi, { Schema } from 'joi';
import { Request, Response, NextFunction } from 'express';

/**
 * ${data.name} Validators
 *
 * ${data.description || 'Joi validation schemas for ' + data.name}
 */

${(data.schemas || []).map(schema => `
/**
 * ${schema.name} schema
 */
export const ${schema.name}Schema: Schema = Joi.object({
${(schema.fields || []).map(f => `  ${f.name}: ${generateJoiField(f)},`).join('\n')}
});
`).join('\n')}

/**
 * Validation middleware factory
 */
const validate = (schema: Schema, property: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req[property], { abortEarly: false });

    if (error) {
      const errors = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
      return;
    }

    next();
  };
};

/**
 * ${data.name} validator middleware
 */
export const ${toCamelCase(data.name)}Validator = {
${(data.schemas || []).map(s => `  ${s.action || s.name}: validate(${s.name}Schema, '${s.property || 'body'}'),`).join('\n')}
};

export default ${toCamelCase(data.name)}Validator;
`.trim();

// Helper functions
function generateTsImports(data) {
  const imports = [];

  if (data.controller) {
    imports.push(`import ${data.controllerName || toCamelCase(data.name) + 'Controller'} from '${data.controllerPath || '../controllers/' + toKebabCase(data.name) + '.controller'}';`);
  }

  if (data.validator) {
    imports.push(`import { ${data.validatorName || toCamelCase(data.name) + 'Validator'} } from '${data.validatorPath || '../validators/' + toKebabCase(data.name) + '.validator'}';`);
  }

  if (data.middleware) {
    data.middleware.forEach(m => {
      if (typeof m === 'string') {
        imports.push(`import { ${m} } from '${data.middlewarePath || '../middleware'}';`);
      } else {
        imports.push(`import { ${m.name} } from '${m.path || '../middleware'}';`);
      }
    });
  }

  return imports.join('\n');
}

function generateTsMiddlewareUse(data) {
  if (!data.globalMiddleware || data.globalMiddleware.length === 0) return '';

  return data.globalMiddleware.map(m => {
    if (typeof m === 'string') {
      return `router.use(${m});`;
    }
    return `router.use(${m.name});`;
  }).join('\n');
}

function generateTsRouteMiddleware(data, action) {
  const middleware = [];

  if (data.protected !== false && data.authMiddleware) {
    middleware.push(data.authMiddleware);
  }

  if (data.validator) {
    const validatorName = data.validatorName || toCamelCase(data.name) + 'Validator';
    if (action === 'create') {
      middleware.push(`${validatorName}.create`);
    } else if (action === 'update') {
      middleware.push(`${validatorName}.update`);
    }
  }

  if (middleware.length === 0) return '';
  return middleware.join(',\n  ') + ',';
}

function generateTsMongooseField(field) {
  const opts = [];

  opts.push(`type: ${mongooseTypeToSchema(field.type)}`);

  if (field.required) opts.push('required: true');
  if (field.unique) opts.push('unique: true');
  if (field.default !== undefined) opts.push(`default: ${JSON.stringify(field.default)}`);
  if (field.enum) opts.push(`enum: ${JSON.stringify(field.enum)}`);
  if (field.ref) opts.push(`ref: '${field.ref}'`);
  if (field.select === false) opts.push('select: false');
  if (field.index) opts.push('index: true');

  return `    ${field.name}: { ${opts.join(', ')} },`;
}

function mongooseTypeToTs(type) {
  const typeMap = {
    'String': 'string',
    'Number': 'number',
    'Boolean': 'boolean',
    'Date': 'Date',
    'ObjectId': 'string',
    'Mixed': 'any',
    'Buffer': 'Buffer'
  };
  return typeMap[type] || 'any';
}

function mongooseTypeToSchema(type) {
  const schemaTypes = ['String', 'Number', 'Boolean', 'Date', 'Buffer'];
  if (schemaTypes.includes(type)) return type;
  if (type === 'ObjectId') return 'Schema.Types.ObjectId';
  if (type === 'Mixed') return 'Schema.Types.Mixed';
  return type;
}

function generateJoiField(field) {
  let schema = `Joi.${field.joiType || 'string'}()`;

  if (field.required) schema += '.required()';
  if (field.min !== undefined) schema += `.min(${field.min})`;
  if (field.max !== undefined) schema += `.max(${field.max})`;
  if (field.email) schema += '.email()';
  if (field.pattern) schema += `.pattern(${field.pattern})`;
  if (field.valid) schema += `.valid(${field.valid.map(v => `'${v}'`).join(', ')})`;

  return schema;
}

function toKebabCase(str) {
  return str.replace(/([A-Z])/g, (match, p1, offset) => {
    return (offset > 0 ? '-' : '') + p1.toLowerCase();
  }).replace(/^-/, '');
}

function toCamelCase(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function toPlural(str) {
  if (str.endsWith('y')) return str.slice(0, -1) + 'ies';
  if (str.endsWith('s') || str.endsWith('x') || str.endsWith('ch') || str.endsWith('sh')) return str + 'es';
  return str + 's';
}

export default {
  routeCrudTemplate,
  modelMongooseTemplate,
  serviceTemplate,
  controllerTemplate,
  middlewareAuthTemplate,
  validatorJoiTemplate
};
