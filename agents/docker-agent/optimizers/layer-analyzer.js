/**
 * LayerAnalyzer - Analyzes and Optimizes Docker Image Layers
 *
 * Phase 8.4: Optimizers & Security
 * Analyzes Docker image layers for optimization opportunities
 */

import { BaseOptimizer, OPTIMIZATION_CATEGORY, OPTIMIZATION_LEVEL } from './base-optimizer.js';
import Docker from 'dockerode';

/**
 * LayerAnalyzer
 * Analyzes Docker image layers
 */
export class LayerAnalyzer extends BaseOptimizer {
  constructor() {
    super('LayerAnalyzer', 'layers');
    this.docker = new Docker();
    this.thresholds = {
      largeLayerSize: 100 * 1024 * 1024,      // 100 MB
      smallLayerSize: 1 * 1024 * 1024,        // 1 MB
      maxLayers: 50,
      optimalLayers: 20
    };
  }

  /**
   * Analyze image layers
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(options = {}) {
    const {
      tag,
      imageId,
      includeHistory = true
    } = options;

    this.logger.info(`Analyzing layers: ${tag || imageId}`);

    try {
      const image = this.docker.getImage(tag || imageId);
      const imageInfo = await image.inspect();
      const history = includeHistory ? await image.history() : [];

      const analysis = {
        totalLayers: imageInfo.RootFS?.Layers?.length || 0,
        totalSize: imageInfo.Size,
        layerDetails: this.analyzeLayerDetails(history),
        issues: [],
        recommendations: []
      };

      // Analyze layer count
      if (analysis.totalLayers > this.thresholds.maxLayers) {
        analysis.issues.push({
          type: 'too_many_layers',
          severity: 'high',
          message: `Image has ${analysis.totalLayers} layers (max recommended: ${this.thresholds.maxLayers})`
        });

        analysis.recommendations.push(this.createRecommendation({
          category: OPTIMIZATION_CATEGORY.LAYERS,
          level: OPTIMIZATION_LEVEL.MODERATE,
          description: 'Combine RUN commands to reduce layer count',
          impact: this.estimateImpact(30),
          effort: 'medium',
          implementation: 'Use && to chain commands in Dockerfile RUN instructions'
        }));
      }

      // Analyze large layers
      const largeLayers = analysis.layerDetails.filter(
        l => l.size > this.thresholds.largeLayerSize
      );

      if (largeLayers.length > 0) {
        analysis.issues.push({
          type: 'large_layers',
          severity: 'medium',
          message: `Found ${largeLayers.length} large layer(s) (> 100 MB)`,
          layers: largeLayers
        });

        analysis.recommendations.push(this.createRecommendation({
          category: OPTIMIZATION_CATEGORY.SIZE,
          level: OPTIMIZATION_LEVEL.MODERATE,
          description: 'Optimize large layers by reducing copied files or cleaning up in the same RUN',
          impact: this.estimateImpact(largeLayers.reduce((sum, l) => sum + l.size, 0) / analysis.totalSize * 100),
          effort: 'medium',
          savings: `${(largeLayers.reduce((sum, l) => sum + l.size, 0) / 1024 / 1024).toFixed(2)} MB potential reduction`,
          implementation: 'Remove build artifacts and cache in the same layer they are created'
        }));
      }

      // Analyze small layers
      const smallLayers = analysis.layerDetails.filter(
        l => l.size > 0 && l.size < this.thresholds.smallLayerSize
      );

      if (smallLayers.length > 10) {
        analysis.issues.push({
          type: 'many_small_layers',
          severity: 'low',
          message: `Found ${smallLayers.length} small layer(s) (< 1 MB)`
        });

        analysis.recommendations.push(this.createRecommendation({
          category: OPTIMIZATION_CATEGORY.LAYERS,
          level: OPTIMIZATION_LEVEL.MINIMAL,
          description: 'Combine small operations to reduce layer overhead',
          impact: 'low',
          effort: 'low',
          implementation: 'Merge small file operations into fewer RUN commands'
        }));
      }

      // Analyze cache layers
      const cacheIssues = this.analyzeCacheLayers(history);
      if (cacheIssues.length > 0) {
        analysis.issues.push(...cacheIssues);
      }

      return analysis;
    } catch (error) {
      this.logger.error(`Layer analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Optimize image layers
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimization result
   */
  async optimize(options = {}) {
    const {
      tag,
      imageId,
      level = OPTIMIZATION_LEVEL.MODERATE
    } = options;

    this.logger.info(`Optimizing layers: ${tag || imageId} (level: ${level})`);

    // Analyze first
    const analysis = await this.analyze({ tag, imageId });

    // Filter recommendations by level
    const applicableRecommendations = this.filterByLevel(analysis.recommendations, level);

    // Prioritize recommendations
    const prioritized = this.prioritizeRecommendations(applicableRecommendations);

    const result = this.createResult({
      success: true,
      recommendations: prioritized,
      applied: [],
      skipped: [],
      metadata: {
        tag,
        imageId,
        totalLayers: analysis.totalLayers,
        totalSize: analysis.totalSize,
        issuesFound: analysis.issues.length
      }
    });

    this.recordOptimization(result);
    return result;
  }

