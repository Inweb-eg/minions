/**
 * Optimizers Module - Docker Optimization and Security System
 *
 * Phase 8.4: Optimizers & Security
 * Exports all optimizers and security scanners
 */

export {
  BaseOptimizer,
  OPTIMIZATION_LEVEL,
  OPTIMIZATION_CATEGORY
} from './base-optimizer.js';

export {
  LayerAnalyzer,
  getLayerAnalyzer
} from './layer-analyzer.js';

export {
  SizeOptimizer,
  getSizeOptimizer,
  SIZE_STRATEGY
} from './size-optimizer.js';

export {
  VulnerabilityScanner,
  getVulnerabilityScanner,
  VULNERABILITY_SEVERITY,
  SCAN_STATUS
} from './vulnerability-scanner.js';

import { getLayerAnalyzer as _getLayerAnalyzer } from './layer-analyzer.js';
import { getSizeOptimizer as _getSizeOptimizer } from './size-optimizer.js';
import { getVulnerabilityScanner as _getVulnerabilityScanner } from './vulnerability-scanner.js';

/**
 * Get all optimizers
 * @returns {Object} All optimizer instances
 */
export function getAllOptimizers() {
  return {
    layer: _getLayerAnalyzer(),
    size: _getSizeOptimizer(),
    security: _getVulnerabilityScanner()
  };
}

/**
 * Comprehensive image optimization
 * @param {Object} options - Optimization options
 * @returns {Promise<Object>} Aggregated optimization result
 */
export async function optimizeImage(options = {}) {
  const {
    tag,
    imageId,
    level = OPTIMIZATION_LEVEL.MODERATE,
    categories = [
      OPTIMIZATION_CATEGORY.SIZE,
      OPTIMIZATION_CATEGORY.LAYERS,
      OPTIMIZATION_CATEGORY.SECURITY
    ]
  } = options;

  const optimizers = getAllOptimizers();
  const results = {};

  // Run layer optimization
  if (categories.includes(OPTIMIZATION_CATEGORY.LAYERS)) {
    results.layers = await optimizers.layer.optimize({ tag, imageId, level });
  }

  // Run size optimization
  if (categories.includes(OPTIMIZATION_CATEGORY.SIZE)) {
    results.size = await optimizers.size.optimize({ tag, imageId, level });
  }

  // Run security scan
  if (categories.includes(OPTIMIZATION_CATEGORY.SECURITY)) {
    results.security = await optimizers.security.optimize({ tag, imageId, level });
  }

  // Aggregate recommendations
  const allRecommendations = [];
  Object.values(results).forEach(result => {
    if (result.recommendations) {
      allRecommendations.push(...result.recommendations);
    }
  });

  // Deduplicate and prioritize
  const uniqueRecommendations = deduplicateRecommendations(allRecommendations);
  const prioritized = prioritizeAllRecommendations(uniqueRecommendations);

  return {
    success: Object.values(results).every(r => r.success),
    results,
    recommendations: prioritized,
    summary: {
      totalRecommendations: prioritized.length,
      byCategory: countByCategory(prioritized),
      byImpact: countByImpact(prioritized)
    }
  };
}

/**
 * Comprehensive image analysis
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Aggregated analysis result
 */
export async function analyzeImage(options = {}) {
  const {
    tag,
    imageId
  } = options;

  const optimizers = getAllOptimizers();

  const [layerAnalysis, sizeAnalysis, securityAnalysis] = await Promise.all([
    optimizers.layer.analyze({ tag, imageId }),
    optimizers.size.analyze({ tag, imageId }),
    optimizers.security.analyze({ tag, imageId })
  ]);

  return {
    layers: layerAnalysis,
    size: sizeAnalysis,
    security: securityAnalysis,
    summary: {
      totalIssues: (layerAnalysis.issues?.length || 0) +
                   (sizeAnalysis.issues?.length || 0) +
                   (securityAnalysis.vulnerabilities?.length || 0),
      totalRecommendations: (layerAnalysis.recommendations?.length || 0) +
                           (sizeAnalysis.recommendations?.length || 0) +
                           (securityAnalysis.recommendations?.length || 0)
    }
  };
}

/**
 * Deduplicate recommendations
 * @param {Array} recommendations - Recommendations
 * @returns {Array} Deduplicated recommendations
 */
function deduplicateRecommendations(recommendations) {
  const seen = new Set();
  return recommendations.filter(rec => {
    const key = `${rec.category}:${rec.description}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Prioritize all recommendations
 * @param {Array} recommendations - Recommendations
 * @returns {Array} Prioritized recommendations
 */
function prioritizeAllRecommendations(recommendations) {
  const impactWeight = { high: 3, medium: 2, low: 1, minimal: 0 };
  const effortWeight = { low: 3, medium: 2, high: 1 };

  return recommendations.sort((a, b) => {
    const scoreA = (impactWeight[a.impact] || 0) * (effortWeight[a.effort] || 1);
    const scoreB = (impactWeight[b.impact] || 0) * (effortWeight[b.effort] || 1);
    return scoreB - scoreA;
  });
}

/**
 * Count recommendations by category
 * @param {Array} recommendations - Recommendations
 * @returns {Object} Counts by category
 */
function countByCategory(recommendations) {
  const counts = {};
  recommendations.forEach(rec => {
    counts[rec.category] = (counts[rec.category] || 0) + 1;
  });
  return counts;
}

/**
 * Count recommendations by impact
 * @param {Array} recommendations - Recommendations
 * @returns {Object} Counts by impact
 */
function countByImpact(recommendations) {
  const counts = { high: 0, medium: 0, low: 0, minimal: 0 };
  recommendations.forEach(rec => {
    if (rec.impact in counts) {
      counts[rec.impact]++;
    }
  });
  return counts;
}

/**
 * Clear all optimization histories
 */
export function clearAllHistories() {
  const optimizers = getAllOptimizers();
  Object.values(optimizers).forEach(optimizer => optimizer.clearHistory());
}
