import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('BreakingChangeDetector');

/**
 * BreakingChangeDetector - Detects breaking changes between code versions
 *
 * Detects:
 * - API endpoint changes (removed routes, changed methods, path changes)
 * - Model schema changes (removed fields, type changes, required field changes)
 * - Controller signature changes
 * - Service method signature changes
 * - Breaking changes in API contracts
 *
 * Target: 95%+ detection accuracy as per Phase 2.2 requirements
 */
class BreakingChangeDetector {
  constructor() {
    this.logger = createLogger('BreakingChangeDetector');
  }

  /**
   * Detect breaking changes between two parsed code structures
   *
   * @param {Object} oldCode - Previous code structure from BackendCodeParser
   * @param {Object} newCode - Current code structure from BackendCodeParser
   * @returns {Object} Detected breaking changes with severity
   */
  detect(oldCode, newCode) {
    this.logger.info('Detecting breaking changes...');

    const changes = {
      breaking: [],
      nonBreaking: [],
      additions: [],
      summary: {
        total: 0,
        breaking: 0,
        nonBreaking: 0,
        additions: 0
      }
    };

    // Detect route changes
    this.detectRouteChanges(oldCode.routes || [], newCode.routes || [], changes);

    // Detect model changes
    this.detectModelChanges(oldCode.models || [], newCode.models || [], changes);

    // Detect controller changes
    this.detectControllerChanges(oldCode.controllers || [], newCode.controllers || [], changes);

    // Detect service changes
    this.detectServiceChanges(oldCode.services || [], newCode.services || [], changes);

    // Calculate summary
    changes.summary.breaking = changes.breaking.length;
    changes.summary.nonBreaking = changes.nonBreaking.length;
    changes.summary.additions = changes.additions.length;
    changes.summary.total = changes.summary.breaking + changes.summary.nonBreaking + changes.summary.additions;

    this.logger.info(
      `Detected ${changes.summary.total} changes: ` +
      `${changes.summary.breaking} breaking, ` +
      `${changes.summary.nonBreaking} non-breaking, ` +
      `${changes.summary.additions} additions`
    );

    return changes;
  }

  /**
   * Detect route changes
   */
  detectRouteChanges(oldRoutes, newRoutes, changes) {
    // Build maps for efficient lookup
    const oldRouteMap = this.buildRouteMap(oldRoutes);
    const newRouteMap = this.buildRouteMap(newRoutes);

    // Check for removed routes (BREAKING)
    for (const [key, oldRoute] of oldRouteMap.entries()) {
      if (!newRouteMap.has(key)) {
        changes.breaking.push({
          type: 'route_removed',
          severity: 'breaking',
          category: 'routes',
          message: `Route removed: ${oldRoute.method} ${oldRoute.path}`,
          oldValue: oldRoute,
          newValue: null,
          impact: 'Clients calling this endpoint will receive 404 errors',
          recommendation: 'Deprecate endpoint first or provide migration path'
        });
      }
    }

    // Check for route changes
    for (const [key, newRoute] of newRouteMap.entries()) {
      const oldRoute = oldRouteMap.get(key);

      if (!oldRoute) {
        // New route added (ADDITION)
        changes.additions.push({
          type: 'route_added',
          severity: 'addition',
          category: 'routes',
          message: `Route added: ${newRoute.method} ${newRoute.path}`,
          oldValue: null,
          newValue: newRoute,
          impact: 'No breaking change, new functionality available',
          recommendation: 'Update API documentation'
        });
      } else {
        // Check for handler changes (NON-BREAKING but important)
        if (oldRoute.handler !== newRoute.handler) {
          changes.nonBreaking.push({
            type: 'route_handler_changed',
            severity: 'non-breaking',
            category: 'routes',
            message: `Route handler changed: ${newRoute.method} ${newRoute.path}`,
            oldValue: { handler: oldRoute.handler },
            newValue: { handler: newRoute.handler },
            impact: 'Implementation changed, behavior may differ',
            recommendation: 'Review handler logic and update tests'
          });
        }

        // Check for middleware changes (POTENTIALLY BREAKING)
        const middlewareChanged = !this.arraysEqual(
          oldRoute.middleware || [],
          newRoute.middleware || []
        );

        if (middlewareChanged) {
          const oldMiddleware = oldRoute.middleware || [];
          const newMiddleware = newRoute.middleware || [];

          // Removed middleware could be breaking (e.g., auth removed)
          const removedMiddleware = oldMiddleware.filter(m => !newMiddleware.includes(m));
          if (removedMiddleware.length > 0) {
            changes.breaking.push({
              type: 'route_middleware_removed',
              severity: 'breaking',
              category: 'routes',
              message: `Middleware removed from route: ${newRoute.method} ${newRoute.path}`,
              oldValue: { middleware: oldMiddleware },
              newValue: { middleware: newMiddleware },
              removed: removedMiddleware,
              impact: 'Security or validation may be compromised',
              recommendation: 'Review if middleware removal is intentional'
            });
          }

          // Added middleware is non-breaking
          const addedMiddleware = newMiddleware.filter(m => !oldMiddleware.includes(m));
          if (addedMiddleware.length > 0) {
            changes.nonBreaking.push({
              type: 'route_middleware_added',
              severity: 'non-breaking',
              category: 'routes',
              message: `Middleware added to route: ${newRoute.method} ${newRoute.path}`,
              oldValue: { middleware: oldMiddleware },
              newValue: { middleware: newMiddleware },
              added: addedMiddleware,
              impact: 'Additional validation or processing added',
              recommendation: 'Update API documentation if behavior changes'
            });
          }
        }
      }
    }
  }

