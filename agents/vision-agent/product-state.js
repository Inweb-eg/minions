/**
 * Product State Manager
 * =====================
 * Tracks the state of features: planned vs in_progress vs implemented.
 * Maintains feature lifecycle and progress metrics.
 */

import EventEmitter from 'events';

// Feature status values
export const FeatureStatus = {
  PLANNED: 'planned',
  IN_PROGRESS: 'in_progress',
  IMPLEMENTED: 'implemented',
  BLOCKED: 'blocked',
  DEPRECATED: 'deprecated'
};

// Progress calculation methods
export const ProgressMethod = {
  FEATURE_COUNT: 'feature_count',
  STORY_COUNT: 'story_count',
  TASK_COUNT: 'task_count',
  COMPLEXITY_WEIGHTED: 'complexity_weighted'
};

export class ProductStateManager extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      progressMethod: config.progressMethod || ProgressMethod.TASK_COUNT,
      ...config
    };

    // State storage
    this.features = new Map();
    this.decompositions = new Map(); // featureId -> { epic, stories, tasks }
    this.statusHistory = []; // Track all status changes
    this.milestones = new Map(); // Named milestones with feature sets

    // Aggregated metrics
    this.metrics = {
      totalFeatures: 0,
      planned: 0,
      inProgress: 0,
      implemented: 0,
      blocked: 0,
      deprecated: 0,
      overallProgress: 0
    };
  }

  /**
   * Add a feature to track
   */
  addFeature(feature) {
    if (this.features.has(feature.id)) {
      return { success: false, error: 'Feature already exists' };
    }

    const trackedFeature = {
      ...feature,
      status: feature.status || FeatureStatus.PLANNED,
      progress: 0,
      statusHistory: [{
        status: feature.status || FeatureStatus.PLANNED,
        timestamp: new Date().toISOString(),
        reason: 'Initial tracking'
      }],
      addedAt: new Date().toISOString()
    };

    this.features.set(feature.id, trackedFeature);
    this._updateMetrics();

    return { success: true, feature: trackedFeature };
  }

  /**
   * Add decomposition for a feature
   */
  addDecomposition(featureId, decomposition) {
    if (!this.features.has(featureId)) {
      // Auto-create feature entry if it doesn't exist
      this.addFeature({ id: featureId, name: featureId });
    }

    this.decompositions.set(featureId, {
      epic: decomposition.epic,
      stories: decomposition.stories || [],
      tasks: decomposition.tasks || [],
      addedAt: new Date().toISOString()
    });

    // Update feature progress based on decomposition
    this._updateFeatureProgress(featureId);

    return { success: true };
  }

  /**
   * Update feature status
   */
  updateStatus(featureId, newStatus, metadata = {}) {
    const feature = this.features.get(featureId);
    if (!feature) {
      return { success: false, error: 'Feature not found' };
    }

    const oldStatus = feature.status;

    // Validate status transition
    if (!this._isValidTransition(oldStatus, newStatus)) {
      return {
        success: false,
        error: `Invalid status transition: ${oldStatus} → ${newStatus}`
      };
    }

    // Update status
    feature.status = newStatus;
    feature.statusHistory.push({
      from: oldStatus,
      to: newStatus,
      timestamp: new Date().toISOString(),
      reason: metadata.reason || 'Status update',
      metadata
    });

    // Record in global history
    this.statusHistory.push({
      featureId,
      from: oldStatus,
      to: newStatus,
      timestamp: new Date().toISOString(),
      metadata
    });

    // Update metrics
    this._updateMetrics();

    this.emit('status:changed', {
      featureId,
      oldStatus,
      newStatus,
      metadata
    });

    return {
      success: true,
      feature,
      transition: { from: oldStatus, to: newStatus }
    };
  }

  /**
   * Update task/story status within a decomposition
   */
  updateItemStatus(featureId, itemType, itemId, newStatus) {
    const decomposition = this.decompositions.get(featureId);
    if (!decomposition) {
      return { success: false, error: 'Decomposition not found' };
    }

    let items;
    switch (itemType) {
      case 'story':
        items = decomposition.stories;
        break;
      case 'task':
        items = decomposition.tasks;
        break;
      default:
        return { success: false, error: 'Invalid item type' };
    }

    const item = items.find(i => i.id === itemId);
    if (!item) {
      return { success: false, error: `${itemType} not found: ${itemId}` };
    }

    item.status = newStatus;
    item.updatedAt = new Date().toISOString();

    // Recalculate feature progress
    this._updateFeatureProgress(featureId);

    return { success: true, item };
  }

  /**
   * Get current state snapshot
   */
  getState() {
    return {
      features: Array.from(this.features.values()),
      decompositions: Object.fromEntries(this.decompositions),
      metrics: this._calculateMetrics(),
      progressByCategory: this._calculateProgressByCategory(),
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get feature by ID
   */
  getFeature(featureId) {
    return this.features.get(featureId) || null;
  }

  /**
   * Get features by status
   */
  getFeaturesByStatus(status) {
    return Array.from(this.features.values()).filter(f => f.status === status);
  }

  /**
   * Get progress summary
   */
  getProgressSummary() {
    const metrics = this._calculateMetrics();

    return {
      overall: metrics.overallProgress,
      byStatus: {
        planned: metrics.planned,
        inProgress: metrics.inProgress,
        implemented: metrics.implemented,
        blocked: metrics.blocked,
        deprecated: metrics.deprecated
      },
      totalFeatures: metrics.totalFeatures,
      completedFeatures: metrics.implemented,
      remainingFeatures: metrics.planned + metrics.inProgress
    };
  }

  /**
   * Get status history for a feature
   */
  getFeatureHistory(featureId) {
    const feature = this.features.get(featureId);
    if (!feature) {
      return [];
    }
    return feature.statusHistory;
  }

  /**
   * Get global status history
   */
  getGlobalHistory(options = {}) {
    let history = [...this.statusHistory];

    if (options.featureId) {
      history = history.filter(h => h.featureId === options.featureId);
    }

    if (options.since) {
      const sinceDate = new Date(options.since);
      history = history.filter(h => new Date(h.timestamp) >= sinceDate);
    }

    if (options.limit) {
      history = history.slice(-options.limit);
    }

    return history;
  }

  /**
   * Create a milestone
   */
  createMilestone(name, featureIds, metadata = {}) {
    const milestone = {
      id: `milestone-${Date.now()}`,
      name,
      features: featureIds,
      progress: this._calculateMilestoneProgress(featureIds),
      status: 'active',
      createdAt: new Date().toISOString(),
      metadata
    };

    this.milestones.set(milestone.id, milestone);

    return { success: true, milestone };
  }

  /**
   * Get milestone progress
   */
  getMilestone(milestoneId) {
    const milestone = this.milestones.get(milestoneId);
    if (!milestone) {
      return null;
    }

    // Update progress
    milestone.progress = this._calculateMilestoneProgress(milestone.features);

    return milestone;
  }

  /**
   * Get all milestones
   */
  getAllMilestones() {
    return Array.from(this.milestones.values()).map(m => ({
      ...m,
      progress: this._calculateMilestoneProgress(m.features)
    }));
  }

  /**
   * Load state from saved data
   */
  async loadState(savedState) {
    if (!savedState) return;

    // Restore features
    if (savedState.features) {
      for (const feature of savedState.features) {
        this.features.set(feature.id, feature);
      }
    }

    // Restore decompositions
    if (savedState.decompositions) {
      for (const [featureId, decomposition] of Object.entries(savedState.decompositions)) {
        this.decompositions.set(featureId, decomposition);
      }
    }

    // Restore milestones
    if (savedState.milestones) {
      for (const milestone of savedState.milestones) {
        this.milestones.set(milestone.id, milestone);
      }
    }

    // Restore history
    if (savedState.statusHistory) {
      this.statusHistory = savedState.statusHistory;
    }

    this._updateMetrics();
  }

  /**
   * Reset state
   */
  reset() {
    this.features.clear();
    this.decompositions.clear();
    this.statusHistory = [];
    this.milestones.clear();
    this._updateMetrics();
  }

  // ==================== Private Methods ====================

  /**
   * Validate status transition
   */
  _isValidTransition(from, to) {
    const validTransitions = {
      [FeatureStatus.PLANNED]: [
        FeatureStatus.IN_PROGRESS,
        FeatureStatus.BLOCKED,
        FeatureStatus.DEPRECATED
      ],
      [FeatureStatus.IN_PROGRESS]: [
        FeatureStatus.IMPLEMENTED,
        FeatureStatus.BLOCKED,
        FeatureStatus.DEPRECATED,
        FeatureStatus.PLANNED // Allow reverting
      ],
      [FeatureStatus.BLOCKED]: [
        FeatureStatus.PLANNED,
        FeatureStatus.IN_PROGRESS,
        FeatureStatus.DEPRECATED
      ],
      [FeatureStatus.IMPLEMENTED]: [
        FeatureStatus.DEPRECATED,
        FeatureStatus.IN_PROGRESS // For re-work
      ],
      [FeatureStatus.DEPRECATED]: [
        FeatureStatus.PLANNED // For un-deprecating
      ]
    };

    return validTransitions[from]?.includes(to) ?? false;
  }

  /**
   * Update feature progress based on decomposition
   */
  _updateFeatureProgress(featureId) {
    const feature = this.features.get(featureId);
    const decomposition = this.decompositions.get(featureId);

    if (!feature || !decomposition) return;

    let progress = 0;

    switch (this.config.progressMethod) {
      case ProgressMethod.TASK_COUNT:
        progress = this._calculateTaskProgress(decomposition);
        break;

      case ProgressMethod.STORY_COUNT:
        progress = this._calculateStoryProgress(decomposition);
        break;

      case ProgressMethod.COMPLEXITY_WEIGHTED:
        progress = this._calculateWeightedProgress(decomposition);
        break;

      default:
        progress = this._calculateTaskProgress(decomposition);
    }

    feature.progress = progress;

    // Auto-update status based on progress
    if (progress === 100 && feature.status !== FeatureStatus.IMPLEMENTED) {
      this.updateStatus(featureId, FeatureStatus.IMPLEMENTED, {
        reason: 'All tasks completed'
      });
    } else if (progress > 0 && feature.status === FeatureStatus.PLANNED) {
      this.updateStatus(featureId, FeatureStatus.IN_PROGRESS, {
        reason: 'Work started'
      });
    }
  }

  /**
   * Calculate progress based on tasks
   */
  _calculateTaskProgress(decomposition) {
    const tasks = decomposition.tasks || [];
    if (tasks.length === 0) return 0;

    const completed = tasks.filter(t =>
      t.status === 'completed' || t.status === 'done'
    ).length;

    return Math.round((completed / tasks.length) * 100);
  }

  /**
   * Calculate progress based on stories
   */
  _calculateStoryProgress(decomposition) {
    const stories = decomposition.stories || [];
    if (stories.length === 0) return 0;

    const completed = stories.filter(s =>
      s.status === 'completed' || s.status === 'done'
    ).length;

    return Math.round((completed / stories.length) * 100);
  }

  /**
   * Calculate complexity-weighted progress
   */
  _calculateWeightedProgress(decomposition) {
    const tasks = decomposition.tasks || [];
    if (tasks.length === 0) return 0;

    const totalComplexity = tasks.reduce((sum, t) => sum + (t.complexity || 1), 0);
    const completedComplexity = tasks
      .filter(t => t.status === 'completed' || t.status === 'done')
      .reduce((sum, t) => sum + (t.complexity || 1), 0);

    if (totalComplexity === 0) return 0;

    return Math.round((completedComplexity / totalComplexity) * 100);
  }

  /**
   * Calculate milestone progress
   */
  _calculateMilestoneProgress(featureIds) {
    if (!featureIds || featureIds.length === 0) return 0;

    let totalProgress = 0;

    for (const featureId of featureIds) {
      const feature = this.features.get(featureId);
      if (feature) {
        if (feature.status === FeatureStatus.IMPLEMENTED) {
          totalProgress += 100;
        } else {
          totalProgress += feature.progress || 0;
        }
      }
    }

    return Math.round(totalProgress / featureIds.length);
  }

  /**
   * Calculate all metrics
   */
  _calculateMetrics() {
    const features = Array.from(this.features.values());

    const metrics = {
      totalFeatures: features.length,
      planned: 0,
      inProgress: 0,
      implemented: 0,
      blocked: 0,
      deprecated: 0,
      overallProgress: 0
    };

    let totalProgress = 0;

    for (const feature of features) {
      switch (feature.status) {
        case FeatureStatus.PLANNED:
          metrics.planned++;
          break;
        case FeatureStatus.IN_PROGRESS:
          metrics.inProgress++;
          totalProgress += feature.progress || 0;
          break;
        case FeatureStatus.IMPLEMENTED:
          metrics.implemented++;
          totalProgress += 100;
          break;
        case FeatureStatus.BLOCKED:
          metrics.blocked++;
          totalProgress += feature.progress || 0;
          break;
        case FeatureStatus.DEPRECATED:
          metrics.deprecated++;
          break;
      }
    }

    // Calculate overall progress (excluding deprecated)
    const activeFeatures = features.filter(f => f.status !== FeatureStatus.DEPRECATED);
    if (activeFeatures.length > 0) {
      metrics.overallProgress = Math.round(totalProgress / activeFeatures.length);
    }

    return metrics;
  }

  /**
   * Update cached metrics
   */
  _updateMetrics() {
    this.metrics = this._calculateMetrics();
  }

  /**
   * Calculate progress by category
   */
  _calculateProgressByCategory() {
    const byCategory = {};

    for (const [featureId, decomposition] of this.decompositions) {
      const feature = this.features.get(featureId);
      if (!feature) continue;

      const epic = decomposition.epic;
      if (!epic?.categories) continue;

      for (const category of epic.categories) {
        if (!byCategory[category]) {
          byCategory[category] = {
            total: 0,
            completed: 0,
            progress: 0
          };
        }

        byCategory[category].total++;
        if (feature.status === FeatureStatus.IMPLEMENTED) {
          byCategory[category].completed++;
        }
      }
    }

    // Calculate percentages
    for (const category of Object.keys(byCategory)) {
      const cat = byCategory[category];
      cat.progress = cat.total > 0
        ? Math.round((cat.completed / cat.total) * 100)
        : 0;
    }

    return byCategory;
  }
}

export default ProductStateManager;
