/**
 * Writer Agents Registry
 *
 * Registers code writer agents with the orchestrator for automated code generation.
 * Handles CODE_GENERATION_REQUESTED events and routes them to the appropriate agent.
 */

import { getOrchestrator } from '../agents/manager-agent/orchestrator.js';
import { getEventBus } from '../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../foundation/event-bus/eventTypes.js';
import { createLogger } from '../foundation/common/logger.js';

const logger = createLogger('WriterAgentsRegistry');

// Writer agent types
export const WriterAgentType = {
  FLUTTER: 'flutter-writer',
  BACKEND: 'backend-writer',
  FRONTEND: 'frontend-writer'
};

// Generation types mapped to agent methods
const GenerationTypeMap = {
  // Flutter generation types
  'flutter:widget': { agent: WriterAgentType.FLUTTER, method: 'generateWidget' },
  'flutter:model': { agent: WriterAgentType.FLUTTER, method: 'generateModel' },
  'flutter:service': { agent: WriterAgentType.FLUTTER, method: 'generateService' },
  'flutter:bloc': { agent: WriterAgentType.FLUTTER, method: 'generateBloc' },
  'flutter:page': { agent: WriterAgentType.FLUTTER, method: 'generatePage' },
  'flutter:l10n': { agent: WriterAgentType.FLUTTER, method: 'generateLocalization' },

  // Backend generation types
  'backend:route': { agent: WriterAgentType.BACKEND, method: 'generateRoute' },
  'backend:model': { agent: WriterAgentType.BACKEND, method: 'generateModel' },
  'backend:service': { agent: WriterAgentType.BACKEND, method: 'generateService' },
  'backend:middleware': { agent: WriterAgentType.BACKEND, method: 'generateMiddleware' },
  'backend:validator': { agent: WriterAgentType.BACKEND, method: 'generateValidator' },
  'backend:controller': { agent: WriterAgentType.BACKEND, method: 'generateController' },

  // Frontend generation types
  'frontend:component': { agent: WriterAgentType.FRONTEND, method: 'generateComponent' },
  'frontend:hook': { agent: WriterAgentType.FRONTEND, method: 'generateHook' },
  'frontend:store': { agent: WriterAgentType.FRONTEND, method: 'generateStore' },
  'frontend:form': { agent: WriterAgentType.FRONTEND, method: 'generateForm' },
  'frontend:api': { agent: WriterAgentType.FRONTEND, method: 'generateApi' },
  'frontend:page': { agent: WriterAgentType.FRONTEND, method: 'generatePage' }
};

// Loaded agent instances
let flutterWriterAgent = null;
let backendWriterAgent = null;
let frontendWriterAgent = null;

// Registry state
let isInitialized = false;
let eventSubscriptions = [];

/**
 * Load Flutter Writer Agent
 */
async function loadFlutterWriter() {
  if (!flutterWriterAgent) {
    const { getFlutterWriterAgent } = await import('./flutter-writer-agent/index.js');
    flutterWriterAgent = getFlutterWriterAgent();
    await flutterWriterAgent.initialize();
    logger.info('Flutter Writer Agent loaded');
  }
  return flutterWriterAgent;
}

/**
 * Load Backend Writer Agent
 */
async function loadBackendWriter() {
  if (!backendWriterAgent) {
    const { getBackendWriterAgent } = await import('./backend-writer-agent/index.js');
    backendWriterAgent = getBackendWriterAgent();
    await backendWriterAgent.initialize();
    logger.info('Backend Writer Agent loaded');
  }
  return backendWriterAgent;
}

/**
 * Load Frontend Writer Agent
 */
async function loadFrontendWriter() {
  if (!frontendWriterAgent) {
    const { getFrontendWriterAgent } = await import('./frontend-writer-agent/index.js');
    frontendWriterAgent = getFrontendWriterAgent();
    await frontendWriterAgent.initialize();
    logger.info('Frontend Writer Agent loaded');
  }
  return frontendWriterAgent;
}

/**
 * Register all writer agents with the orchestrator
 *
 * @param {Object} options - Registration options
 * @param {Object} options.flutterConfig - Flutter Writer Agent configuration
 * @param {Object} options.backendConfig - Backend Writer Agent configuration
 * @param {Object} options.frontendConfig - Frontend Writer Agent configuration
 */
