/**
 * Logger utility for Frontend Writer Agent
 */

import { createLogger as baseCreateLogger } from '../../../foundation/common/logger.js';

export function createLogger(module) {
  return baseCreateLogger(`FrontendWriter:${module}`);
}

export default createLogger;
