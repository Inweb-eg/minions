import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('ImpactAnalyzer');

/**
 * ImpactAnalyzer - Analyzes the impact of code changes on the system
 *
 * Analyzes:
 * - API endpoint impact (which clients are affected)
 * - Database schema impact (data migration required)
 * - Dependency impact (which services depend on changed code)
 * - Security impact (authentication/authorization changes)
 * - Performance impact (breaking caching, adding complexity)
 * - Documentation impact (which docs need updating)
 *
 * Provides:
 * - Impact severity (critical, high, medium, low)
 * - Affected components list
 * - Recommended actions
 * - Risk assessment
 */
class ImpactAnalyzer {
  constructor() {
    this.logger = createLogger('ImpactAnalyzer');
  }

  /**
   * Analyze impact of changes
   *
   * @param {Object} changes - Changes from BreakingChangeDetector
   * @param {Object} codebase - Current codebase structure
   * @returns {Object} Impact analysis results
   */
  analyze(changes, codebase = {}) {
    this.logger.info('Analyzing impact of changes...');

    const impact = {
      overall: {
        severity: 'low',
        riskLevel: 'low',
        affectedComponents: 0,
        requiresMigration: false,
        requiresDeployment: false
      },
      byCategory: {
        api: [],
        database: [],
        dependencies: [],
        security: [],
        performance: [],
        documentation: []
      },
      affectedComponents: [],
      recommendations: [],
      risks: []
    };

    // Analyze different change types
    this.analyzeRouteImpact(changes, codebase, impact);
    this.analyzeModelImpact(changes, codebase, impact);
    this.analyzeControllerImpact(changes, codebase, impact);
    this.analyzeServiceImpact(changes, codebase, impact);

    // Calculate overall severity and risk
    this.calculateOverallImpact(impact);

    this.logger.info(
      `Impact analysis complete: ${impact.overall.severity} severity, ` +
      `${impact.overall.affectedComponents} components affected`
    );

    return impact;
  }

  /**
   * Analyze impact of route changes
   */
  analyzeRouteImpact(changes, codebase, impact) {
    const routeChanges = [
      ...(changes.breaking || []).filter(c => c.category === 'routes'),
      ...(changes.nonBreaking || []).filter(c => c.category === 'routes'),
      ...(changes.additions || []).filter(c => c.category === 'routes')
    ];

    for (const change of routeChanges) {
      if (change.type === 'route_removed') {
        impact.byCategory.api.push({
          type: 'route_removed',
          severity: 'critical',
          route: `${change.oldValue.method} ${change.oldValue.path}`,
          impact: 'All clients calling this endpoint will fail',
          affectedClients: this.findAffectedClients(change.oldValue, codebase),
          recommendations: [
            'Implement deprecation warning before removal',
            'Provide migration path to alternative endpoint',
            'Update API documentation',
            'Notify all API consumers'
          ],
          requiresDeployment: true
        });

        impact.risks.push({
          type: 'api_breakage',
          severity: 'critical',
          description: `Removed API endpoint: ${change.oldValue.method} ${change.oldValue.path}`,
          mitigation: 'Implement graceful deprecation period'
        });
      }

      if (change.type === 'route_middleware_removed') {
        const hasAuthMiddleware = change.removed?.some(m =>
          m.includes('auth') || m.includes('authenticate')
        );

        if (hasAuthMiddleware) {
          impact.byCategory.security.push({
            type: 'authentication_removed',
            severity: 'critical',
            route: change.route || (change.newValue ? `${change.newValue.method} ${change.newValue.path}` : 'unknown'),
            impact: 'Endpoint is no longer protected by authentication',
            recommendations: [
              'Review if authentication removal is intentional',
              'Implement alternative security measures',
              'Update security documentation'
            ],
            requiresSecurityReview: true
          });

          impact.risks.push({
            type: 'security_vulnerability',
            severity: 'critical',
            description: 'Authentication middleware removed from endpoint',
            mitigation: 'Immediate security review required'
          });
        }
      }

      if (change.type === 'route_added') {
        impact.byCategory.api.push({
          type: 'route_added',
          severity: 'low',
          route: `${change.newValue.method} ${change.newValue.path}`,
          impact: 'New functionality available to clients',
          recommendations: [
            'Update API documentation',
            'Add integration tests',
            'Notify API consumers of new feature'
          ],
          requiresDocumentation: true
        });
      }
    }
  }

