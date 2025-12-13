/**
 * ComposeValidator - Validates docker-compose.yml Files
 *
 * Phase 8.3: Validators
 * Validates docker-compose.yml files for syntax and best practices
 */

import { BaseValidator, VALIDATION_SEVERITY } from './base-validator.js';
import * as fs from 'fs';
import * as yaml from 'yaml';

/**
 * Supported compose file versions
 */
export const COMPOSE_VERSIONS = ['3', '3.0', '3.1', '3.2', '3.3', '3.4', '3.5', '3.6', '3.7', '3.8', '3.9'];

/**
 * ComposeValidator
 * Validates docker-compose.yml files
 */
export class ComposeValidator extends BaseValidator {
  constructor() {
    super('ComposeValidator', 'compose');
    this.rules = this.initializeRules();
  }

  /**
   * Initialize validation rules
   * @returns {Array} Validation rules
   */
  initializeRules() {
    return [
      { id: 'DC3000', check: this.checkVersion.bind(this), name: 'Compose version' },
      { id: 'DC3001', check: this.checkServices.bind(this), name: 'Services definition' },
      { id: 'DC3002', check: this.checkImageOrBuild.bind(this), name: 'Image or build' },
      { id: 'DC3003', check: this.checkPorts.bind(this), name: 'Port mappings' },
      { id: 'DC3004', check: this.checkVolumes.bind(this), name: 'Volume configuration' },
      { id: 'DC3005', check: this.checkNetworks.bind(this), name: 'Network configuration' },
      { id: 'DC3006', check: this.checkEnvironment.bind(this), name: 'Environment variables' },
      { id: 'DC3007', check: this.checkDependencies.bind(this), name: 'Service dependencies' },
      { id: 'DC3008', check: this.checkHealthChecks.bind(this), name: 'Health checks' },
      { id: 'DC3009', check: this.checkResourceLimits.bind(this), name: 'Resource limits' }
    ];
  }

  /**
   * Validate docker-compose.yml
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation result
   */
  async validate(options = {}) {
    const {
      filePath = 'docker-compose.yml',
      content = null,
      strict = false,
      enabledRules = this.rules.map(r => r.id)
    } = options;

    this.logger.info(`Validating docker-compose file: ${filePath}`);

    const issues = [];
    let composeContent;
    let config;

    // Read compose file
    if (content) {
      composeContent = content;
    } else {
      if (!fs.existsSync(filePath)) {
        return this.createResult({
          valid: false,
          issues: [
            this.createIssue({
              severity: VALIDATION_SEVERITY.ERROR,
              message: `Compose file not found: ${filePath}`
            })
          ]
        });
      }
      composeContent = fs.readFileSync(filePath, 'utf-8');
    }

    // Parse YAML
    try {
      config = yaml.parse(composeContent);
    } catch (error) {
      return this.createResult({
        valid: false,
        issues: [
          this.createIssue({
            severity: VALIDATION_SEVERITY.ERROR,
            message: `YAML parsing failed: ${error.message}`,
            code: 'DC3099'
          })
        ]
      });
    }

    // Run validation rules
    for (const rule of this.rules) {
      if (enabledRules.includes(rule.id)) {
        try {
          const ruleIssues = await rule.check(config);
          issues.push(...ruleIssues);
        } catch (error) {
          this.logger.error(`Rule ${rule.id} failed: ${error.message}`);
        }
      }
    }

    // Determine if valid
    const errors = issues.filter(i => i.severity === VALIDATION_SEVERITY.ERROR);
    const valid = errors.length === 0;

    const result = this.createResult({
      valid,
      issues,
      metadata: {
        filePath,
        version: config.version,
        serviceCount: config.services ? Object.keys(config.services).length : 0,
        rulesChecked: enabledRules.length
      }
    });

    this.recordValidation(result);
    this.logger.info(`Validation completed: ${result.status} (${errors.length} errors, ${result.warnings.length} warnings)`);

    return result;
  }

