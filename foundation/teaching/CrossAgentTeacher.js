/**
 * CrossAgentTeacher - Agent-to-agent skill transfer and collaborative learning
 *
 * Features:
 * - Skill packaging for cross-agent transfer
 * - Skill reception and validation
 * - Mastery level tracking per agent/skill
 * - Curriculum generation for systematic learning
 * - Teaching event integration
 *
 * @module foundation/teaching/CrossAgentTeacher
 */

import { EventEmitter } from 'events';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { LearningEvents } from '../event-bus/eventTypes.js';
import { getKnowledgeBrain, KNOWLEDGE_TYPES } from '../knowledge-brain/KnowledgeBrain.js';

const logger = createLogger('CrossAgentTeacher');

/**
 * Mastery levels for skill acquisition
 */
export const MASTERY_LEVEL = {
  NOVICE: 'novice',           // Just received, 0-20% success
  BEGINNER: 'beginner',       // Learning, 20-40% success
  INTERMEDIATE: 'intermediate', // Competent, 40-60% success
  ADVANCED: 'advanced',       // Proficient, 60-80% success
  EXPERT: 'expert',           // Mastered, 80-100% success
  MASTER: 'master'            // Teaching others, 90%+ with teaching experience
};

/**
 * Teaching status for skill transfers
 */
export const TEACHING_STATUS = {
  PENDING: 'pending',         // Skill offered, not yet received
  RECEIVED: 'received',       // Skill received, being validated
  VALIDATING: 'validating',   // Running validation tests
  VALIDATED: 'validated',     // Passed validation
  REJECTED: 'rejected',       // Failed validation
  LEARNING: 'learning',       // Agent is practicing
  MASTERED: 'mastered'        // Agent has achieved mastery
};

/**
 * CrossAgentTeacher class for skill sharing between agents
 * @extends EventEmitter
 */
class CrossAgentTeacher extends EventEmitter {
  constructor(options = {}) {
    super();

    this.logger = logger;
    this.eventBus = null;
    this.knowledgeBrain = null;
    this.initialized = false;

    // Configuration
    this.config = {
      minMasteryToTeach: options.minMasteryToTeach || MASTERY_LEVEL.ADVANCED,
      validationAttempts: options.validationAttempts || 3,
      masteryThresholds: options.masteryThresholds || {
        [MASTERY_LEVEL.NOVICE]: 0.0,
        [MASTERY_LEVEL.BEGINNER]: 0.2,
        [MASTERY_LEVEL.INTERMEDIATE]: 0.4,
        [MASTERY_LEVEL.ADVANCED]: 0.6,
        [MASTERY_LEVEL.EXPERT]: 0.8,
        [MASTERY_LEVEL.MASTER]: 0.9
      },
      curriculumMaxSkills: options.curriculumMaxSkills || 10,
      enableAutoSubscribe: options.enableAutoSubscribe ?? true
    };

    // Active teaching sessions: Map<sessionId, TeachingSession>
    this.teachingSessions = new Map();

    // Agent mastery tracking: Map<agentId, Map<skillId, MasteryRecord>>
    this.agentMastery = new Map();

    // Skill catalog: Map<skillId, SkillInfo>
    this.skillCatalog = new Map();

    // Teaching history
    this.teachingHistory = [];

    // Statistics
    this.stats = {
      totalSessionsStarted: 0,
      totalSessionsCompleted: 0,
      totalSkillsShared: 0,
      totalSkillsReceived: 0,
      totalMasteriesAchieved: 0,
      averageTimeToMastery: 0,
      curriculaGenerated: 0
    };
  }

  /**
   * Initialize the teacher
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
      this.knowledgeBrain = getKnowledgeBrain();
      await this.knowledgeBrain.ensureInitialized();

      // Subscribe to teaching-related events
      if (this.config.enableAutoSubscribe) {
        this.subscribeToEvents();
      }

      // Load existing mastery data from KnowledgeBrain
      await this.loadMasteryData();

      this.initialized = true;
      this.logger.info('CrossAgentTeacher initialized');
    } catch (error) {
      this.logger.error('Failed to initialize CrossAgentTeacher', { error: error.message });
      throw error;
    }
  }

  /**
   * Subscribe to relevant events
   */
  subscribeToEvents() {
    // Listen for skill execution results to update mastery
    this.eventBus.subscribe(
      LearningEvents.SKILL_GENERATED,
      'cross-agent-teacher',
      (data) => this.handleSkillGenerated(data)
    );

    this.eventBus.subscribe(
      LearningEvents.SKILL_DEPLOYED,
      'cross-agent-teacher',
      (data) => this.handleSkillDeployed(data)
    );
  }

