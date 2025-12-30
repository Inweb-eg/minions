/**
 * DynamicSkillGenerator Tests
 *
 * Comprehensive unit tests for the Dynamic Skill Generator (Phase 2)
 * Tests pattern analysis, LLM synthesis, sandbox testing, and canary deployment
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import DynamicSkillGenerator, {
  getDynamicSkillGenerator,
  resetDynamicSkillGenerator,
  GENERATION_STATUS,
  SKILL_TEMPLATES
} from '../learning/DynamicSkillGenerator.js';
import { resetDecisionLogger } from '../memory-store/DecisionLogger.js';

describe('DynamicSkillGenerator', () => {
  let generator;
  let mockOllamaAdapter;
  let mockDecisionLogger;
  let mockKnowledgeBrain;

  beforeEach(async () => {
    // Reset singletons
    resetDynamicSkillGenerator();
    resetDecisionLogger();

    // Get fresh instance
    generator = getDynamicSkillGenerator({
      enableAutoGeneration: false,
      enableCanaryDeployment: false,
      minPatternCount: 2,
      confidenceThreshold: 0.5
    });

    // Create mocks
    mockOllamaAdapter = {
      initialize: jest.fn().mockResolvedValue({ success: true }),
      chat: jest.fn().mockResolvedValue({
        content: `\`\`\`javascript
import { BaseSkill, SKILL_STATUS, createSkillGetter } from '../../agents/skills/BaseSkill.js';
import { EventTypes } from '../../foundation/event-bus/eventTypes.js';

class TestPatternSkill extends BaseSkill {
  constructor(options = {}) {
    super('test-pattern-skill', options);
  }

  async onInitialize() {
    // Custom initialization
  }

  async execute(input) {
    this.startRun();
    try {
      const result = { processed: true };
      this.completeRun();
      return result;
    } catch (error) {
      this.failRun(error);
      throw error;
    }
  }
}

export const getTestPatternSkill = createSkillGetter(TestPatternSkill);
export default TestPatternSkill;
\`\`\``,
        provider: 'ollama',
        model: 'test-model'
      }),
      shutdown: jest.fn().mockResolvedValue(undefined)
    };

    mockDecisionLogger = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getExperiencesForPattern: jest.fn().mockResolvedValue([
        {
          id: 'exp1',
          agent: 'test-agent',
          outcome: 'success',
          metadata: { skillName: 'TestSkill' }
        },
        {
          id: 'exp2',
          agent: 'test-agent',
          outcome: 'success',
          metadata: { skillName: 'TestSkill' }
        },
        {
          id: 'exp3',
          agent: 'other-agent',
          outcome: 'failure',
          metadata: { skillName: 'OtherSkill' }
        }
      ])
    };

    mockKnowledgeBrain = {
      initialize: jest.fn().mockResolvedValue(undefined),
      storeLearnedSkill: jest.fn().mockResolvedValue({ id: 'kb-1' }),
      updateSkillActivation: jest.fn().mockResolvedValue(undefined)
    };

    // Inject mocks
    generator.ollamaAdapter = mockOllamaAdapter;
    generator.decisionLogger = mockDecisionLogger;
    generator.knowledgeBrain = mockKnowledgeBrain;
    generator.initialized = true;
  });

  afterEach(async () => {
    if (generator) {
      await generator.onShutdown();
    }
    resetDynamicSkillGenerator();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = getDynamicSkillGenerator();
      const instance2 = getDynamicSkillGenerator();
      expect(instance1).toBe(instance2);
    });

    it('should reset the singleton', () => {
      const instance1 = getDynamicSkillGenerator();
      resetDynamicSkillGenerator();
      const instance2 = getDynamicSkillGenerator();
      expect(instance1).not.toBe(instance2);
    });

    it('should apply configuration options', () => {
      resetDynamicSkillGenerator();
      const customGenerator = getDynamicSkillGenerator({
        minPatternCount: 5,
        confidenceThreshold: 0.9
      });
      expect(customGenerator.config.minPatternCount).toBe(5);
      expect(customGenerator.config.confidenceThreshold).toBe(0.9);
    });
  });

  describe('Constants', () => {
    it('should export GENERATION_STATUS constants', () => {
      expect(GENERATION_STATUS.ANALYZING).toBe('analyzing');
      expect(GENERATION_STATUS.SYNTHESIZING).toBe('synthesizing');
      expect(GENERATION_STATUS.TESTING).toBe('testing');
      expect(GENERATION_STATUS.VALIDATING).toBe('validating');
      expect(GENERATION_STATUS.CANARY).toBe('canary');
      expect(GENERATION_STATUS.COMPLETE).toBe('complete');
      expect(GENERATION_STATUS.FAILED).toBe('failed');
    });

    it('should export SKILL_TEMPLATES constants', () => {
      expect(SKILL_TEMPLATES.TRANSFORMER).toBe('transformer');
      expect(SKILL_TEMPLATES.ANALYZER).toBe('analyzer');
      expect(SKILL_TEMPLATES.GENERATOR).toBe('generator');
      expect(SKILL_TEMPLATES.VALIDATOR).toBe('validator');
      expect(SKILL_TEMPLATES.ORCHESTRATOR).toBe('orchestrator');
    });
  });

  describe('Pattern Analysis', () => {
    it('should analyze a pattern from DecisionLogger', async () => {
      const analysis = await generator._analyzePattern('test:pattern');

      expect(mockDecisionLogger.getExperiencesForPattern).toHaveBeenCalledWith('test:pattern');
      expect(analysis.confidence).toBeCloseTo(0.67, 1); // 2/3 success rate
      expect(analysis.examples.length).toBe(3);
      expect(analysis.agents).toContain('test-agent');
      expect(analysis.agents).toContain('other-agent');
      expect(analysis.skills).toContain('TestSkill');
      expect(analysis.description).toContain('test:pattern');
    });

    it('should return low confidence for no experiences', async () => {
      mockDecisionLogger.getExperiencesForPattern.mockResolvedValue([]);

      const analysis = await generator._analyzePattern('empty:pattern');

      expect(analysis.confidence).toBe(0);
      expect(analysis.examples.length).toBe(0);
    });

    it('should calculate 100% confidence for all successes', async () => {
      mockDecisionLogger.getExperiencesForPattern.mockResolvedValue([
        { id: 'e1', agent: 'agent', outcome: 'success', metadata: {} },
        { id: 'e2', agent: 'agent', outcome: 'success', metadata: {} }
      ]);

      const analysis = await generator._analyzePattern('success:pattern');

      expect(analysis.confidence).toBe(1);
    });
  });

  describe('Code Extraction', () => {
    it('should extract code from markdown code blocks', () => {
      const content = '```javascript\nconst x = 1;\n```';
      const code = generator._extractCode(content);
      expect(code).toBe('const x = 1;');
    });

    it('should extract code from js code blocks', () => {
      const content = '```js\nconst y = 2;\n```';
      const code = generator._extractCode(content);
      expect(code).toBe('const y = 2;');
    });

    it('should handle plain code without blocks', () => {
      const content = 'const z = 3;';
      const code = generator._extractCode(content);
      expect(code).toBe('const z = 3;');
    });

    it('should handle multiple code blocks (takes first)', () => {
      const content = '```javascript\nfirst\n```\n```javascript\nsecond\n```';
      const code = generator._extractCode(content);
      expect(code).toBe('first');
    });
  });

  describe('Basic Validation', () => {
    it('should pass valid skill code', () => {
      const synthesized = {
        code: `
import { BaseSkill, createSkillGetter } from './BaseSkill.js';

class MySkill extends BaseSkill {
  async execute(input) {
    try {
      return result;
    } catch (error) {
      throw error;
    }
  }
}

export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(true);
      expect(result.metrics.hasErrorHandling).toBe(true);
    });

    it('should reject code without BaseSkill', () => {
      const synthesized = {
        code: `
class MySkill {
  async execute() {}
}
export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('BaseSkill');
    });

    it('should reject code without execute', () => {
      const synthesized = {
        code: `
class MySkill extends BaseSkill {}
export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('execute');
    });

    it('should reject code without export', () => {
      const synthesized = {
        code: `
class MySkill extends BaseSkill {
  async execute() {}
}
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('export');
    });

    it('should reject code with process.exit', () => {
      const synthesized = {
        code: `
class MySkill extends BaseSkill {
  async execute() {
    process.exit(1);
  }
}
export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Dangerous pattern');
    });

    it('should reject code with eval', () => {
      const synthesized = {
        code: `
class MySkill extends BaseSkill {
  async execute() {
    eval("code");
  }
}
export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Dangerous pattern');
    });

    it('should reject code with require', () => {
      const synthesized = {
        code: `
class MySkill extends BaseSkill {
  async execute() {
    const fs = require('fs');
  }
}
export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Dangerous pattern');
    });

    it('should reject code with child_process', () => {
      const synthesized = {
        code: `
import child_process from 'child_process';
class MySkill extends BaseSkill {
  async execute() {}
}
export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Dangerous pattern');
    });

    it('should reject code with __proto__', () => {
      const synthesized = {
        code: `
class MySkill extends BaseSkill {
  async execute() {
    this.__proto__.foo = 'bar';
  }
}
export default MySkill;
`
      };

      const result = generator._basicValidation(synthesized);

      expect(result.passed).toBe(false);
      expect(result.error).toContain('Dangerous pattern');
    });
  });

  describe('Pattern Name Conversion', () => {
    it('should convert pattern to class name', () => {
      expect(generator._patternToClassName('test:pattern')).toBe('TestPatternSkill');
      expect(generator._patternToClassName('skill:success')).toBe('SkillSuccessSkill');
      expect(generator._patternToClassName('my-custom-pattern')).toBe('MyCustomPatternSkill');
    });

    it('should convert pattern to skill name', () => {
      expect(generator._patternToSkillName('test:pattern')).toBe('test-pattern-skill');
      expect(generator._patternToSkillName('skill:success')).toBe('skill-success-skill');
      expect(generator._patternToSkillName('MY_PATTERN')).toBe('my-pattern-skill');
    });

    it('should handle edge cases', () => {
      expect(generator._patternToClassName('---test---')).toBe('TestSkill');
      expect(generator._patternToSkillName('---test---')).toBe('test-skill');
    });
  });

  describe('Dependency Extraction', () => {
    it('should extract import dependencies', () => {
      const code = `
import { BaseSkill } from '../../agents/skills/BaseSkill.js';
import { EventTypes } from '../event-bus/eventTypes.js';
import something from 'some-package';
`;
      const deps = generator._extractDependencies(code);

      expect(deps).toContain('../../agents/skills/BaseSkill.js');
      expect(deps).toContain('../event-bus/eventTypes.js');
      expect(deps).toContain('some-package');
    });

    it('should return empty array for no imports', () => {
      const code = 'const x = 1;';
      const deps = generator._extractDependencies(code);
      expect(deps).toEqual([]);
    });
  });

  describe('Generation Control', () => {
    it('should check if generation should proceed', () => {
      expect(generator._shouldGenerate('new:pattern', 3)).toBe(true);
    });

    it('should reject patterns below minimum count', () => {
      expect(generator._shouldGenerate('new:pattern', 1)).toBe(false);
    });

    it('should reject already generated patterns', () => {
      generator.generatedSkills.set('existing:pattern', { id: 'skill-1' });
      expect(generator._shouldGenerate('existing:pattern', 5)).toBe(false);
    });

    it('should enforce daily generation limit', () => {
      generator.dailyGenerations = generator.config.maxGenerationsPerDay;
      expect(generator._shouldGenerate('new:pattern', 5)).toBe(false);
    });

    it('should reset daily counter on new day', () => {
      generator.dailyGenerations = 10;
      generator.lastResetDate = 'yesterday';
      expect(generator._shouldGenerate('new:pattern', 5)).toBe(true);
      expect(generator.dailyGenerations).toBe(0);
    });
  });

  describe('Skill Generation', () => {
    it('should generate a skill from a pattern', async () => {
      const skill = await generator.generateSkill('test:pattern');

      expect(skill.id).toMatch(/^skill_\d+_[a-z0-9]+$/);
      expect(skill.name).toBe('TestPatternSkill');
      expect(skill.skillName).toBe('test-pattern-skill');
      expect(skill.sourcePattern).toBe('test:pattern');
      expect(skill.code).toContain('extends BaseSkill');
      expect(skill.metadata.validated).toBe(true);
      expect(skill.metadata.generatedBy).toBe('DynamicSkillGenerator');
    });

    it('should store generated skill in map', async () => {
      await generator.generateSkill('test:pattern');

      expect(generator.generatedSkills.has('test:pattern')).toBe(true);
    });

    it('should update stats on successful generation', async () => {
      await generator.generateSkill('test:pattern');

      expect(generator.stats.skillsGenerated).toBe(1);
      expect(generator.stats.skillsValidated).toBe(1);
    });

    it('should store skill in KnowledgeBrain', async () => {
      await generator.generateSkill('test:pattern');

      expect(mockKnowledgeBrain.storeLearnedSkill).toHaveBeenCalled();
    });

    it('should fail on low confidence', async () => {
      mockDecisionLogger.getExperiencesForPattern.mockResolvedValue([
        { id: 'e1', agent: 'a', outcome: 'failure', metadata: {} },
        { id: 'e2', agent: 'a', outcome: 'failure', metadata: {} }
      ]);

      await expect(generator.generateSkill('fail:pattern')).rejects.toThrow('Confidence too low');
      expect(generator.stats.skillsFailed).toBe(1);
    });

    it('should fail on sandbox test failure', async () => {
      mockOllamaAdapter.chat.mockResolvedValue({
        content: 'invalid code without proper structure'
      });

      await expect(generator.generateSkill('bad:pattern')).rejects.toThrow('Sandbox test failed');
    });

    it('should increment daily counter', async () => {
      const initialCount = generator.dailyGenerations;
      await generator.generateSkill('test:pattern');
      expect(generator.dailyGenerations).toBe(initialCount + 1);
    });

    it('should add to generation history', async () => {
      await generator.generateSkill('test:pattern');

      expect(generator.generationHistory.length).toBe(1);
      expect(generator.generationHistory[0].pattern).toBe('test:pattern');
      expect(generator.generationHistory[0].status).toBe(GENERATION_STATUS.COMPLETE);
    });

    it('should emit events during generation', async () => {
      const startedEvents = [];
      const completeEvents = [];

      generator.on('generation:started', (data) => startedEvents.push(data));
      generator.on('generation:complete', (data) => completeEvents.push(data));

      await generator.generateSkill('test:pattern');

      expect(startedEvents.length).toBe(1);
      expect(completeEvents.length).toBe(1);
    });
  });

  describe('Canary Deployment', () => {
    beforeEach(() => {
      generator.config.enableCanaryDeployment = true;
    });

    it('should start canary deployment when enabled', async () => {
      jest.useFakeTimers();

      const skill = await generator.generateSkill('test:pattern');

      expect(skill.metadata.inCanary).toBe(true);
      expect(skill.metadata.canaryStartTime).toBeDefined();
      expect(skill.metadata.canaryActivations).toBe(0);
      expect(generator.canarySkills.has(skill.id)).toBe(true);

      jest.useRealTimers();
    });

    it('should track canary activations', async () => {
      jest.useFakeTimers();

      const skill = await generator.generateSkill('test:pattern');
      const skillId = skill.id;

      await generator.recordSkillActivation(skillId, true);
      await generator.recordSkillActivation(skillId, true);
      await generator.recordSkillActivation(skillId, false);

      const updatedSkill = generator.canarySkills.get(skillId);
      expect(updatedSkill.metadata.canaryActivations).toBe(3);
      expect(updatedSkill.metadata.canarySuccesses).toBe(2);

      jest.useRealTimers();
    });

    it('should check if canary skill should be used', async () => {
      jest.useFakeTimers();

      const skill = await generator.generateSkill('test:pattern');

      // With 10% canary percentage, most checks should return false
      let useCount = 0;
      for (let i = 0; i < 100; i++) {
        if (generator.shouldUseCanarySkill(skill.id)) {
          useCount++;
        }
      }

      // Should be roughly 10%, allow some variance
      expect(useCount).toBeGreaterThanOrEqual(0);
      expect(useCount).toBeLessThanOrEqual(30);

      jest.useRealTimers();
    });

    it('should return false for non-canary skills', () => {
      expect(generator.shouldUseCanarySkill('nonexistent')).toBe(false);
    });

    it('should promote skill with enough successful activations', async () => {
      jest.useFakeTimers();

      const skill = await generator.generateSkill('test:pattern');
      const skillId = skill.id;

      // Simulate enough successful activations
      for (let i = 0; i < 6; i++) {
        await generator.recordSkillActivation(skillId, true);
      }

      // Trigger canary evaluation
      await generator._evaluateCanary(skillId);

      const promotedSkill = generator.getSkillByPattern('test:pattern');
      expect(promotedSkill.metadata.inCanary).toBe(false);
      expect(promotedSkill.metadata.promoted).toBe(true);
      expect(generator.stats.skillsPromoted).toBe(1);
      expect(generator.canarySkills.has(skillId)).toBe(false);

      jest.useRealTimers();
    });

    it('should reject skill with low success rate', async () => {
      jest.useFakeTimers();

      const skill = await generator.generateSkill('test:pattern');
      const skillId = skill.id;

      // Simulate failed activations
      for (let i = 0; i < 6; i++) {
        await generator.recordSkillActivation(skillId, false);
      }

      // Trigger canary evaluation
      await generator._evaluateCanary(skillId);

      expect(generator.stats.skillsRejected).toBe(1);
      expect(generator.canarySkills.has(skillId)).toBe(false);
      expect(generator.generatedSkills.has('test:pattern')).toBe(false);

      jest.useRealTimers();
    });

    it('should reject skill with insufficient activations', async () => {
      jest.useFakeTimers();

      const skill = await generator.generateSkill('test:pattern');
      const skillId = skill.id;

      // Only 2 activations (below minimum of 5)
      await generator.recordSkillActivation(skillId, true);
      await generator.recordSkillActivation(skillId, true);

      // Trigger canary evaluation
      await generator._evaluateCanary(skillId);

      const rejectedSkill = mockKnowledgeBrain.storeLearnedSkill.mock.calls.find(
        call => call[0].id === skillId && call[0].metadata.rejected
      );
      expect(rejectedSkill).toBeDefined();
      expect(generator.stats.skillsRejected).toBe(1);

      jest.useRealTimers();
    });
  });

  describe('Skill Retrieval', () => {
    beforeEach(async () => {
      generator.config.enableCanaryDeployment = false;
      await generator.generateSkill('pattern:one');
      await generator.generateSkill('pattern:two');
    });

    it('should get all generated skills', () => {
      const skills = generator.getGeneratedSkills();
      expect(skills.length).toBe(2);
    });

    it('should get skill by pattern', () => {
      const skill = generator.getSkillByPattern('pattern:one');
      expect(skill).toBeDefined();
      expect(skill.sourcePattern).toBe('pattern:one');
    });

    it('should get skill by ID', () => {
      const skill = generator.getSkillByPattern('pattern:one');
      const found = generator.getSkillById(skill.id);
      expect(found).toBe(skill);
    });

    it('should return null for non-existent skill', () => {
      expect(generator.getSkillById('nonexistent')).toBeNull();
    });

    it('should get canary skills', async () => {
      generator.config.enableCanaryDeployment = true;
      jest.useFakeTimers();

      await generator.generateSkill('pattern:canary');

      const canarySkills = generator.getCanarySkills();
      expect(canarySkills.length).toBe(1);

      jest.useRealTimers();
    });

    it('should get generation history', () => {
      const history = generator.getHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    it('should get initial stats', () => {
      const stats = generator.getStats();

      expect(stats.skillsGenerated).toBe(0);
      expect(stats.skillsValidated).toBe(0);
      expect(stats.skillsFailed).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(stats.dailyGenerations).toBe(0);
    });

    it('should update stats after generation', async () => {
      generator.config.enableCanaryDeployment = false;
      await generator.generateSkill('test:pattern');

      const stats = generator.getStats();

      expect(stats.skillsGenerated).toBe(1);
      expect(stats.skillsValidated).toBe(1);
      expect(stats.dailyGenerations).toBe(1);
      expect(stats.generatedCount).toBe(1);
    });

    it('should calculate average confidence', async () => {
      generator.config.enableCanaryDeployment = false;

      // First generation: 67% confidence
      await generator.generateSkill('pattern:one');

      // Change mock for second generation: 100% confidence
      mockDecisionLogger.getExperiencesForPattern.mockResolvedValue([
        { id: 'e1', agent: 'a', outcome: 'success', metadata: {} }
      ]);
      await generator.generateSkill('pattern:two');

      const stats = generator.getStats();
      // Average of 0.67 and 1.0 = 0.835
      expect(stats.averageConfidence).toBeGreaterThan(0.5);
    });
  });

  describe('Reset', () => {
    it('should reset all state', async () => {
      generator.config.enableCanaryDeployment = false;
      await generator.generateSkill('test:pattern');

      generator.reset();

      expect(generator.generatedSkills.size).toBe(0);
      expect(generator.generationQueue.length).toBe(0);
      expect(generator.generationHistory.length).toBe(0);
      expect(generator.canarySkills.size).toBe(0);
      expect(generator.stats.skillsGenerated).toBe(0);
    });

    it('should clear canary timers on reset', async () => {
      generator.config.enableCanaryDeployment = true;
      jest.useFakeTimers();

      await generator.generateSkill('test:pattern');
      expect(generator.canaryTimers.size).toBe(1);

      generator.reset();

      expect(generator.canaryTimers.size).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Generation Queue', () => {
    it('should process queue', async () => {
      generator.generationQueue = [
        { pattern: 'queue:one', count: 5 },
        { pattern: 'queue:two', count: 5 }
      ];

      await generator._processQueue();

      expect(generator.generatedSkills.size).toBe(2);
      expect(generator.generationQueue.length).toBe(0);
    });

    it('should handle errors in queue processing', async () => {
      mockDecisionLogger.getExperiencesForPattern.mockResolvedValueOnce([
        { id: 'e1', agent: 'a', outcome: 'failure', metadata: {} }
      ]);

      generator.generationQueue = [
        { pattern: 'bad:pattern', count: 5 },
        { pattern: 'good:pattern', count: 5 }
      ];

      // Reset mock for second pattern
      mockDecisionLogger.getExperiencesForPattern.mockResolvedValue([
        { id: 'e1', agent: 'a', outcome: 'success', metadata: {} },
        { id: 'e2', agent: 'a', outcome: 'success', metadata: {} }
      ]);

      await generator._processQueue();

      // Should have processed both, one failed, one succeeded
      expect(generator.generationQueue.length).toBe(0);
    });
  });

  describe('LLM Integration', () => {
    it('should call Ollama with proper prompt', async () => {
      const analysis = {
        description: 'Test description',
        examples: [{ id: 'e1', data: 'test' }]
      };

      await generator._synthesizeSkill('test:pattern', analysis);

      expect(mockOllamaAdapter.chat).toHaveBeenCalled();
      const [messages] = mockOllamaAdapter.chat.mock.calls[0];
      expect(messages[0].content).toContain('Test description');
    });

    it('should handle LLM errors gracefully', async () => {
      mockOllamaAdapter.chat.mockRejectedValue(new Error('LLM unavailable'));

      await expect(generator.generateSkill('test:pattern')).rejects.toThrow('LLM unavailable');
    });
  });

  describe('ID Generation', () => {
    it('should generate unique IDs', () => {
      const id1 = generator._generateId();
      const id2 = generator._generateId();

      expect(id1).toMatch(/^gen_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^gen_\d+_[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe('Confidence Calculation', () => {
    it('should update average confidence correctly', () => {
      generator.stats.skillsGenerated = 0;
      generator.stats.averageConfidence = 0;

      // First skill: 0.8 confidence
      generator.stats.skillsGenerated = 1;
      generator._updateAverageConfidence(0.8);
      expect(generator.stats.averageConfidence).toBeCloseTo(0.8, 5);

      // Second skill: 0.6 confidence
      generator.stats.skillsGenerated = 2;
      generator._updateAverageConfidence(0.6);
      expect(generator.stats.averageConfidence).toBeCloseTo(0.7, 5);
    });
  });
});
