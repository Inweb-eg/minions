/**
 * Minions - Autonomous Multi-Agent System Framework
 *
 * A generic, reusable framework for building AI-powered autonomous agent systems.
 *
 * Core Components:
 * - EventBus: Centralized pub/sub for agent communication
 * - HealthMonitor: Monitors agent health and system status
 * - MetricsCollector: Collects performance and execution metrics
 * - AlertingSystem: Triggers alerts on anomalies
 * - RollbackManager: Manages checkpoints and rollbacks
 * - Orchestrator: Coordinates multi-agent execution
 * - AutonomousLoopManager: Manages test-fix-verify cycles
 *
 * Phase 0 Foundation Enhancements:
 * - MemoryStore: Persistent key-value store with SQLite backend
 * - DecisionLogger: Captures agent decisions with context and reasoning
 * - EnhancedEventBus: Priority queuing, request-response patterns, persistence
 * - StateMachine: Reusable state machine framework for agent behavior
 *
 * Phase 1 - Vision Agent:
 * - VisionAgent: Product owner that understands project goals
 * - ReadmeParser: README analysis and feature extraction
 * - FeatureDecomposer: Epic → Story → Task decomposition
 * - ProductStateManager: Feature lifecycle tracking
 * - AcceptanceGenerator: Acceptance criteria generation
 *
 * Phase 2 - Architect Agent:
 * - ArchitectAgent: Technical authority for architectural decisions
 * - BlueprintGenerator: System blueprint generation
 * - ApiContractManager: API contract management
 * - TechSelector: Technology stack selection
 * - DriftDetector: Architectural drift detection
 *
 * Phase 3 - Planner Agent:
 * - PlannerAgent: Execution engine that converts plans into action
 * - ExecutionPlanner: Topological sort and parallel execution groups
 * - AgentCoordinator: Task assignment and retry handling
 * - ProgressTracker: Velocity, ETA, and blocker detection
 * - IterationManager: Build → Test → Fix cycle management
 *
 * @module minions
 */

// Foundation exports
export { getEventBus, default as AgentEventBus } from './foundation/event-bus/AgentEventBus.js';
export { EventTypes } from './foundation/event-bus/eventTypes.js';
export { getHealthMonitor, HealthStatus, default as HealthMonitor } from './foundation/health-monitor/HealthMonitor.js';
export { getMetricsCollector, default as MetricsCollector } from './foundation/metrics-collector/MetricsCollector.js';
export { getAlertingSystem, default as AlertingSystem } from './foundation/alerting/AlertingSystem.js';
export { getRollbackManager, default as RollbackManager } from './foundation/rollback-manager/RollbackManager.js';
export { createLogger, LOG_LEVELS } from './foundation/common/logger.js';

// Phase 0 Foundation Enhancement exports
export {
  getMemoryStore,
  resetMemoryStore,
  MemoryNamespace,
  default as MemoryStore
} from './foundation/memory-store/MemoryStore.js';

export {
  getDecisionLogger,
  resetDecisionLogger,
  DecisionType,
  DecisionOutcome,
  default as DecisionLogger
} from './foundation/memory-store/DecisionLogger.js';

export {
  getEnhancedEventBus,
  resetEnhancedEventBus,
  MessagePriority,
  BroadcastChannel,
  default as EnhancedEventBus
} from './foundation/event-bus/EnhancedEventBus.js';

export {
  createAgentStateMachine,
  getStateMachine,
  removeStateMachine,
  getAllStateMachines,
  clearStateMachines,
  AgentState,
  TransitionResult,
  default as StateMachine
} from './foundation/state-machine/StateMachine.js';

// Analyzer exports
export { BaseAnalyzer } from './foundation/analyzers/BaseAnalyzer.js';
export { SecurityScanner } from './foundation/analyzers/SecurityScanner.js';
export { PerformanceAnalyzer } from './foundation/analyzers/PerformanceAnalyzer.js';

// Parser exports
export { ASTParser } from './foundation/parsers/ASTParser.js';

// Manager agent exports
export { getOrchestrator, default as Orchestrator } from './agents/manager-agent/orchestrator.js';
export { getAutonomousLoopManager, default as AutonomousLoopManager } from './agents/manager-agent/autonomous-loop-manager.js';
export { getDependencyGraph, default as DependencyGraph } from './agents/manager-agent/dependency-graph.js';
export { getAgentPool, default as AgentPool } from './agents/manager-agent/agent-pool.js';
export { getChangeDetector, default as ChangeDetector } from './agents/manager-agent/change-detector.js';