  /**
   * Handle skill generated event
   */
  handleSkillGenerated(data) {
    if (data.skill) {
      this.registerSkill(data.skill, data.agent || 'system');
    }
  }

  /**
   * Handle skill deployed event
   */
  handleSkillDeployed(data) {
    if (data.skill) {
      this.updateSkillCatalog(data.skill.id, { deployed: true, deployedAt: Date.now() });
    }
  }

  /**
   * Load existing mastery data from KnowledgeBrain
   */
  async loadMasteryData() {
    try {
      const masteryItems = await this.knowledgeBrain.queryByType(KNOWLEDGE_TYPES.EXPERIENCE);
      for (const item of masteryItems) {
        if (item.metadata?.type === 'mastery') {
          const { agentId, skillId, level, successRate, activations } = item.metadata;
          this.setMasteryRecord(agentId, skillId, {
            level,
            successRate,
            activations,
            lastUpdated: item.lastAccessed
          });
        }
      }
      this.logger.debug('Loaded mastery data', { count: masteryItems.length });
    } catch (error) {
      this.logger.warn('Failed to load mastery data', { error: error.message });
    }
  }

  // ============================================
  // Skill Packaging & Registration
  // ============================================

  /**
   * Register a skill in the catalog
   * @param {Object} skill - Skill to register
   * @param {string} creatorAgent - Agent that created the skill
   * @returns {Object} Registered skill info
   */
  registerSkill(skill, creatorAgent) {
    const skillInfo = {
      id: skill.id,
      name: skill.name,
      description: skill.description || '',
      code: skill.code,
      metadata: skill.metadata || {},
      creatorAgent,
      createdAt: Date.now(),
      version: 1,
      prerequisites: skill.prerequisites || [],
      difficulty: skill.difficulty || 'medium',
      teachableBy: [creatorAgent],
      totalLearners: 0,
      avgMasteryTime: 0
    };

    this.skillCatalog.set(skill.id, skillInfo);

    // Set creator's mastery to MASTER level
    this.setMasteryRecord(creatorAgent, skill.id, {
      level: MASTERY_LEVEL.MASTER,
      successRate: 1.0,
      activations: 0,
      lastUpdated: Date.now(),
      isCreator: true
    });

    this.logger.debug('Skill registered', { skillId: skill.id, creator: creatorAgent });
    return skillInfo;
  }

  /**
   * Package a skill for transfer to another agent
   * @param {string} skillId - Skill ID to package
   * @param {string} teacherAgent - Agent teaching the skill
   * @returns {Object|null} Packaged skill or null if not authorized
   */
  packageSkillForTransfer(skillId, teacherAgent) {
    const skill = this.skillCatalog.get(skillId);
    if (!skill) {
      this.logger.warn('Skill not found for packaging', { skillId });
      return null;
    }

    // Check if teacher has sufficient mastery
    const mastery = this.getMasteryRecord(teacherAgent, skillId);
    if (!this.canTeach(mastery)) {
      this.logger.warn('Agent lacks mastery to teach', {
        agent: teacherAgent,
        skillId,
        level: mastery?.level
      });
      return null;
    }

    const package_ = {
      id: `pkg_${Date.now()}_${skillId}`,
      skillId,
      skill: {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        code: skill.code,
        metadata: skill.metadata,
        prerequisites: skill.prerequisites,
        difficulty: skill.difficulty
      },
      teacher: teacherAgent,
      teacherMastery: mastery.level,
      packagedAt: Date.now(),
      signature: this.generateSignature(skill, teacherAgent),
      teachingNotes: this.generateTeachingNotes(skill, mastery)
    };

    this.stats.totalSkillsShared++;
    this.emitEvent(LearningEvents.SKILL_SHARED, {
      packageId: package_.id,
      skillId,
      teacher: teacherAgent,
      skill: skill.name
    });

    return package_;
  }