  /**
   * Detect model changes
   */
  detectModelChanges(oldModels, newModels, changes) {
    const oldModelMap = this.buildModelMap(oldModels);
    const newModelMap = this.buildModelMap(newModels);

    // Check for removed models (BREAKING)
    for (const [name, oldModel] of oldModelMap.entries()) {
      if (!newModelMap.has(name)) {
        changes.breaking.push({
          type: 'model_removed',
          severity: 'breaking',
          category: 'models',
          message: `Model removed: ${name}`,
          oldValue: oldModel,
          newValue: null,
          impact: 'Database operations will fail for this model',
          recommendation: 'Provide data migration path'
        });
      }
    }

    // Check for model changes
    for (const [name, newModel] of newModelMap.entries()) {
      const oldModel = oldModelMap.get(name);

      if (!oldModel) {
        // New model (ADDITION)
        changes.additions.push({
          type: 'model_added',
          severity: 'addition',
          category: 'models',
          message: `Model added: ${name}`,
          oldValue: null,
          newValue: newModel,
          impact: 'New data structure available',
          recommendation: 'Update API documentation'
        });
      } else if (oldModel.type === 'schema' && newModel.type === 'schema') {
        // Check field changes
        this.detectFieldChanges(oldModel, newModel, name, changes);
      }
    }
  }

  /**
   * Detect field changes in schema
   */
  detectFieldChanges(oldModel, newModel, modelName, changes) {
    const oldFields = oldModel.fields || [];
    const newFields = newModel.fields || [];

    const oldFieldMap = new Map(oldFields.map(f => [f.name, f]));
    const newFieldMap = new Map(newFields.map(f => [f.name, f]));

    // Check for removed fields (BREAKING)
    for (const [fieldName, oldField] of oldFieldMap.entries()) {
      if (!newFieldMap.has(fieldName)) {
        changes.breaking.push({
          type: 'field_removed',
          severity: 'breaking',
          category: 'models',
          message: `Field removed from model ${modelName}: ${fieldName}`,
          oldValue: oldField,
          newValue: null,
          model: modelName,
          field: fieldName,
          impact: 'Data queries and API responses will not include this field',
          recommendation: 'Deprecate field first or provide migration'
        });
      }
    }

    // Check for field changes
    for (const [fieldName, newField] of newFieldMap.entries()) {
      const oldField = oldFieldMap.get(fieldName);

      if (!oldField) {
        // Check if new field is required (POTENTIALLY BREAKING)
        if (newField.required) {
          changes.breaking.push({
            type: 'required_field_added',
            severity: 'breaking',
            category: 'models',
            message: `Required field added to model ${modelName}: ${fieldName}`,
            oldValue: null,
            newValue: newField,
            model: modelName,
            field: fieldName,
            impact: 'Existing records may not satisfy new requirement',
            recommendation: 'Add default value or migration script'
          });
        } else {
          // Optional field added (NON-BREAKING)
          changes.additions.push({
            type: 'field_added',
            severity: 'addition',
            category: 'models',
            message: `Field added to model ${modelName}: ${fieldName}`,
            oldValue: null,
            newValue: newField,
            model: modelName,
            field: fieldName,
            impact: 'New optional field available',
            recommendation: 'Update API documentation'
          });
        }
      } else {
        // Check for type changes (BREAKING)
        if (oldField.type !== newField.type) {
          changes.breaking.push({
            type: 'field_type_changed',
            severity: 'breaking',
            category: 'models',
            message: `Field type changed in model ${modelName}.${fieldName}: ${oldField.type} → ${newField.type}`,
            oldValue: { type: oldField.type },
            newValue: { type: newField.type },
            model: modelName,
            field: fieldName,
            impact: 'Data validation and storage format changed',
            recommendation: 'Provide data migration script'
          });
        }

        // Check for required status changes (POTENTIALLY BREAKING)
        if (!oldField.required && newField.required) {
          changes.breaking.push({
            type: 'field_made_required',
            severity: 'breaking',
            category: 'models',
            message: `Field made required in model ${modelName}.${fieldName}`,
            oldValue: { required: false },
            newValue: { required: true },
            model: modelName,
            field: fieldName,
            impact: 'Existing records may not satisfy new requirement',
            recommendation: 'Add default values for existing records'
          });
        } else if (oldField.required && !newField.required) {
          changes.nonBreaking.push({
            type: 'field_made_optional',
            severity: 'non-breaking',
            category: 'models',
            message: `Field made optional in model ${modelName}.${fieldName}`,
            oldValue: { required: true },
            newValue: { required: false },
            model: modelName,
            field: fieldName,
            impact: 'Field validation relaxed',
            recommendation: 'Update API documentation'
          });
        }
      }
    }
  }

