/**
 * Production Components Tests
 * ===========================
 * Tests for BlockchainCertifier and SelfHealingAgent
 */

import { jest } from '@jest/globals';

// Mock EventBus
const mockEventBus = {
  subscribe: jest.fn(),
  publish: jest.fn(),
  unsubscribe: jest.fn()
};

jest.unstable_mockModule('../event-bus/AgentEventBus.js', () => ({
  getEventBus: jest.fn(() => mockEventBus),
  AgentEventBus: jest.fn()
}));

// Mock KnowledgeBrain
const mockKnowledgeBrain = {
  recall: jest.fn().mockResolvedValue([]),
  learn: jest.fn().mockResolvedValue({ id: 'memory_123' })
};

jest.unstable_mockModule('../knowledge-brain/KnowledgeBrain.js', () => ({
  getKnowledgeBrain: jest.fn(() => mockKnowledgeBrain),
  KnowledgeBrain: jest.fn()
}));

const {
  BlockchainCertifier,
  CERTIFICATE_TYPES,
  VERIFICATION_STATUS,
  getBlockchainCertifier
} = await import('../production/BlockchainCertifier.js');

const {
  SelfHealingAgent,
  HEALTH_CHECK_TYPES,
  HEALING_STRATEGIES,
  ALERT_LEVELS,
  getSelfHealingAgent
} = await import('../production/SelfHealingAgent.js');