  /**
   * Generate a signature for skill authenticity
   */
  generateSignature(skill, teacher) {
    // Simple hash for authenticity verification
    const content = `${skill.id}:${skill.name}:${teacher}:${Date.now()}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `sig_${Math.abs(hash).toString(16)}`;
  }

  /**
   * Generate teaching notes based on mastery experience
   */
  generateTeachingNotes(skill, mastery) {
    const notes = [];

    if (skill.prerequisites?.length > 0) {
      notes.push(`Prerequisites: ${skill.prerequisites.join(', ')}`);
    }

    if (skill.difficulty === 'hard') {
      notes.push('This is an advanced skill requiring practice');
    }

    if (mastery.activations > 10) {
      notes.push(`Based on ${mastery.activations} executions`);
    }

    return notes;
  }

  // ============================================
  // Skill Reception & Validation
  // ============================================

  /**
   * Receive a skill package from another agent
   * @param {Object} package_ - Skill package
   * @param {string} studentAgent - Agent receiving the skill
   * @returns {Object} Teaching session
   */
  async receiveSkill(package_, studentAgent) {
    // Validate package
    if (!this.validatePackage(package_)) {
      throw new Error('Invalid skill package');
    }

    // Check prerequisites
    const unmetPrereqs = await this.checkPrerequisites(package_.skill, studentAgent);
    if (unmetPrereqs.length > 0) {
      throw new Error(`Unmet prerequisites: ${unmetPrereqs.join(', ')}`);
    }

    // Create teaching session
    const session = {
      id: `session_${Date.now()}_${studentAgent}`,
      packageId: package_.id,
      skillId: package_.skillId,
      skill: package_.skill,
      teacher: package_.teacher,
      student: studentAgent,
      status: TEACHING_STATUS.RECEIVED,
      startedAt: Date.now(),
      validationResults: [],
      masteryProgress: 0,
      notes: package_.teachingNotes || []
    };

    this.teachingSessions.set(session.id, session);
    this.stats.totalSessionsStarted++;
    this.stats.totalSkillsReceived++;

    // Initialize mastery for student
    this.setMasteryRecord(studentAgent, package_.skillId, {
      level: MASTERY_LEVEL.NOVICE,
      successRate: 0,
      activations: 0,
      lastUpdated: Date.now(),
      sessionId: session.id
    });

    this.emitEvent(LearningEvents.SKILL_RECEIVED, {
      sessionId: session.id,
      skillId: package_.skillId,
      student: studentAgent,
      teacher: package_.teacher
    });

    return session;
  }

  /**
   * Validate a skill package
   */
  validatePackage(package_) {
    return package_ &&
      package_.id &&
      package_.skillId &&
      package_.skill &&
      package_.skill.id &&
      package_.skill.code &&
      package_.teacher &&
      package_.signature;
  }

  /**
   * Check if student has prerequisites
   */
  async checkPrerequisites(skill, studentAgent) {
    const unmet = [];
    for (const prereq of skill.prerequisites || []) {
      const mastery = this.getMasteryRecord(studentAgent, prereq);
      if (!mastery || !this.hasMinMastery(mastery, MASTERY_LEVEL.INTERMEDIATE)) {
        unmet.push(prereq);
      }
    }
    return unmet;
  }

  /**
   * Validate a received skill through test execution
   * @param {string} sessionId - Teaching session ID
   * @param {Function} testRunner - Function to run validation tests
   * @returns {Object} Validation results
   */
  async validateSkill(sessionId, testRunner) {
    const session = this.teachingSessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = TEACHING_STATUS.VALIDATING;
    const results = [];

    for (let i = 0; i < this.config.validationAttempts; i++) {
      try {
        const result = await testRunner(session.skill);
        results.push({
          attempt: i + 1,
          success: result.success,
          output: result.output,
          error: result.error,
          duration: result.duration
        });
      } catch (error) {
        results.push({
          attempt: i + 1,
          success: false,
          error: error.message
        });
      }
    }

    session.validationResults = results;
    const successCount = results.filter(r => r.success).length;
    const successRate = successCount / results.length;

    if (successRate >= 0.5) {
      session.status = TEACHING_STATUS.VALIDATED;
      this.logger.info('Skill validated', { sessionId, successRate });
    } else {
      session.status = TEACHING_STATUS.REJECTED;
      this.logger.warn('Skill validation failed', { sessionId, successRate });
    }

    return {
      sessionId,
      validated: session.status === TEACHING_STATUS.VALIDATED,
      successRate,
      results
    };
  }

  // ============================================
  // Mastery Tracking
  // ============================================

  /**
   * Get mastery record for an agent/skill
   */
  getMasteryRecord(agentId, skillId) {
    const agentMastery = this.agentMastery.get(agentId);
    return agentMastery?.get(skillId) || null;
  }

  /**
   * Set mastery record for an agent/skill
   */
  setMasteryRecord(agentId, skillId, record) {
    if (!this.agentMastery.has(agentId)) {
      this.agentMastery.set(agentId, new Map());
    }
    this.agentMastery.get(agentId).set(skillId, record);
  }

  /**
   * Update mastery based on skill execution
   * @param {string} agentId - Agent ID
   * @param {string} skillId - Skill ID
   * @param {boolean} success - Whether execution succeeded
   * @param {Object} metadata - Additional execution metadata
   */
  async updateMastery(agentId, skillId, success, metadata = {}) {
    let mastery = this.getMasteryRecord(agentId, skillId);

    if (!mastery) {
      mastery = {
        level: MASTERY_LEVEL.NOVICE,
        successRate: 0,
        activations: 0,
        successCount: 0,
        lastUpdated: Date.now()
      };
    }

    // Update statistics
    mastery.activations++;
    if (success) {
      mastery.successCount = (mastery.successCount || 0) + 1;
    }
    mastery.successRate = mastery.successCount / mastery.activations;
    mastery.lastUpdated = Date.now();

    // Calculate new mastery level
    const oldLevel = mastery.level;
    mastery.level = this.calculateMasteryLevel(mastery.successRate);

    this.setMasteryRecord(agentId, skillId, mastery);

    // Check for mastery achievement
    if (oldLevel !== mastery.level &&
        this.hasMinMastery(mastery, MASTERY_LEVEL.EXPERT)) {
      this.stats.totalMasteriesAchieved++;

      // Update skill catalog
      const skill = this.skillCatalog.get(skillId);
      if (skill && !skill.teachableBy.includes(agentId)) {
        skill.teachableBy.push(agentId);
        skill.totalLearners++;
      }

      this.emitEvent(LearningEvents.MASTERY_ACHIEVED, {
        agent: agentId,
        skillId,
        level: mastery.level,
        successRate: mastery.successRate
      });

      // Update teaching session if exists
      const session = Array.from(this.teachingSessions.values())
        .find(s => s.student === agentId && s.skillId === skillId);
      if (session) {
        session.status = TEACHING_STATUS.MASTERED;
        session.completedAt = Date.now();
        this.stats.totalSessionsCompleted++;
        this.teachingHistory.push(session);
      }
    }

    // Persist mastery data
    await this.persistMastery(agentId, skillId, mastery);

    return mastery;
  }

  /**
   * Calculate mastery level from success rate
   */
  calculateMasteryLevel(successRate) {
    const thresholds = this.config.masteryThresholds;

    if (successRate >= thresholds[MASTERY_LEVEL.MASTER]) return MASTERY_LEVEL.MASTER;
    if (successRate >= thresholds[MASTERY_LEVEL.EXPERT]) return MASTERY_LEVEL.EXPERT;
    if (successRate >= thresholds[MASTERY_LEVEL.ADVANCED]) return MASTERY_LEVEL.ADVANCED;
    if (successRate >= thresholds[MASTERY_LEVEL.INTERMEDIATE]) return MASTERY_LEVEL.INTERMEDIATE;
    if (successRate >= thresholds[MASTERY_LEVEL.BEGINNER]) return MASTERY_LEVEL.BEGINNER;
    return MASTERY_LEVEL.NOVICE;
  }

  /**
   * Check if mastery meets minimum level
   */
  hasMinMastery(mastery, minLevel) {
    if (!mastery) return false;
    const levels = Object.values(MASTERY_LEVEL);
    return levels.indexOf(mastery.level) >= levels.indexOf(minLevel);
  }

  /**
   * Check if agent can teach a skill
   */
  canTeach(mastery) {
    if (!mastery) return false;
    return this.hasMinMastery(mastery, this.config.minMasteryToTeach);
  }

  /**
   * Persist mastery data to KnowledgeBrain
   */
  async persistMastery(agentId, skillId, mastery) {
    try {
      await this.knowledgeBrain.learn({
        type: KNOWLEDGE_TYPES.EXPERIENCE,
        content: { agentId, skillId, mastery },
        metadata: {
          type: 'mastery',
          agentId,
          skillId,
          level: mastery.level,
          successRate: mastery.successRate,
          activations: mastery.activations
        },
        tags: ['mastery', agentId, skillId, mastery.level]
      });
    } catch (error) {
      this.logger.warn('Failed to persist mastery', { error: error.message });
    }
  }

  // ============================================
  // Curriculum Generation
  // ============================================

  /**
   * Generate a learning curriculum for an agent
   * @param {string} studentAgent - Agent to generate curriculum for
   * @param {string} targetSkillId - Target skill to learn
   * @param {Object} options - Curriculum options
   * @returns {Object} Generated curriculum
   */
  async generateCurriculum(studentAgent, targetSkillId, options = {}) {
    const targetSkill = this.skillCatalog.get(targetSkillId);
    if (!targetSkill) {
      throw new Error('Target skill not found');
    }

    // Build dependency tree
    const skillPath = this.buildSkillPath(targetSkillId, studentAgent);

    // Find available teachers for each skill
    const teacherAssignments = this.assignTeachers(skillPath);

    // Create curriculum
    const curriculum = {
      id: `curr_${Date.now()}_${studentAgent}`,
      student: studentAgent,
      targetSkill: targetSkillId,
      skills: skillPath.map((skillId, index) => ({
        skillId,
        order: index + 1,
        skill: this.skillCatalog.get(skillId),
        assignedTeacher: teacherAssignments.get(skillId),
        estimatedDuration: this.estimateLearningDuration(skillId)
      })),
      createdAt: Date.now(),
      status: 'pending',
      totalEstimatedDuration: 0,
      progress: 0
    };

    curriculum.totalEstimatedDuration = curriculum.skills
      .reduce((sum, s) => sum + s.estimatedDuration, 0);

    this.stats.curriculaGenerated++;

    // Store curriculum
    await this.knowledgeBrain.storeTeachingCurriculum({
      id: curriculum.id,
      fromAgent: teacherAssignments.get(targetSkillId) || 'system',
      toAgent: studentAgent,
      skills: skillPath
    });

    this.emitEvent(LearningEvents.CURRICULUM_CREATED, {
      curriculumId: curriculum.id,
      student: studentAgent,
      targetSkill: targetSkillId,
      skillCount: skillPath.length
    });

    return curriculum;
  }

  /**
   * Build ordered path of skills to learn
   */
  buildSkillPath(targetSkillId, studentAgent, visited = new Set()) {
    if (visited.has(targetSkillId)) return [];
    visited.add(targetSkillId);

    const skill = this.skillCatalog.get(targetSkillId);
    if (!skill) return [];

    // Check if student already has mastery
    const mastery = this.getMasteryRecord(studentAgent, targetSkillId);
    if (mastery && this.hasMinMastery(mastery, MASTERY_LEVEL.INTERMEDIATE)) {
      return []; // Already knows this skill
    }

    // Get prerequisites first
    const path = [];
    for (const prereq of skill.prerequisites || []) {
      const prereqPath = this.buildSkillPath(prereq, studentAgent, visited);
      path.push(...prereqPath);
    }

    // Add this skill
    path.push(targetSkillId);

    // Limit curriculum size
    return path.slice(0, this.config.curriculumMaxSkills);
  }

  /**
   * Assign teachers to skills
   */
  assignTeachers(skillPath) {
    const assignments = new Map();

    for (const skillId of skillPath) {
      const skill = this.skillCatalog.get(skillId);
      if (skill?.teachableBy?.length > 0) {
        // Pick teacher with highest mastery
        let bestTeacher = skill.teachableBy[0];
        let bestMastery = this.getMasteryRecord(bestTeacher, skillId);

        for (const teacher of skill.teachableBy.slice(1)) {
          const mastery = this.getMasteryRecord(teacher, skillId);
          if (mastery && (!bestMastery || mastery.successRate > bestMastery.successRate)) {
            bestTeacher = teacher;
            bestMastery = mastery;
          }
        }

        assignments.set(skillId, bestTeacher);
      }
    }

    return assignments;
  }

  /**
   * Estimate learning duration for a skill
   */
  estimateLearningDuration(skillId) {
    const skill = this.skillCatalog.get(skillId);
    if (!skill) return 3600000; // 1 hour default

    // Base time by difficulty
    const baseTimes = {
      easy: 1800000,    // 30 minutes
      medium: 3600000,  // 1 hour
      hard: 7200000     // 2 hours
    };

    let duration = baseTimes[skill.difficulty] || baseTimes.medium;

    // Adjust based on avg mastery time if known
    if (skill.avgMasteryTime > 0) {
      duration = skill.avgMasteryTime;
    }

    return duration;
  }

  // ============================================
  // Query Methods
  // ============================================

  /**
   * Get all skills an agent can teach
   */
  getTeachableSkills(agentId) {
    const teachable = [];
    for (const [skillId, skill] of this.skillCatalog) {
      if (skill.teachableBy.includes(agentId)) {
        teachable.push({ skillId, skill });
      }
    }
    return teachable;
  }

  /**
   * Get agent's mastery summary
   */
  getAgentMasterySummary(agentId) {
    const agentMastery = this.agentMastery.get(agentId);
    if (!agentMastery) return { total: 0, byLevel: {} };

    const summary = {
      total: agentMastery.size,
      byLevel: {},
      skills: []
    };

    for (const [skillId, record] of agentMastery) {
      summary.byLevel[record.level] = (summary.byLevel[record.level] || 0) + 1;
      summary.skills.push({
        skillId,
        level: record.level,
        successRate: record.successRate,
        activations: record.activations
      });
    }

    return summary;
  }

  /**
   * Get teaching session by ID
   */
  getSession(sessionId) {
    return this.teachingSessions.get(sessionId) || null;
  }

  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.teachingSessions.values())
      .filter(s => s.status !== TEACHING_STATUS.MASTERED &&
                   s.status !== TEACHING_STATUS.REJECTED);
  }

  /**
   * Get skill catalog
   */
  getSkillCatalog() {
    return Array.from(this.skillCatalog.values());
  }

  /**
   * Update skill catalog entry
   */
  updateSkillCatalog(skillId, updates) {
    const skill = this.skillCatalog.get(skillId);
    if (skill) {
      Object.assign(skill, updates);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      activeSessions: this.teachingSessions.size,
      totalSkillsInCatalog: this.skillCatalog.size,
      totalAgentsTracked: this.agentMastery.size
    };
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Emit event to EventBus
   */
  emitEvent(eventType, data) {
    if (this.eventBus) {
      this.eventBus.publish(eventType, {
        ...data,
        agent: 'cross-agent-teacher',
        timestamp: Date.now()
      });
    }
    this.emit(eventType, data);
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    // Persist all mastery data
    for (const [agentId, skills] of this.agentMastery) {
      for (const [skillId, mastery] of skills) {
        await this.persistMastery(agentId, skillId, mastery);
      }
    }

    this.teachingSessions.clear();
    this.logger.info('CrossAgentTeacher shutdown complete');
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance
 * @param {Object} options - Configuration options
 * @returns {CrossAgentTeacher}
 */
export function getCrossAgentTeacher(options = {}) {
  if (!instance) {
    instance = new CrossAgentTeacher(options);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetCrossAgentTeacher() {
  if (instance) {
    instance.teachingSessions.clear();
    instance.agentMastery.clear();
    instance.skillCatalog.clear();
    instance.teachingHistory = [];
    instance.stats = {
      totalSessionsStarted: 0,
      totalSessionsCompleted: 0,
      totalSkillsShared: 0,
      totalSkillsReceived: 0,
      totalMasteriesAchieved: 0,
      averageTimeToMastery: 0,
      curriculaGenerated: 0
    };
    instance.initialized = false;
  }
  instance = null;
}

export { CrossAgentTeacher };
export default CrossAgentTeacher;
