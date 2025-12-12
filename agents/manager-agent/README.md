# Manager Agent - Orchestration Framework

**Phase 1: Manager-Agent**
**Status**: ✅ Complete
**Purpose**: Coordinates execution of all agents with dependency resolution, parallel execution, and autonomous loops

---

## Architecture

The Manager Agent is the orchestration layer that ties the entire 10-agent system together. It provides:

- **Dependency Resolution**: Topological sorting of agent execution order
- **Parallel Execution**: Run independent agents concurrently (max 5 at once)
- **Autonomous Loops**: Automatic test-fix-verify cycles
- **Rollback Support**: Checkpoint and recovery mechanisms
- **Rate Limiting**: Prevent agent overload with cooldowns and limits
- **Change Detection**: Git monitoring and impact analysis

---

## Components

### 1. Orchestrator (`orchestrator.js`)

**Main orchestration engine** that coordinates all agent execution.

**Key Features**:
- Builds execution plans based on dependency graph
- Manages parallel execution with concurrency limits
- Handles rollback on failure
- Publishes execution events to EventBus

**Usage**:
```javascript
import { getOrchestrator } from './manager-agent/index.js';

const orchestrator = getOrchestrator();
await orchestrator.initialize();

// Execute all agents
const plan = orchestrator.buildExecutionPlan();
const results = await orchestrator.execute(plan);

// Execute specific agents based on changed files
const changedFiles = ['backend/src/controllers/users.js'];
const filteredPlan = orchestrator.buildExecutionPlan(changedFiles);
const filteredResults = await orchestrator.execute(filteredPlan);
```

**Methods**:
- `initialize()` - Initialize orchestrator and register agents
- `buildExecutionPlan(changedFiles)` - Build execution plan
- `execute(plan)` - Execute agents according to plan
- `registerAgents()` - Register all agents with dependencies

---

### 2. Dependency Graph (`dependency-graph.js`)

**Manages dependencies** between agents and determines execution order.

**Agent Dependencies**:
```
Level 0 (No dependencies):
└─ document-agent

Level 1 (Depends on document-agent):
├─ backend-agent

Level 2 (Depends on document + backend):
├─ users-agent
├─ drivers-agent
└─ admin-agent

Level 3 (Depends on all code agents):
├─ codebase-analyzer-agent
├─ tester-agent
└─ docker-agent

Level 4 (Final):
└─ github-agent
```

**Usage**:
```javascript
import { getDependencyGraph } from './manager-agent/index.js';

const graph = getDependencyGraph();

// Add agent with dependencies
graph.addAgent('backend-agent', ['document-agent']);

// Build execution order
graph.buildExecutionOrder();

// Get parallel execution groups
const groups = graph.getParallelGroups();
// [
//   { level: 0, agents: ['document-agent'] },
//   { level: 1, agents: ['backend-agent'] },
//   { level: 2, agents: ['users-agent', 'drivers-agent', 'admin-agent'] },
//   ...
// ]

// Get affected agents by file changes
const affected = graph.getAffectedAgents([
  'docs/api.md',
  'backend/src/app.js'
]);
// ['document-agent', 'backend-agent', 'users-agent', ...]
```

**File Pattern Mapping**:
```javascript
{
  'document-agent': [/docs\/.*\.md$/, /\.claude\/.*\.md$/],
  'backend-agent': [/backend\/.*\.(js|ts)$/],
  'users-agent': [/users-app\/.*\.(dart|yaml)$/],
  'drivers-agent': [/drivers-app\/.*\.(dart|yaml)$/],
  'admin-agent': [/admin-dashboard\/.*\.(jsx?|tsx?)$/],
  'tester-agent': [/tests\/.*\.(js|ts|dart)$/],
  'docker-agent': [/Dockerfile$/, /docker-compose\.ya?ml$/]
}
```

---

### 3. Agent Pool (`agent-pool.js`)

**Lifecycle management** for all agents with safety features.

**Features**:
- **Rate Limiting**: Max 10 executions per minute per agent
- **Cooldown**: 10-second cooldown between executions
- **Circular Update Prevention**: Max 3 executions per 5-minute window
- **Execution History**: Track all agent executions
- **Statistics**: Per-agent execution metrics