// Skills exports
export { BaseSkill } from './agents/skills/BaseSkill.js';
export { getAutoFixer } from './agents/skills/auto-fixer/index.js';
export { getCodeReviewer } from './agents/skills/code-review/index.js';
export { getDependencyAnalyzer } from './agents/skills/dependency-analyzer/index.js';
export { getTestGenerator } from './agents/skills/test-generator/index.js';
export { getSecurityScanner } from './agents/skills/security-scanner/index.js';

// Specialized Agent exports
export { getTesterAgent } from './agents/tester-agent/index.js';
export { getDockerAgent } from './agents/docker-agent/index.js';
export { getGithubAgent } from './agents/github-agent/index.js';
export { getCodebaseAnalyzer } from './agents/codebase-analyzer-agent/index.js';
export { getDocumentAgent } from './agents/document-agent/document-agent.js';

// Vision Agent exports (Phase 1)
export {
  getVisionAgent,
  resetVisionAgent,
  VisionAgent,
  AgentState as VisionAgentState,
  VisionEvents,
  ReadmeParser,
  FeatureType,
  SectionType,
  FeatureDecomposer,
  ComplexityLevel,
  WorkItemType,
  StoryCategory,
  ProductStateManager,
  FeatureStatus,
  ProgressMethod,
  AcceptanceGenerator,
  CriteriaFormat,
  CriteriaCategory
} from './agents/vision-agent/index.js';

// Architect Agent exports (Phase 2)
export {
  getArchitectAgent,
  resetArchitectAgent,
  ArchitectAgent,
  AgentState as ArchitectAgentState,
  ArchitectEvents,
  BlueprintGenerator,
  ArchitecturalPatterns,
  ComponentTypes,
  SystemLayers,
  ApiContractManager,
  HttpMethods,
  StatusCategories,
  TechSelector,
  TechCategories,
  DriftDetector,
  DriftCategories
} from './agents/architect-agent/index.js';

// Planner Agent exports (Phase 3)
export {
  getPlannerAgent,
  resetPlannerAgent,
  PlannerAgent,
  AgentState as PlannerAgentState,
  PlannerEvents,
  ExecutionStatus,
  ExecutionPlanner,
  PlanPhase,
  TaskPriority,
  TaskStatus,
  AgentCoordinator,
  AssignmentStrategy,
  AgentStatus,
  ProgressTracker,
  ProgressStatus,
  IterationManager,
  IterationPhase,
  IterationStatus,
  EscalationLevel
} from './agents/planner-agent/index.js';

// Writer Skills base class
export { BaseWriterSkill, LANGUAGE, GENERATION_RESULT } from './agents/writer-skills/BaseWriterSkill.js';

// Flutter Writer Agent exports
export {
  getFlutterWriterAgent,
  FlutterWriterAgent,
  // Skills
  getWidgetGenerator,
  WidgetGenerator,
  WIDGET_TYPE,
  WIDGET_PATTERN,
  getModelGenerator as getFlutterModelGenerator,
  ModelGenerator as FlutterModelGenerator,
  MODEL_TYPE as FLUTTER_MODEL_TYPE,
  getServiceGenerator as getFlutterServiceGenerator,
  ServiceGenerator as FlutterServiceGenerator,
  HTTP_METHOD as FLUTTER_HTTP_METHOD,
  getBlocGenerator,
  BlocGenerator,
  BLOC_TYPE,
  getPageGenerator as getFlutterPageGenerator,
  PageGenerator as FlutterPageGenerator,
  PAGE_TYPE as FLUTTER_PAGE_TYPE,
  getLocalizationGenerator,
  LocalizationGenerator,
  LOCALE,
  VERSION as FLUTTER_WRITER_VERSION,
  INFO as FLUTTER_WRITER_INFO
} from './agents/flutter-writer-agent/index.js';

// Backend Writer Agent exports
export {
  getBackendWriterAgent,
  BackendWriterAgent,
  // Skills
  getRouteGenerator,
  RouteGenerator,
  ROUTE_TYPE,
  getModelGenerator as getBackendModelGenerator,
  ModelGenerator as BackendModelGenerator,
  ORM_TYPE,
  MONGOOSE_TYPE,
  getServiceGenerator as getBackendServiceGenerator,
  ServiceGenerator as BackendServiceGenerator,
  SERVICE_TYPE,
  getMiddlewareGenerator,
  MiddlewareGenerator,
  MIDDLEWARE_TYPE,
  getValidatorGenerator,
  ValidatorGenerator,
  VALIDATOR_LIB,
  FIELD_TYPE as VALIDATOR_FIELD_TYPE,
  getControllerGenerator,
  ControllerGenerator,
  CONTROLLER_TYPE,
  VERSION as BACKEND_WRITER_VERSION,
  INFO as BACKEND_WRITER_INFO
} from './agents/backend-writer-agent/index.js';