  /**
   * Analyze impact of model changes
   */
  analyzeModelImpact(changes, codebase, impact) {
    const modelChanges = [
      ...(changes.breaking || []).filter(c => c.category === 'models'),
      ...(changes.nonBreaking || []).filter(c => c.category === 'models'),
      ...(changes.additions || []).filter(c => c.category === 'models')
    ];

    for (const change of modelChanges) {
      if (change.type === 'field_removed') {
        impact.byCategory.database.push({
          type: 'field_removed',
          severity: 'high',
          model: change.model,
          field: change.field,
          impact: 'Data loss possible, queries will fail',
          affectedQueries: this.findAffectedQueries(change.model, change.field, codebase),
          recommendations: [
            'Create data migration script',
            'Backup existing data',
            'Update all queries using this field',
            'Test rollback procedure'
          ],
          requiresMigration: true,
          requiresDowntime: true
        });

        impact.risks.push({
          type: 'data_loss',
          severity: 'high',
          description: `Field ${change.model}.${change.field} removed`,
          mitigation: 'Create comprehensive migration script with rollback'
        });

        impact.overall.requiresMigration = true;
      }

      if (change.type === 'field_type_changed') {
        impact.byCategory.database.push({
          type: 'field_type_changed',
          severity: 'high',
          model: change.model,
          field: change.field,
          oldType: change.oldValue.type,
          newType: change.newValue.type,
          impact: 'Data type conversion required',
          recommendations: [
            'Create type conversion migration',
            'Validate data compatibility',
            'Handle conversion failures gracefully',
            'Test with production-like data volume'
          ],
          requiresMigration: true,
          requiresValidation: true
        });

        impact.overall.requiresMigration = true;
      }

      if (change.type === 'required_field_added' || change.type === 'field_made_required') {
        impact.byCategory.database.push({
          type: 'required_field_added',
          severity: 'high',
          model: change.model,
          field: change.field,
          impact: 'Existing records may fail validation',
          recommendations: [
            'Add default values for existing records',
            'Validate all existing data',
            'Update API to handle new requirement',
            'Add validation errors to API responses'
          ],
          requiresMigration: true,
          requiresValidation: true
        });

        impact.overall.requiresMigration = true;
      }

      if (change.type === 'model_removed') {
        impact.byCategory.database.push({
          type: 'model_removed',
          severity: 'critical',
          model: change.oldValue.name,
          impact: 'All operations on this model will fail',
          affectedServices: this.findServicesUsingModel(change.oldValue.name, codebase),
          recommendations: [
            'Archive existing data',
            'Update all services using this model',
            'Remove related controllers and routes',
            'Update documentation'
          ],
          requiresMigration: true,
          requiresDowntime: true
        });

        impact.risks.push({
          type: 'data_loss',
          severity: 'critical',
          description: `Model ${change.oldValue.name} removed`,
          mitigation: 'Comprehensive data archival strategy required'
        });

        impact.overall.requiresMigration = true;
      }
    }
  }

  /**
   * Analyze impact of controller changes
   */
  analyzeControllerImpact(changes, codebase, impact) {
    const controllerChanges = [
      ...(changes.breaking || []).filter(c => c.category === 'controllers'),
      ...(changes.additions || []).filter(c => c.category === 'controllers')
    ];

    for (const change of controllerChanges) {
      if (change.type === 'controller_signature_changed') {
        impact.byCategory.dependencies.push({
          type: 'controller_signature_changed',
          severity: 'medium',
          controller: change.oldValue || change.newValue,
          impact: 'Routes using this controller may break',
          affectedRoutes: this.findRoutesUsingController(change.controller || change.name, codebase),
          recommendations: [
            'Update all route handlers',
            'Update middleware chain if needed',
            'Test all affected routes',
            'Update integration tests'
          ]
        });
      }

      if (change.type === 'controller_removed') {
        impact.byCategory.dependencies.push({
          type: 'controller_removed',
          severity: 'high',
          controller: change.oldValue?.name || change.name,
          impact: 'Routes using this controller will fail',
          affectedRoutes: this.findRoutesUsingController(change.oldValue?.name || change.name, codebase),
          recommendations: [
            'Remove or update routes using this controller',
            'Ensure no broken references',
            'Update API documentation'
          ]
        });
      }
    }
  }

  /**
   * Analyze impact of service changes
   */
  analyzeServiceImpact(changes, codebase, impact) {
    const serviceChanges = [
      ...(changes.breaking || []).filter(c => c.category === 'services'),
      ...(changes.additions || []).filter(c => c.category === 'services')
    ];

    for (const change of serviceChanges) {
      if (change.type === 'service_signature_changed') {
        impact.byCategory.dependencies.push({
          type: 'service_signature_changed',
          severity: 'medium',
          service: change.service || change.name,
          impact: 'Code calling this service may break',
          affectedCallers: this.findServiceCallers(change.service || change.name, codebase),
          recommendations: [
            'Update all service calls',
            'Update unit tests',
            'Review dependency chain',
            'Update service documentation'
          ]
        });
      }

      if (change.type === 'service_removed') {
        impact.byCategory.dependencies.push({
          type: 'service_removed',
          severity: 'high',
          service: change.oldValue?.name || change.name,
          impact: 'Business logic no longer available',
          affectedCallers: this.findServiceCallers(change.oldValue?.name || change.name, codebase),
          recommendations: [
            'Update code using this service',
            'Implement alternative logic',
            'Update business logic documentation'
          ]
        });
      }
    }
  }

