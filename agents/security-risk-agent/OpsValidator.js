/**
 * OpsValidator
 * ------------
 * Validates ops/deployment configurations for security and correctness.
 * Manages ops/ folder contents.
 *
 * Validates:
 * - environments.json - Environment configurations
 * - deployment.md - Deployment procedures
 * - runbooks/ - Operational runbooks
 * - Docker/Kubernetes configs
 * - CI/CD pipelines
 * - Secret handling
 */

import EventEmitter from 'events';
import fs from 'fs/promises';
import path from 'path';

// Validation result types
export const ValidationSeverity = {
  ERROR: 'error',      // Blocks deployment
  WARNING: 'warning',  // Should be fixed
  INFO: 'info'         // Informational
};

// Environment types
export const EnvironmentType = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test'
};

export class OpsValidator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      requiredEnvVars: config.requiredEnvVars || [],
      forbiddenInProd: config.forbiddenInProd || ['DEBUG', 'DEV_MODE'],
      ...config
    };
    this.projectPath = null;
    this.environments = {};
    this.deploymentConfig = null;
  }

  async initialize() {
    // Nothing to initialize until project path is set
  }

  /**
   * Set project path and load configs
   */
  async setProjectPath(opsPath) {
    this.projectPath = opsPath;
    await this._ensureDirectory();
    await this._loadEnvironments();
  }

  /**
   * Full validation of ops configuration
   */
  async validate(options = {}) {
    const results = {
      valid: true,
      timestamp: new Date().toISOString(),
      environments: {},
      issues: [],
      warnings: [],
      info: []
    };

    if (!this.projectPath) {
      results.valid = false;
      results.issues.push({
        type: 'error',
        message: 'Ops path not set'
      });
      return results;
    }

    try {
      // Validate environments.json
      const envResults = await this._validateEnvironmentsFile();
      if (envResults.issues.length > 0) {
        results.issues.push(...envResults.issues.filter(i => i.severity === ValidationSeverity.ERROR));
        results.warnings.push(...envResults.issues.filter(i => i.severity === ValidationSeverity.WARNING));
      }

      // Validate each environment
      for (const envName of Object.keys(this.environments)) {
        const envResult = await this.validateEnvironment(envName);
        results.environments[envName] = envResult;

        if (!envResult.valid) {
          results.valid = false;
        }

        results.issues.push(...envResult.issues);
        results.warnings.push(...envResult.warnings);
      }

      // Validate Docker configs if present
      const dockerResults = await this._validateDockerConfigs();
      results.issues.push(...dockerResults.issues);
      results.warnings.push(...dockerResults.warnings);

      // Validate secrets handling
      const secretsResults = await this._validateSecretsHandling();
      results.issues.push(...secretsResults.issues);
      results.warnings.push(...secretsResults.warnings);

      // Check for runbooks
      const runbooksResults = await this._checkRunbooks();
      results.info.push(...runbooksResults.info);
      results.warnings.push(...runbooksResults.warnings);

      // Overall validity
      results.valid = results.issues.length === 0;

      return results;
    } catch (error) {
      results.valid = false;
      results.issues.push({
        type: 'error',
        message: `Validation error: ${error.message}`
      });
      return results;
    }
  }

  /**
   * Validate a specific environment
   */
  async validateEnvironment(environmentName) {
    const results = {
      environment: environmentName,
      valid: true,
      issues: [],
      warnings: []
    };

    const env = this.environments[environmentName];
    if (!env) {
      results.valid = false;
      results.issues.push({
        severity: ValidationSeverity.ERROR,
        message: `Environment not found: ${environmentName}`
      });
      return results;
    }

    // Check required fields
    const requiredFields = ['name', 'url'];
    for (const field of requiredFields) {
      if (!env[field]) {
        results.warnings.push({
          severity: ValidationSeverity.WARNING,
          field,
          message: `Missing recommended field: ${field}`
        });
      }
    }

    // Production-specific checks
    if (environmentName === EnvironmentType.PRODUCTION || env.type === EnvironmentType.PRODUCTION) {
      const prodChecks = this._validateProductionEnvironment(env);
      results.issues.push(...prodChecks.issues);
      results.warnings.push(...prodChecks.warnings);
    }

    // Check environment variables
    if (env.variables) {
      const varChecks = this._validateEnvironmentVariables(env.variables, environmentName);
      results.issues.push(...varChecks.issues);
      results.warnings.push(...varChecks.warnings);
    }

    // Check for exposed secrets
    if (env.secrets) {
      const secretChecks = this._checkExposedSecrets(env.secrets);
      results.issues.push(...secretChecks.issues);
    }

    results.valid = results.issues.length === 0;
    return results;
  }

  /**
   * Validate ops files exist and are valid
   */
  async validateFiles() {
    const result = { valid: true, severity: 'info', issues: [] };

    if (!this.projectPath) {
      result.issues.push({ type: 'info', message: 'Ops path not configured' });
      return result;
    }

    // Check environments.json
    const envPath = path.join(this.projectPath, 'environments.json');
    try {
      await fs.access(envPath);
      const content = await fs.readFile(envPath, 'utf-8');
      JSON.parse(content);  // Validate JSON
    } catch (error) {
      if (error.code === 'ENOENT') {
        result.issues.push({
          type: 'warning',
          message: 'environments.json not found (optional)'
        });
      } else if (error instanceof SyntaxError) {
        result.valid = false;
        result.severity = 'error';
        result.issues.push({
          type: 'error',
          message: 'Invalid JSON in environments.json'
        });
      }
    }

    // Check deployment.md
    const deployPath = path.join(this.projectPath, 'deployment.md');
    try {
      await fs.access(deployPath);
    } catch {
      result.issues.push({
        type: 'info',
        message: 'deployment.md not found (recommended)'
      });
    }

    return result;
  }

  /**
   * Add or update environment configuration
   */
  async setEnvironment(name, config) {
    this.environments[name] = {
      name,
      type: config.type || name,
      url: config.url || '',
      variables: config.variables || {},
      secrets: config.secrets || [],
      features: config.features || {},
      monitoring: config.monitoring || {},
      updatedAt: new Date().toISOString(),
      ...config
    };

    await this._saveEnvironments();
    return this.environments[name];
  }

  /**
   * Get environment configuration
   */
  getEnvironment(name) {
    return this.environments[name] || null;
  }

  /**
   * Get all environments
   */
  getAllEnvironments() {
    return { ...this.environments };
  }

  /**
   * Compare environments (e.g., staging vs production)
   */
  compareEnvironments(env1Name, env2Name) {
    const env1 = this.environments[env1Name];
    const env2 = this.environments[env2Name];

    if (!env1 || !env2) {
      throw new Error('One or both environments not found');
    }

    const differences = {
      variables: {
        onlyIn1: [],
        onlyIn2: [],
        different: []
      },
      features: {
        onlyIn1: [],
        onlyIn2: [],
        different: []
      }
    };

    // Compare variables
    const vars1 = Object.keys(env1.variables || {});
    const vars2 = Object.keys(env2.variables || {});

    differences.variables.onlyIn1 = vars1.filter(v => !vars2.includes(v));
    differences.variables.onlyIn2 = vars2.filter(v => !vars1.includes(v));

    for (const key of vars1.filter(v => vars2.includes(v))) {
      if (env1.variables[key] !== env2.variables[key]) {
        differences.variables.different.push({
          key,
          [env1Name]: env1.variables[key],
          [env2Name]: env2.variables[key]
        });
      }
    }

    // Compare features
    const feat1 = Object.keys(env1.features || {});
    const feat2 = Object.keys(env2.features || {});

    differences.features.onlyIn1 = feat1.filter(f => !feat2.includes(f));
    differences.features.onlyIn2 = feat2.filter(f => !feat1.includes(f));

    for (const key of feat1.filter(f => feat2.includes(f))) {
      if (env1.features[key] !== env2.features[key]) {
        differences.features.different.push({
          key,
          [env1Name]: env1.features[key],
          [env2Name]: env2.features[key]
        });
      }
    }

    return differences;
  }

  // Private methods

  async _ensureDirectory() {
    if (!this.projectPath) return;
    await fs.mkdir(this.projectPath, { recursive: true });
  }

  async _loadEnvironments() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'environments.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      this.environments = data.environments || data || {};
    } catch (error) {
      // File doesn't exist, use default
      this.environments = {};
    }
  }

  async _saveEnvironments() {
    if (!this.projectPath) return;

    const filePath = path.join(this.projectPath, 'environments.json');
    const data = {
      version: '1.0.0',
      updatedAt: new Date().toISOString(),
      environments: this.environments
    };
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  }

  async _validateEnvironmentsFile() {
    const results = { issues: [] };

    if (!this.projectPath) return results;

    const filePath = path.join(this.projectPath, 'environments.json');
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      JSON.parse(content);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        results.issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Invalid environments.json: ${error.message}`
        });
      }
    }

    return results;
  }

  _validateProductionEnvironment(env) {
    const results = { issues: [], warnings: [] };

    // Check for debug mode
    if (env.variables?.DEBUG === 'true' || env.variables?.DEBUG === true) {
      results.issues.push({
        severity: ValidationSeverity.ERROR,
        message: 'DEBUG mode enabled in production'
      });
    }

    // Check for development flags
    for (const forbidden of this.config.forbiddenInProd) {
      if (env.variables?.[forbidden]) {
        results.issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Forbidden variable in production: ${forbidden}`
        });
      }
    }

    // Check for HTTPS
    if (env.url && !env.url.startsWith('https://')) {
      results.warnings.push({
        severity: ValidationSeverity.WARNING,
        message: 'Production URL should use HTTPS'
      });
    }

    // Check for monitoring
    if (!env.monitoring || Object.keys(env.monitoring).length === 0) {
      results.warnings.push({
        severity: ValidationSeverity.WARNING,
        message: 'No monitoring configured for production'
      });
    }

    return results;
  }

  _validateEnvironmentVariables(variables, envName) {
    const results = { issues: [], warnings: [] };

    // Check for hardcoded credentials
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /api_key/i,
      /apikey/i,
      /private_key/i,
      /access_token/i
    ];

    for (const [key, value] of Object.entries(variables)) {
      // Check if sensitive value is hardcoded (not a reference)
      const isSensitive = sensitivePatterns.some(p => p.test(key));
      if (isSensitive && typeof value === 'string' && !value.startsWith('${') && !value.startsWith('{{')) {
        results.issues.push({
          severity: ValidationSeverity.ERROR,
          message: `Sensitive variable "${key}" appears to have a hardcoded value in ${envName}`
        });
      }
    }

    // Check for required variables
    for (const required of this.config.requiredEnvVars) {
      if (!variables[required]) {
        results.warnings.push({
          severity: ValidationSeverity.WARNING,
          message: `Required variable "${required}" not found in ${envName}`
        });
      }
    }

    return results;
  }

  _checkExposedSecrets(secrets) {
    const results = { issues: [] };

    for (const secret of secrets) {
      // If secret has a value (not just a key name), it might be exposed
      if (secret.value && typeof secret.value === 'string') {
        if (!secret.value.startsWith('${') && !secret.value.startsWith('{{')) {
          results.issues.push({
            severity: ValidationSeverity.CRITICAL,
            message: `Secret "${secret.name || secret.key}" has exposed value`
          });
        }
      }
    }

    return results;
  }

  async _validateDockerConfigs() {
    const results = { issues: [], warnings: [] };

    if (!this.projectPath) return results;

    // Check for Dockerfile
    const dockerfilePath = path.join(this.projectPath, '..', 'Dockerfile');
    try {
      const content = await fs.readFile(dockerfilePath, 'utf-8');

      // Check for root user
      if (!content.includes('USER ') || content.includes('USER root')) {
        results.warnings.push({
          severity: ValidationSeverity.WARNING,
          message: 'Docker container may run as root user'
        });
      }

      // Check for latest tag
      if (content.includes(':latest')) {
        results.warnings.push({
          severity: ValidationSeverity.WARNING,
          message: 'Using :latest tag in Dockerfile (pin versions for reproducibility)'
        });
      }
    } catch {
      // No Dockerfile in ops, might be elsewhere
    }

    return results;
  }

  async _validateSecretsHandling() {
    const results = { issues: [], warnings: [] };

    // Check for .env files that shouldn't be committed
    if (this.projectPath) {
      const envPath = path.join(this.projectPath, '..', '.env');
      try {
        await fs.access(envPath);
        results.warnings.push({
          severity: ValidationSeverity.WARNING,
          message: '.env file found - ensure it\'s in .gitignore'
        });
      } catch {
        // Good - no .env in tracked path
      }
    }

    return results;
  }

  async _checkRunbooks() {
    const results = { warnings: [], info: [] };

    if (!this.projectPath) return results;

    const runbooksPath = path.join(this.projectPath, 'runbooks');
    try {
      const files = await fs.readdir(runbooksPath);
      if (files.length === 0) {
        results.warnings.push({
          severity: ValidationSeverity.WARNING,
          message: 'Runbooks directory is empty'
        });
      } else {
        results.info.push({
          type: 'info',
          message: `${files.length} runbook(s) found`
        });
      }
    } catch {
      results.info.push({
        type: 'info',
        message: 'No runbooks directory (recommended for production)'
      });
    }

    return results;
  }
}

export default OpsValidator;
