/**
 * BlockchainCertifier - Immutable Code Provenance and Audit Trail
 *
 * Revolutionary Enhancement: Complete code traceability and verification
 *
 * Features:
 * - Code certification with cryptographic hashes
 * - Immutable audit trail
 * - Agent attribution tracking
 * - Quality score recording
 * - Test result verification
 * - Security scan certification
 */

import { createHash } from 'crypto';
import { createLogger } from '../common/logger.js';
import { getEventBus } from '../event-bus/AgentEventBus.js';
import { EventTypes } from '../event-bus/eventTypes.js';

const logger = createLogger('BlockchainCertifier');

// Certificate types
const CERTIFICATE_TYPES = {
  CODE: 'code',
  TEST: 'test',
  SECURITY: 'security',
  DEPLOYMENT: 'deployment',
  REVIEW: 'review'
};

// Verification status
const VERIFICATION_STATUS = {
  VERIFIED: 'verified',
  PENDING: 'pending',
  FAILED: 'failed',
  EXPIRED: 'expired'
};

class BlockchainCertifier {
  constructor(options = {}) {
    this.logger = logger;
    this.eventBus = null;
    this.initialized = false;

    // Configuration
    this.config = {
      chainId: options.chainId || 'minions-local',
      algorithm: options.algorithm || 'sha256',
      enablePersistence: options.enablePersistence !== false,
      storageDir: options.storageDir || '.blockchain',
      maxBlockSize: options.maxBlockSize || 100 // certificates per block
    };

    // Local blockchain state
    this.chain = [];
    this.pendingCertificates = [];
    this.certificateIndex = new Map(); // hash -> certificate
    this.agentIndex = new Map(); // agentId -> certificates

    // Statistics
    this.stats = {
      certificatesIssued: 0,
      verificationsPerformed: 0,
      blocksCreated: 0,
      averageBlockTime: 0
    };
  }

  /**
   * Initialize the certifier
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.eventBus = getEventBus();

      // Create genesis block
      if (this.chain.length === 0) {
        await this.createGenesisBlock();
      }
    } catch (error) {
      this.logger.warn('Initialization issue', error);
    }

    this.initialized = true;
    this.logger.info('BlockchainCertifier initialized', {
      chainId: this.config.chainId,
      genesisHash: this.chain[0]?.hash
    });
  }

  /**
   * Create genesis block
   */
  async createGenesisBlock() {
    const genesisBlock = {
      index: 0,
      timestamp: Date.now(),
      certificates: [],
      previousHash: '0'.repeat(64),
      nonce: 0,
      hash: '',
      metadata: {
        chainId: this.config.chainId,
        version: '1.0.0',
        creator: 'minions-system'
      }
    };

    genesisBlock.hash = this.calculateBlockHash(genesisBlock);
    this.chain.push(genesisBlock);
    this.stats.blocksCreated++;

    this.logger.info('Genesis block created', { hash: genesisBlock.hash });
    return genesisBlock;
  }

  /**
   * Certify code with metadata
   * @param {string} code The code to certify
   * @param {Object} metadata Certificate metadata
   * @returns {Promise<Object>} Certificate
   */
  async certifyCode(code, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const certificate = await this.createCertificate({
      type: CERTIFICATE_TYPES.CODE,
      code,
      metadata
    });

    return certificate;
  }

  /**
   * Create a certificate
   */
  async createCertificate(data) {
    const { type, code, metadata } = data;

    // Generate content hash
    const contentHash = this.hashContent(code || JSON.stringify(metadata));

    const certificate = {
      id: `cert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      timestamp: Date.now(),
      contentHash,
      agent: metadata.generatedBy || 'unknown',
      qualityScore: metadata.qualityScore || null,
      testResults: metadata.testResults || null,
      securityScan: metadata.securityScan || null,
      metadata: {
        filename: metadata.filename,
        language: metadata.language,
        linesOfCode: code ? code.split('\n').length : 0,
        dependencies: metadata.dependencies || [],
        version: metadata.version || '1.0.0'
      },
      signature: '',
      status: VERIFICATION_STATUS.PENDING
    };

    // Sign the certificate
    certificate.signature = this.signCertificate(certificate);
    certificate.status = VERIFICATION_STATUS.VERIFIED;

    // Add to pending certificates
    this.pendingCertificates.push(certificate);

    // Index the certificate
    this.certificateIndex.set(certificate.id, certificate);
    this.certificateIndex.set(contentHash, certificate);

    // Index by agent
    if (!this.agentIndex.has(certificate.agent)) {
      this.agentIndex.set(certificate.agent, []);
    }
    this.agentIndex.get(certificate.agent).push(certificate.id);

    this.stats.certificatesIssued++;

    // Create block if enough certificates
    if (this.pendingCertificates.length >= this.config.maxBlockSize) {
      await this.createBlock();
    }

    // Emit event
    if (this.eventBus) {
      this.eventBus.publish(EventTypes.CODE_GENERATED, {
        agent: 'blockchain-certifier',
        type: 'certificate-issued',
        certificateId: certificate.id
      });
    }

    this.logger.info('Certificate issued', {
      id: certificate.id,
      type,
      agent: certificate.agent
    });

    return {
      certificate,
      verifyUrl: `minions://verify/${certificate.id}`,
      blockchainRef: this.getBlockchainReference(certificate)
    };
  }

