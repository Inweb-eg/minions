/**
 * BaseBuilder - Abstract Base Class for Docker Builders
 *
 * Phase 8.2: Build System
 * Base class for all Docker build mechanisms
 */

import { createLogger } from '../utils/logger.js';
import Docker from 'dockerode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Build status
 */
export const BUILD_STATUS = {
  PENDING: 'pending',
  BUILDING: 'building',
  SUCCESS: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

/**
 * Build strategy
 */
export const BUILD_STRATEGY = {
  STANDARD: 'standard',         // Standard single-stage build
  MULTI_STAGE: 'multi_stage',   // Multi-stage build
  CACHE: 'cache',               // Build with cache
  NO_CACHE: 'no_cache',         // Build without cache
  INCREMENTAL: 'incremental'    // Incremental build
};

/**
 * BaseBuilder
 * Abstract base class for all Docker builders
 */
export class BaseBuilder {
  constructor(name, type) {
    if (this.constructor === BaseBuilder) {
      throw new Error('BaseBuilder is abstract and cannot be instantiated directly');
    }

    this.name = name;
    this.type = type;
    this.logger = createLogger(name);
    this.docker = new Docker();
    this.buildHistory = [];
    this.currentBuild = null;
  }

  /**
   * Build Docker image (must be implemented by subclasses)
   * @param {Object} options - Build options
   * @returns {Promise<Object>} Build result
   */
  async build(options = {}) {
    throw new Error('build() must be implemented by subclass');
  }

  /**
   * Execute Docker build
   * @param {Object} buildOptions - Build options
   * @returns {Promise<Object>} Build result
   */
  async executeBuild(buildOptions) {
    const {
      context,
      dockerfile = 'Dockerfile',
      tag,
      buildArgs = {},
      labels = {},
      target = null,
      nocache = false,
      pull = false,
      rm = true,
      forcerm = true,
      platform = null
    } = buildOptions;

    this.logger.info(`Building Docker image: ${tag}`);

    const buildStart = Date.now();
    this.currentBuild = {
      tag,
      status: BUILD_STATUS.BUILDING,
      startTime: new Date().toISOString(),
      logs: []
    };

    try {
      // Prepare build arguments
      const buildArgsFormatted = {};
      Object.keys(buildArgs).forEach(key => {
        buildArgsFormatted[key] = String(buildArgs[key]);
      });

      // Prepare build stream
      const stream = await this.docker.buildImage({
        context,
        src: ['.']
      }, {
        dockerfile,
        t: tag,
        buildargs: buildArgsFormatted,
        labels,
        target,
        nocache,
        pull,
        rm,
        forcerm,
        platform
      });

      // Process build stream
      const buildLogs = [];
      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(
          stream,
          (err, res) => {
            if (err) {
              reject(err);
            } else {
              resolve(res);
            }
          },
          (event) => {
            if (event.stream) {
              const log = event.stream.trim();
              if (log) {
                buildLogs.push(log);
                this.logger.debug(log);
              }
            }
            if (event.error) {
              this.logger.error(`Build error: ${event.error}`);
            }
          }
        );
      });

      const buildDuration = Date.now() - buildStart;

      // Get image info
      const image = this.docker.getImage(tag);
      const imageInfo = await image.inspect();

      const result = {
        success: true,
        tag,
        imageId: imageInfo.Id,
        size: imageInfo.Size,
        created: imageInfo.Created,
        duration: buildDuration,
        logs: buildLogs,
        layers: imageInfo.RootFS?.Layers?.length || 0
      };

      this.currentBuild.status = BUILD_STATUS.SUCCESS;
      this.currentBuild.endTime = new Date().toISOString();
      this.currentBuild.duration = buildDuration;
      this.currentBuild.imageId = imageInfo.Id;

      this.recordBuild(result);
      this.logger.info(`Build completed successfully: ${tag} (${(buildDuration / 1000).toFixed(2)}s)`);

      return result;
    } catch (error) {
      const buildDuration = Date.now() - buildStart;

      this.currentBuild.status = BUILD_STATUS.FAILED;
      this.currentBuild.endTime = new Date().toISOString();
      this.currentBuild.duration = buildDuration;
      this.currentBuild.error = error.message;

      const result = {
        success: false,
        tag,
        error: error.message,
        duration: buildDuration,
        logs: this.currentBuild.logs
      };

      this.recordBuild(result);
      this.logger.error(`Build failed: ${tag} - ${error.message}`);

      throw error;
    } finally {
      this.currentBuild = null;
    }
  }

  /**
   * Create build context tarball
   * @param {string} contextPath - Context directory path
   * @param {Array} excludes - Patterns to exclude
   * @returns {Promise<string>} Path to tarball
   */
  async createBuildContext(contextPath, excludes = []) {
    const tar = require('tar');
    const tmpDir = require('os').tmpdir();
    const tarPath = path.join(tmpDir, `build-context-${Date.now()}.tar`);

    this.logger.debug(`Creating build context from ${contextPath}`);

    // Read .dockerignore if exists
    const dockerignorePath = path.join(contextPath, '.dockerignore');
    let ignorePatterns = [...excludes];

    if (fs.existsSync(dockerignorePath)) {
      const dockerignore = fs.readFileSync(dockerignorePath, 'utf-8');
      const patterns = dockerignore.split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('#'));
      ignorePatterns.push(...patterns);
    }

    // Create tarball
    await tar.create(
      {
        file: tarPath,
        cwd: contextPath,
        filter: (path) => {
          // Check if path matches any ignore pattern
          return !ignorePatterns.some(pattern => {
            if (pattern.includes('*')) {
              // Simple glob matching
              const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
              return regex.test(path);
            }
            return path.includes(pattern);
          });
        }
      },
      ['.']
    );

    this.logger.debug(`Build context created: ${tarPath}`);
    return tarPath;
  }

  /**
   * Tag image
   * @param {string} sourceTag - Source image tag
   * @param {string} targetTag - Target image tag
   * @returns {Promise<boolean>} Success
   */
  async tagImage(sourceTag, targetTag) {
    try {
      const image = this.docker.getImage(sourceTag);
      await image.tag({ repo: targetTag.split(':')[0], tag: targetTag.split(':')[1] });
      this.logger.info(`Tagged image: ${sourceTag} → ${targetTag}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to tag image: ${error.message}`);
      return false;
    }
  }

  /**
   * Push image to registry
   * @param {string} tag - Image tag
   * @param {Object} authConfig - Registry authentication
   * @returns {Promise<Object>} Push result
   */
  async pushImage(tag, authConfig = {}) {
    try {
      this.logger.info(`Pushing image: ${tag}`);
      const image = this.docker.getImage(tag);
      const stream = await image.push({ authconfig: authConfig });

      await new Promise((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve(res);
        });
      });

      this.logger.info(`Image pushed successfully: ${tag}`);
      return { success: true, tag };
    } catch (error) {
      this.logger.error(`Failed to push image: ${error.message}`);
      return { success: false, tag, error: error.message };
    }
  }

  /**
   * Remove image
   * @param {string} tag - Image tag or ID
   * @param {boolean} force - Force removal
   * @returns {Promise<boolean>} Success
   */
  async removeImage(tag, force = false) {
    try {
      const image = this.docker.getImage(tag);
      await image.remove({ force });
      this.logger.info(`Removed image: ${tag}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove image: ${error.message}`);
      return false;
    }
  }

  /**
   * Get image info
   * @param {string} tag - Image tag or ID
   * @returns {Promise<Object|null>} Image info
   */
  async getImageInfo(tag) {
    try {
      const image = this.docker.getImage(tag);
      const info = await image.inspect();
      return {
        id: info.Id,
        tags: info.RepoTags || [],
        size: info.Size,
        created: info.Created,
        layers: info.RootFS?.Layers?.length || 0,
        architecture: info.Architecture,
        os: info.Os
      };
    } catch (error) {
      this.logger.warn(`Failed to get image info: ${error.message}`);
      return null;
    }
  }

  /**
   * Check if image exists
   * @param {string} tag - Image tag
   * @returns {Promise<boolean>} Exists
   */
  async imageExists(tag) {
    const info = await this.getImageInfo(tag);
    return info !== null;
  }

  /**
   * Prune build cache
   * @param {Object} options - Prune options
   * @returns {Promise<Object>} Prune result
   */
  async pruneBuildCache(options = {}) {
    try {
      this.logger.info('Pruning build cache');
      const result = await this.docker.pruneImages({
        filters: { dangling: { true: true } }
      });

      this.logger.info(`Build cache pruned: ${result.ImagesDeleted?.length || 0} images removed`);
      return {
        success: true,
        imagesDeleted: result.ImagesDeleted?.length || 0,
        spaceReclaimed: result.SpaceReclaimed || 0
      };
    } catch (error) {
      this.logger.error(`Failed to prune build cache: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Record build in history
   * @param {Object} buildResult - Build result
   */
  recordBuild(buildResult) {
    this.buildHistory.push({
      ...buildResult,
      timestamp: new Date().toISOString(),
      builder: this.name
    });

    // Keep only last 50 builds
    if (this.buildHistory.length > 50) {
      this.buildHistory = this.buildHistory.slice(-50);
    }
  }

  /**
   * Get build history
   * @param {Object} filter - Filter options
   * @returns {Array} Filtered build history
   */
  getHistory(filter = {}) {
    let history = [...this.buildHistory];

    if (filter.success !== undefined) {
      history = history.filter(b => b.success === filter.success);
    }

    if (filter.tag) {
      history = history.filter(b => b.tag === filter.tag);
    }

    if (filter.since) {
      const since = new Date(filter.since);
      history = history.filter(b => new Date(b.timestamp) >= since);
    }

    if (filter.limit) {
      history = history.slice(-filter.limit);
    }

    return history;
  }

  /**
   * Clear build history
   */
  clearHistory() {
    this.buildHistory = [];
    this.logger.info('Build history cleared');
  }

  /**
   * Get build statistics
   * @returns {Object} Build statistics
   */
  getStatistics() {
    const total = this.buildHistory.length;
    const successful = this.buildHistory.filter(b => b.success).length;
    const failed = total - successful;

    const avgDuration = total > 0
      ? this.buildHistory.reduce((sum, b) => sum + (b.duration || 0), 0) / total
      : 0;

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? ((successful / total) * 100).toFixed(2) : 0,
      avgDuration: avgDuration.toFixed(2),
      lastBuild: this.buildHistory[this.buildHistory.length - 1] || null
    };
  }

  /**
   * Cancel current build
   */
  async cancelBuild() {
    if (this.currentBuild) {
      this.currentBuild.status = BUILD_STATUS.CANCELLED;
      this.logger.warn('Build cancelled');
      return true;
    }
    return false;
  }
}
