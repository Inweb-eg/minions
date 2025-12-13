import { createLogger } from '../../../foundation/common/logger.js';

const logger = createLogger('DigestValidator');

/**
 * DigestValidator - Validates generated code digests
 *
 * Features:
 * - Schema validation (required fields present)
 * - Completeness checking (all necessary info)
 * - Consistency validation (cross-platform)
 * - Quality scoring (0-100)
 * - Platform-specific validation
 *
 * Digest Types:
 * - Backend digest (routes, models, services)
 * - User app digest (screens, widgets, models)
 * - Driver app digest (screens, widgets, models)
 * - Admin dashboard digest (pages, components, hooks)
 */
class DigestValidator {
  constructor() {
    this.logger = createLogger('DigestValidator');
    this.requiredFields = {
      backend: ['routes', 'controllers', 'models', 'services', 'middleware'],
      'user-app': ['screens', 'widgets', 'models', 'navigation', 'state'],
      'driver-app': ['screens', 'widgets', 'models', 'navigation', 'state'],
      'admin-dashboard': ['pages', 'components', 'hooks', 'api', 'state']
    };
  }

  /**
   * Validate a digest
   *
   * @param {Object} digest - Digest to validate
   * @param {string} digest.platform - Platform type (backend, user-app, driver-app, admin-dashboard)
   * @param {Object} digest.data - Digest data
   * @param {Object} digest.metadata - Digest metadata
   * @returns {Object} Validation result
   */
  validate(digest) {
    const platform = digest.platform || digest.metadata?.platform || 'unknown';
    this.logger.info(`Validating ${platform} digest...`);

    const result = {
      valid: true,
      score: 100,
      errors: [],
      warnings: [],
      suggestions: [],
      metrics: {
        completeness: 0,
        quality: 0,
        consistency: 0,
        implementability: 0
      }
    };

    // Run validation checks
    this.validateSchema(digest, result);
    this.validateCompleteness(digest, result);
    this.validateQuality(digest, result);
    this.validateConsistency(digest, result);

    // Platform-specific validation
    this.validatePlatformSpecific(digest, result);

    // Calculate metrics
    this.calculateMetrics(result, digest);

    // Calculate final score
    result.score = this.calculateScore(result);
    result.valid = result.errors.length === 0 && result.score >= 60;

    this.logger.info(
      `Validation complete: ${result.valid ? 'PASS' : 'FAIL'} ` +
      `(Score: ${result.score}/100, Errors: ${result.errors.length}, ` +
      `Warnings: ${result.warnings.length})`
    );

    return result;
  }