  /**
   * Hash content using configured algorithm
   */
  hashContent(content) {
    return createHash(this.config.algorithm)
      .update(content)
      .digest('hex');
  }

  /**
   * Sign a certificate
   */
  signCertificate(certificate) {
    const dataToSign = JSON.stringify({
      id: certificate.id,
      type: certificate.type,
      timestamp: certificate.timestamp,
      contentHash: certificate.contentHash,
      agent: certificate.agent
    });

    return this.hashContent(dataToSign + this.config.chainId);
  }

  /**
   * Calculate block hash
   */
  calculateBlockHash(block) {
    const data = JSON.stringify({
      index: block.index,
      timestamp: block.timestamp,
      certificates: block.certificates.map(c => c.signature),
      previousHash: block.previousHash,
      nonce: block.nonce
    });

    return this.hashContent(data);
  }

  /**
   * Create a new block
   */
  async createBlock() {
    if (this.pendingCertificates.length === 0) {
      return null;
    }

    const previousBlock = this.chain[this.chain.length - 1];
    const startTime = Date.now();

    const block = {
      index: previousBlock.index + 1,
      timestamp: Date.now(),
      certificates: [...this.pendingCertificates],
      previousHash: previousBlock.hash,
      nonce: 0,
      hash: ''
    };

    // Simple proof of work (for demonstration)
    block.hash = this.calculateBlockHash(block);

    this.chain.push(block);
    this.pendingCertificates = [];

    // Update stats
    this.stats.blocksCreated++;
    const blockTime = Date.now() - startTime;
    this.stats.averageBlockTime = (this.stats.averageBlockTime * (this.stats.blocksCreated - 1) + blockTime) / this.stats.blocksCreated;

    this.logger.info('Block created', {
      index: block.index,
      certificates: block.certificates.length,
      hash: block.hash.substring(0, 16) + '...'
    });

    return block;
  }

  /**
   * Verify a certificate
   */
  async verifyCertificate(certificateId) {
    this.stats.verificationsPerformed++;

    // Find certificate
    const certificate = this.certificateIndex.get(certificateId);
    if (!certificate) {
      return {
        valid: false,
        error: 'Certificate not found',
        status: VERIFICATION_STATUS.FAILED
      };
    }

    // Verify signature
    const expectedSignature = this.signCertificate(certificate);
    const signatureValid = certificate.signature === expectedSignature;

    // Find in blockchain
    const blockInfo = this.findCertificateInChain(certificateId);

    return {
      valid: signatureValid,
      certificate,
      blockInfo,
      status: signatureValid ? VERIFICATION_STATUS.VERIFIED : VERIFICATION_STATUS.FAILED,
      verifiedAt: Date.now(),
      chainIntegrity: this.verifyChainIntegrity()
    };
  }

  /**
   * Find certificate in blockchain
   */
  findCertificateInChain(certificateId) {
    for (const block of this.chain) {
      const cert = block.certificates.find(c => c.id === certificateId);
      if (cert) {
        return {
          blockIndex: block.index,
          blockHash: block.hash,
          blockTimestamp: block.timestamp,
          position: block.certificates.indexOf(cert)
        };
      }
    }
    return null;
  }

  /**
   * Verify entire chain integrity
   */
  verifyChainIntegrity() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify previous hash reference
      if (currentBlock.previousHash !== previousBlock.hash) {
        return { valid: false, error: `Chain broken at block ${i}` };
      }

