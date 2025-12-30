/**
 * Minions - GruAgent (Gru)
 * ========================
 * Named after Gru - the mastermind.
 * Client Interface Agent that provides an HTML dashboard for discussing
 * projects with clients and coordinating with other Minions agents.
 *
 * Part of Minions Client Interface System
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../foundation/common/logger.js';

import WebServer from './WebServer.js';
import ConversationEngine from './ConversationEngine.js';
import ProjectIntake from './ProjectIntake.js';
import StatusTracker, { Phase } from './StatusTracker.js';
import { getConversationStore } from './ConversationStore.js';

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  LISTENING: 'LISTENING',
  CONVERSING: 'CONVERSING',
  COLLECTING: 'COLLECTING',
  SCANNING: 'SCANNING',
  PLANNING: 'PLANNING',
  CONFIRMING: 'CONFIRMING',
  EXECUTING: 'EXECUTING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Event Types
export const GruEvents = {
  GRU_START: 'gru:start',
  GRU_STARTED: 'gru:started',
  CLIENT_CONNECTED: 'gru:client:connected',
  CONVERSATION_STARTED: 'gru:conversation:started',
  CONVERSATION_MESSAGE: 'gru:conversation:message',
  PROJECT_NEW: 'gru:project:new',
  PROJECT_EXISTING: 'gru:project:existing',
  SCAN_COMPLETE: 'gru:scan:complete',
  PLAN_READY: 'gru:plan:ready',
  PLAN_APPROVED: 'gru:plan:approved',
  EXECUTION_STARTED: 'gru:execution:started',
  EXECUTION_PAUSED: 'gru:execution:paused',
  EXECUTION_RESUMED: 'gru:execution:resumed',
  EXECUTION_STOPPED: 'gru:execution:stopped',
  STATUS_UPDATE: 'gru:status:update',
  GRU_ERROR: 'gru:error'
};

export class GruAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'GruAgent';
    this.alias = 'Gru';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;
    this.logger = createLogger(this.name);

    // Configuration
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      port: config.port || 2505,
      ...config
    };

    // Sub-components
    this.webServer = new WebServer(this.config);
    this.conversation = new ConversationEngine(this.config);
    this.projectIntake = new ProjectIntake(this.config);
    this.statusTracker = new StatusTracker(this.config);
    this.conversationStore = getConversationStore(this.config);

    // External agent references (set via setAgents)
    this.silas = null; // ProjectManagerAgent
    this.lucy = null;  // ProjectCompletionAgent
    this.nefario = null; // NefarioAgent (Dr. Nefario)

    // Learning system reference (set via setLearningSystem)
    this.knowledgeBrain = null;
    this.learningEventLog = [];

    // Current state
    this.currentPlan = null;
    this.currentProject = null;
    this.currentConversationId = null;

    this._setupInternalHandlers();
    this._setupAPIHandlers();
  }

  /**
   * Set references to other agents
   * @param {object} agents - { silas, lucy, nefario }
   */
  setAgents(agents) {
    if (agents.silas) this.silas = agents.silas;
    if (agents.lucy) this.lucy = agents.lucy;
    if (agents.nefario) this.nefario = agents.nefario;

    // Subscribe to Lucy events for status tracking
    if (this.lucy) {
      this.lucy.on('completion:started', (data) => this.statusTracker.onLucyEvent('completion:started', data));
      this.lucy.on('completion:progress:updated', (data) => this.statusTracker.onLucyEvent('completion:progress:updated', data));
      this.lucy.on('completion:gap:detected', (data) => this.statusTracker.onLucyEvent('completion:gap:detected', data));
      this.lucy.on('completion:gap:resolved', (data) => this.statusTracker.onLucyEvent('completion:gap:resolved', data));
      this.lucy.on('completion:paused', (data) => this.statusTracker.onLucyEvent('completion:paused', data));
      this.lucy.on('completion:finished', (data) => this.statusTracker.onLucyEvent('completion:finished', data));
      this.lucy.on('completion:error', (data) => this.statusTracker.onLucyEvent('completion:error', data));
    }

    // Subscribe to Silas events
    if (this.silas) {
      this.silas.on('project:connected', (data) => this.statusTracker.onSilasEvent('project:connected', data));
      this.silas.on('project:scanned', (data) => this.statusTracker.onSilasEvent('project:scanned', data));
      this.silas.on('project:error', (data) => this.statusTracker.onSilasEvent('project:error', data));
    }
  }

  /**
   * Initialize the agent
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;
    this.logger.info(`Initializing ${this.name} (${this.alias})...`);

    try {
      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      // Initialize conversation engine (checks AI availability)
      await this.conversation.initialize();

      // Initialize conversation store
      await this.conversationStore.initialize();

      this.state = AgentState.IDLE;
      this.emit('initialized', { agent: this.name, alias: this.alias });

      return { success: true, agent: this.name };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Failed to initialize: ${error.message}`);
      this.emit('error', { agent: this.name, error: error.message });
      throw error;
    }
  }

  /**
   * Set learning system reference
   * @param {object} knowledgeBrain - KnowledgeBrain instance
   */
  setLearningSystem(knowledgeBrain) {
    this.knowledgeBrain = knowledgeBrain;
    this._subscribeLearningEvents();
    this.logger.info('Learning system connected');
  }

  /**
   * Subscribe to learning system events
   * @private
   */
  _subscribeLearningEvents() {
    if (!this.knowledgeBrain) return;

    const eventTypes = [
      'pattern:detected', 'pattern:consolidated',
      'skill:generated', 'skill:deployed', 'skill:activated',
      'reward:recorded', 'policy:updated',
      'abtest:started', 'abtest:completed',
      'teaching:started', 'teaching:completed', 'mastery:achieved'
    ];

    for (const eventType of eventTypes) {
      this.knowledgeBrain.on?.(eventType, (data) => {
        this._recordLearningEvent(`learning:${eventType}`, data);
      });
    }
  }

  /**
   * Record a learning event
   * @private
   * @param {string} type - Event type
   * @param {object} data - Event data
   */
  _recordLearningEvent(type, data) {
    const event = {
      type,
      data,
      timestamp: new Date().toISOString()
    };

    this.learningEventLog.unshift(event);

    // Keep only last 500 events - use pop to avoid array reassignment
    while (this.learningEventLog.length > 500) {
      this.learningEventLog.pop();
    }

    // Broadcast to connected clients
    this.webServer.broadcast({ type, data });
  }

  /**
   * Start the web server
   */
  async start() {
    this.logger.info('Starting Gru web interface...');

    try {
      const result = await this.webServer.start();
      this.state = AgentState.LISTENING;

      this.emit(GruEvents.GRU_STARTED, result);
      this.logger.info(`Gru is ready at http://${result.host}:${result.port}`);

      return result;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Failed to start web server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop the web server
   */
  async stop() {
    this.logger.info('Stopping Gru web interface...');

    await this.webServer.stop();
    this.state = AgentState.IDLE;

    return { success: true };
  }

  /**
   * Handle incoming chat message
   * @param {string} message - User message
   * @param {string} clientId - Client ID
   */
  async handleMessage(message, clientId) {
    this.state = AgentState.CONVERSING;

    try {
      const response = await this.conversation.chat(message);

      // Broadcast response to client
      this.webServer.sendToClient(clientId, {
        type: 'chat:response',
        message: response.content,
        provider: response.provider
      });

      this.emit(GruEvents.CONVERSATION_MESSAGE, {
        clientId,
        userMessage: message,
        response: response.content
      });

      return response;
    } catch (error) {
      this.logger.error(`Chat error: ${error.message}`);

      this.webServer.sendToClient(clientId, {
        type: 'error',
        message: `Sorry, I encountered an error: ${error.message}`
      });

      throw error;
    }
  }

  /**
   * Start new project flow
   * @param {object} projectInfo - Initial project info
   * @param {string} clientId - Client ID
   */
  async startNewProject(projectInfo, clientId) {
    this.state = AgentState.COLLECTING;

    const result = await this.projectIntake.startNewProject(projectInfo);

    this.webServer.sendToClient(clientId, {
      type: 'project:flow',
      flow: 'new',
      data: result
    });

    this.emit(GruEvents.PROJECT_NEW, { clientId, projectInfo });

    return result;
  }

  /**
   * Start existing project flow
   * @param {object} projectInfo - Project info including path
   * @param {string} clientId - Client ID
   */
  async startExistingProject(projectInfo, clientId) {
    this.state = AgentState.COLLECTING;

    const result = await this.projectIntake.startExistingProject(projectInfo);

    if (projectInfo.path) {
      // Auto-scan if path provided
      this.state = AgentState.SCANNING;
      const scanResult = await this.projectIntake.collectProjectInfo({ path: projectInfo.path });

      this.webServer.sendToClient(clientId, {
        type: 'project:scanned',
        summary: scanResult.summary,
        detected: scanResult.detected
      });

      this.emit(GruEvents.SCAN_COMPLETE, { clientId, result: scanResult });
      return scanResult;
    }

    this.webServer.sendToClient(clientId, {
      type: 'project:needsPath'
    });

    this.emit(GruEvents.PROJECT_EXISTING, { clientId, projectInfo });

    return result;
  }

  /**
   * Scan existing project
   * @param {string} projectPath - Path to project
   * @param {string} clientId - Client ID
   */
  async scanProject(projectPath, clientId) {
    this.state = AgentState.SCANNING;

    const result = await this.projectIntake.detectProjectStructure(projectPath);

    this.webServer.sendToClient(clientId, {
      type: 'project:scanned',
      summary: result.summary,
      detected: result.detected
    });

    this.emit(GruEvents.SCAN_COMPLETE, { clientId, result });

    return result;
  }

  /**
   * Request plan generation from Dr. Nefario
   * @param {string} clientId - Client ID
   */
  async requestPlan(clientId) {
    this.state = AgentState.PLANNING;

    // Get conversation summary
    const summary = await this.conversation.summarize();
    const projectConfig = this.projectIntake.generateProjectConfig();

    // Request plan from Dr. Nefario
    if (this.nefario) {
      this.currentPlan = await this.nefario.generatePlan({
        conversationSummary: summary,
        projectConfig
      });
    } else {
      // Fallback: Use conversation summary as basic plan
      this.currentPlan = {
        project: projectConfig,
        summary,
        features: summary.features || [],
        generated: new Date().toISOString()
      };
    }

    this.state = AgentState.CONFIRMING;

    this.webServer.sendToClient(clientId, {
      type: 'plan:created',
      plan: this.currentPlan
    });

    this.emit(GruEvents.PLAN_READY, { clientId, plan: this.currentPlan });

    return this.currentPlan;
  }

  /**
   * Approve plan and start execution
   * @param {string} clientId - Client ID
   */
  async approvePlan(clientId) {
    if (!this.currentPlan) {
      throw new Error('No plan to approve');
    }

    this.emit(GruEvents.PLAN_APPROVED, { clientId, plan: this.currentPlan });

    // Start execution
    await this.startExecution(clientId);

    return { success: true };
  }

  /**
   * Start execution via Silas and Lucy
   * @param {string} clientId - Client ID
   */
  async startExecution(clientId) {
    this.state = AgentState.EXECUTING;

    const projectConfig = this.projectIntake.generateProjectConfig();
    this.currentProject = projectConfig;

    // Start status tracking
    this.statusTracker.start(projectConfig);

    // Broadcast status updates to client
    this.statusTracker.on('updated', (status) => {
      // Check if execution completed
      if (status.phase === Phase.COMPLETED) {
        this.webServer.sendToClient(clientId, {
          type: 'execution:completed',
          summary: {
            project: projectConfig.name,
            percentage: status.progress,
            duration: status.elapsedFormatted,
            message: status.lastUpdate?.message || 'Execution completed successfully'
          }
        });
        this.state = AgentState.IDLE;
        return;
      }

      // Check if error occurred
      if (status.phase === Phase.ERROR) {
        this.webServer.sendToClient(clientId, {
          type: 'error',
          message: status.lastUpdate?.message || 'An error occurred during execution'
        });
        return;
      }

      // Regular status update
      this.webServer.sendToClient(clientId, {
        type: 'execution:updated',
        phase: status.phase,
        progress: status.progress,
        elapsed: status.elapsed,
        elapsedFormatted: status.elapsedFormatted,
        message: status.lastUpdate?.message || `Phase: ${status.phase}`
      });
    });

    try {
      // Connect project via Silas
      if (this.silas && projectConfig.type === 'existing') {
        this.statusTracker.update({
          phase: Phase.CONNECTING,
          message: 'Connecting to project via Silas...'
        });

        await this.silas.connect(projectConfig.sourcePath, {
          name: projectConfig.name
        });
      }

      // Start completion via Lucy
      if (this.lucy) {
        this.statusTracker.update({
          phase: Phase.ANALYZING,
          message: 'Starting autonomous completion via Lucy...'
        });

        const project = this.silas
          ? this.silas.getProject(projectConfig.name)
          : projectConfig;

        await this.lucy.startCompletion(project, {
          plan: this.currentPlan
        });
      }

      // Notify client that execution has started
      this.webServer.sendToClient(clientId, {
        type: 'execution:started',
        project: projectConfig.name
      });

      this.emit(GruEvents.EXECUTION_STARTED, { clientId, project: projectConfig });

    } catch (error) {
      this.statusTracker.addError({ message: error.message });
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Pause execution
   * @param {string} clientId - Client ID
   */
  async pauseExecution(clientId) {
    if (this.lucy) {
      await this.lucy.pauseCompletion();
    }

    this.state = AgentState.PAUSED;
    this.statusTracker.pause();

    this.webServer.sendToClient(clientId, {
      type: 'execution:paused'
    });

    this.emit(GruEvents.EXECUTION_PAUSED, { clientId });

    return { success: true };
  }

  /**
   * Resume execution
   * @param {string} clientId - Client ID
   */
  async resumeExecution(clientId) {
    if (this.lucy) {
      await this.lucy.resumeCompletion();
    }

    this.state = AgentState.EXECUTING;
    this.statusTracker.resume();

    this.webServer.sendToClient(clientId, {
      type: 'execution:resumed'
    });

    this.emit(GruEvents.EXECUTION_RESUMED, { clientId });

    return { success: true };
  }

  /**
   * Stop execution
   * @param {string} clientId - Client ID
   */
  async stopExecution(clientId) {
    if (this.lucy) {
      await this.lucy.stopCompletion();
    }

    this.state = AgentState.IDLE;
    this.statusTracker.reset();

    this.webServer.sendToClient(clientId, {
      type: 'execution:stopped'
    });

    this.emit(GruEvents.EXECUTION_STOPPED, { clientId });

    return { success: true };
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      name: this.name,
      alias: this.alias,
      version: this.version,
      state: this.state,
      server: this.webServer.getStatus(),
      execution: this.statusTracker.getStatus(),
      currentProject: this.currentProject?.name || null
    };
  }

  /**
   * Broadcast status to all clients
   */
  broadcastStatus() {
    const status = this.getStatus();
    this.webServer.broadcast({
      type: 'status:update',
      status
    });
    return status;
  }

  // ==================== Private Methods ====================

  _setupInternalHandlers() {
    // Handle WebSocket events from clients
    this.webServer.on('chat:message', async ({ clientId, message }) => {
      await this.handleMessage(message, clientId);
    });

    this.webServer.on('project:new', async ({ clientId, ...data }) => {
      await this.startNewProject(data, clientId);
    });

    this.webServer.on('project:existing', async ({ clientId, ...data }) => {
      await this.startExistingProject(data, clientId);
    });

    this.webServer.on('project:confirm', async ({ clientId, confirmed, corrections }) => {
      const result = await this.projectIntake.confirmStructure({ confirmed, corrections });
      if (result.complete) {
        await this.requestPlan(clientId);
      } else {
        this.webServer.sendToClient(clientId, {
          type: 'project:needsCorrection',
          data: result
        });
      }
    });

    this.webServer.on('plan:approve', async ({ clientId }) => {
      await this.approvePlan(clientId);
    });

    this.webServer.on('plan:edit', async ({ clientId }) => {
      // Switch back to chat for plan modifications
      this.state = AgentState.CONVERSING;
      this.webServer.sendToClient(clientId, {
        type: 'plan:needsChanges'
      });
    });

    this.webServer.on('execution:pause', async ({ clientId }) => {
      await this.pauseExecution(clientId);
    });

    this.webServer.on('execution:resume', async ({ clientId }) => {
      await this.resumeExecution(clientId);
    });

    this.webServer.on('execution:stop', async ({ clientId }) => {
      await this.stopExecution(clientId);
    });

    this.webServer.on('client:connected', ({ clientId }) => {
      // Send greeting when client connects
      this.webServer.sendToClient(clientId, {
        type: 'chat:greeting',
        content: this.conversation.getGreeting()
      });
      this.emit(GruEvents.CLIENT_CONNECTED, { clientId });
    });
  }

  _subscribeToEvents() {
    if (!this.eventBus) return;

    this.eventBus.subscribe(GruEvents.GRU_START, this.name, async () => {
      await this.start();
    });
  }

  /**
   * Setup API handlers for WebServer events
   * @private
   */
  _setupAPIHandlers() {
    // ============ Conversation API Handlers ============

    this.webServer.on('api:conversations:list', async ({ callback }) => {
      const conversations = this.conversationStore.getAll();
      callback(conversations);
    });

    this.webServer.on('api:conversations:grouped', async ({ callback }) => {
      const grouped = this.conversationStore.getGroupedByProject();
      callback(grouped);
    });

    this.webServer.on('api:conversations:create', async ({ projectName, title, callback }) => {
      const conversation = await this.conversationStore.create({ projectName, title });
      callback(conversation);
    });

    this.webServer.on('api:conversations:get', async ({ id, callback }) => {
      const conversation = this.conversationStore.get(id);
      callback(conversation);
    });

    this.webServer.on('api:conversations:update', async ({ id, updates, callback }) => {
      // Handle message appending
      if (updates.messages && Array.isArray(updates.messages)) {
        for (const msg of updates.messages) {
          await this.conversationStore.addMessage(id, msg);
        }
        const updated = this.conversationStore.get(id);
        callback(updated);
      } else {
        const updated = await this.conversationStore.update(id, updates);
        callback(updated);
      }
    });

    this.webServer.on('api:conversations:delete', async ({ id, callback }) => {
      const success = await this.conversationStore.delete(id);
      callback(success);
    });

    // ============ Project Discovery API Handlers ============

    this.webServer.on('api:projects:discover', async ({ callback }) => {
      try {
        const projects = await this.projectIntake.discoverProjects();
        callback(projects);
      } catch (error) {
        this.logger.error(`Project discovery failed: ${error.message}`);
        callback([]);
      }
    });

    // ============ Learning System API Handlers ============

    this.webServer.on('api:learning:stats', ({ callback }) => {
      if (!this.knowledgeBrain) {
        callback({ error: 'Learning system not connected' });
        return;
      }

      try {
        const stats = this.knowledgeBrain.getStats?.() || {};
        callback(stats);
      } catch (error) {
        callback({ error: error.message });
      }
    });

    this.webServer.on('api:learning:skills', ({ callback }) => {
      if (!this.knowledgeBrain) {
        callback([]);
        return;
      }

      try {
        const skillLibrary = this.knowledgeBrain.skillLibrary;
        const skills = skillLibrary?.getAllSkills?.() || [];
        callback(skills);
      } catch (error) {
        callback([]);
      }
    });

    this.webServer.on('api:learning:policy', ({ callback }) => {
      if (!this.knowledgeBrain) {
        callback({ qTable: {} });
        return;
      }

      try {
        const rlPolicy = this.knowledgeBrain.rlPolicy;
        const policy = rlPolicy?.getPolicy?.() || { qTable: {} };
        callback(policy);
      } catch (error) {
        callback({ qTable: {} });
      }
    });

    this.webServer.on('api:learning:patterns', ({ callback }) => {
      if (!this.knowledgeBrain) {
        callback([]);
        return;
      }

      try {
        const patternMiner = this.knowledgeBrain.patternMiner;
        const patterns = patternMiner?.getPatterns?.() || [];
        callback(patterns);
      } catch (error) {
        callback([]);
      }
    });

    this.webServer.on('api:learning:teaching', ({ callback }) => {
      if (!this.knowledgeBrain) {
        callback({ activeSessions: [], stats: null });
        return;
      }

      try {
        const teacher = this.knowledgeBrain.crossAgentTeacher;
        const stats = teacher?.getTeachingStats?.() || null;
        callback({ activeSessions: [], stats });
      } catch (error) {
        callback({ activeSessions: [], stats: null });
      }
    });

    this.webServer.on('api:learning:tests', ({ callback }) => {
      if (!this.knowledgeBrain) {
        callback([]);
        return;
      }

      try {
        const abTester = this.knowledgeBrain.abTester;
        const results = abTester?.getResults?.() || [];
        callback(results);
      } catch (error) {
        callback([]);
      }
    });

    this.webServer.on('api:learning:events', ({ limit, callback }) => {
      const events = this.learningEventLog.slice(0, limit || 100);
      callback(events);
    });

    // ============ Learning Control Handlers ============

    // RL Policy Controls
    this.webServer.on('api:learning:rl:setExploration', ({ rate, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const rlPolicy = this.knowledgeBrain.rlPolicy;
        if (rlPolicy?.setExplorationRate) {
          rlPolicy.setExplorationRate(rate);
          this._recordLearningEvent('control:rl:exploration', { rate });
          callback({ success: true, rate });
        } else {
          callback({ success: false, error: 'RL policy not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.webServer.on('api:learning:rl:reset', ({ keepConfig, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const rlPolicy = this.knowledgeBrain.rlPolicy;
        if (rlPolicy?.reset) {
          rlPolicy.reset(keepConfig);
          this._recordLearningEvent('control:rl:reset', { keepConfig });
          callback({ success: true });
        } else {
          callback({ success: false, error: 'RL policy not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Skills Controls
    this.webServer.on('api:learning:skills:generate', async ({ patternType, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const skillGenerator = this.knowledgeBrain.skillGenerator;
        if (skillGenerator?.generateSkill) {
          const pattern = { type: patternType, count: 1, confidence: 1.0 };
          const skill = await skillGenerator.generateSkill(pattern);
          this._recordLearningEvent('control:skill:generate', { patternType, skill });
          callback({ success: true, skill });
        } else {
          callback({ success: false, error: 'Skill generator not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.webServer.on('api:learning:skills:approve', async ({ skillId, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const skillGenerator = this.knowledgeBrain.skillGenerator;
        if (skillGenerator?._evaluateCanary) {
          // Force approve canary skill
          await skillGenerator._evaluateCanary(skillId);
          this._recordLearningEvent('control:skill:approve', { skillId });
          callback({ success: true, skillId });
        } else {
          callback({ success: false, error: 'Skill generator not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.webServer.on('api:learning:skills:reject', async ({ skillId, reason, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const skillLibrary = this.knowledgeBrain.skillLibrary;
        if (skillLibrary?.deactivateSkill) {
          skillLibrary.deactivateSkill(skillId);
          this._recordLearningEvent('control:skill:reject', { skillId, reason });
          callback({ success: true, skillId, reason });
        } else {
          callback({ success: false, error: 'Skill library not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.webServer.on('api:learning:skills:toggle', async ({ skillId, enabled, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const skillLibrary = this.knowledgeBrain.skillLibrary;
        if (enabled && skillLibrary?.activateSkill) {
          skillLibrary.activateSkill(skillId);
          this._recordLearningEvent('control:skill:activate', { skillId });
          callback({ success: true, skillId, enabled: true });
        } else if (!enabled && skillLibrary?.deactivateSkill) {
          skillLibrary.deactivateSkill(skillId);
          this._recordLearningEvent('control:skill:deactivate', { skillId });
          callback({ success: true, skillId, enabled: false });
        } else {
          callback({ success: false, error: 'Skill library not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // A/B Test Controls
    this.webServer.on('api:learning:tests:start', async ({ controlSkill, treatmentSkill, options, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const abTester = this.knowledgeBrain.abTester;
        if (abTester?.startTest) {
          const testId = abTester.startTest(controlSkill, treatmentSkill, options);
          this._recordLearningEvent('control:test:start', { testId, controlSkill, treatmentSkill });
          callback({ success: true, testId });
        } else {
          callback({ success: false, error: 'A/B tester not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.webServer.on('api:learning:tests:cancel', async ({ testId, reason, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const abTester = this.knowledgeBrain.abTester;
        if (abTester?.cancelTest) {
          abTester.cancelTest(testId, reason);
          this._recordLearningEvent('control:test:cancel', { testId, reason });
          callback({ success: true, testId });
        } else {
          callback({ success: false, error: 'A/B tester not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Teaching Controls
    this.webServer.on('api:learning:teaching:start', async ({ skillId, teacherAgent, studentAgent, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const teacher = this.knowledgeBrain.crossAgentTeacher;
        if (teacher?.packageSkillForTransfer && teacher?.receiveSkill) {
          const pkg = await teacher.packageSkillForTransfer(skillId, teacherAgent);
          const session = await teacher.receiveSkill(pkg, studentAgent);
          this._recordLearningEvent('control:teaching:start', { skillId, teacherAgent, studentAgent, session });
          callback({ success: true, session });
        } else {
          callback({ success: false, error: 'Cross-agent teacher not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    this.webServer.on('api:learning:teaching:validate', async ({ sessionId, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const teacher = this.knowledgeBrain.crossAgentTeacher;
        if (teacher?.validateSkill) {
          const result = await teacher.validateSkill(sessionId);
          this._recordLearningEvent('control:teaching:validate', { sessionId, result });
          callback({ success: true, result });
        } else {
          callback({ success: false, error: 'Cross-agent teacher not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Mastery Controls
    this.webServer.on('api:learning:mastery:update', async ({ agentId, skillId, success, callback }) => {
      if (!this.knowledgeBrain) {
        callback({ success: false, error: 'Learning system not connected' });
        return;
      }
      try {
        const teacher = this.knowledgeBrain.crossAgentTeacher;
        if (teacher?.updateMastery) {
          teacher.updateMastery(agentId, skillId, success);
          this._recordLearningEvent('control:mastery:update', { agentId, skillId, success });
          callback({ success: true, agentId, skillId });
        } else {
          callback({ success: false, error: 'Cross-agent teacher not available' });
        }
      } catch (error) {
        callback({ success: false, error: error.message });
      }
    });

    // Learning Plans - stored locally in GruAgent
    this.learningPlans = new Map();

    this.webServer.on('api:learning:plans:list', ({ callback }) => {
      const plans = Array.from(this.learningPlans.values());
      callback(plans);
    });

    this.webServer.on('api:learning:plans:create', ({ name, description, targetSkills, priority, callback }) => {
      const plan = {
        id: `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name,
        description: description || '',
        targetSkills: targetSkills || [],
        priority: priority || 'medium',
        status: 'pending',
        createdAt: new Date().toISOString(),
        progress: 0
      };
      this.learningPlans.set(plan.id, plan);
      this._recordLearningEvent('control:plan:create', plan);
      callback(plan);
    });

    this.webServer.on('api:learning:plans:update', ({ planId, updates, callback }) => {
      const plan = this.learningPlans.get(planId);
      if (!plan) {
        callback({ success: false, error: 'Plan not found' });
        return;
      }
      Object.assign(plan, updates, { updatedAt: new Date().toISOString() });
      this._recordLearningEvent('control:plan:update', { planId, updates });
      callback(plan);
    });

    this.webServer.on('api:learning:plans:delete', ({ planId, callback }) => {
      const deleted = this.learningPlans.delete(planId);
      this._recordLearningEvent('control:plan:delete', { planId });
      callback({ success: deleted });
    });

    this.webServer.on('api:learning:plans:execute', async ({ planId, callback }) => {
      const plan = this.learningPlans.get(planId);
      if (!plan) {
        callback({ success: false, error: 'Plan not found' });
        return;
      }
      try {
        plan.status = 'executing';
        plan.startedAt = new Date().toISOString();
        this._recordLearningEvent('control:plan:execute', { planId });

        // Execute plan steps - trigger skill generation for target skills
        if (this.knowledgeBrain && plan.targetSkills.length > 0) {
          const skillGenerator = this.knowledgeBrain.skillGenerator;
          for (const skillName of plan.targetSkills) {
            if (skillGenerator?.generateSkill) {
              const pattern = { type: skillName, count: 1, confidence: 1.0 };
              await skillGenerator.generateSkill(pattern);
            }
          }
        }

        plan.status = 'completed';
        plan.completedAt = new Date().toISOString();
        plan.progress = 100;
        callback({ success: true, plan });
      } catch (error) {
        plan.status = 'failed';
        plan.error = error.message;
        callback({ success: false, error: error.message });
      }
    });
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    this.state = AgentState.SHUTDOWN;
    this.logger.info(`Shutting down ${this.name}...`);

    await this.webServer.shutdown();
    await this.conversation.shutdown();
    await this.projectIntake.shutdown();
    await this.statusTracker.shutdown();
    await this.conversationStore.shutdown();

    this.emit('shutdown', { agent: this.name });
    this.removeAllListeners();
  }
}

// Singleton instance
let instance = null;

/**
 * Get the singleton GruAgent instance
 * @param {object} config - Configuration options
 * @returns {GruAgent} The singleton instance
 */
export function getGruAgent(config = {}) {
  if (!instance) {
    instance = new GruAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton (primarily for testing)
 * @returns {Promise<void>}
 */
export async function resetGruAgent() {
  if (instance) {
    try {
      await instance.shutdown();
    } catch (error) {
      // Log error instead of silent catch
      instance.logger?.error?.(`Error during GruAgent shutdown: ${error.message}`);
    }
    instance = null;
  }
}

// Re-export sub-components
export { WebServer };
export { ConversationEngine };
export { ProjectIntake };
export { StatusTracker, Phase };
export { getConversationStore, resetConversationStore } from './ConversationStore.js';

export default GruAgent;
