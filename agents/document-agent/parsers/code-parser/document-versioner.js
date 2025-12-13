import crypto from 'crypto';
import { createLogger } from '../../../../foundation/common/logger.js';
import { getDocumentCache } from '../../cache/DocumentCache.js';

const logger = createLogger('DocumentVersioner');

/**
 * DocumentVersioner - Manages document versions and tracks changes over time
 *
 * Features:
 * - Semantic versioning (major.minor.patch)
 * - Version history tracking
 * - Change-based version bumping
 * - Document comparison
 * - Version rollback support
 * - Breaking change detection integration
 *
 * Version Bumping Rules:
 * - MAJOR: Breaking API changes
 * - MINOR: New features (backwards-compatible)
 * - PATCH: Bug fixes and documentation updates
 */
class DocumentVersioner {
  constructor() {
    this.logger = createLogger('DocumentVersioner');
    this.cache = getDocumentCache();
    this.versionHistory = new Map();
  }

  /**
   * Initialize the versioner
   */
  async initialize() {
    if (!this.cache.initialized) {
      await this.cache.initialize();
    }
    this.logger.info('DocumentVersioner initialized');
  }

  /**
   * Create a new document version
   *
   * @param {string} documentId - Unique document identifier
   * @param {Object} content - Document content
   * @param {Object} metadata - Version metadata
   * @returns {Object} Version record
   */
  async createVersion(documentId, content, metadata = {}) {
    this.logger.info(`Creating new version for document: ${documentId}`);

    const currentVersion = await this.getCurrentVersion(documentId);
    const newVersion = this.calculateNextVersion(currentVersion, metadata.changeType);

    const versionRecord = {
      documentId,
      version: newVersion,
      content,
      contentHash: this.hashContent(content),
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        author: metadata.author || 'system',
        changeType: metadata.changeType || 'patch',
        message: metadata.message || 'Updated document'
      },
      previous: currentVersion ? currentVersion.version : null
    };

    // Store in version history
    if (!this.versionHistory.has(documentId)) {
      this.versionHistory.set(documentId, []);
    }
    this.versionHistory.get(documentId).push(versionRecord);

    // Cache the new version
    await this.cache.set(
      `version:${documentId}:${newVersion}`,
      versionRecord
    );

    // Update current version pointer
    await this.cache.set(`current:${documentId}`, versionRecord);

    this.logger.info(
      `Created version ${newVersion} for document ${documentId} ` +
      `(changeType: ${metadata.changeType})`
    );

