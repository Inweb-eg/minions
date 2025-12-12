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

/**
 * Initialize the Minions framework
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.enableMetrics - Enable metrics collection (default: true)
 * @param {boolean} options.enableHealth - Enable health monitoring (default: true)
 * @param {boolean} options.enableAlerting - Enable alerting system (default: true)
 * @param {number} options.maxConcurrency - Max concurrent agents (default: 5)
 * @returns {Object} Initialized framework components
 *
 * @example
 * import { initializeMinions } from 'minions';
 *
 * const { orchestrator, eventBus, metricsCollector } = await initializeMinions({
 *   enableMetrics: true,
 *   enableHealth: true,
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

  const eventBus = getEventBus();
  const orchestrator = getOrchestrator();
  const metricsCollector = enableMetrics ? getMetricsCollector() : null;
  const healthMonitor = enableHealth ? getHealthMonitor() : null;
  const alertingSystem = enableAlerting ? getAlertingSystem() : null;
  const rollbackManager = getRollbackManager();
  const autonomousLoopManager = getAutonomousLoopManager();

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
    autonomousLoopManager
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
