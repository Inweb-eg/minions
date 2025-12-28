/**
 * Production Module - Self-Healing and Audit Trail System
 *
 * This module provides production-grade capabilities:
 *
 * - SelfHealingAgent: Automatic issue detection and resolution
 * - BlockchainCertifier: Immutable code provenance and audit
 */

// Import all components
import SelfHealingAgent, {
  getSelfHealingAgent,
  HEALTH_CHECK_TYPES,
  HEALING_STRATEGIES,
  ALERT_LEVELS
} from './SelfHealingAgent.js';

import BlockchainCertifier, {
  getBlockchainCertifier,
  CERTIFICATE_TYPES,
  VERIFICATION_STATUS
} from './BlockchainCertifier.js';

// Export classes
export {
  SelfHealingAgent,
  BlockchainCertifier
};

// Export singleton getters
export {
  getSelfHealingAgent,
  getBlockchainCertifier
};

// Export constants
export {
  HEALTH_CHECK_TYPES,
  HEALING_STRATEGIES,
  ALERT_LEVELS,
  CERTIFICATE_TYPES,
  VERIFICATION_STATUS
};

/**
 * Initialize the complete production system
 * @param {Object} options Configuration options
 * @returns {Promise<Object>} Initialized components
 */
export async function initializeProductionSystem(options = {}) {
  const {
    enableAutoFix = true,
    enableAutoRollback = true,
    checkInterval = 30000,
    chainId = 'minions-production'
  } = options;

  // Initialize components
  const healer = getSelfHealingAgent({
    enableAutoFix,
    enableAutoRollback,
    checkInterval
  });

  const certifier = getBlockchainCertifier({
    chainId
  });

  await Promise.all([
    healer.initialize(),
    certifier.initialize()
  ]);

  return {
    healer,
    certifier
  };
}

/**
 * Quick helper to start production monitoring
 * @returns {Object} Monitoring control
 */
export async function startProductionMonitoring() {
  const healer = getSelfHealingAgent();
  await healer.initialize();
  healer.startMonitoring();

  return {
    stop: () => healer.stopMonitoring(),
    getStatus: () => healer.getCurrentHealth(),
    getStats: () => healer.getStats()
  };
}

/**
 * Quick helper to certify code
 * @param {string} code The code to certify
 * @param {Object} metadata Certificate metadata
 * @returns {Promise<Object>} Certificate
 */
export async function certifyCode(code, metadata = {}) {
  const certifier = getBlockchainCertifier();
  await certifier.initialize();
  return certifier.certifyCode(code, metadata);
}

/**
 * Quick helper to verify a certificate
 * @param {string} certificateId The certificate ID to verify
 * @returns {Promise<Object>} Verification result
 */
export async function verifyCertificate(certificateId) {
  const certifier = getBlockchainCertifier();
  await certifier.initialize();
  return certifier.verifyCertificate(certificateId);
}

/**
 * Get production system statistics
 * @returns {Object} Combined statistics
 */
export function getProductionStats() {
  const healer = getSelfHealingAgent();
  const certifier = getBlockchainCertifier();

  return {
    healing: healer.getStats(),
    blockchain: certifier.getStats(),
    chainInfo: certifier.getChainInfo()
  };
}

/**
 * Get full audit trail
 * @param {Object} options Filter options
 * @returns {Array} Audit trail entries
 */
export async function getAuditTrail(options = {}) {
  const certifier = getBlockchainCertifier();
  await certifier.initialize();
  return certifier.getAuditTrail(options);
}

// Default export
export default {
  initializeProductionSystem,
  startProductionMonitoring,
  certifyCode,
  verifyCertificate,
  getProductionStats,
  getAuditTrail,
  getSelfHealingAgent,
  getBlockchainCertifier
};