    return versionRecord;
  }

  /**
   * Get current version of a document
   *
   * @param {string} documentId - Document identifier
   * @returns {Object|null} Current version record
   */
  async getCurrentVersion(documentId) {
    const cached = await this.cache.get(`current:${documentId}`);
    if (cached) {
      return cached;
    }

    // Check version history
    const history = this.versionHistory.get(documentId);
    if (history && history.length > 0) {
      return history[history.length - 1];
    }

    return null;
  }

  /**
   * Get specific version of a document
   *
   * @param {string} documentId - Document identifier
   * @param {string} version - Version number (e.g., "1.2.3")
   * @returns {Object|null} Version record
   */
  async getVersion(documentId, version) {
    // Try cache first
    const cached = await this.cache.get(`version:${documentId}:${version}`);
    if (cached) {
      return cached;
    }

    // Search version history
    const history = this.versionHistory.get(documentId);
    if (history) {
      return history.find(v => v.version === version) || null;
    }

    return null;
  }

  /**
   * Get version history for a document
   *
   * @param {string} documentId - Document identifier
   * @param {Object} options - Query options
   * @returns {Array} Version history
   */
  async getHistory(documentId, options = {}) {
    const { limit = 10, offset = 0, order = 'desc' } = options;

    let history = this.versionHistory.get(documentId) || [];

    // Sort by version
    history = [...history].sort((a, b) => {
      const compare = this.compareVersionNumbers(a.version, b.version);
      return order === 'desc' ? -compare : compare;
    });

    // Apply pagination
    return history.slice(offset, offset + limit);
  }

  /**
   * Calculate next version number based on change type
   *
   * @param {Object|null} currentVersion - Current version record
   * @param {string} changeType - Type of change (major|minor|patch)
   * @returns {string} Next version number
   */
  calculateNextVersion(currentVersion, changeType = 'patch') {
    if (!currentVersion) {
      return '1.0.0';
    }

    const { major, minor, patch } = this.parseVersion(currentVersion.version);

    switch (changeType) {
      case 'major':
        return `${major + 1}.0.0`;
      case 'minor':
        return `${major}.${minor + 1}.0`;
      case 'patch':
      default:
        return `${major}.${minor}.${patch + 1}`;
    }
  }

  /**
   * Determine change type from breaking changes
   *
   * @param {Object} breakingChanges - Breaking change detection results
   * @returns {string} Change type (major|minor|patch)
   */
  determineChangeType(breakingChanges) {
    if (breakingChanges.breaking && breakingChanges.breaking.length > 0) {
      return 'major';
    }

    if (breakingChanges.additions && breakingChanges.additions.length > 0) {
      return 'minor';
    }

    return 'patch';
  }

  /**
   * Parse version string into components
   *
   * @param {string} version - Version string (e.g., "1.2.3")
   * @returns {Object} Version components
   */
  parseVersion(version) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
      throw new Error(`Invalid version format: ${version}`);
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10)
    };
  }

  /**
   * Compare two versions
   *
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
   */
  compareVersionNumbers(version1, version2) {
    const v1 = this.parseVersion(version1);
    const v2 = this.parseVersion(version2);

    if (v1.major !== v2.major) return v1.major - v2.major;
    if (v1.minor !== v2.minor) return v1.minor - v2.minor;
    return v1.patch - v2.patch;
  }

  /**
   * Create content hash for change detection
   *
   * @param {Object} content - Document content
   * @returns {string} SHA-256 hash
   */
  hashContent(content) {
    const serialized = JSON.stringify(content, Object.keys(content).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  /**
   * Compare two document versions
   *
   * @param {string} documentId - Document identifier
   * @param {string} version1 - First version
   * @param {string} version2 - Second version
   * @returns {Object} Comparison results
   */
  async compareDocumentVersions(documentId, version1, version2) {
    const v1 = await this.getVersion(documentId, version1);
    const v2 = await this.getVersion(documentId, version2);

    if (!v1 || !v2) {
      throw new Error(`Version not found: ${!v1 ? version1 : version2}`);
    }

    return {
      documentId,
      fromVersion: version1,
      toVersion: version2,
      contentChanged: v1.contentHash !== v2.contentHash,
      versionDiff: this.compareVersionNumbers(version1, version2),
      metadata: {
        v1: v1.metadata,
        v2: v2.metadata
      }
    };
  }

  /**
   * Rollback to a previous version
   *
   * @param {string} documentId - Document identifier
   * @param {string} targetVersion - Version to rollback to
   * @param {Object} metadata - Rollback metadata
   * @returns {Object} New version record (rollback creates a new version)
   */
  async rollback(documentId, targetVersion, metadata = {}) {
    this.logger.info(`Rolling back document ${documentId} to version ${targetVersion}`);

    const targetRecord = await this.getVersion(documentId, targetVersion);
    if (!targetRecord) {
      throw new Error(`Target version not found: ${targetVersion}`);
    }

    // Create a new version with the old content
    const rollbackVersion = await this.createVersion(
      documentId,
      targetRecord.content,
      {
        ...metadata,
        changeType: 'patch',
        message: `Rollback to version ${targetVersion}`,
        rollbackFrom: targetVersion
      }
    );

    this.logger.info(
      `Rolled back document ${documentId} to version ${targetVersion}, ` +
      `created new version ${rollbackVersion.version}`
    );

    return rollbackVersion;
  }

  /**
   * Tag a version with a label
   *
   * @param {string} documentId - Document identifier
   * @param {string} version - Version to tag
   * @param {string} tag - Tag name (e.g., "stable", "beta")
   * @returns {Object} Updated version record
   */
  async tagVersion(documentId, version, tag) {
    const versionRecord = await this.getVersion(documentId, version);
    if (!versionRecord) {
      throw new Error(`Version not found: ${version}`);
    }

    if (!versionRecord.metadata.tags) {
      versionRecord.metadata.tags = [];
    }

    if (!versionRecord.metadata.tags.includes(tag)) {
      versionRecord.metadata.tags.push(tag);
    }

    // Update cache
    await this.cache.set(
      `version:${documentId}:${version}`,
      versionRecord
    );

    this.logger.info(`Tagged version ${version} of document ${documentId} with: ${tag}`);

    return versionRecord;
  }

  /**
   * Get all versions with a specific tag
   *
   * @param {string} documentId - Document identifier
   * @param {string} tag - Tag to filter by
   * @returns {Array} Tagged versions
   */
  async getVersionsByTag(documentId, tag) {
    const history = this.versionHistory.get(documentId) || [];
    return history.filter(v => v.metadata.tags && v.metadata.tags.includes(tag));
  }

  /**
   * Check if document has uncommitted changes
   *
   * @param {string} documentId - Document identifier
   * @param {Object} currentContent - Current document content
   * @returns {boolean} True if changes detected
   */
  async hasUncommittedChanges(documentId, currentContent) {
    const currentVersion = await this.getCurrentVersion(documentId);
    if (!currentVersion) {
      return true; // No version exists, so any content is uncommitted
    }

    const currentHash = this.hashContent(currentContent);
    return currentHash !== currentVersion.contentHash;
  }

  /**
   * Get version statistics
   *
   * @param {string} documentId - Document identifier
   * @returns {Object} Version statistics
   */
  async getVersionStats(documentId) {
    const history = this.versionHistory.get(documentId) || [];
    const currentVersion = await this.getCurrentVersion(documentId);

    const stats = {
      totalVersions: history.length,
      currentVersion: currentVersion ? currentVersion.version : null,
      changeTypes: {
        major: 0,
        minor: 0,
        patch: 0
      },
      authors: new Set(),
      tags: new Set()
    };

    for (const version of history) {
      const changeType = version.metadata.changeType || 'patch';
      stats.changeTypes[changeType]++;

      if (version.metadata.author) {
        stats.authors.add(version.metadata.author);
      }

      if (version.metadata.tags) {
        version.metadata.tags.forEach(tag => stats.tags.add(tag));
      }
    }

    stats.authors = Array.from(stats.authors);
    stats.tags = Array.from(stats.tags);

    return stats;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of DocumentVersioner
 * @returns {DocumentVersioner}
 */
export function getDocumentVersioner() {
  if (!instance) {
    instance = new DocumentVersioner();
  }
  return instance;
}

export { DocumentVersioner };
export default DocumentVersioner;
