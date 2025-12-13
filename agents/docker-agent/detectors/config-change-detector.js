/**
 * ConfigChangeDetector - Detects Changes in Docker Configuration Files
 *
 * Phase 8.1: Change Detectors
 * Monitors Dockerfile, docker-compose.yml, .dockerignore, and related configs
 */

import { BaseDetector, CHANGE_TYPE, CHANGE_SEVERITY } from './base-detector.js';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

/**
 * Docker configuration files
 */
export const DOCKER_CONFIG_FILES = {
  DOCKERFILE: 'Dockerfile',
  DOCKERFILE_DEV: 'Dockerfile.dev',
  DOCKERFILE_PROD: 'Dockerfile.prod',
  COMPOSE: 'docker-compose.yml',
  COMPOSE_DEV: 'docker-compose.dev.yml',
  COMPOSE_PROD: 'docker-compose.prod.yml',
  COMPOSE_OVERRIDE: 'docker-compose.override.yml',
  DOCKERIGNORE: '.dockerignore',
  ENV: '.env',
  ENV_EXAMPLE: '.env.example'
};

/**
 * ConfigChangeDetector
 * Detects changes in Docker configuration files
 */
export class ConfigChangeDetector extends BaseDetector {
  constructor() {
    super('ConfigChangeDetector', CHANGE_TYPE.CONFIG);
    this.configHashes = new Map();
    this.configContents = new Map();
  }

  /**
   * Detect configuration changes
   * @param {Object} options - Detection options
   * @returns {Promise<Array>} Detected changes
   */
  async detect(options = {}) {
    const {
      projectPath = process.cwd(),
      files = this.detectConfigFiles(projectPath),
      analyzeContent = true
    } = options;

    this.logger.info(`Detecting config changes in ${projectPath}`);
    const changes = [];

    for (const file of files) {
      const filePath = path.join(projectPath, file);

      if (!fs.existsSync(filePath)) {
        // Check if file was removed
        if (this.configHashes.has(file)) {
          changes.push({
            type: 'removed',
            file,
            severity: CHANGE_SEVERITY.CRITICAL,
            timestamp: new Date().toISOString(),
            description: `Configuration file ${file} was removed`
          });

          this.configHashes.delete(file);
          this.configContents.delete(file);
        }
        continue;
      }

      const currentHash = this.getFileHash(filePath);
      const previousHash = this.configHashes.get(file);

      if (previousHash && currentHash !== previousHash) {
        // File changed, analyze the differences
        let detailedChanges = [];

        if (analyzeContent) {
          detailedChanges = await this.analyzeConfigFile(filePath, file);
        }

        const change = {
          type: 'modified',
          file,
          severity: this.categorizeConfigSeverity(file, detailedChanges),
          previousHash,
          currentHash,
          changes: detailedChanges,
          timestamp: new Date().toISOString(),
          description: `Configuration file ${file} was modified`
        };

        changes.push(change);
        this.recordChange(change);

        this.logger.info(`Config change detected: ${file}`);
      } else if (!previousHash) {
        // New file
        changes.push({
          type: 'added',
          file,
          severity: this.categorizeConfigSeverity(file, []),
          currentHash,
          timestamp: new Date().toISOString(),
          description: `Configuration file ${file} was added`
        });
      }

      // Update state
      this.configHashes.set(file, currentHash);
    }

    this.lastChecked = new Date();
    this.logger.info(`Detected ${changes.length} config changes`);

    return changes;
  }

  /**
   * Detect Docker configuration files in project
   * @param {string} projectPath - Project root path
   * @returns {Array} Found configuration files
   */
  detectConfigFiles(projectPath) {
    const foundFiles = [];

    Object.values(DOCKER_CONFIG_FILES).forEach(file => {
      const filePath = path.join(projectPath, file);
      if (fs.existsSync(filePath)) {
        foundFiles.push(file);
        this.logger.debug(`Found config file: ${file}`);
      }
    });

    // Also check for Dockerfiles with custom names
    const files = fs.readdirSync(projectPath);
    files.forEach(file => {
      if (file.startsWith('Dockerfile') && !foundFiles.includes(file)) {
        foundFiles.push(file);
        this.logger.debug(`Found custom Dockerfile: ${file}`);
      }
    });

    return foundFiles;
  }

