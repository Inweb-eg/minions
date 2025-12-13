/**
 * SizeOptimizer - Optimizes Docker Image Size
 *
 * Phase 8.4: Optimizers & Security
 * Analyzes and provides recommendations for reducing Docker image size
 */

import { BaseOptimizer, OPTIMIZATION_CATEGORY, OPTIMIZATION_LEVEL } from './base-optimizer.js';
import Docker from 'dockerode';

/**
 * Size optimization strategies
 */
export const SIZE_STRATEGY = {
  BASE_IMAGE: 'base_image',          // Use smaller base images
  MULTI_STAGE: 'multi_stage',        // Multi-stage builds
  CLEANUP: 'cleanup',                // Remove unnecessary files
  COMPRESSION: 'compression',        // Compress files
  DEPENDENCIES: 'dependencies'       // Optimize dependencies
};

/**
 * SizeOptimizer
 * Optimizes Docker image size
 */
export class SizeOptimizer extends BaseOptimizer {
  constructor() {
    super('SizeOptimizer', 'size');
    this.docker = new Docker();
    this.thresholds = {
      maxSize: 500 * 1024 * 1024,        // 500 MB
      warningSize: 200 * 1024 * 1024,    // 200 MB
      optimalSize: 100 * 1024 * 1024     // 100 MB
    };
    this.alpineAlternatives = {
      'node': 'node:alpine',
      'python': 'python:alpine',
      'nginx': 'nginx:alpine',
      'postgres': 'postgres:alpine',
      'redis': 'redis:alpine'
    };
  }

  /**
   * Analyze image size
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(options = {}) {
    const {
      tag,
      imageId
    } = options;

    this.logger.info(`Analyzing image size: ${tag || imageId}`);

    try {
      const image = this.docker.getImage(tag || imageId);
      const imageInfo = await image.inspect();
      const history = await image.history();

      const analysis = {
        totalSize: imageInfo.Size,
        sizeFormatted: this.formatSize(imageInfo.Size),
        baseImage: this.extractBaseImage(history),
        issues: [],
        recommendations: [],
        breakdown: this.analyzeSizeBreakdown(history)
      };

      // Check overall size
      if (imageInfo.Size > this.thresholds.maxSize) {
        analysis.issues.push({
          type: 'size_too_large',
          severity: 'high',
          message: `Image size (${analysis.sizeFormatted}) exceeds maximum threshold`
        });
      } else if (imageInfo.Size > this.thresholds.warningSize) {
        analysis.issues.push({
          type: 'size_warning',
          severity: 'medium',
          message: `Image size (${analysis.sizeFormatted}) is larger than recommended`
        });
      }

      // Analyze base image
      const baseImageRec = this.analyzeBaseImage(analysis.baseImage);
      if (baseImageRec) {
        analysis.recommendations.push(baseImageRec);
      }

      // Analyze for multi-stage build opportunity
      const multiStageRec = this.analyzeMultiStageOpportunity(history, imageInfo);
      if (multiStageRec) {
        analysis.recommendations.push(multiStageRec);
      }

      // Analyze cleanup opportunities
      const cleanupRecs = this.analyzeCleanupOpportunities(history);
      analysis.recommendations.push(...cleanupRecs);

      // Analyze dependency optimization
      const depRecs = this.analyzeDependencyOptimization(history);
      analysis.recommendations.push(...depRecs);

      return analysis;
    } catch (error) {
      this.logger.error(`Size analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Optimize image size
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimization result
   */
  async optimize(options = {}) {
    const {
      tag,
      imageId,
      level = OPTIMIZATION_LEVEL.MODERATE,
      strategies = Object.values(SIZE_STRATEGY)
    } = options;

    this.logger.info(`Optimizing image size: ${tag || imageId} (level: ${level})`);

    // Analyze first
    const analysis = await this.analyze({ tag, imageId });

    // Filter recommendations by level and strategy
    let recommendations = this.filterByLevel(analysis.recommendations, level);
    recommendations = recommendations.filter(r =>
      strategies.includes(r.metadata?.strategy)
    );

    // Prioritize recommendations
    const prioritized = this.prioritizeRecommendations(recommendations);

    // Calculate potential savings
    const potentialSavings = this.calculatePotentialSavings(prioritized, analysis.totalSize);

    const result = this.createResult({
      success: true,
      recommendations: prioritized,
      applied: [],
      skipped: [],
      metadata: {
        tag,
        imageId,
        currentSize: analysis.totalSize,
        currentSizeFormatted: analysis.sizeFormatted,
        potentialSavings,
        strategies: strategies.length
      }
    });

    this.recordOptimization(result);
    return result;
  }