// Frontend Writer Agent exports
export {
  getFrontendWriterAgent,
  FrontendWriterAgent,
  // Skills
  getComponentGenerator,
  ComponentGenerator,
  COMPONENT_TYPE,
  CSS_FRAMEWORK,
  getHookGenerator,
  HookGenerator,
  HOOK_TYPE,
  getStoreGenerator,
  StoreGenerator,
  STORE_TYPE,
  getFormGenerator,
  FormGenerator,
  FORM_TYPE,
  FORM_FIELD_TYPE,
  getApiGenerator,
  ApiGenerator,
  API_CLIENT,
  HTTP_METHOD as FRONTEND_HTTP_METHOD,
  getPageGenerator as getFrontendPageGenerator,
  PageGenerator as FrontendPageGenerator,
  PAGE_TYPE as FRONTEND_PAGE_TYPE,
  FRAMEWORK,
  VERSION as FRONTEND_WRITER_VERSION,
  INFO as FRONTEND_WRITER_INFO
} from './agents/frontend-writer-agent/index.js';

// Writer Agents Registry (Orchestrator Integration)
export {
  WriterAgentType,
  registerWriterAgents,
  initializeWriterAgents,
  requestCodeGeneration,
  generateCode,
  getWriterAgent,
  configureWriterAgent,
  cleanup as cleanupWriterAgents,
  isReady as isWriterAgentsReady
} from './agents/writer-agents-registry.js';

/**
 * Initialize the Minions framework
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableMetrics - Enable metrics collection (default: true)
 * @param {boolean} options.enableHealth - Enable health monitoring (default: true)
 * @param {boolean} options.enableAlerting - Enable alerting system (default: true)
 * @param {boolean} options.enableMemoryStore - Enable persistent memory store (default: true)
 * @param {boolean} options.enableDecisionLogger - Enable decision logging (default: true)
 * @param {boolean} options.enableEnhancedEventBus - Enable enhanced event bus (default: false)
 * @param {boolean} options.enableVisionAgent - Enable Vision Agent (default: false)
 * @param {boolean} options.enableArchitectAgent - Enable Architect Agent (default: false)
 * @param {boolean} options.enablePlannerAgent - Enable Planner Agent (default: false)
 * @param {boolean} options.enableWriterAgents - Enable Code Writer Agents (default: false)
 * @param {Object} options.writerAgentOptions - Writer agent configuration
 * @param {Object} options.writerAgentOptions.flutterConfig - Flutter Writer config
 * @param {Object} options.writerAgentOptions.backendConfig - Backend Writer config
 * @param {Object} options.writerAgentOptions.frontendConfig - Frontend Writer config
 * @param {number} options.maxConcurrency - Max concurrent agents (default: 5)
 * @returns {Object} Initialized framework components
 *
 * @example
 * import { initializeMinions } from 'minions';
 *
 * const { orchestrator, eventBus, metricsCollector, memoryStore } = await initializeMinions({
 *   enableMetrics: true,
 *   enableHealth: true,
 *   enableMemoryStore: true,
 *   maxConcurrency: 3
 * });
 *
 * // Register your agents
 * orchestrator.registerAgent('my-agent', async () => myAgentInstance, ['dependency-agent']);
 *
 * // Execute
 * await orchestrator.execute();
 */
