# Minions Component Index

Quick reference guide to all components in the Minions framework.

## Table of Contents

- [Foundation Layer](#foundation-layer)
- [Manager Agent](#manager-agent)
- [Specialized Agents](#specialized-agents)
- [Skills](#skills)
- [Event Types](#event-types)

---

## Foundation Layer

Core infrastructure components that power the framework.

### Event System

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **AgentEventBus** | `foundation/event-bus/AgentEventBus.js` | `getEventBus()` | Central pub/sub for all agent communication |
| **EventTypes** | `foundation/event-bus/eventTypes.js` | - | Centralized event type constants |

**Key Methods:**
```javascript
eventBus.publish(eventType, data)
eventBus.subscribe(eventType, subscriberName, callback) // Returns unsubscribe fn
eventBus.subscribeToAll(subscriberName, callback)
eventBus.getHistory({ eventType, since, limit })
```

### Observability

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **MetricsCollector** | `foundation/metrics-collector/MetricsCollector.js` | `getMetricsCollector()` | Agent execution metrics |
| **HealthMonitor** | `foundation/health-monitor/HealthMonitor.js` | `getHealthMonitor()` | Agent health tracking |
| **AlertingSystem** | `foundation/alerting/AlertingSystem.js` | `getAlertingSystem()` | Threshold-based alerts |

**Key Methods:**
```javascript
metricsCollector.recordExecution(agentName, success, duration)
metricsCollector.getAgentMetrics(agentName)
healthMonitor.getHealthSummary()
healthMonitor.getUnhealthyAgents()
alertingSystem.registerHandler(name, handler)
```

### Persistence

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **MemoryStore** | `foundation/memory-store/MemoryStore.js` | `getMemoryStore()` | Key-value persistence (SQLite) |
| **DecisionLogger** | `foundation/memory-store/DecisionLogger.js` | `getDecisionLogger()` | Agent decision audit trail |
| **RollbackManager** | `foundation/rollback-manager/RollbackManager.js` | `getRollbackManager()` | Checkpoint/rollback for recovery |

**Namespaces:**
```javascript
MemoryNamespace = {
  PROJECT_STATE, AGENT_STATE, DECISIONS, KNOWLEDGE_BASE,
  PATTERNS, EXECUTION_HISTORY, CONFIG
}
```

### State Management

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **StateMachine** | `foundation/state-machine/StateMachine.js` | `getStateMachine(name)` | Agent state management |

**Agent States:**
```javascript
AgentState = {
  IDLE, PLANNING, EXECUTING, WAITING, BLOCKED, ERROR, RECOVERING, COMPLETED
}
```

### Analysis

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **ASTParser** | `foundation/parsers/ASTParser.js` | `getASTParser()` | JavaScript/TypeScript parsing |
| **BaseAnalyzer** | `foundation/analyzers/BaseAnalyzer.js` | - | Abstract analyzer base class |

### Resilience

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **RateLimiter** | `foundation/resilience/RateLimiter.js` | `getRateLimiter()` | Token bucket rate limiting |
| **CircuitBreaker** | `foundation/resilience/CircuitBreaker.js` | `getCircuitBreaker(name)` | Circuit breaker pattern |
| **CircuitBreakerRegistry** | `foundation/resilience/CircuitBreaker.js` | `getCircuitBreakerRegistry()` | Manages multiple circuit breakers |

**Key Methods:**
```javascript
// Rate Limiter
rateLimiter.check(key, tokens)    // Returns { allowed, remaining, retryAfter }
rateLimiter.acquire(key, tokens, maxWait)  // Async, waits if needed
rateLimiter.configure(key, { limit, window })
rateLimiter.getMetrics()

// Circuit Breaker
circuitBreaker.execute(fn, fallback)  // Executes with circuit protection
circuitBreaker.getStatus()
circuitBreaker.forceState(state)  // CLOSED, OPEN, HALF_OPEN
```

### Advanced Persistence

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **StatePersistence** | `foundation/persistence/StatePersistence.js` | `getStatePersistence()` | Auto-save, snapshots, recovery |

**Key Methods:**
```javascript
statePersistence.registerStateHandler(name, { save, restore })
statePersistence.saveState(namespace, key, value)
statePersistence.restoreState(namespace, key)
statePersistence.createSnapshot(name)
statePersistence.restoreFromSnapshot(filename)
```

### Authentication

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **AuthManager** | `foundation/auth/AuthManager.js` | `getAuthManager()` | API keys, sessions, JWT |

**Key Methods:**
```javascript
authManager.generateApiKey(name, permissions)
authManager.createSession(userId, permissions)
authManager.generateToken(payload, expiresIn)
authManager.authenticate(credentials)
authManager.middleware({ requiredLevel })  // Express middleware
```

### Utilities

| Component | File | Purpose |
|-----------|------|---------|
| **logger** | `foundation/common/logger.js` | Pino-based structured logging |

```javascript
import { createLogger } from './foundation/common/logger.js';
const logger = createLogger('ComponentName');
```

---

## Manager Agent

Orchestration and coordination components.

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **Orchestrator** | `agents/manager-agent/orchestrator.js` | `getOrchestrator()` | Agent execution coordinator |
| **DependencyGraph** | `agents/manager-agent/dependency-graph.js` | `getDependencyGraph()` | Agent dependency resolution |
| **AgentPool** | `agents/manager-agent/agent-pool.js` | `getAgentPool()` | Agent lifecycle management |
| **AutonomousLoopManager** | `agents/manager-agent/autonomous-loop-manager.js` | `getAutonomousLoopManager()` | Test-fix cycles |
| **AutonomousBuildManager** | `agents/manager-agent/autonomous-build-manager.js` | `getAutonomousBuildManager()` | Feature build orchestration |
| **ChangeDetector** | `agents/manager-agent/change-detector.js` | `getChangeDetector()` | Git monitoring & impact analysis |

**Key Orchestrator Methods:**
```javascript
orchestrator.registerAgent(name, loaderFn, dependencies)
orchestrator.registerValidationAgent(agent)
orchestrator.execute(changedFiles)
orchestrator.buildExecutionPlan(changedFiles)
orchestrator.getStatus()
```

**Autonomous Loop Config:**
- `maxIterations: 5` - Maximum fix attempts
- Two-tier fix strategy: AutoFixer (patterns) → Platform Agents (domain-specific)

---

## Specialized Agents

### Client Interface System

| Agent | Character | Location | Purpose |
|-------|-----------|----------|---------|
| **GruAgent** | Gru | `agents/gru-agent/` | Web interface coordinator |
| **NefarioAgent** | Dr. Nefario | `agents/nefario-agent/` | Plan generation |
| **ProjectManagerAgent** | Silas | `agents/project-manager-agent/` | Project registry & scanning |
| **ProjectCompletionAgent** | Lucy | `agents/project-completion-agent/` | Gap detection & completion loops |
| **SecurityRiskAgent** | Tom | `agents/security-risk-agent/` | Security & risk management |
| **DatabaseAgent** | Dave | `agents/database-agent/` | Schema design & migrations |
| **PerformanceAgent** | Kevin | `agents/performance-agent/` | Profiling & benchmarking |

### Strategic Planning

| Agent | Location | Purpose |
|-------|----------|---------|
| **VisionAgent** | `agents/vision-agent/` | README parsing, feature decomposition |
| **PlannerAgent** | `agents/planner-agent/` | Execution planning & coordination |

### Gru Agent Components

| Component | Singleton | Purpose |
|-----------|-----------|---------|
| `WebServer.js` | - | HTTP/WebSocket server (port 2505) |
| `ConversationEngine.js` | - | AI-powered conversation (general + project) |
| `ConversationStore.js` | `getConversationStore()` | Conversation history persistence with CRUD |
| `ProjectIntake.js` | - | New/existing project workflow, Docker project discovery |
| `StatusTracker.js` | - | Real-time execution status |
| `OllamaAdapter.js` | - | AI provider (Ollama/Gemini) |

**Key Methods:**
```javascript
// ConversationStore (singleton)
const store = getConversationStore(config);
await store.initialize();
await store.create({ projectName, title });
store.get(id);
store.getAll({ projectName, limit });
store.getGroupedByProject();
await store.update(id, updates);
await store.addMessage(id, { role, content });
await store.delete(id);

// GruAgent (singleton)
const gru = getGruAgent(config);
gru.setLearningSystem(knowledgeBrain);
await gru.start();
```

**API Endpoints:**
- `/api/conversations` - CRUD for conversation history
- `/api/conversations/grouped` - Conversations grouped by project
- `/api/projects/discover` - Discover projects in Docker mount
- `/evolve` - Learning Control Center dashboard

**Learning System API (Read):**
- `GET /api/learning/stats` - Learning statistics
- `GET /api/learning/skills` - List learned skills
- `GET /api/learning/policy` - RL policy Q-values
- `GET /api/learning/patterns` - Detected patterns
- `GET /api/learning/teaching` - Teaching sessions
- `GET /api/learning/tests` - A/B test results
- `GET /api/learning/events` - Learning event log
- `GET /api/learning/plans` - Learning plans

**Learning Control API (Write):**
- `POST /api/learning/rl/exploration` - Set exploration rate (0-1)
- `POST /api/learning/rl/reset` - Reset RL policy
- `POST /api/learning/skills/generate` - Generate skill from pattern
- `POST /api/learning/skills/:id/approve` - Approve canary skill
- `POST /api/learning/skills/:id/reject` - Reject canary skill
- `POST /api/learning/skills/:id/toggle` - Enable/disable skill
- `POST /api/learning/tests/start` - Start A/B test
- `POST /api/learning/tests/:id/cancel` - Cancel A/B test
- `POST /api/learning/teaching/start` - Start teaching session
- `POST /api/learning/teaching/:id/validate` - Validate session
- `POST /api/learning/mastery` - Update mastery level
- `POST /api/learning/plans` - Create learning plan
- `PUT /api/learning/plans/:id` - Update learning plan
- `DELETE /api/learning/plans/:id` - Delete learning plan
- `POST /api/learning/plans/:id/execute` - Execute learning plan

### Silas Components

| Component | Purpose |
|-----------|---------|
| `ProjectRegistry.js` | Project persistence (`.registry.json`) |
| `ProjectScanner.js` | Framework/language detection |
| `ProjectInitializer.js` | Workspace folder creation |

### Lucy Components

| Component | Purpose |
|-----------|---------|
| `GapDetector.js` | Missing component detection |
| `CompletionTracker.js` | Progress measurement |
| `ContinuousLoop.js` | Loop execution control |

### Tom Components

| Component | Purpose |
|-----------|---------|
| `ThreatModeler.js` | STRIDE threat modeling |
| `RiskTracker.js` | Risk register management |
| `AuditLogger.js` | Security audit trail |
| `OpsValidator.js` | Deployment validation |

### Dave Components

| Component | Purpose |
|-----------|---------|
| `SchemaDesigner.js` | Schema design, validation, export (SQL/Prisma/TypeORM) |
| `MigrationManager.js` | Migration creation, execution, rollback |
| `QueryAnalyzer.js` | Query optimization, index suggestions |
| `RelationshipMapper.js` | Relationship mapping, ERD generation |

**Key Methods:**
```javascript
databaseAgent.designSchema(requirements)
databaseAgent.createMigration(options)
databaseAgent.runMigrations()
databaseAgent.analyzeQuery(query)
databaseAgent.mapRelationships()
databaseAgent.exportSchema('prisma')
```

### Kevin Components

| Component | Purpose |
|-----------|---------|
| `Profiler.js` | CPU profiling, hotspot detection |
| `BenchmarkRunner.js` | Benchmark execution, regression detection |
| `MemoryAnalyzer.js` | Memory analysis, leak detection |
| `LoadTester.js` | Load testing, throughput measurement |

**Key Methods:**
```javascript
performanceAgent.profile(options)
performanceAgent.runBenchmarks()
performanceAgent.analyzeMemory()
performanceAgent.runLoadTest({ concurrency: 10, duration: 10000 })
performanceAgent.detectBottlenecks()
performanceAgent.setThresholds({ cpu: 80, memory: 85, responseTime: 2000 })
```

---

## Skills

Reusable capabilities for agents.

### Analysis Skills

| Skill | Singleton | Purpose |
|-------|-----------|---------|
| **CodeReviewer** | `getCodeReviewer()` | Quality, security, performance checks |
| **SecurityScanner** | `getSecurityScanner()` / `getFileSecurityScanner()` | Vulnerability scanning |
| **DependencyAnalyzer** | `getDependencyAnalyzer()` | Dependency analysis |
| **TestGenerator** | `getTestGenerator()` | Unit test generation |

### Fix Skills

| Skill | Singleton | Purpose |
|-------|-----------|---------|
| **AutoFixer** | `getAutoFixer()` | Pattern-based test failure fixes |

### Writer Skills (Code Generation)

**Flutter:**
| Skill | Purpose |
|-------|---------|
| `getWidgetGenerator()` | Stateless/Stateful widgets |
| `getBlocGenerator()` | Bloc/Cubit state management |
| `getFlutterModelGenerator()` | Freezed data models |
| `getFlutterServiceGenerator()` | Dio API services |
| `getFlutterPageGenerator()` | Scaffold pages |
| `getLocalizationGenerator()` | ARB localization |

**Backend:**
| Skill | Purpose |
|-------|---------|
| `getRouteGenerator()` | Express routes |
| `getBackendModelGenerator()` | Mongoose/Sequelize models |
| `getBackendServiceGenerator()` | Service layer |
| `getMiddlewareGenerator()` | Auth, validation middleware |
| `getValidatorGenerator()` | Joi/Zod schemas |
| `getControllerGenerator()` | REST controllers |

**Frontend:**
| Skill | Purpose |
|-------|---------|
| `getComponentGenerator()` | React functional components |
| `getHookGenerator()` | Custom React hooks |
| `getStoreGenerator()` | Context/Zustand/Redux stores |
| `getFormGenerator()` | React Hook Form components |
| `getApiGenerator()` | React Query/SWR hooks |
| `getFrontendPageGenerator()` | Page components |

---

## Event Types

### Agent Lifecycle
```javascript
AgentEvents = {
  AGENT_STARTED, AGENT_COMPLETED, AGENT_FAILED, AGENT_PAUSED, AGENT_RESUMED
}
```

### Testing
```javascript
TestEvents = {
  TESTS_STARTED, TESTS_COMPLETED, TESTS_FAILED
}
```

### Code Operations
```javascript
CodeEvents = {
  CODE_GENERATED, CODE_REVIEWED, AUTO_FIX_REQUESTED, FIX_COMPLETED
}
```

### Project Management (Silas)
```javascript
ProjectManagerEvents = {
  PROJECT_CONNECT, PROJECT_CONNECTED, PROJECT_DISCONNECT, PROJECT_DISCONNECTED,
  PROJECT_SCAN, PROJECT_SCANNED, PROJECT_SYNC, PROJECT_SYNCED, PROJECT_ERROR
}
```

### Completion (Lucy)
```javascript
CompletionEvents = {
  COMPLETION_START, COMPLETION_STARTED, COMPLETION_PAUSE, COMPLETION_PAUSED,
  COMPLETION_RESUME, COMPLETION_RESUMED, COMPLETION_STOP, COMPLETION_FINISHED,
  ITERATION_STARTED, ITERATION_COMPLETED, GAP_DETECTED, GAP_RESOLVED,
  PROGRESS_UPDATED, COMPLETION_ERROR
}
```

### Security (Tom)
```javascript
SecurityEvents = {
  SCAN_STARTED, SCAN_COMPLETED, VULNERABILITY_FOUND, SECRET_DETECTED,
  RISK_IDENTIFIED, RISK_MITIGATED, RISK_UPDATED, RISK_ESCALATED,
  THREAT_ADDED, THREAT_UPDATED, THREAT_MITIGATED,
  VALIDATION_STARTED, VALIDATION_PASSED, VALIDATION_FAILED,
  AUDIT_ENTRY, AUDIT_ALERT, OPS_VALIDATED, OPS_ISSUE_FOUND, SECURITY_ERROR
}
```

### Client Interface (Gru)
```javascript
GruEvents = {
  GRU_START, GRU_STARTED, CLIENT_CONNECTED, CONVERSATION_STARTED,
  CONVERSATION_MESSAGE, PROJECT_NEW, PROJECT_EXISTING, SCAN_COMPLETE,
  PLAN_READY, PLAN_APPROVED, EXECUTION_STARTED, EXECUTION_PAUSED,
  EXECUTION_RESUMED, EXECUTION_STOPPED, STATUS_UPDATE, GRU_ERROR
}
```

### Planning
```javascript
PlannerEvents = {
  PLAN_GENERATED, PLAN_APPROVED, PLAN_REJECTED, ARCHITECTURE_UPDATED
}
```

### System
```javascript
SystemEvents = {
  ERROR_OCCURRED, SHUTDOWN_REQUESTED, HEALTH_CHECK, METRICS_COLLECTED
}
```

### Database (Dave)
```javascript
DatabaseEvents = {
  SCHEMA_DESIGNED, SCHEMA_VALIDATED, SCHEMA_UPDATED,
  MIGRATION_CREATED, MIGRATION_STARTED, MIGRATION_COMPLETED,
  MIGRATION_FAILED, MIGRATION_ROLLED_BACK,
  QUERY_OPTIMIZED, QUERY_ANALYZED, SLOW_QUERY_DETECTED,
  RELATIONSHIP_MAPPED, RELATIONSHIP_VALIDATED, DATABASE_ERROR
}
```

### Performance (Kevin)
```javascript
PerformanceEvents = {
  PROFILE_STARTED, PROFILE_COMPLETED, HOTSPOT_DETECTED,
  BENCHMARK_STARTED, BENCHMARK_COMPLETED, BENCHMARK_FAILED, REGRESSION_DETECTED,
  MEMORY_ANALYZED, MEMORY_LEAK_DETECTED, MEMORY_THRESHOLD_EXCEEDED,
  BOTTLENECK_DETECTED, BOTTLENECK_RESOLVED,
  LOAD_TEST_STARTED, LOAD_TEST_COMPLETED, THRESHOLD_EXCEEDED,
  PERFORMANCE_ERROR
}
```

### Infrastructure
```javascript
InfrastructureEvents = {
  RATE_LIMIT_EXCEEDED, RATE_LIMIT_WARNING,
  CIRCUIT_OPENED, CIRCUIT_CLOSED, CIRCUIT_HALF_OPEN,
  STATE_PERSISTED, STATE_RESTORED, STATE_CORRUPTED,
  AUTH_SUCCESS, AUTH_FAILED, TOKEN_EXPIRED, TOKEN_REFRESHED
}
```

---

## Quick Start

### Initialize Framework
```javascript
import { initializeMinions } from './index.js';

const { orchestrator, eventBus, metricsCollector } = await initializeMinions({
  enableMetrics: true,
  enableHealth: true,
  enableAlerting: true,
  maxConcurrency: 5
});
```

### Register and Execute Agents
```javascript
orchestrator.registerAgent('my-agent', async () => myAgentInstance, ['dependency']);
const result = await orchestrator.execute();
```

### Start Gru Web Interface
```bash
node index.js --gru
# Open http://localhost:2505
```

---

## File Structure

```
minions/
├── foundation/           # Core infrastructure
│   ├── event-bus/        # Pub/sub system
│   ├── metrics-collector/
│   ├── health-monitor/
│   ├── alerting/
│   ├── rollback-manager/
│   ├── memory-store/     # Persistence + decisions
│   ├── persistence/      # Advanced state persistence
│   ├── resilience/       # Rate limiting, circuit breaker
│   ├── auth/             # Authentication system
│   ├── state-machine/
│   ├── parsers/          # AST parsing
│   ├── analyzers/        # Base analyzer
│   └── common/           # Logger
├── agents/
│   ├── manager-agent/    # Orchestration
│   ├── gru-agent/        # Web interface
│   ├── nefario-agent/    # Planning
│   ├── project-manager-agent/  # Silas
│   ├── project-completion-agent/ # Lucy
│   ├── security-risk-agent/    # Tom
│   ├── database-agent/   # Dave - Database operations
│   ├── performance-agent/# Kevin - Performance analysis
│   ├── vision-agent/     # Product owner
│   ├── planner-agent/    # Execution engine
│   └── skills/           # Reusable capabilities
├── docs/                 # Documentation
├── templates/            # Code generation templates
└── index.js              # Main entry point
```

---

## Related Documentation

- [Getting Started](./getting-started.md) - Setup and first steps
- [Architecture Guide](./architecture.md) - Deep dive into internals
- [API Reference](./api-reference.md) - Complete API documentation
- [Creating Agents](./creating-agents.md) - Agent development patterns
- [Skills Guide](./skills-guide.md) - Using and creating skills
- [Gru Guide](./gru-guide.md) - Web interface usage
