/**
 * BuildValidator - Validates Docker Build Results
 *
 * Phase 8.3: Validators
 * Validates Docker build results for issues and optimization opportunities
 */

import { BaseValidator, VALIDATION_SEVERITY } from './base-validator.js';
import Docker from 'dockerode';

/**
 * BuildValidator
 * Validates Docker build results
 */
export class BuildValidator extends BaseValidator {
  constructor() {
    super('BuildValidator', 'build');
    this.docker = new Docker();
    this.thresholds = {
      maxSize: 500 * 1024 * 1024,        // 500 MB
      maxLayers: 50,
      maxBuildTime: 10 * 60 * 1000,      // 10 minutes
      warningSize: 200 * 1024 * 1024,    // 200 MB
      warningLayers: 30,
      warningBuildTime: 5 * 60 * 1000    // 5 minutes
    };
  }

  /**
   * Validate build result
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(options = {}) {
    const {
      buildResult,
      tag,
      imageId,
      checkImage = true
    } = options;

    this.logger.info(`Validating build result: ${tag || imageId}`);

    const issues = [];
    let imageInfo = null;

    // Validate build result object
    if (buildResult) {
      const buildIssues = this.validateBuildResult(buildResult);
      issues.push(...buildIssues);
    }

    // Validate image if requested
    if (checkImage && (tag || imageId)) {
      try {
        const image = this.docker.getImage(tag || imageId);
        imageInfo = await image.inspect();
        const imageIssues = this.validateImage(imageInfo);
        issues.push(...imageIssues);
      } catch (error) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.ERROR,
          message: `Failed to inspect image: ${error.message}`,
          code: 'BV3000'
        }));
      }
    }

    // Determine if valid
    const errors = issues.filter(i => i.severity === VALIDATION_SEVERITY.ERROR);
    const valid = errors.length === 0;

    const result = this.createResult({
      valid,
      issues,
      metadata: {
        tag,
        imageId,
        imageSize: imageInfo?.Size,
        layers: imageInfo?.RootFS?.Layers?.length
      }
    });

    this.recordValidation(result);
    this.logger.info(`Validation completed: ${result.status} (${errors.length} errors, ${result.warnings.length} warnings)`);

    return result;
  }

  /**
   * Validate build result object
   * @param {Object} buildResult - Build result
   * @returns {Array} Issues
   */
  validateBuildResult(buildResult) {
    const issues = [];

    // Check if build succeeded
    if (!buildResult.success) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Build failed: ${buildResult.error || 'Unknown error'}`,
        code: 'BV3001'
      }));
      return issues;
    }

    // Check build duration
    if (buildResult.duration > this.thresholds.maxBuildTime) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Build time (${(buildResult.duration / 1000 / 60).toFixed(2)} min) exceeds maximum threshold`,
        code: 'BV3002',
        suggestion: 'Optimize Dockerfile or use build cache'
      }));
    } else if (buildResult.duration > this.thresholds.warningBuildTime) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Build time (${(buildResult.duration / 1000 / 60).toFixed(2)} min) is longer than recommended`,
        code: 'BV3002',
        suggestion: 'Consider optimizing build steps or using multi-stage builds'
      }));
    }

    // Check image size
    if (buildResult.size > this.thresholds.maxSize) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Image size (${(buildResult.size / 1024 / 1024).toFixed(2)} MB) exceeds maximum threshold`,
        code: 'BV3003',
        suggestion: 'Reduce image size by removing unnecessary files or using alpine base images'
      }));
    } else if (buildResult.size > this.thresholds.warningSize) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Image size (${(buildResult.size / 1024 / 1024).toFixed(2)} MB) is larger than recommended`,
        code: 'BV3003',
        suggestion: 'Consider optimizing image size'
      }));
    }

    // Check layer count
    if (buildResult.layers > this.thresholds.maxLayers) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Image has ${buildResult.layers} layers, exceeding recommended maximum`,
        code: 'BV3004',
        suggestion: 'Combine RUN commands to reduce layer count'
      }));
    } else if (buildResult.layers > this.thresholds.warningLayers) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.SUGGESTION,
        message: `Image has ${buildResult.layers} layers`,
        code: 'BV3004',
        suggestion: 'Consider combining related commands to reduce layers'
      }));
    }

    // Check for build logs with errors/warnings
    if (buildResult.logs) {
      const warningLogs = buildResult.logs.filter(log =>
        log.toLowerCase().includes('warning') ||
        log.toLowerCase().includes('deprecated')
      );

      if (warningLogs.length > 0) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.INFO,
          message: `Build logs contain ${warningLogs.length} warning(s)`,
          code: 'BV3005',
          suggestion: 'Review build logs for potential issues'
        }));
      }
    }

    return issues;
  }

  /**
   * Validate image
   * @param {Object} imageInfo - Image info from Docker inspect
   * @returns {Array} Issues
   */
  validateImage(imageInfo) {
    const issues = [];

    // Check image labels
    if (!imageInfo.Config?.Labels || Object.keys(imageInfo.Config.Labels).length === 0) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.SUGGESTION,
        message: 'Image has no labels',
        code: 'BV3010',
        suggestion: 'Add labels for better image organization and metadata'
      }));
    }

    // Check if running as root
    if (!imageInfo.Config?.User || imageInfo.Config.User === 'root' || imageInfo.Config.User === '0') {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: 'Image runs as root user',
        code: 'BV3011',
        suggestion: 'Run container as non-root user for better security'
      }));
    }

    // Check for exposed ports
    if (!imageInfo.Config?.ExposedPorts || Object.keys(imageInfo.Config.ExposedPorts).length === 0) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.INFO,
        message: 'No ports are exposed',
        code: 'BV3012',
        suggestion: 'Add EXPOSE instruction if the service listens on ports'
      }));
    }

    // Check for health check
    if (!imageInfo.Config?.Healthcheck) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.SUGGESTION,
        message: 'No health check configured',
        code: 'BV3013',
        suggestion: 'Add HEALTHCHECK instruction to monitor container health'
      }));
    }

    // Check for environment variables
    if (imageInfo.Config?.Env) {
      const secretPatterns = [
        /password=/i,
        /api[_-]?key=/i,
        /secret=/i,
        /token=/i
      ];

      imageInfo.Config.Env.forEach(envVar => {
        secretPatterns.forEach(pattern => {
          if (pattern.test(envVar)) {
            issues.push(this.createIssue({
              severity: VALIDATION_SEVERITY.WARNING,
              message: 'Potential secret found in environment variables',
              code: 'BV3014',
              suggestion: 'Avoid hardcoding secrets in images'
            }));
          }
        });
      });
    }

    // Check architecture
    if (imageInfo.Architecture !== 'amd64' && imageInfo.Architecture !== 'arm64') {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.INFO,
        message: `Image architecture is ${imageInfo.Architecture}`,
        code: 'BV3015',
        suggestion: 'Ensure this architecture is compatible with your deployment target'
      }));
    }

    // Check for CMD or ENTRYPOINT
    if (!imageInfo.Config?.Cmd && !imageInfo.Config?.Entrypoint) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: 'No CMD or ENTRYPOINT defined',
        code: 'BV3016',
        suggestion: 'Add CMD or ENTRYPOINT to specify container startup command'
      }));
    }

    return issues;
  }

  /**
   * Validate image history
   * @param {string} tag - Image tag
   * @returns {Promise<Object>} Validation result
   */
  async validateImageHistory(tag) {
    this.logger.info(`Validating image history: ${tag}`);

    const issues = [];

    try {
      const image = this.docker.getImage(tag);
      const history = await image.history();

      // Check for large layers
      const largeLayers = history.filter(layer => layer.Size > 100 * 1024 * 1024); // > 100 MB

      if (largeLayers.length > 0) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Image has ${largeLayers.length} large layer(s) (> 100 MB)`,
          code: 'BV3020',
          suggestion: 'Optimize large layers by reducing copied files or cleaning up in the same RUN command'
        }));
      }

      // Check for many small layers
      const smallLayers = history.filter(layer => layer.Size > 0 && layer.Size < 1024 * 1024); // < 1 MB

      if (smallLayers.length > 20) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.SUGGESTION,
          message: `Image has ${smallLayers.length} small layer(s)`,
          code: 'BV3021',
          suggestion: 'Consider combining commands to reduce layer count'
        }));
      }

      return this.createResult({
        valid: issues.filter(i => i.severity === VALIDATION_SEVERITY.ERROR).length === 0,
        issues,
        metadata: {
          tag,
          layerCount: history.length,
          totalSize: history.reduce((sum, layer) => sum + layer.Size, 0)
        }
      });
    } catch (error) {
      return this.createResult({
        valid: false,
        issues: [
          this.createIssue({
            severity: VALIDATION_SEVERITY.ERROR,
            message: `Failed to get image history: ${error.message}`,
            code: 'BV3022'
          })
        ]
      });
    }
  }

  /**
   * Set custom thresholds
   * @param {Object} thresholds - Custom thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info('Build validation thresholds updated');
  }

  /**
   * Get current thresholds
   * @returns {Object} Thresholds
   */
  getThresholds() {
    return { ...this.thresholds };
  }

  /**
   * Compare builds
   * @param {Object} oldBuild - Previous build result
   * @param {Object} newBuild - New build result
   * @returns {Object} Comparison result
   */
  compareBuilds(oldBuild, newBuild) {
    const issues = [];

    // Compare size
    const sizeDiff = newBuild.size - oldBuild.size;
    const sizeChangePercent = (sizeDiff / oldBuild.size) * 100;

    if (sizeChangePercent > 20) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Image size increased by ${sizeChangePercent.toFixed(2)}% (${(sizeDiff / 1024 / 1024).toFixed(2)} MB)`,
        code: 'BV3030',
        suggestion: 'Investigate what caused the size increase'
      }));
    } else if (sizeChangePercent < -20) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.INFO,
        message: `Image size decreased by ${Math.abs(sizeChangePercent).toFixed(2)}% (${Math.abs(sizeDiff / 1024 / 1024).toFixed(2)} MB)`,
        code: 'BV3030'
      }));
    }

    // Compare layers
    const layerDiff = newBuild.layers - oldBuild.layers;
    if (layerDiff > 10) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Layer count increased by ${layerDiff}`,
        code: 'BV3031',
        suggestion: 'New layers added - ensure they are necessary'
      }));
    }

    // Compare build time
    const timeDiff = newBuild.duration - oldBuild.duration;
    const timeChangePercent = (timeDiff / oldBuild.duration) * 100;

    if (timeChangePercent > 50) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Build time increased by ${timeChangePercent.toFixed(2)}%`,
        code: 'BV3032',
        suggestion: 'Build is taking significantly longer - check for cache issues'
      }));
    }

    return this.createResult({
      valid: issues.filter(i => i.severity === VALIDATION_SEVERITY.ERROR).length === 0,
      issues,
      metadata: {
        sizeDiff,
        sizeChangePercent: sizeChangePercent.toFixed(2),
        layerDiff,
        timeDiff,
        timeChangePercent: timeChangePercent.toFixed(2)
      }
    });
  }
}

/**
 * Get singleton instance
 */
let validatorInstance = null;

export function getBuildValidator() {
  if (!validatorInstance) {
    validatorInstance = new BuildValidator();
  }
  return validatorInstance;
}