**Usage**:
```javascript
import { getAgentPool } from './manager-agent/index.js';

const pool = getAgentPool();

// Register an agent
pool.registerAgent('backend-agent', backendAgentInstance);

// Check if agent can execute
const canExecute = await pool.canExecute('backend-agent');

// Execute agent with safety checks
const result = await pool.executeAgent('backend-agent', options);

// Get agent statistics
const stats = pool.getAgentStats('backend-agent');
// {
//   totalExecutions: 15,
//   successfulExecutions: 14,
//   failedExecutions: 1,
//   averageDuration: 2345,
//   lastExecution: '2025-11-24T10:30:00Z'
// }
```

**Safety Limits**:
- ⏱️ Max 10 executions per minute (prevents overload)
- 🔄 Max 3 executions per 5-minute window (prevents circular updates)
- ⏸️ 10-second cooldown between executions (prevents rapid re-execution)
- ⏰ 5-minute timeout per execution (prevents hanging)

---

### 4. Autonomous Loop Manager (`autonomous-loop-manager.js`)

**Test-fix-verify loops** for automatic bug fixing.

**Flow**:
```
1. Tester-Agent runs tests
   ↓
2. Tests fail → Publish TESTS_FAILED event
   ↓
3. Autonomous Loop Manager receives event
   ↓
4. Analyze failures and create fix strategy
   ↓
5. Trigger appropriate agents (backend, users, drivers, admin)
   ↓
6. Agents fix code and publish CODE_GENERATED events
   ↓
7. Re-run tests
   ↓
8. Tests pass? → Done ✅
   Tests fail? → Iterate (max 5 iterations) 🔄
```

**Usage**:
```javascript
import { getAutonomousLoopManager } from './manager-agent/index.js';

const loopManager = getAutonomousLoopManager();

// The manager subscribes to TESTS_FAILED events automatically
// No manual invocation needed - it runs autonomously!

// Get loop statistics
const stats = loopManager.getLoopStats();
// {
//   totalLoops: 10,
//   successfulFixes: 8,
//   failedFixes: 2,
//   averageIterations: 2.3,
//   activeCycles: 1
// }

// Check if a loop is currently active
const isActive = loopManager.isLoopActive('loop-id-123');
```

**Configuration**:
```javascript
{
  maxIterations: 5,              // Max fix attempts before giving up
  timeout: 300000,                // 5 minutes per iteration
  backoffMultiplier: 1.5,         // Increase timeout each iteration
  enableRollback: true,           // Rollback on complete failure
  analysisDepth: 'comprehensive'  // Failure analysis depth
}
```

**Events Published**:
- `LOOP_STARTED` - Loop begins
- `LOOP_ITERATION` - Each fix iteration
- `LOOP_COMPLETED` - Loop succeeds
- `LOOP_FAILED` - Loop exhausted max iterations

---

### 5. Change Detector (`change-detector.js`)

**Git monitoring** and impact analysis for incremental execution.

**Features**:
- Monitor git repository for changes
- Detect changed files since last commit/tag
- Analyze impact of changes
- Map changes to affected agents
- Support for git hooks integration

**Usage**:
```javascript
import { getChangeDetector } from './manager-agent/index.js';

const detector = getChangeDetector();

// Detect changes since last commit
const changes = await detector.detectChanges();
// {
//   added: ['backend/src/new-feature.js'],
//   modified: ['docs/api.md', 'backend/src/users.js'],
//   deleted: ['backend/src/old-file.js']
// }

// Analyze impact
const impact = await detector.analyzeImpact(changes);
// {
//   highImpact: ['backend-agent', 'users-agent'],
//   mediumImpact: ['document-agent'],
//   lowImpact: [],
//   affectedTests: ['backend/__tests__/users.test.js']
// }

// Detect changes since specific commit
const changesSince = await detector.detectChangesSince('abc123');
```

---

## Integration Example

### Complete Orchestration Flow

```javascript
import {
  getOrchestrator,
  getDependencyGraph,
  getAgentPool,
  getAutonomousLoopManager,
  getChangeDetector
} from './manager-agent/index.js';

async function runOrchestration() {
  // 1. Initialize components
  const orchestrator = getOrchestrator();
  const changeDetector = getChangeDetector();
  const loopManager = getAutonomousLoopManager();

  await orchestrator.initialize();

  console.log('Orchestrator initialized');

  // 2. Detect what changed
  const changes = await changeDetector.detectChanges();
  const changedFiles = [
    ...changes.added,
    ...changes.modified
  ];

  console.log(`Detected ${changedFiles.length} changed files`);

  // 3. Build execution plan
  const plan = orchestrator.buildExecutionPlan(changedFiles);

  console.log(`Execution plan: ${plan.totalAgents} agents in ${plan.groups.length} levels`);

  // 4. Execute agents
  const results = await orchestrator.execute(plan);

  console.log(`Execution complete: ${results.successful}/${results.total} succeeded`);

  // 5. Autonomous loop handles test failures automatically
  // (No manual intervention needed - loop manager subscribes to TESTS_FAILED)

  return results;
}

// Run orchestration
runOrchestration()
  .then(results => console.log('All done!', results))
  .catch(error => console.error('Orchestration failed:', error));
```

