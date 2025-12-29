#!/usr/bin/env node
/**
 * Minions Framework - Entry Point
 * ================================
 * Autonomous multi-agent system for AI-powered development workflows.
 *
 * Usage:
 *   node index.js              # Start in standard mode
 *   node index.js --gru        # Start Gru web interface
 *   node index.js --help       # Show help
 */

import EventEmitter from 'events';
import path from 'path';
import { fileURLToPath } from 'url';

// Foundation components
import { getEventBus } from './foundation/event-bus/AgentEventBus.js';
import { createLogger } from './foundation/common/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = createLogger('Minions');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    gru: false,
    port: parseInt(process.env.MINIONS_PORT) || 2505,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--gru' || arg === '-g') {
      options.gru = true;
    } else if (arg === '--port' || arg === '-p') {
      options.port = parseInt(args[++i]) || 2505;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
Minions Framework
=================
Autonomous multi-agent system for AI-powered development workflows.

Usage:
  node index.js [options]

Options:
  --gru, -g       Start Gru web interface for client interaction
  --port, -p      Set web interface port (default: 2505)
  --help, -h      Show this help message

Examples:
  node index.js                 # Start in standard mode
  node index.js --gru           # Start Gru web interface
  node index.js --gru -p 3000   # Start Gru on port 3000

Environment Variables:
  MINIONS_PORT     Web interface port (default: 2505)
  OLLAMA_HOST      Ollama server URL (default: http://localhost:11434)
  OLLAMA_MODEL     Ollama model name (default: llama3.2:3b)
  GEMINI_API_KEY   Google Gemini API key (fallback AI)
`);
}

/**
 * Initialize and start Gru interface
 */
async function startGru(options) {
  logger.info('Starting Minions with Gru interface...');

  try {
    // Dynamic import to avoid loading if not needed
    const { GruAgent } = await import('./agents/gru-agent/index.js');
    const { getNefarioAgent } = await import('./agents/nefario-agent/index.js');

    // Import Silas and Lucy if available
    let ProjectManagerAgent, ProjectCompletionAgent;
    try {
      const silasModule = await import('./agents/project-manager-agent/index.js');
      ProjectManagerAgent = silasModule.ProjectManagerAgent;
    } catch (e) {
      logger.warn('ProjectManagerAgent (Silas) not available');
    }

    try {
      const lucyModule = await import('./agents/project-completion-agent/index.js');
      ProjectCompletionAgent = lucyModule.ProjectCompletionAgent;
    } catch (e) {
      logger.warn('ProjectCompletionAgent (Lucy) not available');
    }

    // Create Gru instance
    const gru = GruAgent.getInstance({
      port: options.port,
      fallbackPort: options.port === 2505 ? 8005 : options.port + 1
    });

    // Initialize Gru
    await gru.initialize();

    // Set up Dr. Nefario
    const nefario = getNefarioAgent();
    await nefario.initialize();

    // Connect agents
    const agents = { nefario };

    // Add Silas if available
    if (ProjectManagerAgent) {
      try {
        const silas = ProjectManagerAgent.getInstance();
        await silas.initialize();
        agents.silas = silas;
        logger.info('Silas (ProjectManager) connected');
      } catch (e) {
        logger.warn(`Failed to initialize Silas: ${e.message}`);
      }
    }

    // Add Lucy if available
    if (ProjectCompletionAgent) {
      try {
        const lucy = ProjectCompletionAgent.getInstance();
        await lucy.initialize();
        agents.lucy = lucy;
        logger.info('Lucy (ProjectCompletion) connected');
      } catch (e) {
        logger.warn(`Failed to initialize Lucy: ${e.message}`);
      }
    }

    // Connect all agents to Gru
    gru.setAgents(agents);

    // Start Gru (this starts the web server)
    const result = await gru.start();

    logger.info(`Minions Gru interface running at http://localhost:${result.port}`);
    logger.info('Press Ctrl+C to stop');

    // Handle shutdown
    const shutdown = async () => {
      logger.info('Shutting down Minions...');

      await gru.shutdown();
      await nefario.shutdown();

      if (agents.silas) await agents.silas.shutdown();
      if (agents.lucy) await agents.lucy.shutdown();

      logger.info('Minions shutdown complete');
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    return gru;
  } catch (error) {
    logger.error(`Failed to start Gru: ${error.message}`);
    throw error;
  }
}

/**
 * Initialize standard framework mode
 */
async function initializeMinions() {
  logger.info('Initializing Minions Framework...');

  const eventBus = getEventBus();

  // Import core components
  const components = {};

  try {
    const { getOrchestrator } = await import('./agents/manager-agent/orchestrator.js');
    components.orchestrator = getOrchestrator();
    logger.info('Orchestrator loaded');
  } catch (e) {
    logger.warn(`Orchestrator not available: ${e.message}`);
  }

  try {
    const { getHealthMonitor } = await import('./foundation/health-monitor/HealthMonitor.js');
    components.healthMonitor = getHealthMonitor();
    logger.info('HealthMonitor loaded');
  } catch (e) {
    logger.debug(`HealthMonitor not available: ${e.message}`);
  }

  try {
    const { getMetricsCollector } = await import('./foundation/metrics-collector/MetricsCollector.js');
    components.metricsCollector = getMetricsCollector();
    logger.info('MetricsCollector loaded');
  } catch (e) {
    logger.debug(`MetricsCollector not available: ${e.message}`);
  }

  logger.info('Minions Framework initialized');

  return {
    eventBus,
    ...components
  };
}

/**
 * Main entry point
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    showHelp();
    return;
  }

  try {
    if (options.gru) {
      await startGru(options);
    } else {
      const framework = await initializeMinions();
      logger.info('Minions is ready. Use --gru flag for web interface.');

      // Export for programmatic use
      return framework;
    }
  } catch (error) {
    logger.error(`Minions startup failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

// Export for programmatic use
export {
  initializeMinions,
  startGru,
  getEventBus
};

export default initializeMinions;
