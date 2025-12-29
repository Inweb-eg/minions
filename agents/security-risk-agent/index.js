/**
 * Minions - SecurityRiskAgent (Tom)
 * ==================================
 * Named after Tom - the vigilant Security & Risk Manager.
 * Scans for security issues, tracks risks, validates deployments,
 * and maintains audit trails.
 *
 * Responsibilities:
 * - security/ folder management (threat-model.json, permissions.json, audit-log.json)
 * - risks.json management
 * - ops/ folder validation (environments.json, deployment configs)
 * - Pre-commit security scanning
 * - Risk assessment during planning phase
 */

import EventEmitter from 'events';
import path from 'path';
import fs from 'fs/promises';
import { createLogger } from '../../foundation/common/logger.js';

import ThreatModeler from './ThreatModeler.js';
import RiskTracker from './RiskTracker.js';
import AuditLogger from './AuditLogger.js';
import OpsValidator from './OpsValidator.js';

// Agent States
export const AgentState = {
  IDLE: 'IDLE',
  INITIALIZING: 'INITIALIZING',
  SCANNING: 'SCANNING',
  ANALYZING: 'ANALYZING',
  VALIDATING: 'VALIDATING',
  AUDITING: 'AUDITING',
  PAUSED: 'PAUSED',
  ERROR: 'ERROR',
  SHUTDOWN: 'SHUTDOWN'
};

// Security Event Types
export const SecurityEvents = {
  // Scanning events
  SCAN_STARTED: 'security:scan:started',
  SCAN_COMPLETED: 'security:scan:completed',
  VULNERABILITY_FOUND: 'security:vulnerability:found',
  SECRET_DETECTED: 'security:secret:detected',

  // Risk events
  RISK_IDENTIFIED: 'security:risk:identified',
  RISK_MITIGATED: 'security:risk:mitigated',
  RISK_UPDATED: 'security:risk:updated',
  RISK_ESCALATED: 'security:risk:escalated',

  // Threat modeling events
  THREAT_ADDED: 'security:threat:added',
  THREAT_UPDATED: 'security:threat:updated',
  THREAT_MITIGATED: 'security:threat:mitigated',

  // Validation events
  VALIDATION_STARTED: 'security:validation:started',
  VALIDATION_PASSED: 'security:validation:passed',
  VALIDATION_FAILED: 'security:validation:failed',

  // Audit events
  AUDIT_ENTRY: 'security:audit:entry',
  AUDIT_ALERT: 'security:audit:alert',

  // Ops events
  OPS_VALIDATED: 'security:ops:validated',
  OPS_ISSUE_FOUND: 'security:ops:issue',

  // General
  SECURITY_ERROR: 'security:error'
};

// Risk severity levels
export const RiskSeverity = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  INFO: 'info'
};

// Threat categories (STRIDE model)
export const ThreatCategory = {
  SPOOFING: 'spoofing',           // Pretending to be someone else
  TAMPERING: 'tampering',         // Modifying data or code
  REPUDIATION: 'repudiation',     // Denying actions
  INFO_DISCLOSURE: 'info_disclosure', // Exposing information
  DENIAL_OF_SERVICE: 'dos',       // Making system unavailable
  ELEVATION: 'elevation'          // Gaining unauthorized access
};

// Singleton instance
let instance = null;

export class SecurityRiskAgent extends EventEmitter {
  constructor(config = {}) {
    super();

    this.name = 'SecurityRiskAgent';
    this.alias = 'Tom';
    this.version = '1.0.0';
    this.state = AgentState.IDLE;
    this.logger = createLogger(this.name);

    // Configuration
    this.config = {
      projectRoot: config.projectRoot || process.cwd(),
      securityDir: config.securityDir || 'security',
      opsDir: config.opsDir || 'ops',
      risksFile: config.risksFile || 'risks.json',
      enableAutoScan: config.enableAutoScan !== false,
      scanOnCommit: config.scanOnCommit !== false,
      blockOnCritical: config.blockOnCritical !== false,
      ...config
    };

    // Sub-components
    this.threatModeler = new ThreatModeler(this.config);
    this.riskTracker = new RiskTracker(this.config);
    this.auditLogger = new AuditLogger(this.config);
    this.opsValidator = new OpsValidator(this.config);

    // Current project context
    this.currentProject = null;
    this.eventBus = null;

    // Metrics
    this.metrics = {
      scansCompleted: 0,
      vulnerabilitiesFound: 0,
      risksIdentified: 0,
      risksMitigated: 0,
      secretsDetected: 0,
      validationsPassed: 0,
      validationsFailed: 0,
      lastScan: null,
      lastActivity: null
    };

    this._setupInternalHandlers();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config = {}) {
    if (!instance) {
      instance = new SecurityRiskAgent(config);
    }
    return instance;
  }

