# 🏗️ Minions - Architect-Agent

**Phase 2 of the Minions Autonomous Agents System**

The Architect-Agent is the technical authority that makes architectural decisions and ensures all generated code follows a unified vision. It bridges the gap between Vision-Agent's requirements and the code-generating agents (Backend, Admin, Mobile).

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Usage](#usage)
- [API Reference](#api-reference)
- [Components](#components)
- [Integration](#integration)
- [Testing](#testing)

## 🎯 Overview

### Problem Solved

Without an Architect-Agent, each code-generating agent makes independent decisions that can lead to:
- Inconsistent APIs between frontend and backend
- Conflicting technology choices
- Architectural drift over time
- Layer violations and coupling
- Security vulnerabilities

### Solution

The Architect-Agent provides:
- **System Blueprints**: Comprehensive architecture documentation
- **API Contracts**: Defined interfaces before implementation
- **Technology Stack Selection**: Consistent, compatible choices
- **Drift Detection**: Continuous monitoring for violations
- **Decision Logging**: Architectural decision records (ADRs)

## ✨ Features

### 1. Blueprint Generator
- Creates system architecture from requirements
- Defines component boundaries and interactions
- Specifies layer responsibilities
- Documents data flows

### 2. API Contract Manager
- Generates API contracts before coding
- Produces OpenAPI 3.0 specifications
- Detects breaking changes
- Ensures frontend-backend consistency

### 3. Technology Selector
- Chooses compatible technologies
- Defines version matrices
- Generates package.json / pubspec.yaml
- Provides rationale for decisions

### 4. Drift Detector
- Monitors for anti-patterns
- Enforces layer boundaries
- Checks naming conventions
- Calculates drift scores

## 🏛️ Architecture

```
architect-agent/
├── index.js                 # Main agent class
├── blueprint-generator.js   # Architecture creation
├── api-contract-manager.js  # Interface definitions  
├── tech-selector.js         # Technology decisions
├── drift-detector.js        # Compliance monitoring
├── architect-agent.test.js  # Test suite
└── README.md               # This file
```

### Component Interaction

```
┌─────────────────┐     ┌──────────────────┐
│  Vision-Agent   │────▶│ Architect-Agent  │
│  (Requirements) │     │                  │
└─────────────────┘     │  ┌────────────┐  │
                        │  │ Blueprint  │  │
┌─────────────────┐     │  │ Generator  │  │
│  Backend-Agent  │◀───▶│  └────────────┘  │
└─────────────────┘     │                  │
                        │  ┌────────────┐  │
┌─────────────────┐     │  │    API     │  │
│   Admin-Agent   │◀───▶│  │ Contracts  │  │
└─────────────────┘     │  └────────────┘  │
                        │                  │
┌─────────────────┐     │  ┌────────────┐  │
│  Mobile-Agents  │◀───▶│  │   Drift    │  │
└─────────────────┘     │  │ Detector   │  │
                        │  └────────────┘  │
                        └──────────────────┘
```

## 📦 Installation

```bash
# Navigate to agent directory
cd minions-agents/architect-agent

# No external dependencies required (uses Node.js built-ins)
# If needed, install optional dependencies:
npm install

# Run tests
node architect-agent.test.js
```

## 🚀 Usage

### Basic Usage

```javascript
const { ArchitectAgent } = require('./architect-agent');

// Create agent instance
const architect = new ArchitectAgent({
  projectRoot: '/path/to/project',
  enableStrictMode: true
});

// Initialize
await architect.initialize();

// Generate blueprint from requirements
const { blueprint, techStack, contracts } = await architect.generateBlueprint({
  projectName: 'My App',
  description: 'A ride-sharing platform',
  features: {
    backend: ['Authentication', 'Ride booking'],
    admin: ['Dashboard', 'User management'],
    mobile: ['Book rides', 'Track driver']
  }
});

// Validate code against architecture
const validation = await architect.validateCode({
  filePath: '/backend/src/controllers/user.controller.js',
  content: fileContent,
  agent: 'Backend-Agent'
});

if (!validation.passed) {
  console.log('Violations:', validation.violations);
}
```

### With Event Bus Integration

```javascript
const { ArchitectAgent, ArchitectEvents } = require('./architect-agent');
const EventEmitter = require('events');

// Create shared event bus
const eventBus = new EventEmitter();

// Initialize with event bus
const architect = new ArchitectAgent();
await architect.initialize(eventBus);

// Listen for events
eventBus.on(ArchitectEvents.BLUEPRINT_CREATED, (data) => {
  console.log('New blueprint:', data.blueprint.id);
});

eventBus.on(ArchitectEvents.VALIDATION_FAILED, (data) => {
  console.log('Validation failed:', data.violations);
});

// Emit requirements (from Vision-Agent)
eventBus.emit(ArchitectEvents.REQUIREMENTS_READY, {
  requirements: myRequirements
});
```

## 📚 API Reference

### ArchitectAgent

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | string | `process.cwd()` | Project root directory |
| `architectureDir` | string | `'architecture'` | Blueprint storage |
| `contractsDir` | string | `'contracts'` | Contract storage |
| `enableStrictMode` | boolean | `true` | Block on ERROR violations |
| `maxDriftThreshold` | number | `0.15` | Max allowed drift (0-1) |

#### Methods

| Method | Description | Returns |
|--------|-------------|---------|
| `initialize(eventBus?)` | Initialize agent | `Promise<{success, agent}>` |
| `generateBlueprint(requirements)` | Create architecture | `Promise<{blueprint, techStack, contracts}>` |
| `validateCode(codeInfo)` | Validate against rules | `Promise<{passed, violations}>` |
| `getContract(serviceName)` | Get specific contract | `Contract \| null` |
| `getAllContracts()` | Get all contracts | `Contract[]` |
| `getBlueprint()` | Get current blueprint | `Blueprint \| null` |
| `getDecisions()` | Get decision log | `Decision[]` |
| `getViolations(filter?)` | Get violations | `Violation[]` |
| `getMetrics()` | Get agent metrics | `Metrics` |
| `shutdown()` | Graceful shutdown | `Promise<void>` |

### Events

| Event | Payload | Description |
|-------|---------|-------------|
| `architect:blueprint:created` | `{blueprint}` | New blueprint created |
| `architect:contract:defined` | `{contract}` | API contract defined |
| `architect:contract:violation` | `{violation}` | Contract violation detected |
| `architect:drift:detected` | `{driftResult}` | Architectural drift detected |
| `architect:validation:passed` | `{filePath}` | Code passed validation |
| `architect:validation:failed` | `{filePath, violations}` | Code failed validation |

## 🧩 Components

### Blueprint Generator

Generates comprehensive system blueprints:

```javascript
const BlueprintGenerator = require('./blueprint-generator');

const generator = new BlueprintGenerator(config);
const blueprint = await generator.generate({
  requirements,
  techStack,
  existingBlueprint: null
});

// Blueprint includes:
// - pattern: Architectural pattern selection
// - components: System components definition
// - layers: Layer responsibilities
// - boundaries: Bounded contexts
// - dataFlow: Data flow patterns
// - security: Security architecture
// - rules: Architectural rules
```

### API Contract Manager

Manages API contracts and generates OpenAPI specs:

```javascript
const ApiContractManager = require('./api-contract-manager');

const manager = new ApiContractManager(config);
const contracts = await manager.generateContracts(blueprint);

// Generate OpenAPI specification
const openApiSpec = manager.generateOpenApiSpec(contracts);

// Check for breaking changes
const breaking = await manager.checkBreakingChange(oldContract, newContract);
```

### Tech Selector

Selects compatible technology stacks:

```javascript
const TechSelector = require('./tech-selector');

const selector = new TechSelector(config);
const stack = await selector.selectStack(requirements);

// Generate package.json
const pkg = selector.generatePackageJson(stack, 'backend');

// Generate pubspec.yaml for Flutter
const pubspec = selector.generatePubspec(stack);

// Check compatibility
const compatible = selector.areCompatible('express', 'mongodb');
```

### Drift Detector

Monitors for architectural drift:

```javascript
const DriftDetector = require('./drift-detector');

const detector = new DriftDetector(config);

// Check single file
const result = await detector.checkDrift(filePath, content);
// result.driftScore: 0-1 (0 = no drift, 1 = severe drift)
// result.issues: Array of detected issues

// Analyze entire codebase
const analysis = await detector.analyzeCodebase(files);
// analysis.hotspots: Files with most issues
// analysis.recommendations: Improvement suggestions
```

## 🔗 Integration

### With Existing Agents

```javascript
// In system-integrator.js
const { ArchitectAgent } = require('./architect-agent');

class SystemIntegrator {
  async initializeAgents() {
    // Initialize Architect-Agent
    this.architectAgent = new ArchitectAgent(config);
    await this.architectAgent.initialize(this.eventBus);
    
    // Wire up events
    this.eventBus.on('vision:requirements:ready', async (data) => {
      const result = await this.architectAgent.generateBlueprint(data.requirements);
      
      // Broadcast to code-generating agents
      this.eventBus.emit('architect:blueprint:ready', result);
    });
    
    // Validate all generated code
    this.eventBus.on('code:generated', async (data) => {
      const validation = await this.architectAgent.validateCode(data);
      
      if (!validation.passed && validation.action === 'BLOCK') {
        this.eventBus.emit('code:rejected', {
          ...data,
          violations: validation.violations
        });
      }
    });
  }
}
```

### Event Flow

```
Vision-Agent                    Architect-Agent                  Code Agents
     │                               │                               │
     │  requirements:ready           │                               │
     │──────────────────────────────▶│                               │
     │                               │                               │
     │                               │ generateBlueprint()           │
     │                               │─────────┐                     │
     │                               │         │                     │
     │                               │◀────────┘                     │
     │                               │                               │
     │                               │  blueprint:ready              │
     │                               │──────────────────────────────▶│
     │                               │                               │
     │                               │                               │ generate code
     │                               │                               │─────────┐
     │                               │                               │         │
     │                               │    code:generated             │◀────────┘
     │                               │◀──────────────────────────────│
     │                               │                               │
     │                               │ validateCode()                │
     │                               │─────────┐                     │
     │                               │         │                     │
     │                               │◀────────┘                     │
     │                               │                               │
     │                               │  validation:result            │
     │                               │──────────────────────────────▶│
     │                               │                               │
```

## 🧪 Testing

```bash
# Run all tests
node architect-agent.test.js

# Run specific test
node -e "require('./architect-agent.test.js').testBlueprintGenerator()"
```

### Test Coverage

- ✅ Agent initialization
- ✅ Blueprint generation
- ✅ Code validation
- ✅ Contract generation
- ✅ OpenAPI spec generation
- ✅ Technology selection
- ✅ Drift detection
- ✅ Integration workflow

## 📊 Metrics Tracked

- `blueprintsGenerated`: Number of blueprints created
- `contractsDefined`: Number of API contracts defined
- `violationsDetected`: Number of violations found
- `driftChecks`: Number of drift checks performed
- `decisionsLogged`: Number of architectural decisions recorded

## 🔒 Security Features

- Input validation on all operations
- Secure defaults for technology choices
- Security-focused architectural rules
- SQL injection detection
- Hardcoded secret detection

## 📝 License

MIT License - Part of the Minions Autonomous Agents System

---

**Phase 2 Complete** ✅

Next: [Phase 3 - Planner-Agent](../planner-agent/README.md)
