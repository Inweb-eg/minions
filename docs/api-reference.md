# API Reference

Complete API documentation for the Minions framework.

## Table of Contents

- [Core Functions](#core-functions)
- [EventBus](#eventbus)
- [Orchestrator](#orchestrator)
- [HealthMonitor](#healthmonitor)
- [MetricsCollector](#metricscollector)
- [AlertingSystem](#alertingsystem)
- [RollbackManager](#rollbackmanager)
- [AutonomousLoopManager](#autonomousloopmanager)
- [AgentPool](#agentpool)
- [DependencyGraph](#dependencygraph)
- [ChangeDetector](#changedetector)
- [Specialized Agents](#specialized-agents)
  - [TesterAgent](#testeragent)
  - [DockerAgent](#dockeragent)
  - [GithubAgent](#githubagent)
  - [CodebaseAnalyzer](#codebaseanalyzer)
  - [DocumentAgent](#documentagent)
- [Code Writer Agents](#code-writer-agents)
  - [FlutterWriterAgent](#flutterwriteragent)
  - [BackendWriterAgent](#backendwriteragent)
  - [FrontendWriterAgent](#frontendwriteragent)
- [Skills](#skills)
- [Analyzers](#analyzers)
- [ASTParser](#astparser)

---

## Core Functions

### initializeMinions(options)

Initialize the Minions framework with all components.

```javascript
import { initializeMinions } from 'minions';

const components = await initializeMinions({
  enableMetrics: true,      // Enable MetricsCollector (default: true)
  enableHealth: true,       // Enable HealthMonitor (default: true)
  enableAlerting: true,     // Enable AlertingSystem (default: true)
  maxConcurrency: 5         // Max parallel agents (default: 5)
});
```

**Returns:**
```javascript
{
  eventBus: AgentEventBus,
  orchestrator: Orchestrator,
  metricsCollector: MetricsCollector | null,
  healthMonitor: HealthMonitor | null,
  alertingSystem: AlertingSystem | null,
  rollbackManager: RollbackManager,
  autonomousLoopManager: AutonomousLoopManager
}
```

### createAgent(config)

Create a simple agent instance.

```javascript
import { createAgent } from 'minions';

const agent = createAgent({
  name: 'my-agent',           // Required: unique agent name
  execute: async () => {},    // Required: main execution function
  onEvent: (type, data) => {} // Optional: event handler
});
```

**Returns:** Agent object with `execute()`, `run()`, and `analyze()` methods.

---

## EventBus

Central pub/sub system for agent communication.

### getEventBus()

Get the singleton EventBus instance.

```javascript
import { getEventBus } from 'minions';
const eventBus = getEventBus();
```

### eventBus.publish(eventType, data)

Publish an event to all subscribers.

```javascript
eventBus.publish(EventTypes.CODE_GENERATED, {
  agent: 'my-agent',
  files: ['src/index.js'],
  timestamp: Date.now()
});
```

**Parameters:**
- `eventType` (string): Event type from EventTypes
- `data` (object): Event payload (should include `agent` field)

### eventBus.subscribe(eventType, subscriberName, handler)

Subscribe to events of a specific type.

```javascript
const unsubscribe = eventBus.subscribe(
  EventTypes.TESTS_FAILED,
  'my-subscriber',
  (data, event) => {
    console.log('Test failed:', data);
  }
);

// Later: unsubscribe
unsubscribe();
```

**Parameters:**
- `eventType` (string): Event type to listen for
- `subscriberName` (string): Unique subscriber identifier
- `handler` (function): `(data, fullEvent) => void`

**Returns:** Unsubscribe function.

### eventBus.subscribeToAll(subscriberName, handler)

Subscribe to all events (wildcard).

```javascript
eventBus.subscribeToAll('monitor', (data) => {
  console.log(`Event: ${data.type}`);
});
```

### eventBus.getHistory(filter)

Retrieve event history.

```javascript
const events = eventBus.getHistory({
  eventType: EventTypes.AGENT_COMPLETED,  // Optional: filter by type
  since: Date.now() - 3600000,            // Optional: events after timestamp
  limit: 100                               // Optional: max events to return
});
```

**Returns:** Array of event objects.

### eventBus.getSubscribers(eventType)

Get list of subscribers for an event type.

```javascript
const subscribers = eventBus.getSubscribers(EventTypes.TESTS_FAILED);
// ['autonomous-loop-manager', 'alerting-system']
```

### eventBus.clearHistory()

Clear all event history.

---

## Orchestrator

Coordinates multi-agent execution with dependency resolution.

### getOrchestrator()

Get the singleton Orchestrator instance.

```javascript
import { getOrchestrator } from 'minions';
const orchestrator = getOrchestrator();
```

### orchestrator.initialize()

Initialize the orchestrator (called automatically by `initializeMinions`).

```javascript
await orchestrator.initialize();
```

### orchestrator.registerAgent(name, loaderFn, dependencies)

Register an agent for orchestration.

```javascript
orchestrator.registerAgent(
  'data-processor',                    // Agent name
  async () => new DataProcessor(),     // Loader function
  ['data-fetcher', 'config-loader']    // Dependencies (optional)
);
```

**Parameters:**
- `name` (string): Unique agent identifier
- `loaderFn` (function): Async function that returns agent instance
- `dependencies` (string[]): Array of agent names this depends on

### orchestrator.unregisterAgent(name)

Remove an agent from the registry.

```javascript
orchestrator.unregisterAgent('old-agent');
```

### orchestrator.getRegisteredAgents()

Get list of all registered agent names.

```javascript
const agents = orchestrator.getRegisteredAgents();
// ['data-fetcher', 'data-processor', 'reporter']
```

### orchestrator.execute(changedFiles)

Execute all registered agents in dependency order.

```javascript
const result = await orchestrator.execute(['src/api/users.js']);
```

**Parameters:**
- `changedFiles` (string[]): Optional list of changed files to determine affected agents

**Returns:**
```javascript
{
  success: boolean,
  duration: number,           // Total execution time in ms
  results: {
    [agentName]: {
      success: boolean,
      duration: number,
      error?: string,
      agentLoaded: boolean
    }
  },
  agentsExecuted: number
}
```

### orchestrator.buildExecutionPlan(changedFiles)

Build execution plan without executing.

```javascript
const plan = orchestrator.buildExecutionPlan(['src/api/users.js']);
// {
//   groups: [
//     { level: 1, agents: ['data-fetcher'] },
//     { level: 2, agents: ['data-processor'] }
//   ],
//   totalAgents: 2,
//   affectedFiles: ['src/api/users.js']
// }
```

### orchestrator.getStatus()

Get current execution status.

```javascript
const status = orchestrator.getStatus();
// {
//   isExecuting: boolean,
//   currentlyRunning: string[],
//   completedAgents: number,
//   registeredAgents: string[],
//   results: {...}
// }
```

### orchestrator.stop()

Emergency stop of current execution.

```javascript
await orchestrator.stop();
```

---

## HealthMonitor

Tracks agent health and system status.

### getHealthMonitor()

```javascript
import { getHealthMonitor } from 'minions';
const healthMonitor = getHealthMonitor();
```

### HealthStatus

```javascript
import { HealthStatus } from 'minions';

HealthStatus.HEALTHY    // Score >= 80, no issues
HealthStatus.DEGRADED   // Score >= 60 or issues present
HealthStatus.UNHEALTHY  // Score < 60, multiple issues
HealthStatus.UNKNOWN    // No metrics available
```

### healthMonitor.initialize(metricsCollector)

Initialize with metrics collector.

```javascript
await healthMonitor.initialize(metricsCollector);
```

### healthMonitor.start()

Start periodic health checks (60-second interval).

```javascript
healthMonitor.start();
```

### healthMonitor.stop()

Stop health monitoring.

```javascript
healthMonitor.stop();
```

### healthMonitor.registerHealthCheck(agentName, checkFn)

Register a custom health check for an agent.

```javascript
healthMonitor.registerHealthCheck('my-agent', async (metrics) => ({
  passed: metrics.customMetric > threshold,
  message: 'Custom check description'
}));
```

### healthMonitor.performHealthChecks()

Manually trigger health checks.

```javascript
await healthMonitor.performHealthChecks();
```

### healthMonitor.getAgentHealth(agentName)

Get health status for a specific agent.

```javascript
const health = healthMonitor.getAgentHealth('my-agent');
// {
//   status: 'healthy',
//   score: 95,
//   issues: [],
//   lastCheck: timestamp
// }
```

### healthMonitor.getAllAgentHealth()

Get health for all agents.

```javascript
const allHealth = healthMonitor.getAllAgentHealth();
// { 'agent-a': {...}, 'agent-b': {...} }
```

### healthMonitor.getUnhealthyAgents()

Get list of unhealthy agents.

```javascript
const unhealthy = healthMonitor.getUnhealthyAgents();
// [{ name: 'problematic-agent', health: {...} }]
```

### healthMonitor.getHealthSummary()

Get system-wide health summary.

```javascript
const summary = healthMonitor.getHealthSummary();
// {
//   total_agents: 5,
//   healthy: 3,
//   degraded: 1,
//   unhealthy: 1,
//   unknown: 0,
//   average_score: 78.5
// }
```

---

## MetricsCollector

Collects and aggregates performance metrics.

### getMetricsCollector()

```javascript
import { getMetricsCollector } from 'minions';
const metrics = getMetricsCollector();
```

### metricsCollector.start()

Start metric collection (30-second interval).

```javascript
metricsCollector.start();
```

### metricsCollector.stop()

Stop metric collection.

```javascript
metricsCollector.stop();
```

### metricsCollector.registerAgent(agentName)

Register an agent for metrics tracking.

```javascript
metricsCollector.registerAgent('my-agent');
```

### metricsCollector.recordExecution(agentName, success, duration, error)

Record an agent execution.

```javascript
metricsCollector.recordExecution('my-agent', true, 1500);
metricsCollector.recordExecution('my-agent', false, 500, new Error('Failed'));
```

### metricsCollector.updateAgentMetrics(agentName, updates)

Update specific metrics for an agent.

```javascript
metricsCollector.updateAgentMetrics('my-agent', {
  status: 'running',
  health: { score: 95 }
});
```

### metricsCollector.getAgentMetrics(agentName)

Get metrics for a specific agent.

```javascript
const agentMetrics = metricsCollector.getAgentMetrics('my-agent');
// {
//   name: 'my-agent',
//   status: 'idle',
//   executions: {
//     total: 10,
//     successful: 9,
//     failed: 1,
//     success_rate: 90
//   },
//   performance: {
//     avg_execution_time_ms: 1200,
//     min_execution_time_ms: 800,
//     max_execution_time_ms: 2500,
//     p95_execution_time_ms: 2200
//   },
//   errors: {
//     total: 1,
//     rate: 10,
//     last_error: 'Error message',
//     last_error_time: timestamp
//   },
//   health: {
//     score: 85,
//     last_check: timestamp,
//     issues: []
//   }
// }
```

### metricsCollector.getAllMetrics()

Get metrics for all agents.

```javascript
const all = metricsCollector.getAllMetrics();
```

### metricsCollector.getSystemMetrics()

Get system-wide metrics.

```javascript
const system = metricsCollector.getSystemMetrics();
// {
//   uptime_seconds: 3600,
//   memory_usage_mb: 150,
//   total_events: 500,
//   events_per_minute: 8.3,
//   active_agents: 5,
//   system_health_score: 85
// }
```

### metricsCollector.getHistory(options)

Get historical metrics snapshots.

```javascript
const history = metricsCollector.getHistory({
  since: Date.now() - 3600000,  // Last hour
  until: Date.now(),
  limit: 100
});
```

---

## AlertingSystem

Triggers alerts on threshold violations.

### getAlertingSystem()

```javascript
import { getAlertingSystem } from 'minions';
const alerting = getAlertingSystem();
```

### Alert Severity Levels

```javascript
const SEVERITY = {
  P1_CRITICAL: 'P1_CRITICAL',  // Immediate action required
  P2_HIGH: 'P2_HIGH',          // Action required soon
  P3_MEDIUM: 'P3_MEDIUM'       // Monitor closely
};
```

### alertingSystem.initialize()

Initialize the alerting system.

```javascript
await alertingSystem.initialize();
```

### alertingSystem.registerHandler(name, handlerFn)

Register an alert handler (email, Slack, webhook, etc.).

```javascript
alertingSystem.registerHandler('slack', async (alert) => {
  await slack.send({
    channel: '#alerts',
    text: `[${alert.severity}] ${alert.title}\n${alert.message}`
  });
});

alertingSystem.registerHandler('email', async (alert) => {
  await sendEmail({
    to: 'team@company.com',
    subject: `Alert: ${alert.title}`,
    body: alert.message
  });
});
```

### alertingSystem.createAlert(alertData)

Create a new alert.

```javascript
const alert = alertingSystem.createAlert({
  severity: 'P1_CRITICAL',
  title: 'Agent Failure',
  message: 'my-agent has failed repeatedly',
  source: 'my-agent',
  metadata: { failureCount: 5 }
});
```

### alertingSystem.acknowledgeAlert(alertId)

Acknowledge an alert.

```javascript
alertingSystem.acknowledgeAlert('alert-123');
```

### alertingSystem.resolveAlert(alertId, resolution)

Resolve an alert.

```javascript
alertingSystem.resolveAlert('alert-123', 'Fixed by restarting service');
```

### alertingSystem.getActiveAlerts(filter)

Get active (unresolved) alerts.

```javascript
const alerts = alertingSystem.getActiveAlerts({
  severity: 'P1_CRITICAL',
  source: 'my-agent'
});
```

### alertingSystem.updateThresholds(severity, thresholds)

Update alert thresholds.

```javascript
alertingSystem.updateThresholds('P1_CRITICAL', {
  errorRate: 15,           // Trigger at 15% error rate
  executionTime: 600000,   // 10 minutes
  healthScore: 40          // Below 40%
});
```

**Default Thresholds:**

| Severity | Error Rate | Exec Time | Memory | Health Score |
|----------|-----------|-----------|--------|--------------|
| P1_CRITICAL | >10% | >10min | N/A | <50% |
| P2_HIGH | >5% | >5min | >500MB | <70% |
| P3_MEDIUM | >2% | >2min | N/A | N/A |

---

## RollbackManager

Git-aware checkpoint and rollback system.

### getRollbackManager()

```javascript
import { getRollbackManager } from 'minions';
const rollback = getRollbackManager();
```

### rollbackManager.initialize()

Initialize the rollback manager.

```javascript
await rollbackManager.initialize();
```

### rollbackManager.createCheckpoint(operation, metadata)

Create a checkpoint before a risky operation.

```javascript
const checkpointId = await rollbackManager.createCheckpoint(
  'feature-implementation',
  { files: ['src/api.js'], author: 'agent-a' }
);
```

**Returns:** Checkpoint ID (string).

### rollbackManager.commitCheckpoint(checkpointId)

Mark a checkpoint as successful (won't be rolled back).

```javascript
await rollbackManager.commitCheckpoint(checkpointId);
```

### rollbackManager.rollback(checkpointId, reason)

Rollback to a checkpoint state.

```javascript
await rollbackManager.rollback(checkpointId, 'Tests failed after changes');
```

### rollbackManager.getCheckpoint(checkpointId)

Get checkpoint details.

```javascript
const checkpoint = rollbackManager.getCheckpoint('cp-123');
// {
//   id: 'cp-123',
//   operation: 'feature-implementation',
//   timestamp: number,
//   metadata: {...},
//   git: {
//     branch: 'main',
//     commit: 'abc123',
//     hasUncommittedChanges: true,
//     stashRef: 'stash@{0}'
//   },
//   status: 'active'
// }
```

### rollbackManager.listCheckpoints(filter)

List checkpoints.

```javascript
const checkpoints = rollbackManager.listCheckpoints({
  status: 'active',
  operation: 'feature-implementation'
});
```

### rollbackManager.cleanup(maxAge)

Clean up old committed checkpoints.

```javascript
await rollbackManager.cleanup(86400000); // 24 hours
```

---

## AutonomousLoopManager

Manages test-fix-verify cycles.

### getAutonomousLoopManager()

```javascript
import { getAutonomousLoopManager } from 'minions';
const loopManager = getAutonomousLoopManager();
```

### loopManager.registerAgentMatcher(matcherFn)

Register a function to route failures to agents.

```javascript
loopManager.registerAgentMatcher((failure, platform) => {
  if (failure.file?.includes('api/')) return 'api-agent';
  if (failure.file?.includes('frontend/')) return 'frontend-agent';
  return null; // Let next matcher handle
});
```

### loopManager.registerAgent(agentName, agentInstance)

Register an agent that can fix issues.

```javascript
loopManager.registerAgent('api-agent', apiAgentInstance);
```

### loopManager.getCurrentStatus()

Get current loop status.

```javascript
const status = loopManager.getCurrentStatus();
// {
//   id: 'loop-123',
//   startTime: timestamp,
//   iteration: 2,
//   originalFailures: 5,
//   fixesApplied: [...],
//   tierResults: {
//     autoFixer: {...},
//     platformAgents: {...}
//   }
// }
```

### loopManager.getHistory(limit)

Get recent loop history.

```javascript
const history = loopManager.getHistory(10);
```

---

## AgentPool

Manages agent lifecycle with rate limiting and retry logic.

### getAgentPool()

```javascript
import { getAgentPool } from 'minions';
const pool = getAgentPool();
```

### agentPool.registerAgent(name, config)

Register an agent with custom configuration.

```javascript
pool.registerAgent('my-agent', {
  timeout: 300000,    // 5 minutes (default)
  maxRetries: 3,      // Default
  cooldown: 10000     // 10 seconds (default)
});
```

### agentPool.executeAgent(name, executeFn, context)

Execute an agent with rate limiting and retry.

```javascript
const result = await pool.executeAgent(
  'my-agent',
  async () => {
    // Agent work
    return { success: true };
  },
  { triggeredBy: 'TESTS_FAILED' }
);
```

### agentPool.canExecute(agentName)

Check if agent can be executed.

```javascript
const check = pool.canExecute('my-agent');
// {
//   allowed: true,
//   reason?: 'In cooldown period',
//   remainingMs?: 5000
// }
```

### agentPool.getAgentStats(agentName)

Get agent execution statistics.

```javascript
const stats = pool.getAgentStats('my-agent');
// {
//   name: 'my-agent',
//   status: 'idle',
//   totalExecutions: 50,
//   successfulExecutions: 48,
//   failedExecutions: 2,
//   successRate: '96.0%',
//   averageDuration: '1500ms',
//   isInCooldown: false,
//   isRateLimited: false
// }
```

### agentPool.getPoolStats()

Get statistics for all agents in the pool.

---

## DependencyGraph

Manages agent dependencies and execution order.

### getDependencyGraph()

```javascript
import { getDependencyGraph } from 'minions';
const graph = getDependencyGraph();
```

### dependencyGraph.addAgent(name, dependencies)

Add an agent with its dependencies.

```javascript
graph.addAgent('processor', ['fetcher', 'validator']);
```

### dependencyGraph.buildExecutionOrder()

Calculate execution order (topological sort).

```javascript
graph.buildExecutionOrder();
```

### dependencyGraph.getParallelGroups()

Get agents grouped by execution level.

```javascript
const groups = graph.getParallelGroups();
// [
//   { level: 1, agents: ['fetcher', 'validator'] },
//   { level: 2, agents: ['processor'] }
// ]
```

### dependencyGraph.hasCircularDependencies()

Check for circular dependencies.

```javascript
if (graph.hasCircularDependencies()) {
  throw new Error('Circular dependency detected');
}
```

### dependencyGraph.getAffectedAgents(changedFiles)

Get agents affected by file changes.

```javascript
const affected = graph.getAffectedAgents(['src/api/users.js']);
// ['api-agent', 'tester-agent']
```

---

## Specialized Agents

### TesterAgent

Multi-platform test orchestration with comprehensive analysis capabilities.

#### getTesterAgent()

```javascript
import { getTesterAgent } from 'minions';
const tester = getTesterAgent();
```

#### tester.runTests(options)

Run tests for a specific platform.

```javascript
const results = await tester.runTests({
  platform: 'backend',      // 'backend', 'react', 'flutter', 'e2e'
  testPaths: ['tests/'],    // Test directories or files
  coverage: true,           // Enable coverage analysis
  watch: false              // Watch mode
});
```

**Returns:**
```javascript
{
  success: boolean,
  summary: {
    total: number,
    passed: number,
    failed: number,
    skipped: number
  },
  failures: [{
    test: string,
    file: string,
    error: string,
    stack: string
  }],
  coverage?: CoverageReport,
  duration: number
}
```

#### tester.generateTests(sourceFile)

Generate tests for a source file.

```javascript
const tests = await tester.generateTests('src/api/users.js');
// {
//   testFile: 'src/api/__tests__/users.test.js',
//   testCases: [...],
//   mocks: [...]
// }
```

#### tester.analyzeCoverage(coverageData)

Analyze code coverage and identify gaps.

```javascript
const analysis = await tester.analyzeCoverage(coverageData);
// {
//   summary: { lines, branches, functions, statements },
//   gaps: [{ file, uncoveredLines, suggestions }],
//   recommendations: [...]
// }
```

#### tester.detectFlaky(testResults)

Detect flaky tests from historical results.

```javascript
const flaky = await tester.detectFlaky(testHistory);
// [{
//   test: 'should handle async...',
//   file: 'api.test.js',
//   flakinessScore: 0.15,
//   failurePatterns: [...]
// }]
```

#### tester.runBenchmarks(options)

Run performance benchmarks.

```javascript
const benchmarks = await tester.runBenchmarks({
  type: 'backend',          // 'backend', 'frontend', 'load'
  scenarios: ['api-latency', 'db-queries'],
  iterations: 100
});
```

---

### DockerAgent

Complete Docker lifecycle management.

#### getDockerAgent()

```javascript
import { getDockerAgent } from 'minions';
const docker = getDockerAgent();
```

#### docker.validate(dockerfilePath)

Validate a Dockerfile.

```javascript
const validation = await docker.validate('./Dockerfile');
// {
//   valid: boolean,
//   errors: [],
//   warnings: [],
//   suggestions: []
// }
```

#### docker.build(options)

Build a Docker image.

```javascript
const result = await docker.build({
  context: '.',
  dockerfile: './Dockerfile',
  tag: 'myapp:latest',
  buildArgs: { NODE_ENV: 'production' },
  cache: true
});
```

#### docker.optimize(imageName)

Analyze and optimize a Docker image.

```javascript
const optimization = await docker.optimize('myapp:latest');
// {
//   currentSize: '500MB',
//   potentialSize: '200MB',
//   suggestions: [
//     { type: 'multi-stage', savings: '150MB' },
//     { type: 'layer-order', impact: 'cache-efficiency' }
//   ]
// }
```

#### docker.scanVulnerabilities(imageName)

Scan image for security vulnerabilities.

```javascript
const scan = await docker.scanVulnerabilities('myapp:latest');
// {
//   vulnerabilities: [{
//     severity: 'HIGH',
//     package: 'openssl',
//     version: '1.0.2',
//     fixedIn: '1.1.1',
//     description: '...'
//   }],
//   summary: { critical: 0, high: 2, medium: 5, low: 10 }
// }
```

#### docker.validateCompose(composePath)

Validate a docker-compose file.

```javascript
const validation = await docker.validateCompose('./docker-compose.yml');
```

#### docker.monitorHealth(containerName)

Monitor container health.

```javascript
const health = await docker.monitorHealth('myapp-container');
// {
//   status: 'healthy',
//   checks: [...],
//   resources: { cpu: '5%', memory: '150MB' }
// }
```

---

### GithubAgent

Complete GitHub automation.

#### getGithubAgent()

```javascript
import { getGithubAgent } from 'minions';
const github = getGithubAgent();
```

#### github.createBranch(branchName, options)

Create a new branch.

```javascript
await github.createBranch('feature/new-feature', {
  base: 'main',
  checkout: true
});
```

#### github.createPullRequest(options)

Create a pull request.

```javascript
const pr = await github.createPullRequest({
  title: 'Add user authentication',
  body: 'This PR adds...',
  base: 'main',
  head: 'feature/auth',
  draft: false,
  labels: ['enhancement'],
  reviewers: ['username']
});
// { number: 123, url: 'https://github.com/...' }
```

#### github.reviewCode(prNumber)

Perform automated code review.

```javascript
const review = await github.reviewCode(123);
// {
//   decision: 'COMMENT',  // 'APPROVE', 'REQUEST_CHANGES', 'COMMENT'
//   comments: [{
//     path: 'src/api.js',
//     line: 42,
//     body: 'Consider adding error handling here'
//   }],
//   summary: '...'
// }
```

#### github.mergePullRequest(prNumber, options)

Merge a pull request.

```javascript
await github.mergePullRequest(123, {
  method: 'squash',         // 'merge', 'squash', 'rebase'
  commitMessage: 'feat: add auth (#123)',
  deleteSourceBranch: true
});
```

#### github.createRelease(options)

Create a GitHub release.

```javascript
const release = await github.createRelease({
  tag: 'v1.2.0',
  name: 'Version 1.2.0',
  body: 'Release notes...',
  draft: false,
  prerelease: false,
  generateNotes: true
});
```

#### github.manageIssue(issueNumber, action)

Manage GitHub issues.

```javascript
await github.manageIssue(456, {
  action: 'close',          // 'close', 'reopen', 'label', 'assign'
  labels: ['bug', 'fixed'],
  assignees: ['developer']
});
```

---

### CodebaseAnalyzer

System-wide deep analysis across codebases.

#### getCodebaseAnalyzer()

```javascript
import { getCodebaseAnalyzer } from 'minions';
const analyzer = getCodebaseAnalyzer();
```

#### analyzer.analyze(options)

Run comprehensive codebase analysis.

```javascript
const report = await analyzer.analyze({
  projectRoot: '/path/to/project',
  analyzers: ['security', 'performance', 'dependencies', 'technical-debt'],
  exclude: ['node_modules', 'dist']
});
```

**Returns:**
```javascript
{
  security: {
    vulnerabilities: [...],
    score: 85,
    recommendations: [...]
  },
  performance: {
    issues: [...],
    hotspots: [...],
    score: 78
  },
  dependencies: {
    graph: {...},
    outdated: [...],
    conflicts: [...],
    unused: [...]
  },
  technicalDebt: {
    score: 72,
    items: [...],
    estimatedEffort: '40 hours',
    priority: [...]
  }
}
```

#### analyzer.scanSecurity(options)

Deep security scan.

```javascript
const security = await analyzer.scanSecurity({
  projectRoot: '/path',
  includeTests: false
});
```

#### analyzer.analyzePerformance(options)

Performance analysis across the codebase.

```javascript
const perf = await analyzer.analyzePerformance({
  projectRoot: '/path',
  focus: ['database', 'api', 'memory']
});
```

#### analyzer.mapDependencies(options)

Create a dependency map.

```javascript
const deps = await analyzer.mapDependencies({
  projectRoot: '/path',
  includeDevDeps: true,
  depth: 3
});
// {
//   graph: { nodes: [...], edges: [...] },
//   circular: [...],
//   unused: [...],
//   duplicates: [...]
// }
```

#### analyzer.measureTechnicalDebt(options)

Measure technical debt.

```javascript
const debt = await analyzer.measureTechnicalDebt({
  projectRoot: '/path',
  baseline: previousReport
});
// {
//   score: 72,
//   trend: 'improving',
//   items: [...],
//   byCategory: { ... }
// }
```

#### analyzer.validateApiContracts(options)

Validate API contracts.

```javascript
const contracts = await analyzer.validateApiContracts({
  specPath: 'openapi.yaml',
  codePath: 'src/api/'
});
// {
//   valid: boolean,
//   mismatches: [...],
//   undocumented: [...],
//   deprecated: [...]
// }
```

---

### DocumentAgent

Bidirectional code-documentation synchronization.

#### getDocumentAgent()

```javascript
import { getDocumentAgent } from 'minions';
const docAgent = getDocumentAgent();
```

#### docAgent.sync(options)

Synchronize code and documentation.

```javascript
const result = await docAgent.sync({
  codeDir: 'src/',
  docsDir: 'docs/',
  mode: 'bidirectional',    // 'code-to-docs', 'docs-to-code', 'bidirectional'
  dryRun: false
});
// {
//   changes: [...],
//   conflicts: [...],
//   updated: { docs: 5, code: 2 }
// }
```

#### docAgent.parseCode(options)

Parse code to extract documentation.

```javascript
const parsed = await docAgent.parseCode({
  files: ['src/api/*.js'],
  extractJSDoc: true,
  extractTypes: true
});
// {
//   functions: [...],
//   classes: [...],
//   types: [...],
//   exports: [...]
// }
```

#### docAgent.updateOpenAPI(options)

Update OpenAPI specification from code.

```javascript
await docAgent.updateOpenAPI({
  codePath: 'src/api/',
  specPath: 'openapi.yaml',
  preserve: ['info', 'servers']
});
```

#### docAgent.updateChangelog(options)

Update CHANGELOG from git history.

```javascript
await docAgent.updateChangelog({
  changelogPath: 'CHANGELOG.md',
  since: 'v1.0.0',
  categorize: true      // Group by type (feat, fix, etc.)
});
```

#### docAgent.detectBreakingChanges(options)

Detect breaking changes between versions.

```javascript
const breaking = await docAgent.detectBreakingChanges({
  oldVersion: 'v1.0.0',
  newVersion: 'HEAD'
});
// {
//   breaking: [...],
//   deprecations: [...],
//   migrations: [...]
// }
```

#### docAgent.generateDigest(options)

Generate platform-specific documentation digest.

```javascript
const digest = await docAgent.generateDigest({
  platform: 'backend',      // 'backend', 'admin', 'user', 'driver'
  format: 'markdown',
  includeExamples: true
});
```

#### docAgent.validateDocs(options)

Validate documentation quality and accuracy.

```javascript
const validation = await docAgent.validateDocs({
  docsDir: 'docs/',
  checkLinks: true,
  checkExamples: true
});
// {
//   valid: boolean,
//   brokenLinks: [...],
//   outdatedExamples: [...],
//   missingDocs: [...]
// }
```

---

## Code Writer Agents

Specialized agents for generating platform-specific code.

### FlutterWriterAgent

Generates Flutter/Dart code with Bloc state management.

#### getFlutterWriterAgent()

```javascript
import { getFlutterWriterAgent } from 'minions';
const flutter = getFlutterWriterAgent();
```

#### flutter.configure(config)

Configure the agent.

```javascript
await flutter.configure({
  projectPath: './my-app',
  stateManagement: 'bloc',  // 'bloc' | 'provider' | 'riverpod'
  apiClient: 'dio',
  useFreezed: true,
  useJsonSerializable: true,
  nullSafety: true,
  l10nEnabled: true,
  supportedLocales: ['en', 'ar', 'ku']
});
```

#### flutter.generateWidget(spec)

Generate a Flutter widget.

```javascript
const result = await flutter.generateWidget({
  name: 'UserCard',
  type: 'stateless',  // 'stateless' | 'stateful'
  props: [
    { name: 'user', type: 'User', required: true },
    { name: 'onTap', type: 'VoidCallback' }
  ],
  imports: ['package:myapp/models/user.dart']
});
// Returns: { success, filePath, code, imports }
```

#### flutter.generateModel(spec)

Generate a data model with Freezed.

```javascript
const result = await flutter.generateModel({
  name: 'User',
  fields: [
    { name: 'id', type: 'String', required: true },
    { name: 'email', type: 'String', required: true },
    { name: 'name', type: 'String' },
    { name: 'createdAt', type: 'DateTime', jsonKey: 'created_at' }
  ],
  useFreezed: true,
  generateCopyWith: true,
  generateToJson: true
});
```

#### flutter.generateService(spec)

Generate a Dio-based API service.

```javascript
const result = await flutter.generateService({
  name: 'UserService',
  baseUrl: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', name: 'getUsers', returnType: 'List<User>' },
    { method: 'GET', path: '/:id', name: 'getUser', returnType: 'User' },
    { method: 'POST', path: '/', name: 'createUser', body: 'CreateUserRequest', returnType: 'User' }
  ]
});
```

#### flutter.generateBloc(spec)

Generate a Bloc or Cubit.

```javascript
const result = await flutter.generateBloc({
  name: 'Auth',
  type: 'bloc',  // 'bloc' | 'cubit'
  events: ['Login', 'Logout', 'CheckStatus'],
  states: ['Initial', 'Loading', 'Authenticated', 'Unauthenticated', 'Error'],
  methods: [
    { event: 'Login', handler: '_onLogin' },
    { event: 'Logout', handler: '_onLogout' }
  ]
});
```

#### flutter.generatePage(spec)

Generate a page with Scaffold.

```javascript
const result = await flutter.generatePage({
  name: 'HomePage',
  hasAppBar: true,
  appBarTitle: 'Home',
  hasDrawer: true,
  hasBottomNav: false,
  hasFloatingButton: true,
  bloc: 'HomeBloc'
});
```

#### flutter.generateLocalization(spec)

Generate ARB localization files.

```javascript
const result = await flutter.generateLocalization({
  strings: {
    appTitle: 'My App',
    welcomeMessage: 'Welcome, {name}!',
    itemCount: '{count, plural, =0{No items} =1{1 item} other{{count} items}}'
  },
  locales: ['en', 'ar', 'ku'],
  outputDir: 'lib/l10n'
});
```

---

### BackendWriterAgent

Generates Node.js/Express backend code with Mongoose ORM.

#### getBackendWriterAgent()

```javascript
import { getBackendWriterAgent } from 'minions';
const backend = getBackendWriterAgent();
```

#### backend.configure(config)

Configure the agent.

```javascript
await backend.configure({
  projectPath: './my-backend',
  framework: 'express',
  orm: 'mongoose',        // 'mongoose' | 'sequelize'
  validator: 'joi',       // 'joi' | 'zod'
  typescript: false,
  useRepositoryPattern: true
});
```

#### backend.generateRoute(spec)

Generate Express routes.

```javascript
const result = await backend.generateRoute({
  name: 'users',
  basePath: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', handler: 'list', middleware: ['auth'] },
    { method: 'POST', path: '/', handler: 'create', middleware: ['auth', 'validate'] },
    { method: 'GET', path: '/:id', handler: 'getById' },
    { method: 'PUT', path: '/:id', handler: 'update' },
    { method: 'DELETE', path: '/:id', handler: 'delete' }
  ]
});
// Returns: { success, filePath, code }
```

#### backend.generateModel(spec)

Generate a Mongoose model.

```javascript
const result = await backend.generateModel({
  name: 'User',
  orm: 'mongoose',
  fields: [
    { name: 'email', type: 'string', required: true, unique: true, index: true },
    { name: 'password', type: 'string', required: true, select: false },
    { name: 'name', type: 'string', required: true },
    { name: 'role', type: 'string', enum: ['admin', 'user'], default: 'user' },
    { name: 'profile', type: 'ref', ref: 'Profile' }
  ],
  timestamps: true,
  methods: ['comparePassword', 'generateToken'],
  statics: ['findByEmail'],
  indexes: [{ fields: { email: 1 }, unique: true }]
});
```

#### backend.generateService(spec)

Generate a service layer.

```javascript
const result = await backend.generateService({
  name: 'UserService',
  type: 'crud',  // 'crud' | 'custom'
  model: 'User',
  methods: [
    { name: 'findByEmail', params: ['email'], returns: 'User' },
    { name: 'updatePassword', params: ['userId', 'newPassword'], returns: 'void' }
  ],
  useRepository: true,
  useTransactions: true
});
```

#### backend.generateMiddleware(spec)

Generate middleware.

```javascript
const result = await backend.generateMiddleware({
  name: 'auth',
  type: 'auth',  // 'auth' | 'validation' | 'rateLimit' | 'errorHandler' | 'custom'
  options: {
    jwtSecret: 'process.env.JWT_SECRET',
    excludePaths: ['/api/auth/login', '/api/auth/register']
  }
});
```

#### backend.generateValidator(spec)

Generate Joi validation schemas.

```javascript
const result = await backend.generateValidator({
  name: 'user',
  library: 'joi',  // 'joi' | 'zod'
  schemas: {
    create: [
      { field: 'email', type: 'string', rules: ['email', 'required'] },
      { field: 'password', type: 'string', rules: ['min:8', 'required'] },
      { field: 'name', type: 'string', rules: ['required'] }
    ],
    update: [
      { field: 'email', type: 'string', rules: ['email'] },
      { field: 'name', type: 'string' }
    ]
  }
});
```

#### backend.generateController(spec)

Generate a controller.

```javascript
const result = await backend.generateController({
  name: 'UserController',
  type: 'rest',  // 'rest' | 'custom'
  service: 'UserService',
  methods: [
    { name: 'list', httpMethod: 'GET', path: '/' },
    { name: 'create', httpMethod: 'POST', path: '/' },
    { name: 'getById', httpMethod: 'GET', path: '/:id' },
    { name: 'update', httpMethod: 'PUT', path: '/:id' },
    { name: 'delete', httpMethod: 'DELETE', path: '/:id' }
  ]
});
```

---

### FrontendWriterAgent

Generates React/TypeScript frontend code with Context state management.

#### getFrontendWriterAgent()

```javascript
import { getFrontendWriterAgent } from 'minions';
const frontend = getFrontendWriterAgent();
```

#### frontend.configure(config)

Configure the agent.

```javascript
await frontend.configure({
  projectPath: './my-frontend',
  framework: 'react',       // 'react' | 'nextjs'
  stateManagement: 'context',  // 'context' | 'zustand' | 'redux'
  apiClient: 'react-query', // 'react-query' | 'swr' | 'axios'
  typescript: true,
  cssFramework: 'tailwind', // 'tailwind' | 'styled-components' | 'css-modules'
  formLibrary: 'react-hook-form'
});
```

#### frontend.generateComponent(spec)

Generate a React component.

```javascript
const result = await frontend.generateComponent({
  name: 'UserProfile',
  type: 'functional',
  props: [
    { name: 'userId', type: 'string', required: true },
    { name: 'onUpdate', type: '(user: User) => void' },
    { name: 'className', type: 'string' }
  ],
  hooks: ['useState', 'useEffect'],
  cssFramework: 'tailwind',
  withMemo: true
});
// Returns: { success, filePath, code, testCode }
```

#### frontend.generateHook(spec)

Generate a custom hook.

```javascript
const result = await frontend.generateHook({
  name: 'useUser',
  type: 'query',  // 'state' | 'query' | 'mutation' | 'subscription' | 'custom'
  endpoint: '/api/users/:id',
  returnType: 'User',
  params: [{ name: 'id', type: 'string' }],
  options: {
    staleTime: 5000,
    cacheTime: 300000
  }
});
```

#### frontend.generateStore(spec)

Generate state management store.

```javascript
const result = await frontend.generateStore({
  name: 'auth',
  type: 'context',  // 'context' | 'zustand' | 'redux'
  state: [
    { name: 'user', type: 'User | null', initial: 'null' },
    { name: 'isAuthenticated', type: 'boolean', initial: 'false' },
    { name: 'loading', type: 'boolean', initial: 'false' }
  ],
  actions: [
    { name: 'login', params: ['credentials: LoginCredentials'], async: true },
    { name: 'logout', async: true },
    { name: 'setUser', params: ['user: User'] }
  ]
});
```

#### frontend.generateForm(spec)

Generate a form component.

```javascript
const result = await frontend.generateForm({
  name: 'LoginForm',
  type: 'controlled',  // 'controlled' | 'uncontrolled'
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true, validation: 'email' },
    { name: 'password', type: 'password', label: 'Password', required: true, validation: 'min:8' },
    { name: 'rememberMe', type: 'checkbox', label: 'Remember me' }
  ],
  onSubmit: 'handleLogin',
  useReactHookForm: true,
  cssFramework: 'tailwind'
});
```

#### frontend.generateApi(spec)

Generate API integration hooks.

```javascript
const result = await frontend.generateApi({
  name: 'users',
  client: 'react-query',  // 'react-query' | 'swr' | 'axios'
  baseUrl: '/api/users',
  endpoints: [
    { method: 'GET', path: '/', name: 'useUsers', returnType: 'User[]' },
    { method: 'GET', path: '/:id', name: 'useUser', returnType: 'User' },
    { method: 'POST', path: '/', name: 'useCreateUser', returnType: 'User' },
    { method: 'PUT', path: '/:id', name: 'useUpdateUser', returnType: 'User' },
    { method: 'DELETE', path: '/:id', name: 'useDeleteUser', returnType: 'void' }
  ]
});
```

#### frontend.generatePage(spec)

Generate a page component.

```javascript
const result = await frontend.generatePage({
  name: 'UsersPage',
  type: 'list',  // 'list' | 'detail' | 'form' | 'dashboard' | 'custom'
  framework: 'react',
  layout: 'DashboardLayout',
  dataSource: 'useUsers',
  features: ['search', 'pagination', 'sorting'],
  actions: ['create', 'edit', 'delete']
});
```

---

## Skills

### BaseSkill

Base class for creating skills.

```javascript
import { BaseSkill, SEVERITY, CATEGORY } from 'minions';

class MySkill extends BaseSkill {
  constructor(options) {
    super('MySkill', options);
  }

  async onInitialize() {
    // Custom init
  }

  async execute(input) {
    this.startRun();
    try {
      // Work
      this.addIssue(this.createIssue({
        type: 'my-issue',
        severity: SEVERITY.MEDIUM,
        category: CATEGORY.QUALITY,
        message: 'Description'
      }));
      this.completeRun();
    } catch (error) {
      this.failRun(error);
      throw error;
    }
  }
}
```

### Severity Constants

```javascript
SEVERITY.CRITICAL  // Critical issues
SEVERITY.HIGH      // High priority
SEVERITY.MEDIUM    // Medium priority
SEVERITY.LOW       // Low priority
SEVERITY.INFO      // Informational
```

### Category Constants

```javascript
CATEGORY.SECURITY     // Security issues
CATEGORY.PERFORMANCE  // Performance issues
CATEGORY.QUALITY      // Code quality
CATEGORY.STYLE        // Style/formatting
CATEGORY.BUG          // Bugs
CATEGORY.TEST         // Testing issues
CATEGORY.DEPENDENCY   // Dependency issues
```

### Built-in Skills

#### getAutoFixer(options)

```javascript
const fixer = getAutoFixer({ projectRoot: '/path' });
await fixer.initialize();
await fixer.handleTestFailure({ testOutput, failedTests });
```

#### getCodeReviewer()

```javascript
const reviewer = getCodeReviewer();
await reviewer.initialize();
const result = await reviewer.review('/path/to/file.js');
```

#### getSecurityScanner()

```javascript
const scanner = getSecurityScanner();
const results = await scanner.scan('/path/to/project');
```

#### getTestGenerator()

```javascript
const generator = getTestGenerator();
const tests = await generator.generate('/path/to/source.js');
```

#### getDependencyAnalyzer()

```javascript
const analyzer = getDependencyAnalyzer();
const deps = await analyzer.analyze('/path/to/project');
```

---

## Analyzers

### BaseAnalyzer

Base class for code analyzers.

```javascript
import { BaseAnalyzer } from 'minions';

class MyAnalyzer extends BaseAnalyzer {
  constructor() {
    super('MyAnalyzer');
  }

  async analyze(code, options = {}) {
    this.clearIssues();
    // Analysis logic
    return this.formatResults();
  }
}
```

### SecurityScanner

Detects security vulnerabilities.

```javascript
import { SecurityScanner } from 'minions';

const scanner = new SecurityScanner();
const results = await scanner.analyze(code);
```

**Detects:**
- Hardcoded secrets (API keys, passwords)
- SQL injection vulnerabilities
- XSS vulnerabilities
- Weak authentication patterns
- Missing rate limiting
- CORS misconfiguration
- Weak hashing (MD5, SHA1)
- JWT without expiry

### PerformanceAnalyzer

Detects performance issues.

```javascript
import { PerformanceAnalyzer } from 'minions';

const analyzer = new PerformanceAnalyzer();
const results = await analyzer.analyze(code);
```

**Detects:**
- N+1 query patterns
- Missing database indexes
- SELECT * usage
- Missing LIMIT clauses
- Synchronous blocking operations
- Repeated identical queries

---

## ASTParser

Babel-based JavaScript/TypeScript parser.

### ASTParser

```javascript
import { ASTParser } from 'minions';

const parser = new ASTParser();
```

### parser.parse(code)

Parse code into AST.

```javascript
const result = parser.parse(code);
// {
//   success: boolean,
//   ast: BabelAST,
//   metadata: {
//     parsedAt: ISO string,
//     nodeCount: number
//   },
//   error?: ParseError
// }
```

### parser.extractFunctions()

Extract function declarations.

```javascript
const functions = parser.extractFunctions();
// [{ name, params, async, location }]
```

### parser.extractImports()

Extract import statements.

```javascript
const imports = parser.extractImports();
// [{ source, specifiers, type }]
```

### parser.extractClasses()

Extract class definitions.

```javascript
const classes = parser.extractClasses();
// [{ name, methods, superClass, location }]
```

### parser.calculateComplexity()

Calculate cyclomatic complexity per function.

```javascript
const complexity = parser.calculateComplexity();
// [{ name, complexity, location }]
```

---

## Event Types Reference

```javascript
import { EventTypes } from 'minions';

// Code Events
EventTypes.CODE_GENERATED
EventTypes.CODE_UPDATED
EventTypes.CODE_DELETED
EventTypes.CODE_ANALYZED
EventTypes.QUALITY_SCORED
EventTypes.ISSUE_DETECTED

// Testing Events
EventTypes.TESTS_STARTED
EventTypes.TESTS_COMPLETED
EventTypes.TESTS_FAILED
EventTypes.TESTS_GENERATED
EventTypes.COVERAGE_UPDATED

// Build & Deployment
EventTypes.BUILD_STARTED
EventTypes.BUILD_COMPLETED
EventTypes.BUILD_FAILED
EventTypes.DEPLOYMENT_STARTED
EventTypes.DEPLOYMENT_COMPLETED

// Git & PR Events
EventTypes.PR_CREATED
EventTypes.PR_UPDATED
EventTypes.PR_MERGED
EventTypes.PR_CLOSED

// Documentation
EventTypes.DOCS_UPDATED
EventTypes.DOCS_SYNCED

// Error & Recovery
EventTypes.ERROR_OCCURRED
EventTypes.ROLLBACK_REQUESTED
EventTypes.ROLLBACK_COMPLETED

// Agent Lifecycle
EventTypes.AGENT_STARTED
EventTypes.AGENT_COMPLETED
EventTypes.AGENT_FAILED
EventTypes.AGENT_HEALTH_CHECK

// Metrics & Monitoring
EventTypes.METRICS_COLLECTED
EventTypes.ALERT_TRIGGERED
EventTypes.CHANGE_DETECTED

// Auto-Fix Coordination
EventTypes.AUTO_FIX_REQUESTED
EventTypes.FIX_COMPLETED
EventTypes.FIX_FAILED

// Code Review
EventTypes.REVIEW_REQUESTED
EventTypes.REVIEW_COMPLETED

// Security
EventTypes.SECURITY_SCAN_REQUESTED
EventTypes.SECURITY_SCAN_COMPLETED

// Dependencies
EventTypes.ANALYZE_DEPENDENCIES
EventTypes.DEPENDENCIES_ANALYZED
EventTypes.UPDATE_DEPENDENCIES
EventTypes.DEPENDENCIES_UPDATED

// Test Generation
EventTypes.GENERATE_TESTS

// Skill Lifecycle
EventTypes.SKILL_READY
```