  /**
   * Analyze size breakdown
   * @param {Array} history - Image history
   * @returns {Object} Size breakdown
   */
  analyzeSizeBreakdown(history) {
    const breakdown = {
      baseImage: 0,
      dependencies: 0,
      application: 0,
      other: 0
    };

    history.forEach(layer => {
      const createdBy = layer.CreatedBy || '';

      if (createdBy.includes('FROM')) {
        breakdown.baseImage += layer.Size;
      } else if (
        createdBy.includes('npm install') ||
        createdBy.includes('yarn install') ||
        createdBy.includes('pip install') ||
        createdBy.includes('apt-get install')
      ) {
        breakdown.dependencies += layer.Size;
      } else if (createdBy.includes('COPY') || createdBy.includes('ADD')) {
        breakdown.application += layer.Size;
      } else {
        breakdown.other += layer.Size;
      }
    });

    return breakdown;
  }

  /**
   * Extract base image from history
   * @param {Array} history - Image history
   * @returns {string|null} Base image
   */
  extractBaseImage(history) {
    const fromLayer = history.find(l => l.CreatedBy?.includes('FROM'));
    if (fromLayer) {
      const match = fromLayer.CreatedBy.match(/FROM\s+([^\s]+)/);
      return match ? match[1] : null;
    }
    return null;
  }

  /**
   * Analyze base image
   * @param {string} baseImage - Base image
   * @returns {Object|null} Recommendation
   */
  analyzeBaseImage(baseImage) {
    if (!baseImage) return null;

    // Check if already using alpine
    if (baseImage.includes('alpine')) {
      return null;
    }

    // Check for alpine alternative
    for (const [key, alpine] of Object.entries(this.alpineAlternatives)) {
      if (baseImage.startsWith(key)) {
        return this.createRecommendation({
          category: OPTIMIZATION_CATEGORY.SIZE,
          level: OPTIMIZATION_LEVEL.MODERATE,
          description: `Switch from ${baseImage} to ${alpine}`,
          impact: 'high',
          effort: 'low',
          savings: '50-80% size reduction',
          implementation: `Change FROM ${baseImage} to FROM ${alpine} in Dockerfile`,
          metadata: { strategy: SIZE_STRATEGY.BASE_IMAGE }
        });
      }
    }

    // Generic alpine recommendation
    if (!baseImage.includes('slim') && !baseImage.includes('alpine')) {
      return this.createRecommendation({
        category: OPTIMIZATION_CATEGORY.SIZE,
        level: OPTIMIZATION_LEVEL.AGGRESSIVE,
        description: `Consider using alpine or slim variant of ${baseImage}`,
        impact: 'high',
        effort: 'medium',
        savings: '50-70% size reduction',
        implementation: 'Use alpine or slim base image variants',
        metadata: { strategy: SIZE_STRATEGY.BASE_IMAGE }
      });
    }

    return null;
  }

  /**
   * Analyze multi-stage build opportunity
   * @param {Array} history - Image history
   * @param {Object} imageInfo - Image info
   * @returns {Object|null} Recommendation
   */
  analyzeMultiStageOpportunity(history, imageInfo) {
    // Check if already using multi-stage
    const fromCount = history.filter(l => l.CreatedBy?.includes('FROM')).length;
    if (fromCount > 1) {
      return null; // Already using multi-stage
    }

    // Check for build tools in final image
    const hasBuildTools = history.some(l => {
      const createdBy = l.CreatedBy || '';
      return (
        createdBy.includes('npm install') ||
        createdBy.includes('yarn install') ||
        createdBy.includes('gcc') ||
        createdBy.includes('make') ||
        createdBy.includes('build-essential')
      );
    });

    if (hasBuildTools) {
      return this.createRecommendation({
        category: OPTIMIZATION_CATEGORY.SIZE,
        level: OPTIMIZATION_LEVEL.MODERATE,
        description: 'Use multi-stage build to exclude build dependencies',
        impact: 'high',
        effort: 'medium',
        savings: '30-60% size reduction',
        implementation: 'Separate build and runtime stages in Dockerfile',
        metadata: { strategy: SIZE_STRATEGY.MULTI_STAGE }
      });
    }

    return null;
  }