  /**
   * Reset singleton (for testing)
   */
  static resetInstance() {
    if (instance) {
      instance.removeAllListeners();
      instance = null;
    }
  }

  /**
   * Initialize the agent with optional eventBus connection
   */
  async initialize(eventBus = null) {
    this.state = AgentState.INITIALIZING;
    this.logger.info(`Initializing ${this.name} (${this.alias})...`);

    try {
      if (eventBus) {
        this.eventBus = eventBus;
        this._subscribeToEvents();
      }

      // Initialize sub-components
      await this.threatModeler.initialize();
      await this.riskTracker.initialize();
      await this.auditLogger.initialize();
      await this.opsValidator.initialize();

      // Wire up sub-component events
      this._wireSubComponents();

      this.state = AgentState.IDLE;
      this.metrics.lastActivity = new Date().toISOString();

      this.emit('initialized', {
        agent: this.name,
        alias: this.alias,
        version: this.version
      });

      this.logger.info(`${this.alias} initialized successfully`);
      return { success: true, agent: this.name };
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Failed to initialize: ${error.message}`);
      this.emit('error', { agent: this.name, error: error.message });
      throw error;
    }
  }

  /**
   * Set the current project context
   * @param {object} project - Project from ProjectManagerAgent
   */
  async setProject(project) {
    this.currentProject = project;
    this.logger.info(`Project context set: ${project.name}`);

    // Update sub-components with project context
    const projectSecurityPath = path.join(project.workspacePath, this.config.securityDir);
    const projectOpsPath = path.join(project.workspacePath, this.config.opsDir);

    await this.threatModeler.setProjectPath(projectSecurityPath);
    await this.riskTracker.setProjectPath(project.workspacePath);
    await this.auditLogger.setProjectPath(projectSecurityPath);
    await this.opsValidator.setProjectPath(projectOpsPath);

    // Log audit entry
    await this.auditLogger.log({
      action: 'PROJECT_CONTEXT_SET',
      project: project.name,
      agent: this.alias
    });

    return { success: true, project: project.name };
  }

  // ==========================================
  // Security Scanning
  // ==========================================

  /**
   * Perform full security scan on project
   * @param {object} options - Scan options
   */
  async scan(options = {}) {
    if (!this.currentProject) {
      throw new Error('No project context set. Call setProject() first.');
    }

    this.state = AgentState.SCANNING;
    this.logger.info(`Starting security scan for: ${this.currentProject.name}`);

    const scanId = `scan-${Date.now()}`;
    const results = {
      id: scanId,
      project: this.currentProject.name,
      timestamp: new Date().toISOString(),
      vulnerabilities: [],
      secrets: [],
      risks: [],
      recommendations: []
    };

    try {
      this.emit(SecurityEvents.SCAN_STARTED, {
        scanId,
        project: this.currentProject.name
      });

      // Scan for vulnerabilities
      const vulns = await this._scanForVulnerabilities(options);
      results.vulnerabilities = vulns;

      // Scan for exposed secrets
      const secrets = await this._scanForSecrets(options);
      results.secrets = secrets;

      // Analyze existing risks
      const risks = await this.riskTracker.analyze();
      results.risks = risks;

      // Generate recommendations
      results.recommendations = this._generateRecommendations(results);

      // Update metrics
      this.metrics.scansCompleted++;
      this.metrics.vulnerabilitiesFound += vulns.length;
      this.metrics.secretsDetected += secrets.length;
      this.metrics.lastScan = new Date().toISOString();
      this.metrics.lastActivity = this.metrics.lastScan;

      // Log audit entry
      await this.auditLogger.log({
        action: 'SECURITY_SCAN_COMPLETED',
        scanId,
        vulnerabilities: vulns.length,
        secrets: secrets.length,
        risks: risks.length
      });

      this.state = AgentState.IDLE;

      this.emit(SecurityEvents.SCAN_COMPLETED, results);

      if (this.eventBus) {
        this.eventBus.publish(SecurityEvents.SCAN_COMPLETED, results);
      }

      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      this.logger.error(`Scan failed: ${error.message}`);
      this.emit(SecurityEvents.SECURITY_ERROR, { scanId, error: error.message });
      throw error;
    }
  }

  /**
   * Quick scan before commit (lighter weight)
   * @param {string[]} files - Files to scan
   */
  async scanBeforeCommit(files) {
    this.logger.info(`Pre-commit scan for ${files.length} files`);

    const results = {
      passed: true,
      blockers: [],
      warnings: []
    };

    for (const file of files) {
      // Check for secrets
      const secrets = await this._scanFileForSecrets(file);
      if (secrets.length > 0) {
        results.passed = false;
        results.blockers.push({
          file,
          type: 'secret_detected',
          details: secrets
        });

        this.emit(SecurityEvents.SECRET_DETECTED, { file, secrets });
      }

      // Check for critical vulnerabilities
      const vulns = await this._scanFileForVulnerabilities(file);
      const critical = vulns.filter(v => v.severity === RiskSeverity.CRITICAL);

      if (critical.length > 0 && this.config.blockOnCritical) {
        results.passed = false;
        results.blockers.push({
          file,
          type: 'critical_vulnerability',
          details: critical
        });
      }

      // Add warnings for non-critical issues
      const warnings = vulns.filter(v => v.severity !== RiskSeverity.CRITICAL);
      if (warnings.length > 0) {
        results.warnings.push({ file, issues: warnings });
      }
    }

    // Log audit entry
    await this.auditLogger.log({
      action: 'PRE_COMMIT_SCAN',
      filesScanned: files.length,
      passed: results.passed,
      blockers: results.blockers.length,
      warnings: results.warnings.length
    });

    return results;
  }

  // ==========================================
  // Risk Management
  // ==========================================

  /**
   * Identify a new risk
   * @param {object} risk - Risk details
   */
  async identifyRisk(risk) {
    const newRisk = await this.riskTracker.add({
      ...risk,
      identifiedBy: this.alias,
      identifiedAt: new Date().toISOString()
    });

    this.metrics.risksIdentified++;
    this.metrics.lastActivity = new Date().toISOString();

    this.emit(SecurityEvents.RISK_IDENTIFIED, newRisk);

    if (this.eventBus) {
      this.eventBus.publish(SecurityEvents.RISK_IDENTIFIED, newRisk);
    }

    // Log audit entry
    await this.auditLogger.log({
      action: 'RISK_IDENTIFIED',
      riskId: newRisk.id,
      severity: newRisk.severity,
      title: newRisk.title
    });

    return newRisk;
  }

  /**
   * Update risk status or details
   * @param {string} riskId - Risk ID
   * @param {object} updates - Updates to apply
   */
  async updateRisk(riskId, updates) {
    const updated = await this.riskTracker.update(riskId, updates);

    this.emit(SecurityEvents.RISK_UPDATED, updated);

    await this.auditLogger.log({
      action: 'RISK_UPDATED',
      riskId,
      updates: Object.keys(updates)
    });

    return updated;
  }

  /**
   * Mark a risk as mitigated
   * @param {string} riskId - Risk ID
   * @param {object} mitigation - Mitigation details
   */
  async mitigateRisk(riskId, mitigation) {
    const mitigated = await this.riskTracker.mitigate(riskId, {
      ...mitigation,
      mitigatedBy: this.alias,
      mitigatedAt: new Date().toISOString()
    });

    this.metrics.risksMitigated++;

    this.emit(SecurityEvents.RISK_MITIGATED, mitigated);

    if (this.eventBus) {
      this.eventBus.publish(SecurityEvents.RISK_MITIGATED, mitigated);
    }

    await this.auditLogger.log({
      action: 'RISK_MITIGATED',
      riskId,
      mitigation: mitigation.description
    });

    return mitigated;
  }

  /**
   * Get all active risks
   */
  async getActiveRisks() {
    return await this.riskTracker.getActive();
  }

  /**
   * Get risk summary
   */
  async getRiskSummary() {
    return await this.riskTracker.getSummary();
  }

  // ==========================================
  // Threat Modeling
  // ==========================================

  /**
   * Add a threat to the threat model
   * @param {object} threat - Threat details
   */
  async addThreat(threat) {
    const newThreat = await this.threatModeler.add({
      ...threat,
      addedBy: this.alias,
      addedAt: new Date().toISOString()
    });

    this.emit(SecurityEvents.THREAT_ADDED, newThreat);

    await this.auditLogger.log({
      action: 'THREAT_ADDED',
      threatId: newThreat.id,
      category: newThreat.category,
      title: newThreat.title
    });

    return newThreat;
  }

  /**
   * Get current threat model
   */
  async getThreatModel() {
    return await this.threatModeler.getModel();
  }

  /**
   * Update threat model based on architecture changes
   * @param {object} architectureChanges - Changes to architecture
   */
  async updateThreatModel(architectureChanges) {
    const updated = await this.threatModeler.updateFromArchitecture(architectureChanges);

    for (const threat of updated.newThreats) {
      this.emit(SecurityEvents.THREAT_ADDED, threat);
    }

    await this.auditLogger.log({
      action: 'THREAT_MODEL_UPDATED',
      newThreats: updated.newThreats.length,
      updatedThreats: updated.updatedThreats.length
    });

    return updated;
  }

  // ==========================================
  // Ops Validation
  // ==========================================

  /**
   * Validate ops/deployment configuration
   * @param {object} options - Validation options
   */
  async validateOps(options = {}) {
    this.state = AgentState.VALIDATING;
    this.logger.info('Validating ops configuration...');

    try {
      const results = await this.opsValidator.validate(options);

      if (results.valid) {
        this.metrics.validationsPassed++;
        this.emit(SecurityEvents.OPS_VALIDATED, results);
      } else {
        this.metrics.validationsFailed++;
        this.emit(SecurityEvents.OPS_ISSUE_FOUND, results);
      }

      await this.auditLogger.log({
        action: 'OPS_VALIDATION',
        valid: results.valid,
        issues: results.issues?.length || 0
      });

      this.state = AgentState.IDLE;
      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      throw error;
    }
  }

  /**
   * Validate environment configuration
   * @param {string} environment - Environment name (dev, staging, prod)
   */
  async validateEnvironment(environment) {
    return await this.opsValidator.validateEnvironment(environment);
  }

  // ==========================================
  // Pre-Execution Validation
  // ==========================================

  /**
   * Validate project files before execution
   * Called by orchestrator before plan execution
   */
  async validateBeforeExecution() {
    this.state = AgentState.VALIDATING;
    this.logger.info('Running pre-execution security validation...');

    const results = {
      valid: true,
      errors: [],
      warnings: [],
      agent: this.alias,
      files: ['risks.json', 'security/', 'ops/']
    };

    try {
      // Validate risks.json
      const risksValid = await this.riskTracker.validateFile();
      if (!risksValid.valid) {
        if (risksValid.severity === 'error') {
          results.valid = false;
          results.errors.push(...risksValid.issues);
        } else {
          results.warnings.push(...risksValid.issues);
        }
      }

      // Validate security/ folder
      const securityValid = await this.threatModeler.validateFiles();
      if (!securityValid.valid) {
        if (securityValid.severity === 'error') {
          results.valid = false;
          results.errors.push(...securityValid.issues);
        } else {
          results.warnings.push(...securityValid.issues);
        }
      }

      // Validate ops/ folder
      const opsValid = await this.opsValidator.validateFiles();
      if (!opsValid.valid) {
        if (opsValid.severity === 'error') {
          results.valid = false;
          results.errors.push(...opsValid.issues);
        } else {
          results.warnings.push(...opsValid.issues);
        }
      }

      // Check for unmitigated critical risks
      const criticalRisks = await this.riskTracker.getCriticalUnmitigated();
      if (criticalRisks.length > 0) {
        results.warnings.push({
          type: 'unmitigated_critical_risks',
          message: `${criticalRisks.length} unmitigated critical risks`,
          risks: criticalRisks.map(r => r.title)
        });
      }

      this.state = AgentState.IDLE;

      this.emit(results.valid ?
        SecurityEvents.VALIDATION_PASSED :
        SecurityEvents.VALIDATION_FAILED,
        results
      );

      return results;
    } catch (error) {
      this.state = AgentState.ERROR;
      results.valid = false;
      results.errors.push({ type: 'validation_error', message: error.message });
      this.emit(SecurityEvents.VALIDATION_FAILED, results);
      return results;
    }
  }

  // ==========================================
  // Audit Trail
  // ==========================================

  /**
   * Get audit log entries
   * @param {object} filter - Filter criteria
   */
  async getAuditLog(filter = {}) {
    return await this.auditLogger.query(filter);
  }

  /**
   * Add manual audit entry
   * @param {object} entry - Audit entry
   */
  async addAuditEntry(entry) {
    return await this.auditLogger.log({
      ...entry,
      source: 'manual',
      addedBy: this.alias
    });
  }

  // ==========================================
  // Status & Metrics
  // ==========================================

  /**
   * Get agent status
   */
  getStatus() {
    return {
      name: this.name,
      alias: this.alias,
      version: this.version,
      state: this.state,
      currentProject: this.currentProject?.name || null,
      metrics: { ...this.metrics }
    };
  }

  /**
   * Get security summary for current project
   */
  async getSecuritySummary() {
    if (!this.currentProject) {
      return null;
    }

    const [risks, threats, audit] = await Promise.all([
      this.riskTracker.getSummary(),
      this.threatModeler.getSummary(),
      this.auditLogger.getRecentActivity(10)
    ]);

    return {
      project: this.currentProject.name,
      risks,
      threats,
      recentActivity: audit,
      metrics: this.metrics
    };
  }

  // ==========================================
  // Shutdown
  // ==========================================

  /**
   * Graceful shutdown
   */
  async shutdown() {
    this.logger.info(`Shutting down ${this.alias}...`);
    this.state = AgentState.SHUTDOWN;

    // Save any pending state
    await this.riskTracker.save();
    await this.threatModeler.save();
    await this.auditLogger.flush();

    // Unsubscribe from events
    if (this.eventBus && this._unsubscribers) {
      this._unsubscribers.forEach(fn => fn());
    }

    this.removeAllListeners();
    this.logger.info(`${this.alias} shutdown complete`);
  }

  // ==========================================
  // Private Methods
  // ==========================================

  _setupInternalHandlers() {
    this.on('error', (data) => {
      this.logger.error(`Error: ${data.error}`);
    });
  }

  _subscribeToEvents() {
    this._unsubscribers = [];

    // Subscribe to code generation events to scan new code
    if (this.eventBus.subscribe) {
      this._unsubscribers.push(
        this.eventBus.subscribe('CODE_GENERATED', this.alias, async (data) => {
          if (this.config.enableAutoScan && data.files) {
            await this.scanBeforeCommit(data.files);
          }
        })
      );

      // Subscribe to architecture changes to update threat model
      this._unsubscribers.push(
        this.eventBus.subscribe('ARCHITECTURE_UPDATED', this.alias, async (data) => {
          await this.updateThreatModel(data);
        })
      );

      // Subscribe to plan approval to run pre-execution validation
      this._unsubscribers.push(
        this.eventBus.subscribe('PLAN_APPROVED', this.alias, async (data) => {
          const validation = await this.validateBeforeExecution();
          this.eventBus.publish(
            validation.valid ? 'VALIDATION_PASSED' : 'VALIDATION_FAILED',
            { agent: this.alias, ...validation }
          );
        })
      );
    }
  }

  _wireSubComponents() {
    // Forward threat modeler events
    this.threatModeler.on('threat:added', (threat) => {
      this.emit(SecurityEvents.THREAT_ADDED, threat);
    });

    // Forward risk tracker events
    this.riskTracker.on('risk:escalated', (risk) => {
      this.emit(SecurityEvents.RISK_ESCALATED, risk);
    });

    // Forward audit events
    this.auditLogger.on('alert', (alert) => {
      this.emit(SecurityEvents.AUDIT_ALERT, alert);
    });
  }

  async _scanForVulnerabilities(options) {
    // Placeholder - would integrate with security scanning tools
    const vulns = [];

    // Check for common vulnerability patterns
    const sourcePath = this.currentProject.sourcePath;

    try {
      // This would be expanded with actual vulnerability detection
      // For now, return empty array
      return vulns;
    } catch (error) {
      this.logger.warn(`Vulnerability scan error: ${error.message}`);
      return vulns;
    }
  }

  async _scanForSecrets(options) {
    // Placeholder - would scan for exposed secrets
    const secrets = [];

    // Common secret patterns to check
    const patterns = [
      /api[_-]?key\s*[:=]\s*['"]\w+['"]/gi,
      /password\s*[:=]\s*['"]\w+['"]/gi,
      /secret\s*[:=]\s*['"]\w+['"]/gi,
      /token\s*[:=]\s*['"]\w+['"]/gi,
      /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g
    ];

    return secrets;
  }

  async _scanFileForSecrets(filePath) {
    // Scan individual file for secrets
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const secrets = [];

      const patterns = [
        { name: 'API Key', pattern: /api[_-]?key\s*[:=]\s*['"][^'"]+['"]/gi },
        { name: 'Password', pattern: /password\s*[:=]\s*['"][^'"]+['"]/gi },
        { name: 'Secret', pattern: /secret\s*[:=]\s*['"][^'"]+['"]/gi },
        { name: 'Private Key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g },
        { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g }
      ];

      for (const { name, pattern } of patterns) {
        const matches = content.match(pattern);
        if (matches) {
          secrets.push({
            type: name,
            file: filePath,
            count: matches.length,
            severity: RiskSeverity.CRITICAL
          });
        }
      }

      return secrets;
    } catch (error) {
      return [];
    }
  }

  async _scanFileForVulnerabilities(filePath) {
    // Scan individual file for vulnerabilities
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const vulns = [];

      // Check for common vulnerability patterns
      const checks = [
        {
          name: 'SQL Injection',
          pattern: /query\s*\(\s*['"`].*\$\{/gi,
          severity: RiskSeverity.CRITICAL
        },
        {
          name: 'Command Injection',
          pattern: /exec\s*\(\s*['"`].*\$\{/gi,
          severity: RiskSeverity.CRITICAL
        },
        {
          name: 'Eval Usage',
          pattern: /\beval\s*\(/gi,
          severity: RiskSeverity.HIGH
        },
        {
          name: 'innerHTML Assignment',
          pattern: /\.innerHTML\s*=/gi,
          severity: RiskSeverity.MEDIUM
        }
      ];

      for (const { name, pattern, severity } of checks) {
        if (pattern.test(content)) {
          vulns.push({
            type: name,
            file: filePath,
            severity
          });
        }
      }

      return vulns;
    } catch (error) {
      return [];
    }
  }

  _generateRecommendations(scanResults) {
    const recommendations = [];

    if (scanResults.secrets.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: 'Remove Exposed Secrets',
        description: 'Secrets detected in source code. Move to environment variables or secret management.',
        action: 'Use .env files or a secrets manager like HashiCorp Vault'
      });
    }

    if (scanResults.vulnerabilities.some(v => v.severity === RiskSeverity.CRITICAL)) {
      recommendations.push({
        priority: 'critical',
        title: 'Fix Critical Vulnerabilities',
        description: 'Critical security vulnerabilities detected that could lead to data breach.',
        action: 'Review and fix identified vulnerabilities before deployment'
      });
    }

    if (scanResults.risks.some(r => r.severity === RiskSeverity.HIGH && !r.mitigated)) {
      recommendations.push({
        priority: 'high',
        title: 'Address High-Priority Risks',
        description: 'Unmitigated high-priority risks require attention.',
        action: 'Review risks.json and implement mitigation strategies'
      });
    }

    return recommendations;
  }
}

// Factory function
export function getSecurityRiskAgent(config = {}) {
  return SecurityRiskAgent.getInstance(config);
}

export default SecurityRiskAgent;
