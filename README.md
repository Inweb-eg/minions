# Minions

A generic, reusable autonomous multi-agent system framework for AI-powered development workflows.

## Overview

Minions is an event-driven framework for building and orchestrating multiple AI agents that work together autonomously. It provides enterprise-grade infrastructure for agent coordination, health monitoring, and automatic failure recovery.

### Key Features

- **Event-Driven Architecture** - Centralized pub/sub system with 80+ event types for loose coupling between agents
- **Dependency-Based Orchestration** - Agents execute in topologically-sorted order with parallel execution support
- **Health Monitoring & Alerting** - Real-time health tracking with configurable alert thresholds
- **Autonomous Fix Loops** - Automatic test-fix-verify cycles with tiered recovery strategies
- **Checkpoint & Rollback** - Git-aware checkpointing for safe failure recovery
- **Built-in Skills** - Auto-fixer, code review, security scanning, dependency analysis, test generation
- **Specialized Agents** - Pre-built agents for testing, Docker, GitHub, codebase analysis, and documentation

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              YOUR PROJECT                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                          ORCHESTRATOR                                │   │
│   │  - Dependency resolution (topological sort)                         │   │
│   │  - Parallel execution with concurrency control                      │   │
│   │  - Checkpoint/rollback on failure                                   │   │
│   └───────────────────────────────┬─────────────────────────────────────┘   │
│                                   │                                          │
│   ┌───────────────────────────────▼─────────────────────────────────────┐   │
│   │                           EVENT BUS                                  │   │
│   │  - Pub/Sub for agent communication (80+ event types)                │   │
│   │  - Event history (configurable retention)                           │   │
│   │  - Error isolation per subscriber                                   │   │
│   └─────┬─────────┬─────────┬─────────┬─────────┬─────────┬─────────────┘   │
│         │         │         │         │         │         │                  │
│   ┌─────▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐            │
│   │ Tester  │ │Docker │ │GitHub │ │  Doc  │ │Custom │ │Custom │            │
│   │  Agent  │ │ Agent │ │ Agent │ │ Agent │ │Agent 1│ │Agent N│            │
│   └─────────┘ └───────┘ └───────┘ └───────┘ └───────┘ └───────┘            │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                        SKILLS LAYER                                  │   │
│   │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐    │   │
│   │  │ AutoFixer │ │  Code     │ │ Security  │ │    Test           │    │   │
│   │  │           │ │ Reviewer  │ │ Scanner   │ │   Generator       │    │   │
│   │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                      FOUNDATION SERVICES                             │   │
│   │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────────┐    │   │
│   │  │  Health   │ │  Metrics  │ │  Alerting │ │    Rollback       │    │   │
│   │  │  Monitor  │ │ Collector │ │  System   │ │    Manager        │    │   │
│   │  └───────────┘ └───────────┘ └───────────┘ └───────────────────┘    │   │
│   │  ┌───────────┐ ┌───────────┐ ┌───────────────────────────────────┐  │   │
│   │  │  Logger   │ │ Analyzers │ │       AST Parser (Babel)          │  │   │
│   │  │  (Pino)   │ │           │ │                                   │  │   │
│   │  └───────────┘ └───────────┘ └───────────────────────────────────┘  │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
# Clone and install
cd minions
npm run install:all
```

**Requirements:** Node.js >= 18.0.0

## Quick Start

```javascript
import { initializeMinions, createAgent, EventTypes } from 'minions';

async function main() {
  // Initialize the framework
  const { orchestrator, eventBus } = await initializeMinions({
    enableMetrics: true,
    enableHealth: true,
    maxConcurrency: 5
  });

  // Create agents
  const dataAgent = createAgent({
    name: 'data-agent',
    execute: async () => {
      console.log('Processing data...');
      eventBus.publish(EventTypes.CODE_ANALYZED, {
        agent: 'data-agent',
        results: { filesAnalyzed: 10 }
      });
    }
  });

  const analyzerAgent = createAgent({
    name: 'analyzer-agent',
    execute: async () => {
      console.log('Running analysis...');
    }
  });

  // Register with dependencies
  orchestrator.registerAgent('data-agent', async () => dataAgent, []);
  orchestrator.registerAgent('analyzer-agent', async () => analyzerAgent, ['data-agent']);

  // Execute - runs in dependency order
  const result = await orchestrator.execute();
  console.log('Result:', result);
}

main();
```

## Core Components

### Orchestrator

Coordinates agent execution with dependency resolution and parallel processing:

```javascript
const { orchestrator } = await initializeMinions();