  /**
   * Analyze cleanup opportunities
   * @param {Array} history - Image history
   * @returns {Array} Recommendations
   */
  analyzeCleanupOpportunities(history) {
    const recommendations = [];

    // Check for cache cleanup
    const hasAptGet = history.some(l => l.CreatedBy?.includes('apt-get'));
    const hasAptCleanup = history.some(l =>
      l.CreatedBy?.includes('rm -rf /var/lib/apt/lists/*')
    );

    if (hasAptGet && !hasAptCleanup) {
      recommendations.push(this.createRecommendation({
        category: OPTIMIZATION_CATEGORY.SIZE,
        level: OPTIMIZATION_LEVEL.MINIMAL,
        description: 'Clean up apt cache after installation',
        impact: 'low',
        effort: 'low',
        savings: '10-50 MB',
        implementation: 'Add && rm -rf /var/lib/apt/lists/* after apt-get commands',
        metadata: { strategy: SIZE_STRATEGY.CLEANUP }
      }));
    }

    // Check for npm cache cleanup
    const hasNpm = history.some(l => l.CreatedBy?.includes('npm install'));
    const hasNpmCleanup = history.some(l => l.CreatedBy?.includes('npm cache clean'));

    if (hasNpm && !hasNpmCleanup) {
      recommendations.push(this.createRecommendation({
        category: OPTIMIZATION_CATEGORY.SIZE,
        level: OPTIMIZATION_LEVEL.MINIMAL,
        description: 'Clean up npm cache after installation',
        impact: 'low',
        effort: 'low',
        savings: '20-100 MB',
        implementation: 'Add && npm cache clean --force after npm install',
        metadata: { strategy: SIZE_STRATEGY.CLEANUP }
      }));
    }

    return recommendations;
  }

  /**
   * Analyze dependency optimization
   * @param {Array} history - Image history
   * @returns {Array} Recommendations
   */
  analyzeDependencyOptimization(history) {
    const recommendations = [];

    // Check for production dependencies
    const hasNpmInstall = history.some(l => l.CreatedBy?.includes('npm install'));
    const hasProduction = history.some(l => l.CreatedBy?.includes('--production'));

    if (hasNpmInstall && !hasProduction) {
      recommendations.push(this.createRecommendation({
        category: OPTIMIZATION_CATEGORY.SIZE,
        level: OPTIMIZATION_LEVEL.MODERATE,
        description: 'Install only production dependencies',
        impact: 'medium',
        effort: 'low',
        savings: '20-40% dependency size reduction',
        implementation: 'Use npm install --production or npm ci --only=production',
        metadata: { strategy: SIZE_STRATEGY.DEPENDENCIES }
      }));
    }

    return recommendations;
  }

  /**
   * Calculate potential savings
   * @param {Array} recommendations - Recommendations
   * @param {number} currentSize - Current image size
   * @returns {Object} Savings estimation
   */
  calculatePotentialSavings(recommendations, currentSize) {
    let minSavingsPercent = 0;
    let maxSavingsPercent = 0;

    recommendations.forEach(rec => {
      if (rec.impact === 'high') {
        minSavingsPercent += 20;
        maxSavingsPercent += 50;
      } else if (rec.impact === 'medium') {
        minSavingsPercent += 10;
        maxSavingsPercent += 30;
      } else if (rec.impact === 'low') {
        minSavingsPercent += 5;
        maxSavingsPercent += 15;
      }
    });

    // Cap at 90%
    minSavingsPercent = Math.min(minSavingsPercent, 90);
    maxSavingsPercent = Math.min(maxSavingsPercent, 90);

    const minSavingsBytes = currentSize * (minSavingsPercent / 100);
    const maxSavingsBytes = currentSize * (maxSavingsPercent / 100);

    return {
      minPercent: minSavingsPercent,
      maxPercent: maxSavingsPercent,
      minSize: this.formatSize(minSavingsBytes),
      maxSize: this.formatSize(maxSavingsBytes),
      estimatedFinalSize: this.formatSize(currentSize - maxSavingsBytes)
    };
  }

  /**
   * Compare image sizes
   * @param {string} tag1 - First image tag
   * @param {string} tag2 - Second image tag
   * @returns {Promise<Object>} Comparison result
   */
  async compareImageSizes(tag1, tag2) {
    const image1 = this.docker.getImage(tag1);
    const image2 = this.docker.getImage(tag2);

    const [info1, info2] = await Promise.all([
      image1.inspect(),
      image2.inspect()
    ]);

    const savings = this.calculateSavings(info1.Size, info2.Size);

    return {
      image1: {
        tag: tag1,
        size: info1.Size,
        sizeFormatted: this.formatSize(info1.Size)
      },
      image2: {
        tag: tag2,
        size: info2.Size,
        sizeFormatted: this.formatSize(info2.Size)
      },
      savings: {
        ...savings,
        sizeFormatted: this.formatSize(Math.abs(savings.absolute))
      }
    };
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
    this.logger.info('Size optimizer thresholds updated');
  }
}

/**
 * Get singleton instance
 */
let optimizerInstance = null;

export function getSizeOptimizer() {
  if (!optimizerInstance) {
    optimizerInstance = new SizeOptimizer();
  }
  return optimizerInstance;
}
