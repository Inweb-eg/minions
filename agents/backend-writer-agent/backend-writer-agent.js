/**
 * BackendWriterAgent - Backend/Node.js Code Generation Agent
 *
 * Orchestrates backend code generation with 6 specialized skills:
 * - RouteGenerator: Express routes
 * - ModelGenerator: Mongoose/Sequelize models
 * - ServiceGenerator: Service layer
 * - MiddlewareGenerator: Express middleware
 * - ValidatorGenerator: Joi/Zod validators
 * - ControllerGenerator: Request handlers
 */

import { createLogger } from './utils/logger.js';
import { getRouteGenerator } from './skills/route-generator.js';
import { getModelGenerator } from './skills/model-generator.js';
import { getServiceGenerator } from './skills/service-generator.js';
import { getMiddlewareGenerator } from './skills/middleware-generator.js';
import { getValidatorGenerator } from './skills/validator-generator.js';
import { getControllerGenerator } from './skills/controller-generator.js';

// EventBus integration
let getEventBus, EventTypes;
try {
  const eventBusModule = await import('../../foundation/event-bus/AgentEventBus.js');
  const eventTypesModule = await import('../../foundation/event-bus/eventTypes.js');
  getEventBus = eventBusModule.getEventBus;
  EventTypes = eventTypesModule.EventTypes;
} catch (error) {
  getEventBus = null;
  EventTypes = null;
}

const logger = createLogger('Main');

/**
 * BackendWriterAgent
 */
export class BackendWriterAgent {
  constructor(options = {}) {
    this.logger = logger;
    this.initialized = false;

    // Configuration
    this.config = {
      projectPath: options.projectPath || null,
      framework: options.framework || 'express',
      orm: options.orm || 'mongoose',
      validator: options.validator || 'joi',
      useTypeScript: options.useTypeScript || false,
      useRepository: options.useRepository ?? true,
      useService: options.useService ?? true
    };

    // Initialize skills
    this.skills = {
      route: getRouteGenerator({
        outputPath: this.config.projectPath,
        useTypeScript: this.config.useTypeScript
      }),
      model: getModelGenerator({
        outputPath: this.config.projectPath,
        orm: this.config.orm
      }),
      service: getServiceGenerator({
        outputPath: this.config.projectPath,
        useRepository: this.config.useRepository
      }),
      middleware: getMiddlewareGenerator({
        outputPath: this.config.projectPath
      }),
      validator: getValidatorGenerator({
        outputPath: this.config.projectPath,
        validatorLib: this.config.validator
      }),
      controller: getControllerGenerator({
        outputPath: this.config.projectPath,
        useService: this.config.useService
      })
    };

    // EventBus integration
    this.eventBus = getEventBus ? getEventBus() : null;
    this.EventTypes = EventTypes;
    this.unsubscribers = [];
  }

  /**
   * Configure the agent
   * @param {Object} config - Configuration options
   */
  configure(config) {
    Object.assign(this.config, config);

    // Update skill configurations
    if (config.projectPath) {
      Object.values(this.skills).forEach(skill => {
        skill.setOutputPath(config.projectPath);
      });
    }

    if (config.orm) {
      this.skills.model.defaultOrm = config.orm;
    }

    if (config.validator) {
      this.skills.validator.defaultLib = config.validator;
    }

    this.logger.info('BackendWriterAgent configured', config);
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    if (this.initialized) {
      this.logger.debug('BackendWriterAgent already initialized');
      return;
    }

    try {
      this.logger.info('Initializing BackendWriterAgent...');

      // Initialize all skills
      await Promise.all(
        Object.values(this.skills).map(skill => skill.initialize?.())
      );

      // Subscribe to events
      if (this.eventBus) {
        this.subscribeToEvents();
      }

      this.initialized = true;
      this.logger.info('BackendWriterAgent initialized successfully');

      // Publish ready event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_STARTED, {
          agent: 'backend-writer-agent',
          skills: Object.keys(this.skills),
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize BackendWriterAgent:', error);
      throw error;
    }
  }

