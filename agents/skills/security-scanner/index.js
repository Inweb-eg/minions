/**
 * Security Scanner Skill - Entry Point
 *
 * Provides automated security scanning capabilities for the agent system.
 *
 * Note: This FileSecurityScanner is distinct from foundation/SecurityScanner:
 * - FileSecurityScanner: File-based pattern scanning (this skill)
 * - foundation/SecurityScanner: AST-based code analysis (used by agents)
 */

import FileSecurityScanner, {
  getFileSecurityScanner,
  // Legacy exports for backward compatibility
  SecurityScanner,
  getSecurityScanner
} from './FileSecurityScanner.js';

// Primary exports (new names)
export { FileSecurityScanner, getFileSecurityScanner };

// Legacy exports for backward compatibility
export { SecurityScanner, getSecurityScanner };

export default getFileSecurityScanner;
