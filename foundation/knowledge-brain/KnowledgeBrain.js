/**
 * KnowledgeBrain - Distributed collective intelligence system
 *
 * Revolutionary Enhancement: Collective intelligence that grows exponentially
 *
 * Features:
 * - Multi-backend storage (local, graph, cache)
 * - Vector similarity search
 * - Cross-reference learning
 * - Knowledge propagation to agents
 * - Experience-based learning
 * - Pattern extraction and storage
 */

import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

const logger = createLogger('KnowledgeBrain');

// Knowledge types
const KNOWLEDGE_TYPES = {
  CODE_PATTERN: 'code_pattern',
  BUG_FIX: 'bug_fix',
  ARCHITECTURE: 'architecture',
  BEST_PRACTICE: 'best_practice',
  ERROR_SOLUTION: 'error_solution',
  PERFORMANCE_TIP: 'performance_tip',
  SECURITY_PATTERN: 'security_pattern',
  TEST_PATTERN: 'test_pattern',
  API_PATTERN: 'api_pattern',
  DOCUMENTATION: 'documentation',
  LEARNED_SKILL: 'learned_skill',
  RL_POLICY: 'rl_policy',
  EXPERIENCE: 'experience',
  SKILL_TEST_RESULT: 'skill_test_result',
  TEACHING_CURRICULUM: 'teaching_curriculum',
  MASTERY_RECORD: 'mastery_record'
};

// Knowledge quality levels
const QUALITY_LEVELS = {
  VERIFIED: 'verified',       // Tested and confirmed working
  TRUSTED: 'trusted',         // From reliable source
  COMMUNITY: 'community',     // Community contributed
  EXPERIMENTAL: 'experimental' // New, unverified
};

class KnowledgeBrain {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;

    // Configuration
    this.config = {
      storageDir: options.storageDir || '.knowledge',
      maxMemoryItems: options.maxMemoryItems || 10000,
      enablePersistence: options.enablePersistence ?? true,
      enableGraphRelations: options.enableGraphRelations ?? true,
      similarityThreshold: options.similarityThreshold || 0.7
    };

    // In-memory knowledge store
    this.knowledge = new Map();

    // Vector index for similarity search (simplified)
    this.vectorIndex = new Map();

    // Relationship graph
    this.relationships = {
      nodes: new Map(),      // id -> knowledge item
      edges: new Map(),      // id -> [related ids]
      types: new Map()       // relationship type -> [edge ids]
    };

    // Statistics
    this.stats = {
      totalItems: 0,
      byType: {},
      queries: 0,
      hits: 0,
      learnings: 0
    };

