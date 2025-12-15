/**
 * Logger utility for Flutter Writer Agent
 */

import { createLogger as baseCreateLogger } from '../../../foundation/common/logger.js';

export function createLogger(module) {
  return baseCreateLogger(`FlutterWriter:${module}`);
}

export default createLogger;