// Register agents with dependencies
orchestrator.registerAgent('data-agent', loaderFn, []);
orchestrator.registerAgent('analyzer', loaderFn, ['data-agent']);
orchestrator.registerAgent('reporter', loaderFn, ['analyzer']);

// Execute - runs: data-agent → analyzer → reporter
const result = await orchestrator.execute();

// Check status
const status = orchestrator.getStatus();
```

### Autonomous Loop Manager

Manages test-fix-verify cycles automatically:

```javascript
import { getAutonomousLoopManager } from 'minions';

const loopManager = getAutonomousLoopManager();

// Register custom matcher for routing failures to agents
loopManager.registerAgentMatcher((failure, platform) => {
  if (failure.file?.includes('api/')) return 'api-agent';
  if (failure.file?.includes('frontend/')) return 'frontend-agent';
  return null;
});

// Register agents that can fix issues
loopManager.registerAgent('api-agent', apiAgentInstance);

// Loop triggers automatically on TESTS_FAILED events
```

### Health Monitor

Tracks agent health with configurable checks:

```javascript
import { getHealthMonitor, HealthStatus } from 'minions';

const healthMonitor = getHealthMonitor();

// Register custom health check
healthMonitor.registerHealthCheck('my-agent', async (metrics) => ({
  passed: metrics.custom_metric > threshold,
  message: 'Custom metric check'
}));

// Get health summary
const summary = healthMonitor.getHealthSummary();
// { total_agents, healthy, degraded, unhealthy, average_score }
```

### Alerting System

Triggers alerts on threshold violations:

```javascript
import { getAlertingSystem } from 'minions';

const alerting = getAlertingSystem();

// Register alert handlers
alerting.registerHandler('slack', async (alert) => {
  await slack.send({
    channel: '#alerts',
    text: `[${alert.severity}] ${alert.title}: ${alert.message}`
  });
});

// Update thresholds
alerting.updateThresholds('P1_CRITICAL', {
  errorRate: 15,      // Trigger at 15% error rate
  executionTime: 600000  // 10 minutes
});
```

## Specialized Agents

Minions includes pre-built specialized agents for common development workflows.

### Tester Agent

Multi-platform test orchestration with comprehensive analysis capabilities:

```javascript
import { getTesterAgent } from 'minions';

const tester = getTesterAgent();

// Run tests with multiple capabilities
await tester.runTests({
  platform: 'backend',
  testPaths: ['tests/'],
  coverage: true
});

// Features:
// - Multi-platform runners (Backend, React, Flutter, E2E)
// - Coverage analysis with gap detection
// - Regression detection
// - Flaky test identification
// - Performance benchmarking
// - Mutation testing
// - Bug and fix suggestion reports
```

### Docker Agent

Complete Docker lifecycle management:

```javascript
import { getDockerAgent } from 'minions';

const docker = getDockerAgent();

// Validate and build Docker images
await docker.validate('./Dockerfile');
await docker.build({ context: '.', tag: 'myapp:latest' });

// Features:
// - File, config, and dependency change detection
// - Dockerfile and docker-compose validation
// - Image size optimization
// - Layer analysis
// - Vulnerability scanning
// - Health and resource monitoring
```

### GitHub Agent

Complete GitHub automation:

```javascript
import { getGithubAgent } from 'minions';

const github = getGithubAgent();

// Manage branches and PRs
await github.createBranch('feature/new-feature');
await github.createPullRequest({
  title: 'Add new feature',
  body: 'Description...',
  base: 'main',
  head: 'feature/new-feature'
});

// Features:
// - Branch and PR management
// - Automated code review engine
// - Merge conflict detection and resolution
// - Issue tracking and management
// - Release management with analytics
```

### Codebase Analyzer Agent

System-wide deep analysis across codebases:

```javascript
import { getCodebaseAnalyzer } from 'minions';

const analyzer = getCodebaseAnalyzer();

// Run comprehensive analysis
const report = await analyzer.analyze({
  projectRoot: '/path/to/project',
  analyzers: ['security', 'performance', 'dependencies', 'technical-debt']
});

// Features:
// - Codebase-level security scanning
// - Performance analysis across files
// - Dependency mapping
// - API contract validation
// - Technical debt measurement
```

### Document Agent

Bidirectional code-documentation synchronization:

```javascript
import { getDocumentAgent } from 'minions';

const docAgent = getDocumentAgent();

// Sync documentation with code
await docAgent.sync({
  codeDir: 'src/',
  docsDir: 'docs/',
  mode: 'bidirectional'
});