  /**
   * Detect controller changes
   */
  detectControllerChanges(oldControllers, newControllers, changes) {
    const oldMap = new Map(oldControllers.map(c => [c.name, c]));
    const newMap = new Map(newControllers.map(c => [c.name, c]));

    // Check for removed controllers (BREAKING)
    for (const [name, oldController] of oldMap.entries()) {
      if (!newMap.has(name)) {
        changes.breaking.push({
          type: 'controller_removed',
          severity: 'breaking',
          category: 'controllers',
          message: `Controller removed: ${name}`,
          oldValue: oldController,
          newValue: null,
          impact: 'Routes using this controller will fail',
          recommendation: 'Update routes or restore controller'
        });
      }
    }

    // Check for controller changes
    for (const [name, newController] of newMap.entries()) {
      const oldController = oldMap.get(name);

      if (!oldController) {
        changes.additions.push({
          type: 'controller_added',
          severity: 'addition',
          category: 'controllers',
          message: `Controller added: ${name}`,
          oldValue: null,
          newValue: newController,
          impact: 'New request handler available',
          recommendation: 'Update API documentation'
        });
      } else {
        // Check for parameter changes (BREAKING)
        if (!this.arraysEqual(oldController.params, newController.params)) {
          changes.breaking.push({
            type: 'controller_signature_changed',
            severity: 'breaking',
            category: 'controllers',
            message: `Controller signature changed: ${name}`,
            oldValue: { params: oldController.params },
            newValue: { params: newController.params },
            impact: 'Controller behavior may have changed',
            recommendation: 'Review and test controller logic'
          });
        }
      }
    }
  }

  /**
   * Detect service changes
   */
  detectServiceChanges(oldServices, newServices, changes) {
    const oldMap = new Map(oldServices.map(s => [s.name, s]));
    const newMap = new Map(newServices.map(s => [s.name, s]));

    // Check for removed services (BREAKING)
    for (const [name, oldService] of oldMap.entries()) {
      if (!newMap.has(name)) {
        changes.breaking.push({
          type: 'service_removed',
          severity: 'breaking',
          category: 'services',
          message: `Service removed: ${name}`,
          oldValue: oldService,
          newValue: null,
          impact: 'Business logic no longer available',
          recommendation: 'Update code using this service'
        });
      }
    }

    // Check for service changes
    for (const [name, newService] of newMap.entries()) {
      const oldService = oldMap.get(name);

      if (!oldService) {
        changes.additions.push({
          type: 'service_added',
          severity: 'addition',
          category: 'services',
          message: `Service added: ${name}`,
          oldValue: null,
          newValue: newService,
          impact: 'New business logic available',
          recommendation: 'Update documentation'
        });
      } else {
        // Check for parameter changes (POTENTIALLY BREAKING)
        if (!this.arraysEqual(oldService.params, newService.params)) {
          changes.breaking.push({
            type: 'service_signature_changed',
            severity: 'breaking',
            category: 'services',
            message: `Service signature changed: ${name}`,
            oldValue: { params: oldService.params },
            newValue: { params: newService.params },
            impact: 'Service calls may fail with new signature',
            recommendation: 'Update all service calls'
          });
        }
      }
    }
  }

  /**
   * Build route map for efficient lookup
   */
  buildRouteMap(routes) {
    const map = new Map();
    for (const route of routes) {
      const key = `${route.method}:${route.path}`;
      map.set(key, route);
    }
    return map;
  }

  /**
   * Build model map for efficient lookup
   */
  buildModelMap(models) {
    const map = new Map();
    for (const model of models) {
      map.set(model.name, model);
    }
    return map;
  }

  /**
   * Compare two arrays for equality
   */
  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, idx) => val === arr2[idx]);
  }

  /**
   * Calculate breaking change score (0-100)
   * Higher score = more breaking changes
   */
  calculateScore(changes) {
    const weights = {
      route_removed: 10,
      route_middleware_removed: 8,
      model_removed: 10,
      field_removed: 7,
      required_field_added: 8,
      field_type_changed: 9,
      field_made_required: 7,
      controller_removed: 10,
      controller_signature_changed: 8,
      service_removed: 9,
      service_signature_changed: 8
    };

    let score = 0;
    for (const change of changes.breaking) {
      score += weights[change.type] || 5;
    }

    // Cap at 100
    return Math.min(score, 100);
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of BreakingChangeDetector
 * @returns {BreakingChangeDetector}
 */
export function getBreakingChangeDetector() {
  if (!instance) {
    instance = new BreakingChangeDetector();
  }
  return instance;
}

export { BreakingChangeDetector };
export default BreakingChangeDetector;
