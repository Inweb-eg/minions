# Backend Writer Agent

A specialized code generation agent for Node.js/Express backend applications with 6 skills for generating routes, models, services, middleware, validators, and controllers.

## Features

- **RouteGenerator** - Generate Express routes with middleware support
- **ModelGenerator** - Generate Mongoose/Sequelize models
- **ServiceGenerator** - Generate service layer with repository pattern
- **MiddlewareGenerator** - Generate auth, validation, and rate limiting middleware
- **ValidatorGenerator** - Generate Joi/Zod validation schemas
- **ControllerGenerator** - Generate REST controllers with error handling

## Installation

The Backend Writer Agent is included in the minions package:

```javascript
import { getBackendWriterAgent } from 'minions';
```

## Quick Start

```javascript
import { getBackendWriterAgent } from 'minions';

const backend = getBackendWriterAgent();

// Configure the agent
await backend.configure({
  projectPath: './my-backend',
  orm: 'mongoose',
  validator: 'joi'
});

// Initialize
await backend.initialize();

// Generate a route
const route = await backend.generateRoute({
  name: 'users',
  basePath: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', handler: 'list' },
    { method: 'POST', path: '/', handler: 'create' }
  ]
});
```

## Configuration

```javascript
await backend.configure({
  projectPath: './my-backend',      // Backend project root
  framework: 'express',             // Web framework
  orm: 'mongoose',                  // 'mongoose' | 'sequelize'
  validator: 'joi',                 // 'joi' | 'zod'
  typescript: false,                // Use TypeScript
  useRepositoryPattern: true        // Use repository pattern
});
```

## Skills

### RouteGenerator

Generate Express routes with middleware integration.

```javascript
const result = await backend.generateRoute({
  name: 'users',
  basePath: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', handler: 'list', middleware: ['auth'] },
    { method: 'POST', path: '/', handler: 'create', middleware: ['auth', 'validate'] },
    { method: 'GET', path: '/:id', handler: 'getById' },
    { method: 'PUT', path: '/:id', handler: 'update' },
    { method: 'DELETE', path: '/:id', handler: 'delete' }
  ]
});
```

**Route Types:**
- `crud` - Full CRUD routes
- `readonly` - GET only routes
- `custom` - Custom endpoint definitions

### ModelGenerator

Generate Mongoose or Sequelize models.

```javascript
const result = await backend.generateModel({
  name: 'User',
  orm: 'mongoose',
  fields: [
    { name: 'email', type: 'string', required: true, unique: true, index: true },
    { name: 'password', type: 'string', required: true, select: false },
    { name: 'name', type: 'string', required: true },
    { name: 'role', type: 'string', enum: ['admin', 'user'], default: 'user' },
    { name: 'profile', type: 'ref', ref: 'Profile' }
  ],
  timestamps: true,
  methods: ['comparePassword', 'generateToken'],
  statics: ['findByEmail'],
  indexes: [{ fields: { email: 1 }, unique: true }]
});
```

**ORM Types:**
- `mongoose` - MongoDB with Mongoose
- `sequelize` - SQL databases with Sequelize

### ServiceGenerator

Generate service layer with business logic.

```javascript
const result = await backend.generateService({
  name: 'UserService',
  type: 'crud',
  model: 'User',
  methods: [
    { name: 'findByEmail', params: ['email'], returns: 'User' },
    { name: 'updatePassword', params: ['userId', 'newPassword'], returns: 'void' }
  ],
  useRepository: true,
  useTransactions: true
});
```

**Service Types:**
- `crud` - Standard CRUD operations
- `custom` - Custom methods only

### MiddlewareGenerator

Generate Express middleware.

```javascript
const result = await backend.generateMiddleware({
  name: 'auth',
  type: 'auth',
  options: {
    jwtSecret: 'process.env.JWT_SECRET',
    excludePaths: ['/api/auth/login', '/api/auth/register']
  }
});
```

**Middleware Types:**
- `auth` - JWT authentication
- `validation` - Request validation
- `rateLimit` - Rate limiting
- `errorHandler` - Error handling
- `custom` - Custom middleware

### ValidatorGenerator

Generate Joi or Zod validation schemas.

```javascript
const result = await backend.generateValidator({
  name: 'user',
  library: 'joi',
  schemas: {
    create: [
      { field: 'email', type: 'string', rules: ['email', 'required'] },
      { field: 'password', type: 'string', rules: ['min:8', 'required'] },
      { field: 'name', type: 'string', rules: ['required'] }
    ],
    update: [
      { field: 'email', type: 'string', rules: ['email'] },
      { field: 'name', type: 'string' }
    ]
  }
});
```

**Validator Libraries:**
- `joi` - Joi validation
- `zod` - Zod validation

### ControllerGenerator

Generate REST controllers.

```javascript
const result = await backend.generateController({
  name: 'UserController',
  type: 'rest',
  service: 'UserService',
  methods: [
    { name: 'list', httpMethod: 'GET', path: '/' },
    { name: 'create', httpMethod: 'POST', path: '/' },
    { name: 'getById', httpMethod: 'GET', path: '/:id' },
    { name: 'update', httpMethod: 'PUT', path: '/:id' },
    { name: 'delete', httpMethod: 'DELETE', path: '/:id' }
  ]
});
```

**Controller Types:**
- `rest` - RESTful controller
- `custom` - Custom controller

## Output Structure

The agent generates files in the following structure:

```
src/
├── routes/           # Express route files
│   └── user.routes.js
├── models/           # Mongoose/Sequelize models
│   └── User.js
├── services/         # Business logic layer
│   └── user.service.js
├── middleware/       # Express middleware
│   ├── auth.middleware.js
│   └── rateLimit.middleware.js
├── validators/       # Joi/Zod validation schemas
│   └── user.validator.js
└── controllers/      # Request handlers
    └── user.controller.js
```

## Events

The agent publishes the following events:

- `BACKEND_ROUTE_GENERATED` - When a route is generated
- `BACKEND_MODEL_GENERATED` - When a model is generated
- `BACKEND_SERVICE_GENERATED` - When a service is generated
- `BACKEND_MIDDLEWARE_GENERATED` - When middleware is generated
- `BACKEND_VALIDATOR_GENERATED` - When a validator is generated
- `BACKEND_CONTROLLER_GENERATED` - When a controller is generated

## License

MIT
