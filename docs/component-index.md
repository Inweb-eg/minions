# Minions Component Index

Quick reference guide to all components in the Minions framework.

## Table of Contents

- [Foundation Layer](#foundation-layer)
- [Learning & Evolution Layer](#learning--evolution-layer)
- [Manager Agent](#manager-agent)
- [Specialized Agents](#specialized-agents)
- [Skills](#skills)
- [Event Types](#event-types)
- [Quick Start](#quick-start)
- [File Structure](#file-structure)

---

## Foundation Layer

Core infrastructure components that power the framework.

### Event System

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **AgentEventBus** | `foundation/event-bus/AgentEventBus.js` | `getEventBus()` | Central pub/sub for all agent communication |
| **EventTypes** | `foundation/event-bus/eventTypes.js` | - | Centralized event type constants (80+ events) |

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

**Key Methods:**
```javascript
memoryStore.set(namespace, key, value, { ttl })
memoryStore.get(namespace, key)
memoryStore.addKnowledge(category, topic, content, options)
memoryStore.queryKnowledge(query)
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

**Key Methods:**
```javascript
stateMachine.transition(toState, options)
stateMachine.canTransitionTo(toState)
stateMachine.onEnter(state, handler)
stateMachine.onExit(state, handler)
stateMachine.error(error, options)
stateMachine.recover(targetState, options)
```

### Analysis

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **ASTParser** | `foundation/parsers/ASTParser.js` | `getASTParser()` | JavaScript/TypeScript parsing (Babel) |
| **BaseAnalyzer** | `foundation/analyzers/BaseAnalyzer.js` | - | Abstract analyzer base class |

### Resilience

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **RateLimiter** | `foundation/resilience/RateLimiter.js` | `getRateLimiter()` | Token bucket rate limiting |
| **CircuitBreaker** | `foundation/resilience/CircuitBreaker.js` | `getCircuitBreaker(name)` | Circuit breaker pattern |
| **CircuitBreakerRegistry** | `foundation/resilience/CircuitBreaker.js` | `getCircuitBreakerRegistry()` | Manages multiple circuit breakers |

**Circuit Breaker States:**
```javascript
CircuitState = { CLOSED, OPEN, HALF_OPEN }
```

**Key Methods:**
```javascript
// Rate Limiter
rateLimiter.check(key, tokens)    // Returns { allowed, remaining, retryAfter }
rateLimiter.acquire(key, tokens, maxWait)  // Async, waits if needed
rateLimiter.configure(key, { limit, window })

// Circuit Breaker
circuitBreaker.execute(fn, fallback)  // Executes with circuit protection
circuitBreaker.getStatus()
circuitBreaker.forceState(state)
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
logger.info('Message');
logger.debug('Debug info', { context });
logger.error('Error occurred', error);
```

---

## Learning & Evolution Layer

Components for autonomous learning, skill generation, and cross-agent knowledge sharing.

### Core Learning Components

| Component | File | Singleton | Purpose |
|-----------|------|-----------|---------|
| **ReinforcementLearner** | `foundation/learning/ReinforcementLearner.js` | `getReinforcementLearner()` | Q-learning with Thompson sampling |
| **DynamicSkillGenerator** | `foundation/learning/DynamicSkillGenerator.js` | `getDynamicSkillGenerator()` | LLM-based skill synthesis from patterns |
| **KnowledgeBrain** | `foundation/knowledge-brain/KnowledgeBrain.js` | `getKnowledgeBrain()` | Distributed collective intelligence |
| **CrossAgentTeacher** | `foundation/learning/CrossAgentTeacher.js` | `getCrossAgentTeacher()` | Inter-agent skill transfer |

### ReinforcementLearner

**Configuration:**
```javascript
{
  learningRate: 0.1,        // Alpha
  discountFactor: 0.95,     // Gamma
  explorationRate: 0.2,     // Epsilon
  explorationDecay: 0.995,
  minExploration: 0.05
}
```

**Reward Signals:**
```javascript
RewardSignal = {
  SUCCESS: 1.0,
  PARTIAL_SUCCESS: 0.5,
  FAILURE: -0.5,
  TIMEOUT: -0.3,
  USER_POSITIVE: 0.8,
  QUALITY_BONUS: 0.3
}
```

**Key Methods:**
```javascript
learner.selectAction(state)              // Epsilon-greedy action selection
learner.recordExperience({ state, action, reward, nextState })
learner.updateQValue(state, action, reward, nextState)
learner.getPolicy()                       // Get Q-table
learner.savePolicy()                      // Persist to KnowledgeBrain
learner.loadPolicy()                      // Load from KnowledgeBrain
```

### DynamicSkillGenerator

**Key Methods:**
```javascript
skillGen.generateSkill({ pattern, examples })  // Generate from pattern
skillGen.deployCanary(skillId)                 // Deploy to subset
skillGen.approveSkill(skillId)                 // Promote to production
skillGen.rejectSkill(skillId)                  // Remove canary
skillGen.listSkills()                          // Get all generated skills
```

**Skill Lifecycle:**
```
Pattern Detected → Skill Generated → Canary Deploy → A/B Test → Approved/Rejected
```

### KnowledgeBrain

**Knowledge Types:**
```javascript
KnowledgeType = {
  CODE_PATTERN, BUG_FIX, ARCHITECTURE, BEST_PRACTICE,
  ERROR_SOLUTION, PERFORMANCE_TIP, SECURITY_PATTERN,
  TEST_PATTERN, API_PATTERN, DOCUMENTATION,
  LEARNED_SKILL, RL_POLICY, EXPERIENCE,
  SKILL_TEST_RESULT, TEACHING_CURRICULUM, MASTERY_RECORD
}
```

**Quality Levels:**
```javascript
QualityLevel = { VERIFIED, TRUSTED, COMMUNITY, EXPERIMENTAL }
```

**Key Methods:**
```javascript
brain.store({ type, topic, content, quality, confidence })
brain.query({ type, topic, similarity })
brain.findPatterns(patternSpec)
brain.propagateKnowledge(agentList)
brain.buildRelationshipGraph()
```

### CrossAgentTeacher

**Key Methods:**
```javascript
teacher.createCurriculum({ skill, levels, exercises })
teacher.startTeachingSession({ fromAgent, toAgent, skill })
teacher.validateMastery(sessionId)
teacher.updateMasteryLevel(agentName, skill, level)
teacher.getAgentCompetencies(agentName)
teacher.shareLearning({ sourceAgent, targetAgents, knowledge })
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
orchestrator.stop()
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

### Tom Components (Security & Risk)

| Component | Purpose |
|-----------|---------|
| `ThreatModeler.js` | STRIDE threat modeling |
| `RiskTracker.js` | Risk register management |
| `AuditLogger.js` | Security audit trail |
| `OpsValidator.js` | Deployment validation |

### Dave Components (Database)

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

### Kevin Components (Performance)

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

### Learning & Evolution
```javascript
LearningEvents = {
  PATTERN_DETECTED, PATTERN_ANALYZED, SKILL_GENERATING, SKILL_GENERATED,
  SKILL_DEPLOYED, SKILL_APPROVED, SKILL_REJECTED, SKILL_EVOLVED,
  ABTEST_STARTED, ABTEST_COMPLETED, ABTEST_WINNER,
  POLICY_UPDATED, EXPERIENCE_RECORDED, EPISODE_COMPLETED,
  TEACHING_STARTED, TEACHING_COMPLETED, MASTERY_UPDATED,
  KNOWLEDGE_STORED, KNOWLEDGE_PROPAGATED
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

### Enable Learning System
```javascript
import { getKnowledgeBrain, getReinforcementLearner } from './index.js';

const brain = getKnowledgeBrain();
const learner = getReinforcementLearner();

await brain.initialize();
await learner.loadPolicy();
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
│   ├── learning/         # RL, skill generation
│   ├── knowledge-brain/  # Collective intelligence
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
│   ├── tester-agent/     # Multi-platform testing
│   ├── docker-agent/     # Container management
│   ├── github-agent/     # GitHub automation
│   ├── vision-agent/     # Product owner
│   ├── planner-agent/    # Execution engine
│   ├── backend-writer-agent/
│   ├── frontend-writer-agent/
│   ├── flutter-writer-agent/
│   └── skills/           # Reusable capabilities
├── docs/                 # Documentation
├── docker/               # Docker configuration
├── templates/            # Code generation templates
└── index.js              # Main entry point
```

---

## Singleton Reference

| Component | Factory Function | Path |
|-----------|------------------|------|
| EventBus | `getEventBus()` | foundation/event-bus/AgentEventBus.js |
| HealthMonitor | `getHealthMonitor()` | foundation/health-monitor/HealthMonitor.js |
| MetricsCollector | `getMetricsCollector()` | foundation/metrics-collector/MetricsCollector.js |
| RollbackManager | `getRollbackManager()` | foundation/rollback-manager/RollbackManager.js |
| AlertingSystem | `getAlertingSystem()` | foundation/alerting/AlertingSystem.js |
| MemoryStore | `getMemoryStore()` | foundation/memory-store/MemoryStore.js |
| DecisionLogger | `getDecisionLogger()` | foundation/memory-store/DecisionLogger.js |
| StateMachine | `getStateMachine(name, options)` | foundation/state-machine/StateMachine.js |
| RateLimiter | `getRateLimiter()` | foundation/resilience/RateLimiter.js |
| CircuitBreaker | `getCircuitBreaker(name)` | foundation/resilience/CircuitBreaker.js |
| AuthManager | `getAuthManager()` | foundation/auth/AuthManager.js |
| ReinforcementLearner | `getReinforcementLearner()` | foundation/learning/ReinforcementLearner.js |
| DynamicSkillGenerator | `getDynamicSkillGenerator()` | foundation/learning/DynamicSkillGenerator.js |
| KnowledgeBrain | `getKnowledgeBrain()` | foundation/knowledge-brain/KnowledgeBrain.js |
| CrossAgentTeacher | `getCrossAgentTeacher()` | foundation/learning/CrossAgentTeacher.js |
| Orchestrator | `getOrchestrator()` | agents/manager-agent/orchestrator.js |
| GruAgent | `getGruAgent()` | agents/gru-agent/index.js |
| NefarioAgent | `getNefarioAgent()` | agents/nefario-agent/index.js |
| ConversationStore | `getConversationStore()` | agents/gru-agent/ConversationStore.js |

---

## Related Documentation

- [Getting Started](./getting-started.md) - Setup and first steps
- [Architecture Guide](./architecture.md) - Deep dive into internals
- [API Reference](./api-reference.md) - Complete API documentation
- [Creating Agents](./creating-agents.md) - Agent development patterns
- [Skills Guide](./skills-guide.md) - Using and creating skills
- [Gru Guide](./gru-guide.md) - Web interface usage
