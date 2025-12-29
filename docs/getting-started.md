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
- [Phase 0: Persistence and State](#phase-0-persistence-and-state)
- [Phase 1-3: Strategic Planning Agents](#phase-1-3-strategic-planning-agents)
- [Code Writer Agents](#code-writer-agents)
- [CLI Usage](#cli-usage)
- [Self-Evolution Pipeline](#self-evolution-pipeline)
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

## Phase 0: Persistence and State

Phase 0 adds persistence, decision logging, and state management capabilities.

### Enable Phase 0 Components

```javascript
import { initializeMinions } from './minions/index.js';

const {
  memoryStore,
  decisionLogger,
  enhancedEventBus
} = await initializeMinions({
  enableMemoryStore: true,       // Persistent storage
  enableDecisionLogger: true,    // Decision tracking
  enableEnhancedEventBus: true   // Priority events
});
```

### Using MemoryStore

Store and retrieve data across sessions:

```javascript
import { getMemoryStore, MemoryNamespace } from './minions/index.js';

const memoryStore = getMemoryStore();
await memoryStore.initialize();

// Store project configuration
await memoryStore.set(
  MemoryNamespace.CONFIG,
  'api-settings',
  { baseUrl: 'https://api.example.com', timeout: 5000 }
);

// Retrieve later
const config = await memoryStore.get(MemoryNamespace.CONFIG, 'api-settings');

// Store with TTL (auto-expires after 1 hour)
await memoryStore.set(
  MemoryNamespace.AGENT_STATE,
  'cache-data',
  { data: 'temporary' },
  { ttl: 3600000 }
);
```

### Logging Decisions

Track agent decisions for learning and debugging:

```javascript
import { getDecisionLogger, DecisionType, DecisionOutcome } from './minions/index.js';

const decisionLogger = getDecisionLogger();
await decisionLogger.initialize();

// Log a decision
const decisionId = await decisionLogger.log({
  agent: 'architect-agent',
  type: DecisionType.ARCHITECTURAL,
  decision: 'Use MongoDB for user data',
  reasoning: 'Schema flexibility needed for user profiles',
  confidence: 0.9
});

// Update outcome later
await decisionLogger.updateOutcome(decisionId, DecisionOutcome.SUCCESS);

// Query past decisions
const pastDecisions = await decisionLogger.query({
  type: DecisionType.ARCHITECTURAL,
  outcome: DecisionOutcome.SUCCESS
});
```

### Using State Machines

Manage agent state predictably:

```javascript
import { createAgentStateMachine, AgentState } from './minions/index.js';

const stateMachine = createAgentStateMachine({
  name: 'my-agent',
  initialState: AgentState.IDLE,
  persist: true  // Persists across restarts
});

await stateMachine.initialize();

// Transition states
await stateMachine.transition(AgentState.PLANNING, { task: 'process-data' });
await stateMachine.transition(AgentState.EXECUTING);
await stateMachine.transition(AgentState.COMPLETED);

// Check current state
const current = stateMachine.getState();
console.log(`Current state: ${current.state}`);

// View history
const history = stateMachine.getHistory();
```

---

## Phase 1-3: Strategic Planning Agents

Enable the strategic planning layer for end-to-end autonomous development.

### Enable Strategic Agents

```javascript
import { initializeMinions } from './minions/index.js';

const {
  visionAgent,
  architectAgent,
  plannerAgent
} = await initializeMinions({
  enableVisionAgent: true,      // Product owner
  enableArchitectAgent: true,   // Technical authority
  enablePlannerAgent: true,     // Execution engine
  projectRoot: process.cwd()
});
```

### Vision Agent: Parse Requirements

```javascript
// Parse README to extract features
const requirements = await visionAgent.parseReadme('./README.md');
console.log('Features found:', requirements.features.length);

// Decompose a feature into tasks
const decomposition = await visionAgent.decomposeFeature({
  name: 'User Authentication',
  description: 'Allow users to register and login'
});
console.log('Tasks created:', decomposition.tasks.length);

// Track product state
const state = await visionAgent.getProductState();
console.log(`Progress: ${state.coverage * 100}%`);
```

### Architect Agent: Design System

```javascript
// Generate system blueprint
const blueprint = await architectAgent.generateBlueprint(requirements);
console.log('Layers:', blueprint.layers);
console.log('Patterns:', blueprint.patterns);

// Define API contracts
await architectAgent.defineContract({
  name: 'UserAPI',
  basePath: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', response: 'User[]' },
    { method: 'POST', path: '/', body: 'CreateUser', response: 'User' }
  ]
});

// Check for drift
const drift = await architectAgent.detectDrift();
if (drift.driftPercentage > 0.1) {
  console.log('Warning: Architecture drift detected!');
}
```

### Planner Agent: Execute Plan

```javascript
// Create execution plan
const plan = await plannerAgent.createPlan(decomposition.tasks);
console.log('Phases:', plan.phases.length);

// Execute the plan
await plannerAgent.executePlan(plan.id);

// Monitor progress
const progress = await plannerAgent.getProgress();
console.log(`Progress: ${progress.percentage}%`);
console.log(`ETA: ${progress.estimatedTimeRemaining}ms`);

// Pause/resume as needed
await plannerAgent.pauseExecution();
await plannerAgent.resumeExecution();
```

---

## Code Writer Agents

Generate code for Flutter, backend, and frontend platforms.

### Initialize Writer Agents

```javascript
import { initializeMinions } from './minions/index.js';

await initializeMinions({
  enableWriterAgents: true,
  writerAgentOptions: {
    flutterConfig: {
      projectPath: './flutter-app',
      stateManagement: 'bloc'
    },
    backendConfig: {
      projectPath: './backend',
      orm: 'mongoose',
      validator: 'joi'
    },
    frontendConfig: {
      projectPath: './frontend',
      stateManagement: 'context',
      cssFramework: 'tailwind'
    }
  }
});
```

### Generate Flutter Code

```javascript
import { getFlutterWriterAgent } from './minions/index.js';

const flutter = getFlutterWriterAgent();
await flutter.initialize();

// Generate a widget
const widget = await flutter.generateWidget({
  name: 'UserCard',
  type: 'stateless',
  props: [
    { name: 'user', type: 'User', required: true },
    { name: 'onTap', type: 'VoidCallback' }
  ]
});

// Generate a Bloc
const bloc = await flutter.generateBloc({
  name: 'Auth',
  events: ['Login', 'Logout'],
  states: ['Initial', 'Loading', 'Authenticated', 'Error']
});
```

### Generate Backend Code

```javascript
import { getBackendWriterAgent } from './minions/index.js';

const backend = getBackendWriterAgent();
await backend.initialize();

// Generate a model
const model = await backend.generateModel({
  name: 'User',
  orm: 'mongoose',
  fields: [
    { name: 'email', type: 'string', required: true, unique: true },
    { name: 'name', type: 'string', required: true }
  ]
});

// Generate a route
const route = await backend.generateRoute({
  name: 'users',
  basePath: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', handler: 'list' },
    { method: 'POST', path: '/', handler: 'create' }
  ]
});
```

### Generate Frontend Code

```javascript
import { getFrontendWriterAgent } from './minions/index.js';

const frontend = getFrontendWriterAgent();
await frontend.initialize();

// Generate a component
const component = await frontend.generateComponent({
  name: 'UserProfile',
  type: 'functional',
  props: [{ name: 'userId', type: 'string', required: true }]
});

// Generate a custom hook
const hook = await frontend.generateHook({
  name: 'useUser',
  type: 'query',
  endpoint: '/api/users/:id'
});
```

---

## CLI Usage

Use the command-line interface for code generation.

### Generate Code from CLI

```bash
# Generate a Flutter widget
node cli/index.js generate flutter widget --name UserCard --type stateless

# Generate a backend model
node cli/index.js generate backend model --name User --orm mongoose

# Generate a React component
node cli/index.js generate frontend component --name UserProfile
```

### CLI Options

```bash
--config, -c    Path to configuration file
--output, -o    Output directory
--dry-run       Preview without writing files
--verbose, -v   Verbose output
```

### Using Configuration File

Create `minions.config.json`:

```json
{
  "flutter": {
    "projectPath": "./flutter-app",
    "stateManagement": "bloc"
  },
  "backend": {
    "projectPath": "./backend",
    "orm": "mongoose"
  },
  "frontend": {
    "projectPath": "./frontend",
    "stateManagement": "context"
  }
}
```

Then run:

```bash
node cli/index.js generate flutter widget --name MyWidget --config minions.config.json
```

---

## Self-Evolution Pipeline

Minions is a **self-improving framework**. Describe what you want in markdown, and it will analyze, plan, generate code, and test automatically.

### Quick Start: Extend Minions

**1. Write your evolution plan** (`minions-self-evolution-plan.md`):

```markdown
# My Evolution Plan

## Features

### New Agent: Slack Notifier
Send Slack notifications on build events.
- Subscribe to AGENT_FAILED events
- Format messages with error details
- Support multiple channels

### Enhancement: Retry Logic
Add automatic retry for transient failures.
- Configurable retry count (default: 3)
- Exponential backoff
- Skip for permanent failures

## Requirements
- Backwards compatible
- Include unit tests
```

**2. Run evolution:**

```bash
node evolve.js
```

**3. Review generated code** in `generated/` folder and commits in git log.

### What Happens During Evolution

| Phase | Description |
|-------|-------------|
| 1 | **Analysis** - Vision Agent reads plan, Architect creates blueprint |
| 2 | **Decomposition** - Features → Epics → Stories → Tasks |
| 3 | **Code Generation** - Writer agents generate code |
| 4 | **Test & Fix** - Run tests, auto-fix failures |

### CLI Options

```bash
node evolve.js                     # Full evolution with commits
node evolve.js --no-commit         # Skip git commits
node evolve.js --phase=2           # Start from phase 2
node evolve.js --dry-run           # Preview only
node evolve.js --continue-on-error # Don't stop on failures
```

### Writing Effective Evolution Plans

**Do:**
- Be specific about what you want built
- Include acceptance criteria
- Reference existing patterns ("like TesterAgent")
- List feature dependencies

**Example - Good:**
```markdown
### Rate Limiter Middleware
Add Express middleware to limit API requests.
- 100 requests per minute per IP
- Return 429 status when exceeded
- Configurable via environment variables
- Similar to existing auth middleware pattern
```

**Example - Too Vague:**
```markdown
### Better Performance
Make the system faster.
```

---

## Next Steps

### 1. Create Custom Agents

See [Creating Agents Guide](./creating-agents.md) for detailed patterns.

### 2. Use Specialized Agents

The framework includes pre-built agents for common workflows:

```javascript
import {
  getTesterAgent,
  getDockerAgent,
  getGithubAgent,
  getCodebaseAnalyzer,
  getDocumentAgent
} from './minions/index.js';

// Multi-platform testing with coverage analysis
const tester = getTesterAgent();
const testResults = await tester.runTests({
  platform: 'backend',
  testPaths: ['tests/'],
  coverage: true
});

// Docker lifecycle management
const docker = getDockerAgent();
await docker.validate('./Dockerfile');
await docker.build({ context: '.', tag: 'myapp:latest' });

// GitHub automation
const github = getGithubAgent();
await github.createPullRequest({
  title: 'Add feature',
  body: 'Description...',
  base: 'main',
  head: 'feature/new'
});

// Deep codebase analysis
const analyzer = getCodebaseAnalyzer();
const report = await analyzer.analyze({
  projectRoot: '.',
  analyzers: ['security', 'performance', 'technical-debt']
});

// Documentation sync
const docAgent = getDocumentAgent();
await docAgent.sync({
  codeDir: 'src/',
  docsDir: 'docs/',
  mode: 'bidirectional'
});
```

### 3. Use Built-in Skills

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

### 4. Setup Autonomous Fix Loops

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

### 5. Customize Code Templates

Modify templates in `templates/` to match your coding conventions. See the [Templates Guide](../templates/README.md).

### 6. Read the Full Documentation

- [API Reference](./api-reference.md) - Complete API documentation
- [Architecture Guide](./architecture.md) - Deep dive into internals
- [Creating Agents](./creating-agents.md) - Agent development patterns
- [Skills Guide](./skills-guide.md) - Using and creating skills
- [Templates Guide](../templates/README.md) - Customize code generation templates

### 7. Run the Examples

```bash
# Basic usage
node examples/basic-usage.js

# Example agent template
node examples/example-agent.js
```
