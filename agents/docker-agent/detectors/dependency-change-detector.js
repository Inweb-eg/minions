/**
 * DependencyChangeDetector - Detects Changes in Project Dependencies
 *
 * Phase 8.1: Change Detectors
 * Monitors package.json, package-lock.json, and other dependency files
 */

import { BaseDetector, CHANGE_TYPE, CHANGE_SEVERITY } from './base-detector.js';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Dependency file types
 */
export const DEPENDENCY_FILES = {
  PACKAGE_JSON: 'package.json',
  PACKAGE_LOCK: 'package-lock.json',
  YARN_LOCK: 'yarn.lock',
  PNPM_LOCK: 'pnpm-lock.yaml',
  REQUIREMENTS: 'requirements.txt',
  PIPFILE: 'Pipfile',
  COMPOSER: 'composer.json',
  GEMFILE: 'Gemfile'
};

/**
 * DependencyChangeDetector
 * Detects changes in project dependencies
 */
export class DependencyChangeDetector extends BaseDetector {
  constructor() {
    super('DependencyChangeDetector', CHANGE_TYPE.DEPENDENCY);
    this.previousState = new Map();
  }

  /**
   * Detect dependency changes
   * @param {Object} options - Detection options
   * @returns {Promise<Array>} Detected changes
   */
  async detect(options = {}) {
    const {
      projectPath = process.cwd(),
      files = this.detectDependencyFiles(projectPath),
      compareWithPrevious = true
    } = options;

    this.logger.info(`Detecting dependency changes in ${projectPath}`);
    const changes = [];

    for (const file of files) {
      const filePath = path.join(projectPath, file);

      if (!fs.existsSync(filePath)) {
        this.logger.debug(`Dependency file not found: ${file}`);
        continue;
      }

      const currentHash = this.getFileHash(filePath);
      const previousHash = this.previousState.get(file);

      if (compareWithPrevious && previousHash && currentHash !== previousHash) {
        // File changed, analyze the differences
        const fileChanges = await this.analyzeDependencyFile(filePath, file);

        fileChanges.forEach(change => {
          const enrichedChange = {
            ...change,
            file,
            severity: this.categorizeDependencySeverity(change, file),
            timestamp: new Date().toISOString()
          };

          changes.push(enrichedChange);
          this.recordChange(enrichedChange);

          this.logger.info(
            `Dependency change detected: ${change.type} - ${change.dependency} in ${file}`
          );
        });
      }

      // Update state
      this.previousState.set(file, currentHash);
    }

    this.lastChecked = new Date();
    this.logger.info(`Detected ${changes.length} dependency changes`);

    return changes;
  }

  /**
   * Detect dependency files in project
   * @param {string} projectPath - Project root path
   * @returns {Array} Found dependency files
   */
  detectDependencyFiles(projectPath) {
    const foundFiles = [];

    Object.values(DEPENDENCY_FILES).forEach(file => {
      const filePath = path.join(projectPath, file);
      if (fs.existsSync(filePath)) {
        foundFiles.push(file);
        this.logger.debug(`Found dependency file: ${file}`);
      }
    });

    return foundFiles;
  }

