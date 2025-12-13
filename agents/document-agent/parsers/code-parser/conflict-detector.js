import { createLogger } from '../../../../foundation/common/logger.js';

const logger = createLogger('ConflictDetector');

/**
 * ConflictDetector - Detects conflicting changes in documentation updates
 *
 * Detects conflicts when:
 * - Multiple updates to the same API endpoint
 * - Conflicting model field definitions
 * - Inconsistent documentation across files
 * - Breaking changes without version bumps
 * - Conflicting business logic changes
 *
 * Provides resolution strategies:
 * - Auto-merge compatible changes
 * - Prioritize code over docs
 * - Manual review required
 * - Version conflict resolution
 */
class ConflictDetector {
  constructor() {
    this.logger = createLogger('ConflictDetector');
  }

  /**
   * Detect conflicts between multiple change sets
   *
   * @param {Object} baseState - Original state
   * @param {Object[]} changeSets - Array of change sets to merge
   * @returns {Object} Detected conflicts with resolution strategies
   */
  detect(baseState, changeSets) {
    this.logger.info(`Detecting conflicts across ${changeSets.length} change sets...`);

    const conflicts = {
      conflicts: [],
      autoMergeable: [],
      requiresReview: [],
      resolved: [],
      summary: {
        total: 0,
        conflicts: 0,
        autoMergeable: 0,
        requiresReview: 0,
        resolved: 0
      }
    };

    // Compare all change sets pairwise
    for (let i = 0; i < changeSets.length; i++) {
      for (let j = i + 1; j < changeSets.length; j++) {
        this.detectRouteConflicts(baseState, changeSets[i], changeSets[j], conflicts);
        this.detectModelConflicts(baseState, changeSets[i], changeSets[j], conflicts);
        this.detectControllerConflicts(baseState, changeSets[i], changeSets[j], conflicts);
        this.detectServiceConflicts(baseState, changeSets[i], changeSets[j], conflicts);
      }
    }

    // Calculate summary
    conflicts.summary.conflicts = conflicts.conflicts.length;
    conflicts.summary.autoMergeable = conflicts.autoMergeable.length;
    conflicts.summary.requiresReview = conflicts.requiresReview.length;
    conflicts.summary.resolved = conflicts.resolved.length;
    conflicts.summary.total =
      conflicts.summary.conflicts +
      conflicts.summary.autoMergeable +
      conflicts.summary.requiresReview;

    this.logger.info(
      `Detected ${conflicts.summary.total} potential conflicts: ` +
      `${conflicts.summary.conflicts} conflicts, ` +
      `${conflicts.summary.autoMergeable} auto-mergeable, ` +
      `${conflicts.summary.requiresReview} require review`
    );

    return conflicts;
  }

  /**
   * Detect route conflicts
   */
  detectRouteConflicts(baseState, changeSet1, changeSet2, conflicts) {
    const routes1 = changeSet1.routes || [];
    const routes2 = changeSet2.routes || [];

    for (const route1 of routes1) {
      for (const route2 of routes2) {
        // Same route, different changes
        if (this.isSameRoute(route1, route2)) {
          // Both deleted - no conflict
          if (route1.operation === 'delete' && route2.operation === 'delete') {
            conflicts.resolved.push({
              type: 'route_both_deleted',
              severity: 'resolved',
              category: 'routes',
              message: `Both change sets deleted route: ${route1.method} ${route1.path}`,
              resolution: 'auto',
              strategy: 'accept_deletion'
            });
            continue;
          }

          // Both added with same definition - no conflict
          if (route1.operation === 'add' && route2.operation === 'add' &&
              this.routesAreIdentical(route1, route2)) {
            conflicts.autoMergeable.push({
              type: 'route_duplicate_add',
              severity: 'auto-mergeable',
              category: 'routes',
              message: `Both change sets added identical route: ${route1.method} ${route1.path}`,
              resolution: 'auto',
              strategy: 'accept_one'
            });
            continue;
          }

          // Both modified - check for conflicts
          if (route1.operation === 'modify' && route2.operation === 'modify') {
            // Handler changed to different values - CONFLICT
            if (route1.handler !== route2.handler) {
              conflicts.conflicts.push({
                type: 'route_handler_conflict',
                severity: 'conflict',
                category: 'routes',
                message: `Conflicting handler changes for route: ${route1.method} ${route1.path}`,
                route: { method: route1.method, path: route1.path },
                changeSet1: { handler: route1.handler },
                changeSet2: { handler: route2.handler },
                resolution: 'manual',
                strategy: 'choose_one_or_merge',
                recommendations: [
                  'Review both handler implementations',
                  'Choose the most recent or correct handler',
                  'Consider if both handlers can be merged'
                ]
              });
              continue;
            }

            // Middleware changes - might be mergeable
            const middleware1 = route1.middleware || [];
            const middleware2 = route2.middleware || [];

            if (!this.arraysEqual(middleware1, middleware2)) {
              // Check if changes are compatible
              if (this.middlewareChangesCompatible(middleware1, middleware2)) {
                conflicts.autoMergeable.push({
                  type: 'route_middleware_mergeable',
                  severity: 'auto-mergeable',
                  category: 'routes',
                  message: `Compatible middleware changes for route: ${route1.method} ${route1.path}`,
                  route: { method: route1.method, path: route1.path },
                  changeSet1: { middleware: middleware1 },
                  changeSet2: { middleware: middleware2 },
                  resolution: 'auto',
                  strategy: 'merge_middleware',
                  mergedResult: this.mergeMiddleware(middleware1, middleware2)
                });
              } else {
                conflicts.requiresReview.push({
                  type: 'route_middleware_conflict',
                  severity: 'requires-review',
                  category: 'routes',
                  message: `Conflicting middleware changes for route: ${route1.method} ${route1.path}`,
                  route: { method: route1.method, path: route1.path },
                  changeSet1: { middleware: middleware1 },
                  changeSet2: { middleware: middleware2 },
                  resolution: 'review',
                  strategy: 'review_order_and_necessity'
                });
              }
            }
          }

          // One added, one deleted - CONFLICT
          if ((route1.operation === 'add' && route2.operation === 'delete') ||
              (route1.operation === 'delete' && route2.operation === 'add')) {
            conflicts.conflicts.push({
              type: 'route_add_delete_conflict',
              severity: 'conflict',
              category: 'routes',
              message: `Conflicting add/delete for route: ${route1.method} ${route1.path}`,
              route: { method: route1.method, path: route1.path },
              changeSet1: { operation: route1.operation },
              changeSet2: { operation: route2.operation },
              resolution: 'manual',
              strategy: 'determine_intent'
            });
          }
        }
      }
    }
  }

