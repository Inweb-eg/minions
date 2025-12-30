/**
 * CrossAgentTeacher Unit Tests
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  CrossAgentTeacher,
  getCrossAgentTeacher,
  resetCrossAgentTeacher,
  MASTERY_LEVEL,
  TEACHING_STATUS
} from '../teaching/CrossAgentTeacher.js';

describe('CrossAgentTeacher', () => {
  let teacher;

  beforeEach(async () => {
    resetCrossAgentTeacher();
    teacher = getCrossAgentTeacher({ enableAutoSubscribe: false });
    await teacher.initialize();
  });

  afterEach(() => {
    resetCrossAgentTeacher();
  });

  describe('Constants', () => {
    test('should have all mastery levels', () => {
      expect(MASTERY_LEVEL.NOVICE).toBe('novice');
      expect(MASTERY_LEVEL.BEGINNER).toBe('beginner');
      expect(MASTERY_LEVEL.INTERMEDIATE).toBe('intermediate');
      expect(MASTERY_LEVEL.ADVANCED).toBe('advanced');
      expect(MASTERY_LEVEL.EXPERT).toBe('expert');
      expect(MASTERY_LEVEL.MASTER).toBe('master');
    });

    test('should have all teaching statuses', () => {
      expect(TEACHING_STATUS.PENDING).toBe('pending');
      expect(TEACHING_STATUS.RECEIVED).toBe('received');
      expect(TEACHING_STATUS.VALIDATING).toBe('validating');
      expect(TEACHING_STATUS.VALIDATED).toBe('validated');
      expect(TEACHING_STATUS.REJECTED).toBe('rejected');
      expect(TEACHING_STATUS.LEARNING).toBe('learning');
      expect(TEACHING_STATUS.MASTERED).toBe('mastered');
    });
  });

  describe('Singleton Pattern', () => {
    test('should return same instance', () => {
      const instance1 = getCrossAgentTeacher();
      const instance2 = getCrossAgentTeacher();
      expect(instance1).toBe(instance2);
    });

    test('should reset properly', () => {
      const instance1 = getCrossAgentTeacher();
      resetCrossAgentTeacher();
      const instance2 = getCrossAgentTeacher();
      expect(instance1).not.toBe(instance2);
    });
  });

  describe('Initialization', () => {
    test('should initialize with default config', async () => {
      expect(teacher.initialized).toBe(true);
      expect(teacher.config.minMasteryToTeach).toBe(MASTERY_LEVEL.ADVANCED);
      expect(teacher.config.validationAttempts).toBe(3);
    });

    test('should initialize with custom config', async () => {
      resetCrossAgentTeacher();
      const customTeacher = getCrossAgentTeacher({
        minMasteryToTeach: MASTERY_LEVEL.EXPERT,
        validationAttempts: 5,
        enableAutoSubscribe: false
      });
      await customTeacher.initialize();
      expect(customTeacher.config.minMasteryToTeach).toBe(MASTERY_LEVEL.EXPERT);
      expect(customTeacher.config.validationAttempts).toBe(5);
    });

    test('should only initialize once', async () => {
      await teacher.initialize();
      await teacher.initialize();
      expect(teacher.initialized).toBe(true);
    });
  });

  describe('Skill Registration', () => {
    test('should register a skill', () => {
      const skill = {
        id: 'skill_1',
        name: 'TestSkill',
        code: 'class TestSkill {}',
        description: 'A test skill'
      };

      const registered = teacher.registerSkill(skill, 'agent_creator');

      expect(registered.id).toBe('skill_1');
      expect(registered.name).toBe('TestSkill');
      expect(registered.creatorAgent).toBe('agent_creator');
      expect(registered.teachableBy).toContain('agent_creator');
    });

    test('should set creator mastery to MASTER', () => {
      const skill = { id: 'skill_2', name: 'Skill2', code: 'test' };
      teacher.registerSkill(skill, 'creator_agent');

      const mastery = teacher.getMasteryRecord('creator_agent', 'skill_2');
      expect(mastery.level).toBe(MASTERY_LEVEL.MASTER);
      expect(mastery.isCreator).toBe(true);
    });

    test('should add skill to catalog', () => {
      const skill = { id: 'skill_3', name: 'Skill3', code: 'test' };
      teacher.registerSkill(skill, 'agent_1');

      const catalog = teacher.getSkillCatalog();
      expect(catalog.some(s => s.id === 'skill_3')).toBe(true);
    });
  });

  describe('Skill Packaging', () => {
    beforeEach(() => {
      const skill = { id: 'package_skill', name: 'PackageSkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher_agent');
    });

    test('should package skill for transfer', () => {
      const pkg = teacher.packageSkillForTransfer('package_skill', 'teacher_agent');

      expect(pkg).not.toBeNull();
      expect(pkg.skillId).toBe('package_skill');
      expect(pkg.teacher).toBe('teacher_agent');
      expect(pkg.signature).toBeDefined();
      expect(pkg.skill.code).toBe('test');
    });

    test('should return null for non-existent skill', () => {
      const pkg = teacher.packageSkillForTransfer('nonexistent', 'teacher_agent');
      expect(pkg).toBeNull();
    });

    test('should reject if teacher lacks mastery', () => {
      // Set mastery below teaching threshold
      teacher.setMasteryRecord('low_mastery_agent', 'package_skill', {
        level: MASTERY_LEVEL.BEGINNER,
        successRate: 0.3
      });

      const pkg = teacher.packageSkillForTransfer('package_skill', 'low_mastery_agent');
      expect(pkg).toBeNull();
    });

    test('should increment stats on packaging', () => {
      const before = teacher.getStats().totalSkillsShared;
      teacher.packageSkillForTransfer('package_skill', 'teacher_agent');
      const after = teacher.getStats().totalSkillsShared;
      expect(after).toBe(before + 1);
    });

    test('should generate teaching notes', () => {
      const skill = { id: 'hard_skill', name: 'HardSkill', code: 'test', difficulty: 'hard', prerequisites: ['prereq1'] };
      teacher.registerSkill(skill, 'expert');

      const pkg = teacher.packageSkillForTransfer('hard_skill', 'expert');
      expect(pkg.teachingNotes.length).toBeGreaterThan(0);
    });
  });

  describe('Skill Reception', () => {
    let validPackage;

    beforeEach(() => {
      const skill = { id: 'recv_skill', name: 'ReceiveSkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher');
      validPackage = teacher.packageSkillForTransfer('recv_skill', 'teacher');
    });

    test('should receive valid skill package', async () => {
      const session = await teacher.receiveSkill(validPackage, 'student_agent');

      expect(session).toBeDefined();
      expect(session.skillId).toBe('recv_skill');
      expect(session.student).toBe('student_agent');
      expect(session.teacher).toBe('teacher');
      expect(session.status).toBe(TEACHING_STATUS.RECEIVED);
    });

    test('should initialize student mastery to NOVICE', async () => {
      await teacher.receiveSkill(validPackage, 'new_student');

      const mastery = teacher.getMasteryRecord('new_student', 'recv_skill');
      expect(mastery.level).toBe(MASTERY_LEVEL.NOVICE);
      expect(mastery.successRate).toBe(0);
    });

    test('should reject invalid package', async () => {
      const invalidPackage = { id: 'bad' };
      await expect(teacher.receiveSkill(invalidPackage, 'student'))
        .rejects.toThrow('Invalid skill package');
    });

    test('should check prerequisites', async () => {
      const advancedSkill = { id: 'adv_skill', name: 'Advanced', code: 'test', prerequisites: ['basic_skill'] };
      teacher.registerSkill(advancedSkill, 'teacher');
      const advPkg = teacher.packageSkillForTransfer('adv_skill', 'teacher');

      await expect(teacher.receiveSkill(advPkg, 'student_without_prereq'))
        .rejects.toThrow('Unmet prerequisites');
    });

    test('should increment stats on reception', async () => {
      const before = teacher.getStats().totalSkillsReceived;
      await teacher.receiveSkill(validPackage, 'student');
      const after = teacher.getStats().totalSkillsReceived;
      expect(after).toBe(before + 1);
    });
  });

  describe('Skill Validation', () => {
    let session;

    beforeEach(async () => {
      const skill = { id: 'val_skill', name: 'ValidateSkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher');
      const pkg = teacher.packageSkillForTransfer('val_skill', 'teacher');
      session = await teacher.receiveSkill(pkg, 'student');
    });

    test('should validate skill with passing tests', async () => {
      const testRunner = async () => ({ success: true, output: 'ok', duration: 100 });

      const result = await teacher.validateSkill(session.id, testRunner);

      expect(result.validated).toBe(true);
      expect(result.successRate).toBe(1);
      expect(result.results.length).toBe(3); // Default 3 attempts
    });

    test('should reject skill with failing tests', async () => {
      const testRunner = async () => ({ success: false, error: 'failed', duration: 50 });

      const result = await teacher.validateSkill(session.id, testRunner);

      expect(result.validated).toBe(false);
      expect(result.successRate).toBe(0);
    });

    test('should handle mixed results', async () => {
      let attempt = 0;
      const testRunner = async () => {
        attempt++;
        return { success: attempt <= 2, output: 'test', duration: 50 };
      };

      const result = await teacher.validateSkill(session.id, testRunner);

      expect(result.validated).toBe(true); // 2/3 >= 0.5
      expect(result.successRate).toBeCloseTo(0.667, 2);
    });

    test('should throw for unknown session', async () => {
      await expect(teacher.validateSkill('unknown_session', async () => ({})))
        .rejects.toThrow('Session not found');
    });
  });

  describe('Mastery Tracking', () => {
    beforeEach(() => {
      const skill = { id: 'mastery_skill', name: 'MasterySkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher');
    });

    test('should update mastery on success', async () => {
      teacher.setMasteryRecord('agent', 'mastery_skill', {
        level: MASTERY_LEVEL.NOVICE,
        successRate: 0,
        activations: 0,
        successCount: 0
      });

      await teacher.updateMastery('agent', 'mastery_skill', true);

      const mastery = teacher.getMasteryRecord('agent', 'mastery_skill');
      expect(mastery.activations).toBe(1);
      expect(mastery.successRate).toBe(1);
    });

    test('should update mastery on failure', async () => {
      teacher.setMasteryRecord('agent', 'mastery_skill', {
        level: MASTERY_LEVEL.NOVICE,
        successRate: 0,
        activations: 0,
        successCount: 0
      });

      await teacher.updateMastery('agent', 'mastery_skill', false);

      const mastery = teacher.getMasteryRecord('agent', 'mastery_skill');
      expect(mastery.activations).toBe(1);
      expect(mastery.successRate).toBe(0);
    });

    test('should calculate correct success rate', async () => {
      teacher.setMasteryRecord('agent', 'mastery_skill', {
        level: MASTERY_LEVEL.NOVICE,
        successRate: 0,
        activations: 0,
        successCount: 0
      });

      await teacher.updateMastery('agent', 'mastery_skill', true);
      await teacher.updateMastery('agent', 'mastery_skill', true);
      await teacher.updateMastery('agent', 'mastery_skill', false);

      const mastery = teacher.getMasteryRecord('agent', 'mastery_skill');
      expect(mastery.successRate).toBeCloseTo(0.667, 2);
    });

    test('should upgrade mastery level', async () => {
      teacher.setMasteryRecord('agent', 'mastery_skill', {
        level: MASTERY_LEVEL.NOVICE,
        successRate: 0,
        activations: 0,
        successCount: 0
      });

      // Simulate 10 successful executions
      for (let i = 0; i < 10; i++) {
        await teacher.updateMastery('agent', 'mastery_skill', true);
      }

      const mastery = teacher.getMasteryRecord('agent', 'mastery_skill');
      expect(mastery.level).toBe(MASTERY_LEVEL.MASTER);
    });

    test('should calculate mastery level correctly', () => {
      expect(teacher.calculateMasteryLevel(0)).toBe(MASTERY_LEVEL.NOVICE);
      expect(teacher.calculateMasteryLevel(0.25)).toBe(MASTERY_LEVEL.BEGINNER);
      expect(teacher.calculateMasteryLevel(0.45)).toBe(MASTERY_LEVEL.INTERMEDIATE);
      expect(teacher.calculateMasteryLevel(0.65)).toBe(MASTERY_LEVEL.ADVANCED);
      expect(teacher.calculateMasteryLevel(0.85)).toBe(MASTERY_LEVEL.EXPERT);
      expect(teacher.calculateMasteryLevel(0.95)).toBe(MASTERY_LEVEL.MASTER);
    });
  });

  describe('Mastery Queries', () => {
    test('should check if can teach', () => {
      expect(teacher.canTeach(null)).toBe(false);
      expect(teacher.canTeach({ level: MASTERY_LEVEL.BEGINNER })).toBe(false);
      expect(teacher.canTeach({ level: MASTERY_LEVEL.ADVANCED })).toBe(true);
      expect(teacher.canTeach({ level: MASTERY_LEVEL.MASTER })).toBe(true);
    });

    test('should check minimum mastery', () => {
      const mastery = { level: MASTERY_LEVEL.INTERMEDIATE };
      expect(teacher.hasMinMastery(mastery, MASTERY_LEVEL.NOVICE)).toBe(true);
      expect(teacher.hasMinMastery(mastery, MASTERY_LEVEL.INTERMEDIATE)).toBe(true);
      expect(teacher.hasMinMastery(mastery, MASTERY_LEVEL.ADVANCED)).toBe(false);
    });

    test('should get agent mastery summary', () => {
      // Use unique agent ID to avoid state leakage from other tests
      teacher.setMasteryRecord('summary_agent', 'skill1', { level: MASTERY_LEVEL.EXPERT, successRate: 0.9, activations: 10 });
      teacher.setMasteryRecord('summary_agent', 'skill2', { level: MASTERY_LEVEL.BEGINNER, successRate: 0.3, activations: 5 });

      const summary = teacher.getAgentMasterySummary('summary_agent');

      expect(summary.total).toBe(2);
      expect(summary.byLevel[MASTERY_LEVEL.EXPERT]).toBe(1);
      expect(summary.byLevel[MASTERY_LEVEL.BEGINNER]).toBe(1);
    });

    test('should get teachable skills', () => {
      const skill = { id: 'teachable', name: 'Teachable', code: 'test' };
      teacher.registerSkill(skill, 'agent1');

      const teachable = teacher.getTeachableSkills('agent1');
      expect(teachable.length).toBe(1);
      expect(teachable[0].skillId).toBe('teachable');
    });
  });

  describe('Curriculum Generation', () => {
    beforeEach(() => {
      // Create skill hierarchy
      teacher.registerSkill({ id: 'basic', name: 'Basic', code: 'test', prerequisites: [] }, 'teacher');
      teacher.registerSkill({ id: 'inter', name: 'Intermediate', code: 'test', prerequisites: ['basic'] }, 'teacher');
      teacher.registerSkill({ id: 'adv', name: 'Advanced', code: 'test', prerequisites: ['inter'] }, 'teacher');
    });

    test('should generate curriculum for target skill', async () => {
      const curriculum = await teacher.generateCurriculum('student', 'adv');

      expect(curriculum).toBeDefined();
      expect(curriculum.student).toBe('student');
      expect(curriculum.targetSkill).toBe('adv');
      expect(curriculum.skills.length).toBe(3); // basic -> inter -> adv
    });

    test('should order skills by dependencies', async () => {
      const curriculum = await teacher.generateCurriculum('student', 'adv');

      const skillIds = curriculum.skills.map(s => s.skillId);
      expect(skillIds.indexOf('basic')).toBeLessThan(skillIds.indexOf('inter'));
      expect(skillIds.indexOf('inter')).toBeLessThan(skillIds.indexOf('adv'));
    });

    test('should assign teachers to skills', async () => {
      const curriculum = await teacher.generateCurriculum('student', 'adv');

      for (const skill of curriculum.skills) {
        expect(skill.assignedTeacher).toBeDefined();
      }
    });

    test('should skip already mastered skills', async () => {
      // Student already knows basic
      teacher.setMasteryRecord('student', 'basic', {
        level: MASTERY_LEVEL.INTERMEDIATE,
        successRate: 0.5,
        activations: 10
      });

      const curriculum = await teacher.generateCurriculum('student', 'adv');
      const skillIds = curriculum.skills.map(s => s.skillId);

      expect(skillIds).not.toContain('basic');
    });

    test('should throw for unknown target skill', async () => {
      await expect(teacher.generateCurriculum('student', 'unknown'))
        .rejects.toThrow('Target skill not found');
    });

    test('should increment stats on curriculum generation', async () => {
      const before = teacher.getStats().curriculaGenerated;
      await teacher.generateCurriculum('student', 'basic');
      const after = teacher.getStats().curriculaGenerated;
      expect(after).toBe(before + 1);
    });
  });

  describe('Session Management', () => {
    test('should get session by ID', async () => {
      const skill = { id: 'session_skill', name: 'SessionSkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher');
      const pkg = teacher.packageSkillForTransfer('session_skill', 'teacher');
      const session = await teacher.receiveSkill(pkg, 'student');

      const retrieved = teacher.getSession(session.id);
      expect(retrieved).toEqual(session);
    });

    test('should return null for unknown session', () => {
      expect(teacher.getSession('unknown')).toBeNull();
    });

    test('should get active sessions', async () => {
      const skill = { id: 'active_skill', name: 'ActiveSkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher');
      const pkg = teacher.packageSkillForTransfer('active_skill', 'teacher');
      await teacher.receiveSkill(pkg, 'student1');
      await teacher.receiveSkill(pkg, 'student2');

      const active = teacher.getActiveSessions();
      expect(active.length).toBe(2);
    });
  });

  describe('Statistics', () => {
    test('should track all statistics', async () => {
      const skill = { id: 'stats_skill', name: 'StatsSkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher');

      const pkg = teacher.packageSkillForTransfer('stats_skill', 'teacher');
      await teacher.receiveSkill(pkg, 'student');

      const stats = teacher.getStats();

      expect(stats.totalSkillsShared).toBe(1);
      expect(stats.totalSkillsReceived).toBe(1);
      expect(stats.totalSessionsStarted).toBe(1);
      expect(stats.totalSkillsInCatalog).toBe(1);
      expect(stats.activeSessions).toBe(1);
    });
  });

  describe('Shutdown', () => {
    test('should shutdown cleanly', async () => {
      const skill = { id: 'shutdown_skill', name: 'ShutdownSkill', code: 'test' };
      teacher.registerSkill(skill, 'agent');
      await teacher.updateMastery('agent', 'shutdown_skill', true);

      await teacher.shutdown();

      expect(teacher.teachingSessions.size).toBe(0);
    });
  });

  describe('Event Emission', () => {
    test('should emit internal events', async () => {
      const skill = { id: 'event_skill', name: 'EventSkill', code: 'test', prerequisites: [] };
      teacher.registerSkill(skill, 'teacher');

      const events = [];
      // Event name is 'teaching:skill:shared' as defined in LearningEvents.SKILL_SHARED
      teacher.on('teaching:skill:shared', (data) => events.push(data));

      teacher.packageSkillForTransfer('event_skill', 'teacher');

      expect(events.length).toBe(1);
      expect(events[0].skillId).toBe('event_skill');
    });
  });
});
