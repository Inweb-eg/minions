# Evolve Dashboard Guide

Complete guide for using the Minions Learning Control Center at `/evolve`.

## Table of Contents

- [Overview](#overview)
- [Dashboard Tab](#dashboard-tab)
- [Learning Plans](#learning-plans)
- [Skills Management](#skills-management)
- [RL Policy Controls](#rl-policy-controls)
- [A/B Testing](#ab-testing)
- [Teaching Sessions](#teaching-sessions)
- [API Reference](#api-reference)

---

## Overview

The Evolve dashboard (`http://localhost:2505/evolve`) is the Learning Control Center for the Minions framework. It provides both monitoring and interactive controls for the self-learning system.

**Key Capabilities:**
- Create and execute learning plans
- Monitor and control the RL (Reinforcement Learning) policy
- Manage generated skills (approve, reject, enable, disable)
- Start and cancel A/B tests
- Initiate and validate teaching sessions between agents
- Real-time event monitoring

---

## Dashboard Tab

The main dashboard provides an overview of the learning system.

### Stats Overview

| Stat | Description |
|------|-------------|
| Learned Skills | Number of skills generated from patterns |
| Total Activations | How many times skills have been used |
| Success Rate | Overall skill execution success percentage |
| Experience Count | Total learning experiences recorded |
| A/B Tests | Number of A/B tests run |
| Learning Plans | Number of created learning plans |

### Quick Actions

From the dashboard, you can quickly:
- **Create Learning Plan** - Opens modal to create a new plan
- **Generate Skill** - Opens modal to generate a skill from a pattern
- **Start A/B Test** - Opens modal to start a new test
- **Refresh All Data** - Reloads all data from the server

### Event Log

Real-time log of learning events with color-coded types:
- **Purple (control)** - Manual control actions
- **Blue (pattern)** - Pattern detection events
- **Green (skill)** - Skill generation/deployment
- **Yellow (reward)** - RL reward signals
- **Orange (test)** - A/B test events
- **Pink (teaching)** - Cross-agent teaching events

---

## Learning Plans

Learning plans help you organize and execute skill generation systematically.

### Creating a Plan

1. Click **"+ New Plan"** or use the Quick Actions button
2. Fill in the form:
   - **Plan Name**: Descriptive name (e.g., "Error Handling Skills")
   - **Description**: What this plan aims to achieve
   - **Target Skills**: Comma-separated pattern types (e.g., "auto-retry, circuit-breaker, rate-limiter")
   - **Priority**: Low, Medium, or High

### Example Plans

**Example 1: Resilience Patterns**
```
Name: Resilience Patterns
Description: Generate skills for handling transient failures and improving system resilience
Target Skills: auto-retry, circuit-breaker, exponential-backoff, fallback-handler
Priority: High
```

**Example 2: Caching Strategies**
```
Name: Caching Strategies
Description: Skills for caching common operations to improve performance
Target Skills: cache-result, memoize-function, cache-invalidation
Priority: Medium
```

**Example 3: Validation Skills**
```
Name: Input Validation
Description: Skills for validating and sanitizing input data
Target Skills: input-sanitizer, schema-validator, type-checker
Priority: Medium
```

### Executing a Plan

1. Navigate to the **Learning Plans** tab
2. Find your plan in the list
3. Click the **"Execute"** button
4. The system will:
   - Generate skills for each target pattern
   - Update progress as skills are created
   - Mark the plan as completed when done

### Plan Statuses

| Status | Meaning |
|--------|---------|
| `pending` | Plan created but not yet executed |
| `executing` | Plan is currently running |
| `completed` | All target skills generated |
| `failed` | Execution failed (check error message) |

---

## Skills Management

Manage learned skills in the **Skills** tab.

### Skill States

| State | Description | Actions |
|-------|-------------|---------|
| `canary` | New skill in trial deployment | Approve, Reject |
| `active` | Skill is enabled and in use | Disable |
| `inactive` | Skill is disabled | Enable |

### Approving/Rejecting Canary Skills

When a new skill is generated, it enters canary deployment for testing.

**To Approve:**
1. Find the skill with "canary" status
2. Click **"Approve"**
3. Skill will be promoted to active status

**To Reject:**
1. Find the skill with "canary" status
2. Click **"Reject"**
3. Enter a rejection reason when prompted
4. Skill will be deactivated

### Enabling/Disabling Skills

For active skills:
1. Click **"Disable"** to prevent the skill from being used
2. The skill remains available but won't be selected

For inactive skills:
1. Click **"Enable"** to reactivate the skill
2. The skill will be available for selection again

### Generating Skills Manually

1. Go to the **Skills** tab
2. In the "Generate Skill" section, enter a pattern type:
   ```
   auto-retry
   ```
3. Click **"Generate Skill"**
4. The system will:
   - Analyze the pattern
   - Use LLM to synthesize skill code
   - Test in sandbox
   - Deploy as canary

**Common Pattern Types:**
- `auto-retry` - Automatic retry with backoff
- `cache-result` - Result caching
- `circuit-breaker` - Circuit breaker pattern
- `rate-limiter` - Rate limiting
- `input-validator` - Input validation
- `error-handler` - Error handling patterns
- `logging-decorator` - Logging wrapper

---

## RL Policy Controls

The **RL Policy** tab controls the reinforcement learning system.

### Exploration Rate (Epsilon)

The exploration rate determines the balance between:
- **Exploration** (trying new actions)
- **Exploitation** (using known good actions)

**Slider Range:** 0.00 to 1.00

| Value | Behavior |
|-------|----------|
| 0.00 | Always exploit (use best known action) |
| 0.20 | Default balance (20% exploration) |
| 0.50 | Equal exploration/exploitation |
| 1.00 | Always explore (random actions) |

**To Change:**
1. Drag the slider to desired value
2. Click **"Apply Rate"**
3. New rate takes effect immediately

**When to Adjust:**
- **Increase** when system needs to discover new strategies
- **Decrease** when confident in learned strategies
- **Reset to 0.20** for balanced learning

### Resetting the Policy

**Warning:** This clears all learned Q-values!

1. Click **"Reset Policy"**
2. Confirm the action
3. Q-table is cleared
4. Learning starts fresh

**Use Cases:**
- After major system changes
- When learned policy is performing poorly
- To restart learning with different parameters

### Q-Value Visualization

The Q-Values section shows learned state-action values:

```
State: test-failure
├── retry: 0.75
├── fix-import: 0.62
└── add-mock: 0.45
```

Higher values indicate preferred actions for each state.

---

## A/B Testing

Compare two skills with the **A/B Tests** tab.

### Starting a Test

1. Click **"+ New Test"**
2. Enter:
   - **Control Skill**: The current/baseline skill
   - **Treatment Skill**: The new skill to test
3. Click **"Start Test"**

**Example:**
```
Control Skill: auto-retry-v1
Treatment Skill: auto-retry-v2-exponential
```

### Test Execution

The system will:
1. Route traffic between both skills (50/50 by default)
2. Record success/failure for each
3. Calculate statistical significance
4. Complete when significance threshold is reached

### Cancelling a Test

1. Find the test in "Active Tests"
2. Click **"Cancel"**
3. Confirm the cancellation
4. Test ends without a winner

### Test Results

Completed tests show:
- **Winner**: Control or Treatment
- **p-value**: Statistical significance (lower = more confident)

| p-value | Confidence |
|---------|------------|
| < 0.05 | 95% confidence |
| < 0.01 | 99% confidence |
| > 0.05 | Not significant |

---

## Teaching Sessions

Transfer skills between agents in the **Teaching** tab.

### Starting a Teaching Session

1. Fill in the form:
   - **Skill ID**: The skill to teach
   - **Teacher Agent**: Agent with mastery (e.g., "silas")
   - **Student Agent**: Agent to learn (e.g., "tom")
2. Click **"Start Teaching"**

**Example:**
```
Skill ID: auto-retry-skill-001
Teacher Agent: silas
Student Agent: nefario
```

### Mastery Levels

Agents progress through mastery levels:

| Level | Success Rate | Can Teach? |
|-------|--------------|------------|
| NOVICE | 0-20% | No |
| BEGINNER | 20-40% | No |
| INTERMEDIATE | 40-60% | No |
| ADVANCED | 60-80% | Yes |
| EXPERT | 80-90% | Yes |
| MASTER | 90%+ | Yes |

### Validating Sessions

1. Find the session in the list
2. Click **"Validate"**
3. System runs validation tests
4. Updates mastery level based on results

---

## API Reference

### Learning Plans API

**Create Plan:**
```bash
curl -X POST http://localhost:2505/api/learning/plans \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Error Handling Skills",
    "description": "Skills for handling errors gracefully",
    "targetSkills": ["auto-retry", "fallback-handler"],
    "priority": "high"
  }'
```

**List Plans:**
```bash
curl http://localhost:2505/api/learning/plans
```

**Execute Plan:**
```bash
curl -X POST http://localhost:2505/api/learning/plans/{planId}/execute
```

**Delete Plan:**
```bash
curl -X DELETE http://localhost:2505/api/learning/plans/{planId}
```

### Skills API

**Generate Skill:**
```bash
curl -X POST http://localhost:2505/api/learning/skills/generate \
  -H "Content-Type: application/json" \
  -d '{"patternType": "auto-retry"}'
```

**Approve Canary:**
```bash
curl -X POST http://localhost:2505/api/learning/skills/{skillId}/approve
```

**Reject Canary:**
```bash
curl -X POST http://localhost:2505/api/learning/skills/{skillId}/reject \
  -H "Content-Type: application/json" \
  -d '{"reason": "Performance issues in testing"}'
```

**Toggle Skill:**
```bash
curl -X POST http://localhost:2505/api/learning/skills/{skillId}/toggle \
  -H "Content-Type: application/json" \
  -d '{"enabled": false}'
```

### RL Policy API

**Set Exploration Rate:**
```bash
curl -X POST http://localhost:2505/api/learning/rl/exploration \
  -H "Content-Type: application/json" \
  -d '{"rate": 0.3}'
```

**Reset Policy:**
```bash
curl -X POST http://localhost:2505/api/learning/rl/reset \
  -H "Content-Type: application/json" \
  -d '{"keepConfig": true}'
```

### A/B Tests API

**Start Test:**
```bash
curl -X POST http://localhost:2505/api/learning/tests/start \
  -H "Content-Type: application/json" \
  -d '{
    "controlSkill": "auto-retry-v1",
    "treatmentSkill": "auto-retry-v2"
  }'
```

**Cancel Test:**
```bash
curl -X POST http://localhost:2505/api/learning/tests/{testId}/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "Need to restart with different parameters"}'
```

### Teaching API

**Start Teaching:**
```bash
curl -X POST http://localhost:2505/api/learning/teaching/start \
  -H "Content-Type: application/json" \
  -d '{
    "skillId": "auto-retry-skill-001",
    "teacherAgent": "silas",
    "studentAgent": "tom"
  }'
```

**Validate Session:**
```bash
curl -X POST http://localhost:2505/api/learning/teaching/{sessionId}/validate
```

**Update Mastery:**
```bash
curl -X POST http://localhost:2505/api/learning/mastery \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "tom",
    "skillId": "auto-retry-skill-001",
    "success": true
  }'
```

---

## Tips and Best Practices

1. **Start with learning plans** - Organize skill generation with clear goals
2. **Monitor canary skills** - Review and approve/reject new skills promptly
3. **Use A/B tests for improvements** - Don't just replace skills, test them first
4. **Adjust exploration gradually** - Small changes (0.05) to the rate
5. **Use teaching for skill propagation** - Share successful skills across agents
6. **Check the event log** - Understand what the system is learning
7. **Back up before major resets** - Resetting the policy loses all learning

---

## Related Documentation

- [Gru Guide](./gru-guide.md) - Main Gru Agent documentation
- [Architecture Guide](./architecture.md) - System internals
- [Component Index](./component-index.md) - API reference