  /**
   * Detect model conflicts
   */
  detectModelConflicts(baseState, changeSet1, changeSet2, conflicts) {
    const models1 = changeSet1.models || [];
    const models2 = changeSet2.models || [];

    for (const model1 of models1) {
      for (const model2 of models2) {
        // Same model, different changes
        if (model1.name === model2.name) {
          // Both deleted - no conflict
          if (model1.operation === 'delete' && model2.operation === 'delete') {
            conflicts.resolved.push({
              type: 'model_both_deleted',
              severity: 'resolved',
              category: 'models',
              message: `Both change sets deleted model: ${model1.name}`,
              resolution: 'auto',
              strategy: 'accept_deletion'
            });
            continue;
          }

          // Field conflicts
          if (model1.operation === 'modify' && model2.operation === 'modify') {
            this.detectFieldConflicts(model1, model2, conflicts);
          }

          // One added, one deleted - CONFLICT
          if ((model1.operation === 'add' && model2.operation === 'delete') ||
              (model1.operation === 'delete' && model2.operation === 'add')) {
            conflicts.conflicts.push({
              type: 'model_add_delete_conflict',
              severity: 'conflict',
              category: 'models',
              message: `Conflicting add/delete for model: ${model1.name}`,
              model: model1.name,
              changeSet1: { operation: model1.operation },
              changeSet2: { operation: model2.operation },
              resolution: 'manual',
              strategy: 'determine_intent'
            });
          }
        }
      }
    }
  }

  /**
   * Detect field conflicts in models
   */
  detectFieldConflicts(model1, model2, conflicts) {
    const fields1 = model1.fields || [];
    const fields2 = model2.fields || [];

    for (const field1 of fields1) {
      for (const field2 of fields2) {
        if (field1.name === field2.name) {
          // Type conflict
          if (field1.type !== field2.type) {
            conflicts.conflicts.push({
              type: 'field_type_conflict',
              severity: 'conflict',
              category: 'models',
              message: `Conflicting type changes for field ${model1.name}.${field1.name}`,
              model: model1.name,
              field: field1.name,
              changeSet1: { type: field1.type },
              changeSet2: { type: field2.type },
              resolution: 'manual',
              strategy: 'choose_correct_type',
              recommendations: [
                'Review data migration implications',
                'Check which type matches actual usage',
                'Consider if type conversion is needed'
              ]
            });
          }

          // Required status conflict
          if (field1.required !== field2.required) {
            conflicts.requiresReview.push({
              type: 'field_required_conflict',
              severity: 'requires-review',
              category: 'models',
              message: `Conflicting required status for field ${model1.name}.${field1.name}`,
              model: model1.name,
              field: field1.name,
              changeSet1: { required: field1.required },
              changeSet2: { required: field2.required },
              resolution: 'review',
              strategy: 'prefer_more_strict',
              recommendations: [
                'Prefer required=true for data integrity',
                'Check if default values are provided',
                'Review business logic requirements'
              ]
            });
          }
        }
      }
    }
  }