export async function registerWriterAgents(options = {}) {
  const orchestrator = getOrchestrator();
  const eventBus = getEventBus();

  // Register Flutter Writer Agent
  orchestrator.registerAgent(
    WriterAgentType.FLUTTER,
    async () => {
      const agent = await loadFlutterWriter();
      if (options.flutterConfig) {
        await agent.configure(options.flutterConfig);
      }
      return agent;
    },
    [] // No dependencies - writer agents are standalone
  );

  // Register Backend Writer Agent
  orchestrator.registerAgent(
    WriterAgentType.BACKEND,
    async () => {
      const agent = await loadBackendWriter();
      if (options.backendConfig) {
        await agent.configure(options.backendConfig);
      }
      return agent;
    },
    []
  );

  // Register Frontend Writer Agent
  orchestrator.registerAgent(
    WriterAgentType.FRONTEND,
    async () => {
      const agent = await loadFrontendWriter();
      if (options.frontendConfig) {
        await agent.configure(options.frontendConfig);
      }
      return agent;
    },
    []
  );

  logger.info('All writer agents registered with orchestrator');
}

/**
 * Initialize writer agents and subscribe to code generation events
 *
 * @param {Object} options - Initialization options
 */
export async function initializeWriterAgents(options = {}) {
  if (isInitialized) {
    logger.warn('Writer agents already initialized');
    return;
  }

  const eventBus = getEventBus();

  // Register agents with orchestrator
  await registerWriterAgents(options);

  // Subscribe to code generation request events
  const unsubscribe = eventBus.subscribe(
    EventTypes.CODE_GENERATION_REQUESTED,
    handleCodeGenerationRequest
  );
  eventSubscriptions.push(unsubscribe);

  isInitialized = true;
  logger.info('Writer agents initialized and listening for generation requests');
}

/**
 * Handle code generation request events
 *
 * @param {Object} data - Request data
 * @param {string} data.type - Generation type (e.g., 'flutter:widget', 'backend:route')
 * @param {Object} data.spec - Generation specification
 * @param {string} data.requestId - Optional request ID for tracking
 */
async function handleCodeGenerationRequest(data) {
  const { type, spec, requestId } = data;
  const eventBus = getEventBus();

  logger.info(`Received code generation request: ${type}`, { requestId });

  // Look up the generation mapping
  const mapping = GenerationTypeMap[type];

  if (!mapping) {
    const error = `Unknown generation type: ${type}`;
    logger.error(error);
    eventBus.publish(EventTypes.CODE_GENERATION_FAILED, {
      type,
      requestId,
      error
    });
    return;
  }

  // Publish generation started event
  eventBus.publish(EventTypes.CODE_GENERATION_STARTED, {
    type,
    requestId,
    agent: mapping.agent
  });

  try {
    // Load the appropriate agent
    let agent;
    switch (mapping.agent) {
      case WriterAgentType.FLUTTER:
        agent = await loadFlutterWriter();
        break;
      case WriterAgentType.BACKEND:
        agent = await loadBackendWriter();
        break;
      case WriterAgentType.FRONTEND:
        agent = await loadFrontendWriter();
        break;
      default:
        throw new Error(`Unknown agent type: ${mapping.agent}`);
    }

    // Call the generation method
    const method = agent[mapping.method];
    if (typeof method !== 'function') {
      throw new Error(`Method ${mapping.method} not found on agent ${mapping.agent}`);
    }

    const result = await method.call(agent, spec);

    if (result.success) {
      // Publish success event
      eventBus.publish(EventTypes.CODE_GENERATION_COMPLETED, {
        type,
        requestId,
        agent: mapping.agent,
        result
      });

      // Publish specific generation event (e.g., FLUTTER_WIDGET_GENERATED)
      const specificEvent = getSpecificEvent(type);
      if (specificEvent) {
        eventBus.publish(specificEvent, {
          requestId,
          ...result
        });
      }

      logger.info(`Code generation completed: ${type}`, { requestId, filePath: result.filePath });
    } else {
      throw new Error(result.errors?.join(', ') || 'Generation failed');
    }

  } catch (error) {
    logger.error(`Code generation failed: ${type}`, { requestId, error: error.message });
    eventBus.publish(EventTypes.CODE_GENERATION_FAILED, {
      type,
      requestId,
      agent: mapping.agent,
      error: error.message
    });
  }
}

/**
 * Get the specific event type for a generation type
 */
