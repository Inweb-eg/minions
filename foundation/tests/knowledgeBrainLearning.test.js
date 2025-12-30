import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  KnowledgeBrain,
  getKnowledgeBrain,
  KNOWLEDGE_TYPES,
  QUALITY_LEVELS
} from '../knowledge-brain/KnowledgeBrain.js';
import fs from 'fs/promises';
import path from 'path';

describe('KnowledgeBrain Self-Learning Extensions', () => {
  let knowledgeBrain;
  const testStorageDir = '.knowledge-test-learning';

  beforeEach(async () => {
    // Create fresh instance for each test (not singleton)
    knowledgeBrain = new KnowledgeBrain({
      storageDir: testStorageDir,
      enablePersistence: false, // Disable for faster tests
      enableGraphRelations: true
    });
    await knowledgeBrain.initialize();
  });

  afterEach(async () => {
    // Clean up test storage directory if it exists
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('KNOWLEDGE_TYPES', () => {
    test('should have learning-specific knowledge types', () => {
      expect(KNOWLEDGE_TYPES.LEARNED_SKILL).toBe('learned_skill');
      expect(KNOWLEDGE_TYPES.RL_POLICY).toBe('rl_policy');
      expect(KNOWLEDGE_TYPES.EXPERIENCE).toBe('experience');
      expect(KNOWLEDGE_TYPES.SKILL_TEST_RESULT).toBe('skill_test_result');
      expect(KNOWLEDGE_TYPES.TEACHING_CURRICULUM).toBe('teaching_curriculum');
    });

    test('should have all original knowledge types', () => {
      expect(KNOWLEDGE_TYPES.CODE_PATTERN).toBe('code_pattern');
      expect(KNOWLEDGE_TYPES.BUG_FIX).toBe('bug_fix');
      expect(KNOWLEDGE_TYPES.ARCHITECTURE).toBe('architecture');
      expect(KNOWLEDGE_TYPES.BEST_PRACTICE).toBe('best_practice');
    });
  });

  describe('storeLearnedSkill', () => {
    test('should store a learned skill', async () => {
      const skill = {
        id: 'skill_123',
        name: 'TestSkill',
        sourcePattern: 'skill:test:success',
        code: 'class TestSkill extends BaseSkill {}',
        metadata: {
          generatedAt: Date.now(),
          confidence: 0.85
        }
      };

      const item = await knowledgeBrain.storeLearnedSkill(skill);

      expect(item).toBeDefined();
      expect(item.type).toBe(KNOWLEDGE_TYPES.LEARNED_SKILL);
      expect(item.content).toEqual(skill);
      expect(item.quality).toBe(QUALITY_LEVELS.EXPERIMENTAL);
      expect(item.metadata.skillId).toBe('skill_123');
      expect(item.metadata.skillName).toBe('TestSkill');
    });

    test('should tag skill with pattern and name', async () => {
      const skill = {
        id: 'skill_456',
        name: 'AnalyzerSkill',
        sourcePattern: 'skill:analyzer:success'
      };

      const item = await knowledgeBrain.storeLearnedSkill(skill);

      expect(item.tags).toContain('generated-skill');
      expect(item.tags).toContain('skill:analyzer:success');
      expect(item.tags).toContain('AnalyzerSkill');
    });
  });

  describe('getLearnedSkills', () => {
    beforeEach(async () => {
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_1',
        name: 'Skill1',
        sourcePattern: 'pattern1'
      });

      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_2',
        name: 'Skill2',
        sourcePattern: 'pattern2'
      });
    });

    test('should return all learned skills', async () => {
      const skills = await knowledgeBrain.getLearnedSkills();

      expect(skills.length).toBeGreaterThanOrEqual(2);
      expect(skills.some(s => s.id === 'skill_1')).toBe(true);
      expect(skills.some(s => s.id === 'skill_2')).toBe(true);
    });

    test('should return skill content not wrapper', async () => {
      const skills = await knowledgeBrain.getLearnedSkills();

      // Should return skill objects, not knowledge items
      const skill1 = skills.find(s => s.id === 'skill_1');
      expect(skill1.name).toBe('Skill1');
      expect(skill1.type).toBeUndefined(); // Content shouldn't have 'type' from wrapper
    });
  });

  describe('getLearnedSkillById', () => {
    test('should return skill by ID', async () => {
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_abc',
        name: 'TestSkill',
        code: 'test code'
      });

      const skill = await knowledgeBrain.getLearnedSkillById('skill_abc');

      expect(skill).toBeDefined();
      expect(skill.id).toBe('skill_abc');
      expect(skill.name).toBe('TestSkill');
    });

    test('should return null for unknown skill', async () => {
      const skill = await knowledgeBrain.getLearnedSkillById('nonexistent');
      expect(skill).toBeNull();
    });
  });

  describe('storeRLPolicy', () => {
    test('should store RL policy', async () => {
      const policy = {
        qTable: [{ state: 's1', actions: [['a1', 0.5]] }],
        explorationRate: 0.1,
        stats: { totalUpdates: 100 }
      };

      const item = await knowledgeBrain.storeRLPolicy(policy);

      expect(item).toBeDefined();
      expect(item.type).toBe(KNOWLEDGE_TYPES.RL_POLICY);
      expect(item.content).toEqual(policy);
      expect(item.quality).toBe(QUALITY_LEVELS.VERIFIED);
    });

    test('should use singleton ID for policy', async () => {
      const policy1 = { version: 1 };
      const policy2 = { version: 2 };

      await knowledgeBrain.storeRLPolicy(policy1);
      await knowledgeBrain.storeRLPolicy(policy2);

      // Should only have one policy
      const loaded = await knowledgeBrain.loadRLPolicy();
      expect(loaded.version).toBe(2);
    });

    test('should track update count', async () => {
      await knowledgeBrain.storeRLPolicy({ v: 1 });
      const item1 = await knowledgeBrain.storeRLPolicy({ v: 2 });
      const updates1 = item1.metadata.updates; // Capture immediately

      const item2 = await knowledgeBrain.storeRLPolicy({ v: 3 });
      const updates2 = item2.metadata.updates; // Capture immediately

      expect(updates1).toBe(2);
      expect(updates2).toBe(3);
    });
  });

  describe('loadRLPolicy', () => {
    test('should load stored policy', async () => {
      const policy = {
        qTable: [{ state: 'test', actions: [] }],
        explorationRate: 0.2
      };

      await knowledgeBrain.storeRLPolicy(policy);
      const loaded = await knowledgeBrain.loadRLPolicy();

      expect(loaded).toEqual(policy);
    });

    test('should return null if no policy exists', async () => {
      const loaded = await knowledgeBrain.loadRLPolicy();
      expect(loaded).toBeNull();
    });

    test('should increment access count on load', async () => {
      await knowledgeBrain.storeRLPolicy({ test: true });

      await knowledgeBrain.loadRLPolicy();
      await knowledgeBrain.loadRLPolicy();

      const item = knowledgeBrain.knowledge.get('rl-policy-singleton');
      expect(item.accessCount).toBe(3); // 1 from store + 2 from load
    });
  });

  describe('updateSkillActivation', () => {
    test('should update activation count', async () => {
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_act',
        name: 'TestSkill'
      });

      await knowledgeBrain.updateSkillActivation('skill_act', true);
      await knowledgeBrain.updateSkillActivation('skill_act', true);
      await knowledgeBrain.updateSkillActivation('skill_act', false);

      const skill = await knowledgeBrain.getLearnedSkillById('skill_act');
      expect(skill.metadata.activations).toBe(3);
      expect(skill.metadata.successes).toBe(2);
    });

    test('should calculate success rate', async () => {
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_rate',
        name: 'TestSkill'
      });

      await knowledgeBrain.updateSkillActivation('skill_rate', true);
      await knowledgeBrain.updateSkillActivation('skill_rate', false);

      const skill = await knowledgeBrain.getLearnedSkillById('skill_rate');
      expect(skill.metadata.successRate).toBe(0.5);
    });

    test('should upgrade quality based on success rate', async () => {
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_quality',
        name: 'TestSkill'
      });

      // Simulate 10 successful activations
      for (let i = 0; i < 10; i++) {
        await knowledgeBrain.updateSkillActivation('skill_quality', true);
      }

      // Should upgrade from EXPERIMENTAL to COMMUNITY
      const results = await knowledgeBrain.recall({
        type: KNOWLEDGE_TYPES.LEARNED_SKILL
      });
      const item = results.find(r => r.metadata.skillId === 'skill_quality');
      expect(item.quality).toBe(QUALITY_LEVELS.COMMUNITY);
    });

    test('should not fail for unknown skill', async () => {
      // Should not throw
      await expect(
        knowledgeBrain.updateSkillActivation('nonexistent', true)
      ).resolves.not.toThrow();
    });
  });

  describe('storeTestResult', () => {
    test('should store A/B test result', async () => {
      const testResult = {
        id: 'test_123',
        controlSkill: { name: 'SkillA' },
        treatmentSkill: { name: 'SkillB' },
        winner: 'treatment',
        significance: 0.95,
        endTime: Date.now()
      };

      const item = await knowledgeBrain.storeTestResult(testResult);

      expect(item).toBeDefined();
      expect(item.type).toBe(KNOWLEDGE_TYPES.SKILL_TEST_RESULT);
      expect(item.metadata.testId).toBe('test_123');
      expect(item.metadata.winner).toBe('treatment');
      expect(item.quality).toBe(QUALITY_LEVELS.VERIFIED);
    });

    test('should tag with skill names', async () => {
      const testResult = {
        id: 'test_456',
        controlSkill: { name: 'Control' },
        treatmentSkill: { name: 'Treatment' },
        winner: 'control'
      };

      const item = await knowledgeBrain.storeTestResult(testResult);

      expect(item.tags).toContain('ab-test');
      expect(item.tags).toContain('control');
      expect(item.tags).toContain('Control');
      expect(item.tags).toContain('Treatment');
    });
  });

  describe('getTestResultsForSkill', () => {
    test('should return test results for skill', async () => {
      await knowledgeBrain.storeTestResult({
        id: 'test_1',
        controlSkill: { name: 'SkillA' },
        treatmentSkill: { name: 'SkillB' },
        winner: 'treatment'
      });

      await knowledgeBrain.storeTestResult({
        id: 'test_2',
        controlSkill: { name: 'SkillA' },
        treatmentSkill: { name: 'SkillC' },
        winner: 'control'
      });

      const results = await knowledgeBrain.getTestResultsForSkill('SkillA');

      expect(results.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('storeTeachingCurriculum', () => {
    test('should store teaching curriculum', async () => {
      const curriculum = {
        id: 'curr_123',
        fromAgent: 'expert-agent',
        toAgent: 'learner-agent',
        skills: ['skill1', 'skill2', 'skill3']
      };

      const item = await knowledgeBrain.storeTeachingCurriculum(curriculum);

      expect(item).toBeDefined();
      expect(item.type).toBe(KNOWLEDGE_TYPES.TEACHING_CURRICULUM);
      expect(item.metadata.curriculumId).toBe('curr_123');
      expect(item.metadata.fromAgent).toBe('expert-agent');
      expect(item.metadata.toAgent).toBe('learner-agent');
      expect(item.metadata.skillCount).toBe(3);
    });

    test('should tag with agents', async () => {
      const curriculum = {
        id: 'curr_456',
        fromAgent: 'teacher',
        toAgent: 'student',
        skills: []
      };

      const item = await knowledgeBrain.storeTeachingCurriculum(curriculum);

      expect(item.tags).toContain('teaching');
      expect(item.tags).toContain('curriculum');
      expect(item.tags).toContain('teacher');
      expect(item.tags).toContain('student');
    });
  });

  describe('getSuccessfulSkills', () => {
    beforeEach(async () => {
      // Skill with high success rate
      const item1 = await knowledgeBrain.storeLearnedSkill({
        id: 'skill_good',
        name: 'GoodSkill'
      });
      // Simulate activations
      for (let i = 0; i < 8; i++) {
        await knowledgeBrain.updateSkillActivation('skill_good', true);
      }
      await knowledgeBrain.updateSkillActivation('skill_good', false);
      await knowledgeBrain.updateSkillActivation('skill_good', false);

      // Skill with low success rate
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_bad',
        name: 'BadSkill'
      });
      for (let i = 0; i < 8; i++) {
        await knowledgeBrain.updateSkillActivation('skill_bad', false);
      }
      await knowledgeBrain.updateSkillActivation('skill_bad', true);
      await knowledgeBrain.updateSkillActivation('skill_bad', true);

      // Skill with too few activations
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_new',
        name: 'NewSkill'
      });
      await knowledgeBrain.updateSkillActivation('skill_new', true);
    });

    test('should return skills above success rate threshold', async () => {
      const successful = await knowledgeBrain.getSuccessfulSkills(0.7);

      expect(successful.length).toBe(1);
      expect(successful[0].id).toBe('skill_good');
    });

    test('should filter out skills with too few activations', async () => {
      const successful = await knowledgeBrain.getSuccessfulSkills(0.5);

      // Should not include skill_new (only 1 activation)
      expect(successful.some(s => s.id === 'skill_new')).toBe(false);
    });
  });

  describe('getLearningStats', () => {
    test('should return learning statistics', async () => {
      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_1',
        name: 'Skill1'
      });
      await knowledgeBrain.updateSkillActivation('skill_1', true);
      await knowledgeBrain.updateSkillActivation('skill_1', true);

      await knowledgeBrain.storeLearnedSkill({
        id: 'skill_2',
        name: 'Skill2'
      });
      await knowledgeBrain.updateSkillActivation('skill_2', false);

      await knowledgeBrain.storeRLPolicy({ test: true });

      const stats = knowledgeBrain.getLearningStats();

      expect(stats.learnedSkillCount).toBe(2);
      expect(stats.totalSkillActivations).toBe(3);
      expect(stats.overallSuccessRate).toBeCloseTo(0.667, 2);
      expect(stats.hasRLPolicy).toBe(true);
      expect(stats.byQuality.experimental).toBe(2);
    });

    test('should return zeros when empty', () => {
      const stats = knowledgeBrain.getLearningStats();

      expect(stats.learnedSkillCount).toBe(0);
      expect(stats.totalSkillActivations).toBe(0);
      expect(stats.overallSuccessRate).toBe(0);
      expect(stats.hasRLPolicy).toBe(false);
    });
  });
});
