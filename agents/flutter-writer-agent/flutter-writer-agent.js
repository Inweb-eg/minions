/**
 * FlutterWriterAgent - Flutter/Dart Code Generation Agent
 *
 * Orchestrates Flutter code generation with 6 specialized skills:
 * - WidgetGenerator: Stateless/Stateful widgets, patterns
 * - ModelGenerator: Data models with Freezed/JSON serialization
 * - ServiceGenerator: Dio-based API services
 * - BlocGenerator: Bloc/Cubit state management
 * - PageGenerator: Pages with navigation
 * - LocalizationGenerator: ARB files for i18n
 */

import { createLogger } from './utils/logger.js';
import { getWidgetGenerator } from './skills/widget-generator.js';
import { getModelGenerator } from './skills/model-generator.js';
import { getServiceGenerator } from './skills/service-generator.js';
import { getBlocGenerator } from './skills/bloc-generator.js';
import { getPageGenerator } from './skills/page-generator.js';
import { getLocalizationGenerator } from './skills/localization-generator.js';

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
 * FlutterWriterAgent
 */
export class FlutterWriterAgent {
  constructor(options = {}) {
    this.logger = logger;
    this.initialized = false;

    // Configuration
    this.config = {
      projectPath: options.projectPath || null,
      stateManagement: options.stateManagement || 'bloc',
      apiClient: options.apiClient || 'dio',
      useFreezed: options.useFreezed ?? true,
      useJsonSerializable: options.useJsonSerializable ?? true,
      l10nEnabled: options.l10nEnabled ?? true,
      supportedLocales: options.supportedLocales || ['en', 'ar', 'ku']
    };

    // Initialize skills
    this.skills = {
      widget: getWidgetGenerator({ outputPath: this.config.projectPath }),
      model: getModelGenerator({
        outputPath: this.config.projectPath,
        useFreezed: this.config.useFreezed,
        useJsonSerializable: this.config.useJsonSerializable
      }),
      service: getServiceGenerator({ outputPath: this.config.projectPath }),
      bloc: getBlocGenerator({
        outputPath: this.config.projectPath,
        useFreezed: this.config.useFreezed
      }),
      page: getPageGenerator({ outputPath: this.config.projectPath }),
      localization: getLocalizationGenerator({
        outputPath: this.config.projectPath,
        supportedLocales: this.config.supportedLocales
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

    if (config.supportedLocales) {
      this.skills.localization.setSupportedLocales(config.supportedLocales);
    }

    this.logger.info('FlutterWriterAgent configured', config);
  }

  /**
   * Initialize the agent
   */
  async initialize() {
    if (this.initialized) {
      this.logger.debug('FlutterWriterAgent already initialized');
      return;
    }

    try {
      this.logger.info('Initializing FlutterWriterAgent...');

      // Initialize all skills
      await Promise.all(
        Object.values(this.skills).map(skill => skill.initialize?.())
      );

      // Subscribe to events
      if (this.eventBus) {
        this.subscribeToEvents();
      }

      this.initialized = true;
      this.logger.info('FlutterWriterAgent initialized successfully');

      // Publish ready event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.AGENT_STARTED, {
          agent: 'flutter-writer-agent',
          skills: Object.keys(this.skills),
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      this.logger.error('Failed to initialize FlutterWriterAgent:', error);
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
        'flutter-writer-agent',
        this.handleGenerationRequest.bind(this)
      )
    );

    this.logger.info('FlutterWriterAgent subscribed to EventBus');
  }

  /**
   * Handle code generation request
   * @param {Object} data - Request data
   */
  async handleGenerationRequest(data) {
    if (data.platform !== 'flutter' && data.targetAgent !== 'flutter-writer-agent') {
      return;
    }

    this.logger.info(`Received generation request: ${data.type}`);

    // Publish started event
    if (this.eventBus && this.EventTypes) {
      this.eventBus.publish(this.EventTypes.CODE_GENERATION_STARTED, {
        agent: 'flutter-writer-agent',
        type: data.type,
        timestamp: new Date().toISOString()
      });
    }

    try {
      let result;

      switch (data.type) {
        case 'widget':
          result = await this.generateWidget(data.spec);
          break;
        case 'model':
          result = await this.generateModel(data.spec);
          break;
        case 'service':
          result = await this.generateService(data.spec);
          break;
        case 'bloc':
        case 'cubit':
          result = await this.generateBloc(data.spec);
          break;
        case 'page':
          result = await this.generatePage(data.spec);
          break;
        case 'localization':
          result = await this.generateLocalization(data.spec);
          break;
        default:
          throw new Error(`Unknown generation type: ${data.type}`);
      }

      // Publish completed event
      if (this.eventBus && this.EventTypes) {
        this.eventBus.publish(this.EventTypes.CODE_GENERATION_COMPLETED, {
          agent: 'flutter-writer-agent',
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
          agent: 'flutter-writer-agent',
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
    this.logger.info('FlutterWriterAgent cleaned up event subscriptions');
  }

  // ==================== Generation Methods ====================

  /**
   * Generate a widget
   * @param {Object} spec - Widget specification
   * @returns {Promise<Object>} Generation result
   */
  async generateWidget(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.widget.generate(spec);
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
   * Generate Dio client
   * @param {Object} spec - Client specification
   * @returns {Promise<Object>} Generation result
   */
  async generateDioClient(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.service.generateDioClient(spec);
  }

  /**
   * Generate a Bloc or Cubit
   * @param {Object} spec - Bloc specification
   * @returns {Promise<Object>} Generation result
   */
  async generateBloc(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.bloc.generate(spec);
  }

  /**
   * Generate a page
   * @param {Object} spec - Page specification
   * @returns {Promise<Object>} Generation result
   */
  async generatePage(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.page.generate(spec);
  }

  /**
   * Generate routes file
   * @param {Object} spec - Routes specification
   * @returns {Promise<Object>} Generation result
   */
  async generateRoutes(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.page.generateRoutes(spec);
  }

  /**
   * Generate localization files
   * @param {Object} spec - Localization specification
   * @returns {Promise<Object>} Generation result
   */
  async generateLocalization(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.localization.generate(spec);
  }

  /**
   * Generate l10n.yaml configuration
   * @param {Object} spec - Config specification
   * @returns {Promise<Object>} Generation result
   */
  async generateL10nConfig(spec) {
    if (!this.initialized) await this.initialize();
    return await this.skills.localization.generateConfig(spec);
  }

  /**
   * Add a translation key
   * @param {string} key - Translation key
   * @param {Object} translations - Translations by locale
   * @param {Object} metadata - Optional metadata
   * @returns {Promise<Object>} Update result
   */
  async addTranslation(key, translations, metadata) {
    if (!this.initialized) await this.initialize();
    return await this.skills.localization.addTranslation(key, translations, metadata);
  }

  // ==================== Batch Generation ====================

  /**
   * Generate a complete feature (model + bloc + page)
   * @param {Object} spec - Feature specification
   * @returns {Promise<Object>} Generation results
   */
  async generateFeature(spec) {
    if (!this.initialized) await this.initialize();

    this.logger.info(`Generating feature: ${spec.name}`);

    const results = {
      model: null,
      bloc: null,
      page: null,
      success: true
    };

    try {
      // Generate model
      if (spec.model) {
        results.model = await this.generateModel({
          name: spec.model.name || spec.name,
          ...spec.model
        });
      }

      // Generate bloc
      if (spec.bloc !== false) {
        results.bloc = await this.generateBloc({
          name: spec.name,
          type: spec.blocType || 'bloc',
          ...spec.bloc
        });
      }

      // Generate page
      if (spec.page !== false) {
        results.page = await this.generatePage({
          name: spec.name,
          type: spec.bloc !== false ? 'withBloc' : 'basic',
          blocName: spec.name,
          ...spec.page
        });
      }

      results.success = [results.model, results.bloc, results.page]
        .filter(Boolean)
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

  // ==================== Status ====================

  /**
   * Get agent status
   * @returns {Object} Status information
   */
  getStatus() {
    return {
      name: 'flutter-writer-agent',
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
    this.logger.info('FlutterWriterAgent shut down');
  }
}

// Singleton instance
let instance = null;

/**
 * Get FlutterWriterAgent singleton instance
 * @param {Object} options - Configuration options
 * @returns {FlutterWriterAgent} Agent instance
 */
export function getFlutterWriterAgent(options = {}) {
  if (!instance) {
    instance = new FlutterWriterAgent(options);
  }
  return instance;
}

export default FlutterWriterAgent;