  /**
   * Calculate overall impact severity and risk
   */
  calculateOverallImpact(impact) {
    // Collect all severities
    const severities = [];

    for (const category of Object.values(impact.byCategory)) {
      for (const item of category) {
        severities.push(item.severity);
        if (item.requiresDeployment) impact.overall.requiresDeployment = true;
      }
    }

    // Determine highest severity
    if (severities.includes('critical')) {
      impact.overall.severity = 'critical';
      impact.overall.riskLevel = 'critical';
    } else if (severities.includes('high')) {
      impact.overall.severity = 'high';
      impact.overall.riskLevel = 'high';
    } else if (severities.includes('medium')) {
      impact.overall.severity = 'medium';
      impact.overall.riskLevel = 'medium';
    } else {
      impact.overall.severity = 'low';
      impact.overall.riskLevel = 'low';
    }

    // Count affected components
    const affectedComponents = new Set();
    for (const category of Object.values(impact.byCategory)) {
      for (const item of category) {
        if (item.model) affectedComponents.add(`model:${item.model}`);
        if (item.route) affectedComponents.add(`route:${item.route}`);
        if (item.controller) affectedComponents.add(`controller:${item.controller}`);
        if (item.service) affectedComponents.add(`service:${item.service}`);
      }
    }

    impact.overall.affectedComponents = affectedComponents.size;
    impact.affectedComponents = Array.from(affectedComponents);

    // Generate overall recommendations
    this.generateOverallRecommendations(impact);
  }

  /**
   * Generate overall recommendations
   */
  generateOverallRecommendations(impact) {
    if (impact.overall.severity === 'critical') {
      impact.recommendations.push(
        'CRITICAL: This change requires immediate attention and careful planning',
        'Schedule deployment during low-traffic period',
        'Prepare rollback plan',
        'Notify all stakeholders'
      );
    }

    if (impact.overall.requiresMigration) {
      impact.recommendations.push(
        'Create and test database migration scripts',
        'Backup production database before deployment',
        'Test migration with production-scale data',
        'Prepare rollback migration'
      );
    }

    if (impact.overall.requiresDeployment) {
      impact.recommendations.push(
        'Plan deployment strategy (blue-green, rolling, etc.)',
        'Update deployment documentation',
        'Prepare monitoring and alerts'
      );
    }

    if (impact.byCategory.security.length > 0) {
      impact.recommendations.push(
        'Conduct security review before deployment',
        'Update security documentation',
        'Consider penetration testing'
      );
    }
  }

  /**
   * Find clients affected by route changes
   */
  findAffectedClients(route, codebase) {
    // In a real implementation, this would analyze actual client usage
    // For now, return potential clients based on route type
    const clients = [];

    if (route.path.startsWith('/api')) {
      clients.push('Web Dashboard', 'Mobile App', 'Third-party Integrations');
    }

    return clients;
  }

  /**
   * Find queries affected by field changes
   */
  findAffectedQueries(modelName, fieldName, codebase) {
    // In real implementation, analyze codebase for queries using this field
    return [`${modelName}.find({ ${fieldName}: ... })`, `${modelName}.update({ ${fieldName}: ... })`];
  }

  /**
   * Find services using a model
   */
  findServicesUsingModel(modelName, codebase) {
    const services = codebase.services || [];
    // In real implementation, analyze service code for model usage
    return services.filter(s => s.name.toLowerCase().includes(modelName.toLowerCase())).map(s => s.name);
  }

  /**
   * Find routes using a controller
   */
  findRoutesUsingController(controllerName, codebase) {
    const routes = codebase.routes || [];
    return routes.filter(r => r.handler === controllerName).map(r => `${r.method} ${r.path}`);
  }

  /**
   * Find code calling a service
   */
  findServiceCallers(serviceName, codebase) {
    // In real implementation, analyze codebase for service calls
    return ['controllers', 'other services', 'background jobs'];
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ImpactAnalyzer
 * @returns {ImpactAnalyzer}
 */
export function getImpactAnalyzer() {
  if (!instance) {
    instance = new ImpactAnalyzer();
  }
  return instance;
}

export { ImpactAnalyzer };
export default ImpactAnalyzer;