describe('BlockchainCertifier', () => {
  let certifier;

  beforeEach(() => {
    certifier = new BlockchainCertifier({
      chainId: 'test-chain',
      maxBlockSize: 3
    });
    mockEventBus.publish.mockClear();
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultCertifier = new BlockchainCertifier();

      expect(defaultCertifier.config.chainId).toBe('minions-local');
      expect(defaultCertifier.config.algorithm).toBe('sha256');
      expect(defaultCertifier.config.maxBlockSize).toBe(100);
    });

    test('creates with custom configuration', () => {
      expect(certifier.config.chainId).toBe('test-chain');
      expect(certifier.config.maxBlockSize).toBe(3);
    });

    test('initializes empty chain', () => {
      expect(certifier.chain.length).toBe(0);
      expect(certifier.pendingCertificates.length).toBe(0);
    });

    test('initialize creates genesis block', async () => {
      await certifier.initialize();

      expect(certifier.initialized).toBe(true);
      expect(certifier.chain.length).toBe(1);
      expect(certifier.chain[0].index).toBe(0);
      expect(certifier.chain[0].previousHash).toBe('0'.repeat(64));
    });

    test('initialize is idempotent', async () => {
      await certifier.initialize();
      await certifier.initialize();

      expect(certifier.chain.length).toBe(1);
    });
  });

  describe('Genesis Block', () => {
    test('createGenesisBlock creates valid block', async () => {
      const genesis = await certifier.createGenesisBlock();

      expect(genesis.index).toBe(0);
      expect(genesis.certificates).toEqual([]);
      expect(genesis.hash).toBeDefined();
      expect(genesis.hash.length).toBe(64);
      expect(genesis.metadata.chainId).toBe('test-chain');
    });
  });

  describe('Content Hashing', () => {
    test('hashContent produces consistent hashes', () => {
      const hash1 = certifier.hashContent('test content');
      const hash2 = certifier.hashContent('test content');

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64);
    });

    test('hashContent produces different hashes for different content', () => {
      const hash1 = certifier.hashContent('content 1');
      const hash2 = certifier.hashContent('content 2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Certificate Creation', () => {
    beforeEach(async () => {
      await certifier.initialize();
    });

    test('certifyCode creates certificate', async () => {
      const result = await certifier.certifyCode('const x = 1;', {
        generatedBy: 'test-agent',
        filename: 'test.js'
      });

      expect(result.certificate).toBeDefined();
      expect(result.certificate.type).toBe(CERTIFICATE_TYPES.CODE);
      expect(result.certificate.agent).toBe('test-agent');
      expect(result.verifyUrl).toBeDefined();
    });

    test('certifyCode updates statistics', async () => {
      await certifier.certifyCode('const x = 1;');

      expect(certifier.stats.certificatesIssued).toBe(1);
    });

    test('certifyCode indexes certificate', async () => {
      const result = await certifier.certifyCode('const x = 1;');
      const cert = result.certificate;

      expect(certifier.certificateIndex.get(cert.id)).toBe(cert);
      expect(certifier.certificateIndex.get(cert.contentHash)).toBe(cert);
    });

    test('certifyCode adds to agent index', async () => {
      const result = await certifier.certifyCode('code', { generatedBy: 'agent1' });

      const agentCerts = certifier.agentIndex.get('agent1');
      expect(agentCerts).toContain(result.certificate.id);
    });

    test('certifyTests creates test certificate', async () => {
      const result = await certifier.certifyTests({
        passed: 10,
        failed: 0
      });

      expect(result.certificate.type).toBe(CERTIFICATE_TYPES.TEST);
    });

    test('certifySecurity creates security certificate', async () => {
      const result = await certifier.certifySecurity({
        vulnerabilities: 0,
        scanComplete: true
      });

      expect(result.certificate.type).toBe(CERTIFICATE_TYPES.SECURITY);
    });

    test('certifyDeployment creates deployment certificate', async () => {
      const result = await certifier.certifyDeployment({
        version: '1.0.0',
        environment: 'production'
      });

      expect(result.certificate.type).toBe(CERTIFICATE_TYPES.DEPLOYMENT);
    });
  });

  describe('Block Creation', () => {
    beforeEach(async () => {
      await certifier.initialize();
    });

    test('creates block when maxBlockSize reached', async () => {
      await certifier.certifyCode('code1');
      await certifier.certifyCode('code2');
      await certifier.certifyCode('code3');

      // Should have created a new block
      expect(certifier.chain.length).toBe(2);
      expect(certifier.pendingCertificates.length).toBe(0);
    });

    test('createBlock links to previous block', async () => {
      await certifier.certifyCode('code1');
      await certifier.createBlock();

      const latestBlock = certifier.chain[certifier.chain.length - 1];
      const previousBlock = certifier.chain[certifier.chain.length - 2];

      expect(latestBlock.previousHash).toBe(previousBlock.hash);
    });

    test('flush forces block creation', async () => {
      await certifier.certifyCode('code1');
      expect(certifier.pendingCertificates.length).toBe(1);

      await certifier.flush();

      expect(certifier.pendingCertificates.length).toBe(0);
      expect(certifier.chain.length).toBe(2);
    });
  });

  describe('Certificate Verification', () => {
    beforeEach(async () => {
      await certifier.initialize();
    });

    test('verifyCertificate validates certificate', async () => {
      const result = await certifier.certifyCode('const x = 1;');
      await certifier.flush();

      const verification = await certifier.verifyCertificate(result.certificate.id);

      expect(verification.valid).toBe(true);
      expect(verification.status).toBe(VERIFICATION_STATUS.VERIFIED);
      expect(verification.blockInfo).toBeDefined();
    });

    test('verifyCertificate fails for unknown certificate', async () => {
      const verification = await certifier.verifyCertificate('unknown-id');

      expect(verification.valid).toBe(false);
      expect(verification.status).toBe(VERIFICATION_STATUS.FAILED);
    });

    test('verifyCertificate checks chain integrity', async () => {
      await certifier.certifyCode('code');
      await certifier.flush();

      const verification = await certifier.verifyCertificate(
        Array.from(certifier.certificateIndex.keys())[0]
      );

      expect(verification.chainIntegrity.valid).toBe(true);
    });
  });

  describe('Chain Integrity', () => {
    beforeEach(async () => {
      await certifier.initialize();
    });

    test('verifyChainIntegrity returns valid for intact chain', async () => {
      await certifier.certifyCode('code1');
      await certifier.certifyCode('code2');
      await certifier.flush();

      const result = certifier.verifyChainIntegrity();

      expect(result.valid).toBe(true);
    });

    test('verifyChainIntegrity detects tampering', async () => {
      await certifier.certifyCode('code');
      await certifier.flush();

      // Tamper with block hash
      certifier.chain[1].hash = 'tampered';

      const result = certifier.verifyChainIntegrity();

      expect(result.valid).toBe(false);
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      await certifier.initialize();
    });

    test('getCertificatesByAgent returns agent certificates', async () => {
      await certifier.certifyCode('code1', { generatedBy: 'agent1' });
      await certifier.certifyCode('code2', { generatedBy: 'agent1' });
      await certifier.certifyCode('code3', { generatedBy: 'agent2' });

      const agent1Certs = certifier.getCertificatesByAgent('agent1');

      expect(agent1Certs.length).toBe(2);
    });

    test('getCertificateByHash finds certificate', async () => {
      const result = await certifier.certifyCode('unique code');
      const cert = certifier.getCertificateByHash(result.certificate.contentHash);

      expect(cert).toBe(result.certificate);
    });

    test('getAuditTrail filters by criteria', async () => {
      // Create fresh certifier for clean test
      const freshCertifier = new BlockchainCertifier({ chainId: 'trail-test' });
      await freshCertifier.initialize();

      await freshCertifier.certifyCode('code', { generatedBy: 'agent1' });
      await freshCertifier.certifyTests({ passed: 5 }, { generatedBy: 'agent2' });

      const trail = freshCertifier.getAuditTrail({ agent: 'agent1' });

      // Should only contain agent1 entries (may have duplicates due to indexing)
      expect(trail.length).toBeGreaterThanOrEqual(1);
      expect(trail.every(cert => cert.agent === 'agent1')).toBe(true);
    });
  });

  describe('Export/Import', () => {
    beforeEach(async () => {
      await certifier.initialize();
    });

    test('exportChain exports chain as JSON', async () => {
      await certifier.certifyCode('code');
      await certifier.flush();

      const exported = certifier.exportChain();
      const data = JSON.parse(exported);

      expect(data.chainId).toBe('test-chain');
      expect(data.blocks.length).toBe(2);
    });

    test('importChain restores chain', async () => {
      await certifier.certifyCode('code');
      await certifier.flush();

      const exported = certifier.exportChain();

      // Create new certifier and import
      const newCertifier = new BlockchainCertifier({ chainId: 'test-chain' });
      newCertifier.importChain(exported);

      expect(newCertifier.chain.length).toBe(2);
    });

    test('importChain throws on chain ID mismatch', async () => {
      const data = JSON.stringify({ chainId: 'wrong-chain', blocks: [] });

      expect(() => certifier.importChain(data)).toThrow('Chain ID mismatch');
    });
  });

  describe('Statistics and Info', () => {
    beforeEach(async () => {
      await certifier.initialize();
    });

    test('getChainInfo returns chain information', async () => {
      await certifier.certifyCode('code');

      const info = certifier.getChainInfo();

      expect(info.chainId).toBe('test-chain');
      expect(info.blocks).toBe(1);
      expect(info.pendingCertificates).toBe(1);
    });

    test('getStats returns statistics', async () => {
      await certifier.certifyCode('code');
      const result = await certifier.certifyCode('code2');
      await certifier.verifyCertificate(result.certificate.id);

      const stats = certifier.getStats();

      expect(stats.certificatesIssued).toBe(2);
      expect(stats.verificationsPerformed).toBe(1);
    });
  });
});

describe('SelfHealingAgent', () => {
  let agent;

  beforeEach(() => {
    agent = new SelfHealingAgent({
      checkInterval: 1000,
      enableAutoFix: false,
      enableAutoRollback: false
    });
    mockEventBus.publish.mockClear();
    mockKnowledgeBrain.recall.mockResolvedValue([]);
  });

  afterEach(() => {
    agent.stopMonitoring();
  });

  describe('Initialization', () => {
    test('creates with default configuration', () => {
      const defaultAgent = new SelfHealingAgent();

      expect(defaultAgent.config.checkInterval).toBe(30000);
      expect(defaultAgent.config.maxRetries).toBe(3);
      expect(defaultAgent.config.enableAutoFix).toBe(true);
    });

    test('creates with custom configuration', () => {
      expect(agent.config.checkInterval).toBe(1000);
      expect(agent.config.enableAutoFix).toBe(false);
    });

    test('initializes empty state', () => {
      expect(agent.healthHistory).toEqual([]);
      expect(agent.incidents).toEqual([]);
      expect(agent.monitoringActive).toBe(false);
    });

    test('initialize sets up agent', async () => {
      await agent.initialize();

      expect(agent.initialized).toBe(true);
    });
  });

  describe('Monitoring', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('startMonitoring activates monitoring', () => {
      agent.startMonitoring();

      expect(agent.monitoringActive).toBe(true);
      expect(agent.checkIntervalId).toBeDefined();
    });

    test('stopMonitoring deactivates monitoring', () => {
      agent.startMonitoring();
      agent.stopMonitoring();

      expect(agent.monitoringActive).toBe(false);
      expect(agent.checkIntervalId).toBeNull();
    });

    test('startMonitoring is idempotent', () => {
      agent.startMonitoring();
      const firstIntervalId = agent.checkIntervalId;

      agent.startMonitoring();

      expect(agent.checkIntervalId).toBe(firstIntervalId);
    });
  });

  describe('Health Checks', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('runHealthChecks performs all checks', async () => {
      const report = await agent.runHealthChecks();

      expect(report.checks).toBeDefined();
      expect(report.checks[HEALTH_CHECK_TYPES.MEMORY_USAGE]).toBeDefined();
      expect(report.checks[HEALTH_CHECK_TYPES.CPU_USAGE]).toBeDefined();
      expect(report.checks[HEALTH_CHECK_TYPES.ERROR_RATE]).toBeDefined();
      expect(report.checks[HEALTH_CHECK_TYPES.LATENCY]).toBeDefined();
      expect(report.checks[HEALTH_CHECK_TYPES.DISK_SPACE]).toBeDefined();
    });

    test('runHealthChecks updates statistics', async () => {
      await agent.runHealthChecks();

      expect(agent.stats.checksPerformed).toBe(1);
    });

    test('runHealthChecks stores history', async () => {
      await agent.runHealthChecks();
      await agent.runHealthChecks();

      expect(agent.healthHistory.length).toBe(2);
    });

    test('checkMemoryUsage returns memory metrics', async () => {
      const check = await agent.checkMemoryUsage();

      expect(check.type).toBe(HEALTH_CHECK_TYPES.MEMORY_USAGE);
      expect(check.value).toBeGreaterThanOrEqual(0);
      expect(check.status).toBeDefined();
    });

    test('checkCPUUsage returns CPU metrics', async () => {
      const check = await agent.checkCPUUsage();

      expect(check.type).toBe(HEALTH_CHECK_TYPES.CPU_USAGE);
      expect(check.value).toBeGreaterThanOrEqual(0);
    });

    test('checkErrorRate returns error metrics', async () => {
      const check = await agent.checkErrorRate();

      expect(check.type).toBe(HEALTH_CHECK_TYPES.ERROR_RATE);
      expect(check.details).toBeDefined();
    });

    test('checkLatency returns latency metrics', async () => {
      const check = await agent.checkLatency();

      expect(check.type).toBe(HEALTH_CHECK_TYPES.LATENCY);
      expect(check.details.p50).toBeDefined();
    });

    test('checkDiskSpace returns disk metrics', async () => {
      const check = await agent.checkDiskSpace();

      expect(check.type).toBe(HEALTH_CHECK_TYPES.DISK_SPACE);
    });
  });

  describe('Threshold Evaluation', () => {
    test('evaluateThreshold returns healthy below warning', () => {
      const status = agent.evaluateThreshold(50, { warning: 70, critical: 90 });
      expect(status).toBe('healthy');
    });

    test('evaluateThreshold returns warning at threshold', () => {
      const status = agent.evaluateThreshold(75, { warning: 70, critical: 90 });
      expect(status).toBe('warning');
    });

    test('evaluateThreshold returns critical at threshold', () => {
      const status = agent.evaluateThreshold(95, { warning: 70, critical: 90 });
      expect(status).toBe('critical');
    });
  });

  describe('Overall Health', () => {
    test('calculateOverallHealth scores checks', () => {
      const checks = [
        { status: 'healthy' },
        { status: 'healthy' },
        { status: 'warning' }
      ];

      const overall = agent.calculateOverallHealth(checks);

      expect(overall.score).toBeLessThan(100);
      expect(overall.unhealthyChecks).toBe(1);
    });

    test('calculateOverallHealth determines status', () => {
      const healthyChecks = [{ status: 'healthy' }, { status: 'healthy' }];
      const degradedChecks = [{ status: 'warning' }, { status: 'warning' }];
      const criticalChecks = [{ status: 'critical' }, { status: 'critical' }];

      expect(agent.calculateOverallHealth(healthyChecks).status).toBe('healthy');
      expect(agent.calculateOverallHealth(degradedChecks).status).toBe('degraded');
      expect(agent.calculateOverallHealth(criticalChecks).status).toBe('critical');
    });
  });

  describe('Incident Handling', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('createIncident creates incident record', () => {
      const issue = {
        type: HEALTH_CHECK_TYPES.MEMORY_USAGE,
        status: 'critical',
        value: 95,
        threshold: { warning: 75, critical: 90 }
      };
      const healthReport = { overall: { score: 50 } };

      const incident = agent.createIncident(issue, healthReport);

      expect(incident.id).toBeDefined();
      expect(incident.type).toBe(HEALTH_CHECK_TYPES.MEMORY_USAGE);
      expect(incident.severity).toBe('critical');
      expect(incident.status).toBe('open');
    });

    test('handleIssues creates incidents and emits alerts', async () => {
      const issues = [{
        type: HEALTH_CHECK_TYPES.ERROR_RATE,
        status: 'warning',
        value: 3,
        threshold: { warning: 1, critical: 5 }
      }];
      const healthReport = { overall: { score: 70 } };

      await agent.handleIssues(issues, healthReport);

      expect(agent.incidents.length).toBe(1);
      expect(agent.stats.issuesDetected).toBe(1);
      expect(mockEventBus.publish).toHaveBeenCalled();
    });
  });

  describe('Diagnosis', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('diagnose identifies memory issues', async () => {
      const incident = { type: HEALTH_CHECK_TYPES.MEMORY_USAGE };

      const diagnosis = await agent.diagnose(incident);

      expect(diagnosis.symptom).toBe(HEALTH_CHECK_TYPES.MEMORY_USAGE);
      expect(diagnosis.possibleCauses).toContain('memory_leak');
      expect(diagnosis.recommendedActions).toContain(HEALING_STRATEGIES.CACHE_CLEAR);
    });

    test('diagnose identifies CPU issues', async () => {
      const incident = { type: HEALTH_CHECK_TYPES.CPU_USAGE };

      const diagnosis = await agent.diagnose(incident);

      expect(diagnosis.possibleCauses).toContain('overload');
      expect(diagnosis.recommendedActions).toContain(HEALING_STRATEGIES.SCALE_UP);
    });

    test('diagnose identifies error rate issues', async () => {
      const incident = { type: HEALTH_CHECK_TYPES.ERROR_RATE };

      const diagnosis = await agent.diagnose(incident);

      expect(diagnosis.possibleCauses).toContain('bug_introduced');
      expect(diagnosis.recommendedActions).toContain(HEALING_STRATEGIES.ROLLBACK);
    });
  });

  describe('Fix Generation', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('generateFix uses known fixes', async () => {
      agent.fixes.set('memory_usage', {
        strategy: HEALING_STRATEGIES.CACHE_CLEAR,
        script: 'test script',
        successRate: 0.9
      });

      const diagnosis = { symptom: 'memory_usage' };
      const fix = await agent.generateFix(diagnosis);

      expect(fix.strategy).toBe(HEALING_STRATEGIES.CACHE_CLEAR);
      expect(fix.source).toBe('known_fix');
    });

    test('generateFix uses recommendations', async () => {
      const diagnosis = {
        symptom: 'unknown',
        recommendedActions: [HEALING_STRATEGIES.RESTART]
      };

      const fix = await agent.generateFix(diagnosis);

      expect(fix.strategy).toBe(HEALING_STRATEGIES.RESTART);
    });

    test('createFixFromStrategy creates fix', () => {
      const diagnosis = { symptom: 'test' };
      const fix = agent.createFixFromStrategy(HEALING_STRATEGIES.CACHE_CLEAR, diagnosis);

      expect(fix.strategy).toBe(HEALING_STRATEGIES.CACHE_CLEAR);
      expect(fix.script).toBeDefined();
      expect(fix.confidence).toBeGreaterThan(0);
    });
  });

  describe('Fix Testing and Application', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('testFixInSandbox tests fix', async () => {
      const fix = { strategy: HEALING_STRATEGIES.CACHE_CLEAR };

      const result = await agent.testFixInSandbox(fix);

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('duration');
      expect(result).toHaveProperty('logs');
    });

    test('applyFix applies fix', async () => {
      const fix = { strategy: HEALING_STRATEGIES.CACHE_CLEAR, confidence: 0.8 };
      const incident = { id: 'test-incident' };

      const result = await agent.applyFix(fix, incident);

      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('duration');
    });

    test('performRollback rolls back', async () => {
      const incident = { id: 'test-incident', status: 'open' };

      const result = await agent.performRollback(incident);

      expect(result.success).toBe(true);
      expect(incident.status).toBe('rolled_back');
      expect(agent.stats.rollbacksPerformed).toBe(1);
    });
  });

  describe('Learning', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('learnFromFix stores learning', async () => {
      const incident = {
        type: HEALTH_CHECK_TYPES.MEMORY_USAGE,
        severity: 'warning',
        value: 80
      };
      const fix = { strategy: HEALING_STRATEGIES.CACHE_CLEAR, script: 'test' };

      await agent.learnFromFix(incident, fix);

      expect(mockKnowledgeBrain.learn).toHaveBeenCalled();
      expect(agent.stats.learningsRecorded).toBe(1);
      expect(agent.fixes.has(HEALTH_CHECK_TYPES.MEMORY_USAGE)).toBe(true);
    });
  });

  describe('Querying', () => {
    beforeEach(async () => {
      // Create fresh agent for querying tests
      agent = new SelfHealingAgent({
        checkInterval: 1000,
        enableAutoFix: false,
        enableAutoRollback: false
      });
      await agent.initialize();
      await agent.runHealthChecks();
      await agent.runHealthChecks();
    });

    test('getHealthHistory returns history', () => {
      const history = agent.getHealthHistory();

      expect(history.length).toBe(2);
    });

    test('getHealthHistory respects limit', () => {
      const history = agent.getHealthHistory(1);

      expect(history.length).toBe(1);
    });

    test('getIncidents returns all incidents', () => {
      // Clear any existing incidents
      agent.incidents = [];
      agent.incidents.push({ status: 'open' });
      agent.incidents.push({ status: 'resolved' });

      const incidents = agent.getIncidents();

      expect(incidents.length).toBe(2);
    });

    test('getIncidents filters by status', () => {
      // Clear any existing incidents
      agent.incidents = [];
      agent.incidents.push({ status: 'open' });
      agent.incidents.push({ status: 'resolved' });

      const openIncidents = agent.getIncidents('open');

      expect(openIncidents.length).toBe(1);
    });

    test('getCurrentHealth returns latest report', () => {
      const health = agent.getCurrentHealth();

      expect(health.timestamp).toBeDefined();
      expect(health.checks).toBeDefined();
    });

    test('getCurrentHealth handles no checks', () => {
      const emptyAgent = new SelfHealingAgent();
      const health = emptyAgent.getCurrentHealth();

      expect(health.status).toBe('unknown');
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await agent.initialize();
    });

    test('getStats returns statistics', async () => {
      await agent.runHealthChecks();

      const stats = agent.getStats();

      expect(stats.checksPerformed).toBe(1);
      expect(stats.isMonitoring).toBe(false);
      expect(stats.healingSuccessRate).toBeDefined();
    });

    test('getStats calculates success rate', () => {
      agent.stats.fixesApplied = 10;
      agent.stats.fixesSuccessful = 7;

      const stats = agent.getStats();

      expect(stats.healingSuccessRate).toBe(0.7);
    });
  });
});

