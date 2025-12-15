/**
 * Backend Writer Agent Example
 *
 * Demonstrates how to use the Backend Writer Agent to generate
 * Node.js/Express backend code including routes, models, services,
 * middleware, validators, and controllers.
 */

import {
  getBackendWriterAgent,
  ROUTE_TYPE,
  ORM_TYPE,
  SERVICE_TYPE,
  MIDDLEWARE_TYPE,
  VALIDATOR_LIB,
  CONTROLLER_TYPE
} from '../index.js';

async function main() {
  console.log('🚀 Backend Writer Agent Example\n');

  // Get the Backend Writer Agent instance
  const backend = getBackendWriterAgent();

  // Configure the agent
  await backend.configure({
    projectPath: './output/backend-app',
    framework: 'express',
    orm: 'mongoose',
    validator: 'joi',
    useRepositoryPattern: true
  });

  // Initialize the agent
  await backend.initialize();
  console.log('✅ Backend Writer Agent initialized\n');

  // 1. Generate Routes
  console.log('📦 Generating user routes...');
  const routes = await backend.generateRoute({
    name: 'users',
    basePath: '/api/users',
    type: ROUTE_TYPE.CRUD,
    controller: 'userController',
    middleware: ['auth', 'validate']
  });

  if (routes.success) {
    console.log(`   ✅ Routes generated: ${routes.filePath}`);
    console.log('   Preview:\n');
    console.log(routes.code.slice(0, 500) + '...\n');
  }

  // 2. Generate Mongoose Model
  console.log('📦 Generating User model...');
  const model = await backend.generateModel({
    name: 'User',
    orm: ORM_TYPE.MONGOOSE,
    fields: [
      { name: 'email', type: 'string', required: true, unique: true, index: true },
      { name: 'password', type: 'string', required: true, select: false },
      { name: 'name', type: 'string', required: true },
      { name: 'role', type: 'string', enum: ['admin', 'user', 'moderator'], default: 'user' },
      { name: 'avatar', type: 'string' },
      { name: 'isActive', type: 'boolean', default: true },
      { name: 'profile', type: 'ref', ref: 'Profile' },
      { name: 'lastLogin', type: 'date' }
    ],
    timestamps: true,
    methods: ['comparePassword', 'generateAuthToken', 'toPublicJSON'],
    statics: ['findByEmail', 'findActiveUsers'],
    indexes: [
      { fields: { email: 1 }, unique: true },
      { fields: { role: 1, isActive: 1 } }
    ]
  });

  if (model.success) {
    console.log(`   ✅ Model generated: ${model.filePath}`);
    console.log('   Preview:\n');
    console.log(model.code.slice(0, 600) + '...\n');
  }

  // 3. Generate Service
  console.log('📦 Generating UserService...');
  const service = await backend.generateService({
    name: 'UserService',
    type: SERVICE_TYPE.CRUD,
    model: 'User',
    useRepository: true,
    useTransactions: true,
    methods: [
      { name: 'findByEmail', params: ['email'], returns: 'User' },
      { name: 'updatePassword', params: ['userId', 'currentPassword', 'newPassword'], returns: 'void' },
      { name: 'activateUser', params: ['userId'], returns: 'User' },
      { name: 'deactivateUser', params: ['userId'], returns: 'User' }
    ]
  });

  if (service.success) {
    console.log(`   ✅ Service generated: ${service.filePath}`);
    console.log('   Preview:\n');
    console.log(service.code.slice(0, 500) + '...\n');
  }

  // 4. Generate Auth Middleware
  console.log('📦 Generating auth middleware...');
  const authMiddleware = await backend.generateMiddleware({
    name: 'auth',
    type: MIDDLEWARE_TYPE.AUTH,
    options: {
      jwtSecret: 'process.env.JWT_SECRET',
      excludePaths: [
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/forgot-password'
      ]
    }
  });

  if (authMiddleware.success) {
    console.log(`   ✅ Auth middleware generated: ${authMiddleware.filePath}`);
    console.log('   Preview:\n');
    console.log(authMiddleware.code.slice(0, 400) + '...\n');
  }

  // 5. Generate Rate Limit Middleware
  console.log('📦 Generating rate limit middleware...');
  const rateLimitMiddleware = await backend.generateMiddleware({
    name: 'rateLimit',
    type: MIDDLEWARE_TYPE.RATE_LIMIT,
    options: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      message: 'Too many requests from this IP, please try again later'
    }
  });

  if (rateLimitMiddleware.success) {
    console.log(`   ✅ Rate limit middleware generated: ${rateLimitMiddleware.filePath}`);
  }

  // 6. Generate Joi Validators
  console.log('📦 Generating user validators...');
  const validators = await backend.generateValidator({
    name: 'user',
    library: VALIDATOR_LIB.JOI,
    schemas: {
      create: [
        { field: 'email', type: 'string', rules: ['email', 'required'] },
        { field: 'password', type: 'string', rules: ['min:8', 'max:100', 'required'] },
        { field: 'name', type: 'string', rules: ['min:2', 'max:50', 'required'] },
        { field: 'role', type: 'string', rules: ['valid:admin,user,moderator'] }
      ],
      update: [
        { field: 'email', type: 'string', rules: ['email'] },
        { field: 'name', type: 'string', rules: ['min:2', 'max:50'] },
        { field: 'avatar', type: 'string', rules: ['uri'] }
      ],
      changePassword: [
        { field: 'currentPassword', type: 'string', rules: ['required'] },
        { field: 'newPassword', type: 'string', rules: ['min:8', 'max:100', 'required'] },
        { field: 'confirmPassword', type: 'string', rules: ['valid:ref:newPassword', 'required'] }
      ]
    }
  });

  if (validators.success) {
    console.log(`   ✅ Validators generated: ${validators.filePath}`);
    console.log('   Preview:\n');
    console.log(validators.code.slice(0, 500) + '...\n');
  }

  // 7. Generate Controller
  console.log('📦 Generating UserController...');
  const controller = await backend.generateController({
    name: 'UserController',
    type: CONTROLLER_TYPE.REST,
    service: 'UserService',
    methods: [
      { name: 'list', httpMethod: 'GET', path: '/' },
      { name: 'create', httpMethod: 'POST', path: '/' },
      { name: 'getById', httpMethod: 'GET', path: '/:id' },
      { name: 'update', httpMethod: 'PUT', path: '/:id' },
      { name: 'delete', httpMethod: 'DELETE', path: '/:id' },
      { name: 'changePassword', httpMethod: 'POST', path: '/:id/change-password' },
      { name: 'activate', httpMethod: 'POST', path: '/:id/activate' },
      { name: 'deactivate', httpMethod: 'POST', path: '/:id/deactivate' }
    ]
  });

  if (controller.success) {
    console.log(`   ✅ Controller generated: ${controller.filePath}`);
    console.log('   Preview:\n');
    console.log(controller.code.slice(0, 500) + '...\n');
  }

  console.log('🎉 All Backend code generation complete!');
  console.log('\nGenerated files structure:');
  console.log(`
./output/backend-app/
├── src/
│   ├── routes/
│   │   └── user.routes.js
│   ├── models/
│   │   └── User.js
│   ├── services/
│   │   └── user.service.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   └── rateLimit.middleware.js
│   ├── validators/
│   │   └── user.validator.js
│   └── controllers/
│       └── user.controller.js
`);
}

main().catch(console.error);