  /**
   * Detect controller conflicts
   */
  detectControllerConflicts(baseState, changeSet1, changeSet2, conflicts) {
    const controllers1 = changeSet1.controllers || [];
    const controllers2 = changeSet2.controllers || [];

    for (const ctrl1 of controllers1) {
      for (const ctrl2 of controllers2) {
        if (ctrl1.name === ctrl2.name) {
          // Signature conflict
          if (ctrl1.operation === 'modify' && ctrl2.operation === 'modify') {
            if (!this.arraysEqual(ctrl1.params, ctrl2.params)) {
              conflicts.conflicts.push({
                type: 'controller_signature_conflict',
                severity: 'conflict',
                category: 'controllers',
                message: `Conflicting signature changes for controller: ${ctrl1.name}`,
                controller: ctrl1.name,
                changeSet1: { params: ctrl1.params },
                changeSet2: { params: ctrl2.params },
                resolution: 'manual',
                strategy: 'merge_or_choose'
              });
            }
          }
        }
      }
    }
  }

  /**
   * Detect service conflicts
   */
  detectServiceConflicts(baseState, changeSet1, changeSet2, conflicts) {
    const services1 = changeSet1.services || [];
    const services2 = changeSet2.services || [];

    for (const svc1 of services1) {
      for (const svc2 of services2) {
        if (svc1.name === svc2.name) {
          // Signature conflict
          if (svc1.operation === 'modify' && svc2.operation === 'modify') {
            if (!this.arraysEqual(svc1.params, svc2.params)) {
              conflicts.conflicts.push({
                type: 'service_signature_conflict',
                severity: 'conflict',
                category: 'services',
                message: `Conflicting signature changes for service: ${svc1.name}`,
                service: svc1.name,
                changeSet1: { params: svc1.params },
                changeSet2: { params: svc2.params },
                resolution: 'manual',
                strategy: 'merge_or_choose'
              });
            }
          }
        }
      }
    }
  }

  /**
   * Check if two routes are the same
   */
  isSameRoute(route1, route2) {
    return route1.method === route2.method && route1.path === route2.path;
  }

  /**
   * Check if two routes are identical
   */
  routesAreIdentical(route1, route2) {
    return (
      route1.method === route2.method &&
      route1.path === route2.path &&
      route1.handler === route2.handler &&
      this.arraysEqual(route1.middleware || [], route2.middleware || [])
    );
  }

  /**
   * Check if middleware changes are compatible
   */
  middlewareChangesCompatible(middleware1, middleware2) {
    // If one is a superset of the other, they're compatible
    const set1 = new Set(middleware1);
    const set2 = new Set(middleware2);

    // All items in middleware1 are in middleware2, or vice versa
    const all1In2 = middleware1.every(m => set2.has(m));
    const all2In1 = middleware2.every(m => set1.has(m));

    return all1In2 || all2In1;
  }

  /**
   * Merge compatible middleware
   */
  mergeMiddleware(middleware1, middleware2) {
    // Combine and deduplicate, preserving order
    const seen = new Set();
    const merged = [];

    for (const m of [...middleware1, ...middleware2]) {
      if (!seen.has(m)) {
        seen.add(m);
        merged.push(m);
      }
    }

    return merged;
  }

  /**
   * Compare two arrays for equality
   */
  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, idx) => val === arr2[idx]);
  }

  /**
   * Resolve conflicts automatically where possible
   *
   * @param {Object} conflicts - Conflict detection results
   * @returns {Object} Resolution results
   */
  resolve(conflicts) {
    this.logger.info('Attempting automatic conflict resolution...');

    const resolution = {
      resolved: [],
      stillConflicted: [],
      requiresManual: []
    };

    // Auto-merge compatible changes
    for (const conflict of conflicts.autoMergeable) {
      if (conflict.strategy === 'merge_middleware') {
        resolution.resolved.push({
          ...conflict,
          resolvedValue: conflict.mergedResult,
          resolvedBy: 'auto'
        });
      } else if (conflict.strategy === 'accept_one') {
        resolution.resolved.push({
          ...conflict,
          resolvedValue: conflict.changeSet1 || conflict.changeSet2,
          resolvedBy: 'auto'
        });
      }
    }

    // Mark conflicts requiring manual resolution
    for (const conflict of conflicts.conflicts) {
      resolution.requiresManual.push({
        ...conflict,
        reason: 'Conflicting changes require manual review'
      });
    }

    // Mark conflicts requiring review
    for (const conflict of conflicts.requiresReview) {
      resolution.requiresManual.push({
        ...conflict,
        reason: 'Changes require human review for correctness'
      });
    }

    this.logger.info(
      `Resolution complete: ${resolution.resolved.length} resolved, ` +
      `${resolution.requiresManual.length} require manual intervention`
    );

    return resolution;
  }
}

// Singleton instance
let instance = null;

/**
 * Get singleton instance of ConflictDetector
 * @returns {ConflictDetector}
 */
export function getConflictDetector() {
  if (!instance) {
    instance = new ConflictDetector();
  }
  return instance;
}

export { ConflictDetector };
export default ConflictDetector;