  /**
   * Check compose version
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkVersion(config) {
    const issues = [];

    if (!config.version) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: 'No version specified in docker-compose.yml',
        code: 'DC3000',
        suggestion: 'Add version: "3.8" at the top of the file'
      }));
    } else if (!COMPOSE_VERSIONS.includes(config.version)) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Compose version ${config.version} may not be supported`,
        code: 'DC3000',
        suggestion: `Use a supported version: ${COMPOSE_VERSIONS.slice(-3).join(', ')}`
      }));
    }

    return issues;
  }

  /**
   * Check services definition
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkServices(config) {
    const issues = [];

    if (!config.services) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: 'No services defined in docker-compose.yml',
        code: 'DC3001'
      }));
      return issues;
    }

    if (Object.keys(config.services).length === 0) {
      issues.push(this.createIssue({
        severity: VALIDATION_SEVERITY.ERROR,
        message: 'Services object is empty',
        code: 'DC3001'
      }));
    }

    // Check service names
    Object.keys(config.services).forEach(serviceName => {
      if (!/^[a-zA-Z0-9_-]+$/.test(serviceName)) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Service name '${serviceName}' contains invalid characters`,
          code: 'DC3001',
          suggestion: 'Use only alphanumeric characters, hyphens, and underscores'
        }));
      }
    });

    return issues;
  }

  /**
   * Check image or build configuration
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkImageOrBuild(config) {
    const issues = [];

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (!service.image && !service.build) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.ERROR,
          message: `Service '${serviceName}' must specify either 'image' or 'build'`,
          code: 'DC3002'
        }));
      }

      // Check if using 'latest' tag
      if (service.image && service.image.includes(':latest')) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Service '${serviceName}' uses 'latest' tag`,
          code: 'DC3002',
          suggestion: 'Use specific version tags for reproducible builds'
        }));
      }

      // Check if no tag specified
      if (service.image && !service.image.includes(':')) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Service '${serviceName}' image has no version tag`,
          code: 'DC3002',
          suggestion: 'Specify a version tag (e.g., nginx:1.21.0)'
        }));
      }
    });

    return issues;
  }

  /**
   * Check port mappings
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkPorts(config) {
    const issues = [];
    const usedPorts = new Set();

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (service.ports) {
        service.ports.forEach(portMapping => {
          const portStr = String(portMapping);
          const hostPort = portStr.split(':')[0];

          // Check for port conflicts
          if (usedPorts.has(hostPort)) {
            issues.push(this.createIssue({
              severity: VALIDATION_SEVERITY.ERROR,
              message: `Port ${hostPort} is mapped multiple times`,
              code: 'DC3003'
            }));
          }
          usedPorts.add(hostPort);

          // Check for privileged ports
          const portNum = parseInt(hostPort, 10);
          if (portNum < 1024) {
            issues.push(this.createIssue({
              severity: VALIDATION_SEVERITY.WARNING,
              message: `Service '${serviceName}' uses privileged port ${hostPort}`,
              code: 'DC3003',
              suggestion: 'Consider using ports >= 1024 or run with elevated privileges'
            }));
          }
        });
      }

      // Check for expose without ports
      if (service.expose && !service.ports) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.INFO,
          message: `Service '${serviceName}' exposes ports but doesn't publish them`,
          code: 'DC3003',
          suggestion: 'Add ports mapping if external access is needed'
        }));
      }
    });

    return issues;
  }

  /**
   * Check volume configuration
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkVolumes(config) {
    const issues = [];
    const declaredVolumes = new Set(config.volumes ? Object.keys(config.volumes) : []);
    const usedVolumes = new Set();

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (service.volumes) {
        service.volumes.forEach(volume => {
          const volumeStr = String(volume);

          // Check for named volumes
          if (!volumeStr.startsWith('/') && !volumeStr.startsWith('.') && !volumeStr.startsWith('~')) {
            const volumeName = volumeStr.split(':')[0];
            usedVolumes.add(volumeName);

            if (!declaredVolumes.has(volumeName)) {
              issues.push(this.createIssue({
                severity: VALIDATION_SEVERITY.WARNING,
                message: `Service '${serviceName}' uses undeclared volume '${volumeName}'`,
                code: 'DC3004',
                suggestion: 'Declare volume in top-level volumes section'
              }));
            }
          }

          // Check for bind mounts with absolute paths
          if (volumeStr.startsWith('/')) {
            issues.push(this.createIssue({
              severity: VALIDATION_SEVERITY.SUGGESTION,
              message: `Service '${serviceName}' uses absolute path bind mount`,
              code: 'DC3004',
              suggestion: 'Consider using relative paths or named volumes for portability'
            }));
          }
        });
      }
    });

    // Check for unused declared volumes
    declaredVolumes.forEach(volumeName => {
      if (!usedVolumes.has(volumeName)) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.INFO,
          message: `Declared volume '${volumeName}' is not used by any service`,
          code: 'DC3004'
        }));
      }
    });

    return issues;
  }

  /**
   * Check network configuration
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkNetworks(config) {
    const issues = [];
    const declaredNetworks = new Set(config.networks ? Object.keys(config.networks) : []);
    const usedNetworks = new Set();

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (service.networks) {
        const networks = Array.isArray(service.networks)
          ? service.networks
          : Object.keys(service.networks);

        networks.forEach(networkName => {
          usedNetworks.add(networkName);

          if (!declaredNetworks.has(networkName) && networkName !== 'default') {
            issues.push(this.createIssue({
              severity: VALIDATION_SEVERITY.WARNING,
              message: `Service '${serviceName}' uses undeclared network '${networkName}'`,
              code: 'DC3005',
              suggestion: 'Declare network in top-level networks section'
            }));
          }
        });
      }
    });

    // Check for unused declared networks
    declaredNetworks.forEach(networkName => {
      if (!usedNetworks.has(networkName)) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.INFO,
          message: `Declared network '${networkName}' is not used by any service`,
          code: 'DC3005'
        }));
      }
    });

    return issues;
  }

  /**
   * Check environment variables
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkEnvironment(config) {
    const issues = [];

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (service.environment) {
        const envVars = Array.isArray(service.environment)
          ? service.environment
          : Object.entries(service.environment).map(([k, v]) => `${k}=${v}`);

        envVars.forEach(envVar => {
          const varStr = String(envVar);

          // Check for hardcoded secrets
          const secretPatterns = [
            /password\s*=/i,
            /api[_-]?key\s*=/i,
            /secret\s*=/i,
            /token\s*=/i
          ];

          secretPatterns.forEach(pattern => {
            if (pattern.test(varStr) && !varStr.includes('${')) {
              issues.push(this.createIssue({
                severity: VALIDATION_SEVERITY.WARNING,
                message: `Service '${serviceName}' may have hardcoded secret in environment`,
                code: 'DC3006',
                suggestion: 'Use .env file or environment variable interpolation'
              }));
            }
          });
        });
      }

      // Suggest using env_file
      if (service.environment && !service.env_file) {
        const envCount = Array.isArray(service.environment)
          ? service.environment.length
          : Object.keys(service.environment).length;

        if (envCount > 5) {
          issues.push(this.createIssue({
            severity: VALIDATION_SEVERITY.SUGGESTION,
            message: `Service '${serviceName}' has many environment variables`,
            code: 'DC3006',
            suggestion: 'Consider using env_file for better organization'
          }));
        }
      }
    });

    return issues;
  }

  /**
   * Check service dependencies
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkDependencies(config) {
    const issues = [];
    const serviceNames = new Set(config.services ? Object.keys(config.services) : []);

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (service.depends_on) {
        const dependencies = Array.isArray(service.depends_on)
          ? service.depends_on
          : Object.keys(service.depends_on);

        dependencies.forEach(depName => {
          if (!serviceNames.has(depName)) {
            issues.push(this.createIssue({
              severity: VALIDATION_SEVERITY.ERROR,
              message: `Service '${serviceName}' depends on non-existent service '${depName}'`,
              code: 'DC3007'
            }));
          }
        });

        // Check for circular dependencies (simple check)
        dependencies.forEach(depName => {
          const depService = config.services[depName];
          if (depService && depService.depends_on) {
            const depDependencies = Array.isArray(depService.depends_on)
              ? depService.depends_on
              : Object.keys(depService.depends_on);

            if (depDependencies.includes(serviceName)) {
              issues.push(this.createIssue({
                severity: VALIDATION_SEVERITY.ERROR,
                message: `Circular dependency detected: ${serviceName} ↔ ${depName}`,
                code: 'DC3007'
              }));
            }
          }
        });
      }
    });

    return issues;
  }

  /**
   * Check health checks
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkHealthChecks(config) {
    const issues = [];

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (!service.healthcheck) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.SUGGESTION,
          message: `Service '${serviceName}' has no health check configured`,
          code: 'DC3008',
          suggestion: 'Add healthcheck to monitor service health'
        }));
      }
    });

    return issues;
  }

  /**
   * Check resource limits
   * @param {Object} config - Compose configuration
   * @returns {Array} Issues
   */
  checkResourceLimits(config) {
    const issues = [];

    if (!config.services) return issues;

    Object.entries(config.services).forEach(([serviceName, service]) => {
      if (!service.deploy?.resources?.limits) {
        issues.push(this.createIssue({
          severity: VALIDATION_SEVERITY.SUGGESTION,
          message: `Service '${serviceName}' has no resource limits`,
          code: 'DC3009',
          suggestion: 'Add resource limits to prevent resource exhaustion'
        }));
      }
    });

    return issues;
  }
}

/**
 * Get singleton instance
 */
let validatorInstance = null;

export function getComposeValidator() {
  if (!validatorInstance) {
    validatorInstance = new ComposeValidator();
  }
  return validatorInstance;
}