---

## EventBus Integration

The Manager Agent is deeply integrated with the EventBus system.

### Events Subscribed To

```javascript
// Autonomous Loop Manager
TESTS_FAILED       → Triggers autonomous fix loop
CODE_GENERATED     → May trigger re-testing
```

### Events Published

```javascript
// Orchestrator
ORCHESTRATION_STARTED
ORCHESTRATION_COMPLETED
ORCHESTRATION_FAILED

// Agent Pool
AGENT_EXECUTION_STARTED
AGENT_EXECUTION_COMPLETED
AGENT_EXECUTION_FAILED
RATE_LIMIT_EXCEEDED

// Autonomous Loop Manager
LOOP_STARTED
LOOP_ITERATION
LOOP_COMPLETED
LOOP_FAILED

// Change Detector
CHANGES_DETECTED
IMPACT_ANALYZED
```

---

## Configuration

### Environment Variables

```bash
# Orchestrator
MAX_CONCURRENCY=5              # Max parallel agents
EXECUTION_TIMEOUT=300000       # 5 minutes per agent

# Agent Pool
RATE_LIMIT_PER_MINUTE=10       # Max executions per minute
COOLDOWN_PERIOD=10000          # 10 seconds between runs
MAX_UPDATES_PER_WINDOW=3       # Max runs per 5-min window

# Autonomous Loop
MAX_LOOP_ITERATIONS=5          # Max fix attempts
LOOP_TIMEOUT=300000            # 5 minutes per iteration
ENABLE_ROLLBACK=true           # Rollback on failure

# Change Detector
GIT_REPO_PATH=.                # Repository path
WATCH_INTERVAL=5000            # Check every 5 seconds
```

---

## Execution Patterns

### Pattern 1: Full System Execution

Run all agents in dependency order:

```javascript
const orchestrator = getOrchestrator();
await orchestrator.initialize();

const plan = orchestrator.buildExecutionPlan(); // No files = run all
const results = await orchestrator.execute(plan);
```

### Pattern 2: Incremental Execution

Run only affected agents:

```javascript
const changedFiles = ['backend/src/users.js', 'docs/api.md'];
const plan = orchestrator.buildExecutionPlan(changedFiles);
const results = await orchestrator.execute(plan);
// Only runs: document-agent, backend-agent, dependent agents
```

### Pattern 3: Manual Agent Execution

Execute specific agents:

```javascript
const pool = getAgentPool();
const result = await pool.executeAgent('backend-agent', {
  tasks: ['analyze', 'fix'],
  basePath: process.cwd()
});
```

### Pattern 4: Autonomous Development

Let the system fix itself:

```javascript
// Just run tests - autonomous loop handles failures
const testerAgent = getTesterAgent();
await testerAgent.runTests({
  platforms: ['backend', 'users', 'drivers', 'admin']
});

// If tests fail:
// 1. TESTS_FAILED event published
// 2. Autonomous Loop Manager triggered
// 3. Appropriate agents execute fixes
// 4. Tests re-run automatically
// 5. Loop continues until tests pass or max iterations
```

---

## Best Practices

### 1. Always Initialize
```javascript
const orchestrator = getOrchestrator();
await orchestrator.initialize(); // Required!
```

### 2. Use Incremental Execution
```javascript
// ❌ BAD: Run all agents every time
const plan = orchestrator.buildExecutionPlan();

// ✅ GOOD: Run only affected agents
const changes = await changeDetector.detectChanges();
const plan = orchestrator.buildExecutionPlan([...changes.added, ...changes.modified]);
```

### 3. Handle Errors
```javascript
try {
  const results = await orchestrator.execute(plan);
} catch (error) {
  console.error('Orchestration failed:', error);
  // Check results.failed for partial failures
}
```

### 4. Monitor Execution
```javascript
// Subscribe to orchestration events
eventBus.subscribe(EventTypes.AGENT_EXECUTION_COMPLETED, 'monitor', (data) => {
  console.log(`${data.agent} completed in ${data.duration}ms`);
});
```

### 5. Respect Rate Limits
```javascript
const pool = getAgentPool();

// Check before executing
if (await pool.canExecute('backend-agent')) {
  await pool.executeAgent('backend-agent', options);
} else {
  console.log('Agent is rate-limited, waiting...');
}
```

