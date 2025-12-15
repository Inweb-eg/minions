/**
 * FrontendWriterAgent - React/TypeScript Code Generation Agent
 *
 * Orchestrates frontend code generation with 6 specialized skills:
 * - ComponentGenerator: React components
 * - HookGenerator: Custom hooks
 * - StoreGenerator: State management (Context/Zustand/Redux)
 * - FormGenerator: Form components
 * - ApiGenerator: API integration
 * - PageGenerator: Page components
 */

import { createLogger } from './utils/logger.js';
import { getComponentGenerator } from './skills/component-generator.js';
import { getHookGenerator } from './skills/hook-generator.js';
import { getStoreGenerator } from './skills/store-generator.js';
import { getFormGenerator } from './skills/form-generator.js';
import { getApiGenerator } from './skills/api-generator.js';
import { getPageGenerator } from './skills/page-generator.js';

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
 * FrontendWriterAgent
 */
export class FrontendWriterAgent {
  constructor(options = {}) {
    this.logger = logger;
    this.initialized = false;

    // Configuration
    this.config = {
      projectPath: options.projectPath || null,
      useTypeScript: options.useTypeScript ?? true,
      cssFramework: options.cssFramework || 'tailwind',
      stateManagement: options.stateManagement || 'context',
      apiClient: options.apiClient || 'react-query',
      framework: options.framework || 'react'
    };

    // Initialize skills
    this.skills = {
      component: getComponentGenerator({
        outputPath: this.config.projectPath,
        useTypeScript: this.config.useTypeScript,
        cssFramework: this.config.cssFramework
      }),
      hook: getHookGenerator({
        outputPath: this.config.projectPath,
        useTypeScript: this.config.useTypeScript
      }),
      store: getStoreGenerator({
        outputPath: this.config.projectPath,
        useTypeScript: this.config.useTypeScript,
        storeType: this.config.stateManagement
      }),
      form: getFormGenerator({
        outputPath: this.config.projectPath,
        useTypeScript: this.config.useTypeScript,
        cssFramework: this.config.cssFramework
      }),
      api: getApiGenerator({
        outputPath: this.config.projectPath,
        useTypeScript: this.config.useTypeScript,
        apiClient: this.config.apiClient
      }),
      page: getPageGenerator({
        outputPath: this.config.projectPath,
        useTypeScript: this.config.useTypeScript,
        cssFramework: this.config.cssFramework,
        framework: this.config.framework
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

    if (config.useTypeScript !== undefined) {
      Object.values(this.skills).forEach(skill => {
        skill.useTypeScript = config.useTypeScript;
      });
    }

    if (config.cssFramework) {
      this.skills.component.cssFramework = config.cssFramework;
      this.skills.form.cssFramework = config.cssFramework;
      this.skills.page.cssFramework = config.cssFramework;
    }

    if (config.stateManagement) {
      this.skills.store.defaultStoreType = config.stateManagement;
    }

    if (config.apiClient) {
      this.skills.api.defaultClient = config.apiClient;
    }

    this.logger.info('FrontendWriterAgent configured', config);
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    if (this.initialized) {
      this.logger.debug('FrontendWriterAgent already initialized');
      return;
    }

    try {
      this.logger.info('Initializing FrontendWriterAgent...');

      // Initialize all skills
      await Promise.all(
        Object.values(this.skills).map(skill => skill.initialize?.())
      );

      // Subscribe to events
      if (this.eventBus) {
        this.subscribeToEvents();
      }

      this.initialized = true;
      this.logger.info('FrontendWriterAgent initialized successfully');

      // Publish ready event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_STARTED, {
          agent: 'frontend-writer-agent',
          skills: Object.keys(this.skills),
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize FrontendWriterAgent:', error);
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
        'frontend-writer-agent',
        this.handleGenerationRequest.bind(this)
      )
    );

    this.logger.info('FrontendWriterAgent subscribed to EventBus');
  }

  /**
   * Handle code generation request
   * @param {Object} data - Request data
   */
  async handleGenerationRequest(data) {
    if (data.platform !== 'frontend' && data.targetAgent !== 'frontend-writer-agent') {
      return;
    }

    this.logger.info(`Received generation request: ${data.type}`);

    // Publish started event
    if (this.eventBus && this.EventTypes) {
      this.eventBus.publish(this.EventTypes.CODE_GENERATION_STARTED, {
        agent: 'frontend-writer-agent',
        type: data.type,
        timestamp: new Date().toISOString()
      });
    }

    try {
      let result;

      switch (data.type) {
        case 'component':
          result = await this.generateComponent(data.spec);
          break;
        case 'hook':
          result = await this.generateHook(data.spec);
          break;
        case 'store':
        case 'context':
          result = await this.generateStore(data.spec);
          break;
        case 'form':
          result = await this.generateForm(data.spec);
          break;
        case 'api':
          result = await this.generateApi(data.spec);
          break;
        case 'page':
          result = await this.generatePage(data.spec);
          break;
        default:
          throw new Error(`Unknown generation type: ${data.type}`);
      }

      // Publish completed event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.CODE_GENERATION_COMPLETED, {
          agent: 'frontend-writer-agent',
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
          agent: 'frontend-writer-agent',
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
    this.logger.info('FrontendWriterAgent cleaned up event subscriptions');
  }

  // ==================== Generation Methods ====================

  /**
   * Generate a component
   * @param {Object} spec - Component specification
   * @returns {Promise<Object>} Generation result
   */
  async generateComponent(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.component.generate(spec);
  }

  /**
   * Generate a custom hook
   * @param {Object} spec - Hook specification
   * @returns {Promise<Object>} Generation result
   */
  async generateHook(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.hook.generate(spec);
  }

  /**
   * Generate a store/context
   * @param {Object} spec - Store specification
   * @returns {Promise<Object>} Generation result
   */
  async generateStore(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.store.generate(spec);
  }

  /**
   * Generate a form component
   * @param {Object} spec - Form specification
   * @returns {Promise<Object>} Generation result
   */
  async generateForm(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.form.generate(spec);
  }

  /**
   * Generate API integration
   * @param {Object} spec - API specification
   * @returns {Promise<Object>} Generation result
   */
  async generateApi(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.api.generate(spec);
  }

  /**
   * Generate a page component
   * @param {Object} spec - Page specification
   * @returns {Promise<Object>} Generation result
   */
  async generatePage(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.page.generate(spec);
  }

  // ==================== Batch Generation ====================

  /**
   * Generate a complete feature (component + hook + api + page)
   * @param {Object} spec - Feature specification
   * @returns {Promise<Object>} Generation results
   */
  async generateFeature(spec) {
    if (!this.initialized) await this.initialize();

    this.logger.info(`Generating feature: ${spec.name}`);

    const results = {
      component: null,
      hook: null,
      api: null,
      page: null,
      form: null,
      store: null,
      success: true
    };

    try {
      // Generate API hooks
      if (spec.api !== false) {
        results.api = await this.generateApi({
          name: spec.name,
          fields: spec.fields,
          ...spec.api
        });
      }

      // Generate store/context if needed
      if (spec.store) {
        results.store = await this.generateStore({
          name: spec.name,
          ...spec.store
        });
      }

      // Generate form if needed
      if (spec.form) {
        results.form = await this.generateForm({
          name: spec.name,
          fields: spec.fields,
          ...spec.form
        });
      }

      // Generate list page
      if (spec.listPage !== false) {
        results.page = await this.generatePage({
          name: spec.name + 'List',
          type: 'list',
          resourceName: spec.name,
          ...spec.listPage
        });
      }

      // Generate detail page
      if (spec.detailPage !== false) {
        const detailResult = await this.generatePage({
          name: spec.name + 'Detail',
          type: 'detail',
          resourceName: spec.name,
          ...spec.detailPage
        });
        results.page = results.page ? [results.page, detailResult] : detailResult;
      }

      // Generate form page (create/edit)
      if (spec.formPage !== false) {
        const createResult = await this.generatePage({
          name: spec.name + 'Create',
          type: 'form',
          resourceName: spec.name,
          isEdit: false,
          ...spec.formPage
        });
        const editResult = await this.generatePage({
          name: spec.name + 'Edit',
          type: 'form',
          resourceName: spec.name,
          isEdit: true,
          ...spec.formPage
        });
        results.page = Array.isArray(results.page)
          ? [...results.page, createResult, editResult]
          : results.page
            ? [results.page, createResult, editResult]
            : [createResult, editResult];
      }

      results.success = Object.values(results)
        .filter(r => r && typeof r === 'object' && 'success' in r)
        .every(r => r.success);

      this.logger.info(`Feature ${spec.name} generated successfully`);
      return results;
    } catch (error) {
      this.logger.error(`Failed to generate feature ${spec.name}:`, error);
      results.success = false;
      results.error = error.message;
      return results;
    }
  }

  /**
   * Generate a CRUD module
   * @param {Object} spec - CRUD specification
   * @returns {Promise<Object>} Generation results
   */
  async generateCrud(spec) {
    return await this.generateFeature({
      ...spec,
      api: spec.api !== false ? { type: 'reactQuery', ...spec.api } : false,
      form: spec.form !== false ? { type: 'reactHookForm', useZod: true, ...spec.form } : false,
      listPage: spec.listPage !== false ? { useDelete: true, ...spec.listPage } : false,
      detailPage: spec.detailPage !== false ? { useDelete: true, ...spec.detailPage } : false,
      formPage: spec.formPage !== false ? spec.formPage : false
    });
  }

  // ==================== Status ====================

  /**
   * Get agent status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: 'frontend-writer-agent',
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
    this.logger.info('FrontendWriterAgent shut down');
  }
}

// Singleton instance
let instance = null;

/**
 * Get FrontendWriterAgent singleton instance
 * @param {Object} options - Configuration options
 * @returns {FrontendWriterAgent} Agent instance
 */
export function getFrontendWriterAgent(options = {}) {
  if (!instance) {
    instance = new FrontendWriterAgent(options);
  }
  return instance;
}

export default FrontendWriterAgent;
