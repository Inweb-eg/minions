/**
 * Example Agent Template
 *
 * This file demonstrates how to create a custom agent for the Minions framework.
 *
 * Agents can:
 * - Execute tasks automatically
 * - Respond to events from the EventBus
 * - Publish events for other agents
 * - Be orchestrated with dependencies
 */

import { getEventBus } from '../foundation/event-bus/AgentEventBus.js';
import { EventTypes } from '../foundation/event-bus/eventTypes.js';
import { createLogger } from '../foundation/common/logger.js';

const logger = createLogger('ExampleAgent');

/**
 * Example Agent Class
 *
 * Follow this pattern for creating your own agents.
 */
class ExampleAgent {
  constructor(options = {}) {
    this.name = options.name || 'example-agent';
    this.eventBus = getEventBus();
    this.config = options.config || {};
    this.isInitialized = false;

    // Store unsubscribe functions for cleanup
    this.unsubscribers = [];
  }

  /**
   * Initialize the agent
   * Subscribe to relevant events and set up resources
   */
  async initialize() {
    if (this.isInitialized) return;

    logger.info(`Initializing ${this.name}...`);

    // Subscribe to events this agent cares about
    this.subscribeToEvents();

    this.isInitialized = true;
    logger.info(`${this.name} initialized`);
  }

  /**
   * Subscribe to EventBus events
   */
  subscribeToEvents() {
    // Example: Listen for code changes
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.CODE_GENERATED,
        this.name,
        this.handleCodeGenerated.bind(this)
      )
    );

    // Example: Listen for auto-fix requests
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.AUTO_FIX_REQUESTED,
        this.name,
        this.handleAutoFixRequest.bind(this)
      )
    );

    logger.info(`${this.name} subscribed to events`);
  }

  /**
   * Handle code generated events
   * @param {Object} data - Event data
   * @param {Object} event - Full event object
   */
  async handleCodeGenerated(data, event) {
    logger.info(`Received CODE_GENERATED event from ${data.agent}`);

    // Example: Analyze the generated code
    // Your custom logic here
  }

  /**
   * Handle auto-fix requests
   * @param {Object} data - Event data
   */
  async handleAutoFixRequest(data) {
    // Only handle requests targeted at this agent
    if (data.targetAgent !== this.name) return;

    logger.info(`Received AUTO_FIX_REQUESTED for ${data.tasks?.length || 0} tasks`);

    // Process each task
    for (const task of data.tasks || []) {
      try {
        await this.fixTask(task);
      } catch (error) {
        logger.error(`Failed to fix task: ${error.message}`);
      }
    }

    // Publish completion event
    this.eventBus.publish(EventTypes.FIX_COMPLETED, {
      agent: this.name,
      loopId: data.loopId,
      tasksCompleted: data.tasks?.length || 0
    });
  }

  /**
   * Fix a single task
   * @param {Object} task - Task to fix
   */
  async fixTask(task) {
    logger.info(`Fixing task: ${task.test || task.name}`);
    // Your fix logic here
  }

  /**
   * Main execution method
   * Called by the Orchestrator when this agent should run
   */
  async execute() {
    const startTime = Date.now();

    try {
      logger.info(`${this.name} starting execution...`);

      // Initialize if not already done
      await this.initialize();

      // Publish agent started event
      this.eventBus.publish(EventTypes.AGENT_STARTED, {
        agent: this.name,
        timestamp: startTime
      });

      // ===== YOUR MAIN LOGIC HERE =====
      await this.doWork();
      // ================================

      const duration = Date.now() - startTime;

      // Publish completion event
      this.eventBus.publish(EventTypes.AGENT_COMPLETED, {
        agent: this.name,
        execution_time_ms: duration
      });

      logger.info(`${this.name} completed in ${duration}ms`);

      return { success: true, duration };

    } catch (error) {
      const duration = Date.now() - startTime;

      // Publish failure event
      this.eventBus.publish(EventTypes.AGENT_FAILED, {
        agent: this.name,
        error: error.message,
        execution_time_ms: duration
      });

      logger.error(`${this.name} failed:`, error);
      throw error;
    }
  }

  /**
   * Main work method - override this in your agent
   */
  async doWork() {
    logger.info('Doing example work...');

    // Example: Publish a custom event
    this.eventBus.publish(EventTypes.CODE_ANALYZED, {
      agent: this.name,
      results: {
        filesAnalyzed: 10,
        issuesFound: 2
      }
    });

    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 100));

    logger.info('Example work completed');
  }

  /**
   * Alias for execute() - some orchestrators call run()
   */
  async run() {
    return this.execute();
  }

  /**
   * Alias for execute() - for analyzer-type agents
   */
  async analyze() {
    return this.execute();
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    logger.info(`Cleaning up ${this.name}...`);

    // Unsubscribe from all events
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];

    this.isInitialized = false;
    logger.info(`${this.name} cleaned up`);
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ExampleAgent
 * @param {Object} options - Agent options
 * @returns {ExampleAgent}
 */
export function getExampleAgent(options = {}) {
  if (!instance) {
    instance = new ExampleAgent(options);
  }
  return instance;
}

export default ExampleAgent;


// ============================================
// USAGE EXAMPLE
// ============================================

/**
 * Example usage with the Orchestrator:
 *
 * ```javascript
 * import { initializeMinions } from 'minions';
 * import { getExampleAgent } from './example-agent.js';
 *
 * async function main() {
 *   // Initialize the framework
 *   const { orchestrator, eventBus } = await initializeMinions();
 *
 *   // Register your agent with the orchestrator
 *   orchestrator.registerAgent(
 *     'example-agent',
 *     async () => getExampleAgent({ config: { debug: true } }),
 *     [] // No dependencies
 *   );
 *
 *   // Or register with dependencies
 *   orchestrator.registerAgent(
 *     'dependent-agent',
 *     async () => getAnotherAgent(),
 *     ['example-agent'] // Runs after example-agent completes
 *   );
 *
 *   // Execute all registered agents
 *   const result = await orchestrator.execute();
 *   console.log('Execution result:', result);
 * }
 *
 * main().catch(console.error);
 * ```
 */
