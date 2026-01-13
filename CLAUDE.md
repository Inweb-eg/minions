# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install all dependencies (run from root)
npm run install:all

# Run tests (uses Jest with coverage, from foundation/)
npm test

# Run tests in watch mode
npm run test:watch

# Run a single test file
cd foundation && NODE_OPTIONS=--experimental-vm-modules jest tests/eventBus.test.js

# Run tests matching a pattern
cd foundation && NODE_OPTIONS=--experimental-vm-modules jest --testNamePattern="should publish"
```

## Architecture

Minions is an event-driven framework for orchestrating autonomous AI agents. The codebase uses ES modules (`"type": "module"`) and Node.js 18+.

### Core Components

**Foundation Layer** (`foundation/`):
- `event-bus/AgentEventBus.js` - Singleton pub/sub system for agent communication. All components get the same instance via `getEventBus()`
- `health-monitor/HealthMonitor.js` - Tracks agent health status with heartbeats
- `metrics-collector/MetricsCollector.js` - Records execution metrics per agent
- `rollback-manager/RollbackManager.js` - Checkpoint/rollback for failure recovery
- `alerting/AlertingSystem.js` - Triggers alerts on anomalies
- `common/logger.js` - Pino-based logger factory (`createLogger('ComponentName')`)

**Manager Agent** (`agents/manager-agent/`):
- `orchestrator.js` - Core execution coordinator. Agents register via `registerAgent(name, loaderFn, dependencies)`. Executes agents in dependency order with configurable concurrency
- `autonomous-loop-manager.js` - Manages test-fix-verify cycles, triggered by TESTS_FAILED events
- `dependency-graph.js` - Builds execution order from agent dependencies

**Skills** (`agents/skills/`):
- Reusable agent capabilities that extend `BaseSkill.js`
- Each skill has a factory function (e.g., `getAutoFixer()`, `getCodeReviewer()`)

### Key Patterns

1. **Singleton Pattern**: Core services use singleton factories (e.g., `getEventBus()`, `getOrchestrator()`)

2. **Event-Driven Communication**: Agents communicate via EventTypes defined in `foundation/event-bus/eventTypes.js`:
   - `AGENT_STARTED/COMPLETED/FAILED` - Lifecycle events
   - `TESTS_STARTED/COMPLETED/FAILED` - Test events
   - `AUTO_FIX_REQUESTED/FIX_COMPLETED` - Fix cycle events
   - `SECURITY_*` - Security scanning, risk, threat, validation, audit events (Tom)
   - `PROJECT_*` - Project management events (Silas)
   - `COMPLETION_*` - Project completion events (Lucy)

3. **Agent Registration**: Agents register with the orchestrator using a loader function pattern:
   ```javascript
   orchestrator.registerAgent('my-agent', async () => agentInstance, ['dependency-agent']);
   ```

4. **Framework Initialization**: Use `initializeMinions()` from `index.js` to set up all components with proper wiring

## Testing

Tests are in `foundation/tests/` using Jest. Coverage threshold is 85% for branches, functions, lines, and statements. Tests require `NODE_OPTIONS=--experimental-vm-modules` for ES module support.

## Documentation

Detailed documentation is available in the `docs/` folder:
- `docs/component-index.md` - Quick reference index of all components, singletons, and events
- `docs/api-reference.md` - Complete API documentation for all components
- `docs/architecture.md` - Deep dive into framework internals and data flows
- `docs/getting-started.md` - Step-by-step setup and first agent tutorial
- `docs/creating-agents.md` - Agent development patterns and best practices
- `docs/skills-guide.md` - Using and creating skills
- `docs/gru-guide.md` - Gru Agent usage guide with Ollama setup

## Client Interface Agents

**Gru Agent** (`agents/gru-agent/`):
- Web interface coordinator at `http://localhost:2505`
- Conversational AI powered by Ollama (deepseek-coder:6.7b) or Gemini fallback
- General chat support (not limited to project topics)
- Web pages: `/` (chat), `/projects` (dashboard), `/minions` (chatter), `/evolve` (learning)
- Components: `WebServer.js`, `ConversationEngine.js`, `ConversationStore.js`, `OllamaAdapter.js`, `ProjectIntake.js`, `StatusTracker.js`, `MinionTranslator.js`
- Singletons: `getGruAgent()`, `getConversationStore()`, `getMinionTranslator()`
- Start with: `node index.js --gru` or Docker: `docker compose up -d`
- Projects API: Connect, disconnect, rescan, start/pause/resume/stop execution
- Learning Control API: RL policy, skills, A/B tests, teaching sessions, learning plans

**Dr. Nefario Agent** (`agents/nefario-agent/`):
- Claude Code adapter for AI-powered code generation
- Components: `ClaudeCodeBridge.js`, `OutputParser.js`, `TaskRunner.js`

**Project Manager (Silas)** (`agents/project-manager-agent/`):
- Manages connections to external projects
- Framework detection and project scanning
- Components: `ProjectRegistry.js`, `ProjectScanner.js`, `ProjectInitializer.js`

**Project Completion (Lucy)** (`agents/project-completion-agent/`):
- Autonomous completion loops
- Gap detection and resolution
- Components: `GapDetector.js`, `CompletionTracker.js`, `ContinuousLoop.js`

**Security & Risk (Tom)** (`agents/security-risk-agent/`):
- Security scanning and vulnerability detection
- Risk tracking and threat modeling (STRIDE)
- Pre-execution validation for orchestrator
- Components: `ThreatModeler.js`, `RiskTracker.js`, `AuditLogger.js`, `OpsValidator.js`
- Events: `SecurityEvents` (19 event types for scanning, risks, threats, validation, audit, ops)

## Docker Setup

Two-container architecture in `docker/`:
- `docker-compose.yml` - Ollama + Minions containers (recommended)
- `Dockerfile` - Multi-stage build with targets: `minions-slim` (default), `minions-dev`, `minions-integrated`

```bash
# Start containers
cd docker && docker compose up -d

# Pull AI model (first time)
docker exec minions-ollama ollama pull deepseek-coder:6.7b
docker restart minions

# Rebuild Minions only (models preserved)
docker compose down minions && docker compose build --no-cache minions && docker compose up -d minions
```