// Features:
// - Code → Docs: Parse code and update documentation (OpenAPI, CHANGELOG)
// - Docs → Code: Parse docs and generate platform-specific digests
// - Breaking change detection
// - Conflict resolution
// - Document versioning
// - Incremental parsing with caching
```

## Built-in Skills

### Auto-Fixer

```javascript
import { getAutoFixer } from 'minions';

const autoFixer = getAutoFixer({ projectRoot: '/path/to/project' });
await autoFixer.initialize();
await autoFixer.handleTestFailure({ testOutput, failedTests });
```

### Code Reviewer

```javascript
import { getCodeReviewer } from 'minions';

const reviewer = getCodeReviewer();
await reviewer.initialize();
const review = await reviewer.review('/path/to/file.js');
// { issues, qualityScore, summary }
```

### Security Scanner

```javascript
import { getSecurityScanner } from 'minions';

const scanner = getSecurityScanner();
const results = await scanner.scan('/path/to/project');
// Detects: hardcoded secrets, SQL injection, XSS, weak auth, etc.
```

### Test Generator

```javascript
import { getTestGenerator } from 'minions';

const generator = getTestGenerator();
const tests = await generator.generate('/path/to/source.js');
```

### Dependency Analyzer

```javascript
import { getDependencyAnalyzer } from 'minions';

const analyzer = getDependencyAnalyzer();
const deps = await analyzer.analyze('/path/to/project');
```

## Creating Custom Agents

```javascript
import { getEventBus, EventTypes, createLogger } from 'minions';

const logger = createLogger('MyAgent');

class MyAgent {
  constructor() {
    this.name = 'my-agent';
    this.eventBus = getEventBus();
    this.unsubscribers = [];
  }

  async initialize() {
    // Subscribe to events
    this.unsubscribers.push(
      this.eventBus.subscribe(
        EventTypes.AUTO_FIX_REQUESTED,
        this.name,
        this.handleFixRequest.bind(this)
      )
    );
  }

  async handleFixRequest(data) {
    if (data.targetAgent !== this.name) return;

    for (const task of data.tasks) {
      await this.fixTask(task);
    }

    this.eventBus.publish(EventTypes.FIX_COMPLETED, {
      agent: this.name,
      tasksCompleted: data.tasks.length
    });
  }

  async execute() {
    await this.initialize();

    // Main execution logic
    logger.info('Agent executing...');

    this.eventBus.publish(EventTypes.AGENT_COMPLETED, {
      agent: this.name,
      execution_time_ms: 100
    });
  }

  async cleanup() {
    this.unsubscribers.forEach(fn => fn());
  }
}
```

See `examples/example-agent.js` for a complete template.

## Event Types

```javascript
import { EventTypes } from 'minions';

// Code Events
EventTypes.CODE_GENERATED      // New code created
EventTypes.CODE_UPDATED        // Code modified
EventTypes.CODE_ANALYZED       // Code analysis complete

// Testing Events
EventTypes.TESTS_STARTED       // Test run started
EventTypes.TESTS_COMPLETED     // All tests passed
EventTypes.TESTS_FAILED        // Some tests failed

// Agent Lifecycle
EventTypes.AGENT_STARTED       // Agent began execution
EventTypes.AGENT_COMPLETED     // Agent finished successfully
EventTypes.AGENT_FAILED        // Agent encountered error

// Auto-Fix Coordination
EventTypes.AUTO_FIX_REQUESTED  // Request to fix issues
EventTypes.FIX_COMPLETED       // Fix applied successfully
EventTypes.FIX_FAILED          // Fix failed

// Health & Metrics
EventTypes.METRICS_COLLECTED   // Metrics snapshot taken
EventTypes.ALERT_TRIGGERED     // Alert threshold exceeded
EventTypes.AGENT_HEALTH_CHECK  // Health check performed

