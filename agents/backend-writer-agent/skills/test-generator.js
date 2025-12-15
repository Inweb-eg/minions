/**
 * Backend Test Generator Skill
 *
 * Generates Node.js/Express test code including:
 * - API endpoint tests
 * - Service unit tests
 * - Controller tests
 * - Integration tests
 */

import { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from '../../writer-skills/BaseWriterSkill.js';

export const BACKEND_TEST_TYPE = {
  API: 'api',
  SERVICE: 'service',
  CONTROLLER: 'controller',
  MIDDLEWARE: 'middleware',
  MODEL: 'model',
  INTEGRATION: 'integration'
};

export const TEST_FRAMEWORK = {
  JEST: 'jest',
  MOCHA: 'mocha',
  AVA: 'ava'
};

export class BackendTestGenerator extends BaseWriterSkill {
  constructor(options = {}) {
    super('backend-test-generator', options);
    this.loadTemplates();
  }

  loadTemplates() {
    // API/Route test template (Jest + Supertest)
    this.loadTemplate('api-test', `const request = require('supertest');
const app = require('{{appPath}}');
{{#mockImports}}
{{.}}
{{/mockImports}}

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

describe('{{routeName}} API', () => {
  {{#setup}}
  {{.}}
  {{/setup}}

  beforeEach(async () => {
    {{#beforeEach}}
    {{.}}
    {{/beforeEach}}
  });

  afterEach(async () => {
    {{#afterEach}}
    {{.}}
    {{/afterEach}}
  });

{{#endpoints}}
  describe('{{method}} {{path}}', () => {
{{#tests}}
    it('{{description}}', async () => {
      {{#arrange}}
      {{.}}
      {{/arrange}}

      const response = await request(app)
        .{{methodLower}}('{{fullPath}}')
        {{#headers}}
        .set('{{name}}', {{value}})
        {{/headers}}
        {{#body}}
        .send({{.}})
        {{/body}};

      {{#assertions}}
      {{.}}
      {{/assertions}}
    });

{{/tests}}
  });

{{/endpoints}}
});
`);

    // Service test template
    this.loadTemplate('service-test', `{{#imports}}
const {{name}} = require('{{path}}');
{{/imports}}

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

describe('{{serviceName}}', () => {
  let service;
  {{#dependencies}}
  let mock{{Name}};
  {{/dependencies}}

  beforeEach(() => {
    jest.clearAllMocks();
    {{#dependencies}}
    mock{{Name}} = {{mockValue}};
    {{/dependencies}}
    service = new {{serviceName}}({{#dependencies}}mock{{Name}}{{^last}}, {{/last}}{{/dependencies}});
  });

{{#methods}}
  describe('{{name}}', () => {
{{#tests}}
    it('{{description}}', async () => {
      // Arrange
      {{#arrange}}
      {{.}}
      {{/arrange}}

      // Act
      {{#act}}
      const result = await service.{{methodName}}({{params}});
      {{/act}}

      // Assert
      {{#assertions}}
      {{.}}
      {{/assertions}}
    });

{{/tests}}
  });

{{/methods}}
});
`);

    // Controller test template
    this.loadTemplate('controller-test', `const {{controllerName}} = require('{{controllerPath}}');
{{#imports}}
const {{name}} = require('{{path}}');
{{/imports}}

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

describe('{{controllerName}}', () => {
  let controller;
  let mockReq;
  let mockRes;
  let mockNext;
  {{#dependencies}}
  let mock{{Name}};
  {{/dependencies}}

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      params: {},
      query: {},
      body: {},
      user: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();

    {{#dependencies}}
    mock{{Name}} = {{mockValue}};
    {{/dependencies}}

    controller = new {{controllerName}}({{#dependencies}}mock{{Name}}{{^last}}, {{/last}}{{/dependencies}});
  });

{{#methods}}
  describe('{{name}}', () => {
{{#tests}}
    it('{{description}}', async () => {
      // Arrange
      {{#arrange}}
      {{.}}
      {{/arrange}}

      // Act
      await controller.{{methodName}}(mockReq, mockRes, mockNext);

      // Assert
      {{#assertions}}
      {{.}}
      {{/assertions}}
    });

{{/tests}}
  });

{{/methods}}
});
`);

    // Middleware test template
    this.loadTemplate('middleware-test', `const {{middlewareName}} = require('{{middlewarePath}}');
{{#imports}}
const {{name}} = require('{{path}}');
{{/imports}}

{{#mocks}}
jest.mock('{{path}}', () => ({{mock}}));
{{/mocks}}

describe('{{middlewareName}} middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockReq = {
      headers: {},
      params: {},
      query: {},
      body: {},
      user: null
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

{{#tests}}
  it('{{description}}', async () => {
    // Arrange
    {{#arrange}}
    {{.}}
    {{/arrange}}

    // Act
    await {{middlewareName}}(mockReq, mockRes, mockNext);

    // Assert
    {{#assertions}}
    {{.}}
    {{/assertions}}
  });

{{/tests}}
});
`);

    // Model test template
    this.loadTemplate('model-test', `const mongoose = require('mongoose');
const {{modelName}} = require('{{modelPath}}');

describe('{{modelName}} Model', () => {
  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await {{modelName}}.deleteMany({});
  });

{{#tests}}
  it('{{description}}', async () => {
    // Arrange
    {{#arrange}}
    {{.}}
    {{/arrange}}

    // Act
    {{#act}}
    {{.}}
    {{/act}}

    // Assert
    {{#assertions}}
    {{.}}
    {{/assertions}}
  });

{{/tests}}

  describe('validation', () => {
{{#validationTests}}
    it('{{description}}', async () => {
      const doc = new {{modelName}}({{data}});
      {{#shouldFail}}
      await expect(doc.validate()).rejects.toThrow();
      {{/shouldFail}}
      {{^shouldFail}}
      await expect(doc.validate()).resolves.not.toThrow();
      {{/shouldFail}}
    });

{{/validationTests}}
  });

{{#methods}}
  describe('{{name}}', () => {
    it('should {{description}}', async () => {
      {{#testCode}}
      {{.}}
      {{/testCode}}
    });
  });

{{/methods}}
});
`);

    // Integration test template
    this.loadTemplate('integration-test', `const request = require('supertest');
const mongoose = require('mongoose');
const app = require('{{appPath}}');
{{#imports}}
const {{name}} = require('{{path}}');
{{/imports}}

describe('{{testName}} Integration Tests', () => {
  {{#setup}}
  {{.}}
  {{/setup}}

  beforeAll(async () => {
    await mongoose.connect(process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/test');
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    // Clean up database
    {{#collections}}
    await mongoose.connection.collection('{{.}}').deleteMany({});
    {{/collections}}
  });

{{#scenarios}}
  describe('{{name}}', () => {
{{#steps}}
    it('step {{index}}: {{description}}', async () => {
      {{#code}}
      {{.}}
      {{/code}}
    });

{{/steps}}
  });

{{/scenarios}}
});
`);
  }

  /**
   * Generate backend test
   */
  async generate(spec) {
    const validation = this.validateSpec(spec, {
      required: ['name', 'type'],
      optional: ['target', 'framework', 'imports', 'mocks', 'tests', 'endpoints', 'methods', 'scenarios']
    });

    if (!validation.valid) {
      return {
        success: false,
        errors: validation.errors
      };
    }

    const framework = spec.framework || TEST_FRAMEWORK.JEST;
    let code;
    let filePath;

    switch (spec.type) {
      case BACKEND_TEST_TYPE.API:
        code = this.generateApiTest(spec);
        filePath = `tests/api/${spec.name}.test.js`;
        break;

      case BACKEND_TEST_TYPE.SERVICE:
        code = this.generateServiceTest(spec);
        filePath = `tests/services/${spec.name}.service.test.js`;
        break;

      case BACKEND_TEST_TYPE.CONTROLLER:
        code = this.generateControllerTest(spec);
        filePath = `tests/controllers/${spec.name}.controller.test.js`;
        break;

      case BACKEND_TEST_TYPE.MIDDLEWARE:
        code = this.generateMiddlewareTest(spec);
        filePath = `tests/middleware/${spec.name}.middleware.test.js`;
        break;

      case BACKEND_TEST_TYPE.MODEL:
        code = this.generateModelTest(spec);
        filePath = `tests/models/${spec.name}.model.test.js`;
        break;

      case BACKEND_TEST_TYPE.INTEGRATION:
        code = this.generateIntegrationTest(spec);
        filePath = `tests/integration/${spec.name}.test.js`;
        break;

      default:
        return {
          success: false,
          errors: [`Unknown test type: ${spec.type}`]
        };
    }

    code = await this.formatCode(code, LANGUAGE.JAVASCRIPT);

    if (!this.options.dryRun && this.outputPath) {
      const fullPath = `${this.outputPath}/${filePath}`;
      await this.writeFile(fullPath, code);
    }

    return {
      success: true,
      code,
      filePath,
      type: spec.type,
      framework
    };
  }

  generateApiTest(spec) {
    const data = {
      routeName: spec.name,
      appPath: spec.appPath || '../src/app',
      mockImports: spec.mockImports || [],
      mocks: spec.mocks || [],
      setup: spec.setup || [],
      beforeEach: spec.beforeEach || [],
      afterEach: spec.afterEach || [],
      endpoints: spec.endpoints || this.generateDefaultEndpointTests(spec)
    };

    return this.renderTemplate('api-test', data);
  }

  generateDefaultEndpointTests(spec) {
    const basePath = spec.basePath || `/api/${spec.name.toLowerCase()}`;
    return [
      {
        method: 'GET',
        methodLower: 'get',
        path: '/',
        fullPath: basePath,
        tests: [
          {
            description: 'should return all items',
            arrange: [],
            headers: [{ name: 'Authorization', value: "'Bearer token'" }],
            assertions: [
              'expect(response.status).toBe(200);',
              'expect(Array.isArray(response.body)).toBe(true);'
            ]
          }
        ]
      },
      {
        method: 'GET',
        methodLower: 'get',
        path: '/:id',
        fullPath: `${basePath}/1`,
        tests: [
          {
            description: 'should return item by id',
            arrange: [],
            headers: [{ name: 'Authorization', value: "'Bearer token'" }],
            assertions: [
              'expect(response.status).toBe(200);',
              'expect(response.body).toHaveProperty(\'id\');'
            ]
          },
          {
            description: 'should return 404 for non-existent item',
            arrange: [],
            headers: [{ name: 'Authorization', value: "'Bearer token'" }],
            assertions: ['expect(response.status).toBe(404);']
          }
        ]
      },
      {
        method: 'POST',
        methodLower: 'post',
        path: '/',
        fullPath: basePath,
        tests: [
          {
            description: 'should create new item',
            arrange: [],
            headers: [{ name: 'Authorization', value: "'Bearer token'" }],
            body: '{ name: "Test Item" }',
            assertions: [
              'expect(response.status).toBe(201);',
              'expect(response.body).toHaveProperty(\'id\');'
            ]
          },
          {
            description: 'should return 400 for invalid data',
            arrange: [],
            headers: [{ name: 'Authorization', value: "'Bearer token'" }],
            body: '{}',
            assertions: ['expect(response.status).toBe(400);']
          }
        ]
      }
    ];
  }

  generateServiceTest(spec) {
    const data = {
      serviceName: spec.name,
      imports: spec.imports || [{ name: spec.name, path: `../src/services/${spec.name.toLowerCase()}.service` }],
      mocks: spec.mocks || [],
      dependencies: this.prepareDependencies(spec.dependencies || []),
      methods: spec.methods || this.generateDefaultServiceMethods(spec)
    };

    return this.renderTemplate('service-test', data);
  }

  generateDefaultServiceMethods(spec) {
    return [
      {
        name: 'findAll',
        tests: [
          {
            description: 'should return all items',
            arrange: [],
            act: { methodName: 'findAll', params: '' },
            assertions: ['expect(result).toBeDefined();', 'expect(Array.isArray(result)).toBe(true);']
          }
        ]
      },
      {
        name: 'findById',
        tests: [
          {
            description: 'should return item by id',
            arrange: [],
            act: { methodName: 'findById', params: "'1'" },
            assertions: ['expect(result).toBeDefined();']
          },
          {
            description: 'should return null for non-existent id',
            arrange: [],
            act: { methodName: 'findById', params: "'999'" },
            assertions: ['expect(result).toBeNull();']
          }
        ]
      },
      {
        name: 'create',
        tests: [
          {
            description: 'should create new item',
            arrange: [],
            act: { methodName: 'create', params: "{ name: 'Test' }" },
            assertions: ['expect(result).toBeDefined();', 'expect(result.id).toBeDefined();']
          }
        ]
      }
    ];
  }

  generateControllerTest(spec) {
    const data = {
      controllerName: spec.name,
      controllerPath: spec.controllerPath || `../src/controllers/${spec.name.toLowerCase()}.controller`,
      imports: spec.imports || [],
      mocks: spec.mocks || [],
      dependencies: this.prepareDependencies(spec.dependencies || []),
      methods: spec.methods || this.generateDefaultControllerMethods(spec)
    };

    return this.renderTemplate('controller-test', data);
  }

  generateDefaultControllerMethods(spec) {
    return [
      {
        name: 'list',
        tests: [
          {
            description: 'should return 200 with list of items',
            arrange: [],
            methodName: 'list',
            assertions: [
              'expect(mockRes.status).toHaveBeenCalledWith(200);',
              'expect(mockRes.json).toHaveBeenCalled();'
            ]
          }
        ]
      },
      {
        name: 'getById',
        tests: [
          {
            description: 'should return 200 with item',
            arrange: ["mockReq.params.id = '1';"],
            methodName: 'getById',
            assertions: ['expect(mockRes.status).toHaveBeenCalledWith(200);']
          },
          {
            description: 'should return 404 when item not found',
            arrange: ["mockReq.params.id = '999';"],
            methodName: 'getById',
            assertions: ['expect(mockRes.status).toHaveBeenCalledWith(404);']
          }
        ]
      }
    ];
  }

  generateMiddlewareTest(spec) {
    const data = {
      middlewareName: spec.name,
      middlewarePath: spec.middlewarePath || `../src/middleware/${spec.name.toLowerCase()}.middleware`,
      imports: spec.imports || [],
      mocks: spec.mocks || [],
      tests: spec.tests || this.generateDefaultMiddlewareTests(spec)
    };

    return this.renderTemplate('middleware-test', data);
  }

  generateDefaultMiddlewareTests(spec) {
    return [
      {
        description: 'should call next() on success',
        arrange: [],
        assertions: ['expect(mockNext).toHaveBeenCalled();']
      },
      {
        description: 'should return 401 on failure',
        arrange: [],
        assertions: ['expect(mockRes.status).toHaveBeenCalledWith(401);']
      }
    ];
  }

  generateModelTest(spec) {
    const data = {
      modelName: spec.name,
      modelPath: spec.modelPath || `../src/models/${spec.name}`,
      tests: spec.tests || this.generateDefaultModelTests(spec),
      validationTests: spec.validationTests || this.generateDefaultValidationTests(spec),
      methods: spec.methods || []
    };

    return this.renderTemplate('model-test', data);
  }

  generateDefaultModelTests(spec) {
    return [
      {
        description: 'should create and save successfully',
        arrange: [],
        act: [`const doc = new ${spec.name}({ name: 'Test' });`, 'const saved = await doc.save();'],
        assertions: ['expect(saved._id).toBeDefined();', "expect(saved.name).toBe('Test');"]
      }
    ];
  }

  generateDefaultValidationTests(spec) {
    const fields = spec.fields || [];
    return fields
      .filter(f => f.required)
      .map(field => ({
        description: `should require ${field.name}`,
        data: '{}',
        shouldFail: true
      }));
  }

  generateIntegrationTest(spec) {
    const data = {
      testName: spec.name,
      appPath: spec.appPath || '../src/app',
      imports: spec.imports || [],
      setup: spec.setup || [],
      collections: spec.collections || [spec.name.toLowerCase()],
      scenarios: spec.scenarios || this.generateDefaultScenarios(spec)
    };

    return this.renderTemplate('integration-test', data);
  }

  generateDefaultScenarios(spec) {
    return [
      {
        name: `${spec.name} CRUD flow`,
        steps: [
          {
            index: 1,
            description: 'Create item',
            code: [
              `const createResponse = await request(app)`,
              `  .post('/api/${spec.name.toLowerCase()}')`,
              `  .send({ name: 'Test Item' });`,
              'expect(createResponse.status).toBe(201);',
              'const itemId = createResponse.body.id;'
            ]
          },
          {
            index: 2,
            description: 'Read item',
            code: [
              'const readResponse = await request(app)',
              `  .get(\`/api/${spec.name.toLowerCase()}/\${itemId}\`);`,
              'expect(readResponse.status).toBe(200);'
            ]
          },
          {
            index: 3,
            description: 'Update item',
            code: [
              'const updateResponse = await request(app)',
              `  .put(\`/api/${spec.name.toLowerCase()}/\${itemId}\`)`,
              `  .send({ name: 'Updated Item' });`,
              'expect(updateResponse.status).toBe(200);'
            ]
          },
          {
            index: 4,
            description: 'Delete item',
            code: [
              'const deleteResponse = await request(app)',
              `  .delete(\`/api/${spec.name.toLowerCase()}/\${itemId}\`);`,
              'expect(deleteResponse.status).toBe(204);'
            ]
          }
        ]
      }
    ];
  }

  prepareDependencies(deps) {
    return deps.map((dep, index) => ({
      ...dep,
      Name: dep.name.charAt(0).toUpperCase() + dep.name.slice(1),
      mockValue: dep.mockValue || '{}',
      last: index === deps.length - 1
    }));
  }
}

// Singleton instance
let instance = null;

export function getBackendTestGenerator(options = {}) {
  if (!instance) {
    instance = new BackendTestGenerator(options);
  }
  return instance;
}

export default BackendTestGenerator;