---

## Troubleshooting

### Issue: Circular dependency detected

**Cause**: Agent A depends on B, B depends on C, C depends on A

**Solution**: Review dependency graph registration
```javascript
// Check for cycles
const graph = getDependencyGraph();
const hasCycles = graph.hasCircularDependencies();
```

### Issue: Agent execution timeout

**Cause**: Agent taking too long (> 5 minutes default)

**Solution**: Increase timeout or optimize agent
```javascript
const pool = getAgentPool();
pool.setTimeout('slow-agent', 600000); // 10 minutes
```

### Issue: Rate limit exceeded

**Cause**: Too many executions in short time

**Solution**: Respect cooldowns
```javascript
const stats = pool.getAgentStats('backend-agent');
console.log('Last execution:', stats.lastExecution);
// Wait appropriate cooldown period
```

### Issue: Autonomous loop not triggering

**Cause**: EventBus not connected or TESTS_FAILED not published

**Solution**: Verify EventBus integration
```javascript
const loopManager = getAutonomousLoopManager();
// Check if subscribed
console.log('Loop manager initialized:', loopManager.initialized);
```

---

## Performance Metrics

**Typical Execution Times** (on average project):

| Agent | Typical Duration |
|-------|-----------------|
| document-agent | 50-200ms |
| backend-agent | 500-2000ms |
| users-agent | 1000-3000ms |
| drivers-agent | 1000-3000ms |
| admin-agent | 800-2500ms |
| codebase-analyzer | 2000-5000ms |
| tester-agent | 10000-60000ms |
| docker-agent | 5000-30000ms |
| github-agent | 2000-10000ms |

**Parallel Execution Benefits**:
- Sequential: ~85 seconds total
- Parallel (max 5): ~25-35 seconds total
- **Speedup**: ~3x faster

---

## Testing

```javascript
import { getOrchestrator, getDependencyGraph } from './manager-agent/index.js';

describe('Manager Agent', () => {
  test('should build execution plan', () => {
    const orchestrator = getOrchestrator();
    const plan = orchestrator.buildExecutionPlan();

    expect(plan.groups.length).toBeGreaterThan(0);
    expect(plan.totalAgents).toBeGreaterThan(0);
  });

  test('should resolve dependencies', () => {
    const graph = getDependencyGraph();
    graph.addAgent('test-agent', ['dep1', 'dep2']);

    const deps = graph.getDependencies('test-agent');
    expect(deps).toEqual(['dep1', 'dep2']);
  });
});
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    MANAGER AGENT                            │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │Orchestrator │  │Dependency    │  │Agent Pool    │      │
│  │             │──│Graph         │──│              │      │
│  │- Execute    │  │- Resolve     │  │- Lifecycle   │      │
│  │- Rollback   │  │- Parallel    │  │- Rate Limit  │      │
│  └─────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌─────────────┐  ┌──────────────┐                         │
│  │Autonomous   │  │Change        │                         │
│  │Loop Mgr     │  │Detector      │                         │
│  │- Test-Fix   │  │- Git Watch   │                         │
│  │- Auto-Retry │  │- Impact      │                         │
│  └─────────────┘  └──────────────┘                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         │
                         │ Orchestrates
                         ↓
┌─────────────────────────────────────────────────────────────┐
│                    PLATFORM AGENTS                          │
│                                                             │
│  Document → Backend → Users/Drivers/Admin → Analyzer       │
│                                    ↓                        │
│                            Tester/Docker → GitHub           │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

The Manager Agent is the **orchestration heart** of the 10-agent system:

✅ **Dependency Resolution** - Topological sorting ensures correct execution order
✅ **Parallel Execution** - Run independent agents concurrently for speed
✅ **Autonomous Loops** - Self-healing through test-fix-verify cycles
✅ **Safety Features** - Rate limiting, cooldowns, and circular update prevention
✅ **EventBus Integration** - Publish/subscribe for loose coupling
✅ **Change Detection** - Incremental execution based on git changes

**Status**: Production-ready and fully operational.

---

**For more information**, see:
- [DEEP_AUDIT_REPORT.md](../DEEP_AUDIT_REPORT.md) - System-wide status
- [USAGE_GUIDE.md](../USAGE_GUIDE.md) - Complete agent system guide
- [AUTONOMOUS_LOOP_INTEGRATION.md](../AUTONOMOUS_LOOP_INTEGRATION.md) - Loop details
