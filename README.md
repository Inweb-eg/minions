<div align="center">

# Minions

### AI That Dreams

![Minions Banner](https://github.com/user-attachments/assets/e1be888e-b70a-4fcb-b4b7-4c57d84420a3)

**Event-Driven Multi-Agent Framework for Autonomous AI Development**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Author](https://img.shields.io/badge/Author-Kareem%20Hussein-blue)](https://github.com/kareemhussein)
[![Inweb](https://img.shields.io/badge/Company-Inweb%20Software%20Solutions-purple)](https://inwebsolutions.com)

[Getting Started](docs/getting-started.md) | [API Reference](docs/api-reference.md) | [Architecture](docs/architecture.md) | [Component Index](docs/component-index.md)

</div>

---

## What is Minions?

Minions is an enterprise-grade framework for orchestrating autonomous AI agents that work together to complete software development tasks. Built on an event-driven architecture with 80+ event types, it provides robust infrastructure for agent coordination, health monitoring, and automatic failure recovery.

**Key Capabilities:**
- **26 Specialized Agents** - Pre-built agents for testing, Docker, GitHub, security, databases, and more
- **Event-Driven Architecture** - Loose coupling via centralized pub/sub with 80+ event types
- **Dependency-Based Orchestration** - Topologically-sorted agent execution with parallel processing
- **Self-Learning System** - Reinforcement learning, pattern recognition, and skill generation
- **Autonomous Fix Loops** - Automatic test-fix-verify cycles with tiered recovery strategies
- **Git-Aware Checkpointing** - Safe rollback on failure with stash/unstash support

---

## Quick Start

### Docker (Recommended)

```bash
cd minions/docker
docker compose up -d
docker exec minions-ollama ollama pull deepseek-coder:6.7b
docker restart minions
# Access: http://localhost:2505
```

### Node.js

```bash
npm run install:all
node index.js --gru  # Start web interface
```

**Requirements:** Node.js >= 18.0.0, Ollama or Gemini API key

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         CLIENT INTERFACE                                │
│    Gru (Web UI)  →  Dr. Nefario (Planner)  →  Tom (Security)           │
│    Silas (Projects)  →  Lucy (Completion)                               │
├────────────────────────────────────────────────────────────────────────┤
│                         ORCHESTRATION                                   │
│    Orchestrator  →  DependencyGraph  →  AutonomousLoopManager          │
├────────────────────────────────────────────────────────────────────────┤
│                      SPECIALIZED AGENTS                                 │
│    Tester  │  Docker  │  GitHub  │  Database  │  Performance           │
│    Backend Writer  │  Frontend Writer  │  Flutter Writer               │
├────────────────────────────────────────────────────────────────────────┤
│                          SKILLS LAYER                                   │
│    AutoFixer  │  CodeReviewer  │  SecurityScanner  │  TestGenerator    │
├────────────────────────────────────────────────────────────────────────┤
│                      LEARNING & EVOLUTION                               │
│    KnowledgeBrain  │  ReinforcementLearner  │  DynamicSkillGenerator   │
│    CrossAgentTeacher  │  PatternRecognition                            │
├────────────────────────────────────────────────────────────────────────┤
│                     FOUNDATION SERVICES                                 │
│    EventBus  │  MemoryStore  │  StateMachine  │  CircuitBreaker        │
│    HealthMonitor  │  MetricsCollector  │  AlertingSystem  │  Rollback  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Directory

### Client Interface Agents

| Agent | Codename | Purpose |
|-------|----------|---------|
| **GruAgent** | Gru | Web interface coordinator with conversational AI (Ollama/Gemini) |
| **NefarioAgent** | Dr. Nefario | Converts requirements to execution plans |
| **ProjectManagerAgent** | Silas | External project connections and framework detection |
| **ProjectCompletionAgent** | Lucy | Autonomous completion loops with gap detection |
| **SecurityRiskAgent** | Tom | STRIDE threat modeling, vulnerability scanning, risk tracking |

### Specialized Agents

| Agent | Codename | Purpose |
|-------|----------|---------|
| **TesterAgent** | Bob | Multi-platform testing, coverage analysis, mutation testing |
| **DockerAgent** | Herb | Container lifecycle, Dockerfile validation, optimization |
| **GithubAgent** | Mel | Git operations, PR management, code review engine |
| **DatabaseAgent** | Dave | Schema design, migrations, query optimization |
| **PerformanceAgent** | Kevin | Profiling, benchmarking, bottleneck detection |
| **DocumentAgent** | Jerry | Bidirectional code-documentation sync |

### Code Writer Agents

| Agent | Codename | Skills |
|-------|----------|--------|
| **BackendWriterAgent** | Stuart | Routes, Models, Services, Middleware, Validators, Controllers |
| **FrontendWriterAgent** | Agnes | Components, Hooks, Stores, Forms, API clients, Pages |
| **FlutterWriterAgent** | Otto | Widgets, Models, Services, Blocs, Pages, Localization |

---

## Core Concepts

### Event-Driven Communication

All agents communicate through the centralized EventBus:

```javascript
import { getEventBus, EventTypes } from 'minions';

const eventBus = getEventBus();

// Publish events
eventBus.publish(EventTypes.CODE_GENERATED, {
  agent: 'backend-writer',
  files: ['src/api/users.js']
});

// Subscribe to events
const unsubscribe = eventBus.subscribe(
  EventTypes.TESTS_FAILED,
  'my-handler',
  (data) => console.log('Tests failed:', data.failures)
);
```

### Agent Registration & Orchestration

```javascript
import { initializeMinions, createAgent } from 'minions';

const { orchestrator, eventBus } = await initializeMinions();

// Create and register agents with dependencies
const fetchAgent = createAgent({
  name: 'fetch-agent',
  execute: async () => { /* fetch data */ }
});

orchestrator.registerAgent('fetch-agent', async () => fetchAgent, []);
orchestrator.registerAgent('process-agent', async () => processAgent, ['fetch-agent']);

// Execute in dependency order
const result = await orchestrator.execute();
```

### Autonomous Fix Loops

```javascript
import { getAutonomousLoopManager } from 'minions';

const loopManager = getAutonomousLoopManager();

// Register matcher to route failures to appropriate agents
loopManager.registerAgentMatcher((failure) => {
  if (failure.file?.includes('api/')) return 'backend-agent';
  if (failure.file?.includes('components/')) return 'frontend-agent';
  return null;
});

// Loop activates automatically on TESTS_FAILED events
```

---

## Foundation Services

### Singleton Pattern

All core services use singleton factories for consistent access:

```javascript
import {
  getEventBus,
  getOrchestrator,
  getHealthMonitor,
  getMetricsCollector,
  getAlertingSystem,
  getRollbackManager,
  getMemoryStore,
  getKnowledgeBrain,
  getReinforcementLearner
} from 'minions';
```

### Health Monitoring

```javascript
const healthMonitor = getHealthMonitor();

// Register custom health check
healthMonitor.registerHealthCheck('my-agent', async (metrics) => ({
  passed: metrics.errorRate < 5,
  message: 'Error rate check'
}));

// Get health summary
const summary = healthMonitor.getHealthSummary();
// { total_agents: 5, healthy: 3, degraded: 1, unhealthy: 1, average_score: 78.5 }
```

### Alerting System

```javascript
const alerting = getAlertingSystem();

// Register handlers
alerting.registerHandler('slack', async (alert) => {
  await slack.send({ text: `[${alert.severity}] ${alert.message}` });
});

// Configure thresholds
alerting.updateThresholds('P1_CRITICAL', {
  errorRate: 10,
  executionTime: 600000  // 10 minutes
});
```

### Persistence (MemoryStore)

```javascript
const memoryStore = getMemoryStore();

// Store with optional TTL
await memoryStore.set(MemoryNamespace.CONFIG, 'api-settings', {
  baseUrl: 'https://api.example.com'
}, { ttl: 3600000 });

// Retrieve
const config = await memoryStore.get(MemoryNamespace.CONFIG, 'api-settings');

// Knowledge base
await memoryStore.addKnowledge('BEST_PRACTICE', 'validation',
  'Always validate user input at API boundaries',
  { confidence: 0.95 }
);
```

---

## Learning & Evolution System

Minions includes a comprehensive self-learning system:

### Reinforcement Learning

```javascript
const learner = getReinforcementLearner();

// Q-learning with Thompson sampling
await learner.recordExperience({
  state: 'test_failure',
  action: 'apply_auto_fix',
  reward: 1.0,  // SUCCESS
  nextState: 'tests_passing'
});

// Get best action for state
const action = learner.selectAction('test_failure');
```

### Dynamic Skill Generation

```javascript
const skillGen = getDynamicSkillGenerator();

// Generate skill from detected patterns
const skill = await skillGen.generateSkill({
  pattern: 'null_check_fix',
  examples: patternExamples
});

// Skills are sandboxed and canary-deployed
```

### Knowledge Brain

```javascript
const brain = getKnowledgeBrain();

// Store and retrieve knowledge across agents
await brain.store({
  type: 'CODE_PATTERN',
  topic: 'error-handling',
  content: { pattern: 'try-catch-log', effectiveness: 0.92 }
});

// Query with similarity search
const knowledge = await brain.query({
  type: 'CODE_PATTERN',
  similarity: 'error handling in async functions'
});
```

### Cross-Agent Teaching

```javascript
const teacher = getCrossAgentTeacher();

// Share skills between agents
await teacher.teach({
  fromAgent: 'backend-agent',
  toAgent: 'frontend-agent',
  skill: 'validation-patterns',
  curriculum: curriculumDefinition
});
```

---

## Built-in Skills

### Analysis Skills

```javascript
import { getCodeReviewer, getSecurityScanner, getDependencyAnalyzer } from 'minions';

// Code review
const reviewer = getCodeReviewer();
const review = await reviewer.review('src/api.js');
// { qualityScore: 85, issues: [...], summary: '...' }

// Security scanning
const scanner = getSecurityScanner();
const results = await scanner.scan('/path/to/project');
// Detects: SQL injection, XSS, hardcoded secrets, weak auth, etc.

// Dependency analysis
const analyzer = getDependencyAnalyzer();
const deps = await analyzer.analyze('/path/to/project');
// { direct: [...], dev: [...], outdated: [...], vulnerabilities: [...] }
```

### Auto-Fixer

```javascript
const autoFixer = getAutoFixer({ projectRoot: '/path/to/project' });
await autoFixer.handleTestFailure({
  testOutput: rawOutput,
  failedTests: failures,
  platform: 'backend'
});
// Automatically fixes: null checks, missing imports, type mismatches, async issues
```

---

## Specialized Agents

### Tester Agent

```javascript
const tester = getTesterAgent();

const results = await tester.runTests({
  platform: 'backend',  // backend | react | flutter | e2e
  testPaths: ['tests/'],
  coverage: true,
  mutations: true  // Enable mutation testing
});

// Features: multi-platform, coverage analysis, regression detection,
// flaky test identification, performance benchmarking, mutation testing
```

### Docker Agent

```javascript
const docker = getDockerAgent();

await docker.validate('./Dockerfile');
await docker.build({ context: '.', tag: 'myapp:latest' });

// Features: change detection, Dockerfile validation, layer analysis,
// size optimization, vulnerability scanning, health monitoring
```

### Database Agent (Dave)

```javascript
const dbAgent = getDatabaseAgent();

await dbAgent.designSchema(requirements);
await dbAgent.createMigration({ type: 'add_column', table: 'users' });
await dbAgent.analyzeQuery(slowQuery);
const erd = await dbAgent.mapRelationships();
```

### Performance Agent (Kevin)

```javascript
const perfAgent = getPerformanceAgent();

await perfAgent.profile({ duration: 30000 });
await perfAgent.runBenchmarks();
await perfAgent.analyzeMemory();
const bottlenecks = await perfAgent.detectBottlenecks();
```

---

## Web Interface (Gru)

Start the web interface for conversational project planning:

```bash
# Docker
cd docker && docker compose up -d
# Access: http://localhost:2505

# Node.js
node index.js --gru --port 2505
```

### Features

- **Conversational AI** - Chat with Gru about your project (Ollama or Gemini)
- **Project Scanning** - Automatic framework and dependency detection
- **Plan Generation** - Dr. Nefario creates detailed execution plans
- **Real-time Monitoring** - Watch execution progress with live updates
- **Learning Dashboard** - Monitor RL policies, skills, and A/B tests at `/evolve`

### Environment Variables

```bash
OLLAMA_HOST=http://localhost:11434  # Ollama server URL
OLLAMA_MODEL=deepseek-coder:6.7b    # AI model
GEMINI_API_KEY=your-key             # Gemini fallback
MINIONS_PORT=2505                   # Web server port
```

---

## Event Types Reference

```javascript
// Agent Lifecycle
AgentEvents.AGENT_STARTED, AGENT_COMPLETED, AGENT_FAILED, AGENT_PAUSED, AGENT_RESUMED

// Testing
TestEvents.TESTS_STARTED, TESTS_COMPLETED, TESTS_FAILED

// Code Operations
CodeEvents.CODE_GENERATED, CODE_REVIEWED, AUTO_FIX_REQUESTED, FIX_COMPLETED

// Security (Tom)
SecurityEvents.SCAN_COMPLETED, VULNERABILITY_FOUND, RISK_IDENTIFIED, THREAT_ADDED

// Project Management (Silas)
ProjectManagerEvents.PROJECT_CONNECTED, PROJECT_SCANNED, PROJECT_ERROR

// Completion (Lucy)
CompletionEvents.GAP_DETECTED, GAP_RESOLVED, PROGRESS_UPDATED, COMPLETION_FINISHED

// Database (Dave)
DatabaseEvents.SCHEMA_DESIGNED, MIGRATION_CREATED, QUERY_OPTIMIZED

// Performance (Kevin)
PerformanceEvents.HOTSPOT_DETECTED, REGRESSION_DETECTED, BOTTLENECK_DETECTED

// Learning
LearningEvents.PATTERN_DETECTED, SKILL_GENERATED, POLICY_UPDATED
```

See [docs/component-index.md](docs/component-index.md) for the complete list of 80+ event types.

---

## Testing

```bash
# Run all tests with coverage (85% threshold)
npm test

# Watch mode
npm run test:watch

# Single test file
cd foundation && NODE_OPTIONS=--experimental-vm-modules jest tests/eventBus.test.js

# Pattern matching
cd foundation && NODE_OPTIONS=--experimental-vm-modules jest --testNamePattern="should publish"
```

---

## Project Structure

```
minions/
├── index.js                    # Main entry point
├── foundation/                 # Core infrastructure
│   ├── event-bus/              # AgentEventBus, EventTypes (80+ events)
│   ├── health-monitor/         # HealthMonitor, HealthStatus
│   ├── metrics-collector/      # MetricsCollector
│   ├── alerting/               # AlertingSystem
│   ├── rollback-manager/       # RollbackManager (git-aware)
│   ├── memory-store/           # MemoryStore, DecisionLogger
│   ├── state-machine/          # StateMachine
│   ├── resilience/             # CircuitBreaker, RateLimiter
│   ├── learning/               # ReinforcementLearner, DynamicSkillGenerator
│   ├── knowledge-brain/        # KnowledgeBrain, CrossAgentTeacher
│   └── tests/                  # Unit tests (Jest)
├── agents/
│   ├── manager-agent/          # Orchestrator, DependencyGraph, AutonomousLoop
│   ├── gru-agent/              # Web interface (Express + WebSocket)
│   ├── nefario-agent/          # Plan generation
│   ├── project-manager-agent/  # Silas - project registry
│   ├── project-completion-agent/ # Lucy - completion loops
│   ├── security-risk-agent/    # Tom - security & risk
│   ├── tester-agent/           # Multi-platform testing
│   ├── docker-agent/           # Docker lifecycle
│   ├── github-agent/           # GitHub automation
│   ├── database-agent/         # Dave - schema & migrations
│   ├── performance-agent/      # Kevin - profiling
│   ├── backend-writer-agent/   # Stuart - backend code gen
│   ├── frontend-writer-agent/  # Agnes - frontend code gen
│   ├── flutter-writer-agent/   # Otto - Flutter code gen
│   └── skills/                 # AutoFixer, CodeReviewer, etc.
├── docker/                     # Docker configuration
│   ├── Dockerfile              # Multi-stage build
│   └── docker-compose.yml      # Ollama + Minions setup
└── docs/                       # Documentation
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/getting-started.md) | Installation, setup, and first agent tutorial |
| [Architecture Guide](docs/architecture.md) | Deep dive into framework internals and data flows |
| [API Reference](docs/api-reference.md) | Complete API documentation for all components |
| [Component Index](docs/component-index.md) | Quick reference for all components and events |
| [Creating Agents](docs/creating-agents.md) | Agent development patterns and best practices |
| [Skills Guide](docs/skills-guide.md) | Using and creating skills |
| [Gru Guide](docs/gru-guide.md) | Web interface setup with Docker and Ollama |

---

## License

MIT

---

<div align="center">

**Minions Framework**

Created by **Kareem Hussein** | **Inweb Software Solutions**

*Building the future of autonomous AI development*

</div>