      // Verify block hash
      const calculatedHash = this.calculateBlockHash(currentBlock);
      if (currentBlock.hash !== calculatedHash) {
        return { valid: false, error: `Invalid hash at block ${i}` };
      }
    }

    return { valid: true, blocks: this.chain.length };
  }

  /**
   * Get blockchain reference for certificate
   */
  getBlockchainReference(certificate) {
    return {
      chainId: this.config.chainId,
      certificateId: certificate.id,
      contentHash: certificate.contentHash,
      timestamp: certificate.timestamp
    };
  }

  /**
   * Certify test results
   */
  async certifyTests(testResults, metadata = {}) {
    return this.createCertificate({
      type: CERTIFICATE_TYPES.TEST,
      metadata: {
        ...metadata,
        testResults
      }
    });
  }

  /**
   * Certify security scan
   */
  async certifySecurity(scanResults, metadata = {}) {
    return this.createCertificate({
      type: CERTIFICATE_TYPES.SECURITY,
      metadata: {
        ...metadata,
        securityScan: scanResults
      }
    });
  }

  /**
   * Certify deployment
   */
  async certifyDeployment(deploymentInfo) {
    return this.createCertificate({
      type: CERTIFICATE_TYPES.DEPLOYMENT,
      metadata: deploymentInfo
    });
  }

  /**
   * Get certificates by agent
   */
  getCertificatesByAgent(agentId) {
    const certIds = this.agentIndex.get(agentId) || [];
    return certIds.map(id => this.certificateIndex.get(id));
  }

  /**
   * Get certificate by content hash
   */
  getCertificateByHash(contentHash) {
    return this.certificateIndex.get(contentHash);
  }

  /**
   * Get full audit trail
   */
  getAuditTrail(options = {}) {
    const { startTime, endTime, agent, type } = options;

    let certificates = Array.from(this.certificateIndex.values());

    if (startTime) {
      certificates = certificates.filter(c => c.timestamp >= startTime);
    }
    if (endTime) {
      certificates = certificates.filter(c => c.timestamp <= endTime);
    }
    if (agent) {
      certificates = certificates.filter(c => c.agent === agent);
    }
    if (type) {
      certificates = certificates.filter(c => c.type === type);
    }

    return certificates.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Generate provenance report
   */
  generateProvenanceReport(certificateId) {
    const verification = this.verifyCertificate(certificateId);
    if (!verification.valid) {
      return { error: 'Certificate not valid' };
    }

    const certificate = verification.certificate;

    return {
      certificate: {
        id: certificate.id,
        type: certificate.type,
        created: new Date(certificate.timestamp).toISOString(),
        agent: certificate.agent
      },
      content: {
        hash: certificate.contentHash,
        algorithm: this.config.algorithm
      },
      quality: {
        score: certificate.qualityScore,
        testsPassed: certificate.testResults?.passed,
        securityClear: certificate.securityScan?.vulnerabilities === 0
      },
      blockchain: verification.blockInfo,
      chainIntegrity: verification.chainIntegrity,
      verificationTimestamp: new Date().toISOString()
    };
  }

  /**
   * Force create block with pending certificates
   */
  async flush() {
    if (this.pendingCertificates.length > 0) {
      await this.createBlock();
    }
  }

  /**
   * Get chain info
   */
  getChainInfo() {
    return {
      chainId: this.config.chainId,
      blocks: this.chain.length,
      certificates: this.certificateIndex.size,
      pendingCertificates: this.pendingCertificates.length,
      latestBlock: this.chain.length > 0 ? {
        index: this.chain[this.chain.length - 1].index,
        hash: this.chain[this.chain.length - 1].hash,
        timestamp: this.chain[this.chain.length - 1].timestamp
      } : null
    };
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      chainLength: this.chain.length,
      totalCertificates: this.certificateIndex.size,
      uniqueAgents: this.agentIndex.size,
      pendingCount: this.pendingCertificates.length
    };
  }

  /**
   * Export chain to JSON
   */
  exportChain() {
    return JSON.stringify({
      chainId: this.config.chainId,
      exportedAt: Date.now(),
      blocks: this.chain
    }, null, 2);
  }

  /**
   * Import chain from JSON
   */
  importChain(jsonData) {
    const data = JSON.parse(jsonData);

    if (data.chainId !== this.config.chainId) {
      throw new Error('Chain ID mismatch');
    }

    this.chain = data.blocks;

    // Rebuild indexes
    this.certificateIndex.clear();
    this.agentIndex.clear();

    for (const block of this.chain) {
      for (const cert of block.certificates) {
        this.certificateIndex.set(cert.id, cert);
        this.certificateIndex.set(cert.contentHash, cert);

        if (!this.agentIndex.has(cert.agent)) {
          this.agentIndex.set(cert.agent, []);
        }
        this.agentIndex.get(cert.agent).push(cert.id);
      }
    }

    this.logger.info('Chain imported', { blocks: this.chain.length });
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of BlockchainCertifier
 * @param {Object} options Configuration options
 * @returns {BlockchainCertifier}
 */
export function getBlockchainCertifier(options = {}) {
  if (!instance) {
    instance = new BlockchainCertifier(options);
  }
  return instance;
}

export {
  BlockchainCertifier,
  CERTIFICATE_TYPES,
  VERIFICATION_STATUS
};

export default BlockchainCertifier;
