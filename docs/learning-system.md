# Learning & Evolution System

Comprehensive guide to the Minions autonomous learning, pattern recognition, skill generation, and cross-agent knowledge sharing capabilities.

## Table of Contents

- [Overview](#overview)
- [Core Components](#core-components)
- [Reinforcement Learning](#reinforcement-learning)
- [Knowledge Brain](#knowledge-brain)
- [Dynamic Skill Generation](#dynamic-skill-generation)
- [Cross-Agent Teaching](#cross-agent-teaching)
- [Pattern Recognition](#pattern-recognition)
- [Learning Dashboard](#learning-dashboard)
- [Configuration](#configuration)
- [Best Practices](#best-practices)

---

## Overview

The Minions Learning System enables agents to learn from experience, share knowledge, and automatically generate new skills. It consists of four core components:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LEARNING & EVOLUTION SYSTEM                         │
├──────────────────┬──────────────────┬──────────────────┬───────────────────┤
│  Reinforcement   │   Knowledge      │    Dynamic       │   Cross-Agent     │
│    Learner       │     Brain        │ Skill Generator  │    Teacher        │
├──────────────────┼──────────────────┼──────────────────┼───────────────────┤
│ Q-learning with  │ Distributed      │ LLM-based skill  │ Skill transfer    │
│ Thompson sampling│ collective       │ synthesis from   │ between agents    │
│                  │ intelligence     │ detected patterns│                   │
├──────────────────┴──────────────────┴──────────────────┴───────────────────┤
│                          Pattern Recognition Engine                          │
│                    Identifies recurring patterns in agent behavior           │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- **Reinforcement Learning** - Q-learning with Thompson sampling for optimal action selection
- **Knowledge Sharing** - Distributed knowledge base accessible to all agents
- **Skill Generation** - Automatic creation of new skills from detected patterns
- **Teaching System** - Structured knowledge transfer between agents with mastery tracking

---

## Core Components

### Singleton Access

```javascript
import {
  getReinforcementLearner,
  getKnowledgeBrain,
  getDynamicSkillGenerator,
  getCrossAgentTeacher
} from 'minions';

const learner = getReinforcementLearner();
const brain = getKnowledgeBrain();
const skillGen = getDynamicSkillGenerator();
const teacher = getCrossAgentTeacher();
```

### Initialization

```javascript
import { initializeMinions } from 'minions';

const components = await initializeMinions({
  enableLearning: true,      // Enable learning system
  learningConfig: {
    explorationRate: 0.2,    // Initial exploration rate
    learningRate: 0.1,       // Q-learning alpha
    discountFactor: 0.95     // Q-learning gamma
  }
});

// Components are automatically wired together
```

---

## Reinforcement Learning

The ReinforcementLearner uses Q-learning with Thompson sampling for exploration vs exploitation.

### Algorithm

```
Q-Learning Update Rule:
Q(s,a) ← Q(s,a) + α[r + γ·max_a'Q(s',a') - Q(s,a)]

Where:
- α = learning rate (default: 0.1)
- γ = discount factor (default: 0.95)
- r = reward
- s,a = current state-action
- s',a' = next state-action
```

### Configuration

```javascript
const learner = getReinforcementLearner({
  learningRate: 0.1,        // Alpha - how quickly to update Q-values
  discountFactor: 0.95,     // Gamma - importance of future rewards
  explorationRate: 0.2,     // Epsilon - initial exploration probability
  explorationDecay: 0.995,  // How fast exploration decreases
  minExploration: 0.05      // Minimum exploration rate
});
```

### Reward Signals

```javascript
// Pre-defined reward signals
const RewardSignal = {
  SUCCESS: 1.0,           // Task completed successfully
  PARTIAL_SUCCESS: 0.5,   // Partial completion
  FAILURE: -0.5,          // Task failed
  TIMEOUT: -0.3,          // Task timed out
  USER_POSITIVE: 0.8,     // Positive user feedback
  QUALITY_BONUS: 0.3      // High quality output
};
```

### Usage

```javascript
const learner = getReinforcementLearner();

// Record an experience
await learner.recordExperience({
  state: 'test_failure_null_reference',
  action: 'apply_null_check_fix',
  reward: RewardSignal.SUCCESS,
  nextState: 'tests_passing'
});

// Select best action for a state
const action = learner.selectAction('test_failure_null_reference');
// Returns: 'apply_null_check_fix' (if learned) or random action (if exploring)

// Get current Q-values for a state
const qValues = learner.getQValues('test_failure_null_reference');
// { 'apply_null_check_fix': 0.85, 'apply_type_coercion': 0.32, ... }

// Update Q-value manually
learner.updateQValue('state', 'action', 0.5, 'next_state');

// Get complete policy (Q-table)
const policy = learner.getPolicy();
// Map<stateKey, Map<action, qValue>>

// Save/load policy
await learner.savePolicy();   // Persist to KnowledgeBrain
await learner.loadPolicy();   // Load from KnowledgeBrain
```

### Episode Management

```javascript
// Start a new learning episode
learner.startEpisode();

// ... perform actions and record experiences ...

// End episode with total reward
learner.endEpisode(totalReward);

// Get episode statistics
const stats = learner.getStatistics();
// {
//   totalEpisodes: 150,
//   totalUpdates: 2500,
//   averageReward: 0.72,
//   explorationRate: 0.15
// }
```

### Events

The learner publishes events for monitoring:

```javascript
import { EventTypes } from 'minions';

eventBus.subscribe(EventTypes.EXPERIENCE_RECORDED, 'monitor', (data) => {
  console.log(`Experience: ${data.state} -> ${data.action} = ${data.reward}`);
});

eventBus.subscribe(EventTypes.POLICY_UPDATED, 'monitor', (data) => {
  console.log(`Policy updated: ${data.updates} new Q-values`);
});

eventBus.subscribe(EventTypes.EPISODE_COMPLETED, 'monitor', (data) => {
  console.log(`Episode ${data.episode} complete, reward: ${data.totalReward}`);
});
```

---

## Knowledge Brain

The KnowledgeBrain is a distributed collective intelligence system that stores and shares knowledge across agents.

### Knowledge Types

```javascript
const KnowledgeType = {
  // Code patterns
  CODE_PATTERN: 'CODE_PATTERN',
  BUG_FIX: 'BUG_FIX',
  ARCHITECTURE: 'ARCHITECTURE',
  BEST_PRACTICE: 'BEST_PRACTICE',
  ERROR_SOLUTION: 'ERROR_SOLUTION',
  PERFORMANCE_TIP: 'PERFORMANCE_TIP',
  SECURITY_PATTERN: 'SECURITY_PATTERN',
  TEST_PATTERN: 'TEST_PATTERN',
  API_PATTERN: 'API_PATTERN',
  DOCUMENTATION: 'DOCUMENTATION',

  // Learning artifacts
  LEARNED_SKILL: 'LEARNED_SKILL',
  RL_POLICY: 'RL_POLICY',
  EXPERIENCE: 'EXPERIENCE',
  SKILL_TEST_RESULT: 'SKILL_TEST_RESULT',
  TEACHING_CURRICULUM: 'TEACHING_CURRICULUM',
  MASTERY_RECORD: 'MASTERY_RECORD'
};
```

### Quality Levels

```javascript
const QualityLevel = {
  VERIFIED: 'VERIFIED',       // Verified by testing/human review
  TRUSTED: 'TRUSTED',         // From trusted source, high confidence
  COMMUNITY: 'COMMUNITY',     // Community contributed
  EXPERIMENTAL: 'EXPERIMENTAL' // Newly generated, needs validation
};
```

### Storing Knowledge

```javascript
const brain = getKnowledgeBrain();

// Store a code pattern
await brain.store({
  type: KnowledgeType.CODE_PATTERN,
  topic: 'async-error-handling',
  content: {
    pattern: 'try-catch-with-logging',
    code: `
      try {
        const result = await asyncOperation();
        return result;
      } catch (error) {
        logger.error('Operation failed', { error, context });
        throw new CustomError('Operation failed', { cause: error });
      }
    `,
    applicability: ['async functions', 'API handlers', 'database operations'],
    effectiveness: 0.92
  },
  quality: QualityLevel.VERIFIED,
  confidence: 0.95,
  source: 'backend-agent',
  tags: ['async', 'error-handling', 'logging']
});

// Store a bug fix
await brain.store({
  type: KnowledgeType.BUG_FIX,
  topic: 'null-reference-in-map',
  content: {
    problem: 'TypeError: Cannot read property "x" of null',
    solution: 'Add null check before array.map()',
    code: 'items?.map(item => item.x) ?? []',
    testCases: ['empty array', 'null input', 'undefined input']
  },
  quality: QualityLevel.TRUSTED,
  confidence: 0.88
});
```

### Querying Knowledge

```javascript
// Query by type and topic
const patterns = await brain.query({
  type: KnowledgeType.CODE_PATTERN,
  topic: 'error-handling'
});

// Query with similarity search (semantic)
const similar = await brain.query({
  type: KnowledgeType.BUG_FIX,
  similarity: 'null pointer exception in async function',
  minConfidence: 0.7
});

// Query with filters
const recentPatterns = await brain.query({
  type: KnowledgeType.CODE_PATTERN,
  tags: ['performance'],
  quality: [QualityLevel.VERIFIED, QualityLevel.TRUSTED],
  since: Date.now() - 7 * 24 * 60 * 60 * 1000  // Last 7 days
});
```

### Pattern Discovery

```javascript
// Find recurring patterns
const patterns = await brain.findPatterns({
  minOccurrences: 3,
  confidence: 0.8,
  timeWindow: '30d'
});

// Get pattern statistics
const stats = brain.getPatternStats('null-check-fix');
// {
//   occurrences: 47,
//   successRate: 0.91,
//   averageEffectiveness: 0.88,
//   agents: ['backend-agent', 'frontend-agent']
// }
```

### Knowledge Propagation

```javascript
// Propagate knowledge to specific agents
await brain.propagateKnowledge(['backend-agent', 'frontend-agent'], {
  types: [KnowledgeType.BEST_PRACTICE, KnowledgeType.SECURITY_PATTERN],
  minQuality: QualityLevel.TRUSTED
});

// Build relationship graph
const graph = brain.buildRelationshipGraph();
// {
//   nodes: [{ id, type, topic, confidence }],
//   edges: [{ source, target, relationship, strength }]
// }
```

### Events

```javascript
eventBus.subscribe(EventTypes.KNOWLEDGE_STORED, 'monitor', (data) => {
  console.log(`Knowledge stored: ${data.type}/${data.topic}`);
});

eventBus.subscribe(EventTypes.KNOWLEDGE_PROPAGATED, 'monitor', (data) => {
  console.log(`Knowledge sent to ${data.agents.length} agents`);
});
```

---

## Dynamic Skill Generation

The DynamicSkillGenerator creates new skills from detected patterns using LLM synthesis.

### Skill Lifecycle

```
Pattern Detection → Skill Generation → Sandboxed Testing → Canary Deployment → A/B Testing → Approval/Rejection
```

### Generating Skills

```javascript
const skillGen = getDynamicSkillGenerator();

// Generate skill from pattern
const skill = await skillGen.generateSkill({
  pattern: {
    name: 'null-check-fix',
    description: 'Fix null reference errors by adding defensive checks',
    examples: [
      { input: 'obj.prop', output: 'obj?.prop' },
      { input: 'arr.map(fn)', output: 'arr?.map(fn) ?? []' },
      { input: 'obj.nested.value', output: 'obj?.nested?.value' }
    ]
  },
  options: {
    generateTests: true,
    minTestCoverage: 80
  }
});

console.log('Generated skill:', skill.id);
console.log('Status:', skill.status);  // 'generated'
```

### Canary Deployment

```javascript
// Deploy to a subset of requests for testing
await skillGen.deployCanary(skill.id, {
  percentage: 10,  // Route 10% of requests to new skill
  duration: 3600000  // Run canary for 1 hour
});

// Check canary metrics
const metrics = await skillGen.getCanaryMetrics(skill.id);
// {
//   requests: 150,
//   successes: 142,
//   failures: 8,
//   successRate: 0.947,
//   averageLatency: 45
// }
```

### A/B Testing

```javascript
// Start A/B test between skills
const testId = await skillGen.startABTest({
  skillA: existingSkillId,
  skillB: skill.id,
  trafficSplit: 50,  // 50/50 split
  duration: 86400000,  // 24 hours
  successMetric: 'test_pass_rate'
});

// Get test results
const results = await skillGen.getABTestResults(testId);
// {
//   winner: 'B',
//   skillA: { successRate: 0.82, samples: 500 },
//   skillB: { successRate: 0.91, samples: 500 },
//   confidence: 0.95,
//   pValue: 0.003
// }
```

### Approval Flow

```javascript
// Approve skill for production use
await skillGen.approveSkill(skill.id);

// Or reject if metrics are poor
await skillGen.rejectSkill(skill.id, {
  reason: 'Low success rate in canary deployment',
  metrics: { successRate: 0.65 }
});

// List all skills
const skills = await skillGen.listSkills();
// [
//   { id, name, status: 'approved', version: 2 },
//   { id, name, status: 'canary', version: 1 },
//   { id, name, status: 'rejected', version: 1 }
// ]
```

### Skill Evolution

Skills can evolve based on feedback:

```javascript
// Record feedback on skill performance
await skillGen.recordFeedback(skill.id, {
  success: true,
  context: { fileType: 'typescript', framework: 'react' },
  improvement: 'Could handle generic types better'
});

// Evolve skill based on accumulated feedback
const evolvedSkill = await skillGen.evolveSkill(skill.id);
// Creates a new version with improvements
```

### Events

```javascript
eventBus.subscribe(EventTypes.SKILL_GENERATED, 'monitor', (data) => {
  console.log(`New skill: ${data.skillId} from pattern ${data.pattern}`);
});

eventBus.subscribe(EventTypes.SKILL_APPROVED, 'monitor', (data) => {
  console.log(`Skill ${data.skillId} approved for production`);
});

eventBus.subscribe(EventTypes.ABTEST_COMPLETED, 'monitor', (data) => {
  console.log(`A/B test complete. Winner: ${data.winner}`);
});
```

---

## Cross-Agent Teaching

The CrossAgentTeacher enables structured knowledge transfer between agents.

### Creating Curriculum

```javascript
const teacher = getCrossAgentTeacher();

// Create a teaching curriculum
const curriculum = await teacher.createCurriculum({
  skill: 'validation-patterns',
  description: 'Input validation best practices',
  levels: [
    {
      name: 'Basic',
      topics: ['null checks', 'type validation'],
      exercises: [
        { input: 'validate null', expected: 'add null check' },
        { input: 'validate type', expected: 'add type guard' }
      ]
    },
    {
      name: 'Intermediate',
      topics: ['schema validation', 'sanitization'],
      prerequisites: ['Basic'],
      exercises: [...]
    },
    {
      name: 'Advanced',
      topics: ['custom validators', 'async validation'],
      prerequisites: ['Intermediate'],
      exercises: [...]
    }
  ]
});
```

### Teaching Sessions

```javascript
// Start a teaching session
const session = await teacher.startTeachingSession({
  fromAgent: 'backend-agent',
  toAgent: 'frontend-agent',
  skill: 'validation-patterns',
  curriculum: curriculum.id
});

// Progress through exercises
await teacher.submitExercise(session.id, {
  exercise: 0,
  response: 'if (value === null) throw new Error("Null not allowed")'
});

// Get session progress
const progress = await teacher.getSessionProgress(session.id);
// {
//   currentLevel: 'Basic',
//   completedExercises: 3,
//   totalExercises: 10,
//   score: 0.85
// }

// Validate mastery
const mastery = await teacher.validateMastery(session.id);
// {
//   passed: true,
//   level: 'Basic',
//   score: 0.92,
//   recommendations: ['Practice schema validation next']
// }
```

### Mastery Tracking

```javascript
// Update mastery level
await teacher.updateMasteryLevel('frontend-agent', 'validation-patterns', {
  level: 'Intermediate',
  score: 0.88,
  completedAt: Date.now()
});

// Get agent competencies
const competencies = await teacher.getAgentCompetencies('frontend-agent');
// {
//   'validation-patterns': { level: 'Intermediate', score: 0.88 },
//   'error-handling': { level: 'Advanced', score: 0.95 },
//   'async-patterns': { level: 'Basic', score: 0.75 }
// }

// Find agents with specific competency
const experts = await teacher.findExperts('validation-patterns', 'Advanced');
// ['backend-agent', 'security-agent']
```

### Knowledge Sharing

```javascript
// Share learning from one agent to multiple targets
await teacher.shareLearning({
  sourceAgent: 'backend-agent',
  targetAgents: ['frontend-agent', 'flutter-agent'],
  knowledge: {
    type: KnowledgeType.BEST_PRACTICE,
    topic: 'api-validation',
    content: { ... }
  },
  assessment: true  // Require validation test
});
```

### Events

```javascript
eventBus.subscribe(EventTypes.TEACHING_STARTED, 'monitor', (data) => {
  console.log(`Teaching: ${data.fromAgent} -> ${data.toAgent}`);
});

eventBus.subscribe(EventTypes.MASTERY_UPDATED, 'monitor', (data) => {
  console.log(`${data.agent} reached ${data.level} in ${data.skill}`);
});
```

---

## Pattern Recognition

The pattern recognition system identifies recurring behaviors that can be converted to skills.

### Pattern Detection

```javascript
const brain = getKnowledgeBrain();

// Register pattern observer
brain.registerPatternObserver({
  name: 'fix-pattern-detector',
  patterns: [
    {
      trigger: 'test_failure',
      action: 'code_fix',
      minOccurrences: 5
    }
  ],
  onPatternDetected: async (pattern) => {
    console.log(`Pattern detected: ${pattern.name}`);

    // Optionally generate skill
    if (pattern.confidence > 0.8) {
      const skillGen = getDynamicSkillGenerator();
      await skillGen.generateSkill({ pattern });
    }
  }
});
```

### Pattern Analysis

```javascript
// Analyze patterns in execution history
const analysis = await brain.analyzePatterns({
  timeWindow: '7d',
  minOccurrences: 3,
  agents: ['backend-agent', 'frontend-agent']
});

// {
//   patterns: [
//     {
//       name: 'null-check-fix',
//       occurrences: 47,
//       agents: ['backend-agent', 'frontend-agent'],
//       successRate: 0.91,
//       examples: [...]
//     }
//   ],
//   recommendations: [
//     'Consider generating skill for "null-check-fix" pattern'
//   ]
// }
```

### Events

```javascript
eventBus.subscribe(EventTypes.PATTERN_DETECTED, 'monitor', (data) => {
  console.log(`Pattern: ${data.pattern.name}, confidence: ${data.confidence}`);
});
```

---

## Learning Dashboard

The Gru web interface includes a Learning Control Center at `/evolve`.

### Accessing the Dashboard

```bash
# Start Gru
node index.js --gru

# Access dashboard
open http://localhost:2505/evolve
```

### Dashboard Features

1. **Learning Statistics**
   - Total experiences recorded
   - Episodes completed
   - Average reward
   - Exploration rate trend

2. **Skill Management**
   - List generated skills
   - View skill metrics
   - Approve/reject skills
   - Toggle skill enabled state

3. **RL Policy Viewer**
   - View Q-table
   - State-action values
   - Policy visualization

4. **A/B Test Monitor**
   - Active tests
   - Test results
   - Winner selection

5. **Teaching Sessions**
   - Active sessions
   - Progress tracking
   - Mastery levels

### API Endpoints

**Read Operations:**
```
GET /api/learning/stats          # Learning statistics
GET /api/learning/skills         # List skills
GET /api/learning/policy         # RL policy
GET /api/learning/patterns       # Detected patterns
GET /api/learning/teaching       # Teaching sessions
GET /api/learning/tests          # A/B tests
GET /api/learning/events         # Event log
GET /api/learning/plans          # Learning plans
```

**Write Operations:**
```
POST /api/learning/rl/exploration     # Set exploration rate
POST /api/learning/rl/reset           # Reset RL policy
POST /api/learning/skills/generate    # Generate skill
POST /api/learning/skills/:id/approve # Approve skill
POST /api/learning/skills/:id/reject  # Reject skill
POST /api/learning/skills/:id/toggle  # Enable/disable skill
POST /api/learning/tests/start        # Start A/B test
POST /api/learning/teaching/start     # Start teaching session
POST /api/learning/mastery            # Update mastery
POST /api/learning/plans              # Create learning plan
```

---

## Configuration

### Environment Variables

```bash
# Learning system
LEARNING_ENABLED=true
EXPLORATION_RATE=0.2
LEARNING_RATE=0.1
DISCOUNT_FACTOR=0.95

# Skill generation
SKILL_GEN_MODEL=deepseek-coder:6.7b  # LLM for skill synthesis
SKILL_TEST_COVERAGE=80                # Min test coverage for skills
CANARY_PERCENTAGE=10                  # Default canary traffic

# Knowledge brain
KNOWLEDGE_PERSISTENCE=sqlite          # sqlite | memory
KNOWLEDGE_DB_PATH=./data/knowledge.db
```

### Programmatic Configuration

```javascript
const config = {
  learning: {
    enabled: true,
    explorationRate: 0.2,
    explorationDecay: 0.995,
    minExploration: 0.05,
    learningRate: 0.1,
    discountFactor: 0.95,
    batchSize: 32,
    replayBufferSize: 10000
  },
  skillGeneration: {
    model: 'deepseek-coder:6.7b',
    testCoverage: 80,
    canaryPercentage: 10,
    canaryDuration: 3600000,
    autoApproveThreshold: 0.95
  },
  knowledgeBrain: {
    persistence: 'sqlite',
    dbPath: './data/knowledge.db',
    maxKnowledgeAge: '90d',
    confidenceDecay: 0.99
  },
  teaching: {
    maxSessionDuration: 3600000,
    masteryThreshold: 0.85,
    progressCheckInterval: 300000
  }
};

const { learner, brain, skillGen, teacher } = await initializeMinions({
  ...config
});
```

---

## Best Practices

### 1. Start with High Exploration

```javascript
// Start with high exploration for new environments
learner.setExplorationRate(0.5);

// Let it decay naturally
learner.setExplorationDecay(0.995);
```

### 2. Use Appropriate Reward Signals

```javascript
// Be consistent with rewards
const calculateReward = (outcome) => {
  if (outcome.allTestsPassing) return RewardSignal.SUCCESS;
  if (outcome.someTestsPassing) return RewardSignal.PARTIAL_SUCCESS;
  if (outcome.timeout) return RewardSignal.TIMEOUT;
  return RewardSignal.FAILURE;
};
```

### 3. Validate Skills Before Approval

```javascript
// Always run canary before approval
const metrics = await skillGen.getCanaryMetrics(skillId);
if (metrics.successRate < 0.9) {
  await skillGen.rejectSkill(skillId, { reason: 'Low success rate' });
} else {
  await skillGen.approveSkill(skillId);
}
```

### 4. Organize Knowledge with Tags

```javascript
// Use consistent tagging
await brain.store({
  type: KnowledgeType.CODE_PATTERN,
  topic: 'async-await-error-handling',
  tags: ['async', 'error-handling', 'javascript', 'backend'],
  // ...
});
```

### 5. Track Teaching Progress

```javascript
// Monitor mastery across agents
const allCompetencies = await teacher.getAllAgentCompetencies();
const gaps = findCompetencyGaps(allCompetencies);

// Create teaching plans for gaps
for (const gap of gaps) {
  await teacher.startTeachingSession({
    toAgent: gap.agent,
    skill: gap.skill,
    curriculum: gap.curriculum
  });
}
```

### 6. Monitor Learning Metrics

```javascript
// Regularly check learning health
setInterval(async () => {
  const stats = learner.getStatistics();

  if (stats.averageReward < 0.3) {
    console.warn('Low average reward - consider adjusting parameters');
  }

  if (stats.explorationRate < 0.05) {
    console.info('Exploration very low - learning may have converged');
  }
}, 300000);  // Every 5 minutes
```

---

## Related Documentation

- [Architecture Guide](./architecture.md) - System architecture
- [API Reference](./api-reference.md) - Complete API docs
- [Component Index](./component-index.md) - Quick reference
- [Creating Agents](./creating-agents.md) - Agent development
- [Gru Guide](./gru-guide.md) - Web interface usage