export async function initializeMinions(options = {}) {
  const {
    enableMetrics = true,
    enableHealth = true,
    enableAlerting = true,
    enableMemoryStore = true,
    enableDecisionLogger = true,
    enableEnhancedEventBus = false,
    enableVisionAgent = false,
    enableArchitectAgent = false,
    enablePlannerAgent = false,
    enableWriterAgents = false,
    maxConcurrency = 5
  } = options;

  // Import singletons
  const { getEventBus } = await import('./foundation/event-bus/AgentEventBus.js');
  const { getOrchestrator } = await import('./agents/manager-agent/orchestrator.js');
  const { getMetricsCollector } = await import('./foundation/metrics-collector/MetricsCollector.js');
  const { getHealthMonitor } = await import('./foundation/health-monitor/HealthMonitor.js');
  const { getAlertingSystem } = await import('./foundation/alerting/AlertingSystem.js');
  const { getRollbackManager } = await import('./foundation/rollback-manager/RollbackManager.js');
  const { getAutonomousLoopManager } = await import('./agents/manager-agent/autonomous-loop-manager.js');

  // Phase 0 imports
  const { getMemoryStore } = await import('./foundation/memory-store/MemoryStore.js');
  const { getDecisionLogger } = await import('./foundation/memory-store/DecisionLogger.js');
  const { getEnhancedEventBus } = await import('./foundation/event-bus/EnhancedEventBus.js');

  // Phase 1 imports (Vision Agent)
  const { getVisionAgent } = await import('./agents/vision-agent/index.js');

  // Phase 2 imports (Architect Agent)
  const { getArchitectAgent } = await import('./agents/architect-agent/index.js');

  // Phase 3 imports (Planner Agent)
  const { getPlannerAgent } = await import('./agents/planner-agent/index.js');

  const eventBus = getEventBus();
  const orchestrator = getOrchestrator();
  const metricsCollector = enableMetrics ? getMetricsCollector() : null;
  const healthMonitor = enableHealth ? getHealthMonitor() : null;
  const alertingSystem = enableAlerting ? getAlertingSystem() : null;
  const rollbackManager = getRollbackManager();
  const autonomousLoopManager = getAutonomousLoopManager();

  // Phase 0 components
  let memoryStore = null;
  let decisionLogger = null;
  let enhancedEventBus = null;

  if (enableMemoryStore) {
    memoryStore = getMemoryStore(options.memoryStoreOptions || {});
    await memoryStore.initialize();
  }

  if (enableDecisionLogger) {
    decisionLogger = getDecisionLogger();
    await decisionLogger.initialize();
  }

  if (enableEnhancedEventBus) {
    enhancedEventBus = getEnhancedEventBus(options.enhancedEventBusOptions || {});
    await enhancedEventBus.initialize();
  }

  // Phase 1 components (Vision Agent)
  let visionAgent = null;

  if (enableVisionAgent) {
    visionAgent = getVisionAgent({
      projectRoot: options.projectRoot || process.cwd(),
      ...options.visionAgentOptions
    });
    await visionAgent.initialize(eventBus);
  }

  // Phase 2 components (Architect Agent)
  let architectAgent = null;

  if (enableArchitectAgent) {
    architectAgent = getArchitectAgent({
      projectRoot: options.projectRoot || process.cwd(),
      ...options.architectAgentOptions
    });
    await architectAgent.initialize(eventBus);
  }

  // Phase 3 components (Planner Agent)
  let plannerAgent = null;

  if (enablePlannerAgent) {
    plannerAgent = getPlannerAgent({
      maxConcurrency: options.maxConcurrency || maxConcurrency,
      ...options.plannerAgentOptions
    });
    await plannerAgent.initialize(eventBus);
  }

  // Code Writer Agents
  let writerAgentsInitialized = false;

  if (enableWriterAgents) {
    const { initializeWriterAgents } = await import('./agents/writer-agents-registry.js');
    await initializeWriterAgents(options.writerAgentOptions || {});
    writerAgentsInitialized = true;
  }

  // Configure orchestrator
  orchestrator.maxConcurrency = maxConcurrency;

  // Initialize components
  await orchestrator.initialize();

  if (metricsCollector) {
    metricsCollector.start();
  }

  if (healthMonitor) {
    await healthMonitor.initialize(metricsCollector);
    healthMonitor.start();
  }

  if (alertingSystem) {
    await alertingSystem.initialize();
  }

  if (rollbackManager) {
    await rollbackManager.initialize();
  }

  return {
    eventBus,
    orchestrator,
    metricsCollector,
    healthMonitor,
    alertingSystem,
    rollbackManager,
    autonomousLoopManager,
    // Phase 0 components
    memoryStore,
    decisionLogger,
    enhancedEventBus,
    // Phase 1 components
    visionAgent,
    // Phase 2 components
    architectAgent,
    // Phase 3 components
    plannerAgent,
    // Code Writer Agents
    writerAgentsInitialized
  };
}

/**
 * Create a simple agent that can be registered with the orchestrator
 *
 * @param {Object} config - Agent configuration
 * @param {string} config.name - Agent name
 * @param {Function} config.execute - Async function to execute
 * @param {Function} config.onEvent - Optional event handler
 * @returns {Object} Agent instance
 *
 * @example
 * const myAgent = createAgent({
 *   name: 'my-agent',
 *   execute: async () => {
 *     // Do work
 *     console.log('Agent executing...');
 *   },
 *   onEvent: (eventType, data) => {
 *     console.log(`Received event: ${eventType}`);
 *   }
 * });
 */
export function createAgent({ name, execute, onEvent }) {
  return {
    name,
    execute,
    onEvent,
    run: execute, // Alias for compatibility
    analyze: execute // Alias for analyzer-type agents
  };
}