  /**
   * Analyze changes in a dependency file
   * @param {string} filePath - Path to dependency file
   * @param {string} fileName - Name of the file
   * @returns {Promise<Array>} Detected changes
   */
  async analyzeDependencyFile(filePath, fileName) {
    try {
      if (fileName === DEPENDENCY_FILES.PACKAGE_JSON) {
        return this.analyzePackageJson(filePath);
      } else if (fileName === DEPENDENCY_FILES.PACKAGE_LOCK) {
        return this.analyzePackageLock(filePath);
      } else if (fileName === DEPENDENCY_FILES.REQUIREMENTS) {
        return this.analyzeRequirementsTxt(filePath);
      }

      // For other files, just track that they changed
      return [{
        type: 'modified',
        dependency: fileName,
        description: `${fileName} was modified`
      }];
    } catch (error) {
      this.logger.error(`Failed to analyze ${fileName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze package.json changes
   * @param {string} filePath - Path to package.json
   * @returns {Array} Detected changes
   */
  analyzePackageJson(filePath) {
    const changes = [];
    const current = this.readJSON(filePath);

    if (!current) {
      return changes;
    }

    // Compare with previous state if available
    const previousKey = `${filePath}_content`;
    const previous = this.previousState.get(previousKey);

    if (previous) {
      // Check dependencies
      const depChanges = this.compareDependencies(
        previous.dependencies || {},
        current.dependencies || {},
        'production'
      );
      changes.push(...depChanges);

      // Check devDependencies
      const devDepChanges = this.compareDependencies(
        previous.devDependencies || {},
        current.devDependencies || {},
        'development'
      );
      changes.push(...devDepChanges);

      // Check peerDependencies
      const peerDepChanges = this.compareDependencies(
        previous.peerDependencies || {},
        current.peerDependencies || {},
        'peer'
      );
      changes.push(...peerDepChanges);

      // Check scripts (can affect build process)
      const scriptChanges = this.compareObjects(
        previous.scripts || {},
        current.scripts || {}
      );

      scriptChanges.forEach(change => {
        changes.push({
          type: change.type,
          dependency: `script:${change.key}`,
          category: 'script',
          oldValue: change.oldValue,
          newValue: change.newValue || change.value,
          description: `Build script '${change.key}' was ${change.type}`
        });
      });
    }

    // Store current state for next comparison
    this.previousState.set(previousKey, current);

    return changes;
  }

  /**
   * Compare dependency objects
   * @param {Object} oldDeps - Old dependencies
   * @param {Object} newDeps - New dependencies
   * @param {string} category - Dependency category
   * @returns {Array} Changes
   */
  compareDependencies(oldDeps, newDeps, category) {
    const changes = [];

    // Check for added/modified dependencies
    Object.keys(newDeps).forEach(dep => {
      if (!(dep in oldDeps)) {
        changes.push({
          type: 'added',
          dependency: dep,
          version: newDeps[dep],
          category,
          description: `Added ${category} dependency: ${dep}@${newDeps[dep]}`
        });
      } else if (oldDeps[dep] !== newDeps[dep]) {
        changes.push({
          type: 'updated',
          dependency: dep,
          oldVersion: oldDeps[dep],
          newVersion: newDeps[dep],
          category,
          description: `Updated ${dep}: ${oldDeps[dep]} → ${newDeps[dep]}`
        });
      }
    });

    // Check for removed dependencies
    Object.keys(oldDeps).forEach(dep => {
      if (!(dep in newDeps)) {
        changes.push({
          type: 'removed',
          dependency: dep,
          version: oldDeps[dep],
          category,
          description: `Removed ${category} dependency: ${dep}@${oldDeps[dep]}`
        });
      }
    });

    return changes;
  }

  /**
   * Analyze package-lock.json changes
   * @param {string} filePath - Path to package-lock.json
   * @returns {Array} Detected changes
   */
  analyzePackageLock(filePath) {
    const changes = [];
    const current = this.readJSON(filePath);

    if (!current) {
      return changes;
    }

    const previousKey = `${filePath}_content`;
    const previous = this.previousState.get(previousKey);

    if (previous) {
      // Check if lockfile version changed
      if (previous.lockfileVersion !== current.lockfileVersion) {
        changes.push({
          type: 'modified',
          dependency: 'lockfileVersion',
          category: 'lockfile',
          oldValue: previous.lockfileVersion,
          newValue: current.lockfileVersion,
          description: `Lockfile version changed: ${previous.lockfileVersion} → ${current.lockfileVersion}`
        });
      }

      // Check for dependency tree changes (simplified)
      const prevPackages = Object.keys(previous.packages || previous.dependencies || {});
      const currPackages = Object.keys(current.packages || current.dependencies || {});

      const added = currPackages.filter(p => !prevPackages.includes(p));
      const removed = prevPackages.filter(p => !currPackages.includes(p));

      if (added.length > 0 || removed.length > 0) {
        changes.push({
          type: 'modified',
          dependency: 'dependency-tree',
          category: 'lockfile',
          added: added.length,
          removed: removed.length,
          description: `Dependency tree changed: +${added.length} packages, -${removed.length} packages`
        });
      }
    }

    this.previousState.set(previousKey, current);
    return changes;
  }

  /**
   * Analyze requirements.txt changes
   * @param {string} filePath - Path to requirements.txt
   * @returns {Array} Detected changes
   */
  analyzeRequirementsTxt(filePath) {
    const changes = [];

    try {
      const current = fs.readFileSync(filePath, 'utf-8');
      const currentDeps = this.parseRequirementsTxt(current);

      const previousKey = `${filePath}_content`;
      const previous = this.previousState.get(previousKey);

      if (previous) {
        const previousDeps = this.parseRequirementsTxt(previous);

        // Compare dependencies
        const depChanges = this.compareDependencies(previousDeps, currentDeps, 'python');
        changes.push(...depChanges);
      }

      this.previousState.set(previousKey, current);
    } catch (error) {
      this.logger.error(`Failed to parse requirements.txt: ${error.message}`);
    }

    return changes;
  }

  /**
   * Parse requirements.txt into dependency object
   * @param {string} content - File content
   * @returns {Object} Dependencies
   */
  parseRequirementsTxt(content) {
    const deps = {};

    content.split('\n').forEach(line => {
      line = line.trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        return;
      }

      // Parse dependency (package==version or package>=version, etc.)
      const match = line.match(/^([a-zA-Z0-9_-]+)(==|>=|<=|>|<|~=)(.+)$/);
      if (match) {
        deps[match[1]] = match[3];
      } else {
        // No version specified
        deps[line] = '*';
      }
    });

    return deps;
  }

  /**
   * Categorize dependency change severity
   * @param {Object} change - Change object
   * @param {string} fileName - Dependency file name
   * @returns {string} Severity level
   */
  categorizeDependencySeverity(change, fileName) {
    // Production dependencies have higher severity
    if (change.category === 'production') {
      if (change.type === 'removed') {
        return CHANGE_SEVERITY.CRITICAL;
      } else if (change.type === 'added' || change.type === 'updated') {
        return CHANGE_SEVERITY.HIGH;
      }
    }

    // Development dependencies have lower severity
    if (change.category === 'development') {
      if (change.type === 'removed') {
        return CHANGE_SEVERITY.MEDIUM;
      }
      return CHANGE_SEVERITY.LOW;
    }

    // Lock file changes
    if (fileName.includes('lock') || fileName === 'yarn.lock') {
      return CHANGE_SEVERITY.HIGH;
    }

    // Build script changes
    if (change.category === 'script') {
      return CHANGE_SEVERITY.HIGH;
    }

    return CHANGE_SEVERITY.MEDIUM;
  }

  /**
   * Read JSON file
   * @param {string} filePath - File path
   * @returns {Object|null} Parsed JSON
   */
  readJSON(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      this.logger.error(`Failed to read JSON file ${filePath}: ${error.message}`);
      return null;
    }
  }

  /**
   * Reset detector state
   */
  reset() {
    this.previousState.clear();
    this.clearHistory();
    this.logger.info('Dependency detector state reset');
  }

  /**
   * Get current state snapshot
   * @returns {Object} State snapshot
   */
  getState() {
    return {
      files: Array.from(this.previousState.keys()),
      lastChecked: this.lastChecked,
      changeCount: this.changeHistory.length
    };
  }
}

/**
 * Get singleton instance
 */
let detectorInstance = null;

export function getDependencyChangeDetector() {
  if (!detectorInstance) {
    detectorInstance = new DependencyChangeDetector();
  }
  return detectorInstance;
}
