/**
 * Detectors Module - Change Detection System
 *
 * Phase 8.1: Change Detectors
 * Exports all change detectors
 */

export {
  BaseDetector,
  CHANGE_TYPE,
  CHANGE_SEVERITY
} from './base-detector.js';

import { getDependencyChangeDetector as _getDependencyChangeDetector } from './dependency-change-detector.js';
import { getFileChangeDetector as _getFileChangeDetector } from './file-change-detector.js';
import { getConfigChangeDetector as _getConfigChangeDetector } from './config-change-detector.js';

export {
  DependencyChangeDetector,
  getDependencyChangeDetector,
  DEPENDENCY_FILES
} from './dependency-change-detector.js';

export {
  FileChangeDetector,
  getFileChangeDetector,
  FILE_CATEGORY,
  FILE_PATTERNS
} from './file-change-detector.js';

export {
  ConfigChangeDetector,
  getConfigChangeDetector,
  DOCKER_CONFIG_FILES
} from './config-change-detector.js';

/**
 * Get all detectors
 * @returns {Object} All detector instances
 */
export function getAllDetectors() {
  return {
    dependency: _getDependencyChangeDetector(),
    file: _getFileChangeDetector(),
    config: _getConfigChangeDetector()
  };
}

/**
 * Reset all detectors
 */
export function resetAllDetectors() {
  const detectors = getAllDetectors();
  Object.values(detectors).forEach(detector => detector.reset());
}