// See foundation/event-bus/eventTypes.js for full list (80+ events)
```

## Project Structure

```
minions/
├── index.js                    # Main entry point & exports
├── package.json
├── foundation/                 # Core infrastructure
│   ├── event-bus/             # AgentEventBus, EventTypes (80+ events)
│   ├── health-monitor/        # HealthMonitor, HealthStatus
│   ├── metrics-collector/     # MetricsCollector
│   ├── alerting/              # AlertingSystem
│   ├── rollback-manager/      # RollbackManager (git-aware)
│   ├── analyzers/             # BaseAnalyzer, SecurityScanner, PerformanceAnalyzer
│   ├── parsers/               # ASTParser (Babel-based)
│   ├── common/                # Logger (Pino-based)
│   └── tests/                 # Unit tests (Jest)
├── agents/
│   ├── manager-agent/         # Orchestration components
│   │   ├── orchestrator.js
│   │   ├── autonomous-loop-manager.js
│   │   ├── autonomous-build-manager.js
│   │   ├── dependency-graph.js
│   │   ├── change-detector.js
│   │   └── agent-pool.js
│   ├── skills/                # Reusable capabilities
│   │   ├── BaseSkill.js
│   │   ├── auto-fixer/
│   │   ├── code-review/
│   │   ├── security-scanner/
│   │   ├── dependency-analyzer/
│   │   └── test-generator/
│   ├── tester-agent/          # Multi-platform testing
│   │   ├── generators/        # Test generation
│   │   ├── runners/           # Test execution
│   │   ├── analyzers/         # Coverage, regression, flaky detection
│   │   ├── benchmarks/        # Performance benchmarking
│   │   └── reports/           # Report generation
│   ├── docker-agent/          # Docker lifecycle
│   │   ├── detectors/         # Change detection
│   │   ├── builders/          # Image building
│   │   ├── validators/        # Dockerfile validation
│   │   ├── optimizers/        # Size optimization
│   │   └── monitors/          # Health monitoring
│   ├── github-agent/          # GitHub automation
│   │   ├── branches/          # Branch/PR management
│   │   ├── reviews/           # Code review engine
│   │   ├── merges/            # Merge management
│   │   └── releases/          # Release management
│   ├── codebase-analyzer-agent/   # Deep codebase analysis
│   │   └── analyzers/         # Security, performance, debt
│   └── document-agent/        # Documentation sync
│       ├── parsers/           # Code↔Docs parsing
│       ├── digest-generators/ # Platform-specific digests
│       └── validators/        # Document validation
├── examples/                  # Usage examples
│   ├── basic-usage.js
│   └── example-agent.js
└── docs/                      # Documentation
    ├── api-reference.md
    ├── architecture.md
    ├── getting-started.md
    ├── creating-agents.md
    └── skills-guide.md
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=debug           # trace, debug, info, warn, error
NODE_ENV=development      # development, production

# Optional Redis for distributed deployments
REDIS_HOST=localhost
REDIS_PORT=6379
```

### initializeMinions Options

```javascript
await initializeMinions({
  enableMetrics: true,      // Enable MetricsCollector (default: true)
  enableHealth: true,       // Enable HealthMonitor (default: true)
  enableAlerting: true,     // Enable AlertingSystem (default: true)
  maxConcurrency: 5         // Max parallel agents (default: 5)
});
```

## Testing

```bash
# Run all tests with coverage
npm test

# Watch mode
npm run test:watch

# Run specific test file
cd foundation && NODE_OPTIONS=--experimental-vm-modules jest tests/eventBus.test.js

# Run tests matching pattern
cd foundation && NODE_OPTIONS=--experimental-vm-modules jest --testNamePattern="should publish"
```

**Coverage Threshold:** 85% for branches, functions, lines, and statements.

## Extension Points

### Custom Analyzers

```javascript
import { BaseAnalyzer, SEVERITY, CATEGORY } from 'minions';

class CustomAnalyzer extends BaseAnalyzer {
  constructor() {
    super('CustomAnalyzer');
  }

  async analyze(code, options = {}) {
    this.clearIssues();
    // Your analysis logic
    this.addIssue({
      type: 'custom-issue',
      severity: SEVERITY.MEDIUM,
      category: CATEGORY.QUALITY,
      message: 'Issue description',
      location: { file: 'path', line: 10 }
    });
    return this.formatResults();
  }
}
```

### Custom Skills

```javascript
import { BaseSkill, SEVERITY, CATEGORY } from 'minions';

class CustomSkill extends BaseSkill {
  constructor(options = {}) {
    super('CustomSkill', options);
  }

  async onInitialize() {
    // Custom initialization
  }

  async execute(input) {
    this.startRun();
    try {
      const result = await this.performTask(input);
      this.completeRun();
      return result;
    } catch (error) {
      this.failRun(error);
      throw error;
    }
  }
}
```

## API Reference

See [docs/api-reference.md](docs/api-reference.md) for complete API documentation.

## Documentation

- [API Reference](docs/api-reference.md) - Complete API documentation for all components
- [Architecture Guide](docs/architecture.md) - Deep dive into framework internals and data flows
- [Getting Started](docs/getting-started.md) - Step-by-step setup and first agent tutorial
- [Creating Agents](docs/creating-agents.md) - Agent development patterns and best practices
- [Skills Guide](docs/skills-guide.md) - Using and creating skills

## License

MIT