  /**
   * Analyze changes in a configuration file
   * @param {string} filePath - Path to config file
   * @param {string} fileName - Name of the file
   * @returns {Promise<Array>} Detected changes
   */
  async analyzeConfigFile(filePath, fileName) {
    try {
      if (fileName.startsWith('Dockerfile')) {
        return this.analyzeDockerfile(filePath);
      } else if (fileName.includes('docker-compose')) {
        return this.analyzeDockerCompose(filePath);
      } else if (fileName === DOCKER_CONFIG_FILES.DOCKERIGNORE) {
        return this.analyzeDockerignore(filePath);
      } else if (fileName.includes('.env')) {
        return this.analyzeEnvFile(filePath);
      }

      return [];
    } catch (error) {
      this.logger.error(`Failed to analyze ${fileName}: ${error.message}`);
      return [];
    }
  }

  /**
   * Analyze Dockerfile changes
   * @param {string} filePath - Path to Dockerfile
   * @returns {Array} Detected changes
   */
  analyzeDockerfile(filePath) {
    const changes = [];
    const current = fs.readFileSync(filePath, 'utf-8');
    const previous = this.configContents.get(filePath);

    if (!previous) {
      this.configContents.set(filePath, current);
      return changes;
    }

    // Parse Dockerfile instructions
    const currentInstructions = this.parseDockerfile(current);
    const previousInstructions = this.parseDockerfile(previous);

    // Check base image changes
    const currentBase = currentInstructions.find(i => i.instruction === 'FROM');
    const previousBase = previousInstructions.find(i => i.instruction === 'FROM');

    if (currentBase && previousBase && currentBase.args !== previousBase.args) {
      changes.push({
        type: 'base_image_changed',
        instruction: 'FROM',
        oldValue: previousBase.args,
        newValue: currentBase.args,
        severity: CHANGE_SEVERITY.CRITICAL,
        description: `Base image changed: ${previousBase.args} → ${currentBase.args}`
      });
    }

    // Check for new/removed instructions
    const currentInstNames = currentInstructions.map(i => `${i.instruction} ${i.args}`);
    const previousInstNames = previousInstructions.map(i => `${i.instruction} ${i.args}`);

    const added = currentInstNames.filter(i => !previousInstNames.includes(i));
    const removed = previousInstNames.filter(i => !currentInstNames.includes(i));

    added.forEach(inst => {
      changes.push({
        type: 'instruction_added',
        value: inst,
        severity: CHANGE_SEVERITY.HIGH,
        description: `Added instruction: ${inst}`
      });
    });

    removed.forEach(inst => {
      changes.push({
        type: 'instruction_removed',
        value: inst,
        severity: CHANGE_SEVERITY.HIGH,
        description: `Removed instruction: ${inst}`
      });
    });

    this.configContents.set(filePath, current);
    return changes;
  }

  /**
   * Parse Dockerfile into instructions
   * @param {string} content - Dockerfile content
   * @returns {Array} Instructions
   */
  parseDockerfile(content) {
    const instructions = [];
    const lines = content.split('\n');

    lines.forEach(line => {
      line = line.trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        return;
      }

      // Parse instruction
      const match = line.match(/^([A-Z]+)\s+(.+)$/);
      if (match) {
        instructions.push({
          instruction: match[1],
          args: match[2].trim()
        });
      }
    });