function getSpecificEvent(generationType) {
  const eventMap = {
    'flutter:widget': EventTypes.FLUTTER_WIDGET_GENERATED,
    'flutter:model': EventTypes.FLUTTER_MODEL_GENERATED,
    'flutter:service': EventTypes.FLUTTER_SERVICE_GENERATED,
    'flutter:bloc': EventTypes.FLUTTER_BLOC_GENERATED,
    'flutter:page': EventTypes.FLUTTER_PAGE_GENERATED,
    'flutter:l10n': EventTypes.FLUTTER_L10N_GENERATED,
    'backend:route': EventTypes.BACKEND_ROUTE_GENERATED,
    'backend:model': EventTypes.BACKEND_MODEL_GENERATED,
    'backend:service': EventTypes.BACKEND_SERVICE_GENERATED,
    'backend:middleware': EventTypes.BACKEND_MIDDLEWARE_GENERATED,
    'backend:validator': EventTypes.BACKEND_VALIDATOR_GENERATED,
    'backend:controller': EventTypes.BACKEND_CONTROLLER_GENERATED,
    'frontend:component': EventTypes.FRONTEND_COMPONENT_GENERATED,
    'frontend:hook': EventTypes.FRONTEND_HOOK_GENERATED,
    'frontend:store': EventTypes.FRONTEND_STORE_GENERATED,
    'frontend:form': EventTypes.FRONTEND_FORM_GENERATED,
    'frontend:api': EventTypes.FRONTEND_API_GENERATED,
    'frontend:page': EventTypes.FRONTEND_PAGE_GENERATED
  };

  return eventMap[generationType];
}

/**
 * Request code generation via the event bus
 *
 * @param {string} type - Generation type (e.g., 'flutter:widget')
 * @param {Object} spec - Generation specification
 * @returns {string} Request ID for tracking
 *
 * @example
 * const requestId = requestCodeGeneration('flutter:widget', {
 *   name: 'UserCard',
 *   type: 'stateless',
 *   props: [{ name: 'user', type: 'User', required: true }]
 * });
 */
export function requestCodeGeneration(type, spec) {
  const eventBus = getEventBus();
  const requestId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  eventBus.publish(EventTypes.CODE_GENERATION_REQUESTED, {
    type,
    spec,
    requestId
  });

  return requestId;
}

/**
 * Request code generation and wait for result
 *
 * @param {string} type - Generation type
 * @param {Object} spec - Generation specification
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Object>} Generation result
 */
export async function generateCode(type, spec, timeout = 30000) {
  const eventBus = getEventBus();
  const requestId = `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Code generation timeout for ${type}`));
    }, timeout);

    // Subscribe to completion and failure events
    const unsubscribeCompleted = eventBus.subscribe(
      EventTypes.CODE_GENERATION_COMPLETED,
      (data) => {
        if (data.requestId === requestId) {
          cleanup();
          resolve(data.result);
        }
      }
    );

    const unsubscribeFailed = eventBus.subscribe(
      EventTypes.CODE_GENERATION_FAILED,
      (data) => {
        if (data.requestId === requestId) {
          cleanup();
          reject(new Error(data.error));
        }
      }
    );

    function cleanup() {
      clearTimeout(timer);
      unsubscribeCompleted();
      unsubscribeFailed();
    }

    // Publish the request
    eventBus.publish(EventTypes.CODE_GENERATION_REQUESTED, {
      type,
      spec,
      requestId
    });
  });
}

/**
 * Get writer agent by type
 *
 * @param {string} agentType - Agent type (flutter-writer, backend-writer, frontend-writer)
 * @returns {Promise<Object>} Agent instance
 */
export async function getWriterAgent(agentType) {
  switch (agentType) {
    case WriterAgentType.FLUTTER:
      return loadFlutterWriter();
    case WriterAgentType.BACKEND:
      return loadBackendWriter();
    case WriterAgentType.FRONTEND:
      return loadFrontendWriter();
    default:
      throw new Error(`Unknown writer agent type: ${agentType}`);
  }
}

/**
 * Configure a writer agent
 *
 * @param {string} agentType - Agent type
 * @param {Object} config - Agent configuration
 */
export async function configureWriterAgent(agentType, config) {
  const agent = await getWriterAgent(agentType);
  await agent.configure(config);
  logger.info(`Configured ${agentType}`, config);
}

/**
 * Cleanup and unsubscribe from events
 */
export function cleanup() {
  eventSubscriptions.forEach(unsubscribe => unsubscribe());
  eventSubscriptions = [];

  flutterWriterAgent = null;
  backendWriterAgent = null;
  frontendWriterAgent = null;

  isInitialized = false;
  logger.info('Writer agents cleaned up');
}

/**
 * Check if writer agents are initialized
 */
export function isReady() {
  return isInitialized;
}

export default {
  WriterAgentType,
  registerWriterAgents,
  initializeWriterAgents,
  requestCodeGeneration,
  generateCode,
  getWriterAgent,
  configureWriterAgent,
  cleanup,
  isReady
};
