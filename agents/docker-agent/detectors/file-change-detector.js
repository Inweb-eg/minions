/**
 * FileChangeDetector - Detects Changes in Project Files
 *
 * Phase 8.1: Change Detectors
 * Monitors source code, configuration, and build files
 */

import { BaseDetector, CHANGE_TYPE, CHANGE_SEVERITY } from './base-detector.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File categories for severity assessment
 */
export const FILE_CATEGORY = {
  SOURCE: 'source',           // Source code files
  CONFIG: 'config',           // Configuration files
  BUILD: 'build',             // Build-related files
  STATIC: 'static',           // Static assets
  DOCUMENTATION: 'docs',      // Documentation
  TEST: 'test'                // Test files
};

/**
 * File patterns for categorization
 */
export const FILE_PATTERNS = {
  SOURCE: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.php', '.rb'],
  CONFIG: ['.json', '.yaml', '.yml', '.toml', '.ini', '.env', '.config'],
  BUILD: ['Makefile', 'webpack.config', 'vite.config', 'rollup.config', 'tsconfig.json'],
  STATIC: ['.css', '.scss', '.sass', '.less', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.ico'],
  DOCUMENTATION: ['.md', '.txt', '.doc', '.pdf', 'README', 'CHANGELOG', 'LICENSE'],
  TEST: ['.test.', '.spec.', '__tests__', 'test/', 'tests/']
};

/**
 * FileChangeDetector
 * Detects changes in project files
 */
export class FileChangeDetector extends BaseDetector {
  constructor() {
    super('FileChangeDetector', CHANGE_TYPE.FILE);
    this.fileHashes = new Map();
    this.directoryHashes = new Map();
    this.watchedPaths = [];
  }

  /**
   * Detect file changes
   * @param {Object} options - Detection options
   * @returns {Promise<Array>} Detected changes
   */
  async detect(options = {}) {
    const {
      projectPath = process.cwd(),
      paths = ['.'],
      excludes = ['node_modules', '.git', 'dist', 'build', 'coverage', '.next'],
      includeTests = false,
      recursive = true
    } = options;

    this.logger.info(`Detecting file changes in ${projectPath}`);
    const changes = [];

    for (const watchPath of paths) {
      const fullPath = path.join(projectPath, watchPath);

      if (!fs.existsSync(fullPath)) {
        this.logger.warn(`Path does not exist: ${fullPath}`);
        continue;
      }

      const stats = fs.statSync(fullPath);

      if (stats.isDirectory()) {
        const dirChanges = await this.detectDirectoryChanges(
          fullPath,
          excludes,
          includeTests,
          recursive
        );
        changes.push(...dirChanges);
      } else if (stats.isFile()) {
        const fileChange = await this.detectFileChange(fullPath);
        if (fileChange) {
          changes.push(fileChange);
        }
      }
    }

    this.lastChecked = new Date();
    this.logger.info(`Detected ${changes.length} file changes`);

    return changes;
  }

  /**
   * Detect changes in a directory
   * @param {string} dirPath - Directory path
   * @param {Array} excludes - Patterns to exclude
   * @param {boolean} includeTests - Include test files
   * @param {boolean} recursive - Recursive scan
   * @returns {Promise<Array>} Detected changes
   */
  async detectDirectoryChanges(dirPath, excludes, includeTests, recursive) {
    const changes = [];

    // Get current directory hash
    const currentHash = this.getDirectoryHash(dirPath, excludes);
    const previousHash = this.directoryHashes.get(dirPath);

    if (previousHash && currentHash !== previousHash) {
      // Directory changed, find specific file changes
      const files = this.getAllFiles(dirPath, excludes);

      for (const file of files) {
        const category = this.categorizeFile(file);

        // Skip test files if not included
        if (!includeTests && category === FILE_CATEGORY.TEST) {
          continue;
        }

        const fileChange = await this.detectFileChange(file);
        if (fileChange) {
          changes.push(fileChange);
        }
      }

      this.logger.info(`Directory ${dirPath} changed: ${changes.length} files affected`);
    }

    // Update directory hash
    this.directoryHashes.set(dirPath, currentHash);

    return changes;
  }

  /**
   * Detect change in a single file
   * @param {string} filePath - File path
   * @returns {Promise<Object|null>} Detected change
   */
  async detectFileChange(filePath) {
    const currentHash = this.getFileHash(filePath);

    if (!currentHash) {
      return null;
    }

    const previousHash = this.fileHashes.get(filePath);

    if (previousHash && currentHash !== previousHash) {
      const category = this.categorizeFile(filePath);
      const stats = fs.statSync(filePath);

      const change = {
        type: 'modified',
        file: filePath,
        category,
        size: stats.size,
        previousHash,
        currentHash,
        severity: this.categorizeFileSeverity(filePath, category),
        timestamp: new Date().toISOString()
      };

      this.recordChange(change);
      this.logger.debug(`File changed: ${filePath} (${category})`);

      // Update hash
      this.fileHashes.set(filePath, currentHash);

      return change;
    } else if (!previousHash) {
      // New file being tracked
      this.fileHashes.set(filePath, currentHash);

      const category = this.categorizeFile(filePath);
      const stats = fs.statSync(filePath);

      const change = {
        type: 'added',
        file: filePath,
        category,
        size: stats.size,
        currentHash,
        severity: this.categorizeFileSeverity(filePath, category),
        timestamp: new Date().toISOString()
      };

      this.recordChange(change);
      return change;
    }

    // No change
    return null;
  }

  /**
   * Categorize file by type
   * @param {string} filePath - File path
   * @returns {string} File category
   */
  categorizeFile(filePath) {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Check test files
    if (FILE_PATTERNS.TEST.some(pattern => filePath.includes(pattern))) {
      return FILE_CATEGORY.TEST;
    }

    // Check build files
    if (FILE_PATTERNS.BUILD.some(pattern => fileName.includes(pattern))) {
      return FILE_CATEGORY.BUILD;
    }

    // Check documentation
    if (FILE_PATTERNS.DOCUMENTATION.some(pattern =>
      ext === pattern || fileName.toUpperCase().includes(pattern.toUpperCase())
    )) {
      return FILE_CATEGORY.DOCUMENTATION;
    }

    // Check source files
    if (FILE_PATTERNS.SOURCE.some(pattern => ext === pattern)) {
      return FILE_CATEGORY.SOURCE;
    }

    // Check config files
    if (FILE_PATTERNS.CONFIG.some(pattern => ext === pattern || fileName.includes(pattern))) {
      return FILE_CATEGORY.CONFIG;
    }

    // Check static assets
    if (FILE_PATTERNS.STATIC.some(pattern => ext === pattern)) {
      return FILE_CATEGORY.STATIC;
    }

    return 'other';
  }

  /**
   * Categorize file change severity
   * @param {string} filePath - File path
   * @param {string} category - File category
   * @returns {string} Severity level
   */
  categorizeFileSeverity(filePath, category) {
    // Source code changes require rebuild
    if (category === FILE_CATEGORY.SOURCE) {
      return CHANGE_SEVERITY.HIGH;
    }

    // Build configuration changes are critical
    if (category === FILE_CATEGORY.BUILD) {
      return CHANGE_SEVERITY.CRITICAL;
    }

    // Config changes are important
    if (category === FILE_CATEGORY.CONFIG) {
      // .env files are critical
      if (filePath.includes('.env')) {
        return CHANGE_SEVERITY.CRITICAL;
      }
      return CHANGE_SEVERITY.HIGH;
    }

    // Static assets may need rebuild depending on build system
    if (category === FILE_CATEGORY.STATIC) {
      return CHANGE_SEVERITY.MEDIUM;
    }

    // Test changes don't require production rebuild
    if (category === FILE_CATEGORY.TEST) {
      return CHANGE_SEVERITY.LOW;
    }

    // Documentation doesn't require rebuild
    if (category === FILE_CATEGORY.DOCUMENTATION) {
      return CHANGE_SEVERITY.LOW;
    }

    return CHANGE_SEVERITY.MEDIUM;
  }

  /**
   * Add path to watch list
   * @param {string} filePath - Path to watch
   */
  addWatchPath(filePath) {
    if (!this.watchedPaths.includes(filePath)) {
      this.watchedPaths.push(filePath);
      this.logger.info(`Added watch path: ${filePath}`);
    }
  }

  /**
   * Remove path from watch list
   * @param {string} filePath - Path to remove
   */
  removeWatchPath(filePath) {
    const index = this.watchedPaths.indexOf(filePath);
    if (index > -1) {
      this.watchedPaths.splice(index, 1);
      this.logger.info(`Removed watch path: ${filePath}`);
    }
  }

  /**
   * Get change summary by category
   * @param {Array} changes - Changes to summarize
   * @returns {Object} Summary
   */
  getChangeSummary(changes) {
    const summary = {
      total: changes.length,
      byCategory: {},
      bySeverity: {},
      requiresRebuild: this.requiresRebuild(changes)
    };

    changes.forEach(change => {
      // Count by category
      summary.byCategory[change.category] = (summary.byCategory[change.category] || 0) + 1;

      // Count by severity
      summary.bySeverity[change.severity] = (summary.bySeverity[change.severity] || 0) + 1;
    });

    return summary;
  }

  /**
   * Get files changed in specific category
   * @param {string} category - File category
   * @param {Date} since - Since timestamp
   * @returns {Array} Changed files
   */
  getChangedFilesByCategory(category, since = null) {
    let changes = this.changeHistory.filter(c => c.category === category);

    if (since) {
      changes = changes.filter(c => new Date(c.timestamp) >= since);
    }

    return changes.map(c => c.file);
  }

  /**
   * Reset detector state
   */
  reset() {
    this.fileHashes.clear();
    this.directoryHashes.clear();
    this.clearHistory();
    this.logger.info('File detector state reset');
  }

  /**
   * Get current state snapshot
   * @returns {Object} State snapshot
   */
  getState() {
    return {
      trackedFiles: this.fileHashes.size,
      trackedDirectories: this.directoryHashes.size,
      watchedPaths: this.watchedPaths.length,
      lastChecked: this.lastChecked,
      changeCount: this.changeHistory.length
    };
  }

  /**
   * Export file hashes for caching
   * @returns {Object} File hashes
   */
  exportHashes() {
    return {
      files: Object.fromEntries(this.fileHashes),
      directories: Object.fromEntries(this.directoryHashes),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import file hashes from cache
   * @param {Object} data - Cached hashes
   */
  importHashes(data) {
    if (data.files) {
      this.fileHashes = new Map(Object.entries(data.files));
    }
    if (data.directories) {
      this.directoryHashes = new Map(Object.entries(data.directories));
    }
    this.logger.info(`Imported ${this.fileHashes.size} file hashes and ${this.directoryHashes.size} directory hashes`);
  }
}

/**
 * Get singleton instance
 */
let detectorInstance = null;

export function getFileChangeDetector() {
  if (!detectorInstance) {
    detectorInstance = new FileChangeDetector();
  }
  return detectorInstance;
}