    return instructions;
  }

  /**
   * Analyze docker-compose.yml changes
   * @param {string} filePath - Path to docker-compose.yml
   * @returns {Array} Detected changes
   */
  analyzeDockerCompose(filePath) {
    const changes = [];

    try {
      const current = fs.readFileSync(filePath, 'utf-8');
      const previous = this.configContents.get(filePath);

      if (!previous) {
        this.configContents.set(filePath, current);
        return changes;
      }

      const currentConfig = yaml.parse(current);
      const previousConfig = yaml.parse(previous);

      // Check services changes
      if (currentConfig.services && previousConfig.services) {
        const serviceChanges = this.compareObjects(previousConfig.services, currentConfig.services);

        serviceChanges.forEach(change => {
          changes.push({
            type: `service_${change.type}`,
            service: change.key,
            oldValue: change.oldValue,
            newValue: change.newValue || change.value,
            severity: CHANGE_SEVERITY.HIGH,
            description: `Service '${change.key}' was ${change.type}`
          });
        });

        // Check for port changes in existing services
        Object.keys(currentConfig.services).forEach(serviceName => {
          if (previousConfig.services[serviceName]) {
            const currentPorts = currentConfig.services[serviceName].ports || [];
            const previousPorts = previousConfig.services[serviceName].ports || [];

            if (JSON.stringify(currentPorts) !== JSON.stringify(previousPorts)) {
              changes.push({
                type: 'ports_changed',
                service: serviceName,
                oldValue: previousPorts,
                newValue: currentPorts,
                severity: CHANGE_SEVERITY.HIGH,
                description: `Ports changed for service '${serviceName}'`
              });
            }

            // Check image changes
            const currentImage = currentConfig.services[serviceName].image;
            const previousImage = previousConfig.services[serviceName].image;

            if (currentImage !== previousImage) {
              changes.push({
                type: 'image_changed',
                service: serviceName,
                oldValue: previousImage,
                newValue: currentImage,
                severity: CHANGE_SEVERITY.CRITICAL,
                description: `Image changed for service '${serviceName}': ${previousImage} → ${currentImage}`
              });
            }

            // Check environment variables
            const currentEnv = currentConfig.services[serviceName].environment || {};
            const previousEnv = previousConfig.services[serviceName].environment || {};

            const envChanges = this.compareObjects(previousEnv, currentEnv);
            if (envChanges.length > 0) {
              changes.push({
                type: 'environment_changed',
                service: serviceName,
                changes: envChanges,
                severity: CHANGE_SEVERITY.HIGH,
                description: `Environment variables changed for service '${serviceName}'`
              });
            }
          }
        });
      }

      // Check volumes changes
      if (currentConfig.volumes && previousConfig.volumes) {
        const volumeChanges = this.compareObjects(previousConfig.volumes, currentConfig.volumes);

        volumeChanges.forEach(change => {
          changes.push({
            type: `volume_${change.type}`,
            volume: change.key,
            severity: CHANGE_SEVERITY.MEDIUM,
            description: `Volume '${change.key}' was ${change.type}`
          });
        });
      }

      // Check networks changes
      if (currentConfig.networks && previousConfig.networks) {
        const networkChanges = this.compareObjects(previousConfig.networks, currentConfig.networks);

        networkChanges.forEach(change => {
          changes.push({
            type: `network_${change.type}`,
            network: change.key,
            severity: CHANGE_SEVERITY.MEDIUM,
            description: `Network '${change.key}' was ${change.type}`
          });
        });
      }

      this.configContents.set(filePath, current);
    } catch (error) {
      this.logger.error(`Failed to parse docker-compose.yml: ${error.message}`);
    }

    return changes;
  }

  /**
   * Analyze .dockerignore changes
   * @param {string} filePath - Path to .dockerignore
   * @returns {Array} Detected changes
   */
  analyzeDockerignore(filePath) {
    const changes = [];
    const current = fs.readFileSync(filePath, 'utf-8');
    const previous = this.configContents.get(filePath);

    if (!previous) {
      this.configContents.set(filePath, current);
      return changes;
    }

    const currentPatterns = current.split('\n').filter(l => l.trim() && !l.startsWith('#'));
    const previousPatterns = previous.split('\n').filter(l => l.trim() && !l.startsWith('#'));

    const added = currentPatterns.filter(p => !previousPatterns.includes(p));
    const removed = previousPatterns.filter(p => !currentPatterns.includes(p));

    if (added.length > 0 || removed.length > 0) {
      changes.push({
        type: 'patterns_changed',
        added,
        removed,
        severity: CHANGE_SEVERITY.MEDIUM,
        description: `.dockerignore patterns changed: +${added.length} patterns, -${removed.length} patterns`
      });
    }

    this.configContents.set(filePath, current);
    return changes;
  }

  /**
   * Analyze .env file changes
   * @param {string} filePath - Path to .env file
   * @returns {Array} Detected changes
   */
  analyzeEnvFile(filePath) {
    const changes = [];
    const current = fs.readFileSync(filePath, 'utf-8');
    const previous = this.configContents.get(filePath);

    if (!previous) {
      this.configContents.set(filePath, current);
      return changes;
    }

    const currentVars = this.parseEnvFile(current);
    const previousVars = this.parseEnvFile(previous);

    const varChanges = this.compareObjects(previousVars, currentVars);

    varChanges.forEach(change => {
      // Don't log actual values for security
      changes.push({
        type: `env_var_${change.type}`,
        variable: change.key,
        severity: CHANGE_SEVERITY.HIGH,
        description: `Environment variable '${change.key}' was ${change.type}`
      });
    });

    this.configContents.set(filePath, current);
    return changes;
  }

  /**
   * Parse .env file into key-value pairs
   * @param {string} content - File content
   * @returns {Object} Environment variables
   */
  parseEnvFile(content) {
    const vars = {};

    content.split('\n').forEach(line => {
      line = line.trim();

      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        return;
      }

      // Parse KEY=VALUE
      const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (match) {
        vars[match[1]] = match[2];
      }
    });

    return vars;
  }

  /**
   * Categorize config change severity
   * @param {string} fileName - Config file name
   * @param {Array} changes - Detailed changes
   * @returns {string} Severity level
   */
  categorizeConfigSeverity(fileName, changes) {
    // Dockerfile changes are critical
    if (fileName.startsWith('Dockerfile')) {
      // Check if base image changed
      if (changes.some(c => c.type === 'base_image_changed')) {
        return CHANGE_SEVERITY.CRITICAL;
      }
      return CHANGE_SEVERITY.HIGH;
    }

    // docker-compose.yml changes are critical
    if (fileName.includes('docker-compose')) {
      // Check if services or images changed
      if (changes.some(c =>
        c.type === 'service_added' ||
        c.type === 'service_removed' ||
        c.type === 'image_changed'
      )) {
        return CHANGE_SEVERITY.CRITICAL;
      }
      return CHANGE_SEVERITY.HIGH;
    }

    // .env changes are high priority
    if (fileName.includes('.env')) {
      return CHANGE_SEVERITY.HIGH;
    }

    // .dockerignore changes are medium priority
    if (fileName === DOCKER_CONFIG_FILES.DOCKERIGNORE) {
      return CHANGE_SEVERITY.MEDIUM;
    }

    return CHANGE_SEVERITY.MEDIUM;
  }

  /**
   * Reset detector state
   */
  reset() {
    this.configHashes.clear();
    this.configContents.clear();
    this.clearHistory();
    this.logger.info('Config detector state reset');
  }

  /**
   * Get current state snapshot
   * @returns {Object} State snapshot
   */
  getState() {
    return {
      trackedFiles: this.configHashes.size,
      lastChecked: this.lastChecked,
      changeCount: this.changeHistory.length
    };
  }
}

/**
 * Get singleton instance
 */
let detectorInstance = null;

export function getConfigChangeDetector() {
  if (!detectorInstance) {
    detectorInstance = new ConfigChangeDetector();
  }
  return detectorInstance;
}
