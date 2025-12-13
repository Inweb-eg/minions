/**
 * Minions - Architect-Agent
 * =========================
 * The technical authority that makes architectural decisions and ensures
 * all generated code follows a unified vision.
 *
 * Responsibilities:
 * - Generate system blueprints from requirements
 * - Define and enforce API contracts
 * - Select appropriate technology stacks
 * - Detect architectural drift and violations
 *
 * Dependencies: Phase 0 (Foundation), Phase 1 (Vision-Agent)
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';

import BlueprintGenerator from './blueprint-generator.js';
import ApiContractManager from './api-contract-manager.js';
import TechSelector from './tech-selector.js';
import DriftDetector from './drift-detector.js';

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  ANALYZING: 'ANALYZING',
  DESIGNING: 'DESIGNING',
  VALIDATING: 'VALIDATING',
  ENFORCING: 'ENFORCING',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Event Types this agent emits/listens to
export const ArchitectEvents = {
  // Incoming events (from other agents)
  REQUIREMENTS_READY: 'vision:requirements:ready',
  CODE_GENERATED: 'code:generated',
  ARCHITECTURE_REQUEST: 'architect:request',
  VALIDATE_CODE: 'architect:validate:code',

  // Outgoing events
  BLUEPRINT_CREATED: 'architect:blueprint:created',
  BLUEPRINT_UPDATED: 'architect:blueprint:updated',
  CONTRACT_DEFINED: 'architect:contract:defined',
  CONTRACT_VIOLATION: 'architect:contract:violation',
  DRIFT_DETECTED: 'architect:drift:detected',
  TECH_STACK_SELECTED: 'architect:techstack:selected',
  VALIDATION_PASSED: 'architect:validation:passed',
  VALIDATION_FAILED: 'architect:validation:failed',
  DECISION_LOGGED: 'architect:decision:logged'
};

export class ArchitectAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'Architect-Agent';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;

    // Configuration
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      architectureDir: config.architectureDir || 'architecture',
      contractsDir: config.contractsDir || 'contracts',
      decisionsDir: config.decisionsDir || 'decisions',
      enableStrictMode: config.enableStrictMode ?? true,
      maxDriftThreshold: config.maxDriftThreshold || 0.15, // 15% drift allowed
      ...config
    };

    // Initialize sub-components
    this.blueprintGenerator = new BlueprintGenerator(this.config);
    this.apiContractManager = new ApiContractManager(this.config);
    this.techSelector = new TechSelector(this.config);
    this.driftDetector = new DriftDetector(this.config);

    // State storage
    this.currentBlueprint = null;
    this.contracts = new Map();
    this.decisions = [];
    this.violations = [];

    // Metrics
    this.metrics = {
      blueprintsGenerated: 0,
      contractsDefined: 0,
      violationsDetected: 0,
      driftChecks: 0,
      decisionsLogged: 0
    };

    this._setupInternalHandlers();
  }

  /**
   * Initialize the Architect-Agent
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;

    try {
      // Connect to event bus if provided
      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      // Create required directories
      await this._ensureDirectories();

      // Load existing architecture if present
      await this._loadExistingArchitecture();

      this.state = AgentState.IDLE;
      this.emit('initialized', { agent: this.name, version: this.version });

      return { success: true, agent: this.name };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { agent: this.name, error: error.message });
      throw error;
    }
  }

  /**
   * Generate system blueprint from requirements
   */
  async generateBlueprint(requirements) {
    this.state = AgentState.DESIGNING;

    try {
      // Select technology stack first
      const techStack = await this.techSelector.selectStack(requirements);
      this._logDecision('TECH_STACK_SELECTION', techStack, requirements);

      // Generate the blueprint
      const blueprint = await this.blueprintGenerator.generate({
        requirements,
        techStack,
        existingBlueprint: this.currentBlueprint
      });

      // Define API contracts based on blueprint
      const contracts = await this.apiContractManager.generateContracts(blueprint);

      // Store results
      this.currentBlueprint = blueprint;
      contracts.forEach(contract => {
        this.contracts.set(contract.name, contract);
      });

      // Persist to filesystem
      await this._saveBlueprint(blueprint);
      await this._saveContracts(contracts);

      this.metrics.blueprintsGenerated++;
      this.metrics.contractsDefined += contracts.length;

      // Emit events
      this.emit(ArchitectEvents.BLUEPRINT_CREATED, { blueprint });
      this.emit(ArchitectEvents.TECH_STACK_SELECTED, { techStack });
      contracts.forEach(contract => {
        this.emit(ArchitectEvents.CONTRACT_DEFINED, { contract });
      });

      this.state = AgentState.IDLE;

      return {
        success: true,
        blueprint,
        techStack,
        contracts: Array.from(this.contracts.values())
      };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.emit('error', { operation: 'generateBlueprint', error: error.message });
      throw error;
    }
  }

  /**
   * Validate code against architectural rules
   */
  async validateCode(codeInfo) {
    this.state = AgentState.VALIDATING;

    try {
      const { filePath, content, agent, changeType } = codeInfo;
      const violations = [];

      // Check against blueprint rules
      if (this.currentBlueprint) {
        const blueprintViolations = await this.blueprintGenerator.validateAgainstBlueprint(
          filePath, content, this.currentBlueprint
        );
        violations.push(...blueprintViolations);
      }

      // Check API contract compliance
      const contractViolations = await this.apiContractManager.validateCompliance(
        filePath, content
      );
      violations.push(...contractViolations);

      // Check for architectural drift
      const driftResult = await this.driftDetector.checkDrift(filePath, content);
      if (driftResult.driftScore > this.config.maxDriftThreshold) {
        violations.push({
          type: 'ARCHITECTURAL_DRIFT',
          severity: 'WARNING',
          message: `Drift score ${(driftResult.driftScore * 100).toFixed(1)}% exceeds threshold`,
          details: driftResult.details
        });
      }
      this.metrics.driftChecks++;

      // Store violations
      if (violations.length > 0) {
        this.violations.push(...violations.map(v => ({
          ...v,
          filePath,
          agent,
          timestamp: new Date().toISOString()
        })));
        this.metrics.violationsDetected += violations.length;

        this.emit(ArchitectEvents.VALIDATION_FAILED, { filePath, violations });

        if (this.config.enableStrictMode && violations.some(v => v.severity === 'ERROR')) {
          this.state = AgentState.ENFORCING;
          return {
            success: false,
            passed: false,
            violations,
            action: 'BLOCK'
          };
        }
      }

      this.emit(ArchitectEvents.VALIDATION_PASSED, { filePath });
      this.state = AgentState.IDLE;

      return {
        success: true,
        passed: violations.length === 0,
        violations,
        action: violations.length > 0 ? 'WARN' : 'ALLOW'
      };
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Get API contract for a specific service/endpoint
   */
  getContract(serviceName) {
    return this.contracts.get(serviceName) || null;
  }

  /**
   * Get all current API contracts
   */
  getAllContracts() {
    return Array.from(this.contracts.values());
  }

  /**
   * Get the current system blueprint
   */
  getBlueprint() {
    return this.currentBlueprint;
  }

  /**
   * Get architectural decisions log
   */
  getDecisions() {
    return [...this.decisions];
  }

  /**
   * Get current violations
   */
  getViolations(filter = {}) {
    let results = [...this.violations];

    if (filter.severity) {
      results = results.filter(v => v.severity === filter.severity);
    }
    if (filter.type) {
      results = results.filter(v => v.type === filter.type);
    }
    if (filter.agent) {
      results = results.filter(v => v.agent === filter.agent);
    }

    return results;
  }

  /**
   * Resolve a violation (mark as addressed)
   */
  async resolveViolation(violationId, resolution) {
    const index = this.violations.findIndex(v => v.id === violationId);
    if (index === -1) return { success: false, error: 'Violation not found' };

    this.violations[index] = {
      ...this.violations[index],
      resolved: true,
      resolution,
      resolvedAt: new Date().toISOString()
    };

    this._logDecision('VIOLATION_RESOLVED', { violationId, resolution });

    return { success: true };
  }

  /**
   * Request architecture review from another agent's perspective
   */
  async reviewArchitecture(agentPerspective) {
    if (!this.currentBlueprint) {
      return { success: false, error: 'No blueprint exists' };
    }

    const review = {
      perspective: agentPerspective,
      timestamp: new Date().toISOString(),
      findings: []
    };

    // Analyze from the requesting agent's perspective
    switch (agentPerspective) {
      case 'Backend-Agent':
        review.findings = this._reviewForBackend();
        break;
      case 'Admin-Agent':
        review.findings = this._reviewForAdmin();
        break;
      case 'Users-Agent':
      case 'Drivers-Agent':
        review.findings = this._reviewForMobile();
        break;
      default:
        review.findings = this._generalReview();
    }

    return { success: true, review };
  }

  /**
   * Get agent metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      state: this.state,
      activeContracts: this.contracts.size,
      pendingViolations: this.violations.filter(v => !v.resolved).length
    };
  }

  /**
   * Shutdown the agent
   */
  async shutdown() {
    this.state = AgentState.SHUTDOWN;

    // Persist current state
    await this._saveBlueprint(this.currentBlueprint);
    await this._saveDecisions();

    this.emit('shutdown', { agent: this.name });
    this.removeAllListeners();
  }

  // ==================== Private Methods ====================

  _setupInternalHandlers() {
    // Handle sub-component events
    this.blueprintGenerator.on('warning', (warning) => {
      this.emit('warning', { source: 'BlueprintGenerator', ...warning });
    });

    this.driftDetector.on('drift:critical', (data) => {
      this.emit(ArchitectEvents.DRIFT_DETECTED, data);
    });
  }

  _subscribeToEvents() {
    if (!this.eventBus) return;

    // Listen for requirements from Vision-Agent
    this.eventBus.subscribe(ArchitectEvents.REQUIREMENTS_READY, this.name, async (data) => {
      await this.generateBlueprint(data.requirements);
    });

    // Listen for code generation events
    this.eventBus.subscribe(ArchitectEvents.CODE_GENERATED, this.name, async (data) => {
      await this.validateCode(data);
    });

    // Listen for explicit validation requests
    this.eventBus.subscribe(ArchitectEvents.VALIDATE_CODE, this.name, async (data) => {
      const result = await this.validateCode(data);
      if (this.eventBus) {
        this.eventBus.publish(`architect:validation:result:${data.requestId}`, {
          agent: this.name,
          ...result
        });
      }
    });
  }

  async _ensureDirectories() {
    const dirs = [
      path.join(this.config.projectRoot, this.config.architectureDir),
      path.join(this.config.projectRoot, this.config.contractsDir),
      path.join(this.config.projectRoot, this.config.decisionsDir)
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async _loadExistingArchitecture() {
    try {
      const blueprintPath = path.join(
        this.config.projectRoot,
        this.config.architectureDir,
        'blueprint.json'
      );

      const data = await fs.readFile(blueprintPath, 'utf-8');
      this.currentBlueprint = JSON.parse(data);

      // Load contracts
      const contractsPath = path.join(
        this.config.projectRoot,
        this.config.contractsDir
      );

      const files = await fs.readdir(contractsPath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const contractData = await fs.readFile(
            path.join(contractsPath, file),
            'utf-8'
          );
          const contract = JSON.parse(contractData);
          this.contracts.set(contract.name, contract);
        }
      }
    } catch (error) {
      // No existing architecture - that's okay
    }
  }

  async _saveBlueprint(blueprint) {
    if (!blueprint) return;

    const blueprintPath = path.join(
      this.config.projectRoot,
      this.config.architectureDir,
      'blueprint.json'
    );

    await fs.writeFile(blueprintPath, JSON.stringify(blueprint, null, 2));
  }

  async _saveContracts(contracts) {
    for (const contract of contracts) {
      const contractPath = path.join(
        this.config.projectRoot,
        this.config.contractsDir,
        `${contract.name}.json`
      );

      await fs.writeFile(contractPath, JSON.stringify(contract, null, 2));
    }
  }

  async _saveDecisions() {
    const decisionsPath = path.join(
      this.config.projectRoot,
      this.config.decisionsDir,
      'decisions.json'
    );

    await fs.writeFile(decisionsPath, JSON.stringify(this.decisions, null, 2));
  }

  _logDecision(type, decision, context = {}) {
    const record = {
      id: `ADR-${Date.now()}`,
      type,
      decision,
      context,
      timestamp: new Date().toISOString(),
      agent: this.name
    };

    this.decisions.push(record);
    this.metrics.decisionsLogged++;

    this.emit(ArchitectEvents.DECISION_LOGGED, record);

    return record;
  }

  _reviewForBackend() {
    const findings = [];
    const bp = this.currentBlueprint;

    if (bp.components?.backend) {
      if (!bp.components.backend.authentication) {
        findings.push({ type: 'MISSING', item: 'Authentication strategy not defined' });
      }
      if (!bp.components.backend.database) {
        findings.push({ type: 'MISSING', item: 'Database configuration not specified' });
      }
    }

    return findings;
  }

  _reviewForAdmin() {
    const findings = [];
    const bp = this.currentBlueprint;

    if (bp.components?.admin) {
      if (!bp.components.admin.stateManagement) {
        findings.push({ type: 'MISSING', item: 'State management pattern not defined' });
      }
    }

    return findings;
  }

  _reviewForMobile() {
    const findings = [];
    const bp = this.currentBlueprint;

    if (bp.components?.mobile) {
      if (!bp.components.mobile.offlineStrategy) {
        findings.push({ type: 'RECOMMENDATION', item: 'Consider offline-first strategy' });
      }
    }

    return findings;
  }

  _generalReview() {
    return [{ type: 'INFO', item: 'General architecture review completed' }];
  }
}

// Export singleton factory
let instance = null;

export function getArchitectAgent(config) {
  if (!instance) {
    instance = new ArchitectAgent(config);
  }
  return instance;
}

export function resetArchitectAgent() {
  if (instance) {
    instance.shutdown().catch(() => {});
    instance = null;
  }
}

// Re-export sub-components
export { BlueprintGenerator, ArchitecturalPatterns, ComponentTypes, SystemLayers } from './blueprint-generator.js';
export { ApiContractManager, HttpMethods, StatusCategories } from './api-contract-manager.js';
export { TechSelector, TechCategories } from './tech-selector.js';
export { DriftDetector, DriftCategories } from './drift-detector.js';

export default ArchitectAgent;