  /**
   * Subscribe to EventBus events
   */
  subscribeToEvents() {
    // Listen for code generation requests
    this.unsubscribers.push(
      this.eventBus.subscribe(
        this.EventTypes.CODE_GENERATION_REQUESTED,
        'backend-writer-agent',
        this.handleGenerationRequest.bind(this)
      )
    );

    this.logger.info('BackendWriterAgent subscribed to EventBus');
  }

  /**
   * Handle code generation request
   * @param {Object} data - Request data
   */
  async handleGenerationRequest(data) {
    if (data.platform !== 'backend' && data.targetAgent !== 'backend-writer-agent') {
      return;
    }

    this.logger.info(`Received generation request: ${data.type}`);

    // Publish started event
    if (this.eventBus && this.EventTypes) {
      this.eventBus.publish(this.EventTypes.CODE_GENERATION_STARTED, {
        agent: 'backend-writer-agent',
        type: data.type,
        timestamp: new Date().toISOString()
      });
    }

    try {
      let result;

      switch (data.type) {
        case 'route':
          result = await this.generateRoute(data.spec);
          break;
        case 'model':
          result = await this.generateModel(data.spec);
          break;
        case 'service':
          result = await this.generateService(data.spec);
          break;
        case 'middleware':
          result = await this.generateMiddleware(data.spec);
          break;
        case 'validator':
          result = await this.generateValidator(data.spec);
          break;
        case 'controller':
          result = await this.generateController(data.spec);
          break;
        default:
          throw new Error(`Unknown generation type: ${data.type}`);
      }

      // Publish completed event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.CODE_GENERATION_COMPLETED, {
          agent: 'backend-writer-agent',
          type: data.type,
          result,
          timestamp: new Date().toISOString()
        });
      }

      return result;
    } catch (error) {
      this.logger.error(`Generation failed:`, error);

      // Publish failed event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.CODE_GENERATION_FAILED, {
          agent: 'backend-writer-agent',
          type: data.type,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      throw error;
    }
  }

  /**
   * Cleanup subscriptions
   */
  cleanup() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this.logger.info('BackendWriterAgent cleaned up event subscriptions');
  }

  // ==================== Generation Methods ====================

  /**
   * Generate a route
   * @param {Object} spec - Route specification
   * @returns {Promise<Object>} Generation result
   */
  async generateRoute(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.route.generate(spec);
  }

  /**
   * Generate routes index
   * @param {Object} spec - Routes index specification
   * @returns {Promise<Object>} Generation result
   */
  async generateRoutesIndex(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.route.generateIndex(spec);
  }

  /**
   * Generate a model
   * @param {Object} spec - Model specification
   * @returns {Promise<Object>} Generation result
   */
  async generateModel(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.model.generate(spec);
  }

  /**
   * Generate a service
   * @param {Object} spec - Service specification
   * @returns {Promise<Object>} Generation result
   */
  async generateService(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.service.generate(spec);
  }

  /**
   * Generate middleware
   * @param {Object} spec - Middleware specification
   * @returns {Promise<Object>} Generation result
   */
  async generateMiddleware(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.middleware.generate(spec);
  }

  /**
   * Generate a validator
   * @param {Object} spec - Validator specification
   * @returns {Promise<Object>} Generation result
   */
  async generateValidator(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.validator.generate(spec);
  }

  /**
   * Generate a controller
   * @param {Object} spec - Controller specification
   * @returns {Promise<Object>} Generation result
   */
  async generateController(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.controller.generate(spec);
  }

  // ==================== Batch Generation ====================

  /**
   * Generate a complete CRUD resource (model + service + controller + route + validator)
   * @param {Object} spec - Resource specification
   * @returns {Promise<Object>} Generation results
   */
  async generateResource(spec) {
    if (!this.initialized) await this.initialize();

    this.logger.info(`Generating resource: ${spec.name}`);

    const results = {
      model: null,
      service: null,
      controller: null,
      route: null,
      validator: null,
      success: true
    };

    try {
      // Generate model
      if (spec.model !== false) {
        results.model = await this.generateModel({
          name: spec.name,
          fields: spec.fields,
          ...spec.model
        });
      }

      // Generate validator
      if (spec.validator !== false) {
        results.validator = await this.generateValidator({
          name: spec.name,
          type: 'crud',
          fields: spec.fields,
          ...spec.validator
        });
      }

      // Generate service
      if (spec.service !== false) {
        results.service = await this.generateService({
          name: spec.name,
          ...spec.service
        });
      }

      // Generate controller
      if (spec.controller !== false) {
        results.controller = await this.generateController({
          name: spec.name,
          ...spec.controller
        });
      }

      // Generate route
      if (spec.route !== false) {
        results.route = await this.generateRoute({
          name: spec.name,
          type: 'crud',
          controller: true,
          validator: true,
          ...spec.route
        });
      }

      results.success = [results.model, results.service, results.controller, results.route, results.validator]
        .filter(Boolean)
        .every(r => r.success);

      this.logger.info(`Resource ${spec.name} generated successfully`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to generate resource ${spec.name}:`, error);
      results.success = false;
      results.error = error.message;
      return results;
    }
  }

  /**
   * Generate auth module (routes + controller + service + validators)
   * @param {Object} spec - Auth specification
   * @returns {Promise<Object>} Generation results
   */
  async generateAuthModule(spec = {}) {
    if (!this.initialized) await this.initialize();

    this.logger.info('Generating auth module');

    const results = {
      route: null,
      controller: null,
      service: null,
      validator: null,
      middleware: null,
      success: true
    };

    try {
      // Generate auth service
      results.service = await this.generateService({
        name: 'Auth',
        type: 'auth',
        ...spec.service
      });

      // Generate auth validator
      results.validator = await this.generateValidator({
        name: 'auth',
        type: 'auth',
        ...spec.validator
      });

      // Generate auth controller
      results.controller = await this.generateController({
        name: 'Auth',
        type: 'auth',
        ...spec.controller
      });

      // Generate auth routes
      results.route = await this.generateRoute({
        name: 'auth',
        type: 'auth',
        ...spec.route
      });

      // Generate auth middleware
      results.middleware = await this.generateMiddleware({
        name: 'auth',
        type: 'auth',
        ...spec.middleware
      });

      results.success = Object.values(results)
        .filter(r => r && typeof r === 'object' && 'success' in r)
        .every(r => r.success);

      this.logger.info('Auth module generated successfully');
      return results;
    } catch (error) {
      this.logger.error('Failed to generate auth module:', error);
      results.success = false;
      results.error = error.message;
      return results;
    }
  }

  /**
   * Generate error handling utilities
   * @param {Object} spec - Error handler specification
   * @returns {Promise<Object>} Generation result
   */
  async generateErrorHandler(spec = {}) {
    if (!this.initialized) await this.initialize();
    return await this.generateMiddleware({
      name: 'error',
      type: 'errorHandler',
      ...spec
    });
  }

  // ==================== Status ====================

  /**
   * Get agent status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: 'backend-writer-agent',
      initialized: this.initialized,
      config: this.config,
      skills: Object.entries(this.skills).reduce((acc, [name, skill]) => {
        acc[name] = skill.getStatus?.() || { name };
        return acc;
      }, {}),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get all generated files across skills
   * @returns {Array} Generated files
   */
  getAllGeneratedFiles() {
    return Object.values(this.skills).flatMap(skill =>
      skill.getGeneratedFiles?.() || []
    );
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    this.cleanup();
    await Promise.all(
      Object.values(this.skills).map(skill => skill.shutdown?.())
    );
    this.initialized = false;
    this.logger.info('BackendWriterAgent shut down');
  }
}

// Singleton instance
let instance = null;

/**
 * Get BackendWriterAgent singleton instance
 * @param {Object} options - Configuration options
 * @returns {BackendWriterAgent} Agent instance
 */
export function getBackendWriterAgent(options = {}) {
  if (!instance) {
    instance = new BackendWriterAgent(options);
  }
  return instance;
}

export default BackendWriterAgent;