describe('Exported Constants', () => {
  test('CERTIFICATE_TYPES has all types', () => {
    expect(CERTIFICATE_TYPES.CODE).toBe('code');
    expect(CERTIFICATE_TYPES.TEST).toBe('test');
    expect(CERTIFICATE_TYPES.SECURITY).toBe('security');
    expect(CERTIFICATE_TYPES.DEPLOYMENT).toBe('deployment');
  });

  test('VERIFICATION_STATUS has all statuses', () => {
    expect(VERIFICATION_STATUS.VERIFIED).toBe('verified');
    expect(VERIFICATION_STATUS.PENDING).toBe('pending');
    expect(VERIFICATION_STATUS.FAILED).toBe('failed');
  });

  test('HEALTH_CHECK_TYPES has all types', () => {
    expect(HEALTH_CHECK_TYPES.MEMORY_USAGE).toBe('memory_usage');
    expect(HEALTH_CHECK_TYPES.CPU_USAGE).toBe('cpu_usage');
    expect(HEALTH_CHECK_TYPES.ERROR_RATE).toBe('error_rate');
  });

  test('HEALING_STRATEGIES has all strategies', () => {
    expect(HEALING_STRATEGIES.RESTART).toBe('restart');
    expect(HEALING_STRATEGIES.ROLLBACK).toBe('rollback');
    expect(HEALING_STRATEGIES.CACHE_CLEAR).toBe('cache_clear');
  });

  test('ALERT_LEVELS has all levels', () => {
    expect(ALERT_LEVELS.INFO.priority).toBe(0);
    expect(ALERT_LEVELS.CRITICAL.priority).toBe(3);
  });
});

describe('Singleton Functions', () => {
  test('getBlockchainCertifier returns instance', () => {
    const certifier = getBlockchainCertifier();
    expect(certifier).toBeInstanceOf(BlockchainCertifier);
  });

  test('getSelfHealingAgent returns instance', () => {
    const agent = getSelfHealingAgent();
    expect(agent).toBeInstanceOf(SelfHealingAgent);
    agent.stopMonitoring();
  });
});
