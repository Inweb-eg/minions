# Getting Started

A step-by-step guide to get up and running with the Minions framework.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Basic Setup](#basic-setup)
- [Creating Your First Agent](#creating-your-first-agent)
- [Running the Orchestrator](#running-the-orchestrator)
- [Working with Events](#working-with-events)
- [Monitoring and Health](#monitoring-and-health)
- [Next Steps](#next-steps)

---

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0
- **Git** (for rollback features)

Verify your Node.js version:

```bash
node --version
# Should output v18.x.x or higher
```

---

## Installation

### Option 1: Clone and Install

```bash
git clone https://github.com/your-org/minions.git
cd minions
npm run install:all
```

### Option 2: Add to Existing Project

```bash
# Copy the minions directory to your project
cp -r minions/ your-project/

# Install dependencies
cd your-project/minions
npm run install:all
```

### Verify Installation

```bash
# Run the tests
npm test

# Run the basic example
node examples/basic-usage.js
```

---

## Basic Setup

### Initialize the Framework

```javascript
import { initializeMinions, EventTypes } from './minions/index.js';

async function main() {
  // Initialize with default options
  const {
    orchestrator,
    eventBus,
    metricsCollector,
    healthMonitor,
    alertingSystem,
    rollbackManager,
    autonomousLoopManager
  } = await initializeMinions({
    enableMetrics: true,      // Enable metrics collection
    enableHealth: true,       // Enable health monitoring
    enableAlerting: true,     // Enable alert system
    maxConcurrency: 5         // Max parallel agents
  });

  console.log('Minions framework initialized!');

  // Your code here...
}

main().catch(console.error);
```

### Understanding the Components

| Component | Purpose |
|-----------|---------|
| `orchestrator` | Coordinates agent execution in dependency order |
| `eventBus` | Pub/sub system for agent communication |
| `metricsCollector` | Collects performance metrics |
| `healthMonitor` | Tracks agent health status |
| `alertingSystem` | Triggers alerts on threshold violations |
| `rollbackManager` | Checkpoint and rollback for failure recovery |
| `autonomousLoopManager` | Manages test-fix-verify cycles |

---

## Creating Your First Agent

### Using createAgent Helper

The simplest way to create an agent:

```javascript
import { initializeMinions, createAgent, EventTypes } from './minions/index.js';

async function main() {
  const { orchestrator, eventBus } = await initializeMinions();

  // Create a simple agent
  const myAgent = createAgent({
    name: 'my-first-agent',
    execute: async () => {
      console.log('Hello from my first agent!');

      // Publish an event
      eventBus.publish(EventTypes.CODE_ANALYZED, {
        agent: 'my-first-agent',
        results: { message: 'Analysis complete' }
      });
    }
  });

  // Register with orchestrator
  orchestrator.registerAgent(
    'my-first-agent',
    async () => myAgent,
    []  // No dependencies
  );

  // Execute
  const result = await orchestrator.execute();
  console.log('Execution result:', result);
}

main();
```

### Creating an Agent Class

For more complex agents:

```javascript
import { getEventBus, EventTypes, createLogger } from './minions/index.js';

const logger = createLogger('DataProcessor');

class DataProcessor {
  constructor(options = {}) {
    this.name = 'data-processor';
    this.eventBus = getEventBus();
    this.config = options.config || {};
  }

  async initialize() {
    logger.info('Initializing DataProcessor...');
    // Setup resources, connect to databases, etc.
  }

  async execute() {
    await this.initialize();

    logger.info('Processing data...');

    // Do work
    const data = await this.processData();

    // Publish results
    this.eventBus.publish(EventTypes.CODE_ANALYZED, {
      agent: this.name,
      results: data
    });

    logger.info('Data processing complete');
    return { success: true, data };
  }

  async processData() {
    // Your data processing logic
    return { recordsProcessed: 100 };
  }
}

export default DataProcessor;
```

---

## Running the Orchestrator

### Register Multiple Agents with Dependencies

```javascript
import { initializeMinions, createAgent } from './minions/index.js';

async function main() {
  const { orchestrator, eventBus } = await initializeMinions();

  // Agent 1: Fetches data (no dependencies)
  const fetchAgent = createAgent({
    name: 'fetch-agent',
    execute: async () => {
      console.log('Fetching data...');
      await sleep(500);
      console.log('Data fetched');
    }
  });

  // Agent 2: Processes data (depends on fetch-agent)
  const processAgent = createAgent({
    name: 'process-agent',
    execute: async () => {
      console.log('Processing data...');
      await sleep(300);
      console.log('Data processed');
    }
  });

  // Agent 3: Generates report (depends on process-agent)
  const reportAgent = createAgent({
    name: 'report-agent',
    execute: async () => {
      console.log('Generating report...');
      await sleep(200);
      console.log('Report generated');
    }
  });

  // Register with dependencies
  orchestrator.registerAgent('fetch-agent', async () => fetchAgent, []);
  orchestrator.registerAgent('process-agent', async () => processAgent, ['fetch-agent']);
  orchestrator.registerAgent('report-agent', async () => reportAgent, ['process-agent']);

  // Execute all agents in order
  const result = await orchestrator.execute();

  console.log('\nExecution Summary:');
  console.log(`  Success: ${result.success}`);
  console.log(`  Duration: ${result.duration}ms`);
  console.log(`  Agents Executed: ${result.agentsExecuted}`);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

main();
```

**Output:**
```
Fetching data...
Data fetched
Processing data...
Data processed
Generating report...
Report generated

Execution Summary:
  Success: true
  Duration: 1023ms
  Agents Executed: 3
```

### Parallel Execution

Agents without dependencies run in parallel:

```javascript
// These agents will run in parallel (no dependencies between them)
orchestrator.registerAgent('agent-a', async () => agentA, []);
orchestrator.registerAgent('agent-b', async () => agentB, []);
orchestrator.registerAgent('agent-c', async () => agentC, []);

// This agent waits for all above to complete
orchestrator.registerAgent('final-agent', async () => finalAgent, [
  'agent-a', 'agent-b', 'agent-c'
]);
```

---

## Working with Events

### Publishing Events

```javascript
import { getEventBus, EventTypes } from './minions/index.js';

const eventBus = getEventBus();

// Publish a simple event
eventBus.publish(EventTypes.CODE_GENERATED, {
  agent: 'my-agent',
  files: ['src/new-file.js'],
  linesOfCode: 150
});

// Publish test results
eventBus.publish(EventTypes.TESTS_COMPLETED, {
  agent: 'tester-agent',
  summary: {
    total: 50,
    passed: 48,
    failed: 2
  },
  duration: 5000
});
```

### Subscribing to Events

```javascript
// Subscribe to specific event type
const unsubscribe = eventBus.subscribe(
  EventTypes.TESTS_FAILED,
  'my-subscriber',
  (data, event) => {
    console.log('Tests failed!');
    console.log('Failed tests:', data.failures);
    console.log('Event ID:', event.id);
    console.log('Timestamp:', new Date(event.timestamp));
  }
);

// Subscribe to all events
eventBus.subscribeToAll('monitor', (data) => {
  console.log(`[${data.type}] from ${data.agent}`);
});

// Unsubscribe when done
unsubscribe();
```

### Querying Event History

```javascript
// Get all events of a type
const completedEvents = eventBus.getHistory({
  eventType: EventTypes.AGENT_COMPLETED
});

// Get recent events
const recentEvents = eventBus.getHistory({
  since: Date.now() - 3600000  // Last hour
});

// Limit results
const last10 = eventBus.getHistory({
  eventType: EventTypes.ERROR_OCCURRED,
  limit: 10
});
```

---

## Monitoring and Health

### Check Agent Health

```javascript
import { getHealthMonitor, HealthStatus } from './minions/index.js';

const healthMonitor = getHealthMonitor();

// Get health summary
const summary = healthMonitor.getHealthSummary();
console.log(`Total Agents: ${summary.total_agents}`);
console.log(`Healthy: ${summary.healthy}`);
console.log(`Degraded: ${summary.degraded}`);
console.log(`Unhealthy: ${summary.unhealthy}`);
console.log(`Average Score: ${summary.average_score}`);

// Get specific agent health
const agentHealth = healthMonitor.getAgentHealth('my-agent');
console.log(`Status: ${agentHealth.status}`);
console.log(`Score: ${agentHealth.score}`);
console.log(`Issues: ${agentHealth.issues.join(', ')}`);

// Get unhealthy agents
const unhealthy = healthMonitor.getUnhealthyAgents();
unhealthy.forEach(({ name, health }) => {
  console.log(`${name}: ${health.status} (${health.score})`);
});
```

### Check Metrics

```javascript
import { getMetricsCollector } from './minions/index.js';

const metrics = getMetricsCollector();

// Get agent metrics
const agentMetrics = metrics.getAgentMetrics('my-agent');
console.log(`Executions: ${agentMetrics.executions.total}`);
console.log(`Success Rate: ${agentMetrics.executions.success_rate}%`);
console.log(`Avg Time: ${agentMetrics.performance.avg_execution_time_ms}ms`);

// Get system metrics
const systemMetrics = metrics.getSystemMetrics();
console.log(`Uptime: ${systemMetrics.uptime_seconds}s`);
console.log(`Memory: ${systemMetrics.memory_usage_mb}MB`);
console.log(`Active Agents: ${systemMetrics.active_agents}`);
```

### Setup Alert Handlers

```javascript
import { getAlertingSystem } from './minions/index.js';

const alerting = getAlertingSystem();

// Log alerts
alerting.registerHandler('console', async (alert) => {
  console.log(`[${alert.severity}] ${alert.title}: ${alert.message}`);
});

// Send to Slack (example)
alerting.registerHandler('slack', async (alert) => {
  // Your Slack integration
  await slack.send({
    channel: '#alerts',
    text: `*${alert.severity}*: ${alert.title}\n${alert.message}`
  });
});

// Email critical alerts (example)
alerting.registerHandler('email', async (alert) => {
  if (alert.severity === 'P1_CRITICAL') {
    await sendEmail({
      to: 'oncall@company.com',
      subject: `[CRITICAL] ${alert.title}`,
      body: alert.message
    });
  }
});
```

---

## Next Steps

### 1. Create Custom Agents

See [Creating Agents Guide](./creating-agents.md) for detailed patterns.

### 2. Use Built-in Skills

```javascript
import {
  getAutoFixer,
  getCodeReviewer,
  getSecurityScanner,
  getTestGenerator,
  getDependencyAnalyzer
} from './minions/index.js';

// Auto-fix test failures
const fixer = getAutoFixer({ projectRoot: '/path/to/project' });
await fixer.initialize();
await fixer.handleTestFailure({ testOutput, failedTests });

// Review code quality
const reviewer = getCodeReviewer();
await reviewer.initialize();
const review = await reviewer.review('/path/to/file.js');

// Scan for security issues
const scanner = getSecurityScanner();
const securityResults = await scanner.scan('/path/to/project');
```

### 3. Setup Autonomous Fix Loops

```javascript
import { getAutonomousLoopManager } from './minions/index.js';

const loopManager = getAutonomousLoopManager();

// Register matcher to route failures to agents
loopManager.registerAgentMatcher((failure, platform) => {
  if (failure.file?.includes('api/')) return 'api-agent';
  if (failure.file?.includes('frontend/')) return 'frontend-agent';
  return null;
});

// Register agents
loopManager.registerAgent('api-agent', apiAgentInstance);
loopManager.registerAgent('frontend-agent', frontendAgentInstance);

// Loop activates automatically on TESTS_FAILED events
```

### 4. Read the Full Documentation

- [API Reference](./api-reference.md) - Complete API documentation
- [Architecture Guide](./architecture.md) - Deep dive into internals
- [Creating Agents](./creating-agents.md) - Agent development patterns
- [Skills Guide](./skills-guide.md) - Using and creating skills

### 5. Run the Examples

```bash
# Basic usage
node examples/basic-usage.js

# Example agent template
node examples/example-agent.js
```