  /**
   * Analyze layer details
   * @param {Array} history - Image history
   * @returns {Array} Layer details
   */
  analyzeLayerDetails(history) {
    return history.map((layer, index) => ({
      index,
      id: layer.Id,
      size: layer.Size,
      sizeFormatted: this.formatSize(layer.Size),
      createdBy: layer.CreatedBy,
      comment: layer.Comment,
      isEmpty: layer.Size === 0
    }));
  }

  /**
   * Analyze cache layers
   * @param {Array} history - Image history
   * @returns {Array} Cache issues
   */
  analyzeCacheLayers(history) {
    const issues = [];

    // Check for ADD/COPY of large files that might invalidate cache
    history.forEach((layer, index) => {
      const createdBy = layer.CreatedBy || '';

      if ((createdBy.includes('ADD') || createdBy.includes('COPY')) && layer.Size > 50 * 1024 * 1024) {
        issues.push({
          type: 'large_copy_layer',
          severity: 'medium',
          message: `Large ADD/COPY at layer ${index} may invalidate cache frequently`,
          layer: index,
          size: layer.Size
        });
      }

      // Check for npm/yarn install without proper caching
      if (createdBy.includes('npm install') || createdBy.includes('yarn install')) {
        const prevLayer = history[index - 1];
        if (prevLayer && !prevLayer.CreatedBy?.includes('package')) {
          issues.push({
            type: 'cache_optimization',
            severity: 'low',
            message: `Dependencies installed without copying package files first at layer ${index}`,
            layer: index,
            suggestion: 'Copy package.json and package-lock.json before npm install'
          });
        }
      }
    });

    return issues;
  }

  /**
   * Get layer size distribution
   * @param {string} tag - Image tag
   * @returns {Promise<Object>} Size distribution
   */
  async getLayerSizeDistribution(tag) {
    const image = this.docker.getImage(tag);
    const history = await image.history();

    const distribution = {
      tiny: [],      // < 1 MB
      small: [],     // 1-10 MB
      medium: [],    // 10-50 MB
      large: [],     // 50-100 MB
      huge: []       // > 100 MB
    };

    history.forEach(layer => {
      const sizeMB = layer.Size / 1024 / 1024;

      if (sizeMB < 1) distribution.tiny.push(layer);
      else if (sizeMB < 10) distribution.small.push(layer);
      else if (sizeMB < 50) distribution.medium.push(layer);
      else if (sizeMB < 100) distribution.large.push(layer);
      else distribution.huge.push(layer);
    });

    return {
      distribution,
      summary: {
        tiny: distribution.tiny.length,
        small: distribution.small.length,
        medium: distribution.medium.length,
        large: distribution.large.length,
        huge: distribution.huge.length
      }
    };
  }

  /**
   * Compare layer structures between images
   * @param {string} tag1 - First image tag
   * @param {string} tag2 - Second image tag
   * @returns {Promise<Object>} Comparison result
   */
  async compareLayers(tag1, tag2) {
    this.logger.info(`Comparing layers: ${tag1} vs ${tag2}`);

    const image1 = this.docker.getImage(tag1);
    const image2 = this.docker.getImage(tag2);

    const [info1, info2, history1, history2] = await Promise.all([
      image1.inspect(),
      image2.inspect(),
      image1.history(),
      image2.history()
    ]);

    const comparison = {
      image1: {
        tag: tag1,
        layers: info1.RootFS?.Layers?.length || 0,
        size: info1.Size
      },
      image2: {
        tag: tag2,
        layers: info2.RootFS?.Layers?.length || 0,
        size: info2.Size
      },
      differences: {
        layers: (info2.RootFS?.Layers?.length || 0) - (info1.RootFS?.Layers?.length || 0),
        size: info2.Size - info1.Size
      }
    };

    // Calculate shared layers
    const layers1 = new Set(info1.RootFS?.Layers || []);
    const layers2 = new Set(info2.RootFS?.Layers || []);
    const sharedLayers = [...layers1].filter(l => layers2.has(l));

    comparison.sharedLayers = sharedLayers.length;
    comparison.sharedPercent = ((sharedLayers.length / layers1.size) * 100).toFixed(2);

    return comparison;
  }

  /**
   * Format size
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size
   */
  formatSize(bytes) {
    if (bytes === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));

    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
  }

  /**
   * Set custom thresholds
   * @param {Object} thresholds - Custom thresholds
   */
  setThresholds(thresholds) {
    this.thresholds = { ...this.thresholds, ...thresholds };
    this.logger.info('Layer analyzer thresholds updated');
  }
}

/**
 * Get singleton instance
 */
let analyzerInstance = null;

export function getLayerAnalyzer() {
  if (!analyzerInstance) {
    analyzerInstance = new LayerAnalyzer();
  }
  return analyzerInstance;
}