    // Initialize type counters
    Object.values(KNOWLEDGE_TYPES).forEach(type => {
      this.stats.byType[type] = 0;
    });
  }

  /**
   * Initialize the knowledge brain
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();
    } catch (error) {
      this.logger.warn('EventBus not available');
    }

    // Create storage directory
    if (this.config.enablePersistence) {
      try {
        await fs.mkdir(this.config.storageDir, { recursive: true });
        await fs.mkdir(path.join(this.config.storageDir, 'items'), { recursive: true });
        await fs.mkdir(path.join(this.config.storageDir, 'index'), { recursive: true });
      } catch (error) {
        this.logger.warn('Could not create storage directory', { error: error.message });
      }

      // Load existing knowledge
      await this.loadFromDisk();
    }

    // Subscribe to events for learning
    if (this.eventBus) {
      this.subscribeToEvents();
    }

    this.initialized = true;
    this.logger.info('KnowledgeBrain initialized', {
      items: this.knowledge.size,
      persistence: this.config.enablePersistence
    });
  }

  /**
   * Subscribe to events for automatic learning
   */
  subscribeToEvents() {
    // Learn from completed tasks
    this.eventBus.subscribe(
      EventTypes.AGENT_COMPLETED,
      'knowledge-brain',
      async (data) => {
        if (data.knowledge) {
          await this.learn(data.knowledge);
        }
      }
    );

    // Learn from test fixes
    this.eventBus.subscribe(
      EventTypes.FIX_COMPLETED,
      'knowledge-brain',
      async (data) => {
        if (data.fix) {
          await this.learn({
            type: KNOWLEDGE_TYPES.BUG_FIX,
            content: data.fix,
            metadata: { agent: data.agent, success: data.success }
          });
        }
      }
    );
  }

  /**
   * Store new knowledge
   * @param {Object} experience The experience/knowledge to store
   * @returns {Promise<Object>} Stored knowledge item
   */
  async learn(experience) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      type = KNOWLEDGE_TYPES.CODE_PATTERN,
      content,
      metadata = {},
      tags = [],
      quality = QUALITY_LEVELS.EXPERIMENTAL,
      relatedTo = []
    } = experience;

    // Generate ID
    const id = this.generateId(content);

    // Check for duplicates
    if (this.knowledge.has(id)) {
      // Update existing
      const existing = this.knowledge.get(id);
      existing.accessCount++;
      existing.lastAccessed = Date.now();
      existing.quality = this.upgradeQuality(existing.quality, quality);
      return existing;
    }

    // Create knowledge item
    const item = {
      id,
      type,
      content,
      metadata,
      tags,
      quality,
      vector: this.generateVector(content),
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      usefulness: 0
    };

    // Store in memory
    this.knowledge.set(id, item);

    // Update vector index
    this.indexVector(id, item.vector);

    // Create relationships
    if (this.config.enableGraphRelations) {
      this.relationships.nodes.set(id, item);

      for (const relatedId of relatedTo) {
        this.addRelationship(id, relatedId, 'related');
      }

      // Auto-discover relationships
      await this.discoverRelationships(item);
    }

    // Persist to disk
    if (this.config.enablePersistence) {
      await this.persistItem(item);
    }

    // Update statistics
    this.stats.totalItems++;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    this.stats.learnings++;

    this.logger.debug('Learned new knowledge', { id: id.substring(0, 8), type });

    // Publish event
    if (this.eventBus) {
      this.eventBus.publish('KNOWLEDGE_LEARNED', {
        agent: 'knowledge-brain',
        id,
        type
      });
    }

    return item;
  }

  /**
   * Query knowledge base
   * @param {string|Object} query The query
   * @returns {Promise<Array>} Matching knowledge items
   */
  async recall(query) {
    if (!this.initialized) {
      await this.initialize();
    }

    this.stats.queries++;
    const startTime = Date.now();

    let results = [];

    if (typeof query === 'string') {
      // Text-based search
      results = await this.searchByText(query);
    } else {
      // Structured query
      results = await this.searchStructured(query);
    }

    if (results.length > 0) {
      this.stats.hits++;
    }

    // Update access times
    for (const item of results) {
      item.lastAccessed = Date.now();
      item.accessCount++;
    }

    this.logger.debug('Knowledge recall', {
      query: typeof query === 'string' ? query.substring(0, 50) : 'structured',
      results: results.length,
      timeMs: Date.now() - startTime
    });

    return results;
  }

  /**
   * Search by text using vector similarity
   */
  async searchByText(text) {
    const queryVector = this.generateVector(text);
    const candidates = [];

    // Find similar vectors
    for (const [id, item] of this.knowledge) {
      const similarity = this.cosineSimilarity(queryVector, item.vector);

      if (similarity >= this.config.similarityThreshold) {
        candidates.push({
          ...item,
          similarity
        });
      }
    }

    // Sort by similarity
    candidates.sort((a, b) => b.similarity - a.similarity);

    return candidates.slice(0, 10);
  }

  /**
   * Structured query search
   */
  async searchStructured(query) {
    const { type, tags, minQuality, limit = 10 } = query;
    let results = Array.from(this.knowledge.values());

    // Filter by type
    if (type) {
      results = results.filter(item => item.type === type);
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      results = results.filter(item =>
        tags.some(tag => item.tags.includes(tag))
      );
    }

    // Filter by quality
    if (minQuality) {
      const qualityOrder = [
        QUALITY_LEVELS.EXPERIMENTAL,
        QUALITY_LEVELS.COMMUNITY,
        QUALITY_LEVELS.TRUSTED,
        QUALITY_LEVELS.VERIFIED
      ];
      const minIndex = qualityOrder.indexOf(minQuality);
      results = results.filter(item =>
        qualityOrder.indexOf(item.quality) >= minIndex
      );
    }

    // Sort by usefulness and access count
    results.sort((a, b) => {
      const scoreA = a.usefulness * 10 + a.accessCount;
      const scoreB = b.usefulness * 10 + b.accessCount;
      return scoreB - scoreA;
    });

    return results.slice(0, limit);
  }

  /**
   * Find similar knowledge items
   */
  async findSimilar(itemOrId, limit = 5) {
    const item = typeof itemOrId === 'string'
      ? this.knowledge.get(itemOrId)
      : itemOrId;

    if (!item) return [];

    const similar = [];

    for (const [id, other] of this.knowledge) {
      if (id === item.id) continue;

      const similarity = this.cosineSimilarity(item.vector, other.vector);
      if (similarity >= this.config.similarityThreshold) {
        similar.push({ ...other, similarity });
      }
    }

    similar.sort((a, b) => b.similarity - a.similarity);
    return similar.slice(0, limit);
  }

  /**
   * Get related knowledge through graph
   */
  async getRelated(itemId, depth = 1) {
    if (!this.config.enableGraphRelations) return [];

    const visited = new Set();
    const related = [];

    const traverse = (id, currentDepth) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const edges = this.relationships.edges.get(id) || [];
      for (const relatedId of edges) {
        if (!visited.has(relatedId)) {
          const item = this.knowledge.get(relatedId);
          if (item) {
            related.push({ ...item, depth: currentDepth });
          }
          traverse(relatedId, currentDepth + 1);
        }
      }
    };

    traverse(itemId, 1);
    return related;
  }

  /**
   * Cross-reference new knowledge with existing
   */
  async crossReference(item) {
    const references = [];

    // Find similar items
    const similar = await this.findSimilar(item, 10);

    for (const simItem of similar) {
      references.push({
        id: simItem.id,
        type: 'similar',
        similarity: simItem.similarity
      });
    }

    // Find items with matching tags
    for (const tag of item.tags || []) {
      const tagMatches = Array.from(this.knowledge.values())
        .filter(k => k.id !== item.id && k.tags?.includes(tag))
        .slice(0, 5);

      for (const match of tagMatches) {
        if (!references.find(r => r.id === match.id)) {
          references.push({
            id: match.id,
            type: 'tag-match',
            tag
          });
        }
      }
    }

    return references;
  }

  /**
   * Propagate learning to all agents
   */
  async propagateLearning(knowledge) {
    if (this.eventBus) {
      this.eventBus.publish('KNOWLEDGE_UPDATE', {
        agent: 'knowledge-brain',
        knowledge,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Mark knowledge as useful (feedback)
   */
  async markUseful(itemId, useful = true) {
    const item = this.knowledge.get(itemId);
    if (item) {
      item.usefulness += useful ? 1 : -1;

      // Upgrade quality if highly useful
      if (item.usefulness >= 5 && item.quality === QUALITY_LEVELS.EXPERIMENTAL) {
        item.quality = QUALITY_LEVELS.COMMUNITY;
      }
      if (item.usefulness >= 10 && item.quality === QUALITY_LEVELS.COMMUNITY) {
        item.quality = QUALITY_LEVELS.TRUSTED;
      }

      // Persist update
      if (this.config.enablePersistence) {
        await this.persistItem(item);
      }
    }
  }

  /**
   * Generate content ID
   */
  generateId(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    return crypto.createHash('sha256').update(str).digest('hex').substring(0, 16);
  }

  /**
   * Generate simple vector for content (TF-IDF style)
   */
  generateVector(content) {
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    const words = str.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);

    // Simple term frequency vector
    const tf = new Map();
    for (const word of words) {
      tf.set(word, (tf.get(word) || 0) + 1);
    }

    // Normalize
    const maxFreq = Math.max(...tf.values());
    const vector = {};
    for (const [word, freq] of tf) {
      vector[word] = freq / maxFreq;
    }

    return vector;
  }

  /**
   * Index vector for similarity search
   */
  indexVector(id, vector) {
    for (const [term, weight] of Object.entries(vector)) {
      if (!this.vectorIndex.has(term)) {
        this.vectorIndex.set(term, new Map());
      }
      this.vectorIndex.get(term).set(id, weight);
    }
  }

  /**
   * Calculate cosine similarity between vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    const terms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const term of terms) {
      const a = vecA[term] || 0;
      const b = vecB[term] || 0;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Add relationship between knowledge items
   */
  addRelationship(fromId, toId, type = 'related') {
    if (!this.relationships.edges.has(fromId)) {
      this.relationships.edges.set(fromId, []);
    }
    if (!this.relationships.edges.has(toId)) {
      this.relationships.edges.set(toId, []);
    }

    this.relationships.edges.get(fromId).push(toId);
    this.relationships.edges.get(toId).push(fromId);

    const edgeId = `${fromId}-${toId}`;
    if (!this.relationships.types.has(type)) {
      this.relationships.types.set(type, []);
    }
    this.relationships.types.get(type).push(edgeId);
  }

  /**
   * Auto-discover relationships for new item
   */
  async discoverRelationships(item) {
    const similar = await this.findSimilar(item, 5);

    for (const simItem of similar) {
      if (simItem.similarity >= 0.8) {
        this.addRelationship(item.id, simItem.id, 'highly-similar');
      } else {
        this.addRelationship(item.id, simItem.id, 'related');
      }
    }

    // Connect by type
    for (const [id, other] of this.knowledge) {
      if (id !== item.id && other.type === item.type) {
        // Only connect if not already connected
        const edges = this.relationships.edges.get(item.id) || [];
        if (!edges.includes(id)) {
          this.addRelationship(item.id, id, 'same-type');
        }
      }
    }
  }

  /**
   * Upgrade quality based on new evidence
   */
  upgradeQuality(current, newQuality) {
    const order = [
      QUALITY_LEVELS.EXPERIMENTAL,
      QUALITY_LEVELS.COMMUNITY,
      QUALITY_LEVELS.TRUSTED,
      QUALITY_LEVELS.VERIFIED
    ];

    const currentIndex = order.indexOf(current);
    const newIndex = order.indexOf(newQuality);

    return order[Math.max(currentIndex, newIndex)];
  }

  /**
   * Persist item to disk
   */
  async persistItem(item) {
    try {
      const filePath = path.join(
        this.config.storageDir,
        'items',
        `${item.id}.json`
      );
      await fs.writeFile(filePath, JSON.stringify(item, null, 2));
    } catch (error) {
      this.logger.warn('Failed to persist knowledge item', { error: error.message });
    }
  }

  /**
   * Load knowledge from disk
   */
  async loadFromDisk() {
    try {
      const itemsDir = path.join(this.config.storageDir, 'items');
      const files = await fs.readdir(itemsDir);
      let loaded = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        try {
          const filePath = path.join(itemsDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const item = JSON.parse(content);

          this.knowledge.set(item.id, item);
          this.indexVector(item.id, item.vector);

          if (this.config.enableGraphRelations) {
            this.relationships.nodes.set(item.id, item);
          }

          loaded++;
          this.stats.totalItems++;
          this.stats.byType[item.type] = (this.stats.byType[item.type] || 0) + 1;
        } catch (error) {
          // Skip invalid files
        }
      }

      this.logger.info(`Loaded ${loaded} knowledge items from disk`);
    } catch (error) {
      this.logger.warn('Failed to load knowledge from disk', { error: error.message });
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      hitRate: this.stats.queries > 0
        ? (this.stats.hits / this.stats.queries * 100).toFixed(1) + '%'
        : '0%',
      relationshipCount: this.relationships.edges.size
    };
  }

  /**
   * Get top knowledge items
   */
  getTopItems(limit = 10) {
    return Array.from(this.knowledge.values())
      .sort((a, b) => {
        const scoreA = a.usefulness * 10 + a.accessCount;
        const scoreB = b.usefulness * 10 + b.accessCount;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /**
   * Export knowledge base
   */
  async export() {
    return {
      items: Array.from(this.knowledge.values()),
      stats: this.getStats(),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * Import knowledge base
   */
  async import(data) {
    for (const item of data.items || []) {
      this.knowledge.set(item.id, item);
      this.indexVector(item.id, item.vector);

      if (this.config.enableGraphRelations) {
        this.relationships.nodes.set(item.id, item);
      }
    }

    this.logger.info(`Imported ${data.items?.length || 0} knowledge items`);
  }

  async storeLearnedSkill(skill) {
    return await this.learn({ type: KNOWLEDGE_TYPES.LEARNED_SKILL, content: skill, quality: QUALITY_LEVELS.EXPERIMENTAL, tags: ['generated-skill', skill.sourcePattern, skill.name].filter(Boolean), metadata: { skillId: skill.id, skillName: skill.name, sourcePattern: skill.sourcePattern, confidence: skill.metadata?.confidence } });
  }

  getLearnedSkills(options = {}) {
    const skills = Array.from(this.knowledge.values()).filter(item => item.type === KNOWLEDGE_TYPES.LEARNED_SKILL);
    return options.minConfidence ? skills.filter(s => (s.metadata?.confidence || 0) >= options.minConfidence) : skills;
  }

  async storeRLPolicy(policy) {
    return await this.learn({ type: KNOWLEDGE_TYPES.RL_POLICY, content: policy, quality: QUALITY_LEVELS.EXPERIMENTAL, tags: ['rl-policy', policy.state], metadata: { state: policy.state, qValues: policy.qValues, updatedAt: Date.now() } });
  }

  getRLPolicy(state) {
    for (const item of this.knowledge.values()) { if (item.type === KNOWLEDGE_TYPES.RL_POLICY && item.metadata?.state === state) return item; }
    return null;
  }

  async loadRLPolicy() {
    const policies = Array.from(this.knowledge.values()).filter(item => item.type === KNOWLEDGE_TYPES.RL_POLICY);
    if (policies.length === 0) return null;
    const latest = policies.sort((a, b) => (b.metadata?.updatedAt || 0) - (a.metadata?.updatedAt || 0))[0];
    return latest?.content || null;
  }

  async storeExperience(exp) {
    return await this.learn({ type: KNOWLEDGE_TYPES.EXPERIENCE, content: exp, quality: QUALITY_LEVELS.EXPERIMENTAL, tags: ['experience', exp.pattern].filter(Boolean), metadata: { pattern: exp.pattern, outcome: exp.outcome, reward: exp.reward, timestamp: Date.now() } });
  }

  getExperiencesByPattern(pattern) {
    return Array.from(this.knowledge.values()).filter(item => item.type === KNOWLEDGE_TYPES.EXPERIENCE && item.metadata?.pattern === pattern);
  }

  async storeSkillTestResult(result) {
    return await this.learn({ type: KNOWLEDGE_TYPES.SKILL_TEST_RESULT, content: result, quality: result.passed ? QUALITY_LEVELS.VERIFIED : QUALITY_LEVELS.EXPERIMENTAL, tags: ['skill-test', result.skillId, result.passed ? 'passed' : 'failed'], metadata: { skillId: result.skillId, testId: result.testId, passed: result.passed, timestamp: Date.now() } });
  }

  async storeMasteryRecord(agentId, skillId, mastery) {
    const recordId = `mastery:${agentId}:${skillId}`;
    return await this.learn({ type: KNOWLEDGE_TYPES.MASTERY_RECORD, content: { agentId, skillId, ...mastery }, quality: QUALITY_LEVELS.TRUSTED, tags: ['mastery', agentId, skillId], metadata: { recordId, agentId, skillId, level: mastery.level, updatedAt: Date.now() } });
  }

  getMasteryRecord(agentId, skillId) {
    const recordId = `mastery:${agentId}:${skillId}`;
    for (const item of this.knowledge.values()) { if (item.type === KNOWLEDGE_TYPES.MASTERY_RECORD && item.metadata?.recordId === recordId) return item; }
    return null;
  }

  getLearningStats() {
    const items = Array.from(this.knowledge.values());
    const learnedSkills = items.filter(i => i.type === KNOWLEDGE_TYPES.LEARNED_SKILL);
    const experiences = items.filter(i => i.type === KNOWLEDGE_TYPES.EXPERIENCE);
    const policies = items.filter(i => i.type === KNOWLEDGE_TYPES.RL_POLICY);
    const testResults = items.filter(i => i.type === KNOWLEDGE_TYPES.SKILL_TEST_RESULT);
    return { learnedSkillCount: learnedSkills.length, totalSkillActivations: learnedSkills.reduce((sum, s) => sum + (s.accessCount || 0), 0), experienceCount: experiences.length, policyCount: policies.length, testResultCount: testResults.length, passedTestCount: testResults.filter(t => t.metadata?.passed).length };
  }

  async storeTeachingCurriculum(curriculum) {
    return await this.learn({ type: KNOWLEDGE_TYPES.TEACHING_CURRICULUM, content: curriculum, quality: QUALITY_LEVELS.TRUSTED, tags: ['curriculum', curriculum.targetSkill, curriculum.toAgent].filter(Boolean), metadata: { curriculumId: curriculum.id, targetSkill: curriculum.targetSkill, fromAgent: curriculum.fromAgent, toAgent: curriculum.toAgent, createdAt: Date.now() } });
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of KnowledgeBrain
 * @returns {KnowledgeBrain}
 */
export function getKnowledgeBrain(options = {}) {
  if (!instance) {
    instance = new KnowledgeBrain(options);
  }
  return instance;
}

export { KnowledgeBrain, KNOWLEDGE_TYPES, QUALITY_LEVELS };
export default KnowledgeBrain;
