# Architecture Guide

Deep dive into the Minions framework architecture.

## Table of Contents

- [Design Principles](#design-principles)
- [Component Architecture](#component-architecture)
- [Data Flow](#data-flow)
- [Algorithms](#algorithms)
- [Error Handling](#error-handling)
- [Extension Points](#extension-points)
- [Performance Characteristics](#performance-characteristics)

---

## Design Principles

### 1. Event-Driven Architecture

All agents communicate through a centralized EventBus using standardized event types. This enables:

- **Loose Coupling**: Agents don't need direct references to each other
- **Scalability**: New agents can subscribe to existing events
- **Auditability**: All events are logged with history retention
- **Error Isolation**: Subscriber errors don't affect other subscribers

### 2. Singleton Pattern

Core services are singletons accessed via getter functions:

```javascript
const eventBus = getEventBus();
const orchestrator = getOrchestrator();
const metricsCollector = getMetricsCollector();
```

This ensures:
- Single source of truth for state
- Consistent access across the application
- Lazy initialization when needed

### 3. Layered Architecture

```
┌─────────────────────────────────────────────┐
│         Application Layer (Agents)           │
├─────────────────────────────────────────────┤
│         Orchestration & Management           │
│  (Orchestrator, AutonomousLoopManager, etc.) │
├─────────────────────────────────────────────┤
│         Skills & Analyzers                   │
│  (AutoFixer, CodeReviewer, SecurityScanner)  │
├─────────────────────────────────────────────┤
│         Foundation (Observability & Control) │
│  (EventBus, Metrics, Health, Alerting)      │
└─────────────────────────────────────────────┘
```

Each layer only depends on layers below it.

---

## Component Architecture

### Foundation Layer

#### EventBus (AgentEventBus.js)

```
┌─────────────────────────────────────────┐
│              AgentEventBus               │
├─────────────────────────────────────────┤
│ - emitter: EventEmitter3                │
│ - history: Event[] (max 1000)           │
│ - subscribers: Map<eventType, Set>      │
├─────────────────────────────────────────┤
│ + publish(type, data)                   │
│ + subscribe(type, name, handler)        │
│ + subscribeToAll(name, handler)         │
│ + getHistory(filter)                    │
│ + getSubscribers(type)                  │
└─────────────────────────────────────────┘
```

**Event Structure:**
```javascript
{
  type: string,           // EVENT_TYPE constant
  data: {
    agent: string,        // Publishing agent name
    ...customData
  },
  timestamp: number,      // Date.now()
  id: string             // Unique UUID
}
```

#### MetricsCollector

```
┌─────────────────────────────────────────┐
│           MetricsCollector               │
├─────────────────────────────────────────┤
│ - agentMetrics: Map<name, Metrics>      │
│ - history: Snapshot[] (max 2880)        │
│ - collectionInterval: 30s               │
├─────────────────────────────────────────┤
│ + start() / stop()                      │
│ + registerAgent(name)                   │
│ + recordExecution(name, success, dur)   │
│ + getAgentMetrics(name)                 │
│ + calculateSystemHealth()               │
└─────────────────────────────────────────┘
```

**Agent Metrics Structure:**
```javascript
{
  name: string,
  status: 'idle' | 'running' | 'completed' | 'failed',
  executions: {
    total: number,
    successful: number,
    failed: number,
    success_rate: number  // 0-100
  },
  performance: {
    avg_execution_time_ms: number,
    min_execution_time_ms: number,
    max_execution_time_ms: number,
    p95_execution_time_ms: number
  },
  errors: {
    total: number,
    rate: number,         // 0-100
    last_error: string,
    last_error_time: timestamp
  },
  health: {
    score: number,        // 0-100
    last_check: timestamp,
    issues: string[]
  }
}
```

#### HealthMonitor

```
┌─────────────────────────────────────────┐
│            HealthMonitor                 │
├─────────────────────────────────────────┤
│ - agentHealth: Map<name, HealthInfo>    │
│ - customChecks: Map<name, CheckFn>      │
│ - checkInterval: 60s                    │
├─────────────────────────────────────────┤
│ + start() / stop()                      │
│ + registerHealthCheck(name, fn)         │
│ + performHealthChecks()                 │
│ + getAgentHealth(name)                  │
│ + getHealthSummary()                    │
└─────────────────────────────────────────┘
```

**Health Check Criteria:**
1. Error Rate (< 5% = pass, >= 10% = unhealthy)
2. Success Rate (>= 90% = pass)
3. Execution Time (< 5 minutes = pass)
4. Recent Errors (no errors in last 10 min = pass)
5. Custom Health Checks (if registered)
6. Memory Usage (< 500MB = pass)
7. Event Bus Activity (pass if active)

**Score Calculation:**
```
score = (passed_checks / total_checks) * 100
```

#### AlertingSystem

```
┌─────────────────────────────────────────┐
│           AlertingSystem                 │
├─────────────────────────────────────────┤
│ - alerts: Map<id, Alert>                │
│ - handlers: Map<name, HandlerFn>        │
│ - thresholds: Map<severity, Thresholds> │
├─────────────────────────────────────────┤
│ + createAlert(data)                     │
│ + registerHandler(name, fn)             │
│ + acknowledgeAlert(id)                  │
│ + resolveAlert(id, resolution)          │
│ + updateThresholds(severity, values)    │
└─────────────────────────────────────────┘
```

**Alert Structure:**
```javascript
{
  id: string,
  severity: 'P1_CRITICAL' | 'P2_HIGH' | 'P3_MEDIUM',
  title: string,
  message: string,
  source: string,          // agent name
  timestamp: number,
  status: 'active' | 'resolved',
  acknowledged: boolean,
  metadata: object
}
```

#### RollbackManager

```
┌─────────────────────────────────────────┐
│           RollbackManager                │
├─────────────────────────────────────────┤
│ - checkpoints: Map<id, Checkpoint>      │
│ - checkpointsDir: string                │
├─────────────────────────────────────────┤
│ + createCheckpoint(operation, metadata) │
│ + commitCheckpoint(id)                  │
│ + rollback(id, reason)                  │
│ + rollbackGit(gitState)                 │
│ + cleanup(maxAge)                       │
└─────────────────────────────────────────┘
```

**Checkpoint Structure:**
```javascript
{
  id: string,
  operation: string,
  timestamp: number,
  metadata: object,
  git: {
    branch: string,
    commit: string,
    hasUncommittedChanges: boolean,
    stashRef: string
  },
  files: string[],
  status: 'active' | 'committed' | 'rolled_back'
}
```

### Manager Agent Layer

#### Orchestrator

```
┌─────────────────────────────────────────┐
│            Orchestrator                  │
├─────────────────────────────────────────┤
│ - agentRegistry: Map<name, LoaderFn>    │
│ - loadedAgents: Map<name, Agent>        │
│ - executionResults: Map<name, Result>   │
│ - maxConcurrency: number (default 5)    │
│ - isExecuting: boolean                  │
├─────────────────────────────────────────┤
│ + registerAgent(name, loader, deps)     │
│ + buildExecutionPlan(changedFiles)      │
│ + execute(changedFiles)                 │
│ + executeParallelGroup(agents)          │
│ + getStatus()                           │
│ + stop()                                │
└─────────────────────────────────────────┘
```

#### DependencyGraph

```
┌─────────────────────────────────────────┐
│          DependencyGraph                 │
├─────────────────────────────────────────┤
│ - nodes: Map<name, Node>                │
│   Node = {                              │
│     name, dependencies, dependents,     │
│     level                               │
│   }                                     │
│ - filePatterns: Map<agent, RegExp[]>    │
├─────────────────────────────────────────┤
│ + addAgent(name, dependencies)          │
│ + buildExecutionOrder()                 │
│ + getParallelGroups()                   │
│ + hasCircularDependencies()             │
│ + getAffectedAgents(changedFiles)       │
└─────────────────────────────────────────┘
```

#### AutonomousLoopManager

```
┌─────────────────────────────────────────┐
│      AutonomousLoopManager               │
├─────────────────────────────────────────┤
│ - currentLoop: LoopState                │
│ - agentMatchers: MatcherFn[]            │
│ - registeredAgents: Map<name, Agent>    │
│ - maxIterations: number (default 5)     │
├─────────────────────────────────────────┤
│ + handleTestsFailed(data)               │
│ + registerAgentMatcher(fn)              │
│ + registerAgent(name, instance)         │
│ + groupFailuresByAgent(failures)        │
│ + triggerAgentFixes(strategy)           │
│ + triggerTestRerun()                    │
└─────────────────────────────────────────┘
```

**Tiered Fix Strategy:**
```
Failure Detected
    ↓
Tier 1: AutoFixer (pattern-based, fast)
    ↓ (if partial or remaining failures)
Tier 2: Platform Agents (domain-specific)
    ↓
Re-run Tests
    ↓
Success? → Complete
    ↓
Remaining? → Iterate (up to maxIterations)
```

#### AgentPool

```
┌─────────────────────────────────────────┐
│            AgentPool                     │
├─────────────────────────────────────────┤
│ - agents: Map<name, AgentState>         │
│ - executionHistory: Execution[]         │
│ - rateLimitWindow: 60s                  │
│ - rateLimitMax: 10                      │
├─────────────────────────────────────────┤
│ + registerAgent(name, config)           │
│ + executeAgent(name, fn, context)       │
│ + canExecute(name)                      │
│ + isInCooldown(name)                    │
│ + isRateLimited(name)                   │
│ + hasCircularUpdate(name)               │
└─────────────────────────────────────────┘
```

**Agent State:**
```javascript
{
  name: string,
  status: 'idle' | 'running' | 'failed' | 'cooldown',
  lastExecutionTime: timestamp,
  lastExecutionDuration: number,
  totalExecutions: number,
  successfulExecutions: number,
  failedExecutions: number,
  retryCount: number,
  config: {
    timeout: 300000,      // 5 minutes
    maxRetries: 3,
    cooldown: 10000       // 10 seconds
  }
}
```

---

## Data Flow

### Test Failure Auto-Fix Flow

```
1. External Test Runner
   ↓ Publishes TESTS_FAILED event
   └─→ EventBus

2. AutonomousLoopManager (subscribed)
   ↓ Receives event
   ↓ Creates checkpoint
   ↓ Launches AutoFixer (Tier 1)

3. AutoFixer
   ├─→ TestFailureAnalyzer
   │   └─→ Parse output → failures[]
   ├─→ FixGenerator
   │   ├─→ Match patterns
   │   ├─→ Generate fixes
   │   └─→ Return fix[]
   └─→ FixApplier
       ├─→ Create backups
       ├─→ Apply changes
       └─→ Return result

4. AutonomousLoopManager
   ├─→ Evaluate results
   ├─→ If not fixed:
   │   ├─→ Checkpoint (Tier 2)
   │   ├─→ Dispatch to platform agents
   │   └─→ Trigger test re-run
   └─→ Complete loop

5. EventBus
   └─→ Publish events
       ├─→ FIX_COMPLETED
       ├─→ AUTO_FIX_FAILED
       └─→ TESTS_STARTED
```

### Multi-Agent Orchestration Flow

```
1. ChangeDetector (if monitoring)
   ├─→ Detect git changes
   ├─→ Analyze impact
   └─→ Publish CHANGE_DETECTED

2. Orchestrator
   ├─→ Build execution plan
   │   └─→ DependencyGraph.buildExecutionOrder()
   │   └─→ DependencyGraph.getParallelGroups()
   │
   ├─→ Create checkpoint
   │
   ├─→ For each level:
   │   ├─→ executeParallelGroup(agents)
   │   │   ├─→ Start up to maxConcurrency
   │   │   ├─→ Load agent via loader
   │   │   ├─→ Call agent.execute()
   │   │   ├─→ Record metrics
   │   │   └─→ Publish events
   │   │
   │   └─→ Check failures → rollback if any
   │
   └─→ Commit checkpoint

3. Each Agent
   ├─→ Performs work
   └─→ Publishes events
```

### Health Monitoring Flow

```
1. MetricsCollector (30-sec interval)
   ├─→ Collect agent metrics
   └─→ Publish METRICS_COLLECTED

2. AlertingSystem (subscribed)
   └─→ Check thresholds
       └─→ Create alerts if exceeded

3. HealthMonitor (60-sec interval)
   ├─→ Get metrics
   ├─→ For each agent:
   │   ├─→ Calculate health score
   │   ├─→ Run custom checks
   │   └─→ Determine status
   └─→ Publish AGENT_HEALTH_CHECK

4. AlertingSystem
   ├─→ Check unhealthy agents
   ├─→ Create P1 alerts
   └─→ Execute handlers (email, Slack)
```

---

## Algorithms

### Topological Sort (Dependency Resolution)

Used by Orchestrator and DependencyGraph.

```javascript
function buildExecutionOrder(nodes) {
  const visited = new Set();
  const visiting = new Set();  // Cycle detection
  const order = [];

  function visit(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      throw new Error('Circular dependency');
    }

    visiting.add(node);
    for (let dep of node.dependencies) {
      visit(dep);
    }
    visiting.delete(node);
    visited.add(node);
    order.push(node);
  }

  for (let node of nodes) {
    visit(node);
  }

  return order;
}
```

**Complexity:** O(V + E) where V = agents, E = dependencies

### Parallel Execution with Concurrency Control

```javascript
async function executeParallelGroup(agents, maxConcurrency) {
  const queue = [...agents];
  const executing = new Map();

  while (queue.length > 0 || executing.size > 0) {
    // Start agents up to limit
    while (executing.size < maxConcurrency && queue.length > 0) {
      const agent = queue.shift();
      const entry = { settled: false };

      entry.promise = executeAgent(agent)
        .then(result => { entry.settled = true; return result; })
        .catch(error => { entry.settled = true; throw error; });

      executing.set(agent, entry);
    }

    // Wait for one to complete
    if (executing.size > 0) {
      const promises = Array.from(executing.values())
        .map(e => e.promise.catch(() => {}));
      await Promise.race(promises);

      // Remove settled
      for (const [name, entry] of executing) {
        if (entry.settled) executing.delete(name);
      }
    }
  }
}
```

### Exponential Backoff for Retries

```javascript
const baseDelay = 1000;   // 1 second
const maxDelay = 10000;   // 10 seconds

async function executeWithRetry(fn, maxRetries) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt),
          maxDelay
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

**Delays:** 1s → 2s → 4s → 8s → 10s (capped)

### Cyclomatic Complexity Calculation

```javascript
function calculateComplexity(ast) {
  let complexity = 1;  // Base

  traverse(ast, {
    IfStatement: () => complexity++,
    ConditionalExpression: () => complexity++,  // Ternary
    ForStatement: () => complexity++,
    WhileStatement: () => complexity++,
    DoWhileStatement: () => complexity++,
    SwitchCase: () => complexity++,
    CatchClause: () => complexity++,
    LogicalExpression: (path) => {
      if (path.node.operator === '&&' ||
          path.node.operator === '||') {
        complexity++;
      }
    }
  });

  return complexity;
}
```

---

## Error Handling

### Multi-Level Strategy

```
1. Try-Catch at Operation Level
   - AgentPool: wraps executeAgent
   - Orchestrator: wraps executeAgent
   - Skills: try-catch in execute

2. Event-Based Notification
   - Publish ERROR_OCCURRED event
   - Contains error details, stack, agent

3. Health Monitoring
   - HealthMonitor detects high error rates
   - Triggers alerts via AlertingSystem

4. Automatic Recovery
   - AgentPool: retry with backoff
   - Orchestrator: rollback on failure
   - AutonomousLoopManager: iterate up to max
```

### Checkpoint & Rollback Workflow

```javascript
try {
  // Create checkpoint (captures git state)
  const checkpointId = await rollbackManager.createCheckpoint('operation');

  // Perform risky operation
  await riskyOperation();

  // Mark successful
  await rollbackManager.commitCheckpoint(checkpointId);

} catch (error) {
  // Rollback to checkpoint state
  await rollbackManager.rollback(checkpointId, error.message);
  throw error;
}
```

### Error Classification

**Retryable Errors:**
- Transient network failures
- Timeout (with limit)
- Temporary resource unavailability

**Non-Retryable Errors:**
- Syntax errors
- Missing files
- Permission denied
- Authentication failure

---

## Extension Points

### Custom Agents

```javascript
class CustomAgent {
  constructor() {
    this.name = 'custom-agent';
    this.eventBus = getEventBus();
  }

  async execute() {
    this.eventBus.publish(EventTypes.AGENT_STARTED, {
      agent: this.name
    });

    try {
      await this.doWork();

      this.eventBus.publish(EventTypes.AGENT_COMPLETED, {
        agent: this.name,
        execution_time_ms: duration
      });
    } catch (error) {
      this.eventBus.publish(EventTypes.AGENT_FAILED, {
        agent: this.name,
        error: error.message
      });
      throw error;
    }
  }
}
```

### Custom Analyzers

```javascript
class CustomAnalyzer extends BaseAnalyzer {
  constructor() {
    super('CustomAnalyzer');
  }

  async analyze(code, options = {}) {
    this.clearIssues();
    // Custom analysis
    return this.formatResults();
  }
}
```

### Custom Skills

```javascript
class CustomSkill extends BaseSkill {
  constructor(options = {}) {
    super('CustomSkill', options);
  }

  async onInitialize() {
    // Custom init
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

### Custom Alert Handlers

```javascript
alertingSystem.registerHandler('pagerduty', async (alert) => {
  await pagerduty.createIncident({
    title: alert.title,
    description: alert.message,
    urgency: alert.severity === 'P1_CRITICAL' ? 'high' : 'low'
  });
});
```

### Custom Health Checks

```javascript
healthMonitor.registerHealthCheck('database-agent', async (metrics) => ({
  passed: await checkDatabaseConnection(),
  message: 'Database connectivity check'
}));
```

---

## Performance Characteristics

### Execution Timeline

| Component | Duration | Frequency |
|-----------|----------|-----------|
| Agent execution | 50ms - 5min | Per agent |
| Metric collection | ~100ms | Every 30s |
| Health check | ~200ms | Every 60s |
| Event publish | 1-5ms | Per event |
| Orchestration setup | 10-100ms | Per execution |

### Memory Usage

| Component | Memory |
|-----------|--------|
| EventBus (1000 events) | 2-5 MB |
| MetricsCollector (2880 snapshots) | 10-20 MB |
| HealthMonitor | <1 MB |
| AgentPool (per agent) | 1-5 MB |
| Orchestrator | <1 MB |
| **Typical total** | **15-35 MB** |

### Scalability Limits

| Resource | Recommended Max |
|----------|-----------------|
| Registered agents | ~100 |
| Concurrent agents | 10-20 |
| Event history | 1000 events |
| Metrics history | 2880 snapshots |
| Event throughput | ~1000/min |

### Bottlenecks

1. **File I/O** - FixApplier applying changes
2. **Test execution** - External process
3. **AST parsing** - Large files
4. **Memory** - Large history retention