  /**
   * Validate digest schema
   */
  validateSchema(digest, result) {
    const { platform, data, metadata } = digest;

    // Check platform specified
    if (!platform && !metadata?.platform) {
      result.errors.push({
        type: 'schema',
        message: 'Platform not specified',
        severity: 'error'
      });
      return;
    }

    // Check required fields
    const requiredFields = this.requiredFields[platform] || [];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!data || !data[field]) {
        missingFields.push(field);
      }
    }

    if (missingFields.length > 0) {
      result.errors.push({
        type: 'schema',
        message: `Missing required fields: ${missingFields.join(', ')}`,
        severity: 'error',
        fields: missingFields
      });
    }

    // Check metadata
    if (!metadata) {
      result.warnings.push({
        type: 'schema',
        message: 'No metadata provided',
        severity: 'warning'
      });
    } else {
      // Check important metadata fields
      if (!metadata.version) {
        result.warnings.push({
          type: 'schema',
          message: 'No version specified in metadata',
          severity: 'warning'
        });
      }

      if (!metadata.generatedAt && !metadata.timestamp) {
        result.warnings.push({
          type: 'schema',
          message: 'No generation timestamp',
          severity: 'warning'
        });
      }
    }
  }

  /**
   * Validate digest completeness
   */
  validateCompleteness(digest, result) {
    const { platform, data } = digest;

    if (!data) {
      return; // Already caught in schema validation
    }

    // Backend completeness
    if (platform === 'backend') {
      this.validateBackendCompleteness(data, result);
    }

    // Frontend completeness (User App, Driver App)
    if (platform === 'user-app' || platform === 'driver-app') {
      this.validateFrontendCompleteness(data, result);
    }

    // Admin dashboard completeness
    if (platform === 'admin-dashboard') {
      this.validateAdminCompleteness(data, result);
    }
  }

  /**
   * Validate backend digest completeness
   */
  validateBackendCompleteness(data, result) {
    // Check routes
    if (!data.routes || data.routes.length === 0) {
      result.warnings.push({
        type: 'completeness',
        message: 'No routes defined',
        severity: 'warning'
      });
    } else {
      // Validate route structure
      for (let i = 0; i < data.routes.length; i++) {
        const route = data.routes[i];
        if (!route.method || !route.path) {
          result.errors.push({
            type: 'completeness',
            message: `Route ${i} missing method or path`,
            severity: 'error',
            route: i
          });
        }

        if (!route.handler) {
          result.warnings.push({
            type: 'completeness',
            message: `Route ${i} (${route.method} ${route.path}) missing handler`,
            severity: 'warning',
            route: i
          });
        }
      }
    }

    // Check models
    if (!data.models || data.models.length === 0) {
      result.warnings.push({
        type: 'completeness',
        message: 'No models defined',
        severity: 'warning'
      });
    } else {
      // Validate model structure
      for (let i = 0; i < data.models.length; i++) {
        const model = data.models[i];
        if (!model.name) {
          result.errors.push({
            type: 'completeness',
            message: `Model ${i} missing name`,
            severity: 'error',
            model: i
          });
        }

        if (!model.fields || model.fields.length === 0) {
          result.warnings.push({
            type: 'completeness',
            message: `Model ${model.name || i} has no fields`,
            severity: 'warning',
            model: i
          });
        }
      }
    }
  }

  /**
   * Validate frontend digest completeness
   */
  validateFrontendCompleteness(data, result) {
    // Check screens
    if (!data.screens || data.screens.length === 0) {
      result.warnings.push({
        type: 'completeness',
        message: 'No screens defined',
        severity: 'warning'
      });
    } else {
      // Validate screen structure
      for (let i = 0; i < data.screens.length; i++) {
        const screen = data.screens[i];
        if (!screen.name && !screen.route) {
          result.errors.push({
            type: 'completeness',
            message: `Screen ${i} missing name and route`,
            severity: 'error',
            screen: i
          });
        }
      }
    }

    // Check widgets
    if (!data.widgets || data.widgets.length === 0) {
      result.suggestions.push({
        type: 'completeness',
        message: 'No widgets defined. Consider defining reusable widgets.',
        severity: 'info'
      });
    }

    // Check navigation
    if (!data.navigation) {
      result.warnings.push({
        type: 'completeness',
        message: 'No navigation structure defined',
        severity: 'warning'
      });
    }

    // Check state management
    if (!data.state) {
      result.warnings.push({
        type: 'completeness',
        message: 'No state management defined',
        severity: 'warning'
      });
    }
  }

  /**
   * Validate admin dashboard digest completeness
   */
  validateAdminCompleteness(data, result) {
    // Check pages
    if (!data.pages || data.pages.length === 0) {
      result.warnings.push({
        type: 'completeness',
        message: 'No pages defined',
        severity: 'warning'
      });
    }

    // Check components
    if (!data.components || data.components.length === 0) {
      result.suggestions.push({
        type: 'completeness',
        message: 'No components defined. Consider defining reusable components.',
        severity: 'info'
      });
    }

    // Check API integration
    if (!data.api) {
      result.warnings.push({
        type: 'completeness',
        message: 'No API integration defined',
        severity: 'warning'
      });
    }
  }

  /**
   * Validate digest quality
   */
  validateQuality(digest, result) {
    const { data } = digest;

    if (!data) return;

    // Check for detail level
    let totalItems = 0;
    let itemsWithDetails = 0;

    // Count items with descriptions/details
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        for (const item of data[key]) {
          totalItems++;
          if (item.description || item.details || item.purpose) {
            itemsWithDetails++;
          }
        }
      }
    }

    if (totalItems > 0) {
      const detailRatio = itemsWithDetails / totalItems;
      if (detailRatio < 0.5) {
        result.warnings.push({
          type: 'quality',
          message: `Only ${Math.round(detailRatio * 100)}% of items have descriptions. Consider adding more detail.`,
          severity: 'warning',
          detailRatio
        });
      }
    }

    // Check for examples
    let hasExamples = false;
    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        for (const item of data[key]) {
          if (item.example || item.examples || item.codeExample) {
            hasExamples = true;
            break;
          }
        }
      }
      if (hasExamples) break;
    }

    if (!hasExamples && totalItems > 0) {
      result.suggestions.push({
        type: 'quality',
        message: 'No code examples found. Consider adding usage examples.',
        severity: 'info'
      });
    }
  }

  /**
   * Validate digest consistency
   */
  validateConsistency(digest, result) {
    const { platform, data } = digest;

    if (!data) return;

    // Check naming conventions
    const namingIssues = this.validateNamingConventions(data, platform);
    if (namingIssues.length > 0) {
      result.suggestions.push({
        type: 'consistency',
        message: 'Naming convention inconsistencies detected',
        severity: 'info',
        issues: namingIssues
      });
    }

    // Check for duplicate names
    const duplicates = this.findDuplicates(data);
    if (duplicates.length > 0) {
      result.warnings.push({
        type: 'consistency',
        message: 'Duplicate names detected',
        severity: 'warning',
        duplicates
      });
    }
  }

  /**
   * Platform-specific validation
   */
  validatePlatformSpecific(digest, result) {
    const { platform, data } = digest;

    if (platform === 'backend') {
      // Check for RESTful conventions
      if (data.routes) {
        for (const route of data.routes) {
          if (route.method && route.path) {
            // Check for common REST issues
            if (route.method === 'GET' && route.path.includes('create')) {
              result.warnings.push({
                type: 'platform',
                message: `GET route should not contain 'create': ${route.path}`,
                severity: 'warning',
                route: route.path
              });
            }
          }
        }
      }
    }

    if (platform === 'user-app' || platform === 'driver-app') {
      // Check for Flutter-specific conventions
      if (data.widgets) {
        for (const widget of data.widgets) {
          if (widget.name && !widget.name.endsWith('Widget')) {
            result.suggestions.push({
              type: 'platform',
              message: `Widget name should end with 'Widget': ${widget.name}`,
              severity: 'info',
              widget: widget.name
            });
          }
        }
      }
    }

    if (platform === 'admin-dashboard') {
      // Check for React-specific conventions
      if (data.components) {
        for (const component of data.components) {
          if (component.name) {
            // Check PascalCase for React components
            if (component.name[0] !== component.name[0].toUpperCase()) {
              result.warnings.push({
                type: 'platform',
                message: `React component should be PascalCase: ${component.name}`,
                severity: 'warning',
                component: component.name
              });
            }
          }
        }
      }
    }
  }

  /**
   * Calculate metrics
   */
  calculateMetrics(result, digest) {
    const { data } = digest;

    // Completeness: Based on presence of required fields and data
    const schemaErrors = result.errors.filter(e => e.type === 'schema' || e.type === 'completeness');
    result.metrics.completeness = Math.max(0, 100 - (schemaErrors.length * 15));

    // Quality: Based on detail level and examples
    const qualityWarnings = result.warnings.filter(w => w.type === 'quality');
    result.metrics.quality = Math.max(0, 100 - (qualityWarnings.length * 15));

    // Consistency: Based on naming and duplicates
    const consistencyIssues = [
      ...result.warnings.filter(w => w.type === 'consistency'),
      ...result.suggestions.filter(s => s.type === 'consistency')
    ];
    result.metrics.consistency = Math.max(0, 100 - (consistencyIssues.length * 10));

    // Implementability: Can developers actually build from this digest?
    let implementability = 100;
    if (data) {
      let totalItems = 0;
      let itemsWithEnoughInfo = 0;

      for (const key of Object.keys(data)) {
        if (Array.isArray(data[key])) {
          for (const item of data[key]) {
            totalItems++;
            // Check if item has enough info to implement
            const hasName = item.name || item.route || item.path;
            const hasDetails = item.description || item.details || item.purpose || item.handler;
            if (hasName && hasDetails) {
              itemsWithEnoughInfo++;
            }
          }
        }
      }

      if (totalItems > 0) {
        implementability = Math.round((itemsWithEnoughInfo / totalItems) * 100);
      }
    }
    result.metrics.implementability = implementability;
  }

  /**
   * Calculate overall score
   */
  calculateScore(result) {
    const { metrics } = result;

    // Weighted average
    const weights = {
      completeness: 0.35,
      quality: 0.25,
      consistency: 0.15,
      implementability: 0.25
    };

    let score = 0;
    score += metrics.completeness * weights.completeness;
    score += metrics.quality * weights.quality;
    score += metrics.consistency * weights.consistency;
    score += metrics.implementability * weights.implementability;

    // Penalties
    score -= result.errors.length * 12;
    score -= result.warnings.length * 4;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Validate naming conventions
   */
  validateNamingConventions(data, platform) {
    const issues = [];

    // Platform-specific conventions
    const conventions = {
      'backend': {
        routes: /^[a-z][a-zA-Z0-9]*$/,  // camelCase
        models: /^[A-Z][a-zA-Z0-9]*$/   // PascalCase
      },
      'user-app': {
        screens: /^[A-Z][a-zA-Z0-9]*Screen$/,  // PascalCase + Screen
        widgets: /^[A-Z][a-zA-Z0-9]*Widget$/   // PascalCase + Widget
      },
      'driver-app': {
        screens: /^[A-Z][a-zA-Z0-9]*Screen$/,
        widgets: /^[A-Z][a-zA-Z0-9]*Widget$/
      },
      'admin-dashboard': {
        pages: /^[A-Z][a-zA-Z0-9]*$/,         // PascalCase
        components: /^[A-Z][a-zA-Z0-9]*$/     // PascalCase
      }
    };

    const platformConventions = conventions[platform] || {};

    for (const [key, pattern] of Object.entries(platformConventions)) {
      if (data[key] && Array.isArray(data[key])) {
        for (const item of data[key]) {
          const name = item.name || item.handler;
          if (name && !pattern.test(name)) {
            issues.push({
              category: key,
              name,
              message: `${key} name doesn't follow convention: ${name}`
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Find duplicate names
   */
  findDuplicates(data) {
    const duplicates = [];
    const seen = new Map();

    for (const key of Object.keys(data)) {
      if (Array.isArray(data[key])) {
        for (const item of data[key]) {
          const name = item.name || item.route || item.path;
          if (name) {
            const fullKey = `${key}:${name}`;
            if (seen.has(fullKey)) {
              duplicates.push({
                category: key,
                name,
                message: `Duplicate ${key} name: ${name}`
              });
            }
            seen.set(fullKey, true);
          }
        }
      }
    }

    return duplicates;
  }

  /**
   * Validate cross-platform consistency
   *
   * @param {Object[]} digests - Array of digests from different platforms
   * @returns {Object} Consistency validation result
   */
  validateCrossPlatform(digests) {
    this.logger.info('Validating cross-platform consistency...');

    const result = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: []
    };

    // Check for model consistency across platforms
    const backendDigest = digests.find(d => d.platform === 'backend');
    const frontendDigests = digests.filter(d =>
      d.platform === 'user-app' || d.platform === 'driver-app' || d.platform === 'admin-dashboard'
    );

    if (backendDigest && frontendDigests.length > 0) {
      const backendModels = backendDigest.data?.models || [];
      const backendModelNames = backendModels.map(m => m.name);

      for (const frontendDigest of frontendDigests) {
        const frontendModels = frontendDigest.data?.models || [];
        const frontendModelNames = frontendModels.map(m => m.name);

        // Check for models in frontend that don't exist in backend
        for (const modelName of frontendModelNames) {
          if (!backendModelNames.includes(modelName)) {
            result.warnings.push({
              type: 'consistency',
              message: `Model ${modelName} used in ${frontendDigest.platform} but not defined in backend`,
              severity: 'warning',
              platform: frontendDigest.platform,
              model: modelName
            });
          }
        }
      }
    }

    result.valid = result.errors.length === 0;

    this.logger.info(
      `Cross-platform validation complete: ${result.valid ? 'PASS' : 'FAIL'} ` +
      `(Errors: ${result.errors.length}, Warnings: ${result.warnings.length})`
    );

    return result;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of DigestValidator
 * @returns {DigestValidator}
 */
export function getDigestValidator() {
  if (!instance) {
    instance = new DigestValidator();
  }
  return instance;
}

export { DigestValidator };
export default DigestValidator;
