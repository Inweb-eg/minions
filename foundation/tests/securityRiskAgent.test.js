/**
 * Tests for SecurityRiskAgent (Tom)
 * Tests the main agent and all sub-components:
 * - ThreatModeler
 * - RiskTracker
 * - AuditLogger
 * - OpsValidator
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// Import the agent and components
import {
  SecurityRiskAgent,
  getSecurityRiskAgent,
  SecurityEvents,
  RiskSeverity as AgentRiskSeverity
} from '../../agents/security-risk-agent/index.js';

import {
  ThreatModeler,
  ThreatStatus,
  StrideCategory
} from '../../agents/security-risk-agent/ThreatModeler.js';

import {
  RiskTracker,
  RiskStatus,
  RiskSeverity,
  RiskCategory
} from '../../agents/security-risk-agent/RiskTracker.js';

import {
  AuditLogger,
  AuditType,
  AuditSeverity
} from '../../agents/security-risk-agent/AuditLogger.js';

import {
  OpsValidator,
  ValidationSeverity,
  EnvironmentType
} from '../../agents/security-risk-agent/OpsValidator.js';

describe('SecurityRiskAgent (Tom)', () => {
  let tempDir;
  let agent;

  beforeEach(async () => {
    // Create temp directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tom-test-'));

    // Reset singleton for each test
    SecurityRiskAgent.resetInstance();
    agent = SecurityRiskAgent.getInstance();
  });

  afterEach(async () => {
    // Shutdown agent to clear timers
    if (agent) {
      await agent.shutdown();
    }
    // Cleanup temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Agent Initialization', () => {
    test('should create agent with correct identity', () => {
      expect(agent.name).toBe('SecurityRiskAgent');
      expect(agent.alias).toBe('Tom');
      expect(agent.version).toBe('1.0.0');
    });

    test('should have all sub-components', () => {
      expect(agent.threatModeler).toBeInstanceOf(ThreatModeler);
      expect(agent.riskTracker).toBeInstanceOf(RiskTracker);
      expect(agent.auditLogger).toBeInstanceOf(AuditLogger);
      expect(agent.opsValidator).toBeInstanceOf(OpsValidator);
    });

    test('should be singleton', () => {
      const agent2 = SecurityRiskAgent.getInstance();
      expect(agent2).toBe(agent);
    });

    test('should initialize successfully', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
    });

    test('should set project', async () => {
      const projectPath = path.join(tempDir, 'test-project');
      await fs.mkdir(projectPath, { recursive: true });

      const mockProject = {
        name: 'test-project',
        workspacePath: projectPath,
        sourcePath: path.join(projectPath, 'src')
      };

      await agent.setProject(mockProject);
      expect(agent.currentProject.name).toBe('test-project');
    });
  });

  describe('Risk Identification', () => {
    beforeEach(async () => {
      const projectPath = path.join(tempDir, 'risk-project');
      await fs.mkdir(projectPath, { recursive: true });
      await agent.setProject({
        name: 'risk-project',
        workspacePath: projectPath,
        sourcePath: path.join(projectPath, 'src')
      });
    });

    test('should identify a new risk', async () => {
      const risk = await agent.identifyRisk({
        title: 'SQL Injection vulnerability',
        description: 'User input not sanitized in login form',
        category: RiskCategory.SECURITY,
        severity: RiskSeverity.HIGH,
        likelihood: 'high',
        impact: 'high'
      });

      expect(risk.id).toBeDefined();
      expect(risk.title).toBe('SQL Injection vulnerability');
      expect(risk.status).toBe(RiskStatus.IDENTIFIED);
    });

    test('should emit event when risk identified', async () => {
      const eventHandler = jest.fn();
      agent.on(SecurityEvents.RISK_IDENTIFIED, eventHandler);

      await agent.identifyRisk({
        title: 'Test risk',
        severity: RiskSeverity.MEDIUM
      });

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Threat Modeling', () => {
    beforeEach(async () => {
      const projectPath = path.join(tempDir, 'threat-project');
      await fs.mkdir(projectPath, { recursive: true });
      await agent.setProject({
        name: 'threat-project',
        workspacePath: projectPath,
        sourcePath: path.join(projectPath, 'src')
      });
    });

    test('should add threat to model', async () => {
      const threat = await agent.addThreat({
        title: 'Cross-site scripting attack',
        category: StrideCategory.INFO_DISCLOSURE,
        likelihood: 'medium',
        impact: 'high'
      });

      expect(threat.id).toBeDefined();
      expect(threat.category).toBe(StrideCategory.INFO_DISCLOSURE);
      expect(threat.status).toBe(ThreatStatus.IDENTIFIED);
    });

    test('should emit event when threat added', async () => {
      const eventHandler = jest.fn();
      agent.on(SecurityEvents.THREAT_ADDED, eventHandler);

      await agent.addThreat({
        title: 'Test threat',
        category: StrideCategory.SPOOFING
      });

      expect(eventHandler).toHaveBeenCalled();
    });
  });

  describe('Pre-Execution Validation', () => {
    beforeEach(async () => {
      const projectPath = path.join(tempDir, 'validate-project');
      await fs.mkdir(projectPath, { recursive: true });
      await agent.setProject({
        name: 'validate-project',
        workspacePath: projectPath,
        sourcePath: path.join(projectPath, 'src')
      });
    });

    test('should pass validation with no critical risks', async () => {
      const result = await agent.validateBeforeExecution();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should add warnings for critical unmitigated risks', async () => {
      await agent.identifyRisk({
        title: 'Critical security flaw',
        severity: RiskSeverity.CRITICAL,
        likelihood: 'high',
        impact: 'high'
      });

      const result = await agent.validateBeforeExecution();

      // Critical risks should show as warnings, not block execution
      expect(result.warnings.length).toBeGreaterThan(0);
      const criticalWarning = result.warnings.find(w => w.type === 'unmitigated_critical_risks');
      expect(criticalWarning).toBeDefined();
    });
  });

  describe('Security Scan', () => {
    beforeEach(async () => {
      const projectPath = path.join(tempDir, 'scan-project');
      await fs.mkdir(projectPath, { recursive: true });
      await agent.setProject({
        name: 'scan-project',
        workspacePath: projectPath,
        sourcePath: path.join(projectPath, 'src')
      });
    });

    test('should perform security scan', async () => {
      const result = await agent.scan();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('vulnerabilities');
      expect(result).toHaveProperty('secrets');
      expect(result).toHaveProperty('risks');
      expect(result).toHaveProperty('recommendations');
    });
  });
});

describe('ThreatModeler', () => {
  let tempDir;
  let threatModeler;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'threat-test-'));
    threatModeler = new ThreatModeler();
    await threatModeler.setProjectPath(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should add threat', async () => {
    const threat = await threatModeler.add({
      title: 'Test threat',
      category: StrideCategory.TAMPERING
    });

    expect(threat.id).toMatch(/^threat-/);
    expect(threat.title).toBe('Test threat');
    expect(threat.category).toBe(StrideCategory.TAMPERING);
  });

  test('should mitigate threat', async () => {
    const threat = await threatModeler.add({
      title: 'Test threat',
      category: StrideCategory.SPOOFING
    });

    const mitigated = await threatModeler.mitigate(threat.id, {
      description: 'Added authentication',
      implementedBy: 'developer',
      effectiveness: 'full'
    });

    expect(mitigated.status).toBe(ThreatStatus.MITIGATED);
    expect(mitigated.mitigations).toHaveLength(1);
  });

  test('should add asset', async () => {
    const asset = await threatModeler.addAsset({
      name: 'User Database',
      type: 'data',
      sensitivity: 'critical'
    });

    expect(asset.id).toMatch(/^asset-/);
    expect(asset.name).toBe('User Database');
  });

  test('should add data flow', async () => {
    const flow = await threatModeler.addDataFlow({
      name: 'API to Database',
      source: 'api-server',
      destination: 'database',
      dataType: 'user-credentials',
      encrypted: true
    });

    expect(flow.id).toMatch(/^flow-/);
    expect(flow.encrypted).toBe(true);
  });

  test('should get unmitigated threats', async () => {
    await threatModeler.add({ title: 'Threat 1', category: StrideCategory.DOS });
    await threatModeler.add({ title: 'Threat 2', category: StrideCategory.ELEVATION });

    const unmitigated = await threatModeler.getUnmitigated();
    expect(unmitigated).toHaveLength(2);
  });

  test('should analyze component threats', async () => {
    const result = await threatModeler.updateFromArchitecture({
      newComponents: [
        { name: 'auth-service', type: 'auth' },
        { name: 'user-db', type: 'database' }
      ]
    });

    expect(result.newThreats.length).toBeGreaterThan(0);
  });
});

describe('RiskTracker', () => {
  let tempDir;
  let riskTracker;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'risk-test-'));
    riskTracker = new RiskTracker();
    await riskTracker.setProjectPath(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should add risk', async () => {
    const risk = await riskTracker.add({
      title: 'Test risk',
      category: RiskCategory.TECHNICAL,
      severity: RiskSeverity.MEDIUM
    });

    expect(risk.id).toMatch(/^risk-/);
    expect(risk.title).toBe('Test risk');
    expect(risk.score).toBeDefined();
  });

  test('should calculate risk score', async () => {
    const risk = await riskTracker.add({
      title: 'High risk',
      severity: RiskSeverity.HIGH,
      likelihood: 'high',
      impact: 'high'
    });

    // Score = 3 (likelihood) * 3 (impact) * 4 (high severity weight) = 36
    expect(risk.score).toBe(36);
  });

  test('should update risk', async () => {
    const risk = await riskTracker.add({
      title: 'Original title',
      severity: RiskSeverity.LOW
    });

    const updated = await riskTracker.update(risk.id, {
      title: 'Updated title',
      severity: RiskSeverity.HIGH
    });

    expect(updated.title).toBe('Updated title');
    expect(updated.severity).toBe(RiskSeverity.HIGH);
  });

  test('should mitigate risk', async () => {
    const risk = await riskTracker.add({
      title: 'Risk to mitigate',
      severity: RiskSeverity.MEDIUM
    });

    const mitigated = await riskTracker.mitigate(risk.id, {
      description: 'Added input validation',
      mitigatedBy: 'security-team',
      effectiveness: 80
    });

    expect(mitigated.status).toBe(RiskStatus.MITIGATED);
    expect(mitigated.residualScore).toBeDefined();
  });

  test('should accept risk', async () => {
    const risk = await riskTracker.add({
      title: 'Accepted risk',
      severity: RiskSeverity.LOW
    });

    const accepted = await riskTracker.accept(risk.id, {
      acceptedBy: 'product-owner',
      reason: 'Low impact, cost to fix exceeds benefit'
    });

    expect(accepted.status).toBe(RiskStatus.ACCEPTED);
    expect(accepted.acceptanceReason).toBeDefined();
  });

  test('should get critical unmitigated risks', async () => {
    await riskTracker.add({ title: 'Critical risk', severity: RiskSeverity.CRITICAL });
    await riskTracker.add({ title: 'Low risk', severity: RiskSeverity.LOW });

    const critical = await riskTracker.getCriticalUnmitigated();
    expect(critical).toHaveLength(1);
    expect(critical[0].severity).toBe(RiskSeverity.CRITICAL);
  });

  test('should get risk summary', async () => {
    await riskTracker.add({ title: 'Risk 1', severity: RiskSeverity.HIGH });
    await riskTracker.add({ title: 'Risk 2', severity: RiskSeverity.MEDIUM });

    const summary = await riskTracker.getSummary();

    expect(summary.totalRisks).toBe(2);
    expect(summary.bySeverity[RiskSeverity.HIGH]).toBe(1);
    expect(summary.bySeverity[RiskSeverity.MEDIUM]).toBe(1);
  });
});

describe('AuditLogger', () => {
  let tempDir;
  let auditLogger;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'audit-test-'));
    auditLogger = new AuditLogger({ flushInterval: 0 }); // Disable auto-flush for tests
    await auditLogger.setProjectPath(tempDir);
  });

  afterEach(async () => {
    await auditLogger.shutdown();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should log audit entry', async () => {
    const entry = await auditLogger.log({
      type: AuditType.SCAN,
      action: 'SECURITY_SCAN_STARTED',
      severity: AuditSeverity.INFO
    });

    expect(entry.id).toMatch(/^audit-/);
    expect(entry.type).toBe(AuditType.SCAN);
  });

  test('should create alert', async () => {
    const alert = await auditLogger.alert({
      type: 'secret_exposure',
      title: 'API key exposed',
      description: 'API key found in source code',
      severity: AuditSeverity.CRITICAL
    });

    expect(alert.id).toMatch(/^alert-/);
    expect(alert.acknowledged).toBe(false);
    expect(alert.resolved).toBe(false);
  });

  test('should acknowledge alert', async () => {
    const alert = await auditLogger.alert({
      type: 'test_alert',
      title: 'Test alert',
      severity: AuditSeverity.WARNING
    });

    const acknowledged = await auditLogger.acknowledgeAlert(alert.id, 'security-admin');

    expect(acknowledged.acknowledged).toBe(true);
    expect(acknowledged.acknowledgedBy).toBe('security-admin');
  });

  test('should resolve alert', async () => {
    const alert = await auditLogger.alert({
      type: 'test_alert',
      title: 'Test alert',
      severity: AuditSeverity.WARNING
    });

    const resolved = await auditLogger.resolveAlert(alert.id, 'developer', 'Fixed the issue');

    expect(resolved.resolved).toBe(true);
    expect(resolved.resolution).toBe('Fixed the issue');
  });

  test('should query entries', async () => {
    await auditLogger.log({ type: AuditType.SCAN, action: 'SCAN_1' });
    await auditLogger.log({ type: AuditType.RISK, action: 'RISK_1' });
    await auditLogger.log({ type: AuditType.SCAN, action: 'SCAN_2' });
    await auditLogger.flush();

    const scanEntries = await auditLogger.query({ type: AuditType.SCAN });
    expect(scanEntries).toHaveLength(2);
  });

  test('should get active alerts', async () => {
    await auditLogger.alert({ type: 'alert1', title: 'Alert 1', severity: AuditSeverity.WARNING });
    const alert2 = await auditLogger.alert({ type: 'alert2', title: 'Alert 2', severity: AuditSeverity.WARNING });
    await auditLogger.resolveAlert(alert2.id, 'admin', 'Fixed');

    const active = await auditLogger.getActiveAlerts();
    expect(active).toHaveLength(1);
  });

  test('should generate report', async () => {
    await auditLogger.log({ type: AuditType.SCAN, action: 'SCAN', severity: AuditSeverity.INFO });
    await auditLogger.log({ type: AuditType.RISK, action: 'RISK', severity: AuditSeverity.WARNING });
    await auditLogger.flush();

    const report = await auditLogger.generateReport();

    expect(report.summary.totalEntries).toBe(2);
    expect(report.summary.byType[AuditType.SCAN]).toBe(1);
  });
});

describe('OpsValidator', () => {
  let tempDir;
  let opsValidator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ops-test-'));
    opsValidator = new OpsValidator();
    await opsValidator.setProjectPath(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test('should set environment', async () => {
    const env = await opsValidator.setEnvironment('production', {
      url: 'https://app.example.com',
      variables: { NODE_ENV: 'production' }
    });

    expect(env.name).toBe('production');
    expect(env.url).toBe('https://app.example.com');
  });

  test('should get environment', async () => {
    await opsValidator.setEnvironment('staging', {
      url: 'https://staging.example.com'
    });

    const env = opsValidator.getEnvironment('staging');
    expect(env.name).toBe('staging');
  });

  test('should validate environment', async () => {
    await opsValidator.setEnvironment('development', {
      url: 'http://localhost:3000',
      variables: { DEBUG: 'true' }
    });

    const result = await opsValidator.validateEnvironment('development');
    expect(result.environment).toBe('development');
  });

  test('should flag production issues', async () => {
    await opsValidator.setEnvironment('production', {
      type: EnvironmentType.PRODUCTION,
      url: 'http://insecure.example.com', // HTTP instead of HTTPS
      variables: { DEBUG: 'true' } // Debug in production
    });

    const result = await opsValidator.validateEnvironment('production');

    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.valid).toBe(false);
  });

  test('should detect hardcoded secrets', async () => {
    await opsValidator.setEnvironment('staging', {
      url: 'https://staging.example.com',
      variables: {
        API_KEY: 'sk-1234567890abcdef' // Hardcoded secret
      }
    });

    const result = await opsValidator.validateEnvironment('staging');

    const secretIssue = result.issues.find(i =>
      i.message.includes('hardcoded') || i.message.includes('API_KEY')
    );
    expect(secretIssue).toBeDefined();
  });

  test('should compare environments', async () => {
    await opsValidator.setEnvironment('staging', {
      variables: { API_URL: 'https://api-staging.com', DEBUG: 'true' },
      features: { newFeature: true }
    });

    await opsValidator.setEnvironment('production', {
      variables: { API_URL: 'https://api.com' },
      features: { newFeature: false }
    });

    const diff = opsValidator.compareEnvironments('staging', 'production');

    expect(diff.variables.onlyIn1).toContain('DEBUG');
    expect(diff.features.different).toHaveLength(1);
  });

  test('should validate files', async () => {
    const result = await opsValidator.validateFiles();
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('issues');
  });

  test('should run full validation', async () => {
    await opsValidator.setEnvironment('development', {
      url: 'http://localhost:3000'
    });

    const result = await opsValidator.validate();

    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('environments');
    expect(result).toHaveProperty('issues');
    expect(result).toHaveProperty('warnings');
  });
});
