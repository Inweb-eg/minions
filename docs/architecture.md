# Architecture Guide

Deep dive into the Minions framework architecture.

## Table of Contents

- [Design Principles](#design-principles)
- [Component Architecture](#component-architecture)
- [Phase 0: Foundation Enhancements](#phase-0-foundation-enhancements)
- [Phase 1: Vision Agent](#phase-1-vision-agent)
- [Phase 2: Architect Agent](#phase-2-architect-agent)
- [Phase 3: Planner Agent](#phase-3-planner-agent)
- [Specialized Agents Architecture](#specialized-agents-architecture)
- [Code Writer Agents Architecture](#code-writer-agents-architecture)
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
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Application Layer (Your Custom Agents)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Specialized Agents Layer                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  Tester  │ │  Docker  │ │  GitHub  │ │   Codebase   │ │   Document   │  │
│  │  Agent   │ │  Agent   │ │  Agent   │ │   Analyzer   │ │    Agent     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                       Orchestration & Management                             │
│         (Orchestrator, AutonomousLoopManager, AgentPool, DependencyGraph)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                           Skills & Analyzers                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │AutoFixer │ │  Code    │ │ Security │ │    Test      │ │  Dependency  │  │
│  │          │ │ Reviewer │ │ Scanner  │ │  Generator   │ │   Analyzer   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                     Foundation (Observability & Control)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ EventBus │ │ Metrics  │ │  Health  │ │   Alerting   │ │   Rollback   │  │
│  │ (80+ ev) │ │Collector │ │ Monitor  │ │    System    │ │   Manager    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
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

## Phase 0: Foundation Enhancements

Phase 0 adds persistence, advanced event handling, and state management to the foundation layer.

### Enhanced Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      Application Layer (Your Custom Agents)                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                  Strategic Planning Layer (Phase 1-3)                        │
│  ┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │    Vision    │  │     Architect    │  │           Planner            │  │
│  │    Agent     │→→│      Agent       │→→│            Agent             │  │
│  │ (Product)    │  │   (Technical)    │  │        (Execution)           │  │
│  └──────────────┘  └──────────────────┘  └──────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                        Specialized Agents Layer                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  Tester  │ │  Docker  │ │  GitHub  │ │   Codebase   │ │   Document   │  │
│  │  Agent   │ │  Agent   │ │  Agent   │ │   Analyzer   │ │    Agent     │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                       Orchestration & Management                             │
│         (Orchestrator, AutonomousLoopManager, AgentPool, DependencyGraph)   │
├─────────────────────────────────────────────────────────────────────────────┤
│                           Skills & Analyzers                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │AutoFixer │ │  Code    │ │ Security │ │    Test      │ │  Dependency  │  │
│  │          │ │ Reviewer │ │ Scanner  │ │  Generator   │ │   Analyzer   │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ └──────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                 Foundation + Phase 0 Enhancements                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │ EventBus │ │ Metrics  │ │  Health  │ │   Alerting   │ │   Rollback   │  │
│  │ (80+ ev) │ │Collector │ │ Monitor  │ │    System    │ │   Manager    │  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘ └──────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐                   │
│  │ Memory   │ │ Decision │ │ Enhanced │ │    State     │   ← Phase 0      │
│  │  Store   │ │  Logger  │ │ EventBus │ │   Machine    │                   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────┘                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### MemoryStore Architecture

Persistent key-value storage with SQLite backend.

```
┌─────────────────────────────────────────┐
│             MemoryStore                  │
├─────────────────────────────────────────┤
│ - db: better-sqlite3                    │
│ - dbPath: string                        │
│ - inMemoryFallback: Map                 │
├─────────────────────────────────────────┤
│ + initialize()                          │
│ + set(namespace, key, value, options)   │
│ + get(namespace, key)                   │
│ + getAll(namespace)                     │
│ + delete(namespace, key)                │
│ + clear(namespace)                      │
│ + query(namespace, filter)              │
└─────────────────────────────────────────┘

Namespaces:
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  PROJECT_STATE  │ │   AGENT_STATE   │ │    DECISIONS    │
└─────────────────┘ └─────────────────┘ └─────────────────┘
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ KNOWLEDGE_BASE  │ │    PATTERNS     │ │EXECUTION_HISTORY│
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### DecisionLogger Architecture

Captures agent decisions for learning and debugging.

```
┌─────────────────────────────────────────┐
│           DecisionLogger                 │
├─────────────────────────────────────────┤
│ - memoryStore: MemoryStore              │
│ - decisions: Map<id, Decision>          │
├─────────────────────────────────────────┤
│ + log(decision)                         │
│ + updateOutcome(id, outcome, details)   │
│ + query(filters)                        │
│ + getRelatedDecisions(id)               │
│ + getStatistics()                       │
└─────────────────────────────────────────┘

Decision Structure:
{
  id, agent, type, context, decision,
  reasoning, alternatives, confidence,
  outcome, timestamp, parentId
}
```

### EnhancedEventBus Architecture

Extended EventBus with priority queuing and request-response patterns.

```
┌─────────────────────────────────────────┐
│          EnhancedEventBus                │
├─────────────────────────────────────────┤
│ Extends AgentEventBus with:             │
│ - priorityQueue: PriorityQueue          │
│ - requestHandlers: Map                  │
│ - persistence: MemoryStore              │
├─────────────────────────────────────────┤
│ + publishWithPriority(type, data, pri)  │
│ + request(type, data, timeout)          │
│ + respond(requestId, data)              │
│ + broadcast(channel, data)              │
│ + subscribeToChannel(channel, handler)  │
└─────────────────────────────────────────┘

Priority Levels:
CRITICAL → HIGH → NORMAL → LOW → BACKGROUND
```

### StateMachine Architecture

Predictable state management for agents.

```
┌─────────────────────────────────────────┐
│           StateMachine                   │
├─────────────────────────────────────────┤
│ - currentState: string                  │
│ - previousState: string                 │
│ - context: object                       │
│ - history: Transition[]                 │
│ - transitions: Map<from, to[]>          │
│ - guards: Map<transition, GuardFn>      │
├─────────────────────────────────────────┤
│ + transition(newState, context)         │
│ + canTransition(newState)               │
│ + onEnter(state, handler)               │
│ + onExit(state, handler)                │
│ + onTransition(handler)                 │
│ + getHistory()                          │
│ + persist() / restore()                 │
└─────────────────────────────────────────┘

Standard States:
IDLE → PLANNING → EXECUTING → COMPLETED
                ↓
            WAITING/BLOCKED/ERROR → RECOVERING
```

---

## Phase 1: Vision Agent

Product owner agent that understands project goals.

### Vision Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VisionAgent                               │
├─────────────────────────────────────────────────────────────────┤
│  State: IDLE → PARSING → DECOMPOSING → ANALYZING → GENERATING   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │   ReadmeParser  │  │FeatureDecomposer│                       │
│  │                 │  │                 │                       │
│  │ - Parse README  │  │ - Epic → Story  │                       │
│  │ - Extract feats │  │ - Story → Task  │                       │
│  │ - Detect arch   │  │ - Complexity    │                       │
│  │ - Find implicit │  │ - Dependencies  │                       │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │ProductStateManager│ │AcceptanceGen   │                       │
│  │                 │  │                 │                       │
│  │ - Track planned │  │ - Given/When/   │                       │
│  │ - Track done    │  │   Then format   │                       │
│  │ - Progress %    │  │ - Scenarios     │                       │
│  │ - Priorities    │  │ - Test cases    │                       │
│  └─────────────────┘  └─────────────────┘                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Vision Agent Data Flow

```
README.md
    ↓ ReadmeParser.parse()
Requirements {
  features: Feature[],
  architecture: ArchInfo,
  techStack: string[],
  implicitRequirements: Requirement[]
}
    ↓ FeatureDecomposer.decompose()
Decomposition {
  epic: Epic,
  stories: Story[],
  tasks: Task[]
}
    ↓ ProductStateManager.track()
ProductState {
  planned: n,
  implemented: m,
  inProgress: k,
  coverage: m/n
}
    ↓ AcceptanceGenerator.generate()
AcceptanceCriteria {
  given, when, then,
  scenarios: Scenario[]
}
    ↓
Emit: REQUIREMENTS_READY event
```

---

## Phase 2: Architect Agent

Technical authority for architectural decisions.

### Architect Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      ArchitectAgent                              │
├─────────────────────────────────────────────────────────────────┤
│  State: IDLE → ANALYZING → DESIGNING → VALIDATING → ENFORCING   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │BlueprintGenerator│  │ApiContractManager│                     │
│  │                  │  │                  │                     │
│  │ - System layers  │  │ - OpenAPI specs  │                     │
│  │ - Components     │  │ - Endpoints      │                     │
│  │ - Data flow      │  │ - Validation     │                     │
│  │ - Patterns       │  │ - Versioning     │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │   TechSelector   │  │  DriftDetector   │                     │
│  │                  │  │                  │                     │
│  │ - Stack choices  │  │ - Pattern drift  │                     │
│  │ - Trade-offs     │  │ - Contract viola │                     │
│  │ - Reasoning      │  │ - Recommends     │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Architecture Decision Flow

```
REQUIREMENTS_READY event (from Vision Agent)
    ↓
ArchitectAgent.onRequirementsReady()
    ↓
TechSelector.selectStack(requirements)
    → { frontend, backend, database, reasoning }
    ↓
BlueprintGenerator.generate(requirements, techStack)
    → { layers, components, patterns, dataFlow }
    ↓
ApiContractManager.defineContracts(blueprint)
    → OpenAPI specs saved to contracts/
    ↓
Emit: BLUEPRINT_CREATED, TECH_STACK_SELECTED events
    ↓
DriftDetector monitors for violations
    → Emit: DRIFT_DETECTED when found
```

---

## Phase 3: Planner Agent

Execution engine that coordinates agent work.

### Planner Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       PlannerAgent                               │
├─────────────────────────────────────────────────────────────────┤
│  State: IDLE → PLANNING → EXECUTING → COORDINATING → ITERATING  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ ExecutionPlanner │  │ AgentCoordinator │                     │
│  │                  │  │                  │                     │
│  │ - Topological    │  │ - Task assign    │                     │
│  │   sort           │  │ - Status track   │                     │
│  │ - Parallel       │  │ - Retry logic    │                     │
│  │   groups         │  │ - Escalation     │                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐                     │
│  │ ProgressTracker  │  │IterationManager │                     │
│  │                  │  │                  │                     │
│  │ - Completion %   │  │ - Build phase   │                     │
│  │ - Velocity       │  │ - Test phase    │                     │
│  │ - ETA calc       │  │ - Fix phase     │                     │
│  │ - Blockers       │  │ - Max iterations│                     │
│  └──────────────────┘  └──────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Execution Flow

```
Vision Tasks + Architect Blueprint
    ↓
ExecutionPlanner.createPlan(tasks)
    → {
        phases: [
          { name: 'setup', tasks: [...], parallel: true },
          { name: 'implement', tasks: [...], parallel: false }
        ],
        dependencies,
        estimatedDuration
      }
    ↓
AgentCoordinator.execute(plan)
    ↓
For each phase:
    ├─→ Assign tasks to available agents
    ├─→ ProgressTracker.update()
    ├─→ Handle failures → retry/escalate
    └─→ Emit PROGRESS_UPDATED
    ↓
IterationManager.runCycle()
    ├─→ BUILD: Generate/update code
    ├─→ TEST: Run tests
    ├─→ FIX: If tests fail, iterate
    └─→ Repeat until pass or max iterations
    ↓
Emit: EXECUTION_COMPLETED or ESCALATION_REQUIRED
```

### Agent Coordination Strategies

```
┌─────────────────────────────────────────────────────────────────┐
│                  Assignment Strategies                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ROUND_ROBIN: Distribute tasks evenly                           │
│    Task 1 → Agent A                                              │
│    Task 2 → Agent B                                              │
│    Task 3 → Agent A                                              │
│                                                                  │
│  CAPABILITY_BASED: Match task type to agent specialty           │
│    Frontend task → Frontend Writer Agent                        │
│    Backend task → Backend Writer Agent                          │
│    Test task → Tester Agent                                      │
│                                                                  │
│  LOAD_BALANCED: Assign based on current agent load              │
│    Agent A (2 tasks) vs Agent B (0 tasks) → Assign to B         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Phase Dependencies

```
Phase 0 (Foundation)
    ↓ Provides persistence & state
Phase 1 (Vision Agent)
    ↓ Provides requirements & tasks
Phase 2 (Architect Agent)
    ↓ Provides blueprint & contracts
Phase 3 (Planner Agent)
    ↓ Coordinates execution
Specialized & Writer Agents
    ↓ Execute actual work
```

---

## Specialized Agents Architecture

The framework includes five pre-built specialized agents for common development workflows.

### TesterAgent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        TesterAgent                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Generators │  │   Runners   │  │       Analyzers         │ │
│  │             │  │             │  │                         │ │
│  │ - Backend   │  │ - Backend   │  │ - Coverage Analyzer     │ │
│  │ - React     │  │ - React     │  │ - Regression Detector   │ │
│  │ - Mock Gen  │  │ - Flutter   │  │ - Flaky Test Detector   │ │
│  │             │  │ - E2E       │  │ - Performance Analyzer  │ │
│  │             │  │             │  │ - Mutation Engine       │ │
│  └─────────────┘  └─────────────┘  │ - Quality Analyzer      │ │
│                                     └─────────────────────────┘ │
│  ┌─────────────────────┐  ┌───────────────────────────────────┐ │
│  │     Benchmarks      │  │          Reports                  │ │
│  │                     │  │                                   │ │
│  │ - Backend Benchmark │  │ - Test Report Generator           │ │
│  │ - Frontend Benchmark│  │ - Coverage Report Generator       │ │
│  │ - Load Test Runner  │  │ - Performance Report Generator    │ │
│  │ - Regression Detect │  │ - Bug Report Generator            │ │
│  │                     │  │ - Fix Suggestion Generator        │ │
│  └─────────────────────┘  └───────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- Multi-platform test execution (Backend, React, Flutter, E2E)
- Automated test generation with edge case identification
- Coverage analysis with gap detection
- Regression detection across test runs
- Flaky test identification and tracking
- Performance benchmarking with regression alerts
- Mutation testing for test quality validation

### DockerAgent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        DockerAgent                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │    Detectors    │  │    Builders     │  │   Validators    │ │
│  │                 │  │                 │  │                 │ │
│  │ - File Change   │  │ - Base Builder  │  │ - Dockerfile    │ │
│  │ - Config Change │  │ - Multi-stage   │  │ - Build         │ │
│  │ - Dependency    │  │   Support       │  │ - Compose       │ │
│  │   Change        │  │                 │  │ - Health        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
│                                                                  │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │       Optimizers        │  │         Monitors            │  │
│  │                         │  │                             │  │
│  │ - Size Optimizer        │  │ - Health Monitor            │  │
│  │ - Layer Analyzer        │  │ - Resource Monitor          │  │
│  │ - Vulnerability Scanner │  │                             │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- Change detection for Dockerfile, config, and dependencies
- Image building with multi-stage support
- Dockerfile and docker-compose validation
- Image size optimization recommendations
- Layer analysis for cache efficiency
- Vulnerability scanning
- Runtime health and resource monitoring

### GithubAgent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GithubAgent                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │      Branches       │  │           Reviews               │  │
│  │                     │  │                                 │  │
│  │ - Branch Manager    │  │ - Code Analyzer                 │  │
│  │ - PR Manager        │  │ - Review Commenter              │  │
│  │                     │  │ - Review Decision               │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │       Merges        │  │          Releases               │  │
│  │                     │  │                                 │  │
│  │ - Merge Manager     │  │ - Release Manager               │  │
│  │ - Issue Manager     │  │ - Analytics                     │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- Branch creation and management
- Pull request lifecycle management
- Automated code review with comments
- Merge conflict detection and resolution
- Issue tracking and management
- Release management with automated notes
- Repository analytics

### CodebaseAnalyzer Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CodebaseAnalyzer                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                       Analyzers                              ││
│  │                                                              ││
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ ││
│  │  │ Security Scanner │  │  Performance Analyzer            │ ││
│  │  │ (Codebase-wide)  │  │  (Cross-file analysis)           │ ││
│  │  └──────────────────┘  └──────────────────────────────────┘ ││
│  │                                                              ││
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐ ││
│  │  │ Dependency Mapper│  │  API Contract Validator          │ ││
│  │  │ (Graph analysis) │  │  (OpenAPI ↔ Code)                │ ││
│  │  └──────────────────┘  └──────────────────────────────────┘ ││
│  │                                                              ││
│  │  ┌──────────────────────────────────────────────────────┐   ││
│  │  │              Technical Debt Analyzer                  │   ││
│  │  │  (Complexity, duplication, maintainability scoring)   │   ││
│  │  └──────────────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- System-wide security vulnerability scanning
- Performance hotspot identification
- Dependency graph analysis with circular detection
- API contract validation against OpenAPI specs
- Technical debt measurement and tracking
- Maintainability scoring

### DocumentAgent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       DocumentAgent                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Code Parsers (Code → Docs)                  ││
│  │                                                              ││
│  │  - Backend Code Parser      - Breaking Change Detector       ││
│  │  - OpenAPI Updater          - Changelog Updater              ││
│  │  - Integration Docs Updater - Document Versioner             ││
│  │  - Impact Analyzer          - Conflict Detector              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                  Docs Parsers (Docs → Code)                  ││
│  │                                                              ││
│  │  - API Parser               - React Parser                   ││
│  │  - Architecture Parser      - Flutter Parser                 ││
│  │  - Feature Parser                                            ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────────────┐  ┌────────────────────────────────┐  │
│  │   Digest Generators  │  │         Validators             │  │
│  │                      │  │                                │  │
│  │  - Backend Digest    │  │  - Document Validator          │  │
│  │  - Admin Digest      │  │  - Digest Validator            │  │
│  │  - User Digest       │  │                                │  │
│  │  - Driver Digest     │  │                                │  │
│  └──────────────────────┘  └────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    DocumentCache                             ││
│  │            (Incremental parsing with caching)                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- Bidirectional code-documentation synchronization
- Code → Docs: Extract documentation from code
- Docs → Code: Generate platform-specific digests
- OpenAPI specification synchronization
- CHANGELOG automation from git history
- Breaking change detection
- Document versioning and conflict resolution
- Incremental parsing with intelligent caching

---

## Code Writer Agents Architecture

The framework includes three specialized code generation agents that extend the BaseWriterSkill class.

### BaseWriterSkill

Base class for all code generation skills, extending BaseSkill with additional capabilities:

```
┌─────────────────────────────────────────────────────────────────┐
│                      BaseWriterSkill                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Extends BaseSkill with:                                        │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Template Engine    │  │    File Operations              │  │
│  │                     │  │                                 │  │
│  │  - loadTemplate()   │  │  - writeFile()                  │  │
│  │  - renderTemplate() │  │  - readFile()                   │  │
│  │  - interpolation    │  │  - ensureDir()                  │  │
│  │                     │  │  - dryRun mode                  │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Code Formatting    │  │    Spec Validation              │  │
│  │                     │  │                                 │  │
│  │  - formatCode()     │  │  - validateSpec()               │  │
│  │  - Dart, JS, TS     │  │  - Schema validation            │  │
│  │  - JSON, YAML       │  │  - Required field checks        │  │
│  └─────────────────────┘  └─────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### FlutterWriterAgent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FlutterWriterAgent                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Configuration:                                                  │
│  - projectPath: Flutter project root                            │
│  - stateManagement: 'bloc' | 'provider' | 'riverpod'           │
│  - apiClient: 'dio'                                             │
│  - useFreezed: true/false                                       │
│  - l10nEnabled: true/false                                      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                         Skills                               ││
│  │                                                              ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ ││
│  │  │WidgetGenerator │  │ ModelGenerator │  │ServiceGenerator││
│  │  │                │  │                │  │               │ ││
│  │  │ - Stateless    │  │ - Freezed      │  │ - Dio-based   │ ││
│  │  │ - Stateful     │  │ - JsonSerial.  │  │ - REST APIs   │ ││
│  │  │ - Custom props │  │ - Nullable     │  │ - Error hand. │ ││
│  │  └────────────────┘  └────────────────┘  └───────────────┘ ││
│  │                                                              ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ ││
│  │  │  BlocGenerator │  │ PageGenerator  │  │LocalizationGen││
│  │  │                │  │                │  │               │ ││
│  │  │ - Bloc/Cubit   │  │ - Scaffold     │  │ - ARB files   │ ││
│  │  │ - Events       │  │ - AppBar       │  │ - Plurals     │ ││
│  │  │ - States       │  │ - Navigation   │  │ - Parameters  │ ││
│  │  └────────────────┘  └────────────────┘  └───────────────┘ ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Output Directory Structure:                                     │
│  lib/                                                           │
│  ├── models/          # Generated models (Freezed)              │
│  ├── services/        # API services (Dio)                      │
│  ├── bloc/            # Bloc/Cubit state management             │
│  ├── pages/           # Page widgets                            │
│  ├── widgets/         # Reusable widgets                        │
│  └── l10n/            # ARB localization files                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- Flutter widget generation (Stateless/Stateful)
- Freezed data models with JSON serialization
- Dio-based API service generation
- Bloc/Cubit state management boilerplate
- Page scaffolding with navigation
- ARB localization file generation

### BackendWriterAgent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    BackendWriterAgent                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Configuration:                                                  │
│  - projectPath: Backend project root                            │
│  - framework: 'express'                                         │
│  - orm: 'mongoose' | 'sequelize'                                │
│  - validator: 'joi' | 'zod'                                     │
│  - useRepositoryPattern: true/false                             │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                         Skills                               ││
│  │                                                              ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ ││
│  │  │ RouteGenerator │  │ ModelGenerator │  │ServiceGenerator││
│  │  │                │  │                │  │               │ ││
│  │  │ - Express      │  │ - Mongoose     │  │ - CRUD ops    │ ││
│  │  │ - REST/CRUD    │  │ - Sequelize    │  │ - Repository  │ ││
│  │  │ - Middleware   │  │ - Schemas      │  │ - Transactions│ ││
│  │  └────────────────┘  └────────────────┘  └───────────────┘ ││
│  │                                                              ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ ││
│  │  │MiddlewareGen   │  │ValidatorGen    │  │ControllerGen  ││
│  │  │                │  │                │  │               │ ││
│  │  │ - Auth (JWT)   │  │ - Joi schemas  │  │ - REST        │ ││
│  │  │ - Rate limit   │  │ - Zod schemas  │  │ - Error hand. │ ││
│  │  │ - Error hand.  │  │ - Custom rules │  │ - Response    │ ││
│  │  └────────────────┘  └────────────────┘  └───────────────┘ ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Output Directory Structure:                                     │
│  src/                                                           │
│  ├── routes/          # Express route files                     │
│  ├── models/          # Mongoose/Sequelize models               │
│  ├── services/        # Business logic layer                    │
│  ├── middleware/      # Express middleware                      │
│  ├── validators/      # Joi/Zod validation schemas              │
│  └── controllers/     # Request handlers                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- Express route generation with middleware
- Mongoose/Sequelize model generation
- Service layer with repository pattern
- JWT authentication middleware
- Joi/Zod validation schemas
- Controller generation with error handling

### FrontendWriterAgent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   FrontendWriterAgent                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Configuration:                                                  │
│  - projectPath: Frontend project root                           │
│  - framework: 'react' | 'nextjs'                                │
│  - stateManagement: 'context' | 'zustand' | 'redux'             │
│  - apiClient: 'react-query' | 'swr' | 'axios'                   │
│  - cssFramework: 'tailwind' | 'styled-components'               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                         Skills                               ││
│  │                                                              ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ ││
│  │  │ComponentGen    │  │  HookGenerator │  │ StoreGenerator││
│  │  │                │  │                │  │               │ ││
│  │  │ - Functional   │  │ - useState     │  │ - Context     │ ││
│  │  │ - TypeScript   │  │ - useQuery     │  │ - Zustand     │ ││
│  │  │ - Props/Memo   │  │ - useMutation  │  │ - Redux       │ ││
│  │  └────────────────┘  └────────────────┘  └───────────────┘ ││
│  │                                                              ││
│  │  ┌────────────────┐  ┌────────────────┐  ┌───────────────┐ ││
│  │  │ FormGenerator  │  │  ApiGenerator  │  │ PageGenerator ││
│  │  │                │  │                │  │               │ ││
│  │  │ - React Hook   │  │ - React Query  │  │ - List/Detail │ ││
│  │  │   Form         │  │ - SWR          │  │ - Dashboard   │ ││
│  │  │ - Validation   │  │ - Type-safe    │  │ - Layouts     │ ││
│  │  └────────────────┘  └────────────────┘  └───────────────┘ ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Output Directory Structure:                                     │
│  src/                                                           │
│  ├── components/      # React components                        │
│  ├── hooks/           # Custom hooks                            │
│  ├── stores/          # State management                        │
│  │   └── contexts/    # React Context providers                 │
│  ├── forms/           # Form components                         │
│  ├── api/             # API integration hooks                   │
│  └── pages/           # Page components                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- React functional component generation
- TypeScript interfaces and type safety
- Custom hook generation (state, query, mutation)
- Context/Zustand/Redux store generation
- React Hook Form integration
- React Query/SWR API hooks
- Page components with layouts

### Code Generation Data Flow

```
1. Agent Configuration
   ↓
   flutter.configure({ projectPath: './app', stateManagement: 'bloc' })

2. Generation Request
   ↓
   flutter.generateWidget({ name: 'UserCard', type: 'stateless', ... })

3. Skill Invocation
   ↓
   WidgetGenerator.generate(spec)
   ├─→ validateSpec(spec)        # Validate input
   ├─→ loadTemplate('stateless') # Load appropriate template
   ├─→ renderTemplate(data)      # Interpolate values
   └─→ formatCode(code, 'dart')  # Format output

4. File Output
   ↓
   writeFile(filePath, code, { dryRun: false })

5. Event Publishing
   ↓
   eventBus.publish(EventTypes.FLUTTER_WIDGET_GENERATED, {
     agent: 'flutter-writer-agent',
     filePath,
     spec
   })
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
