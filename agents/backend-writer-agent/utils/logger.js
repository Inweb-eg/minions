/**
 * Logger utility for Backend Writer Agent
 */

import { createLogger as baseCreateLogger } from '../../../foundation/common/logger.js';

export function createLogger(module) {
  return baseCreateLogger(`BackendWriter:${module}`);
}

export default createLogger;
