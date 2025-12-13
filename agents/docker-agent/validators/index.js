/**
 * Validators Module - Docker Validation System
 *
 * Phase 8.3: Validators
 * Exports all validators
 */

export {
  BaseValidator,
  VALIDATION_SEVERITY,
  VALIDATION_STATUS
} from './base-validator.js';

export {
  DockerfileValidator,
  getDockerfileValidator,
  DOCKERFILE_INSTRUCTIONS
} from './dockerfile-validator.js';

export {
  ComposeValidator,
  getComposeValidator,
  COMPOSE_VERSIONS
} from './compose-validator.js';

export {
  BuildValidator,
  getBuildValidator
} from './build-validator.js';

export {
  HealthValidator,
  getHealthValidator,
  HEALTH_CHECK_TYPE
} from './health-validator.js';

import { getDockerfileValidator as _getDockerfileValidator } from './dockerfile-validator.js';
import { getComposeValidator as _getComposeValidator } from './compose-validator.js';
import { getBuildValidator as _getBuildValidator } from './build-validator.js';
import { getHealthValidator as _getHealthValidator } from './health-validator.js';

/**
 * Get all validators
 * @returns {Object} All validator instances
 */
export function getAllValidators() {
  return {
    dockerfile: _getDockerfileValidator(),
    compose: _getComposeValidator(),
    build: _getBuildValidator(),
    health: _getHealthValidator()
  };
}

/**
 * Validate all aspects of a Docker setup
 * @param {Object} options - Validation options
 * @returns {Promise<Object>} Aggregated validation result
 */
export async function validateDockerSetup(options = {}) {
  const {
    dockerfilePath,
    composePath,
    buildResult,
    containerId,
    enabledValidators = ['dockerfile', 'compose', 'build', 'health']
  } = options;

  const validators = getAllValidators();
  const results = {};

  // Validate Dockerfile
  if (enabledValidators.includes('dockerfile') && dockerfilePath) {
    results.dockerfile = await validators.dockerfile.validate({ filePath: dockerfilePath });
  }

  // Validate docker-compose.yml
  if (enabledValidators.includes('compose') && composePath) {
    results.compose = await validators.compose.validate({ filePath: composePath });
  }

  // Validate build result
  if (enabledValidators.includes('build') && buildResult) {
    results.build = await validators.build.validate({ buildResult });
  }

  // Validate health check
  if (enabledValidators.includes('health') && containerId) {
    results.health = await validators.health.validate({ containerId, checkRunningContainer: true });
  }

  // Aggregate results
  const allIssues = [];
  let overallValid = true;

  Object.values(results).forEach(result => {
    if (result.allIssues) {
      allIssues.push(...result.allIssues);
    }
    if (!result.valid) {
      overallValid = false;
    }
  });

  return {
    valid: overallValid,
    results,
    summary: {
      totalIssues: allIssues.length,
      errors: allIssues.filter(i => i.severity === 'error').length,
      warnings: allIssues.filter(i => i.severity === 'warning').length,
      suggestions: allIssues.filter(i => i.severity === 'suggestion').length
    }
  };
}

/**
 * Clear all validation histories
 */
export function clearAllHistories() {
  const validators = getAllValidators();
  Object.values(validators).forEach(validator => validator.clearHistory());
}
