/**
 * HealthValidator - Validates Container Health Checks
 *
 * Phase 8.3: Validators
 * Validates container health check configuration and status
 */

import { BaseValidator, VALIDATION_SEVERITY } from './base-validator.js';
import Docker from 'dockerode';

/**
 * Health check types
 */
export const HEALTH_CHECK_TYPE = {
  HTTP: 'http',
  TCP: 'tcp',
  COMMAND: 'command',
  SHELL: 'shell'
};

/**
 * HealthValidator
 * Validates container health checks
 */
export class HealthValidator extends BaseValidator {
  constructor() {
    super('HealthValidator', 'health');
    this.docker = new Docker();
    this.healthCheckDefaults = {
      interval: 30,      // seconds
      timeout: 30,       // seconds
      retries: 3,
      startPeriod: 0     // seconds
    };
  }

  /**
   * Validate health check configuration
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(options = {}) {
    const {
      healthcheck,
      containerId,
      imageName,
      checkRunningContainer = false
    } = options;

    this.logger.info(`Validating health check: ${containerId || imageName || 'from config'}`);

    const issues = [];
    let containerInfo = null;

    // Validate health check configuration
    if (healthcheck) {
      const configIssues = this.validateHealthCheckConfig(healthcheck);
      issues.push(...configIssues);
    }

    // Validate running container health
    if (checkRunningContainer && containerId) {
      try {
        const container = this.docker.getContainer(containerId);
        containerInfo = await container.inspect();
        const containerIssues = this.validateContainerHealth(containerInfo);
        issues.push(...containerIssues);
      } catch (error) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.ERROR,
          message: `Failed to inspect container: ${error.message}`,
          code: 'HV3000'
        }));
      }
    }

    // Validate image health check
    if (imageName && !healthcheck) {
      try {
        const image = this.docker.getImage(imageName);
        const imageInfo = await image.inspect();
        const imageIssues = this.validateImageHealthCheck(imageInfo);
        issues.push(...imageIssues);
      } catch (error) {
        this.logger.warn(`Failed to inspect image: ${error.message}`);
      }
    }

    // Determine if valid
    const errors = issues.filter(i => i.severity === VALIDATION_SEVERITY.ERROR);
    const valid = errors.length === 0;

    const result = this.createResult({
      valid,
      issues,
      metadata: {
        containerId,
        imageName,
        healthStatus: containerInfo?.State?.Health?.Status
      }
    });

    this.recordValidation(result);
    this.logger.info(`Validation completed: ${result.status} (${errors.length} errors, ${result.warnings.length} warnings)`);

    return result;
  }

  /**
   * Validate health check configuration
   * @param {Object} healthcheck - Health check config
   * @returns {Array} Issues
   */
  validateHealthCheckConfig(healthcheck) {
    const issues = [];

    // Check if health check is disabled
    if (healthcheck.test && healthcheck.test[0] === 'NONE') {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: 'Health check is explicitly disabled',
        code: 'HV3001',
        suggestion: 'Enable health check for better container monitoring'
      }));
      return issues;
    }

    // Check if test is defined
    if (!healthcheck.test || healthcheck.test.length === 0) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: 'Health check test command is not defined',
        code: 'HV3002',
        suggestion: 'Add test command (e.g., CMD curl -f http://localhost/health || exit 1)'
      }));
      return issues;
    }

    // Validate test command format
    const testType = healthcheck.test[0];
    if (!['CMD', 'CMD-SHELL', 'NONE'].includes(testType)) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: `Invalid health check test type: ${testType}`,
        code: 'HV3003',
        suggestion: 'Use CMD, CMD-SHELL, or NONE'
      }));
    }

    // Check interval
    const interval = this.parseHealthCheckDuration(healthcheck.interval);
    if (interval !== null) {
      if (interval < 5) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Health check interval (${interval}s) is very short`,
          code: 'HV3004',
          suggestion: 'Use longer interval to reduce overhead (recommended: 30s)'
        }));
      } else if (interval > 300) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Health check interval (${interval}s) is very long`,
          code: 'HV3004',
          suggestion: 'Use shorter interval for faster detection (recommended: 30s)'
        }));
      }
    }

    // Check timeout
    const timeout = this.parseHealthCheckDuration(healthcheck.timeout);
    if (timeout !== null && interval !== null) {
      if (timeout >= interval) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.ERROR,
          message: 'Health check timeout should be less than interval',
          code: 'HV3005',
          suggestion: `Set timeout < ${interval}s`
        }));
      }

      if (timeout < 1) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Health check timeout (${timeout}s) is very short`,
          code: 'HV3005',
          suggestion: 'Use longer timeout to allow health check to complete'
        }));
      }
    }

    // Check retries
    const retries = healthcheck.retries;
    if (retries !== undefined) {
      if (retries < 1) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: 'Health check retries is less than 1',
          code: 'HV3006',
          suggestion: 'Use at least 3 retries'
        }));
      } else if (retries > 10) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Health check retries (${retries}) is very high`,
          code: 'HV3006',
          suggestion: 'Use fewer retries (recommended: 3)'
        }));
      }
    }

    // Check start period
    const startPeriod = this.parseHealthCheckDuration(healthcheck.start_period || healthcheck.startPeriod);
    if (startPeriod !== null && startPeriod > 0) {
      if (startPeriod < 10) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.SUGGESTION,
          message: `Health check start period (${startPeriod}s) might be too short`,
          code: 'HV3007',
          suggestion: 'Ensure application has enough time to start'
        }));
      }
    }

    // Analyze test command
    const testCommand = healthcheck.test.slice(1).join(' ');
    const commandIssues = this.analyzeHealthCheckCommand(testCommand);
    issues.push(...commandIssues);

    return issues;
  }

  /**
   * Validate container health status
   * @param {Object} containerInfo - Container info from Docker inspect
   * @returns {Array} Issues
   */
  validateContainerHealth(containerInfo) {
    const issues = [];

    // Check if health check is configured
    if (!containerInfo.State?.Health) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: 'Container has no health check configured',
        code: 'HV3010',
        suggestion: 'Add HEALTHCHECK instruction to Dockerfile'
      }));
      return issues;
    }

    const health = containerInfo.State.Health;

    // Check health status
    if (health.Status === 'unhealthy') {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: 'Container is unhealthy',
        code: 'HV3011',
        suggestion: 'Check container logs and health check command'
      }));

      // Get last health check log
      if (health.Log && health.Log.length > 0) {
        const lastLog = health.Log[health.Log.length - 1];
        if (lastLog.Output) {
          issues.push(this.createIssue({
            severity: VALIDATION_SEVERITY.INFO,
            message: `Last health check output: ${lastLog.Output.trim()}`,
            code: 'HV3011'
          }));
        }
      }
    } else if (health.Status === 'starting') {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.INFO,
        message: 'Container health check is in starting period',
        code: 'HV3012'
      }));
    }

    // Check failing streak
    if (health.FailingStreak > 0) {
      issues.push(this.createIssue({
        severity: health.Status === 'unhealthy' ? VALIDATION_SEVERITY.ERROR : VALIDATION_SEVERITY.WARNING,
        message: `Health check has failed ${health.FailingStreak} consecutive times`,
        code: 'HV3013',
        suggestion: 'Investigate why health checks are failing'
      }));
    }

    return issues;
  }

  /**
   * Validate image health check
   * @param {Object} imageInfo - Image info from Docker inspect
   * @returns {Array} Issues
   */
  validateImageHealthCheck(imageInfo) {
    const issues = [];

    if (!imageInfo.Config?.Healthcheck) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.SUGGESTION,
        message: 'Image has no built-in health check',
        code: 'HV3020',
        suggestion: 'Add HEALTHCHECK instruction to Dockerfile or configure in docker-compose.yml'
      }));
    } else {
      // Validate the image's health check config
      const configIssues = this.validateHealthCheckConfig(imageInfo.Config.Healthcheck);
      issues.push(...configIssues);
    }

    return issues;
  }

  /**
   * Analyze health check command
   * @param {string} command - Health check command
   * @returns {Array} Issues
   */
  analyzeHealthCheckCommand(command) {
    const issues = [];

    // Check for common tools
    if (command.includes('curl')) {
      if (!command.includes('-f')) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.SUGGESTION,
          message: 'curl health check should use -f flag',
          code: 'HV3030',
          suggestion: 'Use curl -f to fail on HTTP errors'
        }));
      }

      if (!command.includes('localhost') && !command.includes('127.0.0.1')) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.SUGGESTION,
          message: 'Health check should target localhost',
          code: 'HV3030',
          suggestion: 'Use localhost or 127.0.0.1 instead of external addresses'
        }));
      }
    }

    // Check for wget
    if (command.includes('wget')) {
      if (!command.includes('--spider') && !command.includes('-O-')) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.SUGGESTION,
          message: 'wget health check should use --spider or -O-',
          code: 'HV3031',
          suggestion: 'Use wget --spider to avoid downloading content'
        }));
      }
    }

    // Check for exit codes
    if (!command.includes('exit')) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.INFO,
        message: 'Health check should explicitly return exit codes',
        code: 'HV3032',
        suggestion: 'Use || exit 1 to explicitly fail the health check'
      }));
    }

    // Check for common health endpoints
    const hasHealthEndpoint = command.includes('/health') ||
                              command.includes('/healthz') ||
                              command.includes('/ping') ||
                              command.includes('/ready');

    if (!hasHealthEndpoint && command.includes('http')) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.SUGGESTION,
        message: 'Consider using a dedicated health endpoint',
        code: 'HV3033',
        suggestion: 'Create /health or /healthz endpoint for health checks'
      }));
    }

    return issues;
  }

  /**
   * Parse health check duration string
   * @param {string|number} duration - Duration (e.g., "30s", 30000000000)
   * @returns {number|null} Duration in seconds
   */
  parseHealthCheckDuration(duration) {
    if (duration === undefined || duration === null) {
      return null;
    }

    if (typeof duration === 'number') {
      // Nanoseconds to seconds
      return duration / 1000000000;
    }

    if (typeof duration === 'string') {
      const match = duration.match(/^(\d+)([smh]?)$/);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2] || 's';

        switch (unit) {
          case 's': return value;
          case 'm': return value * 60;
          case 'h': return value * 3600;
          default: return value;
        }
      }
    }

    return null;
  }

  /**
   * Monitor container health
   * @param {string} containerId - Container ID
   * @param {Object} options - Monitor options
   * @returns {Promise<Object>} Monitoring result
   */
  async monitorContainerHealth(containerId, options = {}) {
    const {
      duration = 60000,      // Monitor for 1 minute
      interval = 5000,       // Check every 5 seconds
      failOnUnhealthy = true
    } = options;

    this.logger.info(`Monitoring container health: ${containerId}`);

    const container = this.docker.getContainer(containerId);
    const results = [];
    const startTime = Date.now();

    while (Date.now() - startTime < duration) {
      try {
        const info = await container.inspect();
        const health = info.State?.Health;

        if (health) {
          results.push({
            timestamp: new Date().toISOString(),
            status: health.Status,
            failingStreak: health.FailingStreak
          });

          if (failOnUnhealthy && health.Status === 'unhealthy') {
            return this.createResult({
              valid: false,
              issues: [
                this.createIssue({
                  severity: VALIDATION_SEVERITY.ERROR,
                  message: 'Container became unhealthy during monitoring',
                  code: 'HV3040'
                })
              ],
              metadata: {
                containerId,
                duration: Date.now() - startTime,
                checks: results.length,
                results
              }
            });
          }
        }

        await this.sleep(interval);
      } catch (error) {
        this.logger.error(`Monitoring error: ${error.message}`);
        break;
      }
    }

    const healthyChecks = results.filter(r => r.status === 'healthy').length;
    const valid = healthyChecks === results.length;

    return this.createResult({
      valid,
      issues: valid ? [] : [
        this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Only ${healthyChecks}/${results.length} health checks passed`,
          code: 'HV3041'
        })
      ],
      metadata: {
        containerId,
        duration: Date.now() - startTime,
        checks: results.length,
        healthyChecks,
        results
      }
    });
  }

  /**
   * Sleep helper
   * @param {number} ms - Milliseconds
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate health check recommendation
   * @param {Object} serviceConfig - Service configuration
   * @returns {Object} Recommended health check
   */
  generateHealthCheckRecommendation(serviceConfig) {
    const recommendation = {
      test: ['CMD-SHELL', 'curl -f http://localhost:3000/health || exit 1'],
      interval: '30s',
      timeout: '10s',
      retries: 3,
      start_period: '40s'
    };

    // Adjust based on service type
    if (serviceConfig.ports) {
      const port = String(serviceConfig.ports[0]).split(':').pop().split('/')[0];
      recommendation.test = ['CMD-SHELL', `curl -f http://localhost:${port}/health || exit 1`];
    }

    return recommendation;
  }
}

/**
 * Get singleton instance
 */
let validatorInstance = null;

export function getHealthValidator() {
  if (!validatorInstance) {
    validatorInstance = new HealthValidator();
  }
  return validatorInstance;
}
